const express = require('express');
const { query } = require('../db');
const { requireRole, ApiError, dbErrorToApiError } = require('../middleware/context');

const router = express.Router();

/**
 * NOTE ON SCOPE: the frozen schema says "Emergency functionality is
 * represented in the schema for later phases but is not exposed by the
 * Phase 1 API." These routes are implemented (per request) but should stay
 * behind a feature flag / unmounted until that phase boundary is lifted —
 * see server.js.
 */

// --- Incidents --------------------------------------------------------

router.post('/incidents', async (req, res, next) => {
  try {
    const { source, location, latitude, longitude, affected_people, vulnerable_people } = req.body;
    if (!source || !location) throw new ApiError(400, 'VALIDATION_ERROR', 'source and location are required');
    const { rows } = await query(
      `INSERT INTO incidents (source, location, latitude, longitude, affected_people, vulnerable_people)
       VALUES ($1, $2, $3, $4, COALESCE($5, 0), COALESCE($6, 'none'))
       RETURNING *`,
      [source, location, latitude ?? null, longitude ?? null, affected_people ?? null, vulnerable_people ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.get('/incidents/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM incidents WHERE incident_id = $1', [req.params.id]);
    if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'incident not found');
    res.json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.get('/incidents', async (req, res, next) => {
  try {
    const { status } = req.query;
    const { rows } = await query(
      `SELECT * FROM incidents WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC`,
      [status || null]
    );
    res.json(rows);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// PATCH /incidents/:id — coordinator status/priority updates, logged via priority_overrides
router.patch('/incidents/:id', requireRole('coordinator'), async (req, res, next) => {
  try {
    const { status, priority_score, priority_level, reason } = req.body;
    const { rows: existingRows } = await query('SELECT * FROM incidents WHERE incident_id = $1', [req.params.id]);
    if (existingRows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'incident not found');
    const existing = existingRows[0];

    const { rows } = await query(
      `UPDATE incidents SET
         status = COALESCE($2, status),
         priority_score = COALESCE($3, priority_score),
         priority_level = COALESCE($4, priority_level),
         resolved_at = CASE WHEN $2 = 'RESOLVED' THEN now() ELSE resolved_at END
       WHERE incident_id = $1 RETURNING *`,
      [req.params.id, status || null, priority_score ?? null, priority_level || null]
    );

    if (priority_level && priority_level !== existing.priority_level) {
      if (!reason) throw new ApiError(400, 'VALIDATION_ERROR', 'reason is required when overriding priority_level');
      await query(
        `INSERT INTO priority_overrides
           (incident_id, coordinator_id, previous_score, new_score, previous_level, new_level, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.params.id, req.actor.user_id, existing.priority_score, priority_score ?? existing.priority_score, existing.priority_level, priority_level, reason]
      );
    }

    res.json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.post('/incidents/:id/helpers', async (req, res, next) => {
  try {
    const { user_id } = req.body;
    if (!user_id) throw new ApiError(400, 'VALIDATION_ERROR', 'user_id is required');
    const { rows } = await query(
      `INSERT INTO incident_helpers (incident_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING *`,
      [req.params.id, user_id]
    );
    res.status(201).json(rows[0] || { incident_id: req.params.id, user_id, already_assigned: true });
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.post('/incidents/:id/resources', requireRole('coordinator'), async (req, res, next) => {
  try {
    const { resource_id } = req.body;
    if (!resource_id) throw new ApiError(400, 'VALIDATION_ERROR', 'resource_id is required');
    const { rows } = await query(
      `INSERT INTO incident_resources (incident_id, resource_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING *`,
      [req.params.id, resource_id]
    );
    res.status(201).json(rows[0] || { incident_id: req.params.id, resource_id, already_deployed: true });
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// --- Help requests ------------------------------------------------------

router.post('/help-requests', async (req, res, next) => {
  try {
    const { incident_id, need_type, urgency, location } = req.body;
    if (!incident_id || !need_type || !urgency || !location) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'incident_id, need_type, urgency, location are required');
    }
    const { rows } = await query(
      `INSERT INTO help_requests (incident_id, requested_by, need_type, urgency, location)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [incident_id, req.actor.user_id, need_type, urgency, location]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.post('/help-requests/:id/match', requireRole('coordinator'), async (req, res, next) => {
  try {
    const { matched_helper_id } = req.body;
    if (!matched_helper_id) throw new ApiError(400, 'VALIDATION_ERROR', 'matched_helper_id is required');
    const { rows } = await query(
      `UPDATE help_requests SET status = 'MATCHED', matched_helper_id = $2
       WHERE request_id = $1 RETURNING *`,
      [req.params.id, matched_helper_id]
    );
    if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'help request not found');
    res.json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.patch('/help-requests/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['REQUESTED', 'MATCHED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'];
    if (!allowed.includes(status)) throw new ApiError(400, 'VALIDATION_ERROR', `status must be one of ${allowed.join(', ')}`);
    const { rows } = await query(
      `UPDATE help_requests SET status = $2, resolved_at = CASE WHEN $2 = 'RESOLVED' THEN now() ELSE resolved_at END
       WHERE request_id = $1 RETURNING *`,
      [req.params.id, status]
    );
    if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'help request not found');
    res.json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// --- SOS ------------------------------------------------------------------

router.post('/sos-events', async (req, res, next) => {
  try {
    const { location, latitude, longitude, battery_level, accidental_protection_confirmed, offline_stored, incident_id } = req.body;
    if (!location) throw new ApiError(400, 'VALIDATION_ERROR', 'location is required');
    const { rows } = await query(
      `INSERT INTO sos_events
         (triggered_by, incident_id, location, latitude, longitude, battery_level, accidental_protection_confirmed, offline_stored)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, FALSE), COALESCE($8, FALSE))
       RETURNING *`,
      [req.actor.user_id, incident_id || null, location, latitude ?? null, longitude ?? null, battery_level ?? null, accidental_protection_confirmed ?? null, offline_stored ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// --- Emergency alerts -------------------------------------------------

router.post('/emergency-alerts', requireRole('coordinator'), async (req, res, next) => {
  try {
    const { level, source, affected_area } = req.body;
    if (!level || !source || !affected_area) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'level, source, affected_area are required');
    }
    const { rows } = await query(
      `INSERT INTO emergency_alerts (level, source, affected_area) VALUES ($1, $2, $3) RETURNING *`,
      [level, source, affected_area]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// --- Notifications (read-only from the API's perspective; dispatch is external) ---

router.get('/notifications', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM notifications WHERE recipient_id = $1 ORDER BY sent_at DESC NULLS FIRST',
      [req.actor.user_id]
    );
    res.json(rows);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

module.exports = router;
