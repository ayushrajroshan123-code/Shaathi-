/**
 * SAATHI Representation Layers (Serializers)
 * Canonical implementation of API_CONTRACT.md Section 8.
 *
 * Guarantees zero leakage of internal database fields, raw database rows,
 * or private resident contact/location information across privacy boundaries.
 */

function formatMembershipAge(createdAt) {
  if (!createdAt) return 'New member';
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 30) return `${Math.max(1, days)} days`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''}`;
}

/**
 * Layer 1: Public Discovery View (ResourcePublicSummary)
 * Used for browsing available community tools (GET /resources, GET /resources/:id).
 *
 * EXPLICITLY EXCLUDED: owner_id, owner_name, owner_phone, exact location,
 * internal audit fields.
 */
function serializePublicResource(row, isAvailable = true) {
  return {
    resource_id: row.resource_id,
    name: row.name || 'Community Resource',
    type: row.type,
    condition: row.condition,
    general_area: row.general_area || 'Neighborhood General Area',
    handoff_policy: row.handoff_policy || 'Safe/mutually agreed handoff',
    available: Boolean(isAvailable),
    requires_approval: Boolean(row.requires_approval),
  };
}

/**
 * Layer 2: Requester View (ResourceRequestSummary)
 * Returned to the borrower tracking their outgoing request (GET /resources/requests/outbound,
 * GET /resources/requests/:id when caller is borrower).
 */
function serializeRequesterRequest(row, resourceRow = null) {
  const resourceName = resourceRow?.name || row.resource_name || 'Community Resource';
  return {
    request_id: row.request_id,
    resource_id: row.resource_id,
    resource_name: resourceName,
    status: row.status,
    time_window_start: row.time_window_start,
    time_window_end: row.time_window_end,
    duration: row.duration || null,
    handoff_preference: row.handoff_preference || null,
    purpose: row.purpose || null,
    counterpart_display: 'Resource Owner (Verified Neighbor)',
    created_at: row.created_at,
  };
}

/**
 * Layer 3: Owner Review View (ResourceRequestOwnerDetail)
 * Presented to the resource owner deciding whether to approve (GET /resources/requests/inbound,
 * GET /resources/requests/:id when caller is owner).
 *
 * FACTUAL SIGNALS ONLY: no scores, ratings, percentages, or risk evaluations.
 */
function serializeOwnerRequestDetail(row, resourceRow = null, requesterUser = null, trustSignals = {}) {
  const resourceName = resourceRow?.name || row.resource_name || 'Community Resource';
  const requesterName = requesterUser?.name || row.requester_name || 'Verified Resident';

  return {
    request_id: row.request_id,
    resource_id: row.resource_id,
    resource_name: resourceName,
    requester_id: row.requester_id,
    requester_name: requesterName,
    purpose: row.purpose || null,
    time_window_start: row.time_window_start,
    time_window_end: row.time_window_end,
    duration: row.duration || null,
    handoff_preference: row.handoff_preference || null,
    message: row.message || null,
    status: row.status,
    created_at: row.created_at,
    requester_trust: {
      identity_verified: Boolean(trustSignals.identity_verified),
      neighborhood_verified: Boolean(trustSignals.neighborhood_verified),
      membership_age: trustSignals.membership_age || formatMembershipAge(requesterUser?.created_at),
      completed_coordinations: Number(trustSignals.completed_coordinations || 0),
      no_outstanding_returns: Boolean(trustSignals.no_outstanding_returns !== false),
      eligible: Boolean(trustSignals.eligible !== false),
    },
  };
}

/**
 * Layer 4: Active Coordination View (CoordinationDetail)
 * Presented to participants during scheduled or active handoff/coordination.
 *
 * Strictly excludes private residential address or private storage location.
 */
function serializeCoordinationDetail(coordRow, actorUserId, events = [], messages = []) {
  const isBorrower = coordRow.requester_id === actorUserId;
  const counterpartName = isBorrower ? coordRow.counterpart_name : coordRow.requester_name;
  const counterpartRole = isBorrower ? 'Owner' : 'Borrower';
  const counterpartDisplay = counterpartName
    ? `${counterpartName} (Verified Neighbor)`
    : `${counterpartRole} (Verified Neighbor)`;

  return {
    coordination_id: coordRow.coordination_id,
    resource_id: coordRow.resource_id,
    resource_name: coordRow.resource_name || coordRow.title,
    role: isBorrower ? 'borrowing' : 'lending',
    counterpart_role: counterpartRole,
    counterpart_display: counterpartDisplay,
    state: coordRow.state,
    purpose: coordRow.purpose || null,
    handoff_location: coordRow.handoff_location || 'Safe/mutually agreed handoff point',
    scheduled_time: coordRow.scheduled_time || null,
    due_time: coordRow.due_time || null,
    borrower_return_initiated: Boolean(coordRow.borrower_return_initiated),
    owner_return_confirmed: Boolean(coordRow.owner_return_confirmed),
    created_at: coordRow.created_at,
    completed_at: coordRow.completed_at || null,
    events: events.map((e) => ({
      event_id: e.event_id,
      event_type: e.event_type,
      actor_id: e.actor_id,
      summary: e.summary,
      created_at: e.created_at,
    })),
    messages: messages.map((m) => ({
      message_id: m.message_id,
      sender_id: m.sender_id,
      message_type: m.message_type,
      text: m.text,
      created_at: m.created_at,
    })),
  };
}

module.exports = {
  formatMembershipAge,
  serializePublicResource,
  serializeRequesterRequest,
  serializeOwnerRequestDetail,
  serializeCoordinationDetail,
};
