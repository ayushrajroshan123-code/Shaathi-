/**
 * SAATHI Coordination Service
 * Canonical Phase 2D enforcement layer.
 *
 * Enforces:
 *  - Hub isolation
 *  - Participant authorization (requester or counterpart only; coordinators for audit)
 *  - Canonical state machine transitions with immutable events
 *  - Borrower-initiated return (requester_id only -> RETURN_PENDING)
 *  - Owner-confirmed return (counterpart_id only -> COMPLETED)
 *  - Resource counterpart ownership invariant: counterpart_id = resource_inventory.owner_id
 *  - Safe messaging on active coordinations (prohibited post-completion and post-block)
 *  - Preservation of active coordinations under SAFETY tab even if blocked
 */

const { query, withTransaction } = require('../db');
const { ApiError } = require('../lib/errors');
const { serializeCoordinationDetail } = require('./serializers');
const { assertSameHub, isBlocked } = require('./authorization');

/**
 * Valid coordination state transitions.
 */
const ALLOWED_TRANSITIONS = {
  APPROVED: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['HANDOFF_READY', 'CANCELLED'],
  HANDOFF_READY: ['HANDED_OVER', 'CANCELLED'],
  HANDED_OVER: ['IN_USE'],
  IN_USE: ['RETURN_DUE', 'RETURN_PENDING'],
  RETURN_DUE: ['RETURN_PENDING'],
  RETURN_PENDING: ['COMPLETED'],
};

/**
 * Retrieves user's coordinations filtered by tab.
 */
async function listCoordinations({ actorUserId, hubId, tab = 'ACTIVE' }) {
  if (!actorUserId || !hubId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'actor and hub_id are required');
  }

  let stateClause = '';
  const params = [actorUserId, hubId];

  switch (tab.toUpperCase()) {
    case 'ACTIVE':
      stateClause = `AND c.state IN ('APPROVED', 'SCHEDULED', 'HANDOFF_READY', 'HANDED_OVER', 'IN_USE')`;
      break;
    case 'UPCOMING':
      stateClause = `AND c.state IN ('APPROVED', 'SCHEDULED')`;
      break;
    case 'RETURNS':
      stateClause = `AND c.state IN ('RETURN_DUE', 'RETURN_PENDING')`;
      break;
    case 'COMPLETED':
      stateClause = `AND c.state = 'COMPLETED'`;
      break;
    case 'SAFETY':
      // Safety tab shows coordinations where parties are blocked, or state is BLOCKED
      stateClause = `AND (c.state = 'BLOCKED' OR EXISTS (
        SELECT 1 FROM blocked_users bu
        WHERE (bu.blocker_id = c.requester_id AND bu.blocked_user_id = c.counterpart_id)
           OR (bu.blocker_id = c.counterpart_id AND bu.blocked_user_id = c.requester_id)
      ))`;
      break;
    default:
      stateClause = `AND c.state IN ('APPROVED', 'SCHEDULED', 'HANDOFF_READY', 'HANDED_OVER', 'IN_USE')`;
  }

  const { rows } = await query(
    `SELECT
       c.*,
       ri.name AS resource_name,
       u_req.name AS requester_name,
       u_count.name AS counterpart_name
     FROM coordinations c
     LEFT JOIN resource_inventory ri ON ri.resource_id = c.resource_id
     JOIN users u_req ON u_req.user_id = c.requester_id
     JOIN users u_count ON u_count.user_id = c.counterpart_id
     WHERE (c.requester_id = $1 OR c.counterpart_id = $1)
       AND c.hub_id = $2
       ${stateClause}
     ORDER BY c.created_at DESC`,
    params
  );

  return rows.map((r) => serializeCoordinationDetail(r, actorUserId));
}

/**
 * Detailed coordination view including events and messages.
 */
async function getCoordinationDetail({ coordinationId, actorUserId, hubId, role }) {
  const { rows } = await query(
    `SELECT
       c.*,
       ri.name AS resource_name,
       u_req.name AS requester_name,
       u_count.name AS counterpart_name
     FROM coordinations c
     LEFT JOIN resource_inventory ri ON ri.resource_id = c.resource_id
     JOIN users u_req ON u_req.user_id = c.requester_id
     JOIN users u_count ON u_count.user_id = c.counterpart_id
     WHERE c.coordination_id = $1`,
    [coordinationId]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'coordination not found');
  }

  const coord = rows[0];
  assertSameHub(hubId, coord.hub_id, 'coordination');

  const isParticipant = coord.requester_id === actorUserId || coord.counterpart_id === actorUserId;
  if (!isParticipant && role !== 'coordinator') {
    throw new ApiError(404, 'NOT_FOUND', 'coordination not found');
  }

  // Load events and messages
  const [eventsRes, messagesRes] = await Promise.all([
    query(
      `SELECT event_id, event_type, actor_id, summary, created_at
       FROM coordination_events
       WHERE coordination_id = $1
       ORDER BY created_at ASC`,
      [coordinationId]
    ),
    query(
      `SELECT message_id, sender_id, message_type, text, created_at
       FROM coordination_messages
       WHERE coordination_id = $1
       ORDER BY created_at ASC`,
      [coordinationId]
    ),
  ]);

  return serializeCoordinationDetail(coord, actorUserId, eventsRes.rows, messagesRes.rows);
}

/**
 * Transitions a coordination through canonical lifecycle states.
 */
async function transitionCoordination({ coordinationId, actorUserId, hubId, toState, note = null }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT c.*, ri.name AS resource_name, u_req.name AS requester_name, u_count.name AS counterpart_name
       FROM coordinations c
       LEFT JOIN resource_inventory ri ON ri.resource_id = c.resource_id
       JOIN users u_req ON u_req.user_id = c.requester_id
       JOIN users u_count ON u_count.user_id = c.counterpart_id
       WHERE c.coordination_id = $1
       FOR UPDATE OF c`,
      [coordinationId]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'coordination not found');
    }
    const coord = rows[0];
    assertSameHub(hubId, coord.hub_id, 'coordination');

    const isBorrower = coord.requester_id === actorUserId;
    const isOwner = coord.counterpart_id === actorUserId;
    if (!isBorrower && !isOwner) {
      throw new ApiError(404, 'NOT_FOUND', 'coordination not found');
    }

    const validNextStates = ALLOWED_TRANSITIONS[coord.state] || [];
    if (!validNextStates.includes(toState)) {
      throw new ApiError(409, 'INVALID_STATE', `cannot transition from ${coord.state} to ${toState}`);
    }

    // Role-specific transition rules
    if (toState === 'HANDOFF_READY' && !isOwner) {
      throw new ApiError(403, 'FORBIDDEN', 'only the owner can declare handoff ready');
    }
    if (toState === 'IN_USE' && !isBorrower) {
      throw new ApiError(403, 'FORBIDDEN', 'only the borrower can confirm item in use');
    }
    if (toState === 'RETURN_PENDING') {
      throw new ApiError(400, 'INVALID_OPERATION', 'use the dedicated return initiation endpoint');
    }
    if (toState === 'COMPLETED') {
      throw new ApiError(400, 'INVALID_OPERATION', 'use the dedicated return confirmation endpoint');
    }

    // Update coordination
    const { rows: updatedRows } = await client.query(
      `UPDATE coordinations
       SET state = $2
       WHERE coordination_id = $1
       RETURNING *`,
      [coordinationId, toState]
    );

    // Record immutable event
    await client.query(
      `INSERT INTO coordination_events (coordination_id, actor_id, event_type, summary)
       VALUES ($1, $2, $3, $4)`,
      [coordinationId, actorUserId, toState, note || `Transition to ${toState}`]
    );

    return serializeCoordinationDetail({ ...coord, ...updatedRows[0] }, actorUserId);
  });
}

/**
 * Borrower initiates return of the resource.
 * State -> RETURN_PENDING, borrower_return_initiated = TRUE.
 */
async function initiateReturn({ coordinationId, actorUserId, hubId }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT c.*, ri.name AS resource_name, u_req.name AS requester_name, u_count.name AS counterpart_name
       FROM coordinations c
       LEFT JOIN resource_inventory ri ON ri.resource_id = c.resource_id
       JOIN users u_req ON u_req.user_id = c.requester_id
       JOIN users u_count ON u_count.user_id = c.counterpart_id
       WHERE c.coordination_id = $1
       FOR UPDATE OF c`,
      [coordinationId]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'coordination not found');
    }
    const coord = rows[0];
    assertSameHub(hubId, coord.hub_id, 'coordination');

    // Strictly the borrower
    if (coord.requester_id !== actorUserId) {
      throw new ApiError(403, 'FORBIDDEN', 'strictly the borrower may initiate return');
    }

    if (!['IN_USE', 'RETURN_DUE'].includes(coord.state)) {
      throw new ApiError(409, 'INVALID_STATE', `cannot initiate return from ${coord.state}`);
    }

    const { rows: updatedRows } = await client.query(
      `UPDATE coordinations
       SET state = 'RETURN_PENDING', borrower_return_initiated = TRUE
       WHERE coordination_id = $1
       RETURNING *`,
      [coordinationId]
    );

    // Immutable event
    await client.query(
      `INSERT INTO coordination_events (coordination_id, actor_id, event_type, summary)
       VALUES ($1, $2, 'RETURN_INITIATED', $3)`,
      [coordinationId, actorUserId, 'Borrower initiated return']
    );

    return serializeCoordinationDetail({ ...coord, ...updatedRows[0] }, actorUserId);
  });
}

/**
 * Owner confirms return receipt.
 * State -> COMPLETED, owner_return_confirmed = TRUE, completed_at = now().
 * Restores underlying resource availability.
 */
async function confirmReturn({ coordinationId, actorUserId, hubId }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT c.*, ri.owner_id AS actual_resource_owner_id, ri.name AS resource_name,
              u_req.name AS requester_name, u_count.name AS counterpart_name
       FROM coordinations c
       JOIN resource_inventory ri ON ri.resource_id = c.resource_id
       JOIN users u_req ON u_req.user_id = c.requester_id
       JOIN users u_count ON u_count.user_id = c.counterpart_id
       WHERE c.coordination_id = $1
       FOR UPDATE OF c`,
      [coordinationId]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'coordination not found');
    }
    const coord = rows[0];
    assertSameHub(hubId, coord.hub_id, 'coordination');

    // Strictly the resource owner
    if (coord.counterpart_id !== actorUserId) {
      throw new ApiError(403, 'FORBIDDEN', 'strictly the resource owner may confirm return receipt');
    }

    // Explicit verification of the invariant: counterpart_id = resource_inventory.owner_id
    if (coord.counterpart_id !== coord.actual_resource_owner_id) {
      throw new ApiError(500, 'INVARIANT_VIOLATION', 'counterpart_id does not match resource owner');
    }

    if (coord.state === 'COMPLETED') {
      throw new ApiError(409, 'INVALID_STATE', 'coordination is already completed and cannot be returned again');
    }

    if (coord.state !== 'RETURN_PENDING') {
      throw new ApiError(409, 'INVALID_STATE', `cannot confirm return from state ${coord.state}`);
    }

    const { rows: updatedRows } = await client.query(
      `UPDATE coordinations
       SET state = 'COMPLETED',
           owner_return_confirmed = TRUE,
           completed_at = now()
       WHERE coordination_id = $1
       RETURNING *`,
      [coordinationId]
    );

    // Immutable events: RETURN_CONFIRMED and COMPLETED
    await client.query(
      `INSERT INTO coordination_events (coordination_id, actor_id, event_type, summary)
       VALUES ($1, $2, 'RETURN_CONFIRMED', $3)`,
      [coordinationId, actorUserId, 'Owner confirmed return receipt']
    );

    await client.query(
      `INSERT INTO coordination_events (coordination_id, actor_id, event_type, summary)
       VALUES ($1, $2, 'COMPLETED', $3)`,
      [coordinationId, actorUserId, 'Coordination completed successfully']
    );

    return serializeCoordinationDetail({ ...coord, ...updatedRows[0] }, actorUserId);
  });
}

/**
 * Posts an operational coordination message.
 */
async function postCoordinationMessage({ coordinationId, actorUserId, hubId, text, body, messageType = 'coordination_note' }) {
  const content = (text !== undefined ? text : (body !== undefined ? body : '')).trim();
  if (!content) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'message text is required');
  }

  const { rows } = await query(
    `SELECT c.* FROM coordinations c WHERE c.coordination_id = $1`,
    [coordinationId]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'coordination not found');
  }
  const coord = rows[0];
  assertSameHub(hubId, coord.hub_id, 'coordination');

  const isParticipant = coord.requester_id === actorUserId || coord.counterpart_id === actorUserId;
  if (!isParticipant) {
    throw new ApiError(404, 'NOT_FOUND', 'coordination not found');
  }

  if (coord.state === 'COMPLETED' || coord.state === 'BLOCKED') {
    throw new ApiError(409, 'INVALID_STATE', `cannot send messages on a ${coord.state} coordination`);
  }

  const otherUserId = coord.requester_id === actorUserId ? coord.counterpart_id : coord.requester_id;
  const blocked = await isBlocked(actorUserId, otherUserId);
  if (blocked) {
    throw new ApiError(403, 'FORBIDDEN', 'messaging is prohibited due to a block relationship');
  }

  const { rows: msgRows } = await query(
    `INSERT INTO coordination_messages (coordination_id, sender_id, message_type, text)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [coordinationId, actorUserId, messageType, content]
  );

  return { ...msgRows[0], body: msgRows[0].text };
}

/**
 * Retrieves message thread for a coordination.
 */
async function getCoordinationMessages({ coordinationId, actorUserId, hubId, role }) {
  const { rows } = await query(
    `SELECT c.* FROM coordinations c WHERE c.coordination_id = $1`,
    [coordinationId]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'coordination not found');
  }
  const coord = rows[0];
  assertSameHub(hubId, coord.hub_id, 'coordination');

  const isParticipant = coord.requester_id === actorUserId || coord.counterpart_id === actorUserId;
  if (!isParticipant && role !== 'coordinator') {
    throw new ApiError(404, 'NOT_FOUND', 'coordination not found');
  }

  const { rows: messages } = await query(
    `SELECT message_id, coordination_id, sender_id, message_type, text, created_at
     FROM coordination_messages
     WHERE coordination_id = $1
     ORDER BY created_at ASC`,
    [coordinationId]
  );

  return messages;
}

module.exports = {
  listCoordinations,
  getCoordinationDetail,
  transitionCoordination,
  initiateReturn,
  confirmReturn,
  postCoordinationMessage,
  getCoordinationMessages,
};
