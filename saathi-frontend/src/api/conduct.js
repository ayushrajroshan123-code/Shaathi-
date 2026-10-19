/**
 * SAATHI Conduct & Safety Reports API Module
 * Phase 2G-4 Implementation
 *
 * Implements private system-level safety and conduct report submission:
 * - createConductReport(payload) -> POST /conduct-reports
 *
 * Server authority:
 * - Reporter identity (reported_by) is derived strictly from Bearer token in session.
 * - Client-supplied reported_by is stripped / never sent.
 * - context_type is strictly constrained to existing schema values ('coverage', 'resource', 'general').
 */

import { apiClient } from './client.js';

/**
 * Submit a private conduct / safety report to neighborhood coordinators.
 * @param {Object} payload
 * @param {string} payload.reported_against - UUID of user being reported
 * @param {string} payload.context_type - 'resource' | 'general' | 'coverage'
 * @param {string} [payload.context_id] - UUID of resource/context (null if general)
 * @param {string} payload.category - Report category (e.g. 'safety_concern')
 * @param {string} [payload.description] - Optional details
 * @param {Array} [payload.evidence] - Optional evidence array
 * @returns {Promise<Object>} Created conduct report object
 */
export async function createConductReport(payload = {}) {
  const {
    reported_against,
    context_type = 'general',
    context_id = null,
    category = 'safety_concern',
    description = null,
    evidence = [],
  } = payload;

  if (!reported_against) {
    throw new Error('reported_against is required to submit a safety report');
  }

  // Ensure context_type adheres to existing DB constraints ('coverage', 'resource', 'general')
  const validContextTypes = ['coverage', 'resource', 'general'];
  const safeContextType = validContextTypes.includes(context_type) ? context_type : 'general';

  const body = {
    reported_against,
    context_type: safeContextType,
    category,
    description: description || null,
    evidence: Array.isArray(evidence) ? evidence : [],
  };

  if (safeContextType !== 'general' && context_id) {
    body.context_id = context_id;
  }

  return await apiClient.post('/conduct-reports', body);
}
