/**
 * SAATHI Resource Requests Service
 * Canonical Phase 2D enforcement layer.
 *
 * Enforces:
 *  - Authenticated requester identity (never trusts client-supplied requester_id)
 *  - Hub isolation
 *  - Requester cannot request own resource
 *  - Bidirectional blocking checks
 *  - Atomic owner approval with concurrency locking & Coordination creation
 *  - Mandatory invariant: coordinations.counterpart_id = resource_inventory.owner_id
 *  - Initial coordination event creation
 *  - Owner decline and borrower cancellation
 */

const { query, withTransaction } = require('../db');
const { ApiError } = require('../lib/errors');
const {
  serializeRequesterRequest,
  serializeOwnerRequestDetail,
} = require('./serializers');
const {
  assertSameHub,
  isBlocked,
  computeTrustSignals,
} = require('./authorization');
const { ACTIVE_COORDINATION_STATES } = require('./resources');

/**
 * Borrower submits a borrow request.
 */
async function createResourceRequest({
  resourceId,
  actorUserId,
  hubId,
  purpose,
  duration,
  timeWindowStart,
  timeWindowEnd,
  handoffPreference,
  message,
}) {
  if (!resourceId || !timeWindowStart || !timeWindowEnd) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'resource_id, time_window_start, and time_window_end are required');
  }

  const startDate = new Date(timeWindowStart);
  const endDate = new Date(timeWindowEnd);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'time_window_end must be greater than time_window_start');
  }

  // Fetch target resource
  const { rows: resRows } = await query(
    'SELECT resource_id, owner_id, hub_id, name, is_active FROM resource_inventory WHERE resource_id = $1',
    [resourceId]
  );
  if (resRows.length === 0 || !resRows[0].is_active) {
    throw new ApiError(404, 'NOT_FOUND', 'resource not found');
  }
  const resource = resRows[0];

  // Hub isolation
  assertSameHub(hubId, resource.hub_id, 'resource');

  // Owner cannot request own resource
  if (resource.owner_id === actorUserId) {
    throw new ApiError(422, 'CONSTRAINT_VIOLATION', 'cannot request your own resource');
  }

  // Check blocking between borrower and owner
  const blocked = await isBlocked(actorUserId, resource.owner_id);
  if (blocked) {
    throw new ApiError(404, 'NOT_FOUND', 'resource not found');
  }

  // Insert request
  const { rows: reqRows } = await query(
    `INSERT INTO resource_requests (
       resource_id,
       requester_id,
       time_window_start,
       time_window_end,
       purpose,
       duration,
       handoff_preference,
       message,
       status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'REQUESTED')
     RETURNING *`,
    [
      resourceId,
      actorUserId,
      startDate.toISOString(),
      endDate.toISOString(),
      purpose || null,
      duration || null,
      handoffPreference || null,
      message || null,
    ]
  );

  return serializeRequesterRequest(reqRows[0], resource);
}

/**
 * Owner retrieves inbound requests for their resources.
 */
async function getInboundRequests({ ownerId, hubId }) {
  const { rows } = await query(
    `SELECT
       rr.*,
       ri.name AS resource_name,
       ri.hub_id,
       u.name AS requester_name,
       u.created_at AS requester_created_at
     FROM resource_requests rr
     JOIN resource_inventory ri ON ri.resource_id = rr.resource_id
     JOIN users u ON u.user_id = rr.requester_id
     WHERE ri.owner_id = $1
       AND ri.hub_id = $2
       AND NOT EXISTS (
         SELECT 1 FROM blocked_users bu
         WHERE (bu.blocker_id = $1 AND bu.blocked_user_id = rr.requester_id)
            OR (bu.blocker_id = rr.requester_id AND bu.blocked_user_id = $1)
       )
     ORDER BY rr.created_at DESC`,
    [ownerId, hubId]
  );

  const results = await Promise.all(
    rows.map(async (row) => {
      const trustSignals = await computeTrustSignals(row.requester_id, hubId);
      return serializeOwnerRequestDetail(row, null, null, trustSignals);
    })
  );

  return results;
}

/**
 * Borrower retrieves their outbound requests.
 */
async function getOutboundRequests({ requesterId, hubId }) {
  const { rows } = await query(
    `SELECT
       rr.*,
       ri.name AS resource_name,
       ri.hub_id
     FROM resource_requests rr
     JOIN resource_inventory ri ON ri.resource_id = rr.resource_id
     WHERE rr.requester_id = $1
       AND ri.hub_id = $2
     ORDER BY rr.created_at DESC`,
    [requesterId, hubId]
  );

  return rows.map((r) => serializeRequesterRequest(r));
}

/**
 * Detailed view of a request with participant authorization.
 */
async function getRequestDetail({ requestId, actorUserId, hubId, role }) {
  const { rows } = await query(
    `SELECT
       rr.*,
       ri.owner_id,
       ri.hub_id,
       ri.name AS resource_name,
       u.name AS requester_name,
       u.created_at AS requester_created_at
     FROM resource_requests rr
     JOIN resource_inventory ri ON ri.resource_id = rr.resource_id
     JOIN users u ON u.user_id = rr.requester_id
     WHERE rr.request_id = $1`,
    [requestId]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'resource request not found');
  }

  const row = rows[0];
  assertSameHub(hubId, row.hub_id, 'resource request');

  const isRequester = row.requester_id === actorUserId;
  const isOwner = row.owner_id === actorUserId;
  const isCoordinator = role === 'coordinator';

  if (!isRequester && !isOwner && !isCoordinator) {
    throw new ApiError(404, 'NOT_FOUND', 'resource request not found');
  }

  if (isOwner || isCoordinator) {
    const trustSignals = await computeTrustSignals(row.requester_id, hubId);
    return serializeOwnerRequestDetail(row, null, null, trustSignals);
  }

  return serializeRequesterRequest(row);
}

/**
 * Owner approves a request transactionally.
 * Creates the Coordination record and initial CoordinationEvent.
 */
async function approveRequest({ requestId, actorUserId, hubId }) {
  return withTransaction(async (client) => {
    // 1. Lock the request
    const { rows: reqRows } = await client.query(
      `SELECT rr.*, ri.owner_id, ri.hub_id, ri.name AS resource_name, ri.handoff_policy
       FROM resource_requests rr
       JOIN resource_inventory ri ON ri.resource_id = rr.resource_id
       WHERE rr.request_id = $1
       FOR UPDATE OF rr`,
      [requestId]
    );

    if (reqRows.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'resource request not found');
    }
    const request = reqRows[0];

    // Hub isolation
    assertSameHub(hubId, request.hub_id, 'resource request');

    // Ownership check
    if (request.owner_id !== actorUserId) {
      throw new ApiError(403, 'FORBIDDEN', 'only the resource owner may approve this request');
    }

    // State check
    if (request.status !== 'REQUESTED') {
      throw new ApiError(409, 'INVALID_STATE', `cannot approve a request in ${request.status} status`);
    }

    // Blocking check
    const blocked = await isBlocked(actorUserId, request.requester_id, client);
    if (blocked) {
      throw new ApiError(409, 'INVALID_STATE', 'cannot approve request due to an active block relationship');
    }

    // 2. Lock the resource and check active coordination availability
    const { rows: resRows } = await client.query(
      'SELECT resource_id, is_active FROM resource_inventory WHERE resource_id = $1 FOR UPDATE',
      [request.resource_id]
    );
    if (resRows.length === 0 || !resRows[0].is_active) {
      throw new ApiError(409, 'RESOURCE_UNAVAILABLE', 'resource is not active');
    }

    const { rows: activeCoords } = await client.query(
      `SELECT coordination_id FROM coordinations
       WHERE resource_id = $1 AND state = ANY($2)
       LIMIT 1`,
      [request.resource_id, ACTIVE_COORDINATION_STATES]
    );
    if (activeCoords.length > 0) {
      throw new ApiError(409, 'RESOURCE_UNAVAILABLE', 'resource is currently in an active coordination');
    }

    // 3. Mark request APPROVED
    await client.query(
      `UPDATE resource_requests
       SET status = 'APPROVED'
       WHERE request_id = $1`,
      [requestId]
    );

    // 4. Create Coordination record
    // CANONICAL INVARIANT: counterpart_id = request.owner_id (actual resource owner)
    const counterpartId = request.owner_id;
    const requesterId = request.requester_id;
    const handoffLocation = request.handoff_preference || request.handoff_policy || 'Safe/mutually agreed handoff point';

    const { rows: coordRows } = await client.query(
      `INSERT INTO coordinations (
         hub_id,
         request_id,
         resource_id,
         requester_id,
         counterpart_id,
         title,
         type,
         state,
         purpose,
         handoff_location,
         scheduled_time,
         due_time
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'resource', 'APPROVED', $7, $8, $9, $10)
       RETURNING *`,
      [
        hubId,
        requestId,
        request.resource_id,
        requesterId,
        counterpartId,
        `Borrow ${request.resource_name || 'Resource'}`,
        request.purpose || null,
        handoffLocation,
        request.time_window_start,
        request.time_window_end,
      ]
    );
    const coordination = coordRows[0];

    // 5. Create initial CoordinationEvent (immutable)
    await client.query(
      `INSERT INTO coordination_events (
         coordination_id,
         actor_id,
         event_type,
         summary
       )
       VALUES ($1, $2, 'COORDINATION_CREATED', 'Request approved by resource owner')`,
      [coordination.coordination_id, actorUserId]
    );

    return {
      request: serializeRequesterRequest({ ...request, status: 'APPROVED' }),
      coordination: {
        coordination_id: coordination.coordination_id,
        resource_id: coordination.resource_id,
        requester_id: coordination.requester_id,
        counterpart_id: coordination.counterpart_id,
        state: coordination.state,
        title: coordination.title,
        scheduled_time: coordination.scheduled_time,
        due_time: coordination.due_time,
      },
    };
  });
}

/**
 * Owner declines a request.
 */
async function declineRequest({ requestId, actorUserId, hubId, declineReason = null }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT rr.*, ri.owner_id, ri.hub_id
       FROM resource_requests rr
       JOIN resource_inventory ri ON ri.resource_id = rr.resource_id
       WHERE rr.request_id = $1
       FOR UPDATE OF rr`,
      [requestId]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'resource request not found');
    }
    const request = rows[0];

    assertSameHub(hubId, request.hub_id, 'resource request');

    if (request.owner_id !== actorUserId) {
      throw new ApiError(403, 'FORBIDDEN', 'only the resource owner may decline this request');
    }

    if (request.status !== 'REQUESTED') {
      throw new ApiError(409, 'INVALID_STATE', `cannot decline a request in ${request.status} status`);
    }

    const { rows: updated } = await client.query(
      `UPDATE resource_requests
       SET status = 'DECLINED', decline_reason = $2
       WHERE request_id = $1
       RETURNING *`,
      [requestId, declineReason || null]
    );

    return serializeRequesterRequest(updated[0]);
  });
}

/**
 * Borrower cancels their pending request.
 */
async function cancelRequest({ requestId, actorUserId, hubId }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT rr.*, ri.hub_id
       FROM resource_requests rr
       JOIN resource_inventory ri ON ri.resource_id = rr.resource_id
       WHERE rr.request_id = $1
       FOR UPDATE OF rr`,
      [requestId]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'resource request not found');
    }
    const request = rows[0];

    assertSameHub(hubId, request.hub_id, 'resource request');

    if (request.requester_id !== actorUserId) {
      throw new ApiError(403, 'FORBIDDEN', 'only the requester may cancel this request');
    }

    if (request.status !== 'REQUESTED') {
      throw new ApiError(409, 'INVALID_STATE', `cannot cancel a request in ${request.status} status`);
    }

    const { rows: updated } = await client.query(
      `UPDATE resource_requests
       SET status = 'CANCELLED'
       WHERE request_id = $1
       RETURNING *`,
      [requestId]
    );

    return serializeRequesterRequest(updated[0]);
  });
}

module.exports = {
  createResourceRequest,
  getInboundRequests,
  getOutboundRequests,
  getRequestDetail,
  approveRequest,
  declineRequest,
  cancelRequest,
};
