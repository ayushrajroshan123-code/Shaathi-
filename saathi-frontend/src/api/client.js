/**
 * SAATHI API Client — Single Low-Level HTTP Layer
 * Phase 2G-1 Implementation
 *
 * Ground rules:
 * 1. Native fetch only — no external dependencies (no axios, redux, swr).
 * 2. Canonical base URL resolution via VITE_API_BASE_URL (fallback http://localhost:3000).
 * 3. Automatic Authorization: Bearer <token> attachment.
 * 4. Token storage strictly in sessionStorage under 'saathi_session_token'.
 * 5. Automatic 401 session expiration handling & callback dispatch.
 * 6. Normalized error shape: { error, message, status }.
 * 7. Never trust client identity — token is the sole actor authority.
 */

const TOKEN_KEY = 'saathi_session_token';

/**
 * Normalized API Error Class
 */
export class ApiError extends Error {
  constructor({ error, message, status }) {
    super(message || error || 'An unexpected error occurred');
    this.name = 'ApiError';
    this.error = error || 'UNKNOWN_ERROR';
    this.message = message || 'An unexpected error occurred';
    this.status = typeof status === 'number' ? status : 500;
  }
}

// In-memory token storage fallback for SSR / non-browser test runners
let memoryStorage = {
  [TOKEN_KEY]: null,
};

function getStorage() {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage;
  }
  return {
    getItem: (key) => memoryStorage[key] || null,
    setItem: (key, val) => { memoryStorage[key] = String(val); },
    removeItem: (key) => { delete memoryStorage[key]; },
    clear: () => { memoryStorage = {}; },
  };
}

/**
 * Session storage helpers — strictly token only.
 * Never store user IDs, passwords, hashes, or arbitrary cached data.
 */
export function getToken() {
  return getStorage().getItem(TOKEN_KEY);
}

export function setSession(token) {
  const storage = getStorage();
  if (token) {
    storage.setItem(TOKEN_KEY, token);
  }
}

export function clearSession() {
  const storage = getStorage();
  storage.removeItem(TOKEN_KEY);
}

export function getApiBaseUrl() {
  const envUrl =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
    (typeof process !== 'undefined' && process.env && process.env.VITE_API_BASE_URL);

  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  const isProd =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) ||
    (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production');

  if (isProd) {
    throw new Error('VITE_API_BASE_URL is missing in production environment');
  }

  return 'http://localhost:3000';
}


// Session expired listeners
const sessionExpiredListeners = new Set();

export function onSessionExpired(callback) {
  sessionExpiredListeners.add(callback);
  return () => sessionExpiredListeners.delete(callback);
}

function notifySessionExpired() {
  clearSession();
  sessionExpiredListeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      // Prevent listener failure from breaking flow
    }
  });
}

/**
 * Core HTTP Request Execution
 */
async function request(path, options = {}) {
  const baseUrl = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${cleanPath}`;

  const headers = {
    ...(options.headers || {}),
  };

  // Attach Content-Type if body is present and not FormData
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Automatically attach Bearer token if session exists
  const token = getToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    // Network failure (offline, refused connection, DNS error)
    throw new ApiError({
      error: 'NETWORK_ERROR',
      message: 'Unable to connect to the SAATHI backend server. Please verify your connection.',
      status: 0,
    });
  }

  // Handle 401 Unauthorized / Expired Session
  if (response.status === 401) {
    notifySessionExpired();
  }

  // 204 No Content
  if (response.status === 204) {
    return null;
  }

  // Parse JSON response body if present
  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await response.text();
      data = text ? { message: text } : null;
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorPayload = {
      error: data?.error || `HTTP_${response.status}`,
      message: data?.message || response.statusText || 'Request failed',
      status: response.status,
    };
    throw new ApiError(errorPayload);
  }

  return data;
}

export const apiClient = {
  get(path, options = {}) {
    return request(path, { ...options, method: 'GET' });
  },

  post(path, body, options = {}) {
    return request(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch(path, body, options = {}) {
    return request(path, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete(path, options = {}) {
    return request(path, { ...options, method: 'DELETE' });
  },

  // Helpers
  getToken,
  setSession,
  clearSession,
  onSessionExpired,
  getApiBaseUrl,
};

export default apiClient;
