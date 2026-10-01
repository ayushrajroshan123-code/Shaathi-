const express = require('express');
const { query } = require('../db');
const { requireRole, ApiError, dbErrorToApiError } = require('../middleware/context');
const { assertCanViewEligibility, isEligible } = require('../services/eligibility');
const { hashPassword } = require('../services/auth');

const router = express.Router();

// POST /users — hub-scoped user creation. In practice this is usually
// driven by roster import (hubs.roster_source), but exposed directly here
// for manual/pilot use. A coordinator creating a user directly is itself
// the vouching step, so account_status defaults to 'active' (the column
// default) — no separate approval step, unlike POST /auth/signup.
// email/password are optional here: a coordinator can provision login
// credentials up front, or leave them unset and let the person set their
// own contact method later (not yet built — open item).
router.post('/', requireRole('coordinator'), async (req, res, next) => {
  try {
    const {
      hub_id, name, role, contact_preferences, notification_endpoints, emergency_contact_user_id,
      email, password,
    } = req.body;
    if (!hub_id || !name || !role) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'hub_id, name, and role are required');
    }
    if (password && !email) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'password requires email');
    }
    const { rows } = await query(
      `INSERT INTO users
         (hub_id, name, role, contact_preferences, notification_endpoints, emergency_contact_user_id,
          email, password_hash)
       VALUES ($1, $2, $3, COALESCE($4, '{}'::jsonb), COALESCE($5, '{}'::jsonb), $6, $7, $8)
       RETURNING *`,
      [
        hub_id, name, role, contact_preferences || null, notification_endpoints || null, emergency_contact_user_id || null,
        email || null, password ? hashPassword(password) : null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// GET /users/pending — coordinator queue of self-signups awaiting review.
// Mounted before /:userId so 'pending' isn't parsed as a user_id.
router.get('/pending', requireRole('coordinator'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT user_id, hub_id, name, role, email, created_at
       FROM users WHERE account_status = 'pending_approval' ORDER BY created_at ASC`
    );
    res.json(rows);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// PATCH /users/:userId/approve — coordinator moves a self-signup to active.
router.patch('/:userId/approve', requireRole('coordinator'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE users SET account_status = 'active', approved_by = $2, approved_at = now()
       WHERE user_id = $1 AND account_status = 'pending_approval'
       RETURNING user_id, name, role, account_status`,
      [req.params.userId, req.actor.user_id]
    );
    if (rows.length === 0) {
      throw new ApiError(409, 'INVALID_STATE', 'user not found or not pending approval');
    }
    res.json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// PATCH /users/:userId/reject — coordinator declines a self-signup.
// Rejected accounts can never log in (see services/auth.js loadActorFromToken
// and routes/auth.js login), but the row is kept, not deleted, so the
// coordinator's decision and reasoning (if any is added later) stay on record.
router.patch('/:userId/reject', requireRole('coordinator'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE users SET account_status = 'rejected', approved_by = $2, approved_at = now()
       WHERE user_id = $1 AND account_status = 'pending_approval'
       RETURNING user_id, name, role, account_status`,
      [req.params.userId, req.actor.user_id]
    );
    if (rows.length === 0) {
      throw new ApiError(409, 'INVALID_STATE', 'user not found or not pending approval');
    }
    res.json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// Self or coordinator get the full row. Any other authenticated actor only
// gets the minimal public fields needed to identify a counterpart in a
// coverage/resource request — never contact_preferences,
// notification_endpoints, or emergency_contact_user_id.
router.get('/:userId', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM users WHERE user_id = $1', [req.params.userId]);
    if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'user not found');
    const user = rows[0];
    const isSelfOrCoordinator = req.actor.user_id === user.user_id || req.actor.role === 'coordinator';
    if (isSelfOrCoordinator) {
      return res.json(user);
    }
    res.json({ user_id: user.user_id, name: user.name, role: user.role });
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// GET /users/:userId/eligibility?task_type=...
// self allowed, coordinator allowed, anyone else gets 404 (see contract).
router.get('/:userId/eligibility', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { task_type: taskType } = req.query;
    if (!taskType) throw new ApiError(400, 'VALIDATION_ERROR', 'task_type query param is required');

    assertCanViewEligibility(req.actor, userId);
    const result = await isEligible(userId, taskType);
    res.json(result);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /verification-records — coordinator-issued only.
router.post('/:userId/verification-records', requireRole('coordinator'), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { method, tier, expires_at, notes } = req.body;
    if (!method || !tier) throw new ApiError(400, 'VALIDATION_ERROR', 'method and tier are required');

    const { rows } = await query(
      `INSERT INTO verification_records (user_id, method, verified_by, tier, expires_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, method, req.actor.user_id, tier, expires_at || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// GET /users/:userId/verification-records — self or coordinator only;
// this endpoint intentionally exposes tier/expiry/notes, unlike eligibility.
router.get('/:userId/verification-records', async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (req.actor.user_id !== userId && req.actor.role !== 'coordinator') {
      throw new ApiError(404, 'NOT_FOUND', 'user not found');
    }
    const { rows } = await query(
      'SELECT * FROM verification_records WHERE user_id = $1 ORDER BY verified_at DESC',
      [userId]
    );
    res.json(rows);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

module.exports = router;
