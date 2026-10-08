'use strict';

const jwt = require('jsonwebtoken');
const { AppError } = require('../store/db');
const users = require('../services/userService');
const { AUTH } = require('../config/policies');

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, AUTH.JWT_SECRET, {
    expiresIn: AUTH.JWT_EXPIRES_IN,
  });
}

// Shared by the REST middleware below and the Socket.IO handshake (Phase 3).
// The role is always read from the database, never trusted from the token,
// so a deactivated or demoted user loses access immediately.
function userFromToken(token) {
  if (!token) {
    throw new AppError(401, 'Authentication required.', 'NO_TOKEN');
  }

  let payload;
  try {
    payload = jwt.verify(token, AUTH.JWT_SECRET);
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Your session has expired. Please log in again.'
        : 'Invalid authentication token.';
    throw new AppError(401, message, 'INVALID_TOKEN');
  }

  const user = users.getUserById(payload.sub);
  if (!user) {
    throw new AppError(401, 'This account no longer exists.', 'INVALID_TOKEN');
  }
  if (!user.active) {
    throw new AppError(403, 'This account has been deactivated.', 'ACCOUNT_DISABLED');
  }
  return user;
}

function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function authenticate(req, res, next) {
  try {
    req.user = userFromToken(extractBearerToken(req));
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(403, 'This action requires one of these roles: ' + roles.join(', ') + '.', 'ROLE_FORBIDDEN')
      );
    }
    next();
  };
}

module.exports = {
  signToken,
  userFromToken,
  authenticate,
  requireRole,
};