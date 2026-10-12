/**
 * SAATHI Emergency/SOS Service Layer
 *
 * Implements server-side business logic for:
 *  - Emergency Alerts (v1 single-hub targeting, coordinator authority, issuer stamping)
 *  - Incidents (hub isolation, coordinator updates, priority override audit, helpers, resources)
 *  - SOS Events (actor attribution, authoritative hub derivation, linked incident validation)
 *  - Help Requests (requester attribution, hub derivation, coordinator matching, lifecycle transitions)
 *  - Notifications (recipient-scoped queries)
 *
 * Enforces:
 *  - Strict hub isolation on reads and writes
 *  - Server-authoritative actor context (actor.user_id, actor.hub_id, actor.role)
 *  - Anti-probing 404 NOT_FOUND for cross-hub entity lookups
 *  - Transactional consistency and row locking for multi-step mutations
 */

const { query, withTransaction } = require('../db');
const { ApiError } = require('../lib/errors');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ALERT_LEVELS = ['watch', 'warning', 'emergency'];
const ALLOWED_ALERT_SOURCES = ['coordinator', 'system'];
const ALLOWED_INCIDENT_SOURCES = ['SOS', 'alert', 'hazard_report'];
const ALLOWED_INCIDENT_STATUSES = ['OPEN', 'PRIORITIZED', 'COORDINATING', 'RESOLVED'];
const ALLOWED_PRIORITY_LEVELS = ['critical', 'high', 'medium', 'low'];
const ALLOWED_HELP_STATUSES = ['REQUESTED', 'MATCHED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'];
const ALLOWED_VULNERABLE_PEOPLE = ['elderly', 'child', 'injured', 'none'];

function assertActor(actor) {
  if (!actor || !actor.user_id) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'authenticated actor context with user_id and hub_id is required');
  }
}

/**
 * Resolves the authoritative actor context from the PostgreSQL `users` table.
 *
 * Prevents callers from claiming unauthorized coordinator authority or
 * cross-hub jurisdiction via stale or unverified in-memory actor objects.
 *
 * Requirements:
 * 1. Reject missing or invalid actor context with 401 UNAUTHENTICATED.
 * 2. Validate actor.user_id format (UUID).
 * 3. Query PostgreSQL users table for live user_id, hub_id, role, is_active, account_status.
 * 4. Reject nonexistent, inactive, or non-active accounts with 401 UNAUTHENTICATED.
 * 5. Return an authoritative context derived directly from the database:
 *    { user_id, hub_id, role }.
 *
 * SECURITY DISTINCTION:
 * Looking up a user by actor.user_id validates that user's current database
 * state, but does not, by itself, prove that an arbitrary service caller is
 * authenticated as that user. Over HTTP, authenticating the caller is enforced
 * by `loadActor` middleware using opaque bearer tokens in `sessions`. Production
 * routes remain strictly behind that authenticated context.
 */
async function resolveAuthoritativeActor(actor, client = null) {
  if (!actor || !actor.user_id) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'authenticated actor context with user_id and hub_id is required');
  }

  assertUuid(actor.user_id, 'actor.user_id');

  const db = client || { query };
  const { rows } = await db.query(
    `SELECT user_id, hub_id, role, is_active, account_status
     FROM users
     WHERE user_id = $1`,
    [actor.user_id]
  );

  const user = rows[0];
  if (!user) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'user not found');
  }

  if (!user.is_active || user.account_status !== 'active') {
    throw new ApiError(401, 'UNAUTHENTICATED', 'user account is inactive or suspended');
  }

  return {
    user_id: user.user_id,
    hub_id: user.hub_id,
    role: user.role,
  };
}

function assertUuid(value, name = 'id') {
  if (!value || typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${name} must be a valid UUID`);
  }
}

// ============================================================================
// PRIVACY SERIALIZERS & REPRESENTATION LAYERS
// ============================================================================

function serializeIncident(row, isAuthorized) {
  if (!row) return null;
  return {
    incident_id: row.incident_id,
    hub_id: row.hub_id,
    source: row.source,
    priority_score: row.priority_score,
    priority_level: row.priority_level,
    status: row.status,
    location: isAuthorized ? row.location : null,
    latitude: isAuthorized ? (row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null) : null,
    longitude: isAuthorized ? (row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null) : null,
    affected_people: row.affected_people,
    vulnerable_people: row.vulnerable_people,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
  };
}

function serializeSosEvent(row, isAuthorized) {
  if (!row) return null;
  return {
    sos_id: row.sos_id,
    hub_id: row.hub_id,
    triggered_by: row.triggered_by,
    incident_id: row.incident_id,
    location: isAuthorized ? row.location : null,
    latitude: isAuthorized ? (row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null) : null,
    longitude: isAuthorized ? (row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null) : null,
    battery_level: row.battery_level,
    timestamp: row.timestamp,
    accidental_protection_confirmed: row.accidental_protection_confirmed,
    offline_stored: row.offline_stored,
  };
}

function serializeHelpRequest(row, isAuthorized) {
  if (!row) return null;
  return {
    request_id: row.request_id,
    hub_id: row.hub_id,
    incident_id: row.incident_id,
    requested_by: row.requested_by,
    need_type: row.need_type,
    urgency: row.urgency,
    location: isAuthorized ? row.location : null,
    status: row.status,
    matched_helper_id: row.matched_helper_id,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
  };
}

function serializeEmergencyAlert(row) {
  if (!row) return null;
  return {
    alert_id: row.alert_id,
    hub_id: row.hub_id,
    issuer_id: row.issuer_id,
    level: row.level,
    source: row.source,
    affected_area: row.affected_area,
    issued_at: row.issued_at,
  };
}

// ============================================================================
// 1. EMERGENCY ALERTS
// ============================================================================

/**
 * Creates an emergency alert.
 * Locked Product Decision: Every alert targets exactly one explicit hub.
 * Only a coordinator authorized for that hub can issue an alert.
 * Issuer is stamped from actor.user_id; affected_area is descriptive only.
 */
async function createEmergencyAlert(actor, payload = {}) {
  const authActor = await resolveAuthoritativeActor(actor);

  if (authActor.role !== 'coordinator') {
    throw new ApiError(403, 'FORBIDDEN', 'only coordinators can issue emergency alerts');
  }

  const { level, source, affected_area, hub_id, target_hub_id } = payload;
  const targetHub = target_hub_id || hub_id || authActor.hub_id;

  assertUuid(targetHub, 'target_hub_id');

  if (targetHub !== authActor.hub_id) {
    throw new ApiError(403, 'FORBIDDEN', 'coordinator not authorized for target hub');
  }

  if (!level || !ALLOWED_ALERT_LEVELS.includes(level)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `level must be one of: ${ALLOWED_ALERT_LEVELS.join(', ')}`);
  }

  if (!source || !ALLOWED_ALERT_SOURCES.includes(source)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `source must be one of: ${ALLOWED_ALERT_SOURCES.join(', ')}`);
  }

  if (!affected_area || typeof affected_area !== 'string' || affected_area.trim().length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'affected_area is required and must be non-empty');
  }

  const { rows } = await query(
    `INSERT INTO emergency_alerts (hub_id, issuer_id, level, source, affected_area)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING alert_id, hub_id, issuer_id, level, source, affected_area, issued_at`,
    [targetHub, authActor.user_id, level, source, affected_area.trim()]
  );

  return serializeEmergencyAlert(rows[0]);
}

async function getEmergencyAlert(actor, alertId) {
  const authActor = await resolveAuthoritativeActor(actor);
  assertUuid(alertId, 'alert_id');

  const { rows } = await query(
    `SELECT * FROM emergency_alerts WHERE alert_id = $1 AND hub_id = $2`,
    [alertId, authActor.hub_id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'alert not found');
  }

  return serializeEmergencyAlert(rows[0]);
}

async function listEmergencyAlerts(actor) {
  const authActor = await resolveAuthoritativeActor(actor);

  const { rows } = await query(
    `SELECT * FROM emergency_alerts WHERE hub_id = $1 ORDER BY issued_at DESC`,
    [authActor.hub_id]
  );

  return rows.map(serializeEmergencyAlert);
}

// ============================================================================
// 2. INCIDENTS
// ============================================================================

async function createIncident(actor, payload = {}) {
  const authActor = await resolveAuthoritativeActor(actor);

  const {
    source,
    location,
    latitude,
    longitude,
    affected_people,
    vulnerable_people,
  } = payload;

  if (!source || !ALLOWED_INCIDENT_SOURCES.includes(source)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `source must be one of: ${ALLOWED_INCIDENT_SOURCES.join(', ')}`);
  }

  if (!location || typeof location !== 'string' || location.trim().length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'location is required and must be non-empty');
  }

  if (vulnerable_people && !ALLOWED_VULNERABLE_PEOPLE.includes(vulnerable_people)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `vulnerable_people must be one of: ${ALLOWED_VULNERABLE_PEOPLE.join(', ')}`);
  }

  let lat = null;
  let lon = null;
  if (latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null) {
    lat = Number(latitude);
    lon = Number(longitude);
    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lon) || lon < -180 || lon > 180) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'latitude must be between -90 and 90, and longitude between -180 and 180');
    }
  } else if ((latitude !== undefined && latitude !== null) || (longitude !== undefined && longitude !== null)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'both latitude and longitude must be provided together');
  }

  let affectedCount = 0;
  if (affected_people !== undefined && affected_people !== null) {
    affectedCount = parseInt(affected_people, 10);
    if (isNaN(affectedCount) || affectedCount < 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'affected_people must be a non-negative integer');
    }
  }

  const { rows } = await query(
    `INSERT INTO incidents (hub_id, source, location, latitude, longitude, affected_people, vulnerable_people)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [authActor.hub_id, source, location.trim(), lat, lon, affectedCount, vulnerable_people || 'none']
  );

  const isAuthorized = authActor.role === 'coordinator';
  return serializeIncident(rows[0], isAuthorized);
}

async function getIncident(actor, incidentId) {
  const authActor = await resolveAuthoritativeActor(actor);
  assertUuid(incidentId, 'incident_id');

  const { rows } = await query(
    `SELECT * FROM incidents WHERE incident_id = $1 AND hub_id = $2`,
    [incidentId, authActor.hub_id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'incident not found');
  }

  const incident = rows[0];
  let isAuthorized = false;

  if (authActor.role === 'coordinator') {
    isAuthorized = true;
  } else if (incident.status !== 'RESOLVED') {
    const { rows: helperRows } = await query(
      `SELECT 1 FROM incident_helpers WHERE incident_id = $1 AND user_id = $2`,
      [incidentId, authActor.user_id]
    );
    if (helperRows.length > 0) {
      isAuthorized = true;
    }
  }

  return serializeIncident(incident, isAuthorized);
}

async function listIncidents(actor, filters = {}) {
  const authActor = await resolveAuthoritativeActor(actor);

  let sql = 'SELECT * FROM incidents WHERE hub_id = $1';
  const params = [authActor.hub_id];

  if (filters.status) {
    if (!ALLOWED_INCIDENT_STATUSES.includes(filters.status)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `status must be one of: ${ALLOWED_INCIDENT_STATUSES.join(', ')}`);
    }
    sql += ' AND status = $2';
    params.push(filters.status);
  }

  sql += ' ORDER BY created_at DESC';

  const { rows } = await query(sql, params);

  if (authActor.role === 'coordinator') {
    return rows.map((inc) => serializeIncident(inc, true));
  }

  const { rows: helperRows } = await query(
    `SELECT incident_id FROM incident_helpers WHERE user_id = $1`,
    [authActor.user_id]
  );
  const assignedSet = new Set(helperRows.map((r) => r.incident_id));

  return rows.map((inc) => {
    const isAuthorized = assignedSet.has(inc.incident_id) && inc.status !== 'RESOLVED';
    return serializeIncident(inc, isAuthorized);
  });
}

async function updateIncident(actor, incidentId, payload = {}) {
  const authActor = await resolveAuthoritativeActor(actor);

  if (authActor.role !== 'coordinator') {
    throw new ApiError(403, 'FORBIDDEN', 'only coordinators can update incident status or priority');
  }

  assertUuid(incidentId, 'incident_id');

  const { status, priority_score, priority_level, reason } = payload;

  return withTransaction(async (client) => {
    const { rows: existingRows } = await client.query(
      `SELECT * FROM incidents WHERE incident_id = $1 AND hub_id = $2 FOR UPDATE`,
      [incidentId, authActor.hub_id]
    );

    if (existingRows.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'incident not found');
    }

    const existing = existingRows[0];

    // Status transition validation
    if (status && status !== existing.status) {
      if (!ALLOWED_INCIDENT_STATUSES.includes(status)) {
        throw new ApiError(400, 'VALIDATION_ERROR', `status must be one of: ${ALLOWED_INCIDENT_STATUSES.join(', ')}`);
      }

      if (existing.status === 'RESOLVED') {
        throw new ApiError(409, 'INVALID_STATE', 'cannot modify a resolved incident');
      }

      const validTransitions = {
        OPEN: ['PRIORITIZED', 'COORDINATING', 'RESOLVED'],
        PRIORITIZED: ['COORDINATING', 'RESOLVED'],
        COORDINATING: ['RESOLVED'],
      };

      const allowedNext = validTransitions[existing.status] || [];
      if (!allowedNext.includes(status)) {
        throw new ApiError(400, 'VALIDATION_ERROR', `invalid status transition from ${existing.status} to ${status}`);
      }
    }

    // Priority level override validation and logging
    if (priority_level && priority_level !== existing.priority_level) {
      if (!ALLOWED_PRIORITY_LEVELS.includes(priority_level)) {
        throw new ApiError(400, 'VALIDATION_ERROR', `priority_level must be one of: ${ALLOWED_PRIORITY_LEVELS.join(', ')}`);
      }

      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'reason is required when overriding priority_level');
      }

      await client.query(
        `INSERT INTO priority_overrides
           (incident_id, coordinator_id, previous_score, new_score, previous_level, new_level, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          incidentId,
          authActor.user_id,
          existing.priority_score,
          priority_score !== undefined ? priority_score : existing.priority_score,
          existing.priority_level,
          priority_level,
          reason.trim(),
        ]
      );
    }

    const { rows: updatedRows } = await client.query(
      `UPDATE incidents SET
         status = COALESCE($2, status),
         priority_score = COALESCE($3, priority_score),
         priority_level = COALESCE($4, priority_level),
         resolved_at = CASE WHEN $2 = 'RESOLVED' THEN now() ELSE resolved_at END
       WHERE incident_id = $1 AND hub_id = $5
       RETURNING *`,
      [incidentId, status || null, priority_score ?? null, priority_level || null, authActor.hub_id]
    );

    return serializeIncident(updatedRows[0], true);
  });
}

async function addIncidentHelper(actor, incidentId, payload = {}) {
  const authActor = await resolveAuthoritativeActor(actor);
  assertUuid(incidentId, 'incident_id');

  const { user_id } = payload;
  assertUuid(user_id, 'user_id');

  return withTransaction(async (client) => {
    const { rows: incidentRows } = await client.query(
      `SELECT hub_id FROM incidents WHERE incident_id = $1 AND hub_id = $2 FOR UPDATE`,
      [incidentId, authActor.hub_id]
    );

    if (incidentRows.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'incident not found');
    }

    const { rows: userRows } = await client.query(
      `SELECT user_id, hub_id FROM users WHERE user_id = $1`,
      [user_id]
    );

    if (userRows.length === 0 || userRows[0].hub_id !== authActor.hub_id) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'helper must belong to the same hub as the incident');
    }

    const { rows } = await client.query(
      `INSERT INTO incident_helpers (incident_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [incidentId, user_id]
    );

    return rows[0] || { incident_id: incidentId, user_id, already_assigned: true };
  });
}

async function addIncidentResource(actor, incidentId, payload = {}) {
  const authActor = await resolveAuthoritativeActor(actor);

  if (authActor.role !== 'coordinator') {
    throw new ApiError(403, 'FORBIDDEN', 'only coordinators can deploy incident resources');
  }

  assertUuid(incidentId, 'incident_id');

  const { resource_id } = payload;
  assertUuid(resource_id, 'resource_id');

  return withTransaction(async (client) => {
    const { rows: incidentRows } = await client.query(
      `SELECT hub_id FROM incidents WHERE incident_id = $1 AND hub_id = $2 FOR UPDATE`,
      [incidentId, authActor.hub_id]
    );

    if (incidentRows.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'incident not found');
    }

    const { rows: resRows } = await client.query(
      `SELECT r.resource_id, u.hub_id
       FROM resource_inventory r
       JOIN users u ON r.owner_id = u.user_id
       WHERE r.resource_id = $1`,
      [resource_id]
    );

    if (resRows.length === 0 || resRows[0].hub_id !== authActor.hub_id) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'resource owner must belong to the same hub as the incident');
    }

    const { rows } = await client.query(
      `INSERT INTO incident_resources (incident_id, resource_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [incidentId, resource_id]
    );

    return rows[0] || { incident_id: incidentId, resource_id, already_deployed: true };
  });
}

// ============================================================================
// 3. SOS EVENTS
// ============================================================================

async function createSosEvent(actor, payload = {}) {
  const authActor = await resolveAuthoritativeActor(actor);

  const {
    location,
    latitude,
    longitude,
    battery_level,
    accidental_protection_confirmed,
    offline_stored,
    incident_id,
  } = payload;

  if (!location || typeof location !== 'string' || location.trim().length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'location is required and must be non-empty');
  }

  let lat = null;
  let lon = null;
  if (latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null) {
    lat = Number(latitude);
    lon = Number(longitude);
    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lon) || lon < -180 || lon > 180) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'latitude must be between -90 and 90, and longitude between -180 and 180');
    }
  }

  let battery = null;
  if (battery_level !== undefined && battery_level !== null) {
    battery = parseInt(battery_level, 10);
    if (isNaN(battery) || battery < 0 || battery > 100) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'battery_level must be between 0 and 100');
    }
  }

  return withTransaction(async (client) => {
    if (incident_id) {
      assertUuid(incident_id, 'incident_id');
      const { rows: incRows } = await client.query(
        `SELECT hub_id FROM incidents WHERE incident_id = $1 AND hub_id = $2`,
        [incident_id, authActor.hub_id]
      );
      if (incRows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'linked incident not found in actor hub');
      }
    }

    const { rows } = await client.query(
      `INSERT INTO sos_events
         (hub_id, triggered_by, incident_id, location, latitude, longitude, battery_level, accidental_protection_confirmed, offline_stored)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, FALSE), COALESCE($9, FALSE))
       RETURNING *`,
      [
        authActor.hub_id,
        authActor.user_id,
        incident_id || null,
        location.trim(),
        lat,
        lon,
        battery,
        accidental_protection_confirmed || false,
        offline_stored || false,
      ]
    );

    const isAuthorized = authActor.role === 'coordinator' || authActor.user_id === rows[0].triggered_by;
    return serializeSosEvent(rows[0], isAuthorized);
  });
}

async function getSosEvent(actor, sosId) {
  const authActor = await resolveAuthoritativeActor(actor);
  assertUuid(sosId, 'sos_id');

  const { rows } = await query(
    `SELECT * FROM sos_events WHERE sos_id = $1 AND hub_id = $2`,
    [sosId, authActor.hub_id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'sos event not found');
  }

  const existing = rows[0];
  const isAuthorized = authActor.role === 'coordinator' || authActor.user_id === existing.triggered_by;
  return serializeSosEvent(existing, isAuthorized);
}

async function listSosEvents(actor) {
  const authActor = await resolveAuthoritativeActor(actor);

  const { rows } = await query(
    `SELECT * FROM sos_events WHERE hub_id = $1 ORDER BY timestamp DESC`,
    [authActor.hub_id]
  );

  return rows.map((s) => {
    const isAuthorized = authActor.role === 'coordinator' || authActor.user_id === s.triggered_by;
    return serializeSosEvent(s, isAuthorized);
  });
}

// ============================================================================
// 4. HELP REQUESTS
// ============================================================================

async function createHelpRequest(actor, payload = {}) {
  const authActor = await resolveAuthoritativeActor(actor);

  const { incident_id, need_type, urgency, location } = payload;

  assertUuid(incident_id, 'incident_id');

  if (!need_type || typeof need_type !== 'string' || need_type.trim().length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'need_type is required and must be non-empty');
  }

  if (!urgency || !ALLOWED_PRIORITY_LEVELS.includes(urgency)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `urgency must be one of: ${ALLOWED_PRIORITY_LEVELS.join(', ')}`);
  }

  if (!location || typeof location !== 'string' || location.trim().length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'location is required and must be non-empty');
  }

  return withTransaction(async (client) => {
    const { rows: incRows } = await client.query(
      `SELECT hub_id FROM incidents WHERE incident_id = $1 AND hub_id = $2`,
      [incident_id, authActor.hub_id]
    );

    if (incRows.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'incident not found in actor hub');
    }

    const { rows } = await client.query(
      `INSERT INTO help_requests (hub_id, incident_id, requested_by, need_type, urgency, location)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [authActor.hub_id, incident_id, authActor.user_id, need_type.trim(), urgency, location.trim()]
    );

    const isAuthorized = authActor.role === 'coordinator' || authActor.user_id === rows[0].requested_by;
    return serializeHelpRequest(rows[0], isAuthorized);
  });
}

async function getHelpRequest(actor, requestId) {
  const authActor = await resolveAuthoritativeActor(actor);
  assertUuid(requestId, 'request_id');

  const { rows } = await query(
    `SELECT * FROM help_requests WHERE request_id = $1 AND hub_id = $2`,
    [requestId, authActor.hub_id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'help request not found');
  }

  const existing = rows[0];
  const isCoordinator = authActor.role === 'coordinator';
  const isRequester = authActor.user_id === existing.requested_by;
  const isMatchedHelperActive = authActor.user_id === existing.matched_helper_id &&
    existing.status !== 'RESOLVED' &&
    existing.status !== 'CANCELLED';

  const isAuthorized = isCoordinator || isRequester || isMatchedHelperActive;
  return serializeHelpRequest(existing, isAuthorized);
}

async function listHelpRequests(actor, filters = {}) {
  const authActor = await resolveAuthoritativeActor(actor);

  let sql = 'SELECT * FROM help_requests WHERE hub_id = $1';
  const params = [authActor.hub_id];

  if (filters.incident_id) {
    assertUuid(filters.incident_id, 'incident_id');
    sql += ' AND incident_id = $' + (params.length + 1);
    params.push(filters.incident_id);
  }

  if (filters.status) {
    if (!ALLOWED_HELP_STATUSES.includes(filters.status)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `status must be one of: ${ALLOWED_HELP_STATUSES.join(', ')}`);
    }
    sql += ' AND status = $' + (params.length + 1);
    params.push(filters.status);
  }

  sql += ' ORDER BY created_at DESC';

  const { rows } = await query(sql, params);

  return rows.map((r) => {
    const isCoordinator = authActor.role === 'coordinator';
    const isRequester = authActor.user_id === r.requested_by;
    const isMatchedHelperActive = authActor.user_id === r.matched_helper_id &&
      r.status !== 'RESOLVED' &&
      r.status !== 'CANCELLED';

    const isAuthorized = isCoordinator || isRequester || isMatchedHelperActive;
    return serializeHelpRequest(r, isAuthorized);
  });
}

async function matchHelpRequest(actor, requestId, payload = {}) {
  const authActor = await resolveAuthoritativeActor(actor);

  if (authActor.role !== 'coordinator') {
    throw new ApiError(403, 'FORBIDDEN', 'only coordinators can match help requests');
  }

  assertUuid(requestId, 'request_id');

  const { matched_helper_id } = payload;
  assertUuid(matched_helper_id, 'matched_helper_id');

  return withTransaction(async (client) => {
    const { rows: reqRows } = await client.query(
      `SELECT * FROM help_requests WHERE request_id = $1 AND hub_id = $2 FOR UPDATE`,
      [requestId, authActor.hub_id]
    );

    if (reqRows.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'help request not found');
    }

    const existing = reqRows[0];
    if (existing.status === 'RESOLVED' || existing.status === 'CANCELLED') {
      throw new ApiError(409, 'INVALID_STATE', 'cannot match a resolved or cancelled request');
    }

    const { rows: helperRows } = await client.query(
      `SELECT user_id, hub_id FROM users WHERE user_id = $1`,
      [matched_helper_id]
    );

    if (helperRows.length === 0 || helperRows[0].hub_id !== authActor.hub_id) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'matched helper must belong to the same hub');
    }

    const { rows } = await client.query(
      `UPDATE help_requests
       SET status = 'MATCHED', matched_helper_id = $2
       WHERE request_id = $1 AND hub_id = $3
       RETURNING *`,
      [requestId, matched_helper_id, authActor.hub_id]
    );

    return serializeHelpRequest(rows[0], true);
  });
}

async function updateHelpRequestStatus(actor, requestId, payload = {}) {
  const authActor = await resolveAuthoritativeActor(actor);
  assertUuid(requestId, 'request_id');

  const { status } = payload;
  if (!status || !ALLOWED_HELP_STATUSES.includes(status)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `status must be one of: ${ALLOWED_HELP_STATUSES.join(', ')}`);
  }

  return withTransaction(async (client) => {
    const { rows: reqRows } = await client.query(
      `SELECT * FROM help_requests WHERE request_id = $1 AND hub_id = $2 FOR UPDATE`,
      [requestId, authActor.hub_id]
    );

    if (reqRows.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'help request not found');
    }

    const existing = reqRows[0];

    // Authorization: Requester, Matched Helper, or Coordinator
    const isRequester = existing.requested_by === authActor.user_id;
    const isHelper = existing.matched_helper_id === authActor.user_id;
    const isCoordinator = authActor.role === 'coordinator';

    if (!isRequester && !isHelper && !isCoordinator) {
      throw new ApiError(403, 'FORBIDDEN', 'not authorized to update this help request');
    }

    if (existing.status === 'RESOLVED' || existing.status === 'CANCELLED') {
      throw new ApiError(409, 'INVALID_STATE', 'cannot modify a resolved or cancelled help request');
    }

    // State machine check
    let allowed = false;
    if (existing.status === 'REQUESTED') {
      // Cancellation allowed by requester or coordinator
      if (status === 'CANCELLED' && (isRequester || isCoordinator)) allowed = true;
    } else if (existing.status === 'MATCHED') {
      // In progress allowed by helper or coordinator
      if (status === 'IN_PROGRESS' && (isHelper || isCoordinator)) allowed = true;
      if (status === 'CANCELLED' && (isRequester || isCoordinator)) allowed = true;
    } else if (existing.status === 'IN_PROGRESS') {
      // Resolution allowed by requester or coordinator
      if (status === 'RESOLVED' && (isRequester || isCoordinator)) allowed = true;
      if (status === 'CANCELLED' && (isRequester || isCoordinator)) allowed = true;
    }

    if (!allowed) {
      throw new ApiError(400, 'VALIDATION_ERROR', `invalid transition from ${existing.status} to ${status}`);
    }

    const { rows } = await client.query(
      `UPDATE help_requests
       SET status = $2,
           resolved_at = CASE WHEN $2 = 'RESOLVED' THEN now() ELSE resolved_at END
       WHERE request_id = $1 AND hub_id = $3
       RETURNING *`,
      [requestId, status, authActor.hub_id]
    );

    const updated = rows[0];
    const isMatchedHelperActive = authActor.user_id === updated.matched_helper_id &&
      updated.status !== 'RESOLVED' &&
      updated.status !== 'CANCELLED';

    const isAuthorized = isCoordinator || isRequester || isMatchedHelperActive;
    return serializeHelpRequest(updated, isAuthorized);
  });
}

// ============================================================================
// 5. NOTIFICATIONS
// ============================================================================

async function listNotifications(actor) {
  const authActor = await resolveAuthoritativeActor(actor);

  const { rows } = await query(
    `SELECT * FROM notifications WHERE recipient_id = $1 ORDER BY sent_at DESC NULLS FIRST`,
    [authActor.user_id]
  );

  return rows;
}

module.exports = {
  // Authoritative actor resolution & asserts
  assertActor,
  resolveAuthoritativeActor,
  // Serializers
  serializeIncident,
  serializeSosEvent,
  serializeHelpRequest,
  serializeEmergencyAlert,
  // Alerts
  createEmergencyAlert,
  getEmergencyAlert,
  listEmergencyAlerts,
  // Incidents
  createIncident,
  getIncident,
  listIncidents,
  updateIncident,
  addIncidentHelper,
  addIncidentResource,
  // SOS
  createSosEvent,
  getSosEvent,
  listSosEvents,
  // Help Requests
  createHelpRequest,
  getHelpRequest,
  listHelpRequests,
  matchHelpRequest,
  updateHelpRequestStatus,
  // Notifications
  listNotifications,
};
