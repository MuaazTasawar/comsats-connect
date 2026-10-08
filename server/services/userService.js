'use strict';

const bcrypt = require('bcryptjs');
const db = require('../store/db');
const { AppError } = db;
const perm = require('./permissionService');
const {
  ROLES,
  DEPARTMENTS,
  LOGIN_ID_PATTERNS,
  LIMITS,
  AUTH,
} = require('../config/policies');

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// Never send the password hash to a client
function sanitize(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

// Used to keep login timing similar when the user does not exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', AUTH.BCRYPT_ROUNDS);

function cleanName(name) {
  if (typeof name !== 'string') {
    throw new AppError(400, 'Name is required.', 'BAD_NAME');
  }
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean.length < 2 || clean.length > 80) {
    throw new AppError(400, 'Name must be between 2 and 80 characters.', 'BAD_NAME');
  }
  return clean;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < LIMITS.MIN_PASSWORD_LENGTH) {
    throw new AppError(
      400,
      'Password must be at least ' + LIMITS.MIN_PASSWORD_LENGTH + ' characters.',
      'WEAK_PASSWORD'
    );
  }
}

function validateDepartment(department) {
  if (!DEPARTMENTS.includes(department)) {
    throw new AppError(
      400,
      'Department must be one of: ' + DEPARTMENTS.join(', ') + '.',
      'BAD_DEPARTMENT'
    );
  }
}

function normalizeLoginId(loginId, role) {
  if (typeof loginId !== 'string') {
    throw new AppError(400, 'Login ID is required.', 'BAD_LOGIN_ID');
  }
  const trimmed = loginId.trim();
  const normalized = role === ROLES.STUDENT ? trimmed.toUpperCase() : trimmed.toLowerCase();

  if (!LOGIN_ID_PATTERNS[role].test(normalized)) {
    const hint =
      role === ROLES.STUDENT
        ? 'Students use a registration number like FA22-BCS-045.'
        : 'Faculty and admin staff use a username of 3-30 letters, digits, dots, dashes or underscores.';
    throw new AppError(400, 'Invalid login ID. ' + hint, 'BAD_LOGIN_ID');
  }
  return normalized;
}

function findRawByLoginId(loginId) {
  if (typeof loginId !== 'string') return null;
  const target = loginId.trim().toLowerCase();
  return (
    db.collection('users').find((u) => u.loginId.toLowerCase() === target) || null
  );
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

async function createUser(input) {
  const data = input || {};

  if (!Object.values(ROLES).includes(data.role)) {
    throw new AppError(
      400,
      'Role must be one of: ' + Object.values(ROLES).join(', ') + '.',
      'BAD_ROLE'
    );
  }

  const name = cleanName(data.name);
  const loginId = normalizeLoginId(data.loginId, data.role);
  validateDepartment(data.department);
  validatePassword(data.password);

  if (findRawByLoginId(loginId)) {
    throw new AppError(409, 'A user with this login ID already exists.', 'USER_EXISTS');
  }

  const passwordHash = await bcrypt.hash(data.password, AUTH.BCRYPT_ROUNDS);

  const user = {
    id: db.newId('usr'),
    loginId,
    name,
    role: data.role,
    department: data.department,
    passwordHash,
    active: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };

  db.collection('users').push(user);
  db.save();
  return sanitize(user);
}

async function authenticate(loginId, password) {
  const user = findRawByLoginId(loginId);
  const hash = user ? user.passwordHash : DUMMY_HASH;
  const matches = await bcrypt.compare(typeof password === 'string' ? password : '', hash);

  if (!user || !matches) {
    throw new AppError(401, 'Invalid login ID or password.', 'INVALID_CREDENTIALS');
  }
  if (!user.active) {
    throw new AppError(403, 'This account has been deactivated.', 'ACCOUNT_DISABLED');
  }

  user.lastLoginAt = new Date().toISOString();
  db.save();
  return sanitize(user);
}

function getUserById(id) {
  const user = db.collection('users').find((u) => u.id === id);
  return sanitize(user);
}

function getUserByLoginId(loginId) {
  return sanitize(findRawByLoginId(loginId));
}

function requireUser(id) {
  const user = getUserById(id);
  if (!user) {
    throw new AppError(404, 'User not found.', 'USER_NOT_FOUND');
  }
  return user;
}

function listUsers(filters) {
  const f = filters || {};
  let users = db.collection('users');

  if (f.role) users = users.filter((u) => u.role === f.role);
  if (f.department) users = users.filter((u) => u.department === f.department);
  if (!f.includeInactive) users = users.filter((u) => u.active);
  if (f.search) {
    const term = String(f.search).toLowerCase();
    users = users.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.loginId.toLowerCase().includes(term)
    );
  }

  return users
    .map(sanitize)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function updateUser(id, changes) {
  const user = db.collection('users').find((u) => u.id === id);
  if (!user) {
    throw new AppError(404, 'User not found.', 'USER_NOT_FOUND');
  }
  const c = changes || {};

  if (c.name !== undefined) user.name = cleanName(c.name);

  if (c.department !== undefined) {
    validateDepartment(c.department);
    user.department = c.department;
  }

  if (c.active !== undefined) {
    if (typeof c.active !== 'boolean') {
      throw new AppError(400, '"active" must be true or false.', 'BAD_ACTIVE');
    }
    if (c.active === false && user.role === ROLES.ADMIN) {
      const otherActiveAdmins = db
        .collection('users')
        .filter((u) => u.role === ROLES.ADMIN && u.active && u.id !== user.id);
      if (otherActiveAdmins.length === 0) {
        throw new AppError(400, 'You cannot deactivate the last active admin.', 'LAST_ADMIN');
      }
    }
    user.active = c.active;
  }

  if (c.password !== undefined) {
    validatePassword(c.password);
    user.passwordHash = await bcrypt.hash(c.password, AUTH.BCRYPT_ROUNDS);
  }

  db.save();
  return sanitize(user);
}

/* ------------------------------------------------------------------ */
/* Direct messages (persistence lives with users, rules in permissions) */
/* ------------------------------------------------------------------ */

function sendDirectMessage(sender, recipientId, text) {
  const recipient = requireUser(recipientId);
  perm.assertAllowed(perm.checkDirectMessage(sender, recipient));
  const clean = perm.validateMessageText(text);

  const message = {
    id: db.newId('dm'),
    fromId: sender.id,
    toId: recipient.id,
    senderName: sender.name,
    text: clean,
    createdAt: new Date().toISOString(),
  };

  db.collection('directMessages').push(message);
  db.save();
  return message;
}

function getDirectHistory(userId, otherUserId, options) {
  requireUser(otherUserId);
  const conversation = db
    .collection('directMessages')
    .filter(
      (m) =>
        (m.fromId === userId && m.toId === otherUserId) ||
        (m.fromId === otherUserId && m.toId === userId)
    );
  return db.latest(conversation, options);
}

// One entry per person the user has talked to, newest conversation first
function listConversations(userId) {
  const lastByPartner = new Map();

  db.collection('directMessages').forEach((m) => {
    if (m.fromId !== userId && m.toId !== userId) return;
    const partnerId = m.fromId === userId ? m.toId : m.fromId;
    lastByPartner.set(partnerId, m);
  });

  return Array.from(lastByPartner.entries())
    .map(([partnerId, lastMessage]) => ({
      partner: getUserById(partnerId),
      lastMessage,
    }))
    .filter((entry) => entry.partner)
    .sort((a, b) => (a.lastMessage.createdAt < b.lastMessage.createdAt ? 1 : -1));
}

module.exports = {
  sanitize,
  createUser,
  authenticate,
  getUserById,
  getUserByLoginId,
  requireUser,
  listUsers,
  updateUser,
  sendDirectMessage,
  getDirectHistory,
  listConversations,
};