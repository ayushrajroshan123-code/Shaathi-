const { query } = require('../db');
const { ApiError } = require('../middleware/context');

/**
 * Frozen abuse-control number: a reporter may submit at most 10
 * ConductReports in a rolling 24-hour period; the 11th is rejected here
 * in the service layer (the schema comments explicitly assign this job
 * to the service layer, not a DB trigger, since it's an operational
 * policy rather than a structural invariant).
 *
 * The >=3-reports/30-days repeat_pattern_flag is handled entirely by the
 * DB trigger mark_conduct_repeat_pattern — nothing to do here but let the
 * INSERT happen and read back repeat_pattern_flag for the response.
 */
async function assertUnderSubmissionCap(reporterId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM conduct_reports
     WHERE reported_by = $1 AND created_at >= now() - INTERVAL '24 hours'`,
    [reporterId]
  );
  if (rows[0].n >= 10) {
    throw new ApiError(
      429,
      'SUBMISSION_LIMIT_EXCEEDED',
      'at most 10 conduct reports may be submitted in a rolling 24-hour period'
    );
  }
}

module.exports = { assertUnderSubmissionCap };
