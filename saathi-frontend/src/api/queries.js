/**
 * SAATHI Neighborhood Queries API Module
 * Phase 2G-6 Step 2 Frontend Integration
 *
 * Ground rules:
 * 1. Uses canonical apiClient from src/api/client.js only.
 * 2. Server-authoritative: client identity is derived solely by backend via Bearer token.
 * 3. Never send hub_id, query_id, or created_at in body.
 * 4. Normalized error format: { error, message, status }.
 */

import { apiClient } from './client.js';

export async function listQueries(params = {}) {
  let path = '/queries';
  if (params && params.status) {
    path += `?status=${encodeURIComponent(params.status)}`;
  }
  return apiClient.get(path);
}

export async function getQuery(queryId) {
  if (!queryId) throw new Error('queryId is required');
  return apiClient.get(`/queries/${encodeURIComponent(queryId)}`);
}

export async function createQuery(payload = {}) {
  const { title, body } = payload;
  const safeBody = { title, body };
  return apiClient.post('/queries', safeBody);
}

export async function editQuery(queryId, payload = {}) {
  if (!queryId) throw new Error('queryId is required');
  const { title, body } = payload;
  const safeBody = {
    ...(title !== undefined && { title }),
    ...(body !== undefined && { body }),
  };
  return apiClient.patch(`/queries/${encodeURIComponent(queryId)}`, safeBody);
}

export async function resolveQuery(queryId) {
  if (!queryId) throw new Error('queryId is required');
  return apiClient.post(`/queries/${encodeURIComponent(queryId)}/resolve`);
}

export async function deleteQuery(queryId) {
  if (!queryId) throw new Error('queryId is required');
  return apiClient.delete(`/queries/${encodeURIComponent(queryId)}`);
}

export async function listAnswers(queryId) {
  if (!queryId) throw new Error('queryId is required');
  return apiClient.get(`/queries/${encodeURIComponent(queryId)}/answers`);
}

export async function addAnswer(queryId, payload = {}) {
  if (!queryId) throw new Error('queryId is required');
  const { body } = payload;
  const safeBody = { body };
  return apiClient.post(`/queries/${encodeURIComponent(queryId)}/answers`, safeBody);
}

export async function markAnswerHelpful(queryId, answerId) {
  if (!queryId) throw new Error('queryId is required');
  if (!answerId) throw new Error('answerId is required');
  return apiClient.post(`/queries/${encodeURIComponent(queryId)}/answers/${encodeURIComponent(answerId)}/helpful`);
}

export async function clearHelpfulAnswer(queryId, answerId) {
  if (!queryId) throw new Error('queryId is required');
  if (!answerId) throw new Error('answerId is required');
  return apiClient.delete(`/queries/${encodeURIComponent(queryId)}/answers/${encodeURIComponent(answerId)}/helpful`);
}

export async function deleteAnswer(queryId, answerId) {
  if (!queryId) throw new Error('queryId is required');
  if (!answerId) throw new Error('answerId is required');
  return apiClient.delete(`/queries/${encodeURIComponent(queryId)}/answers/${encodeURIComponent(answerId)}`);
}

export async function reportQuery(queryId, payload = {}) {
  if (!queryId) throw new Error('queryId is required');
  const { category, description } = payload;
  const safeBody = { category, description };
  return apiClient.post(`/queries/${encodeURIComponent(queryId)}/report`, safeBody);
}

export async function reportAnswer(queryId, answerId, payload = {}) {
  if (!queryId) throw new Error('queryId is required');
  if (!answerId) throw new Error('answerId is required');
  const { category, description } = payload;
  const safeBody = { category, description };
  return apiClient.post(`/queries/${encodeURIComponent(queryId)}/answers/${encodeURIComponent(answerId)}/report`, safeBody);
}

export const queriesApi = {
  listQueries,
  getQuery,
  createQuery,
  editQuery,
  resolveQuery,
  deleteQuery,
  listAnswers,
  addAnswer,
  markAnswerHelpful,
  clearHelpfulAnswer,
  deleteAnswer,
  reportQuery,
  reportAnswer,
};

export default queriesApi;
