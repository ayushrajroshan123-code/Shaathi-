const express = require('express');
const cors = require('cors');
const { loadActor, errorHandler } = require('./middleware/context');

const { publicRouter: authPublicRouter, protectedRouter: authProtectedRouter } = require('./routes/auth');
const usersRouter = require('./routes/users');
const coverageRouter = require('./routes/coverage');
const resourcesRouter = require('./routes/resources');
const conductRouter = require('./routes/conduct');
const emergencyRouter = require('./routes/emergency');

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

// Signup/login ARE how a session is obtained, so they must run before
// loadActor — an unauthenticated caller has to be able to reach them.
app.use('/auth', authPublicRouter);

// Every route below requires a valid session (Authorization: Bearer <token>
// from POST /auth/login). See middleware/context.js.
app.use(loadActor);

// Logout needs to know which session to revoke, so it's mounted after
// loadActor even though it lives under the same /auth prefix as the public
// routes above.
app.use('/auth', authProtectedRouter);

app.use('/users', usersRouter);
app.use('/coverage-requests', coverageRouter);
app.use('/resources', resourcesRouter);
app.use('/conduct-reports', conductRouter);

// Phase boundary: schema explicitly says emergency functionality exists for
// later phases and "is not exposed by the Phase 1 API." Gated behind an
// explicit opt-in env var rather than being live by default, so a real
// Phase 1 deploy doesn't expose it just because nobody remembered to
// delete a line before shipping. Set ENABLE_EMERGENCY_ROUTES=true only in
// environments where this phase is actually meant to be live.
if (process.env.ENABLE_EMERGENCY_ROUTES === 'true') {
  app.use('/', emergencyRouter);
}

app.use(errorHandler);

module.exports = app;
