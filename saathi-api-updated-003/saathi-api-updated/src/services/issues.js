/**
 * SAATHI Neighborhood Issues Service
 * Backend API for public infrastructure & neighborhood condition reporting.
 *
 * Enforces:
 *  - Hub isolation
 *  - Server-authoritative actor context (req.actor)
 *  - Strict privacy projections (reported_by omitted except for original reporter on detail/create)
 *  - Ignore client position_3d coordinates (persist empty object {})
 *  - Immutable field protection on edit
 *  - Approved status transition matrix & actor authority rules
 *  - Atomic conditional updates for concurrency safety
 */

const { query, withTransaction } = require('../db');
const { ApiError } = require('../lib/errors');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_CATEGORIES = ['infrastructure', 'safety', 'gardening', 'cleanliness'];
const ALLOWED_SEVERITIES = ['low', 'medium', 'high'];
const ALLOWED_STATUSES = ['reported', 'attention_needed', 'in_progress', 'parts_ordered', 'resolved'];
const IMMUTABLE_FIELDS = ['issue_id', 'hub_id', 'reported_by', 'status', 'created_at', 'position_3d'];

/**
 * Single issue projection:
 * Includes reported_by ONLY if caller is the original reporter.
 */
function serializeNeighborhoodIssue(issue, actorUserId) {
  const isReporter = issue.reported_by === actorUserId;
  const result = {
    issue_id: issue.issue_id,
    hub_id: issue.hub_id,
    title: issue.title,
    category: issue.category,
    severity: issue.severity,
    general_location: issue.general_location,
    status: issue.status,
    detail: issue.detail || null,
    position_3d: issue.position_3d || {},
    created_at: issue.created_at,
  };
  if (isReporter) {
    result.reported_by = issue.reported_by;
  }
  return result;
}

/**
 * List issue projection:
 * NEVER exposes reported_by under any circumstances.
 */
function serializeNeighborhoodIssueList(issue) {
  return {
    issue_id: issue.issue_id,
    hub_id: issue.hub_id,
    title: issue.title,
    category: issue.category,
    severity: issue.severity,
    general_location: issue.general_location,
    status: issue.status,
    detail: issue.detail || null,
    position_3d: issue.position_3d || {},
    created_at: issue.created_at,
  };
}

/**
 * List public neighborhood issues in the authenticated actor's hub.
 */
async function listIssues({ hubId, statusFilter = null }) {
  if (!hubId) throw new ApiError(400, 'VALIDATION_ERROR', 'hub_id is required');

  let whereClause = 'WHERE hub_id = $1';
  const params = [hubId];

  const rawFilter = typeof statusFilter === 'string' ? statusFilter.trim().toLowerCase() : null;

  if (!rawFilter || rawFilter === 'active') {
    whereClause += " AND status <> 'resolved'";
  } else if (rawFilter === 'all') {
    // No status filter restriction; return all statuses in hub
  } else if (rawFilter === 'resolved') {
    whereClause += " AND status = 'resolved'";
  } else if (ALLOWED_STATUSES.includes(rawFilter)) {
    params.push(rawFilter);
    whereClause += ` AND status = $${params.length}`;
  } else {
    throw new ApiError(400, 'VALIDATION_ERROR', `unsupported status filter: '${statusFilter}'`);
  }

  const sql = `
    SELECT *
    FROM neighborhood_issues
    ${whereClause}
    ORDER BY created_at DESC, issue_id DESC
  `;

  const { rows } = await query(sql, params);
  return rows.map(serializeNeighborhoodIssueList);
}

/**
 * Create a new neighborhood issue.
 */
async function createIssue({ actor, title, category, severity, general_location, detail }) {
  if (!actor || !actor.hub_id || !actor.user_id) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'authenticated actor context required');
  }

  if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'title is required and must be between 1 and 200 characters');
  }

  if (!category || !ALLOWED_CATEGORIES.includes(category)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
  }

  if (!severity || !ALLOWED_SEVERITIES.includes(severity)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `severity must be one of: ${ALLOWED_SEVERITIES.join(', ')}`);
  }

  if (typeof general_location !== 'string' || !general_location.trim() || general_location.trim().length > 500) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'general_location is required and must be between 1 and 500 characters');
  }

  let sanitizedDetail = null;
  if (detail !== undefined && detail !== null) {
    if (typeof detail !== 'string' || detail.length > 2000) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'detail must be a string up to 2000 characters');
    }
    sanitizedDetail = detail.trim() || null;
  }

  const sql = `
    INSERT INTO neighborhood_issues (
      hub_id, reported_by, title, category, severity, general_location, detail, status, position_3d
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, 'reported', '{}'::jsonb
    )
    RETURNING *
  `;

  const { rows } = await query(sql, [
    actor.hub_id,
    actor.user_id,
    title.trim(),
    category,
    severity,
    general_location.trim(),
    sanitizedDetail,
  ]);

  return serializeNeighborhoodIssue(rows[0], actor.user_id);
}

/**
 * Retrieve issue detail by ID.
 * Cross-hub or non-existent requests return 404 NOT_FOUND.
 */
async function getIssueDetail({ actor, issueId }) {
  if (!actor || !actor.hub_id) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'authenticated actor context required');
  }

  if (!issueId || !UUID_REGEX.test(issueId)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'invalid issue_id format');
  }

  const { rows } = await query(
    `SELECT * FROM neighborhood_issues WHERE issue_id = $1 AND hub_id = $2`,
    [issueId, actor.hub_id]
  );

  const issue = rows[0];
  if (!issue) {
    throw new ApiError(404, 'NOT_FOUND', 'issue not found');
  }

  return serializeNeighborhoodIssue(issue, actor.user_id);
}

/**
 * Edit issue details.
 * Permitted ONLY for original reporter while issue status is 'reported'.
 */
async function editIssue({ actor, issueId, body }) {
  if (!actor || !actor.hub_id || !actor.user_id) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'authenticated actor context required');
  }

  if (!issueId || !UUID_REGEX.test(issueId)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'invalid issue_id format');
  }

  const payload = body || {};

  // Reject attempts to modify immutable fields
  for (const field of IMMUTABLE_FIELDS) {
    if (payload[field] !== undefined) {
      throw new ApiError(400, 'VALIDATION_ERROR', `field '${field}' is immutable and cannot be edited`);
    }
  }

  const allowedEditFields = ['title', 'detail', 'general_location', 'category', 'severity'];
  const providedKeys = Object.keys(payload).filter((k) => allowedEditFields.includes(k));

  if (providedKeys.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'no valid editable fields provided');
  }

  // Validate provided editable fields
  if (payload.title !== undefined) {
    if (typeof payload.title !== 'string' || !payload.title.trim() || payload.title.trim().length > 200) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'title must be between 1 and 200 characters');
    }
  }

  if (payload.category !== undefined) {
    if (!ALLOWED_CATEGORIES.includes(payload.category)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
    }
  }

  if (payload.severity !== undefined) {
    if (!ALLOWED_SEVERITIES.includes(payload.severity)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `severity must be one of: ${ALLOWED_SEVERITIES.join(', ')}`);
    }
  }

  if (payload.general_location !== undefined) {
    if (typeof payload.general_location !== 'string' || !payload.general_location.trim() || payload.general_location.trim().length > 500) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'general_location must be between 1 and 500 characters');
    }
  }

  if (payload.detail !== undefined && payload.detail !== null) {
    if (typeof payload.detail !== 'string' || payload.detail.length > 2000) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'detail must be up to 2000 characters');
    }
  }

  return withTransaction(async (client) => {
    const { rows: findRows } = await client.query(
      `SELECT * FROM neighborhood_issues WHERE issue_id = $1 FOR UPDATE`,
      [issueId]
    );

    const issue = findRows[0];
    if (!issue || issue.hub_id !== actor.hub_id) {
      throw new ApiError(404, 'NOT_FOUND', 'issue not found');
    }

    if (issue.reported_by !== actor.user_id) {
      throw new ApiError(403, 'FORBIDDEN', 'only the original reporter may edit an issue');
    }

    if (issue.status !== 'reported') {
      throw new ApiError(409, 'INVALID_STATE_TRANSITION', 'issue can only be edited while in reported status');
    }

    const newTitle = payload.title !== undefined ? payload.title.trim() : issue.title;
    const newCategory = payload.category !== undefined ? payload.category : issue.category;
    const newSeverity = payload.severity !== undefined ? payload.severity : issue.severity;
    const newGeneralLocation = payload.general_location !== undefined ? payload.general_location.trim() : issue.general_location;
    const newDetail = payload.detail !== undefined ? (payload.detail ? payload.detail.trim() : null) : issue.detail;

    const { rows: updateRows } = await client.query(
      `UPDATE neighborhood_issues
       SET title = $1,
           category = $2,
           severity = $3,
           general_location = $4,
           detail = $5
       WHERE issue_id = $6
         AND hub_id = $7
         AND reported_by = $8
         AND status = 'reported'
       RETURNING *`,
      [newTitle, newCategory, newSeverity, newGeneralLocation, newDetail, issueId, actor.hub_id, actor.user_id]
    );

    if (updateRows.length === 0) {
      throw new ApiError(409, 'CONFLICT', 'issue status was modified concurrently');
    }

    return serializeNeighborhoodIssue(updateRows[0], actor.user_id);
  });
}

/**
 * Transition issue status.
 * Enforces strict transition matrix and actor authority rules.
 */
async function updateIssueStatus({ actor, issueId, requestedStatus, reason }) {
  if (!actor || !actor.hub_id || !actor.user_id) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'authenticated actor context required');
  }

  if (!issueId || !UUID_REGEX.test(issueId)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'invalid issue_id format');
  }

  const targetStatus = typeof requestedStatus === 'string' ? requestedStatus.trim().toLowerCase() : null;

  if (!targetStatus || !ALLOWED_STATUSES.includes(targetStatus)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `invalid or unsupported status value: '${requestedStatus}'`);
  }

  return withTransaction(async (client) => {
    const { rows: findRows } = await client.query(
      `SELECT * FROM neighborhood_issues WHERE issue_id = $1 FOR UPDATE`,
      [issueId]
    );

    const issue = findRows[0];
    if (!issue || issue.hub_id !== actor.hub_id) {
      throw new ApiError(404, 'NOT_FOUND', 'issue not found');
    }

    const currentStatus = issue.status;
    const isReporter = issue.reported_by === actor.user_id;
    const isCoordinator = actor.role === 'coordinator';

    // 1. Determine actor authorization for the requested status operation
    let allowed = false;

    if (targetStatus === 'in_progress' || targetStatus === 'attention_needed') {
      allowed = true; // Any authenticated same-hub resident
    } else if (targetStatus === 'parts_ordered') {
      allowed = isCoordinator; // Coordinator ONLY
    } else if (targetStatus === 'resolved') {
      allowed = isReporter || isCoordinator; // Reporter or Coordinator
    }

    if (!allowed) {
      throw new ApiError(403, 'FORBIDDEN', 'insufficient authority for this status operation');
    }

    // 2. Same-status idempotency check (AFTER authorization check)
    if (currentStatus === targetStatus) {
      return serializeNeighborhoodIssue(issue, actor.user_id);
    }

    // 3. State transition validity check
    const validTransitions = {
      reported: ['attention_needed', 'in_progress', 'resolved'],
      attention_needed: ['in_progress', 'resolved'],
      in_progress: ['parts_ordered', 'resolved'],
      parts_ordered: ['in_progress', 'resolved'],
      resolved: ['attention_needed'],
    };

    if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(targetStatus)) {
      throw new ApiError(
        409,
        'INVALID_STATE_TRANSITION',
        `cannot transition issue from '${currentStatus}' to '${targetStatus}'`
      );
    }

    if (currentStatus === 'resolved' && targetStatus === 'attention_needed') {
      if (typeof reason !== 'string' || !reason.trim()) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'a non-empty reopening reason is required for resolved -> attention_needed');
      }
    }

    const { rows: updateRows } = await client.query(
      `UPDATE neighborhood_issues
       SET status = $1
       WHERE issue_id = $2
         AND hub_id = $3
         AND status = $4
       RETURNING *`,
      [targetStatus, issueId, actor.hub_id, currentStatus]
    );

    if (updateRows.length === 0) {
      throw new ApiError(409, 'CONFLICT', 'issue status was modified concurrently');
    }

    return serializeNeighborhoodIssue(updateRows[0], actor.user_id);
  });
}

module.exports = {
  serializeNeighborhoodIssue,
  serializeNeighborhoodIssueList,
  listIssues,
  createIssue,
  getIssueDetail,
  editIssue,
  updateIssueStatus,
};
