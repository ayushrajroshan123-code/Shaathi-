/**
 * SAATHI Coordinations, Returns & Messaging API Module
 * Phase 2G-3 Implementation
 *
 * Ground rules:
 * 1. Uses canonical apiClient from src/api/client.js only.
 * 2. Server-authoritative: client identity is derived solely by backend via Bearer session token.
 * 3. Never send sender_id, actor_id, user_id, hub_id, counterpart_id, or state in client payloads.
 * 4. Respects server-enforced state machine transitions:
 *    - APPROVED -> SCHEDULED | CANCELLED
 *    - SCHEDULED -> HANDOFF_READY | CANCELLED
 *    - HANDOFF_READY -> HANDED_OVER | CANCELLED
 *    - HANDED_OVER -> IN_USE
 *    - IN_USE -> RETURN_DUE
 *    - RETURN_PENDING via POST /coordinations/:id/return/initiate (Borrower only)
 *    - COMPLETED via POST /coordinations/:id/return/confirm (Owner only)
 * 5. Supported tabs: ACTIVE, UPCOMING, RETURNS, COMPLETED, SAFETY.
 * 6. Normalized error format: { error, message, status }.
 */

import { apiClient } from './client.js';

export const VALID_COORDINATION_TABS = [
  'ACTIVE',
  'UPCOMING',
  'RETURNS',
  'COMPLETED',
  'SAFETY',
];

/**
 * List personal coordinations filtered by server-supported tab.
 * Endpoint: GET /coordinations?tab=:tab
 *
 * @param {string} [tab='ACTIVE'] - One of ACTIVE, UPCOMING, RETURNS, COMPLETED, SAFETY
 * @returns {Promise<Array<Object>>}
 */
export async function listCoordinations(tab = 'ACTIVE') {
  const normalizedTab = (tab || 'ACTIVE').toUpperCase();
  if (!VALID_COORDINATION_TABS.includes(normalizedTab)) {
    throw new Error(`Invalid tab '${tab}'. Supported tabs: ${VALID_COORDINATION_TABS.join(', ')}`);
  }
  return apiClient.get(`/coordinations?tab=${encodeURIComponent(normalizedTab)}`);
}

/**
 * Get authoritative detail of a coordination, including events and messages.
 * Endpoint: GET /coordinations/:id
 *
 * @param {string} coordinationId
 * @returns {Promise<Object>}
 */
export async function getCoordination(coordinationId) {
  if (!coordinationId) {
    throw new Error('coordinationId is required');
  }
  return apiClient.get(`/coordinations/${encodeURIComponent(coordinationId)}`);
}

/**
 * Request a valid lifecycle transition on a coordination.
 * Endpoint: POST /coordinations/:id/transition
 *
 * Server-authoritative: Only server-approved transitions occur.
 * Returns 409 INVALID_STATE on concurrent mutations or illegal transitions.
 * Returns 400 for RETURN_PENDING or COMPLETED (which have dedicated endpoints).
 *
 * @param {string} coordinationId
 * @param {string} toState
 * @param {string} [note]
 * @returns {Promise<Object>}
 */
export async function transitionCoordination(coordinationId, toState, note = null) {
  if (!coordinationId) {
    throw new Error('coordinationId is required');
  }

  const payload = {
    to_state: toState,
    ...(note ? { note } : {}),
  };

  return apiClient.post(`/coordinations/${encodeURIComponent(coordinationId)}/transition`, payload);
}

/**
 * Borrower initiates return of the borrowed resource.
 * Endpoint: POST /coordinations/:id/return/initiate
 *
 * Authoritative: strictly the borrower can call this.
 * Transitions state to RETURN_PENDING.
 *
 * @param {string} coordinationId
 * @returns {Promise<Object>}
 */
export async function initiateReturn(coordinationId) {
  if (!coordinationId) {
    throw new Error('coordinationId is required');
  }
  return apiClient.post(`/coordinations/${encodeURIComponent(coordinationId)}/return/initiate`, {});
}

/**
 * Resource owner confirms physical receipt of the returned resource.
 * Endpoint: POST /coordinations/:id/return/confirm
 *
 * Authoritative: strictly the resource owner can call this.
 * Transitions state to COMPLETED and restores resource availability.
 *
 * @param {string} coordinationId
 * @returns {Promise<Object>}
 */
export async function confirmReturn(coordinationId) {
  if (!coordinationId) {
    throw new Error('coordinationId is required');
  }
  return apiClient.post(`/coordinations/${encodeURIComponent(coordinationId)}/return/confirm`, {});
}

/**
 * Retrieve message thread for an active coordination.
 * Endpoint: GET /coordinations/:id/messages
 *
 * Authorized participants/coordinators only.
 *
 * @param {string} coordinationId
 * @returns {Promise<Array<Object>>}
 */
export async function listCoordinationMessages(coordinationId) {
  if (!coordinationId) {
    throw new Error('coordinationId is required');
  }
  return apiClient.get(`/coordinations/${encodeURIComponent(coordinationId)}/messages`);
}

/**
 * Post an operational coordination note to an active coordination thread.
 * Endpoint: POST /coordinations/:id/messages
 *
 * Privacy / Security:
 * SENDER IDENTITY DERIVED FROM SESSION.
 * Never allows client to supply sender_id, user_id, actor_id, or hub_id.
 * Rejects with 409 if coordination is COMPLETED or BLOCKED.
 * Rejects with 403 if participants are blocked.
 *
 * @param {string} coordinationId
 * @param {string|Object} message - Message text or payload object with text property
 * @param {string} [messageType='coordination_note']
 * @returns {Promise<Object>}
 */
export async function sendCoordinationMessage(coordinationId, message, messageType = 'coordination_note') {
  if (!coordinationId) {
    throw new Error('coordinationId is required');
  }

  let text = '';
  let resolvedType = messageType || 'coordination_note';

  if (typeof message === 'string') {
    text = message;
  } else if (message && typeof message === 'object') {
    text = message.text || message.body || '';
    if (message.message_type) {
      resolvedType = message.message_type;
    } else if (message.messageType) {
      resolvedType = message.messageType;
    }
  }

  // Strictly sanitized body — never send sender_id, user_id, actor_id, hub_id
  const payload = {
    text,
    message_type: resolvedType,
  };

  return apiClient.post(`/coordinations/${encodeURIComponent(coordinationId)}/messages`, payload);
}
