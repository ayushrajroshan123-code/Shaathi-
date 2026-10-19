/**
 * SAATHI Authorization, Hub Isolation & Blocking Rules
 * Canonical Phase 2D enforcement layer.
 */

const { query } = require('../db');
const { ApiError } = require('../lib/errors');
const { formatMembershipAge } = require('./serializers');

/**
 * Enforces hub isolation.
 * Unrelated or cross-hub operations return 404 NOT_FOUND so cross-hub existence is never confirmed.
 */
function assertSameHub(actorHubId, targetHubId, entityName = 'resource') {
  if (!actorHubId || !targetHubId || actorHubId !== targetHubId) {
    throw new ApiError(404, 'NOT_FOUND', `${entityName} not found`);
  }
}

/**
 * Checks if a bidirectional blocking relationship exists between two users.
 * If userA blocked userB OR userB blocked userA, returns true.
 */
async function isBlocked(userA, userB, client = null) {
  if (!userA || !userB || userA === userB) return false;
  const db = client || { query };
  const { rows } = await db.query(
    `SELECT 1 FROM blocked_users
     WHERE (blocker_id = $1 AND blocked_user_id = $2)
        OR (blocker_id = $2 AND blocked_user_id = $1)
     LIMIT 1`,
    [userA, userB]
  );
  return rows.length > 0;
}

/**
 * Returns an array of user IDs blocked by actor, or who have blocked actor.
 */
async function getBlockedUserIds(actorUserId, client = null) {
  if (!actorUserId) return [];
  const db = client || { query };
  const { rows } = await db.query(
    `SELECT blocked_user_id AS id FROM blocked_users WHERE blocker_id = $1
     UNION
     SELECT blocker_id AS id FROM blocked_users WHERE blocked_user_id = $1`,
    [actorUserId]
  );
  return rows.map((r) => r.id);
}

/**
 * Generates factual trust and eligibility signals for a resident.
 * Strictly factual records only: no scores, stars, ratings, or gamification indexes.
 */
async function computeTrustSignals(userId, hubId, client = null) {
  const db = client || { query };

  const [userRes, verifRes, completedRes, overdueRes] = await Promise.all([
    db.query('SELECT created_at, account_status, hub_id FROM users WHERE user_id = $1', [userId]),
    db.query('SELECT record_id FROM verification_records WHERE user_id = $1 LIMIT 1', [userId]),
    db.query(
      `SELECT COUNT(*)::int AS count
       FROM coordinations
       WHERE requester_id = $1 AND state = 'COMPLETED'`,
      [userId]
    ),
    db.query(
      `SELECT COUNT(*)::int AS count
       FROM coordinations
       WHERE requester_id = $1
         AND state IN ('IN_USE', 'RETURN_DUE')
         AND due_time IS NOT NULL
         AND due_time < now()`,
      [userId]
    ),
  ]);

  const user = userRes.rows[0];
  if (!user) {
    return {
      identity_verified: false,
      neighborhood_verified: false,
      membership_age: 'Unknown',
      completed_coordinations: 0,
      no_outstanding_returns: true,
      eligible: false,
    };
  }

  const identityVerified = verifRes.rows.length > 0;
  const neighborhoodVerified = user.hub_id === hubId && user.account_status === 'active';
  const completedCount = completedRes.rows[0]?.count || 0;
  const overdueCount = overdueRes.rows[0]?.count || 0;

  return {
    identity_verified: identityVerified,
    neighborhood_verified: neighborhoodVerified,
    membership_age: formatMembershipAge(user.created_at),
    completed_coordinations: completedCount,
    no_outstanding_returns: overdueCount === 0,
    eligible: user.account_status === 'active',
  };
}

/**
 * Determines whether the actor is authorized to look up another user's basic profile.
 * Prevents arbitrary resident enumeration / directory probing.
 */
async function canViewUser(actor, targetUserId, client = null) {
  if (!actor || !targetUserId) return false;
  if (actor.user_id === targetUserId) return true;
  if (actor.role === 'coordinator') return true;

  const db = client || { query };
  // Check if they are counterparts in an active coordination or open request in the same hub
  const { rows } = await db.query(
    `SELECT 1 FROM coordinations
     WHERE hub_id = $1
       AND ((requester_id = $2 AND counterpart_id = $3) OR (requester_id = $3 AND counterpart_id = $2))
     UNION
     SELECT 1 FROM resource_requests rr
     JOIN resource_inventory ri ON ri.resource_id = rr.resource_id
     WHERE ri.hub_id = $1
       AND ((rr.requester_id = $2 AND ri.owner_id = $3) OR (rr.requester_id = $3 AND ri.owner_id = $2))
     LIMIT 1`,
    [actor.hub_id, actor.user_id, targetUserId]
  );

  return rows.length > 0;
}

module.exports = {
  assertSameHub,
  isBlocked,
  getBlockedUserIds,
  computeTrustSignals,
  canViewUser,
};
