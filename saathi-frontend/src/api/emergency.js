/**
 * SAATHI Emergency & SOS API Module
 * Phase 2H Unit 5 Step 1B Implementation
 *
 * Ground rules:
 * 1. Uses canonical apiClient from src/api/client.js only.
 * 2. Server-authoritative: actor identity and hub_id are derived solely by backend via Bearer token.
 * 3. Never send hub_id, issuer_id, user_id, or client-asserted roles.
 * 4. Preserves standard ApiError behavior on HTTP 404 (when ENABLE_EMERGENCY_ROUTES is false)
 *    without swallowing errors, faking success, or injecting mock fallback data.
 * 5. SOS request contract strictly excludes need_type (which belongs to help requests).
 * 6. Exposes only verified and registered route operations.
 */

import { apiClient } from './client.js';

/**
 * List incidents in the authenticated actor's hub.
 * Endpoint: GET /incidents
 *
 * @param {Object} [params]
 * @param {string} [params.status] - Optional filter by status ('OPEN' | 'PRIORITIZED' | 'COORDINATING' | 'RESOLVED')
 * @returns {Promise<Array<Object>>}
 */
export async function listIncidents(params = {}) {
  let path = '/incidents';
  if (params && params.status) {
    path += `?status=${encodeURIComponent(params.status)}`;
  }
  return apiClient.get(path);
}

/**
 * Get details for a specific incident in the authenticated actor's hub.
 * Location/GPS coordinates are redacted by the backend for unauthorized viewers.
 * Endpoint: GET /incidents/:id
 *
 * @param {string} incidentId - UUID of the incident
 * @returns {Promise<Object>}
 */
export async function getIncident(incidentId) {
  if (!incidentId) {
    throw new Error('incidentId is required');
  }
  return apiClient.get(`/incidents/${encodeURIComponent(incidentId)}`);
}

/**
 * Create a new emergency incident.
 * Endpoint: POST /incidents
 *
 * Verified request fields:
 * - source: required enum ('SOS' | 'alert' | 'hazard_report')
 * - location: required non-empty string
 * - affected_people: optional non-negative integer
 * - vulnerable_people: optional enum ('elderly' | 'child' | 'injured' | 'none')
 * - latitude, longitude: optional coordinate pair
 *
 * @param {Object} payload
 * @param {string} payload.source
 * @param {string} payload.location
 * @param {number} [payload.affected_people]
 * @param {string} [payload.vulnerable_people]
 * @param {number} [payload.latitude]
 * @param {number} [payload.longitude]
 * @returns {Promise<Object>}
 */
export async function createIncident(payload = {}) {
  const {
    source,
    location,
    affected_people,
    vulnerable_people,
    latitude,
    longitude,
  } = payload;

  const safeBody = {
    source,
    location,
    ...(affected_people !== undefined && { affected_people }),
    ...(vulnerable_people !== undefined && { vulnerable_people }),
    ...(latitude !== undefined && { latitude }),
    ...(longitude !== undefined && { longitude }),
  };

  return apiClient.post('/incidents', safeBody);
}

/**
 * Trigger an emergency SOS event.
 * Endpoint: POST /sos-events
 *
 * Verified request fields:
 * - location: required non-empty string
 * - latitude, longitude: optional coordinate pair
 * - battery_level: optional integer (0 to 100)
 * - accidental_protection_confirmed: optional boolean
 * - offline_stored: optional boolean
 * - incident_id: optional UUID
 *
 * NOTE: need_type is NOT accepted by /sos-events and is strictly excluded.
 *
 * @param {Object} payload
 * @param {string} payload.location
 * @param {number} [payload.latitude]
 * @param {number} [payload.longitude]
 * @param {number} [payload.battery_level]
 * @param {boolean} [payload.accidental_protection_confirmed]
 * @param {boolean} [payload.offline_stored]
 * @param {string} [payload.incident_id]
 * @returns {Promise<Object>}
 */
export async function createSosEvent(payload = {}) {
  const {
    location,
    latitude,
    longitude,
    battery_level,
    accidental_protection_confirmed,
    offline_stored,
    incident_id,
  } = payload;

  const safeBody = {
    location,
    ...(latitude !== undefined && { latitude }),
    ...(longitude !== undefined && { longitude }),
    ...(battery_level !== undefined && { battery_level }),
    ...(accidental_protection_confirmed !== undefined && { accidental_protection_confirmed }),
    ...(offline_stored !== undefined && { offline_stored }),
    ...(incident_id !== undefined && { incident_id }),
  };

  return apiClient.post('/sos-events', safeBody);
}

/**
 * List broadcast notifications for the authenticated user.
 * Endpoint: GET /notifications
 *
 * @returns {Promise<Array<Object>>}
 */
export async function listNotifications() {
  return apiClient.get('/notifications');
}
