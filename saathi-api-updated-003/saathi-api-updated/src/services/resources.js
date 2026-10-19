/**
 * SAATHI Resource Discovery & Management Service
 * Canonical Phase 2D enforcement layer.
 *
 * Enforces:
 *  - Resource-first public discovery
 *  - Hub isolation
 *  - Bidirectional blocking filter
 *  - Explicit column projection (zero owner identity or exact home location leakage)
 *  - Dynamic coordination availability calculation
 */

const { query } = require('../db');
const { ApiError } = require('../lib/errors');
const { serializePublicResource } = require('./serializers');
const { assertSameHub, isBlocked } = require('./authorization');

const ACTIVE_COORDINATION_STATES = [
  'APPROVED',
  'SCHEDULED',
  'HANDOFF_READY',
  'HANDED_OVER',
  'IN_USE',
  'RETURN_DUE',
  'RETURN_PENDING',
];

/**
 * Public discovery of community resources.
 * Explicitly projects ONLY privacy-safe columns.
 */
async function listPublicResources({ hubId, actorUserId, type = null }) {
  if (!hubId) throw new ApiError(400, 'VALIDATION_ERROR', 'hub_id is required');

  const { rows } = await query(
    `SELECT
       ri.resource_id,
       ri.name,
       ri.type,
       ri.condition,
       ri.general_area,
       ri.handoff_policy,
       ri.requires_approval,
       ri.is_active,
       NOT EXISTS (
         SELECT 1 FROM coordinations c
         WHERE c.resource_id = ri.resource_id
           AND c.state = ANY($4)
       ) AS is_available
     FROM resource_inventory ri
     WHERE ri.hub_id = $1
       AND ri.is_active = TRUE
       AND ($2::text IS NULL OR ri.type = $2)
       AND NOT EXISTS (
         SELECT 1 FROM blocked_users bu
         WHERE (bu.blocker_id = $3 AND bu.blocked_user_id = ri.owner_id)
            OR (bu.blocker_id = ri.owner_id AND bu.blocked_user_id = $3)
       )
     ORDER BY ri.created_at DESC`,
    [hubId, type || null, actorUserId, ACTIVE_COORDINATION_STATES]
  );

  return rows.map((r) => serializePublicResource(r, r.is_available));
}

/**
 * Detailed view of a shared resource for borrowing.
 * Never exposes owner_id or private residential location.
 */
async function getPublicResourceDetail({ resourceId, hubId, actorUserId }) {
  if (!resourceId) throw new ApiError(400, 'VALIDATION_ERROR', 'resource_id is required');

  const { rows } = await query(
    `SELECT
       ri.resource_id,
       ri.hub_id,
       ri.owner_id,
       ri.name,
       ri.type,
       ri.condition,
       ri.general_area,
       ri.handoff_policy,
       ri.requires_approval,
       ri.is_active,
       NOT EXISTS (
         SELECT 1 FROM coordinations c
         WHERE c.resource_id = ri.resource_id
           AND c.state = ANY($2)
       ) AS is_available
     FROM resource_inventory ri
     WHERE ri.resource_id = $1 AND ri.is_active = TRUE`,
    [resourceId, ACTIVE_COORDINATION_STATES]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'resource not found');
  }

  const row = rows[0];
  assertSameHub(hubId, row.hub_id, 'resource');

  // Check if caller is blocked by owner or vice versa
  const blocked = await isBlocked(actorUserId, row.owner_id);
  if (blocked) {
    throw new ApiError(404, 'NOT_FOUND', 'resource not found');
  }

  return serializePublicResource(row, row.is_available);
}

/**
 * Creates a resource listing for the authenticated resident.
 */
async function createResource({
  hubId,
  ownerId,
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
}) {
  if (!name || !type || !condition) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'name, type, and condition are required');
  }

  const safeArea = general_area || 'Neighborhood General Area';
  const safePolicy = handoff_policy || 'Safe/mutually agreed handoff';
  const safeLocation = location || safeArea;

  const { rows } = await query(
    `INSERT INTO resource_inventory (
       hub_id,
       owner_id,
       name,
       type,
       condition,
       general_area,
       handoff_policy,
       requires_approval,
       location,
       availability_window_start,
       availability_window_end,
       emergency_opt_in
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, TRUE), $9, $10, $11, COALESCE($12, FALSE))
     RETURNING resource_id, hub_id, name, type, condition, general_area, handoff_policy, requires_approval, is_active, created_at`,
    [
      hubId,
      ownerId,
      name,
      type,
      condition,
      safeArea,
      safePolicy,
      requires_approval ?? true,
      safeLocation,
      availability_window_start || null,
      availability_window_end || null,
      emergency_opt_in || false,
    ]
  );

  return serializePublicResource(rows[0], true);
}

module.exports = {
  ACTIVE_COORDINATION_STATES,
  listPublicResources,
  getPublicResourceDetail,
  createResource,
};
