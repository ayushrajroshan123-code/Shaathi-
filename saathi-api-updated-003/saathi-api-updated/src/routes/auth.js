const express = require('express');
const { query } = require('../db');
const { ApiError } = require('../lib/errors');
const {
  hashPassword,
  verifyPassword,
  createSession,
  revokeSession,
} = require('../services/auth');

/**
 * Two routers, mounted differently in app.js:
 *  - publicRouter: no session required — these ARE how a session is
 *    obtained, so they must run before loadActor.
 *  - protectedRouter: requires loadActor (logout needs to know which
 *    session to revoke).
 *
 * Email + password only — see API_CONTRACT.md decision #7.1, which
 * supersedes #7's phone+OTP path and removes it.
 */
const publicRouter = express.Router();
const protectedRouter = express.Router();

function dbErrorToApiError(err) {
  if (err instanceof ApiError) return err;
  if (err.code === '23505') {
    // unique_violation on email
    return new ApiError(409, 'ALREADY_EXISTS', 'an account with this email already exists');
  }
  if (err.code === '23514' || err.code === '23503') {
    // check_violation / foreign_key_violation
    return new ApiError(422, 'CONSTRAINT_VIOLATION', err.message);
  }
  return err;
}

// POST /auth/signup — { hub_id, name, email, password }
// New accounts always start as role='resident', account_status=
// 'pending_approval' — see PATCH /users/:id/approve|reject.
publicRouter.post('/signup', async (req, res, next) => {
  try {
    const { hub_id: hubId, name, email, password } = req.body;
    if (!hubId || !name || !email || !password) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'hub_id, name, email, and password are required');
    }

    // OPEN DECISION, NOT YET FROZEN: email/password signups have no
    // confirmation-link verification step — pending_approval +
    // coordinator review is the only gate on this path today. See
    // API_CONTRACT.md decision #7 (still open under #7.1).
    const passwordHash = hashPassword(password);

    const { rows } = await query(
      `INSERT INTO users (hub_id, name, role, email, password_hash, account_status)
       VALUES ($1, $2, 'resident', $3, $4, 'pending_approval')
       RETURNING user_id, name, role, account_status`,
      [hubId, name, email, passwordHash]
    );
    res.status(201).json({ ...rows[0], message: 'account created — awaiting coordinator approval' });
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /auth/login — { email, password }
publicRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'email and password are required');
    }

    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    // Same message whether the email doesn't exist or the password is
    // wrong — don't let login responses confirm which emails have
    // accounts.
    if (rows.length === 0 || !verifyPassword(password, rows[0].password_hash)) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'invalid email or password');
    }
    const userRow = rows[0];

    if (userRow.account_status === 'pending_approval') {
      throw new ApiError(403, 'PENDING_APPROVAL', 'account is awaiting coordinator approval');
    }
    if (userRow.account_status !== 'active' || !userRow.is_active) {
      throw new ApiError(403, 'ACCOUNT_INACTIVE', 'account is not active');
    }

    const token = await createSession(userRow.user_id);
    res.json({ token, user_id: userRow.user_id, role: userRow.role });
  } catch (err) {
    next(err);
  }
});

// GET /auth/me — Server-authoritative self-profile bootstrap for the active session.
// Protected by loadActor middleware: token must be valid, active, and unrevoked.
// Strict field allowlist: returns only verified fields required by the client;
// never exposes password_hash, token hashes, or internal administrative metadata.
protectedRouter.get('/me', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT user_id, hub_id, name, email, role, account_status, is_active, created_at
       FROM users WHERE user_id = $1`,
      [req.actor.user_id]
    );
    if (rows.length === 0) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'user profile not found');
    }
    const user = rows[0];
    if (user.account_status !== 'active' || !user.is_active) {
      throw new ApiError(403, 'ACCOUNT_INACTIVE', 'account is not active');
    }
    res.json({
      user_id: user.user_id,
      hub_id: user.hub_id,
      name: user.name,
      email: user.email,
      role: user.role,
      account_status: user.account_status,
      is_active: user.is_active,
      created_at: user.created_at,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout — revokes the calling session only (not all of the
// user's sessions on other devices).
protectedRouter.post('/logout', async (req, res, next) => {
  try {
    await revokeSession(req.session_id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = { publicRouter, protectedRouter };
