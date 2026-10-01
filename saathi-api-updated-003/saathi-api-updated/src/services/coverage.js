const { ApiError } = require('../middleware/context');

/**
 * "Volunteer" is a domain/API-level label for whichever resident or
 * verified_helper is assigned to a coverage request (coverage_requests.
 * assigned_to). It is NOT a users.role value — the DB only ever has
 * resident | verified_helper | coordinator. Don't add a fourth role.
 */

/**
 * Cancellation authorization — frozen table:
 *   REQUESTED    requester: yes   volunteer: no
 *   ACCEPTED     requester: yes   volunteer: yes
 *   IN_PROGRESS  requester: yes   volunteer: yes
 *   COMPLETED    requester: no    volunteer: no
 *   CANCELLED    requester: no    volunteer: no
 *   EXPIRED      requester: no    volunteer: no
 */
const CANCEL_AUTH = {
  REQUESTED: { requester: true, volunteer: false },
  ACCEPTED: { requester: true, volunteer: true },
  IN_PROGRESS: { requester: true, volunteer: true },
  COMPLETED: { requester: false, volunteer: false },
  CANCELLED: { requester: false, volunteer: false },
  EXPIRED: { requester: false, volunteer: false },
};

function assertCanCancelCoverage(actorUserId, request) {
  const rule = CANCEL_AUTH[request.status];
  if (!rule) {
    throw new ApiError(500, 'UNKNOWN_STATUS', `unrecognized coverage status: ${request.status}`);
  }
  const isRequester = actorUserId === request.requested_by;
  const isVolunteer = request.assigned_to && actorUserId === request.assigned_to;

  if ((isRequester && rule.requester) || (isVolunteer && rule.volunteer)) {
    return;
  }
  throw new ApiError(
    403,
    'CANCEL_NOT_ALLOWED',
    `cannot cancel a ${request.status} coverage request as this actor`
  );
}

/**
 * Decision #1 (Frozen): a REQUESTED or ACCEPTED coverage/resource request
 * is treated as expired once its time_window_end has passed, computed at
 * read time rather than stored. No expires_at column: time_window_end is
 * the single source of truth.
 */
function effectiveStatus(row, now = new Date()) {
  const expirable = row.status === 'REQUESTED' || row.status === 'ACCEPTED';
  if (expirable && new Date(row.time_window_end) < now) {
    return 'EXPIRED';
  }
  return row.status;
}

module.exports = { assertCanCancelCoverage, effectiveStatus };
