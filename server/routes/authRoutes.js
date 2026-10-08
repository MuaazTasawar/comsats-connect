'use strict';

const express = require('express');
const { AppError } = require('../store/db');
const users = require('../services/userService');
const { signToken, authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/* ------------------------------------------------------------------ */
/* Brute-force protection: 5 failed logins per minute per IP + login ID */
/* ------------------------------------------------------------------ */

const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 60 * 1000;
const failures = new Map();

function failureKey(req, loginId) {
  return req.ip + '|' + String(loginId || '').trim().toLowerCase();
}

function assertNotLocked(key) {
  const entry = failures.get(key);
  if (!entry) return;
  if (Date.now() > entry.resetAt) {
    failures.delete(key);
    return;
  }
  if (entry.count >= MAX_FAILURES) {
    throw new AppError(
      429,
      'Too many failed login attempts. Please wait a minute and try again.',
      'TOO_MANY_ATTEMPTS'
    );
  }
}

function recordFailure(key) {
  const entry = failures.get(key);
  if (!entry || Date.now() > entry.resetAt) {
    failures.set(key, { count: 1, resetAt: Date.now() + FAILURE_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

// POST /api/auth/login   { loginId, password }
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const key = failureKey(req, body.loginId);
    assertNotLocked(key);

    let user;
    try {
      user = await users.authenticate(body.loginId, body.password);
    } catch (err) {
      if (err.code === 'INVALID_CREDENTIALS') recordFailure(key);
      throw err;
    }

    failures.delete(key);
    res.json({ token: signToken(user), user });
  })
);

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;