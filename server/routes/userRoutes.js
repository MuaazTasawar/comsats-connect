'use strict';

const express = require('express');
const users = require('../services/userService');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.use(authenticate);

// GET /api/users?role=&department=&search=&includeInactive=true
// Everyone can look people up (needed to add members and start DMs).
// Only admins can see deactivated accounts.
router.get('/', (req, res) => {
  const includeInactive =
    req.user.role === 'admin' && req.query.includeInactive === 'true';

  res.json({
    users: users.listUsers({
      role: req.query.role,
      department: req.query.department,
      search: req.query.search,
      includeInactive,
    }),
  });
});

// GET /api/users/me/conversations   (must be declared before "/:id")
router.get('/me/conversations', (req, res) => {
  res.json({ conversations: users.listConversations(req.user.id) });
});

// GET /api/users/:id
router.get('/:id', (req, res) => {
  res.json({ user: users.requireUser(req.params.id) });
});

// GET /api/users/:id/messages?limit=&before=
// Your own direct-message history with that user. Nobody can read
// other people's conversations because the caller is always one side.
router.get('/:id/messages', (req, res) => {
  const messages = users.getDirectHistory(req.user.id, req.params.id, {
    limit: req.query.limit,
    before: req.query.before,
  });
  res.json({ messages });
});

// POST /api/users   (admin)
router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const user = await users.createUser(req.body || {});
    res.status(201).json({ user });
  })
);

// PATCH /api/users/:id   (admin)   { name?, department?, active?, password? }
router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const user = await users.updateUser(req.params.id, req.body || {});

    // A deactivated user is kicked off immediately
    const io = req.app.get('io');
    if (io && user.active === false) {
      io.in('user:' + user.id).disconnectSockets(true);
    }

    res.json({ user });
  })
);

module.exports = router;