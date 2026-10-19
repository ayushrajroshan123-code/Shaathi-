/**
 * SAATHI Resources & Resource Requests Router
 * Canonical Phase 2D implementation.
 */

const express = require('express');
const { dbErrorToApiError, ApiError } = require('../middleware/context');
const {
  listPublicResources,
  getPublicResourceDetail,
  createResource,
} = require('../services/resources');
const {
  createResourceRequest,
  getInboundRequests,
  getOutboundRequests,
  getRequestDetail,
  approveRequest,
  declineRequest,
  cancelRequest,
} = require('../services/requests');

const router = express.Router();

// ===========================================================================
// 1. PUBLIC RESOURCE DISCOVERY & LISTING
// ===========================================================================

// GET /resources — Public discovery of community tools in the hub
router.get('/', async (req, res, next) => {
  try {
    const { type } = req.query;
    const resources = await listPublicResources({
      hubId: req.actor.hub_id,
      actorUserId: req.actor.user_id,
      type: type || null,
    });
    res.json(resources);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /resources — A resident lists a shared tool
router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      type,
      condition,
      general_area,
      handoff_policy,
      requires_approval,
      location,
      availability_window_start,
      availability_window_end,
      emergency_opt_in,
    } = req.body;

    const resource = await createResource({
      hubId: req.actor.hub_id,
      ownerId: req.actor.user_id,
      name,
      type,
      condition,
      general_area,
      handoff_policy,
      requires_approval,
      location,
      availability_window_start,
      availability_window_end,
      emergency_opt_in,
    });
    res.status(201).json(resource);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// ===========================================================================
// 2. RESOURCE REQUESTS (Specific paths mounted before :id)
// ===========================================================================

// POST /resources/requests — Borrower submits borrow request
router.post('/requests', async (req, res, next) => {
  try {
    const {
      resource_id,
      purpose,
      duration,
      time_window_start,
      time_window_end,
      handoff_preference,
      message,
    } = req.body;

    const request = await createResourceRequest({
      resourceId: resource_id,
      actorUserId: req.actor.user_id,
      hubId: req.actor.hub_id,
      purpose,
      duration,
      timeWindowStart: time_window_start,
      timeWindowEnd: time_window_end,
      handoffPreference: handoff_preference,
      message,
    });
    res.status(201).json(request);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// GET /resources/requests/inbound — Owner views incoming borrow requests (with factual trust signals)
router.get('/requests/inbound', async (req, res, next) => {
  try {
    const requests = await getInboundRequests({
      ownerId: req.actor.user_id,
      hubId: req.actor.hub_id,
    });
    res.json(requests);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// GET /resources/requests/outbound — Borrower tracks outgoing borrow requests
router.get('/requests/outbound', async (req, res, next) => {
  try {
    const requests = await getOutboundRequests({
      requesterId: req.actor.user_id,
      hubId: req.actor.hub_id,
    });
    res.json(requests);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// GET /resources/requests/:id — Specific request detail with participant access control
router.get('/requests/:id', async (req, res, next) => {
  try {
    const request = await getRequestDetail({
      requestId: req.params.id,
      actorUserId: req.actor.user_id,
      hubId: req.actor.hub_id,
      role: req.actor.role,
    });
    res.json(request);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /resources/requests/:id/approve — Owner approves request, spawns Coordination
router.post('/requests/:id/approve', async (req, res, next) => {
  try {
    const result = await approveRequest({
      requestId: req.params.id,
      actorUserId: req.actor.user_id,
      hubId: req.actor.hub_id,
    });
    res.json(result);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// Legacy backward compatibility alias for accept
router.post('/requests/:id/accept', async (req, res, next) => {
  try {
    const result = await approveRequest({
      requestId: req.params.id,
      actorUserId: req.actor.user_id,
      hubId: req.actor.hub_id,
    });
    res.json(result);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /resources/requests/:id/decline — Owner declines request
router.post('/requests/:id/decline', async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await declineRequest({
      requestId: req.params.id,
      actorUserId: req.actor.user_id,
      hubId: req.actor.hub_id,
      declineReason: reason || null,
    });
    res.json(result);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /resources/requests/:id/cancel — Borrower cancels pending request
router.post('/requests/:id/cancel', async (req, res, next) => {
  try {
    const result = await cancelRequest({
      requestId: req.params.id,
      actorUserId: req.actor.user_id,
      hubId: req.actor.hub_id,
    });
    res.json(result);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// ===========================================================================
// 3. RESOURCE DETAIL (Mounted after /requests routes)
// ===========================================================================

// GET /resources/:id — Public detail of a shared resource
router.get('/:id', async (req, res, next) => {
  try {
    const resource = await getPublicResourceDetail({
      resourceId: req.params.id,
      hubId: req.actor.hub_id,
      actorUserId: req.actor.user_id,
    });
    res.json(resource);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

module.exports = router;
