const { ApiError } = require('../middleware/context');
const { effectiveStatus } = require('./coverage');

/**
 * Resources confirmation model (already decided — see schema comments):
 * the owner alone controls HANDED_OFF/RETURNED transitions. The requester's
 * requester_confirmed_handoff / requester_confirmed_return columns are
 * non-blocking attestations for future ConductReport review; they never
 * gate a transition. Do not add authorization checks that require the
 * requester's confirmation before the owner can move status forward.
 */
function assertOwnerAction(actorUserId, resourceRow) {
  if (actorUserId !== resourceRow.owner_id) {
    throw new ApiError(403, 'FORBIDDEN', 'only the resource owner may change handoff/return status');
  }
}

function assertRequesterAction(actorUserId, requestRow) {
  if (actorUserId !== requestRow.requested_by) {
    throw new ApiError(403, 'FORBIDDEN', 'only the requester may record this attestation');
  }
}

/** Same read-time expiration rule as coverage requests (Option A). */
function effectiveResourceStatus(row, now = new Date()) {
  return effectiveStatus(row, now);
}

module.exports = { assertOwnerAction, assertRequesterAction, effectiveResourceStatus };
