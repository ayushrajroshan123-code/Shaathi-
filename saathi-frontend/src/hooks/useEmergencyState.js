/**
 * SAATHI Emergency State Hook
 * Phase 2H Unit 5 Step 2A Implementation
 *
 * Exposes server-authoritative emergency incident state:
 * - status: 'idle' | 'loading' | 'available' | 'unavailable'
 * - incidents: Array of verified active incident records
 * - error: Error | ApiError | null
 * - refresh: Async function to re-fetch incidents
 *
 * Rules:
 * 1. An incident is active only if status is exactly 'OPEN', 'PRIORITIZED', or 'COORDINATING'.
 * 2. HTTP 404 sets status to 'unavailable' without faking success or injecting mock data.
 * 3. Other errors and malformed responses set status to 'idle'.
 * 4. Stale requests and unmount state updates are guarded via monotonic request tracking.
 * 5. Zero coordinates, tokens, or personal identifiers are logged or plotted.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { listIncidents } from '../api/emergency.js';

const ACTIVE_STATUSES = new Set(['OPEN', 'PRIORITIZED', 'COORDINATING']);

function isActiveIncident(item) {
  return (
    item !== null &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    ACTIVE_STATUSES.has(item.status)
  );
}

export function useEmergencyState({ autoFetch = true } = {}) {
  const [status, setStatus] = useState('idle');
  const [incidents, setIncidents] = useState([]);
  const [error, setError] = useState(null);

  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setStatus('loading');
    setError(null);

    try {
      const response = await listIncidents();

      // Discard results if unmounted or if a newer request was dispatched
      if (!isMountedRef.current || currentRequestId !== requestIdRef.current) {
        return;
      }

      // Response validation: listIncidents must resolve to an array
      if (!Array.isArray(response)) {
        throw new TypeError('Expected an array of incidents from listIncidents');
      }

      const activeIncidents = response.filter(isActiveIncident);

      setIncidents(activeIncidents);
      setStatus('available');
      setError(null);
    } catch (err) {
      // Discard error state if unmounted or if a newer request was dispatched
      if (!isMountedRef.current || currentRequestId !== requestIdRef.current) {
        return;
      }

      setIncidents([]);
      setError(err);

      const isNotFound = err?.status === 404 || err?.error === 'HTTP_404';
      if (isNotFound) {
        setStatus('unavailable');
      } else {
        setStatus('idle');
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    if (autoFetch) {
      refresh();
    }
    return () => {
      isMountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, [autoFetch, refresh]);

  return {
    status,
    incidents,
    error,
    refresh,
  };
}

export default useEmergencyState;
