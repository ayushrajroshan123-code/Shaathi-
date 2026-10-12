const express = require('express');
const { requireRole, dbErrorToApiError, ApiError } = require('../middleware/context');
const queriesService = require('../services/queries');

const router = express.Router();

// Only hub members can access queries
router.use(requireRole('resident', 'coordinator', 'dispatch'));

router.post('/', async (req, res, next) => {
  try {
    const { title, body } = req.body;
    const query = await queriesService.createQuery(req.actor.hub_id, req.actor.user_id, { title, body });
    res.status(201).json(query);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const items = await queriesService.listQueries(req.actor.hub_id, { status });
    res.json(items);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const query = await queriesService.getQueryDetails(req.params.id, req.actor.hub_id);
    res.json(query);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { title, body } = req.body;
    const query = await queriesService.updateQuery(req.params.id, req.actor.hub_id, req.actor.user_id, { title, body });
    res.json(query);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.post('/:id/resolve', async (req, res, next) => {
  try {
    const query = await queriesService.resolveQuery(req.params.id, req.actor.hub_id, req.actor.user_id);
    res.json(query);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await queriesService.deleteQuery(req.params.id, req.actor.hub_id, req.actor.user_id);
    res.status(204).send();
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.post('/:id/report', async (req, res, next) => {
  try {
    const { category, description } = req.body;
    if (!category) throw new ApiError(400, 'VALIDATION_ERROR', 'category is required');
    const report = await queriesService.reportQuery(req.params.id, req.actor.hub_id, req.actor.user_id, category, description);
    res.status(201).json(report);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

// Answers
router.post('/:id/answers', async (req, res, next) => {
  try {
    const { body } = req.body;
    const answer = await queriesService.addAnswer(req.params.id, req.actor.hub_id, req.actor.user_id, body);
    res.status(201).json(answer);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.get('/:id/answers', async (req, res, next) => {
  try {
    const answers = await queriesService.listAnswers(req.params.id, req.actor.hub_id);
    res.json(answers);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.post('/:id/answers/:answer_id/helpful', async (req, res, next) => {
  try {
    const answer = await queriesService.markAnswerHelpful(req.params.id, req.params.answer_id, req.actor.hub_id, req.actor.user_id);
    res.json(answer);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.delete('/:id/answers/:answer_id/helpful', async (req, res, next) => {
  try {
    await queriesService.clearHelpfulAnswer(req.params.id, req.params.answer_id, req.actor.hub_id, req.actor.user_id);
    res.status(204).send();
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.delete('/:id/answers/:answer_id', async (req, res, next) => {
  try {
    await queriesService.deleteAnswer(req.params.id, req.params.answer_id, req.actor.hub_id, req.actor.user_id);
    res.status(204).send();
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

router.post('/:id/answers/:answer_id/report', async (req, res, next) => {
  try {
    const { category, description } = req.body;
    if (!category) throw new ApiError(400, 'VALIDATION_ERROR', 'category is required');
    const report = await queriesService.reportAnswer(req.params.id, req.params.answer_id, req.actor.hub_id, req.actor.user_id, category, description);
    res.status(201).json(report);
  } catch (err) {
    next(dbErrorToApiError(err));
  }
});

module.exports = router;
