const express = require('express');
const { requireRole, dbErrorToApiError } = require('../middleware/context');
const emergencyService = require('../services/emergency');

const router = express.Router();

/**
 * NOTE ON SCOPE: the frozen schema says "Emergency functionality is
 * represented in the schema for later phases but is not exposed by the
 * Phase 1 API." These routes are implemented per Phase 2H specification
 * and delegate to the approved emergencyService layer. They remain mounted
 * behind the ENABLE_EMERGENCY_ROUTES feature flag in app.js.
 */

// --- Incidents --------------------------------------------------------

router.post('/incidents', async (req, res, next) => {
  try {
    const incident = await emergencyService.createIncident(req.actor, req.body);
    res.status(201).json(incident);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.get('/incidents/:id', async (req, res, next) => {
  try {
    const incident = await emergencyService.getIncident(req.actor, req.params.id);
    res.json(incident);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.get('/incidents', async (req, res, next) => {
  try {
    const incidents = await emergencyService.listIncidents(req.actor, req.query);
    res.json(incidents);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// PATCH /incidents/:id — coordinator status/priority updates, logged via priority_overrides
router.patch('/incidents/:id', requireRole('coordinator'), async (req, res, next) => {
  try {
    const incident = await emergencyService.updateIncident(req.actor, req.params.id, req.body);
    res.json(incident);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.post('/incidents/:id/helpers', async (req, res, next) => {
  try {
    const assignment = await emergencyService.addIncidentHelper(req.actor, req.params.id, req.body);
    res.status(201).json(assignment);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.post('/incidents/:id/resources', requireRole('coordinator'), async (req, res, next) => {
  try {
    const deployment = await emergencyService.addIncidentResource(req.actor, req.params.id, req.body);
    res.status(201).json(deployment);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// --- Help requests ------------------------------------------------------

router.post('/help-requests', async (req, res, next) => {
  try {
    const helpRequest = await emergencyService.createHelpRequest(req.actor, req.body);
    res.status(201).json(helpRequest);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.post('/help-requests/:id/match', requireRole('coordinator'), async (req, res, next) => {
  try {
    const matched = await emergencyService.matchHelpRequest(req.actor, req.params.id, req.body);
    res.json(matched);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.patch('/help-requests/:id', async (req, res, next) => {
  try {
    const updated = await emergencyService.updateHelpRequestStatus(req.actor, req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// --- SOS ------------------------------------------------------------------

router.post('/sos-events', async (req, res, next) => {
  try {
    const event = await emergencyService.createSosEvent(req.actor, req.body);
    res.status(201).json(event);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// --- Emergency alerts -------------------------------------------------

router.post('/emergency-alerts', requireRole('coordinator'), async (req, res, next) => {
  try {
    const alert = await emergencyService.createEmergencyAlert(req.actor, req.body);
    res.status(201).json(alert);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// --- Notifications (read-only from the API's perspective; dispatch is external) ---

router.get('/notifications', async (req, res, next) => {
  try {
    const notifications = await emergencyService.listNotifications(req.actor);
    res.json(notifications);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

module.exports = router;

