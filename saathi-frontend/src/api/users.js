/**
 * SAATHI Users & Blocking API Module
 * Phase 2G-4 Implementation
 *
 * Implements server-authoritative member blocking and blocked user list retrieval:
 * - blockUser(targetUserId) -> POST /users/block
 * - listBlockedUsers()      -> GET /users/blocked
 *
 * Server authority:
 * - Actor is strictly derived from Bearer token in session.
 * - Client-supplied actor fields are stripped / never sent.
 * - No unblock function is implemented per Phase 2G-4 contract.
 */

import { apiClient } from './client.js';

/**
 * Block a target member.
 * @param {string} targetUserId - The UUID of the member to block.
 * @returns {Promise<{ status: string, target_user_id: string }>}
 */
export async function blockUser(targetUserId) {
  if (!targetUserId) {
    throw new Error('targetUserId is required to block a member');
  }

  return await apiClient.post('/users/block', {
    target_user_id: targetUserId,
  });
}

/**
 * Retrieve the list of users blocked by the authenticated member.
 * @returns {Promise<Array<{ blocked_user_id: string, created_at: string }>>}
 */
export async function listBlockedUsers() {
  const response = await apiClient.get('/users/blocked');
  return Array.isArray(response) ? response : [];
}
