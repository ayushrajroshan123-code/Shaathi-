const express = require('express');
const { query } = require('../db');
const { ApiError, dbErrorToApiError } = require('../middleware/context');
const { assertOwnerAction, assertRequesterAction, effectiveResourceStatus } = require('../services/resources');

const router = express.Router();

function withComputedStatus(row) {
  return { ...row, status: effectiveResourceStatus(row) };
}

// POST /resources — list an item (owner)
router.post('/', async (req, res, next) => {
  try {
    const { type, condition, availability_window_start, availability_window_end, emergency_opt_in, location } = req.body;
    if (!type || !condition || !location) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'type, condition, and location are required');
    }
    const { rows } = await query(
      `INSERT INTO resource_inventory
         (owner_id, type, condition, availability_window_start, availability_window_end, emergency_opt_in, location)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, FALSE), $7)
       RETURNING *`,
      [req.actor.user_id, type, condition, availability_window_start || null, availability_window_end || null, emergency_opt_in ?? null, location]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// GET /resources — browse active listings, optionally by type
router.get('/', async (req, res, next) => {
  try {
    const { type } = req.query;
    const { rows } = await query(
      `SELECT * FROM resource_inventory WHERE is_active = TRUE AND ($1::text IS NULL OR type = $1) ORDER BY created_at DESC`,
      [type || null]
    );
    res.json(rows);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// --- Resource requests -------------------------------------------------

// POST /resource-requests — requester asks to borrow
router.post('/requests', async (req, res, next) => {
  try {
    const { resource_id, time_window_start, time_window_end, handoff_method } = req.body;
    if (!resource_id || !time_window_start || !time_window_end || !handoff_method) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'resource_id, time_window_start, time_window_end, handoff_method are required');
    }
    const { rows } = await query(
      `INSERT INTO resource_requests (resource_id, requested_by, time_window_start, time_window_end, handoff_method)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [resource_id, req.actor.user_id, time_window_start, time_window_end, handoff_method]
    );
    res.status(201).json(withComputedStatus(rows[0]));
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

async function loadRequestAndResource(requestId) {
  const { rows } = await query(
    `SELECT rr.*, ri.owner_id
     FROM resource_requests rr
     JOIN resource_inventory ri ON ri.resource_id = rr.resource_id
     WHERE rr.request_id = $1`,
    [requestId]
  );
  if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'resource request not found');
  return rows[0];
}

// Only the requester, the resource's owner, or a coordinator may read a
// request's details. A non-participant gets the same 404 a nonexistent id
// would (same pattern as coverage requests / eligibility).
router.get('/requests/:id', async (req, res, next) => {
  try {
    const request = await loadRequestAndResource(req.params.id);
    const isParticipant = req.actor.user_id === request.requested_by || req.actor.user_id === request.owner_id;
    if (!isParticipant && req.actor.role !== 'coordinator') {
      throw new ApiError(404, 'NOT_FOUND', 'resource request not found');
    }
    const { owner_id, ...resourceRequest } = request; // owner_id is a join artifact, not a resource_requests column
    res.json(withComputedStatus(resourceRequest));
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /resource-requests/:id/accept — owner accepts
router.post('/requests/:id/accept', async (req, res, next) => {
  try {
    const request = await loadRequestAndResource(req.params.id);
    assertOwnerAction(req.actor.user_id, request);
    if (effectiveResourceStatus(request) !== 'REQUESTED') {
      throw new ApiError(409, 'INVALID_STATE', `cannot accept a ${effectiveResourceStatus(request)} request`);
    }
    const { rows } = await query(
      `UPDATE resource_requests SET status = 'ACCEPTED' WHERE request_id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(withComputedStatus(rows[0]));
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /resource-requests/:id/handoff — owner marks handed off
router.post('/requests/:id/handoff', async (req, res, next) => {
  try {
    const request = await loadRequestAndResource(req.params.id);
    assertOwnerAction(req.actor.user_id, request);
    if (effectiveResourceStatus(request) !== 'ACCEPTED') {
      throw new ApiError(409, 'INVALID_STATE', `cannot hand off a ${effectiveResourceStatus(request)} request`);
    }
    const { rows } = await query(
      `UPDATE resource_requests SET status = 'HANDED_OFF' WHERE request_id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(withComputedStatus(rows[0]));
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /resource-requests/:id/handoff/confirm — requester's non-blocking attestation
router.post('/requests/:id/handoff/confirm', async (req, res, next) => {
  try {
    const request = await loadRequestAndResource(req.params.id);
    assertRequesterAction(req.actor.user_id, request);
    const { rows } = await query(
      `UPDATE resource_requests SET requester_confirmed_handoff = TRUE WHERE request_id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(withComputedStatus(rows[0]));
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /resource-requests/:id/return — owner marks returned
router.post('/requests/:id/return', async (req, res, next) => {
  try {
    const request = await loadRequestAndResource(req.params.id);
    assertOwnerAction(req.actor.user_id, request);
    if (effectiveResourceStatus(request) !== 'HANDED_OFF') {
      throw new ApiError(409, 'INVALID_STATE', `cannot return a ${effectiveResourceStatus(request)} request`);
    }
    const { rows } = await query(
      `UPDATE resource_requests SET status = 'RETURNED' WHERE request_id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(withComputedStatus(rows[0]));
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /resource-requests/:id/return/confirm — requester's non-blocking attestation
router.post('/requests/:id/return/confirm', async (req, res, next) => {
  try {
    const request = await loadRequestAndResource(req.params.id);
    assertRequesterAction(req.actor.user_id, request);
    const { rows } = await query(
      `UPDATE resource_requests SET requester_confirmed_return = TRUE WHERE request_id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(withComputedStatus(rows[0]));
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /resource-requests/:id/cancel — requester or owner
router.post('/requests/:id/cancel', async (req, res, next) => {
  try {
    const request = await loadRequestAndResource(req.params.id);
    const isRequester = req.actor.user_id === request.requested_by;
    const isOwner = req.actor.user_id === request.owner_id;
    if (!isRequester && !isOwner) {
      throw new ApiError(403, 'FORBIDDEN', 'only the requester or owner may cancel');
    }
    if (!['REQUESTED', 'ACCEPTED'].includes(effectiveResourceStatus(request))) {
      throw new ApiError(409, 'INVALID_STATE', `cannot cancel a ${effectiveResourceStatus(request)} request`);
    }
    const { rows } = await query(
      `UPDATE resource_requests SET status = 'CANCELLED' WHERE request_id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(withComputedStatus(rows[0]));
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

module.exports = router;
