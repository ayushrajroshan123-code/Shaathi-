/**
 * SAATHI Neighborhood Issues API Module
 * Phase 2G-5B.4 Implementation
 *
 * Ground rules:
 * 1. Uses canonical apiClient from src/api/client.js only.
 * 2. Server-authoritative: client identity is derived solely by backend via Bearer token.
 * 3. Never send hub_id, reported_by, issue_id, position_3d, created_at.
 * 4. Respects strict privacy projections (reported_by only available to reporter).
 * 5. Normalized error format: { error, message, status }.
 */

import { apiClient } from './client.js';

/**
 * List public neighborhood issues in the authenticated actor's hub.
 * Endpoint: GET /issues
 *
 * @param {Object} [params]
 * @param {string} [params.status] - Optional filter by status (active, all, resolved, etc)
 * @returns {Promise<Array<Object>>}
 */
export async function listIssues(params = {}) {
  let path = '/issues';
  if (params && params.status) {
    const encodedStatus = encodeURIComponent(params.status);
    path += `?status=${encodedStatus}`;
  }
  return apiClient.get(path);
}

/**
 * Get details for a specific neighborhood issue.
 * Endpoint: GET /issues/:id
 *
 * @param {string} issueId
 * @returns {Promise<Object>}
 */
export async function getIssue(issueId) {
  if (!issueId) {
    throw new Error('issueId is required');
  }
  return apiClient.get(`/issues/${encodeURIComponent(issueId)}`);
}

/**
 * Report a new neighborhood infrastructure issue.
 * Endpoint: POST /issues
 *
 * @param {Object} payload
 * @param {string} payload.title
 * @param {string} payload.category
 * @param {string} payload.severity
 * @param {string} payload.general_location
 * @param {string} [payload.detail]
 * @returns {Promise<Object>}
 */
export async function createIssue(payload = {}) {
  const {
    title,
    category,
    severity,
    general_location,
    detail,
  } = payload;

  // Explicit payload construction: forbidden fields are strictly excluded
  const safeBody = {
    title,
    category,
    severity,
    general_location,
    ...(detail !== undefined && { detail }),
  };

  return apiClient.post('/issues', safeBody);
}

/**
 * Edit issue details.
 * Permitted ONLY for original reporter while issue status is 'reported'.
 * Endpoint: PATCH /issues/:id
 *
 * @param {string} issueId
 * @param {Object} payload
 * @param {string} [payload.title]
 * @param {string} [payload.category]
 * @param {string} [payload.severity]
 * @param {string} [payload.general_location]
 * @param {string} [payload.detail]
 * @returns {Promise<Object>}
 */
export async function editIssue(issueId, payload = {}) {
  if (!issueId) {
    throw new Error('issueId is required');
  }

  const {
    title,
    category,
    severity,
    general_location,
    detail,
  } = payload;

  const safeBody = {
    ...(title !== undefined && { title }),
    ...(category !== undefined && { category }),
    ...(severity !== undefined && { severity }),
    ...(general_location !== undefined && { general_location }),
    ...(detail !== undefined && { detail }),
  };

  return apiClient.patch(`/issues/${encodeURIComponent(issueId)}`, safeBody);
}

/**
 * Transition issue status.
 * Enforces strict transition matrix and actor authority rules.
 * Endpoint: PATCH /issues/:id/status
 *
 * @param {string} issueId
 * @param {Object} payload
 * @param {string} payload.status - The requested new status
 * @param {string} [payload.reason] - Reopening reason if status is 'attention_needed' from 'resolved'
 * @returns {Promise<Object>}
 */
export async function updateIssueStatus(issueId, payload = {}) {
  if (!issueId) {
    throw new Error('issueId is required');
  }

  const { status, reason } = payload;
  const safeBody = {
    status,
    ...(reason !== undefined && { reason }),
  };

  return apiClient.patch(`/issues/${encodeURIComponent(issueId)}/status`, safeBody);
}

export const issuesApi = {
  listIssues,
  getIssue,
  createIssue,
  editIssue,
  updateIssueStatus,
};

export default issuesApi;
