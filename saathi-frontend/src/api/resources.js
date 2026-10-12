/**
 * SAATHI Resources & Resource Requests API Module
 * Phase 2G-2 Implementation
 *
 * Ground rules:
 * 1. Uses canonical apiClient from src/api/client.js only.
 * 2. Server-authoritative: client identity is derived solely by backend via Bearer token.
 * 3. Never send requester_id, owner_id, counterpart_id, hub_id, status, or state in mutation payloads.
 * 4. Respects Layer 1 (public resource) and Layer 2/3 (requester/owner requests) privacy models.
 * 5. Normalized error format: { error, message, status }.
 */

import { apiClient } from './client.js';

/**
 * List public shared resources in the user's hub.
 * Endpoint: GET /resources
 *
 * @param {Object} [params]
 * @param {string} [params.type] - Optional filter by resource type
 * @returns {Promise<Array<Object>>}
 */
export async function listResources(params = {}) {
  let path = '/resources';
  if (params && params.type) {
    const encodedType = encodeURIComponent(params.type);
    path += `?type=${encodedType}`;
  }
  return apiClient.get(path);
}

/**
 * Get public details for a specific shared resource.
 * Endpoint: GET /resources/:id
 *
 * @param {string} resourceId
 * @returns {Promise<Object>}
 */
export async function getResource(resourceId) {
  if (!resourceId) {
    throw new Error('resourceId is required');
  }
  return apiClient.get(`/resources/${encodeURIComponent(resourceId)}`);
}

/**
 * Create a new shared resource listing for the authenticated resident.
 * Endpoint: POST /resources
 *
 * Security / Authority Rule:
 * Never sends owner_id, hub_id, created_by, status, or availability.
 * Ownership and hub are derived authoritatively by the backend from req.actor.
 *
 * @param {Object} payload
 * @param {string} payload.name - Name of the resource
 * @param {string} payload.type - Type/category
 * @param {string} payload.condition - Physical condition
 * @param {string} [payload.general_area] - Neighborhood general area
 * @param {string} [payload.handoff_policy] - Safe handoff policy
 * @param {boolean} [payload.requires_approval] - Whether owner approval is required
 * @param {string} [payload.location] - General location
 * @param {string} [payload.availability_window_start] - ISO timestamp
 * @param {string} [payload.availability_window_end] - ISO timestamp
 * @param {boolean} [payload.emergency_opt_in] - Emergency opt-in
 * @returns {Promise<Object>}
 */
export async function createResource(payload = {}) {
  const {
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
  } = payload;

  // Explicit payload construction: forbidden fields are strictly excluded
  const safeBody = {
    name,
    type,
    condition,
    ...(general_area !== undefined && { general_area }),
    ...(handoff_policy !== undefined && { handoff_policy }),
    ...(requires_approval !== undefined && { requires_approval }),
    ...(location !== undefined && { location }),
    ...(availability_window_start !== undefined && { availability_window_start }),
    ...(availability_window_end !== undefined && { availability_window_end }),
    ...(emergency_opt_in !== undefined && { emergency_opt_in }),
  };

  return apiClient.post('/resources', safeBody);
}

/**
 * List incoming borrow requests for the authenticated user's resources.
 * Endpoint: GET /resources/requests/inbound
 *
 * @returns {Promise<Array<Object>>}
 */
export async function listInboundRequests() {
  return apiClient.get('/resources/requests/inbound');
}

/**
 * List outgoing borrow requests submitted by the authenticated user.
 * Endpoint: GET /resources/requests/outbound
 *
 * @returns {Promise<Array<Object>>}
 */
export async function listOutboundRequests() {
  return apiClient.get('/resources/requests/outbound');
}

/**
 * Get request detail with participant access control.
 * Endpoint: GET /resources/requests/:id
 *
 * @param {string} requestId
 * @returns {Promise<Object>}
 */
export async function getResourceRequest(requestId) {
  if (!requestId) {
    throw new Error('requestId is required');
  }
  return apiClient.get(`/resources/requests/${encodeURIComponent(requestId)}`);
}

/**
 * Create a new borrow request for a resource.
 * Endpoint: POST /resources/requests
 *
 * Security / Authority Rule:
 * Never sends requester_id, owner_id, counterpart_id, hub_id, status, or state.
 * Requester identity is bound strictly to the session bearer token.
 *
 * @param {Object} payload
 * @param {string} payload.resource_id - Resource UUID
 * @param {string} payload.time_window_start - ISO timestamp
 * @param {string} payload.time_window_end - ISO timestamp
 * @param {string} [payload.purpose] - Purpose of borrowing
 * @param {string} [payload.duration] - Estimated duration
 * @param {string} [payload.handoff_preference] - Preferred handoff location
 * @param {string} [payload.message] - Note to owner
 * @returns {Promise<Object>}
 */
export async function createResourceRequest(payload = {}) {
  const {
    resource_id,
    time_window_start,
    time_window_end,
    purpose,
    duration,
    handoff_preference,
    message,
  } = payload;

  // Strict payload construction: only allowed fields
  const safeBody = {
    resource_id,
    time_window_start,
    time_window_end,
    ...(purpose !== undefined && { purpose }),
    ...(duration !== undefined && { duration }),
    ...(handoff_preference !== undefined && { handoff_preference }),
    ...(message !== undefined && { message }),
  };

  return apiClient.post('/resources/requests', safeBody);
}

/**
 * Owner approves a pending borrow request.
 * Endpoint: POST /resources/requests/:id/approve
 *
 * @param {string} requestId
 * @returns {Promise<Object>} Returns { request, coordination }
 */
export async function approveResourceRequest(requestId) {
  if (!requestId) {
    throw new Error('requestId is required');
  }
  return apiClient.post(`/resources/requests/${encodeURIComponent(requestId)}/approve`);
}

/**
 * Owner declines a pending borrow request.
 * Endpoint: POST /resources/requests/:id/decline
 *
 * @param {string} requestId
 * @param {string} [reason] - Optional decline reason
 * @returns {Promise<Object>} Returns { request }
 */
export async function declineResourceRequest(requestId, reason = null) {
  if (!requestId) {
    throw new Error('requestId is required');
  }
  const body = reason ? { reason } : {};
  return apiClient.post(`/resources/requests/${encodeURIComponent(requestId)}/decline`, body);
}

/**
 * Borrower cancels a pending borrow request.
 * Endpoint: POST /resources/requests/:id/cancel
 *
 * @param {string} requestId
 * @returns {Promise<Object>} Returns { request }
 */
export async function cancelResourceRequest(requestId) {
  if (!requestId) {
    throw new Error('requestId is required');
  }
  return apiClient.post(`/resources/requests/${encodeURIComponent(requestId)}/cancel`);
}

export const resourcesApi = {
  listResources,
  getResource,
  createResource,
  listInboundRequests,
  listOutboundRequests,
  getResourceRequest,
  createResourceRequest,
  approveResourceRequest,
  declineResourceRequest,
  cancelResourceRequest,
};

export default resourcesApi;
