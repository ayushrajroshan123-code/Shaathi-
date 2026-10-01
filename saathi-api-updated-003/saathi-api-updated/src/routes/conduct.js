const express = require('express');
const { query } = require('../db');
const { requireRole, ApiError, dbErrorToApiError } = require('../middleware/context');
const { assertUnderSubmissionCap } = require('../services/conduct');

const router = express.Router();

// POST /conduct-reports — any user reports another; repeat_pattern_flag is
// computed by the DB trigger on insert, not by this code.
router.post('/', async (req, res, next) => {
  try {
    const { reported_against, context_type, context_id, category, description, evidence } = req.body;
    if (!reported_against || !context_type || !category) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'reported_against, context_type, and category are required');
    }
    if (reported_against === req.actor.user_id) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'cannot report yourself');
    }
    if (context_type !== 'general' && !context_id) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'context_id is required unless context_type is general');
    }

    await assertUnderSubmissionCap(req.actor.user_id);

    const { rows } = await query(
      `INSERT INTO conduct_reports (reported_by, reported_against, context_type, context_id, category, description, evidence)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, '[]'::jsonb))
       RETURNING *`,
      [req.actor.user_id, reported_against, context_type, context_id || null, category, description || null, evidence || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// GET /conduct-reports/:id — coordinator only (contains sensitive detail)
router.get('/:id', requireRole('coordinator'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM conduct_reports WHERE report_id = $1', [req.params.id]);
    if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'conduct report not found');
    res.json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// GET /conduct-reports?status=reported — coordinator queue, optionally filtered
router.get('/', requireRole('coordinator'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const { rows } = await query(
      `SELECT * FROM conduct_reports WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC`,
      [status || null]
    );
    res.json(rows);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// PATCH /conduct-reports/:id — coordinator resolves/actions a report
router.patch('/:id', requireRole('coordinator'), async (req, res, next) => {
  try {
    const { status, action_taken } = req.body;
    const allowedStatus = ['reported', 'under_review', 'resolved'];
    if (status && !allowedStatus.includes(status)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `status must be one of ${allowedStatus.join(', ')}`);
    }
    const { rows } = await query(
      `UPDATE conduct_reports
       SET status = COALESCE($2, status),
           action_taken = COALESCE($3, action_taken),
           coordinator_id = $4,
           resolved_at = CASE WHEN $2 = 'resolved' THEN now() ELSE resolved_at END
       WHERE report_id = $1
       RETURNING *`,
      [req.params.id, status || null, action_taken || null, req.actor.user_id]
    );
    if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'conduct report not found');
    res.json(rows[0]);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

module.exports = router;
