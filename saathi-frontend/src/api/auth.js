/**
 * SAATHI Auth API Module
 * Phase 2G-1 Implementation
 *
 * Implements server-authoritative authentication:
 * - login(email, password)
 * - logout()
 * - bootstrapSession()
 *
 * Never trust client identity:
 * - Token is the authority.
 * - Current user is server-derived from GET /users/:id.
 * - No mock fallback for authentication failures.
 */

import { apiClient, getToken, setSession, clearSession } from './client.js';

/**
 * In-memory user state for the active React runtime.
 * Kept in JavaScript memory only — NEVER persisted to sessionStorage.
 * The backend remains the sole authoritative identity source.
 */
let inMemoryCurrentUser = null;

export function setMemoryUser(user) {
  inMemoryCurrentUser = user || null;
}

export function getMemoryUser() {
  return inMemoryCurrentUser;
}

export function clearMemoryUser() {
  inMemoryCurrentUser = null;
}

let bootstrapRequestId = 0;

/**
 * Log in with email and password.
 * 1. POST /auth/login -> { token, user_id, role }
 * 2. Store ONLY the opaque token in sessionStorage
 * 3. Bootstrap full user profile via GET /auth/me
 * 4. Hold authenticated profile in React/module memory
 * 5. Return { user, token, role }
 */
export async function login(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  bootstrapRequestId++;

  // Real backend authentication
  const authResponse = await apiClient.post('/auth/login', {
    email: email.trim(),
    password,
  });

  const { token, user_id, role } = authResponse;

  if (!token || !user_id) {
    throw new Error('Authentication response was missing required token or user_id.');
  }

  // Store ONLY the opaque session token in sessionStorage
  setSession(token);

  try {
    // Bootstrap authoritative user profile from server
    const user = await apiClient.get('/auth/me');
    setMemoryUser(user);
    return {
      user,
      token,
      role,
    };
  } catch (err) {
    // If bootstrapping fails after login, clear session to avoid corrupted state
    clearSession();
    clearMemoryUser();
    throw err;
  }
}

/**
 * Log out and revoke session.
 * 1. POST /auth/logout (Bearer token)
 * 2. Clear sessionStorage token and in-memory profile
 * Safe and idempotent: always clears client session even if backend revokes or network drops.
 */
export async function logout() {
  bootstrapRequestId++;
  const token = getToken();
  try {
    if (token) {
      await apiClient.post('/auth/logout');
    }
  } catch (err) {
    // Even if session has already expired or backend returns 401, proceed with local logout
  } finally {
    clearSession();
    clearMemoryUser();
  }
}

/**
 * Bootstrap existing session on application startup or page reload.
 * 1. Read opaque token from sessionStorage.
 * 2. If token absent, clear and return null.
 * 3. Validate token and restore authenticated profile via server-authoritative GET /auth/me.
 *    - If 401 (or inactive): clearSession(), clearMemoryUser(), return null.
 *    - If network error: throw ApiError / preserve session token without manufacturing a user.
 * 4. Stale request guard ensures newer session operations (e.g. logout) are not overwritten.
 */
export async function bootstrapSession() {
  const token = getToken();

  if (!token) {
    clearSession();
    clearMemoryUser();
    return null;
  }

  const currentRequestId = ++bootstrapRequestId;

  try {
    const user = await apiClient.get('/auth/me');

    // Stale guard: if another bootstrap or logout happened while waiting, ignore response
    if (currentRequestId !== bootstrapRequestId || !getToken()) {
      return null;
    }

    setMemoryUser(user);
    return user;
  } catch (err) {
    // Ignore if stale request
    if (currentRequestId !== bootstrapRequestId) {
      return null;
    }

    // 401 Unauthorized / 403 Inactive session: clear session and return null
    if (err?.status === 401 || err?.status === 403) {
      clearSession();
      clearMemoryUser();
      return null;
    }

    // Network / server connection error: do NOT wipe session token, do NOT fabricate a user
    throw err;
  }
}

export const auth = {
  login,
  logout,
  bootstrapSession,
  getToken,
  getMemoryUser,
  setMemoryUser,
  clearMemoryUser,
  isAuthenticated: () => Boolean(getToken()),
};

export default auth;
