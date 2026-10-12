/**
 * SAATHI Coordinations Router
 * Canonical Phase 2D implementation.
 */

const express = require('express');
const { dbErrorToApiError, ApiError } = require('../middleware/context');
const {
  listCoordinations,
  getCoordinationDetail,
  transitionCoordination,
  initiateReturn,
  confirmReturn,
  postCoordinationMessage,
  getCoordinationMessages,
} = require('../services/coordination');

const router = express.Router();

// GET /coordinations — List coordinations across personal roles
router.get('/', async (req, res, next) => {
  try {
    const allowedTabs = ['ACTIVE', 'UPCOMING', 'RETURNS', 'COMPLETED', 'SAFETY'];
    const tab = req.query.tab ? req.query.tab.toUpperCase() : 'ACTIVE';
    if (!allowedTabs.includes(tab)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `tab must be one of: ${allowedTabs.join(', ')}`);
    }
    const coordinations = await listCoordinations({
      actorUserId: req.actor.user_id,
      hubId: req.actor.hub_id,
      tab,
    });
    res.json(coordinations);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// GET /coordinations/:id — Detailed management view of a coordination
router.get('/:id', async (req, res, next) => {
  try {
    const detail = await getCoordinationDetail({
      coordinationId: req.params.id,
      actorUserId: req.actor.user_id,
      hubId: req.actor.hub_id,
      role: req.actor.role,
    });
    res.json(detail);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /coordinations/:id/transition — Transition state along canonical state machine
router.post('/:id/transition', async (req, res, next) => {
  try {
    const { to_state, note } = req.body;
    if (!to_state) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'to_state is required');
    }
    const result = await transitionCoordination({
      coordinationId: req.params.id,
      actorUserId: req.actor.user_id,
      hubId: req.actor.hub_id,
      toState: to_state,
      note: note || null,
    });
    res.json(result);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /coordinations/:id/return/initiate — Borrower initiates return
router.post('/:id/return/initiate', async (req, res, next) => {
  try {
    const result = await initiateReturn({
      coordinationId: req.params.id,
      actorUserId: req.actor.user_id,
      hubId: req.actor.hub_id,
    });
    res.json(result);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /coordinations/:id/return/confirm — Owner confirms return receipt
router.post('/:id/return/confirm', async (req, res, next) => {
  try {
    const result = await confirmReturn({
      coordinationId: req.params.id,
      actorUserId: req.actor.user_id,
      hubId: req.actor.hub_id,
    });
    res.json(result);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /coordinations/:id/messages — Post an operational coordination note
router.post('/:id/messages', async (req, res, next) => {
  try {
    const { text, message_type } = req.body;
    const msg = await postCoordinationMessage({
      coordinationId: req.params.id,
      actorUserId: req.actor.user_id,
      hubId: req.actor.hub_id,
      body: text,
      messageType: message_type || 'coordination_note',
    });
    res.status(201).json(msg);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// GET /coordinations/:id/messages — Retrieve message thread for a coordination
router.get('/:id/messages', async (req, res, next) => {
  try {
    const messages = await getCoordinationMessages({
      coordinationId: req.params.id,
      actorUserId: req.actor.user_id,
      hubId: req.actor.hub_id,
      role: req.actor.role,
    });
    res.json(messages);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

module.exports = router;
