/**
 * SAATHI Blocking Service
 * Canonical Phase 2D enforcement layer.
 *
 * Enforces:
 *  - Directional and reciprocal future interaction blocking
 *  - Self-block prohibition
 *  - Unapproved requests transition to BLOCKED
 *  - CRITICAL: Active physical possession / coordinations are NEVER destroyed.
 *    They remain recoverable and completeable via the two-party return flow.
 */

const { query, withTransaction } = require('../db');
const { ApiError } = require('../lib/errors');

/**
 * Member blocks another user.
 */
async function blockUser({ blockerId, blockedUserId, hubId }) {
  if (!blockerId || !blockedUserId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'blocker_id and target_user_id are required');
  }

  if (blockerId === blockedUserId) {
    throw new ApiError(422, 'CONSTRAINT_VIOLATION', 'cannot block yourself');
  }

  // Verify target user exists
  const { rows: targetRows } = await query(
    'SELECT user_id, hub_id FROM users WHERE user_id = $1',
    [blockedUserId]
  );
  if (targetRows.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'user not found');
  }

  return withTransaction(async (client) => {
    // 1. Insert into blocked_users
    await client.query(
      `INSERT INTO blocked_users (blocker_id, blocked_user_id)
       VALUES ($1, $2)
       ON CONFLICT (blocker_id, blocked_user_id) DO NOTHING`,
      [blockerId, blockedUserId]
    );

    // 2. Transition any pending unapproved requests between the two users to BLOCKED
    await client.query(
      `UPDATE resource_requests rr
       SET status = 'BLOCKED'
       FROM resource_inventory ri
       WHERE rr.resource_id = ri.resource_id
         AND rr.status = 'REQUESTED'
         AND (
           (rr.requester_id = $1 AND ri.owner_id = $2)
           OR (rr.requester_id = $2 AND ri.owner_id = $1)
         )`,
      [blockerId, blockedUserId]
    );

    // 3. Active physical coordinations (IN_USE, RETURN_DUE, RETURN_PENDING, HANDED_OVER, etc.)
    // are PRESERVED! They remain intact and visible under the SAFETY tab so the physical
    // return workflow can complete safely.

    return { status: 'BLOCKED', target_user_id: blockedUserId };
  });
}

/**
 * Retrieves list of users blocked by caller.
 */
async function listBlockedUsers({ blockerId }) {
  const { rows } = await query(
    `SELECT blocked_user_id, created_at
     FROM blocked_users
     WHERE blocker_id = $1
     ORDER BY created_at DESC`,
    [blockerId]
  );

  return rows;
}

module.exports = {
  blockUser,
  listBlockedUsers,
};
