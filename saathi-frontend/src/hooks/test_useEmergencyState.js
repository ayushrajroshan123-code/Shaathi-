/**
 * SAATHI Phase 2H Unit 5 Step 2B — Focused Automated Tests for useEmergencyState
 *
 * Tests the locked implementation of saathi-frontend/src/hooks/useEmergencyState.js:
 *  A. Successful responses and filtering (OPEN, PRIORITIZED, COORDINATING only)
 *  B. Empty responses (status: 'available', incidents: [])
 *  C. HTTP 404 (status: 'unavailable', incidents: [], populated error)
 *  D. Other request errors (status: 'idle', incidents: [], populated error)
 *  E. Malformed response (non-array -> TypeError, status: 'idle')
 *  F. Manual refresh (autoFetch: false, invoke & await refresh())
 *  G. Overlapping requests (race condition prevention, stale success & error suppression)
 *  H. Unmounting (pending request settled after unmount causes no leak or crash)
 *  I. React Strict Mode (simulated unmount/remount cycle completes and updates state)
 */

import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useEmergencyState } from './useEmergencyState.js';
import { apiClient, ApiError } from '../api/client.js';

// =============================================================================
// DOM & ACT ENVIRONMENT SETUP FOR REACT 19 IN NODE.JS
// =============================================================================
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.HTMLIFrameElement = class {};
globalThis.HTMLElement = class {};
globalThis.Element = class {};
globalThis.Node = class {};

const doc = {
  nodeType: 9,
  createElement(tag) {
    return {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      children: [],
      appendChild(c) { this.children.push(c); return c; },
      removeChild(c) {
        const i = this.children.indexOf(c);
        if (i !== -1) this.children.splice(i, 1);
        return c;
      },
      setAttribute() {},
      removeAttribute() {},
      addEventListener() {},
      removeEventListener() {},
      style: {},
      ownerDocument: doc,
    };
  },
  createTextNode(text) {
    return { nodeType: 3, nodeValue: text, ownerDocument: doc };
  },
  addEventListener() {},
  removeEventListener() {},
};
doc.defaultView = globalThis;
globalThis.document = doc;
globalThis.window = globalThis;

// =============================================================================
// TEST HARNESS & ASSERTIONS
// =============================================================================
let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    failCount++;
    failures.push(message);
  } else {
    console.log(`  ✅ PASSED: ${message}`);
    passCount++;
  }
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Custom hook render harness
 */
function renderHook(hookOptions = {}, { strict = false } = {}) {
  const container = doc.createElement('div');
  const root = createRoot(container);
  let latestResult = null;

  function HookHost({ options }) {
    latestResult = useEmergencyState(options);
    return null;
  }

  // Initial synchronous render setup
  const initialElement = React.createElement(HookHost, { options: hookOptions });
  const wrapped = strict
    ? React.createElement(StrictMode, null, initialElement)
    : initialElement;

  return {
    async mount() {
      await act(async () => {
        root.render(wrapped);
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
    },
    get current() {
      return latestResult;
    },
  };
}

// Store original apiClient.get for cleanup
const originalGet = apiClient.get;

// =============================================================================
// TEST SUITE
// =============================================================================
async function runSuite() {
  console.log('======================================================================');
  console.log('  SAATHI PHASE 2H UNIT 5 — useEmergencyState FOCUSED TEST SUITE');
  console.log('======================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // TEST A: Successful responses and filtering
    // -------------------------------------------------------------------------
    console.log('--- TEST A: Successful responses and filtering ---');
    {
      const deferred = createDeferred();
      let callCount = 0;
      apiClient.get = () => {
        callCount++;
        return deferred.promise;
      };

      const h = renderHook({ autoFetch: true });
      await h.mount();

      assert(callCount === 1, 'autoFetch: true dispatches request on initial mount');
      assert(h.current.status === 'loading', 'status is "loading" while request is in-flight');
      assert(Array.isArray(h.current.incidents), 'incidents is initialized as an array');
      assert(h.current.error === null, 'error is null while loading');

      const rawIncidents = [
        { incident_id: 'i-1', status: 'OPEN', title: 'Open Incident' },
        { incident_id: 'i-2', status: 'PRIORITIZED', title: 'Prioritized Incident' },
        { incident_id: 'i-3', status: 'COORDINATING', title: 'Coordinating Incident' },
        { incident_id: 'i-4', status: 'RESOLVED', title: 'Resolved Incident' },
        { incident_id: 'i-5', status: 'unknown', title: 'Unknown Status' },
        null,
        'primitive-string',
        42,
        ['nested-array'],
        { status: 'open' }, // wrong case
      ];

      await act(async () => {
        deferred.resolve(rawIncidents);
      });

      assert(h.current.status === 'available', 'status becomes "available" upon 200 array response');
      assert(h.current.error === null, 'error remains null after successful fetch');
      assert(Array.isArray(h.current.incidents), 'incidents remains an array');
      assert(h.current.incidents.length === 3, 'exactly 3 active incidents retained');
      assert(
        h.current.incidents.every((inc) =>
          ['OPEN', 'PRIORITIZED', 'COORDINATING'].includes(inc.status)
        ),
        'only OPEN, PRIORITIZED, and COORDINATING entries retained'
      );
      assert(
        !h.current.incidents.some((inc) => inc.status === 'RESOLVED'),
        'RESOLVED status is strictly excluded'
      );
      assert(
        !h.current.incidents.some((inc) => inc.status === 'unknown'),
        'unknown status is strictly excluded'
      );

      await h.unmount();
    }

    // -------------------------------------------------------------------------
    // TEST B: Empty responses
    // -------------------------------------------------------------------------
    console.log('\n--- TEST B: Empty responses ---');
    {
      apiClient.get = async () => [];

      const h = renderHook({ autoFetch: true });
      await h.mount();

      assert(h.current.status === 'available', 'empty response sets status to "available" (not unavailable)');
      assert(Array.isArray(h.current.incidents) && h.current.incidents.length === 0, 'incidents is empty array');
      assert(h.current.error === null, 'error is null on empty success');

      await h.unmount();
    }

    // -------------------------------------------------------------------------
    // TEST C: HTTP 404 (Route not mounted / feature flag off)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST C: HTTP 404 (Route unmounted) ---');
    {
      const notFoundError = new ApiError({
        status: 404,
        error: 'HTTP_404',
        message: 'Cannot GET /incidents',
      });
      apiClient.get = async () => {
        throw notFoundError;
      };

      const h = renderHook({ autoFetch: true });
      await h.mount();

      assert(h.current.status === 'unavailable', 'HTTP 404 sets status to "unavailable"');
      assert(Array.isArray(h.current.incidents) && h.current.incidents.length === 0, 'incidents is empty array on 404');
      assert(h.current.error === notFoundError, 'request error is preserved in error property');
      assert(h.current.error.status === 404, 'error.status is 404');

      await h.unmount();
    }

    // -------------------------------------------------------------------------
    // TEST D: Other request errors (500 Server Error, Network Error)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST D: Other request errors ---');
    {
      // Subcase 1: HTTP 500
      const serverError = new ApiError({
        status: 500,
        error: 'INTERNAL_ERROR',
        message: 'Database query failed',
      });
      apiClient.get = async () => {
        throw serverError;
      };

      const h1 = renderHook({ autoFetch: true });
      await h1.mount();

      assert(h1.current.status === 'idle', 'HTTP 500 sets status to "idle" (not available/unavailable)');
      assert(Array.isArray(h1.current.incidents) && h1.current.incidents.length === 0, 'incidents cleared to empty array on 500');
      assert(h1.current.error === serverError, 'serverError preserved in error');
      await h1.unmount();

      // Subcase 2: Network error (status 0)
      const networkError = new ApiError({
        status: 0,
        error: 'NETWORK_ERROR',
        message: 'Connection refused',
      });
      apiClient.get = async () => {
        throw networkError;
      };

      const h2 = renderHook({ autoFetch: true });
      await h2.mount();

      assert(h2.current.status === 'idle', 'Network error sets status to "idle"');
      assert(h2.current.error === networkError, 'networkError preserved in error');
      await h2.unmount();
    }

    // -------------------------------------------------------------------------
    // TEST E: Malformed responses
    // -------------------------------------------------------------------------
    console.log('\n--- TEST E: Malformed response ---');
    {
      // Returns an object instead of an array
      apiClient.get = async () => ({ incidents: [{ status: 'OPEN' }] });

      const h = renderHook({ autoFetch: true });
      await h.mount();

      assert(h.current.status === 'idle', 'malformed response sets status to "idle"');
      assert(Array.isArray(h.current.incidents) && h.current.incidents.length === 0, 'incidents is empty array');
      assert(h.current.error instanceof TypeError, 'surfaces a TypeError for non-array response');
      assert(
        h.current.error.message.includes('Expected an array'),
        'TypeError contains descriptive message'
      );

      await h.unmount();
    }

    // -------------------------------------------------------------------------
    // TEST F: Manual refresh
    // -------------------------------------------------------------------------
    console.log('\n--- TEST F: Manual refresh ---');
    {
      let callCount = 0;
      apiClient.get = async () => {
        callCount++;
        return [{ incident_id: 'i-manual', status: 'OPEN' }];
      };

      const h = renderHook({ autoFetch: false });
      await h.mount();

      assert(callCount === 0, 'autoFetch: false executes zero API calls on mount');
      assert(h.current.status === 'idle', 'initial status is "idle" with autoFetch: false');
      assert(h.current.incidents.length === 0, 'initial incidents is empty');

      // Call and await refresh()
      await act(async () => {
        await h.current.refresh();
      });

      assert(callCount === 1, 'manual refresh() triggers exactly one API request');
      assert(h.current.status === 'available', 'status becomes "available" after refresh()');
      assert(h.current.incidents.length === 1, 'incident is populated after refresh()');
      assert(h.current.incidents[0].incident_id === 'i-manual', 'incident data correctly stored');

      await h.unmount();
    }

    // -------------------------------------------------------------------------
    // TEST G: Overlapping requests (Race condition & stale response prevention)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST G: Overlapping requests & race condition safety ---');
    {
      // Subcase 1: Stale success resolution
      const deferredA = createDeferred();
      const deferredB = createDeferred();

      let reqSeq = 0;
      apiClient.get = () => {
        reqSeq++;
        return reqSeq === 1 ? deferredA.promise : deferredB.promise;
      };

      const h = renderHook({ autoFetch: false });
      await h.mount();

      // Trigger Request A (slow)
      let promiseA;
      act(() => {
        promiseA = h.current.refresh();
      });
      assert(h.current.status === 'loading', 'Request A starts and sets loading');

      // Trigger Request B (fast)
      let promiseB;
      act(() => {
        promiseB = h.current.refresh();
      });

      // Settle Request B first
      await act(async () => {
        deferredB.resolve([{ incident_id: 'winner-B', status: 'OPEN' }]);
        await promiseB;
      });

      assert(h.current.status === 'available', 'Request B settles and sets available');
      assert(h.current.incidents[0].incident_id === 'winner-B', 'Request B data accepted');

      // Settle Request A afterward (stale)
      await act(async () => {
        deferredA.resolve([{ incident_id: 'stale-A', status: 'OPEN' }]);
        await promiseA;
      });

      assert(
        h.current.incidents[0].incident_id === 'winner-B',
        'Stale Request A resolution is ignored; newer Request B data preserved'
      );

      // Subcase 2: Stale error rejection does not overwrite newer success
      const deferredC = createDeferred();
      const deferredD = createDeferred();

      reqSeq = 0;
      apiClient.get = () => {
        reqSeq++;
        return reqSeq === 1 ? deferredC.promise : deferredD.promise;
      };

      let promiseC;
      act(() => {
        promiseC = h.current.refresh();
      });

      let promiseD;
      act(() => {
        promiseD = h.current.refresh();
      });

      // Settle D (success)
      await act(async () => {
        deferredD.resolve([{ incident_id: 'winner-D', status: 'COORDINATING' }]);
        await promiseD;
      });
      assert(h.current.status === 'available', 'Request D settles successfully');

      // Settle C with 500 error (stale)
      await act(async () => {
        deferredC.reject(new ApiError({ status: 500, error: 'STALE_ERR' }));
        try { await promiseC; } catch {}
      });

      assert(
        h.current.status === 'available',
        'Stale Request C rejection is ignored; status remains "available"'
      );
      assert(
        h.current.incidents[0].incident_id === 'winner-D',
        'Stale Request C rejection does not clear Request D incidents'
      );
      assert(h.current.error === null, 'error remains null despite stale rejection');

      await h.unmount();
    }

    // -------------------------------------------------------------------------
    // TEST H: Unmounting safety
    // -------------------------------------------------------------------------
    console.log('\n--- TEST H: Unmounting safety ---');
    {
      const deferred = createDeferred();
      apiClient.get = () => deferred.promise;

      const h = renderHook({ autoFetch: true });
      await h.mount();
      assert(h.current.status === 'loading', 'Request pending before unmount');

      // Unmount while request is still pending
      await h.unmount();

      // Settle deferred after unmount
      let uncaught = false;
      try {
        await act(async () => {
          deferred.resolve([{ incident_id: 'unmounted', status: 'OPEN' }]);
        });
      } catch (e) {
        uncaught = true;
      }

      assert(!uncaught, 'Settling request after unmount throws no uncaught errors');

      // Settle rejection after unmount
      const deferredRej = createDeferred();
      apiClient.get = () => deferredRej.promise;

      const hRej = renderHook({ autoFetch: true });
      await hRej.mount();
      await hRej.unmount();

      try {
        await act(async () => {
          deferredRej.reject(new Error('Post-unmount error'));
        });
      } catch (e) {
        uncaught = true;
      }

      assert(!uncaught, 'Rejecting request after unmount throws no uncaught errors');
    }

    // -------------------------------------------------------------------------
    // TEST I: React Strict Mode
    // -------------------------------------------------------------------------
    console.log('\n--- TEST I: React Strict Mode compatibility ---');
    {
      let getCalls = 0;
      apiClient.get = async () => {
        getCalls++;
        return [{ incident_id: 'strict-1', status: 'OPEN' }];
      };

      const h = renderHook({ autoFetch: true }, { strict: true });
      await h.mount();

      assert(getCalls >= 1, 'StrictMode effect runs setup and dispatches fetch');
      assert(h.current.status === 'available', 'hook recovers and settles as "available" under StrictMode');
      assert(h.current.incidents.length === 1, 'active incident populated under StrictMode');
      assert(h.current.incidents[0].incident_id === 'strict-1', 'incident data intact under StrictMode');

      // Verify refresh() still works after StrictMode setup/cleanup cycle
      await act(async () => {
        await h.current.refresh();
      });

      assert(h.current.status === 'available', 'refresh() remains operational after StrictMode mount');

      await h.unmount();
    }

  } finally {
    // Restore original apiClient.get
    apiClient.get = originalGet;
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`  TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('======================================================================');

  if (failCount > 0) {
    console.error(`\nFailed assertions:\n${failures.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}`);
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 24 HOOK UNIT TEST ASSERTIONS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
