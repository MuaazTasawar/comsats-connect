'use strict';

require('dotenv').config();

const path = require('path');

/* ------------------------------------------------------------------ */
/* Roles, group types, posting policies                                */
/* ------------------------------------------------------------------ */

const ROLES = Object.freeze({
  ADMIN: 'admin',
  FACULTY: 'faculty',
  STUDENT: 'student',
});

const GROUP_TYPES = Object.freeze({
  CLASS: 'class', // e.g. BCS-7A
  COURSE: 'course', // e.g. CSC334 Parallel and Distributed Computing
  DEPARTMENT: 'department', // e.g. Department of Computer Science
  SOCIETY: 'society', // e.g. ACM Student Chapter
  FYP: 'fyp', // final year project team
  OFFICE: 'office', // e.g. Exam Cell, Admissions Office
});

const POST_POLICIES = Object.freeze({
  EVERYONE: 'everyone', // every unmuted member can post
  FACULTY_ONLY: 'faculty_only', // members can read; only faculty/admin members can post
  ADMIN_ONLY: 'admin_only', // members can read; only admin members can post
});

// Which user roles may post under each policy
const POST_POLICY_ALLOWED_ROLES = Object.freeze({
  everyone: ['admin', 'faculty', 'student'],
  faculty_only: ['admin', 'faculty'],
  admin_only: ['admin'],
});

/* ------------------------------------------------------------------ */
/* Who may create which kind of group                                  */
/* ------------------------------------------------------------------ */

const GROUP_CREATION_RULES = Object.freeze({
  admin: {
    types: Object.values(GROUP_TYPES),
    policies: Object.values(POST_POLICIES),
  },
  faculty: {
    types: [GROUP_TYPES.COURSE, GROUP_TYPES.FYP],
    policies: [POST_POLICIES.EVERYONE, POST_POLICIES.FACULTY_ONLY],
  },
  student: {
    types: [GROUP_TYPES.SOCIETY, GROUP_TYPES.FYP],
    policies: [POST_POLICIES.EVERYONE],
  },
});

/* ------------------------------------------------------------------ */
/* Direct message boundaries (rule applies to the SENDER's role)       */
/* ------------------------------------------------------------------ */

const DM_RULES = Object.freeze({
  admin: 'anyone',
  faculty: 'anyone',
  // students may DM someone only if they share a group with them,
  // or if that person has already messaged them first
  student: 'shared_group_or_replied',
});

/* ------------------------------------------------------------------ */
/* COMSATS departments and login ID formats                            */
/* ------------------------------------------------------------------ */

const DEPARTMENTS = Object.freeze([
  'Computer Science',
  'Electrical and Computer Engineering',
  'Management Sciences',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Bioscience',
  'Humanities',
  'Pharmacy',
  'Civil Engineering',
  'Meteorology',
  'Administration',
]);

// Students log in with their registration number, e.g. FA22-BCS-045
// Faculty and admin staff use a username, e.g. dr.ahmed or exam.cell
const LOGIN_ID_PATTERNS = Object.freeze({
  student: /^(FA|SP)\d{2}-[A-Z]{3}-\d{3}$/,
  faculty: /^[a-z0-9._-]{3,30}$/i,
  admin: /^[a-z0-9._-]{3,30}$/i,
});

/* ------------------------------------------------------------------ */
/* Socket.IO event names (shared by server and demo client)            */
/* ------------------------------------------------------------------ */

const EVENTS = Object.freeze({
  // client -> server (with acknowledgement callback)
  GROUP_MESSAGE: 'group:message',
  DIRECT_MESSAGE: 'direct:message',
  GROUP_HISTORY: 'group:history',
  DIRECT_HISTORY: 'direct:history',
  MY_GROUPS: 'groups:list',
  TYPING: 'typing',
  // server -> client (pushed)
  PRESENCE: 'presence:update',
  GROUP_ADDED: 'group:added',
  GROUP_REMOVED: 'group:removed',
  GROUP_UPDATED: 'group:updated',
});

/* ------------------------------------------------------------------ */
/* Numeric limits (overridable through .env)                           */
/* ------------------------------------------------------------------ */

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const LIMITS = Object.freeze({
  MESSAGE_MAX_LENGTH: toInt(process.env.MESSAGE_MAX_LENGTH, 2000),
  RATE_LIMIT_MESSAGES: toInt(process.env.RATE_LIMIT_MESSAGES, 10),
  RATE_LIMIT_WINDOW_MS: toInt(process.env.RATE_LIMIT_WINDOW_MS, 10000),
  HISTORY_LIMIT: toInt(process.env.HISTORY_LIMIT, 50),
  MIN_PASSWORD_LENGTH: 8,
  MAX_GROUP_NAME_LENGTH: 60,
  MAX_GROUP_MEMBERS: 500,
});

/* ------------------------------------------------------------------ */
/* Server and auth settings                                            */
/* ------------------------------------------------------------------ */

const DEV_FALLBACK_SECRET = 'dev-only-secret-change-me';

if (!process.env.JWT_SECRET) {
  console.warn(
    '[config] JWT_SECRET is not set in .env, using an insecure development secret.'
  );
}

const SERVER = Object.freeze({
  PORT: toInt(process.env.PORT, 3000),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || '*',
  DB_FILE: path.join(__dirname, '..', 'data', 'db.json'),
});

const AUTH = Object.freeze({
  JWT_SECRET: process.env.JWT_SECRET || DEV_FALLBACK_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  BCRYPT_ROUNDS: 10,
});

module.exports = {
  ROLES,
  GROUP_TYPES,
  POST_POLICIES,
  POST_POLICY_ALLOWED_ROLES,
  GROUP_CREATION_RULES,
  DM_RULES,
  DEPARTMENTS,
  LOGIN_ID_PATTERNS,
  EVENTS,
  LIMITS,
  SERVER,
  AUTH,
};