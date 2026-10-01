/**
 * Extracted from middleware/context.js so services (e.g. services/auth.js)
 * can throw ApiError without requiring context.js — context.js itself now
 * needs services/auth.js (for loadActorFromToken), and a two-way require
 * between those two files would hit Node's circular-require partial-exports
 * problem. context.js still re-exports ApiError for every existing route
 * file that imports it from there.
 */
class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = { ApiError };
