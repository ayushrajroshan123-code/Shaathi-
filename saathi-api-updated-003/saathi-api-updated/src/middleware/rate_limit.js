const { ApiError } = require('../lib/errors');

/**
 * Creates an in-memory rate limiter middleware for Express.
 *
 * Requirements enforced:
 * - Separate configurable limits for login and signup.
 * - Configurable time window and maximum requests via environment.
 * - HTTP 429 when max requests exceeded.
 * - Standard headers: Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.
 * - Evaluates before expensive password hashing or unnecessary database queries.
 * - Does not trust arbitrary spoofed headers unless Express trust proxy is enabled.
 * - Memory store resets on server restart and cleans up expired keys periodically.
 */
function createRateLimiter(options = {}) {
  const getWindowMs = typeof options.windowMs === 'function' ? options.windowMs : () => options.windowMs;
  const getMax = typeof options.max === 'function' ? options.max : () => options.max;
  const message = options.message || 'Too many requests. Please try again later.';
  const prefix = options.prefix || 'rl';

  const store = new Map();

  // Periodic cleanup of expired entries
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (record.resetTime <= now) {
        store.delete(key);
      }
    }
  }, 60000);
  if (cleanupInterval.unref) cleanupInterval.unref();

  function keyGenerator(req) {
    // Express req.ip uses connection remoteAddress unless trust proxy is configured
    return `${prefix}:${req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1'}`;
  }

  const limiter = function rateLimitMiddleware(req, res, next) {
    const windowMs = Number(getWindowMs()) || 15 * 60 * 1000;
    const max = Number(getMax());

    // If max is 0 or negative, rate limiting is disabled
    if (max <= 0) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();

    let record = store.get(key);
    if (!record || record.resetTime <= now) {
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
      store.set(key, record);
    }

    record.count += 1;

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil(record.resetTime / 1000);
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);

    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(resetSeconds));

    if (record.count > max) {
      res.set('Retry-After', String(Math.max(1, retryAfter)));
      return next(new ApiError(429, 'RATE_LIMIT_EXCEEDED', message));
    }

    next();
  };

  limiter.reset = function resetStore() {
    store.clear();
  };

  return limiter;
}

const defaultLoginMax = () => {
  if (process.env.LOGIN_RATE_LIMIT_MAX !== undefined) {
    return Number(process.env.LOGIN_RATE_LIMIT_MAX);
  }
  return process.env.NODE_ENV === 'test' ? 1000 : 10;
};

const defaultLoginWindowMs = () => {
  return Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
};

const defaultSignupMax = () => {
  if (process.env.SIGNUP_RATE_LIMIT_MAX !== undefined) {
    return Number(process.env.SIGNUP_RATE_LIMIT_MAX);
  }
  return process.env.NODE_ENV === 'test' ? 1000 : 10;
};

const defaultSignupWindowMs = () => {
  return Number(process.env.SIGNUP_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000;
};

const loginRateLimiter = createRateLimiter({
  prefix: 'login',
  max: defaultLoginMax,
  windowMs: defaultLoginWindowMs,
  message: 'Too many login attempts. Please try again later.',
});

const signupRateLimiter = createRateLimiter({
  prefix: 'signup',
  max: defaultSignupMax,
  windowMs: defaultSignupWindowMs,
  message: 'Too many account creation attempts. Please try again later.',
});

module.exports = {
  createRateLimiter,
  loginRateLimiter,
  signupRateLimiter,
};
