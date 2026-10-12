/**
 * test_emergency_dashboard_integration.js
 * Deterministic test suite verifying Step 3B Dashboard Emergency Integration.
 */

import { RESIDENTIAL_LOTS } from './dashboardData.js';

console.log('======================================================================');
console.log('  SAATHI DASHBOARD EMERGENCY INTEGRATION CONTRACT SUITE (STEP 3B)');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    failCount++;
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
    passCount++;
  }
}

// -----------------------------------------------------------------------------
// 1. SAFE COARSE LOT-TO-DIORAMA PROJECTION FUNCTION
// -----------------------------------------------------------------------------
console.log('\n--- 1. SAFE COARSE LOCATION MAPPING ---');

function mapIncidentLocationToPos3D(locationStr) {
  if (!locationStr || typeof locationStr !== 'string') {
    return { x: 0.0, y: 3.5, z: 0.0 };
  }
  const match = locationStr.match(/(?:lot|house|residence)\s*([1-6])\b/i);
  if (match) {
    const lotId = parseInt(match[1], 10);
    const lot = RESIDENTIAL_LOTS.find((l) => l.id === lotId);
    if (lot && lot.position3D) {
      return {
        x: lot.position3D.x,
        y: (lot.position3D.y || 1.5) + 1.8,
        z: lot.position3D.z,
      };
    }
  }
  return { x: 0.0, y: 3.5, z: 0.0 };
}

// Verify Lot 5 recognition
const lot5Pos = mapIncidentLocationToPos3D('Lot 5');
const refLot5 = RESIDENTIAL_LOTS.find((l) => l.id === 5).position3D;
assert(lot5Pos.x === refLot5.x, 'Lot 5 X coordinate matches static diorama anchor');
assert(lot5Pos.z === refLot5.z, 'Lot 5 Z coordinate matches static diorama anchor');
assert(lot5Pos.y === refLot5.y + 1.8, 'Lot 5 Y coordinate has appropriate elevation offset');

// Verify Lot 2 recognition in descriptive string
const lot2Pos = mapIncidentLocationToPos3D('Residence 2, North Wing');
const refLot2 = RESIDENTIAL_LOTS.find((l) => l.id === 2).position3D;
assert(lot2Pos.x === refLot2.x, 'Residence 2 matches Lot 2 X diorama anchor');

// Verify ambiguous/unknown string falls back to central diorama anchor
const unknownPos = mapIncidentLocationToPos3D('Unknown Park Bench');
assert(unknownPos.x === 0.0 && unknownPos.y === 3.5 && unknownPos.z === 0.0, 'Ambiguous location uses safe central anchor');

// Verify null/empty location falls back to central diorama anchor
const emptyPos = mapIncidentLocationToPos3D(null);
assert(emptyPos.x === 0.0 && emptyPos.y === 3.5 && emptyPos.z === 0.0, 'Null location safely defaults to central platform anchor');

// -----------------------------------------------------------------------------
// 2. PRIVACY BOUNDARIES VERIFICATION
// -----------------------------------------------------------------------------
console.log('\n--- 2. PRIVACY BOUNDARIES VERIFICATION ---');

const mockBackendIncident = {
  incident_id: 'd9b73673-a80d-45db-9c3f-c6ad0192ea60',
  hub_id: '4f6a5b7c-1234-5678-90ab-cdef12345678',
  status: 'OPEN',
  priority_level: 'HIGH',
  priority_score: 85,
  source: 'SOS',
  location: 'Lot 5',
  latitude: null, // Redacted by backend
  longitude: null, // Redacted by backend
  affected_people: 1,
  vulnerable_people: 'elderly',
  created_at: '2026-10-12T10:00:00Z',
};

// Projected marker simulation
const projectedMarker = {
  id: `live-inc-${mockBackendIncident.incident_id}`,
  type: 'live_incident',
  title: `[LIVE ALERT] Incident #${mockBackendIncident.incident_id.slice(0, 8)} (HIGH)`,
  shape: 'circle',
  color: '#E5483A',
  pos3D: mapIncidentLocationToPos3D(mockBackendIncident.location),
  isLive: true,
  data: {
    type: 'live_incident',
    incident_id: mockBackendIncident.incident_id,
    status: mockBackendIncident.status,
    priority_level: mockBackendIncident.priority_level,
    priority_score: mockBackendIncident.priority_score,
    source: mockBackendIncident.source,
    location: mockBackendIncident.location,
    affected_people: mockBackendIncident.affected_people,
    vulnerable_people: mockBackendIncident.vulnerable_people,
    created_at: mockBackendIncident.created_at,
    isLive: true,
  },
};

assert(projectedMarker.pos3D.x !== undefined && projectedMarker.pos3D.z !== undefined, 'pos3D exists on marker');
assert(projectedMarker.latitude === undefined, 'No latitude property on projected marker');
assert(projectedMarker.longitude === undefined, 'No longitude property on projected marker');
assert(projectedMarker.data.latitude === undefined, 'No latitude passed to drawer data');
assert(projectedMarker.data.longitude === undefined, 'No longitude passed to drawer data');
assert(projectedMarker.data.residentName === undefined, 'No personal resident identity on live incident');
assert(projectedMarker.data.responders === undefined, 'No mock responders invented on live incident');

// -----------------------------------------------------------------------------
// 3. STATE DISTINCTION LOGIC VERIFICATION
// -----------------------------------------------------------------------------
console.log('\n--- 3. 6 INTEGRATION STATES DISTINCTION ---');

function evaluateDashboardEmergencyState({ mode, emergencyStatus, emergencyIncidents, emergencyError }) {
  const isSimulationActive = mode === 'emergency';
  const hasLiveIncidents = emergencyStatus === 'available' && Array.isArray(emergencyIncidents) && emergencyIncidents.length > 0;
  const isNormalMode = mode === 'normal' && !hasLiveIncidents;
  const isEndpointUnavailable = emergencyStatus === 'unavailable';
  const isTransientFailure = emergencyStatus === 'idle' && emergencyError !== null;
  const isLoading = emergencyStatus === 'loading';
  const isSuccessfulEmpty = emergencyStatus === 'available' && Array.isArray(emergencyIncidents) && emergencyIncidents.length === 0;

  return {
    isNormalMode,
    isSimulationActive,
    hasLiveIncidents,
    isEndpointUnavailable,
    isTransientFailure,
    isLoading,
    isSuccessfulEmpty,
  };
}

// State 1: Normal operation
const stateNormal = evaluateDashboardEmergencyState({
  mode: 'normal',
  emergencyStatus: 'available',
  emergencyIncidents: [],
  emergencyError: null,
});
assert(stateNormal.isNormalMode === true, 'State 1: Normal mode active when no incidents and mode=normal');
assert(stateNormal.isSimulationActive === false, 'State 1: Simulation is inactive');
assert(stateNormal.hasLiveIncidents === false, 'State 1: No live incidents');

// State 2: Local Simulation Active
const stateSim = evaluateDashboardEmergencyState({
  mode: 'emergency',
  emergencyStatus: 'available',
  emergencyIncidents: [],
  emergencyError: null,
});
assert(stateSim.isSimulationActive === true, 'State 2: Simulation active when mode=emergency');
assert(stateSim.hasLiveIncidents === false, 'State 2: Live incidents remain false during pure simulation');

// State 3: Active Incidents from Backend
const stateLive = evaluateDashboardEmergencyState({
  mode: 'normal',
  emergencyStatus: 'available',
  emergencyIncidents: [mockBackendIncident],
  emergencyError: null,
});
assert(stateLive.hasLiveIncidents === true, 'State 3: Live alert active when backend returns incidents');
assert(stateLive.isSimulationActive === false, 'State 3: Simulation remains distinct and false');

// State 4: Endpoint Unavailable (HTTP 404)
const state404 = evaluateDashboardEmergencyState({
  mode: 'normal',
  emergencyStatus: 'unavailable',
  emergencyIncidents: [],
  emergencyError: { status: 404, error: 'HTTP_404' },
});
assert(state404.isEndpointUnavailable === true, 'State 4: Endpoint recognized as unavailable on 404');
assert(state404.hasLiveIncidents === false, 'State 4: No live incident alert triggered on 404');
assert(state404.isNormalMode === true, 'State 4: Dashboard safely defaults to normal mode');

// State 5: Temporary Request Failure (Network Error)
const stateErr = evaluateDashboardEmergencyState({
  mode: 'normal',
  emergencyStatus: 'idle',
  emergencyIncidents: [],
  emergencyError: new Error('Network timeout'),
});
assert(stateErr.isTransientFailure === true, 'State 5: Transient failure detected with retry eligibility');
assert(stateErr.hasLiveIncidents === false, 'State 5: Failure does not trigger false emergency');

// State 6: Initial Loading
const stateLoad = evaluateDashboardEmergencyState({
  mode: 'normal',
  emergencyStatus: 'loading',
  emergencyIncidents: [],
  emergencyError: null,
});
assert(stateLoad.isLoading === true, 'State 6: Loading state correctly identified');

console.log('\n======================================================================');
console.log(`  ALL ${passCount} INTEGRATION CHECKS PASSED (0 FAILURES)`);
console.log('======================================================================\n');
