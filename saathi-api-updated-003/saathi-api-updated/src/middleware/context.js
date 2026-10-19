const { ApiError } = require('../lib/errors');
const { loadActorFromToken } = require('../services/auth');

/**
 * Real session auth, replacing the earlier x-user-id pilot stub. The client
 * sends `Authorization: Bearer <token>` from a token issued by
 * POST /auth/login. See routes/auth.js and services/auth.js.
 *
 * Every handler downstream still reads `req.actor = { user_id, role }`
 * rather than trusting a body field, so authorization checks can't be
 * spoofed by the client claiming a different actor than the one making the
 * request. req.session_id is also set, for /auth/logout to revoke.
 */
async function loadActor(req, res, next) {
  const authHeader = req.header('authorization') || '';
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Authorization: Bearer <token> header required', status: 401 });
  }
  try {
    const actor = await loadActorFromToken(token);
    if (!actor) {
      return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'invalid, expired, or revoked session', status: 401 });
    }
    req.actor = { user_id: actor.user_id, role: actor.role, hub_id: actor.hub_id };
    req.session_id = actor.session_id;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.actor || !roles.includes(req.actor.role)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: `requires role: ${roles.join(' or ')}`, status: 403 });
    }
    next();
  };
}

/** Central error handler: known errors carry .status; everything else is 500. */
function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status === 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).json({
    error: err.code || 'INTERNAL_ERROR',
    message: status === 500 ? 'internal error' : err.message,
    status,
  });
}

/**
 * Map known Postgres constraint/trigger errors to clean API errors.
 * Used by every route that inserts/updates against a table with CHECK
 * constraints or triggers that RAISE EXCEPTION (e.g. TASK_NOT_AVAILABLE,
 * ACCESS_HANDOFF_NOT_CONFIRMED, the Asia/Kolkata date CHECK). Centralized
 * here so behavior doesn't drift between routers.
 */
function dbErrorToApiError(err) {
  if (err instanceof ApiError) return err;
  if (err.code === '23514' || err.code === '23505' || err.code === '23503') {
    // check_violation / unique_violation / foreign_key_violation
    return new ApiError(422, 'CONSTRAINT_VIOLATION', err.message);
  }
  if (err.code === '22P02' || err.code === '22007' || err.code === '22008') {
    // invalid input syntax (e.g. invalid UUID syntax or malformed timestamp)
    return new ApiError(400, 'VALIDATION_ERROR', 'invalid identifier or data format');
  }
  if (err.code === 'P0001') {
    if (err.message && err.message.includes('EMERGENCY_MODE_ACTIVE')) {
      return new ApiError(409, 'EMERGENCY_MODE_ACTIVE', 'action blocked during emergency mode');
    }
    if (err.message && err.message.includes('QUERY_LOCKED')) {
      return new ApiError(409, 'QUERY_LOCKED', 'cannot edit query after an answer has been submitted');
    }
  }
  return err;
}

module.exports = { loadActor, requireRole, errorHandler, ApiError, dbErrorToApiError };
