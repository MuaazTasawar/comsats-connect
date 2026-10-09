'use strict';

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');

const {
  SERVER,
  ROLES,
  GROUP_TYPES,
  POST_POLICIES,
  GROUP_CREATION_RULES,
  DEPARTMENTS,
  LIMITS,
} = require('./config/policies');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');
const { attachSockets } = require('./sockets');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

/* ------------------------------------------------------------------ */
/* Middleware                                                          */
/* ------------------------------------------------------------------ */

const corsOrigin =
  SERVER.CLIENT_ORIGIN === '*'
    ? true
    : SERVER.CLIENT_ORIGIN.split(',').map((origin) => origin.trim());

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

/* ------------------------------------------------------------------ */
/* Socket.IO (routes reach it through app.get('io'))                   */
/* ------------------------------------------------------------------ */

const io = attachSockets(server, corsOrigin);
app.set('io', io);

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Public description of the rules, handy for clients and for the demo
app.get('/api/meta', (req, res) => {
  res.json({
    roles: Object.values(ROLES),
    groupTypes: Object.values(GROUP_TYPES),
    postPolicies: Object.values(POST_POLICIES),
    groupCreationRules: GROUP_CREATION_RULES,
    departments: DEPARTMENTS,
    messageMaxLength: LIMITS.MESSAGE_MAX_LENGTH,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);

app.use(notFound);
app.use(errorHandler);

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

function start() {
  server.listen(SERVER.PORT, () => {
    console.log('COMSATS Connect API running on http://localhost:' + SERVER.PORT);
    console.log('Socket.IO is ready for connections.');
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, server, io, start };