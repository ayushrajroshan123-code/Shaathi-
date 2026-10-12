/**
 * SAATHI Neighborhood Issues Router
 * Routes for public infrastructure & neighborhood condition reporting.
 */

const express = require('express');
const { dbErrorToApiError } = require('../middleware/context');
const {
  listIssues,
  createIssue,
  getIssueDetail,
  editIssue,
  updateIssueStatus,
} = require('../services/issues');

const router = express.Router();

// GET /issues — List public infrastructure issues in the authenticated actor's hub
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const issues = await listIssues({
      hubId: req.actor.hub_id,
      statusFilter: status || null,
    });
    res.json(issues);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// POST /issues — Report a new neighborhood infrastructure issue
router.post('/', async (req, res, next) => {
  try {
    const { title, category, severity, general_location, detail } = req.body || {};
    const issue = await createIssue({
      actor: req.actor,
      title,
      category,
      severity,
      general_location,
      detail,
    });
    res.status(201).json(issue);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// GET /issues/:id — Retrieve issue detail
router.get('/:id', async (req, res, next) => {
  try {
    const issue = await getIssueDetail({
      actor: req.actor,
      issueId: req.params.id,
    });
    res.json(issue);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// PATCH /issues/:id — Edit issue details (original reporter only while reported)
router.patch('/:id', async (req, res, next) => {
  try {
    const issue = await editIssue({
      actor: req.actor,
      issueId: req.params.id,
      body: req.body,
    });
    res.json(issue);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// PATCH /issues/:id/status — Transition issue status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const requestedStatus = req.body ? (req.body.status || req.body.requested_status) : null;
    const reason = req.body ? req.body.reason : null;
    const issue = await updateIssueStatus({
      actor: req.actor,
      issueId: req.params.id,
      requestedStatus,
      reason,
    });
    res.json(issue);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

module.exports = router;
