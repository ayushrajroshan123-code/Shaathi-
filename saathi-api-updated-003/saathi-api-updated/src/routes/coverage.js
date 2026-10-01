const express = require('express');
const { query, withTransaction } = require('../db');
const { requireRole, ApiError, dbErrorToApiError } = require('../middleware/context');
const { assertCanCancelCoverage, effectiveStatus } = require('../services/coverage');
const { isEligible } = require('../services/eligibility');

const router = express.Router();

function withComputedStatus(row) {
  return { ...row, status: effectiveStatus(row) };
}

// POST /coverage-requests — create (requester)
router.post('/', async (req, res, next) => {
  try {
    const { task_type, date, time_window_start, time_window_end, location, notes } = req.body;
    if (!task_type || !date || !time_window_start || !time_window_end || !location) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'task_type, date, time_window_start, time_window_end, location are required');
    }
    // NOTE: task-launch-boundary and time-window CHECKs are enforced by the
    // database itself (trigger + CHECK constraints) — no need to duplicate
    // that logic here beyond producing a clean error if it fires.
    const { rows } = await query(
      `INSERT INTO coverage_requests (task_type, requested_by, date, time_window_start, time_window_end, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [task_type, req.actor.user_id, date, time_window_start, time_window_end, location, notes || null]
    );
    res.status(201).json(withComputedStatus(rows[0]));
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// Only the requester, the assigned volunteer, or a coordinator may read a
// request's details (location, notes, etc). A non-participant gets the
// same 404 a nonexistent id would, so the endpoint can't be used to probe
// which ids exist — same pattern as the eligibility endpoint.
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM coverage_requests WHERE request_id = $1', [req.params.id]);
    if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'coverage request not found');
    const request = rows[0];
    const isParticipant = req.actor.user_id === request.requested_by || req.actor.user_id === request.assigned_to;
    if (!isParticipant && req.actor.role !== 'coordinator') {
      throw new ApiError(404, 'NOT_FOUND', 'coverage request not found');
    }
    res.json(withComputedStatus(request));
  } catch (err) {
    next(err);
  }
});

// GET /coverage-requests?mine=true&status=...
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM coverage_requests
       WHERE requested_by = $1 OR assigned_to = $1
       ORDER BY time_window_start DESC`,
      [req.actor.user_id]
    );
    res.json(rows.map(withComputedStatus));
  } catch (err) {
    next(err);
  }
});

// POST /coverage-requests/:id/accept — eligible assigned volunteer
router.post('/:id/accept', async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM coverage_requests WHERE request_id = $1 FOR UPDATE',
        [req.params.id]
      );
      if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'coverage request not found');
      const request = rows[0];

      if (effectiveStatus(request) !== 'REQUESTED') {
        throw new ApiError(409, 'INVALID_STATE', `cannot accept a ${effectiveStatus(request)} request`);
      }
      if (!['resident', 'verified_helper'].includes(req.actor.role)) {
        throw new ApiError(403, 'FORBIDDEN', 'only a resident or verified_helper may accept coverage');
      }

      const eligibility = await isEligible(req.actor.user_id, request.task_type);
      if (!eligibility.eligible) {
        throw new ApiError(403, 'NOT_ELIGIBLE', `not eligible for task_type ${request.task_type}`);
      }

      const updated = await client.query(
        `UPDATE coverage_requests SET status = 'ACCEPTED', assigned_to = $1
         WHERE request_id = $2 RETURNING *`,
        [req.actor.user_id, request.request_id]
      );
      return updated.rows[0];
    });
    res.json(withComputedStatus(result));
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /coverage-requests/:id/start — assigned volunteer only
router.post('/:id/start', async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM coverage_requests WHERE request_id = $1 FOR UPDATE',
        [req.params.id]
      );
      if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'coverage request not found');
      const request = rows[0];

      if (request.assigned_to !== req.actor.user_id) {
        throw new ApiError(403, 'FORBIDDEN', 'only the assigned volunteer may start coverage');
      }
      if (effectiveStatus(request) !== 'ACCEPTED') {
        throw new ApiError(409, 'INVALID_STATE', `cannot start a ${effectiveStatus(request)} request`);
      }
      const updated = await client.query(
        `UPDATE coverage_requests SET status = 'IN_PROGRESS' WHERE request_id = $1 RETURNING *`,
        [request.request_id]
      );
      return updated.rows[0];
    });
    res.json(withComputedStatus(result));
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /coverage-requests/:id/cancel — requester or assigned volunteer, per frozen table
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM coverage_requests WHERE request_id = $1 FOR UPDATE',
        [req.params.id]
      );
      if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'coverage request not found');
      const request = { ...rows[0], status: effectiveStatus(rows[0]) };

      assertCanCancelCoverage(req.actor.user_id, request);

      const updated = await client.query(
        `UPDATE coverage_requests SET status = 'CANCELLED' WHERE request_id = $1 RETURNING *`,
        [request.request_id]
      );
      return updated.rows[0];
    });
    res.json(withComputedStatus(result));
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /coverage-requests/:id/complete — assigned volunteer; DB trigger
// enforces the access-handoff-confirmed precondition, we just surface it.
router.post('/:id/complete', async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM coverage_requests WHERE request_id = $1 FOR UPDATE',
        [req.params.id]
      );
      if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'coverage request not found');
      const request = rows[0];

      if (request.assigned_to !== req.actor.user_id) {
        throw new ApiError(403, 'FORBIDDEN', 'only the assigned volunteer may complete coverage');
      }
      if (effectiveStatus(request) !== 'IN_PROGRESS') {
        throw new ApiError(409, 'INVALID_STATE', `cannot complete a ${effectiveStatus(request)} request`);
      }

      const updated = await client.query(
        `UPDATE coverage_requests SET status = 'COMPLETED' WHERE request_id = $1 RETURNING *`,
        [request.request_id]
      );
      return updated.rows[0];
    });
    res.json(withComputedStatus(result));
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// --- Access handoff sub-resource -------------------------------------------

// POST /coverage-requests/:id/handoff — create/update access handoff record
router.post('/:id/handoff', async (req, res, next) => {
  try {
    const { access_type, provided_at } = req.body;
    if (!access_type) throw new ApiError(400, 'VALIDATION_ERROR', 'access_type is required');

    const { rows: reqRows } = await query('SELECT * FROM coverage_requests WHERE request_id = $1', [req.params.id]);
    if (reqRows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'coverage request not found');
    const request = reqRows[0];
    if (![request.requested_by, request.assigned_to].includes(req.actor.user_id)) {
      throw new ApiError(403, 'FORBIDDEN', 'only coverage participants may record a handoff');
    }

    const { rows } = await query(
      `INSERT INTO access_handoffs (coverage_request_id, access_type, provided_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (coverage_request_id) DO UPDATE
         SET access_type = EXCLUDED.access_type,
             provided_at = COALESCE(EXCLUDED.provided_at, access_handoffs.provided_at)
       RETURNING *`,
      [req.params.id, access_type, provided_at || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /coverage-requests/:id/handoff/confirm — respective party confirms
router.post('/:id/handoff/confirm', async (req, res, next) => {
  try {
    const { rows: reqRows } = await query('SELECT * FROM coverage_requests WHERE request_id = $1', [req.params.id]);
    if (reqRows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'coverage request not found');
    const request = reqRows[0];

    let column;
    if (req.actor.user_id === request.requested_by) column = 'requester_confirmed';
    else if (req.actor.user_id === request.assigned_to) column = 'volunteer_confirmed';
    else throw new ApiError(403, 'FORBIDDEN', 'only coverage participants may confirm handoff');

    const { rows } = await query(
      `UPDATE access_handoffs SET ${column} = TRUE
       WHERE coverage_request_id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'no access handoff exists for this coverage request');
    res.json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

module.exports = router;
