const { query } = require('../db');
const { ApiError } = require('../middleware/context');

/**
 * GET /users/{user_id}/eligibility?task_type=... contract:
 *  - self: allowed
 *  - coordinator: allowed
 *  - ordinary resident querying another user: denied (404, not 403 —
 *    the endpoint must not reveal that the target user exists/has a
 *    verification posture at all)
 *
 * Response is intentionally minimal: { task_type, eligible }.
 */
function assertCanViewEligibility(actor, targetUserId) {
  if (actor.user_id === targetUserId) return;
  if (actor.role === 'coordinator') return;
  throw new ApiError(404, 'NOT_FOUND', 'user not found');
}

/**
 * Decision #2 (Frozen): Eligibility requires an EXACT tier match between
 * an active verification_record and the task's required_verification_tier.
 * No tier hierarchy is assumed.
 */
async function isEligible(userId, taskType) {
  const taskRes = await query(
    'SELECT required_verification_tier, launch_allowed FROM task_taxonomy WHERE task_type = $1',
    [taskType]
  );
  if (taskRes.rows.length === 0) {
    throw new ApiError(400, 'UNKNOWN_TASK_TYPE', `no such task_type: ${taskType}`);
  }
  const { required_verification_tier: requiredTier, launch_allowed: launchAllowed } = taskRes.rows[0];

  if (!launchAllowed) {
    return { task_type: taskType, eligible: false };
  }

  const verRes = await query(
    `SELECT 1 FROM verification_records
     WHERE user_id = $1
       AND tier = $2
       AND (expires_at IS NULL OR expires_at > now())
     LIMIT 1`,
    [userId, requiredTier]
  );

  return { task_type: taskType, eligible: verRes.rows.length > 0 };
}

module.exports = { assertCanViewEligibility, isEligible };
