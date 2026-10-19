/**
 * SAATHI Coverage Requests API Module
 * Phase 2G-5A Implementation
 *
 * Ground rules:
 * 1. Uses canonical apiClient from src/api/client.js only.
 * 2. Server-authoritative: client identity is derived solely by backend via Bearer token.
 * 3. Never send requested_by, assigned_to, hub_id, status, or state in mutation payloads.
 * 4. Respects participant privacy models.
 * 5. Normalized error format: { error, message, status }.
 */

import { apiClient } from './client.js';

/**
 * List coverage requests for the authenticated user (requested by or assigned to).
 * Endpoint: GET /coverage-requests
 *
 * @returns {Promise<Array<Object>>}
 */
export async function listCoverageRequests() {
  return apiClient.get('/coverage-requests');
}

/**
 * Get details for a specific coverage request.
 * Restricted to requested_by, assigned_to, or coordinator.
 * Endpoint: GET /coverage-requests/:id
 *
 * @param {string} requestId
 * @returns {Promise<Object>}
 */
export async function getCoverageRequest(requestId) {
  if (!requestId) {
    throw new Error('requestId is required');
  }
  return apiClient.get(`/coverage-requests/${encodeURIComponent(requestId)}`);
}

/**
 * Create a new coverage request for the authenticated resident.
 * Endpoint: POST /coverage-requests
 *
 * Required fields: task_type, date, time_window_start, time_window_end, location
 * Forbidden fields: requested_by, assigned_to, hub_id, status
 *
 * @param {Object} payload
 * @param {string} payload.task_type
 * @param {string} payload.date
 * @param {string} payload.time_window_start
 * @param {string} payload.time_window_end
 * @param {string} payload.location
 * @param {string} [payload.notes]
 * @returns {Promise<Object>}
 */
export async function createCoverageRequest(payload = {}) {
  const {
    task_type,
    date,
    time_window_start,
    time_window_end,
    location,
    notes,
  } = payload;

  if (!task_type || !date || !time_window_start || !time_window_end || !location) {
    throw new Error('task_type, date, time_window_start, time_window_end, and location are required');
  }

  // Explicit payload construction: forbidden authority fields strictly excluded
  const safeBody = {
    task_type,
    date,
    time_window_start,
    time_window_end,
    location,
    ...(notes !== undefined && { notes }),
  };

  return apiClient.post('/coverage-requests', safeBody);
}

/**
 * Accept an open coverage request as an eligible volunteer/resident.
 * Endpoint: POST /coverage-requests/:id/accept
 *
 * @param {string} requestId
 * @returns {Promise<Object>}
 */
export async function acceptCoverageRequest(requestId) {
  if (!requestId) {
    throw new Error('requestId is required');
  }
  return apiClient.post(`/coverage-requests/${encodeURIComponent(requestId)}/accept`);
}

/**
 * Start an accepted coverage request (assigned volunteer only).
 * Endpoint: POST /coverage-requests/:id/start
 *
 * @param {string} requestId
 * @returns {Promise<Object>}
 */
export async function startCoverageRequest(requestId) {
  if (!requestId) {
    throw new Error('requestId is required');
  }
  return apiClient.post(`/coverage-requests/${encodeURIComponent(requestId)}/start`);
}

/**
 * Complete an in-progress coverage request (assigned volunteer only).
 * Endpoint: POST /coverage-requests/:id/complete
 *
 * @param {string} requestId
 * @returns {Promise<Object>}
 */
export async function completeCoverageRequest(requestId) {
  if (!requestId) {
    throw new Error('requestId is required');
  }
  return apiClient.post(`/coverage-requests/${encodeURIComponent(requestId)}/complete`);
}

/**
 * Cancel a coverage request (requester or assigned volunteer).
 * Endpoint: POST /coverage-requests/:id/cancel
 *
 * @param {string} requestId
 * @returns {Promise<Object>}
 */
export async function cancelCoverageRequest(requestId) {
  if (!requestId) {
    throw new Error('requestId is required');
  }
  return apiClient.post(`/coverage-requests/${encodeURIComponent(requestId)}/cancel`);
}
