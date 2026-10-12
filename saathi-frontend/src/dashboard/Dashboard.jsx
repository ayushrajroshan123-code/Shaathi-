import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardTopBar from './DashboardTopBar';
import DashboardSidebar from './DashboardSidebar';
import NeighborhoodViewport from './NeighborhoodViewport';
import NeighborhoodPulse from './NeighborhoodPulse';
import MyCoordinationSection from './MyCoordinationSection';
import ContextSurface from './ContextSurface';
import AskModal from './AskModal';
import {
  RESIDENTIAL_LOTS,
  NEIGHBORHOOD_ISSUES,
  NEIGHBORHOOD_QUERIES,
  SHARED_RESOURCES,
  BORROW_REQUESTS,
  COORDINATION_RECORDS,
  COORDINATION_EVENTS,
  BLOCKED_USERS,
  SAFETY_REPORTS,
  COORDINATION_MESSAGES,
  PILOT_HUB_INFO,
  CURRENT_USER,
} from './dashboardData';
import { isDemoMode } from '../utils/demoConfig';
import {
  listResources,
  listInboundRequests,
  listOutboundRequests,
  createResourceRequest,
  approveResourceRequest,
  declineResourceRequest,
  cancelResourceRequest,
} from '../api/resources';
import {
  listCoordinations,
  getCoordination,
  transitionCoordination,
  initiateReturn,
  confirmReturn,
  listCoordinationMessages,
  sendCoordinationMessage,
} from '../api/coordinations';
import { blockUser, listBlockedUsers } from '../api/users';
import { createConductReport } from '../api/conduct';
import { listCoverageRequests, createCoverageRequest, acceptCoverageRequest } from '../api/coverage';
import { listIssues, updateIssueStatus } from '../api/issues';
import { listQueries, reportQuery, reportAnswer } from '../api/queries';
import { apiClient } from '../api/client';
import { useEmergencyState } from '../hooks/useEmergencyState.js';

/**
 * Dashboard
 * Canonical SAATHI User Dashboard implementing the Locked Implementation Contract.
 * 
 * Hierarchy:
 * TOP NAV
 *   ↓
 * GREETING (above 3D)
 *   ↓
 * MY SAATHI (personal left rail) | 3D NEIGHBORHOOD (50–60vh)
 *   ↓
 * NEIGHBORHOOD PULSE (4 controls)
 *   ↓
 * MY COORDINATION (operational workspace: INCOMING, OUTGOING, ACTIVE, RETURNS, COMPLETED)
 * 
 * Overlay:
 * CONTEXTSURFACE (Right-side overlay drawer, 320–420px, active ONLY on selection)
 */
export default function Dashboard({ onLogout, onNavigateLanding, currentUser }) {
  const [mode, setMode] = useState('normal'); // 'normal' | 'emergency'
  const [activeNav, setActiveNav] = useState('overview'); // 'overview' | 'coverage' | 'resources' | 'issues'
  const [activeLayer, setActiveLayer] = useState(null); // 'coverage' | 'resources' | 'issues' | null
  const [searchQuery, setSearchQuery] = useState('');
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [askCategory, setAskCategory] = useState('coverage');

  // Server-authoritative emergency incident state (read-only integration)
  const {
    status: emergencyStatus,
    incidents: emergencyIncidents,
    error: emergencyError,
    refresh: refreshEmergency,
  } = useEmergencyState({ autoFetch: true });

  const demoActive = isDemoMode();
  const isAuthenticated = Boolean(currentUser || apiClient.getToken());

  // Authenticated user resolution: backend profile takes precedence over fallback mock
  const activeUser = useMemo(() => {
    if (!currentUser) return CURRENT_USER;
    return {
      ...currentUser,
      id: currentUser.id || currentUser.user_id,
      name: currentUser.name || (demoActive ? CURRENT_USER.name : 'Neighbor'),
      lotId: currentUser.lotId || (currentUser.lot_id ? parseInt(currentUser.lot_id, 10) : (demoActive ? CURRENT_USER.lotId : null)),
      avatar: currentUser.avatar || (currentUser.name ? currentUser.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'ME'),
      role: currentUser.role ? (currentUser.role === 'resident' ? `Resident (${currentUser.name})` : currentUser.role) : 'resident',
      address: currentUser.address || (demoActive ? CURRENT_USER.address : null),
    };
  }, [currentUser, demoActive]);

  // Authenticated sessions must NEVER inherit fictional mock data; they load exclusively from live APIs.
  // Fictional preview collections are used ONLY in unauthenticated preview mode when demo mode is active.
  const useMockPreview = !isAuthenticated && demoActive;

  // Core Data Source of Truth in In-Memory State
  const [lots, setLots] = useState(RESIDENTIAL_LOTS);
  const [issues, setIssues] = useState(useMockPreview ? NEIGHBORHOOD_ISSUES : []);
  const [resources, setResources] = useState(useMockPreview ? SHARED_RESOURCES : []);
  const [borrowRequests, setBorrowRequests] = useState(useMockPreview ? BORROW_REQUESTS : []);
  const [coordinationList, setCoordinationList] = useState(useMockPreview ? COORDINATION_RECORDS : []);
  const [queries, setQueries] = useState(useMockPreview ? NEIGHBORHOOD_QUERIES : []);
  const [blockedUserIds, setBlockedUserIds] = useState(useMockPreview ? BLOCKED_USERS : []);
  const [safetyReports, setSafetyReports] = useState(useMockPreview ? SAFETY_REPORTS : []);
  const [coordinationMessages, setCoordinationMessages] = useState(useMockPreview ? COORDINATION_MESSAGES : []);
  const [coordinationEvents, setCoordinationEvents] = useState(useMockPreview ? COORDINATION_EVENTS : []);
  const [userRoleMode, setUserRoleMode] = useState('resident'); // 'resident' | 'resource_owner'

  // Server-authoritative Loading & Error States
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState(null);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState(null);
  const [coordinationsLoading, setCoordinationsLoading] = useState(false);
  const [coordinationsError, setCoordinationsError] = useState(null);
  const [coordinationTabsData, setCoordinationTabsData] = useState({
    ACTIVE: [],
    UPCOMING: [],
    RETURNS: [],
    COMPLETED: [],
    SAFETY: [],
  });
  const [queriesLoading, setQueriesLoading] = useState(false);
  const [queriesError, setQueriesError] = useState(null);

  // Canonical Selection & Filter States
  const [activePulseFilter, setActivePulseFilter] = useState(null); // null | 'attention' | 'coordination' | 'resources' | 'my-areas'
  const [selectedLotId, setSelectedLotId] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [highlightedLotIds, setHighlightedLotIds] = useState([]); // Scalable: only highlighted when explicitly requested

  // ---------------------------------------------------------------------------
  // SERVER DATA LOADERS (Authoritative API Integration)
  // ---------------------------------------------------------------------------
  const loadLiveResources = useCallback(async () => {
    if (!apiClient.getToken()) return;
    setResourcesLoading(true);
    setResourcesError(null);
    try {
      const list = await listResources();
      if (Array.isArray(list)) {
        const normalized = list.map((r) => ({
          id: r.resource_id,
          resource_id: r.resource_id,
          name: r.name,
          type: r.type,
          category: r.type,
          condition: r.condition,
          generalArea: r.general_area,
          general_area: r.general_area,
          handoffPolicy: r.handoff_policy,
          handoff_policy: r.handoff_policy,
          available: r.available,
          requiresApproval: r.requires_approval,
          requires_approval: r.requires_approval,
        }));
        setResources(normalized);
      }
    } catch (err) {
      setResourcesError(err?.message || 'Failed to load resources');
      // Do not silently fallback to stale mocks if live API fails
      setResources([]);
    } finally {
      setResourcesLoading(false);
    }
  }, []);

  const loadLiveRequests = useCallback(async () => {
    if (!apiClient.getToken()) return;
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const [inbound, outbound] = await Promise.all([
        listInboundRequests().catch((e) => {
          console.warn('Inbound requests fetch failed:', e);
          return [];
        }),
        listOutboundRequests().catch((e) => {
          console.warn('Outbound requests fetch failed:', e);
          return [];
        }),
      ]);

      const normalizedInbound = (Array.isArray(inbound) ? inbound : []).map((r) => ({
        id: r.request_id,
        requestId: r.request_id,
        request_id: r.request_id,
        resourceId: r.resource_id,
        resource_id: r.resource_id,
        resourceName: r.resource_name,
        resource_name: r.resource_name,
        requesterId: r.requester_id,
        requester_id: r.requester_id,
        requesterName: r.requester_name,
        requester_name: r.requester_name,
        purpose: r.purpose,
        requestedTime: r.time_window_start
          ? `${new Date(r.time_window_start).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${new Date(r.time_window_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          : 'Requested time',
        time_window_start: r.time_window_start,
        time_window_end: r.time_window_end,
        duration: r.duration,
        handoffPreference: r.handoff_preference,
        handoff_preference: r.handoff_preference,
        message: r.message,
        status: r.status,
        createdAt: r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Recently',
        created_at: r.created_at,
        requesterTrust: r.requester_trust
          ? {
              verified: Boolean(r.requester_trust.identity_verified && r.requester_trust.neighborhood_verified),
              identity_verified: r.requester_trust.identity_verified,
              neighborhood_verified: r.requester_trust.neighborhood_verified,
              membershipAge: r.requester_trust.membership_age,
              membership_age: r.requester_trust.membership_age,
              completedCoordinations: r.requester_trust.completed_coordinations,
              completed_coordinations: r.requester_trust.completed_coordinations,
              noOutstandingReturns: r.requester_trust.no_outstanding_returns,
              no_outstanding_returns: r.requester_trust.no_outstanding_returns,
              eligible: r.requester_trust.eligible,
            }
          : null,
        isIncoming: true,
        ownerId: activeUser.id,
      }));

      const normalizedOutbound = (Array.isArray(outbound) ? outbound : []).map((r) => ({
        id: r.request_id,
        requestId: r.request_id,
        request_id: r.request_id,
        resourceId: r.resource_id,
        resource_id: r.resource_id,
        resourceName: r.resource_name,
        resource_name: r.resource_name,
        requesterId: activeUser.id,
        requester_id: activeUser.id,
        purpose: r.purpose,
        requestedTime: r.time_window_start
          ? `${new Date(r.time_window_start).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${new Date(r.time_window_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          : 'Requested time',
        time_window_start: r.time_window_start,
        time_window_end: r.time_window_end,
        duration: r.duration,
        handoffPreference: r.handoff_preference,
        handoff_preference: r.handoff_preference,
        counterpartDisplay: r.counterpart_display,
        counterpart_display: r.counterpart_display,
        status: r.status,
        createdAt: r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Recently',
        created_at: r.created_at,
        isOutgoing: true,
      }));

      setBorrowRequests([...normalizedInbound, ...normalizedOutbound]);
    } catch (err) {
      setRequestsError(err?.message || 'Failed to load requests');
      setBorrowRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, [activeUser.id]);

  const loadLiveCoordinations = useCallback(async () => {
    if (!apiClient.getToken()) return;
    setCoordinationsLoading(true);
    setCoordinationsError(null);
    try {
      const [active, upcoming, returns, completed, safety] = await Promise.all([
        listCoordinations('ACTIVE').catch((e) => {
          console.warn('Active coordinations fetch failed:', e);
          return [];
        }),
        listCoordinations('UPCOMING').catch((e) => {
          console.warn('Upcoming coordinations fetch failed:', e);
          return [];
        }),
        listCoordinations('RETURNS').catch((e) => {
          console.warn('Returns coordinations fetch failed:', e);
          return [];
        }),
        listCoordinations('COMPLETED').catch((e) => {
          console.warn('Completed coordinations fetch failed:', e);
          return [];
        }),
        listCoordinations('SAFETY').catch((e) => {
          console.warn('Safety coordinations fetch failed:', e);
          return [];
        }),
      ]);

      const normalizeList = (list) =>
        Array.isArray(list)
          ? list.map((c) => ({
              id: c.coordination_id,
              coordination_id: c.coordination_id,
              coordinationId: c.coordination_id,
              resourceId: c.resource_id,
              resource_id: c.resource_id,
              resourceName: c.resource_name,
              resource_name: c.resource_name,
              title: c.resource_name || 'Community Resource',
              role: c.role,
              counterpartRole: c.counterpart_role,
              counterpart_role: c.counterpart_role,
              counterpartDisplay: c.counterpart_display,
              counterpart_display: c.counterpart_display,
              state: c.state,
              status: c.state ? c.state.toLowerCase() : 'active',
              purpose: c.purpose,
              handoffLocation: c.handoff_location,
              handoff_location: c.handoff_location,
              scheduledTime: c.scheduled_time
                ? `${new Date(c.scheduled_time).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${new Date(c.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : null,
              scheduled_time: c.scheduled_time,
              dueTime: c.due_time
                ? `${new Date(c.due_time).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${new Date(c.due_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : null,
              due_time: c.due_time,
              time: c.due_time || c.scheduled_time,
              borrowerReturnInitiated: Boolean(c.borrower_return_initiated),
              borrower_return_initiated: Boolean(c.borrower_return_initiated),
              ownerReturnConfirmed: Boolean(c.owner_return_confirmed),
              owner_return_confirmed: Boolean(c.owner_return_confirmed),
              createdAt: c.created_at,
              created_at: c.created_at,
              completedAt: c.completed_at
                ? `${new Date(c.completed_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${new Date(c.completed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : null,
              completed_at: c.completed_at,
              events: Array.isArray(c.events) ? c.events : [],
              messages: Array.isArray(c.messages) ? c.messages : [],
              type: 'coordination',
              badge: 'Resource',
              actionText: 'View Details',
            }))
          : [];

      const tabsData = {
        ACTIVE: normalizeList(active),
        UPCOMING: normalizeList(upcoming),
        RETURNS: normalizeList(returns),
        COMPLETED: normalizeList(completed),
        SAFETY: normalizeList(safety),
      };

      setCoordinationTabsData(tabsData);

      const allCoordsMap = new Map();
      [...tabsData.ACTIVE, ...tabsData.UPCOMING, ...tabsData.RETURNS, ...tabsData.COMPLETED, ...tabsData.SAFETY].forEach((item) => {
        allCoordsMap.set(item.id, item);
      });
      setCoordinationList(Array.from(allCoordsMap.values()));
    } catch (err) {
      setCoordinationsError(err?.message || 'Failed to load coordinations');
      setCoordinationList([]);
      setCoordinationTabsData({ ACTIVE: [], UPCOMING: [], RETURNS: [], COMPLETED: [], SAFETY: [] });
    } finally {
      setCoordinationsLoading(false);
    }
  }, []);

  const [coverageList, setCoverageList] = useState([]);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageError, setCoverageError] = useState(null);

  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState(null);

  const loadLiveIssues = useCallback(async () => {
    if (!apiClient.getToken()) return;
    setIssuesLoading(true);
    setIssuesError(null);
    try {
      const list = await listIssues();
      if (Array.isArray(list)) {
        setIssues(list);
      }
    } catch (err) {
      setIssuesError(err?.message || 'Failed to load issues');
      setIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  }, []);

  const loadLiveQueries = useCallback(async () => {
    if (!apiClient.getToken()) return;
    setQueriesLoading(true);
    setQueriesError(null);
    try {
      const list = await listQueries();
      if (Array.isArray(list)) {
        // Map backend fields to frontend expected fields if necessary, or just use as is.
        const normalized = list.map(q => ({
          id: q.query_id,
          query_id: q.query_id,
          lotId: q.lot_id,
          status: q.status,
          title: q.title,
          body: q.body,
          type: 'query',
          creatorId: q.creator_id,
          creatorName: q.creator_name,
          creator_id: q.creator_id,
          creator_name: q.creator_name,
          createdAt: q.created_at,
          created_at: q.created_at,
          resolvedAt: q.resolved_at,
          resolved_at: q.resolved_at,
          helpful_answer_id: q.helpful_answer_id,
        }));
        setQueries(normalized);
      }
    } catch (err) {
      setQueriesError(err?.message || 'Failed to load queries');
      setQueries([]);
    } finally {
      setQueriesLoading(false);
    }
  }, []);

  const handleUpdateIssueStatus = useCallback(async (issueId, status, reason) => {
    if (!apiClient.getToken()) return;
    const result = await updateIssueStatus(issueId, { status, reason });
    await loadLiveIssues();
    return result;
  }, [loadLiveIssues]);

  const loadLiveCoverage = useCallback(async () => {
    if (!apiClient.getToken()) return;
    setCoverageLoading(true);
    setCoverageError(null);
    try {
      const list = await listCoverageRequests();
      setCoverageList(Array.isArray(list) ? list : []);
    } catch (err) {
      setCoverageError(err?.message || 'Failed to load coverage requests');
      setCoverageList([]);
    } finally {
      setCoverageLoading(false);
    }
  }, []);

  const handleAcceptCoverage = async (coverageId) => {
    if (!coverageId) return;
    try {
      await acceptCoverageRequest(coverageId);
      await loadLiveCoverage();
    } catch (err) {
      console.error('Accept coverage failed:', err);
      throw err;
    }
  };

  const loadLiveBlockedUsers = useCallback(async () => {
    if (!apiClient.getToken()) return;
    try {
      const list = await listBlockedUsers();
      if (Array.isArray(list)) {
        const ids = list
          .map((b) => b.blocked_user_id || b.target_user_id || b.id || b)
          .filter(Boolean);
        setBlockedUserIds(ids);
      }
    } catch (err) {
      console.warn('Blocked users fetch failed:', err);
    }
  }, []);

  useEffect(() => {
    if (apiClient.getToken()) {
      loadLiveResources();
      loadLiveRequests();
      loadLiveCoordinations();
      loadLiveBlockedUsers();
      loadLiveCoverage();
      loadLiveIssues();
      loadLiveQueries();
    }
  }, [loadLiveResources, loadLiveRequests, loadLiveCoordinations, loadLiveBlockedUsers, loadLiveCoverage, loadLiveIssues, loadLiveQueries, currentUser]);

  // ---------------------------------------------------------------------------
  // DERIVED SELECTORS
  // ---------------------------------------------------------------------------
  const attentionRecords = useMemo(() => {
    return issues.filter((i) => i.status !== 'Resolved');
  }, [issues]);

  const attentionLotIds = useMemo(() => {
    return [...new Set(attentionRecords.map((i) => i.lotId).filter(Boolean))];
  }, [attentionRecords]);

  // Decoupled, Privacy-Safe Resources Discovery
  const availableResources = useMemo(() => {
    return resources.filter((r) => {
      if (r._owner && blockedUserIds.includes(r._owner.id)) return false;
      return r.available !== false;
    });
  }, [resources, blockedUserIds]);

  const activeCoordinations = useMemo(() => {
    if (apiClient.getToken() && coordinationTabsData.ACTIVE) {
      return coordinationTabsData.ACTIVE;
    }
    return coordinationList.filter(
      (c) => c.state !== 'COMPLETED' && c.state !== 'CANCELLED' && c.state !== 'DECLINED' && c.status !== 'completed' && c.status !== 'returned'
    );
  }, [coordinationList, coordinationTabsData]);

  const incomingRequests = useMemo(() => {
    return borrowRequests.filter(
      (r) => (r.isIncoming || r.ownerId === activeUser.id || userRoleMode === 'resource_owner') && r.status === 'REQUESTED' && !blockedUserIds.includes(r.requesterId)
    );
  }, [borrowRequests, blockedUserIds, userRoleMode, activeUser.id]);

  const outgoingRequests = useMemo(() => {
    return borrowRequests.filter((r) => r.isOutgoing || r.requesterId === activeUser.id);
  }, [borrowRequests, activeUser.id]);

  const returnsDue = useMemo(() => {
    if (apiClient.getToken() && coordinationTabsData.RETURNS) {
      return coordinationTabsData.RETURNS;
    }
    return coordinationList.filter(
      (c) => c.state === 'RETURN_DUE' || c.state === 'RETURN_PENDING'
    );
  }, [coordinationList, coordinationTabsData]);

  const myAreaLotIds = useMemo(() => {
    return [activeUser.lotId || 4];
  }, [activeUser.lotId]);

  // ---------------------------------------------------------------------------
  // ROUTING & URL SYNCHRONIZATION (Parts 35–37)
  // ---------------------------------------------------------------------------
  const resolveLotFromHash = useCallback(
    (hash) => {
      if (!hash || hash === '#dashboard' || hash === '#') {
        setSelectedLotId(null);
        setSelectedEntity(null);
        return;
      }

      if (hash === '#resources') {
        setActivePulseFilter('resources');
        setSelectedEntity({ type: 'discovery', category: 'resources' });
        setActiveLayer('resources');
        setActiveNav('resources');
        return;
      }

      if (hash === '#coordination') {
        setActivePulseFilter('coordination');
        setSelectedEntity({ type: 'discovery', category: 'coordination' });
        setActiveNav('overview');
        return;
      }

      if (hash === '#attention' || hash === '#issues') {
        setActivePulseFilter('attention');
        setSelectedEntity({ type: 'discovery', category: 'attention' });
        setActiveLayer('issues');
        setActiveNav('issues');
        return;
      }

      const match = hash.match(/^#dashboard\/lot-(\d+)$/);
      if (match) {
        const lotNum = parseInt(match[1], 10);
        const targetLot = lots.find((l) => l.id === lotNum);
        if (targetLot) {
          // Lot found: select without altering camera
          setSelectedLotId(lotNum);
          setSelectedEntity(targetLot);
        } else {
          // Part 37: Invalid lot URL fallback to #dashboard
          setSelectedLotId(null);
          setSelectedEntity(null);
          if (window.location.hash !== '#dashboard') {
            window.location.hash = '#dashboard';
          }
        }
      }
    },
    [lots]
  );

  useEffect(() => {
    resolveLotFromHash(window.location.hash);

    const handleHash = () => {
      resolveLotFromHash(window.location.hash);
    };

    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [resolveLotFromHash]);

  // ---------------------------------------------------------------------------
  // SELECTION & DISMISS RULES (Parts 26, 32, 33, 84, 85)
  // ---------------------------------------------------------------------------
  const handleSelectLot = useCallback(
    (lotId) => {
      if (selectedLotId === lotId && (!selectedEntity || selectedEntity.id === lotId)) {
        // Close Method 4: User clicks currently selected lot again -> deselect (Part 32)
        setSelectedLotId(null);
        setSelectedEntity(null);
        setHighlightedLotIds([]);
        window.location.hash = '#dashboard';
      } else {
        // Direct transition to new lot (Part 33)
        const targetLot = lots.find((l) => l.id === lotId);
        if (targetLot) {
          setSelectedLotId(lotId);
          setSelectedEntity(targetLot);
          setHighlightedLotIds([lotId]);
          setActivePulseFilter(null);
          window.location.hash = `#dashboard/lot-${lotId}`;
        }
      }
    },
    [selectedLotId, selectedEntity, lots]
  );

  const handleClearSelection = useCallback(() => {
    // Close Method 1, 2, 3: close button, Escape, empty scene click
    setSelectedLotId(null);
    setSelectedEntity(null);
    setActivePulseFilter(null);
    setHighlightedLotIds([]);
    if (window.location.hash !== '#dashboard') {
      window.location.hash = '#dashboard';
    }
  }, []);

  // Scalable Pulse discovery toggle
  const handleTogglePulseFilter = (filterId) => {
    if (activePulseFilter === filterId) {
      setActivePulseFilter(null); // Click again closes discovery
      setSelectedEntity(null);
      setHighlightedLotIds([]);
    } else {
      setActivePulseFilter(filterId); // Opens Category Discovery in ContextSurface
      setSelectedEntity({ type: 'discovery', category: filterId });
      setHighlightedLotIds([]); // Do NOT automatically highlight all lots (scalability guarantee)
    }
  };

  // "Show on neighborhood" spatial bridge (highlights specific lot in 3D, camera invariant)
  const handleShowOnNeighborhood = useCallback((lotId) => {
    if (!lotId) return;
    setHighlightedLotIds([lotId]);
    setSelectedLotId(lotId);
    // Camera is untouched!
  }, []);

  // ---------------------------------------------------------------------------
  // CANONICAL COORDINATION & RESOURCE LIFECYCLE HANDLERS
  // Flow: REQUEST -> OWNER APPROVE -> COORDINATE -> TWO-PARTY RETURN -> COMPLETE
  // ---------------------------------------------------------------------------

  // 1. Create Borrow Request (Stage 2)
  const handleCreateBorrowRequest = useCallback(
    async ({ resourceId, purpose, requestedTime, duration, handoffPreference, message }) => {
      if (!apiClient.getToken()) {
        const targetRes = resources.find((r) => r.id === resourceId);
        const newRequest = {
          id: `req-${Date.now()}`,
          resourceId,
          resourceName: targetRes ? targetRes.name : 'Shared Resource',
          ownerId: targetRes?._owner?.id || 'usr-marcus-03',
          ownerName: targetRes?._owner?.name || 'Marcus Vance',
          requesterId: activeUser.id,
          requesterName: activeUser.name,
          purpose: purpose || 'General neighborhood project',
          requestedTime: requestedTime || 'Today · 6:00 PM',
          duration: duration || '~1 hour',
          handoffPreference: handoffPreference || 'Community pickup at Cafe Courtyard',
          message: message || '',
          status: 'REQUESTED',
          createdAt: 'Just now',
          isOutgoing: true,
          requesterTrust: {
            verified: true,
            membershipAge: '8 months',
            completedCoordinations: 6,
            noOutstandingReturns: true,
          },
        };

        setBorrowRequests((prev) => [newRequest, ...prev]);
        setCoordinationEvents((prev) => [
          {
            id: `ev-${Date.now()}`,
            type: 'REQUEST_CREATED',
            requestId: newRequest.id,
            timestamp: 'Just now',
            summary: `Borrow request submitted for ${newRequest.resourceName}`,
          },
          ...prev,
        ]);

        return newRequest;
      }

      // Live backend execution: compute valid ISO time window
      const now = Date.now();
      const start = new Date(now + 60 * 1000); // starts 1 min from now
      let durationHours = 1;
      if (duration && duration.includes('2-3')) durationHours = 3;
      else if (duration && duration.includes('Half')) durationHours = 4;
      else if (duration && duration.includes('Full')) durationHours = 8;
      const end = new Date(start.getTime() + durationHours * 3600 * 1000);

      const payload = {
        resource_id: resourceId,
        time_window_start: start.toISOString(),
        time_window_end: end.toISOString(),
        purpose: purpose || 'General neighborhood project',
        duration: duration || '~1 hour',
        handoff_preference: handoffPreference || 'Community pickup at Cafe Courtyard',
        message: message || '',
      };

      const serverResponse = await createResourceRequest(payload);
      await loadLiveRequests();
      return {
        id: serverResponse.request_id,
        requestId: serverResponse.request_id,
        resourceId: serverResponse.resource_id,
        resourceName: serverResponse.resource_name,
        status: serverResponse.status,
        isOutgoing: true,
      };
    },
    [resources, activeUser.id, activeUser.name, loadLiveRequests]
  );

  // 2. Owner Approve Request (Stage 3 -> Stage 4)
  const handleOwnerApprove = useCallback(
    async (requestId) => {
      if (!apiClient.getToken()) {
        setBorrowRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: 'APPROVED' } : r))
        );

        const targetReq = borrowRequests.find((r) => r.id === requestId);
        if (targetReq) {
          const newCoord = {
            id: `coord-${Date.now()}`,
            requestId: targetReq.id,
            resourceId: targetReq.resourceId,
            resourceName: targetReq.resourceName,
            title: `Lending ${targetReq.resourceName}`,
            role: targetReq.ownerId === activeUser.id ? 'lending' : 'borrowing',
            counterpartRole: 'Borrower',
            counterpartDisplay: `${targetReq.requesterName.split(' ')[0]} (Verified Neighbor)`,
            ownerId: targetReq.ownerId,
            requesterId: targetReq.requesterId,
            state: 'SCHEDULED',
            status: 'upcoming',
            purpose: targetReq.purpose,
            handoffLocation: targetReq.handoffPreference,
            scheduledTime: targetReq.requestedTime,
            dueTime: targetReq.requestedTime,
            time: targetReq.requestedTime,
            borrowerReturnInitiated: false,
            ownerReturnConfirmed: false,
            type: 'resource',
            badge: 'Resource',
            actionText: 'View Details',
          };

          setCoordinationList((prev) => [newCoord, ...prev]);

          setResources((prev) =>
            prev.map((res) => (res.id === targetReq.resourceId ? { ...res, available: false } : res))
          );
        }
        return;
      }

      // Live backend execution: server-authoritative approval
      const result = await approveResourceRequest(requestId);
      await Promise.all([loadLiveRequests(), loadLiveResources(), loadLiveCoordinations()]);
      return result;
    },
    [borrowRequests, activeUser.id, loadLiveRequests, loadLiveResources, loadLiveCoordinations]
  );

  // 3. Owner Decline Request (Normal decline - NOT a report)
  const handleOwnerDecline = useCallback(
    async (requestId, reason) => {
      if (!apiClient.getToken()) {
        setBorrowRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: 'DECLINED', declineReason: reason } : r))
        );
        return;
      }

      // Live backend execution: server-authoritative decline
      const result = await declineResourceRequest(requestId, reason);
      await loadLiveRequests();
      return result;
    },
    [loadLiveRequests]
  );

  // 3B. Borrower Cancel Request
  const handleRequesterCancel = useCallback(
    async (requestId) => {
      if (!apiClient.getToken()) {
        setBorrowRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: 'CANCELLED' } : r))
        );
        return;
      }

      // Live backend execution: server-authoritative cancellation
      const result = await cancelResourceRequest(requestId);
      await loadLiveRequests();
      return result;
    },
    [loadLiveRequests]
  );

  // 4. Block Member (One-click protection without forced explanation)
  const handleBlockMember = useCallback(
    async (targetUserId) => {
      if (!targetUserId) return;
      if (!apiClient.getToken()) {
        setBlockedUserIds((prev) => [...new Set([...prev, targetUserId])]);
        setBorrowRequests((prev) =>
          prev.map((r) =>
            r.requesterId === targetUserId || r.ownerId === targetUserId
              ? { ...r, status: 'BLOCKED' }
              : r
          )
        );
        return;
      }

      // Live backend execution: server-authoritative block
      await blockUser(targetUserId);
      setBlockedUserIds((prev) => [...new Set([...prev, targetUserId])]);
      await Promise.all([
        loadLiveBlockedUsers(),
        loadLiveResources(),
        loadLiveRequests(),
        loadLiveCoordinations(),
      ]);
    },
    [loadLiveBlockedUsers, loadLiveResources, loadLiveRequests, loadLiveCoordinations]
  );

  // 5. Private Safety Report (Coordinator-only accountability, never public)
  const handleReportConcern = useCallback(
    async ({ contextId, contextType, reportedUserId, category, description, answerId }) => {
      if (!reportedUserId) return;
      if (!apiClient.getToken()) {
        const newReport = {
          id: `rep-${Date.now()}`,
          contextId,
          reportedUserId,
          reportedBy: activeUser.id,
          category: category || 'general',
          description: description || '',
          createdAt: 'Just now',
          status: 'UNDER_REVIEW',
        };
        setSafetyReports((prev) => [newReport, ...prev]);
        return newReport;
      }

      if (contextType === 'query' && contextId) {
        return await reportQuery(contextId, { category: category || 'safety_concern', description: description || null });
      }
      if (contextType === 'answer' && contextId && answerId) {
        return await reportAnswer(contextId, answerId, { category: category || 'safety_concern', description: description || null });
      }

      // Live backend execution: server-authoritative conduct report
      // Important: context_type must never be "coordination" (DB check constraint allows 'coverage', 'resource', 'general')
      let safeContextType = contextType === 'resource' ? 'resource' : (contextId ? 'resource' : 'general');
      const payload = {
        reported_against: reportedUserId,
        context_type: safeContextType,
        context_id: safeContextType === 'resource' ? contextId : null,
        category: category || 'safety_concern',
        description: description || null,
      };

      return await createConductReport(payload);
    },
    [activeUser.id]
  );

  // 5B. Transition Coordination State
  const handleTransitionCoordination = useCallback(
    async (coordinationId, toState, note) => {
      if (!apiClient.getToken()) {
        setCoordinationList((prev) =>
          prev.map((c) => (c.id === coordinationId ? { ...c, state: toState, status: toState.toLowerCase() } : c))
        );
        return;
      }
      const result = await transitionCoordination(coordinationId, toState, note);
      await loadLiveCoordinations();
      return result;
    },
    [loadLiveCoordinations]
  );

  // 6. Two-Party Return: Borrower Initiates Return
  const handleBorrowerStartReturn = useCallback(
    async (coordinationId) => {
      if (!apiClient.getToken()) {
        setCoordinationList((prev) =>
          prev.map((c) =>
            c.id === coordinationId
              ? {
                  ...c,
                  state: 'RETURN_PENDING',
                  status: 'return_pending',
                  borrowerReturnInitiated: true,
                  returnedAt: 'Just now',
                }
              : c
          )
        );

        setCoordinationEvents((prev) => [
          {
            id: `ev-${Date.now()}`,
            type: 'RETURN_INITIATED',
            coordinationId,
            timestamp: 'Just now',
            summary: `Borrower initiated return`,
          },
          ...prev,
        ]);
        return;
      }

      const result = await initiateReturn(coordinationId);
      await loadLiveCoordinations();
      return result;
    },
    [loadLiveCoordinations]
  );

  // 7. Two-Party Return: Owner Confirms Receipt
  const handleOwnerConfirmReturn = useCallback(
    async (coordinationId) => {
      if (!apiClient.getToken()) {
        let freedResourceId = null;
        setCoordinationList((prev) =>
          prev.map((c) => {
            if (c.id === coordinationId) {
              freedResourceId = c.resourceId;
              return {
                ...c,
                state: 'COMPLETED',
                status: 'completed',
                ownerReturnConfirmed: true,
                completedAt: 'Today · Just now',
              };
            }
            return c;
          })
        );

        // Make resource available again in shared inventory
        if (freedResourceId) {
          setResources((prev) =>
            prev.map((r) => (r.id === freedResourceId ? { ...r, available: true } : r))
          );
        }

        setCoordinationEvents((prev) => [
          {
            id: `ev-${Date.now()}`,
            type: 'COORDINATION_COMPLETED',
            coordinationId,
            timestamp: 'Just now',
            summary: `Owner confirmed return. Coordination completed safely.`,
          },
          ...prev,
        ]);
        return;
      }

      const result = await confirmReturn(coordinationId);
      await Promise.all([loadLiveCoordinations(), loadLiveResources()]);
      return result;
    },
    [loadLiveCoordinations, loadLiveResources]
  );

  // 8. Coordination Messaging
  const handleSendCoordinationMessage = useCallback(
    async (coordinationId, messageText) => {
      if (!apiClient.getToken()) {
        return { text: messageText, created_at: new Date().toISOString() };
      }
      return await sendCoordinationMessage(coordinationId, messageText);
    },
    []
  );

  // Legacy return adapter for compatibility with automated contract test suite
  const handleReturnResource = async (coordinationId, resourceId) => {
    await handleBorrowerStartReturn(coordinationId);
    await handleOwnerConfirmReturn(coordinationId);
    return Promise.resolve({ success: true });
  };

  const handleCompleteCoordination = (coordinationId) => {
    setCoordinationList((prev) =>
      prev.map((c) => (c.id === coordinationId ? { ...c, state: 'COMPLETED', status: 'completed' } : c))
    );
  };

  // Nav selection (Top Nav items)
  const handleSelectNav = (navItem) => {
    setActiveNav(navItem);
    if (navItem === 'overview') {
      setActiveLayer(null);
      setActivePulseFilter(null);
      handleClearSelection();
    } else if (navItem === 'resources') {
      setActiveLayer('resources');
      setActivePulseFilter('resources');
      setSelectedEntity({ type: 'discovery', category: 'resources' });
    } else if (navItem === 'issues') {
      setActiveLayer('issues');
      setActivePulseFilter('attention');
      setSelectedEntity({ type: 'discovery', category: 'attention' });
    } else {
      setActiveLayer(navItem);
    }
  };

  // Coordination card click: inspect associated lot or item
  const handleSelectCoordinationItem = (item) => {
    setSelectedEntity({ type: 'coordination', ...item });
  };

  const handleToggleMode = () => {
    const nextMode = mode === 'normal' ? 'emergency' : 'normal';
    setMode(nextMode);
    if (nextMode === 'emergency') {
      handleClearSelection();
      setActivePulseFilter(null);
    }
  };

  // ---------------------------------------------------------------------------
  // GREETING (Directly above 3D diorama, data-driven)
  // ---------------------------------------------------------------------------
  const greetingCount = attentionRecords.length;
  const greetingHeadline = `Good morning, ${(activeUser.name || 'Neighbor').split(' ')[0]}.`;
  const greetingSub =
    greetingCount > 0
      ? `${greetingCount} ${greetingCount === 1 ? 'thing' : 'things'} nearby need attention today.`
      : 'Your neighborhood is quiet today.';

  return (
    <div className={`saathi-dashboard-frame mode-${mode}`}>
      {/* Demo Disclosure Banner (Displayed strictly when demo mode is active) */}
      {demoActive && (
        <aside
          className="saathi-demo-disclosure-bar"
          data-testid="demo-disclosure-banner"
          aria-label="Fictional demo notification"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.22)',
            color: '#fbbf24',
            padding: '6px 16px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontWeight: 500,
            zIndex: 40,
            letterSpacing: '0.02em',
          }}
        >
          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
          <span>DEMO MODE — Simulated neighborhood data for portfolio demonstration only. Not real community activity.</span>
        </aside>
      )}

      {/* 1. TOP NAVIGATION */}
      <DashboardTopBar
        mode={mode}
        onToggleMode={handleToggleMode}
        emergencyStatus={emergencyStatus}
        emergencyIncidents={emergencyIncidents}
        emergencyError={emergencyError}
        onRefreshEmergency={refreshEmergency}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onLogout={onLogout}
        onOpenNotifications={() => setActiveNav('coordination')}
        coordinationCount={activeCoordinations.length}
        activeNav={activeNav}
        onSelectNav={handleSelectNav}
        activeLayer={activeLayer}
        selectedItem={selectedEntity}
        onClearSelectedItem={handleClearSelection}
        onResetAll={() => {
          setActiveNav('overview');
          setActiveLayer(null);
          setActivePulseFilter(null);
          handleClearSelection();
        }}
        onOpenAskModal={() => {
          setAskCategory(activeLayer || 'coverage');
          setIsAskModalOpen(true);
        }}
        onNavigateLanding={onNavigateLanding}
        currentUser={activeUser}
      />

      {/* 2. MAIN WORKSPACE BODY */}
      <div className="saathi-workspace-body">
        {/* LEFT RAIL: MY SAATHI (personal information only) */}
        <DashboardSidebar
          activeCoordinationsCount={activeCoordinations.length}
          incomingCount={incomingRequests.length}
          myAreasCount={myAreaLotIds.length}
          userRoleMode={userRoleMode}
          onToggleRoleMode={() =>
            setUserRoleMode((prev) => (prev === 'resident' ? 'resource_owner' : 'resident'))
          }
          currentUser={activeUser}
          onViewActivity={() => {
            const el = document.getElementById('my-coordination-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* PRIMARY CENTER WORKSPACE */}
        <main className="saathi-center-workspace">
          {/* GREETING */}
          <section className="saathi-greeting-strip" aria-label="Neighborhood Greeting">
            <h1 className="greeting-headline">{greetingHeadline}</h1>
            <p className="greeting-subheadline">{greetingSub}</p>
          </section>

          {/* 3D NEIGHBORHOOD (50–60vh, camera locked) */}
          <section
            className="neighborhood-scene-section"
            aria-label="3D Interactive Neighborhood Viewport"
          >
            <NeighborhoodViewport
              mode={mode}
              liveIncidents={emergencyIncidents}
              activeLayer={activeLayer}
              onSelectLayer={(layer) => {
                setActiveLayer(layer);
                setActiveNav(layer || 'overview');
              }}
              selectedItem={selectedEntity}
              selectedLotId={selectedLotId}
              highlightedLotIds={highlightedLotIds}
              onSelectLot={handleSelectLot}
              onClearSelection={handleClearSelection}
              onSelectItem={(item) => {
                if (item.category === 'resources' || item.type === 'discovery') {
                  setActivePulseFilter('resources');
                  setSelectedEntity({ type: 'discovery', category: 'resources' });
                } else if (item.lotNum || item.lotId) {
                  handleSelectLot(item.lotNum || item.lotId);
                } else {
                  setSelectedEntity(item);
                }
              }}
              onOpenAskModal={() => {
                setAskCategory(activeLayer || 'coverage');
                setIsAskModalOpen(true);
              }}
            />
          </section>

          {/* NEIGHBORHOOD PULSE (4 controls) */}
          <NeighborhoodPulse
            activeFilter={activePulseFilter}
            onToggleFilter={handleTogglePulseFilter}
            attentionCount={attentionRecords.length}
            coordinationCount={activeCoordinations.length}
            resourcesCount={availableResources.length}
            myAreasCount={myAreaLotIds.length}
          />

          {/* MY COORDINATION (Canonical operational workspace) */}
          <MyCoordinationSection
            coordinationList={coordinationList}
            borrowRequests={borrowRequests}
            currentUser={activeUser}
            userRoleMode={userRoleMode}
            onToggleRoleMode={() =>
              setUserRoleMode((prev) => (prev === 'resident' ? 'resource_owner' : 'resident'))
            }
            onSelectCoordination={handleSelectCoordinationItem}
            onSelectRequest={(req) => {
              const isOwner = req.isIncoming || req.ownerId === activeUser.id || userRoleMode === 'resource_owner';
              setSelectedEntity({
                type: isOwner ? 'owner_review' : 'request_status',
                request: req,
              });
            }}
            onCancelRequest={handleRequesterCancel}
            requestsLoading={requestsLoading}
            requestsError={requestsError}
            onReloadRequests={loadLiveRequests}
            coordinationTabsData={coordinationTabsData}
            coordinationsLoading={coordinationsLoading}
            coordinationsError={coordinationsError}
            onReloadCoordinations={loadLiveCoordinations}
          />
        </main>
      </div>

      {/* CONTEXTSURFACE (Layer 4 overlay drawer) */}
      <ContextSurface
        selectedEntity={selectedEntity}
        onClose={handleClearSelection}
        onReturnResource={handleReturnResource}
        onCompleteCoordination={handleCompleteCoordination}
        coordinationList={coordinationList}
        borrowRequests={borrowRequests}
        blockedUserIds={blockedUserIds}
        issuesList={issues}
        queriesList={queries}
        resourcesList={availableResources}
        lotsList={lots}
        currentUser={activeUser}
        userRoleMode={userRoleMode}
        onToggleRoleMode={() =>
          setUserRoleMode((prev) => (prev === 'resident' ? 'resource_owner' : 'resident'))
        }
        onShowOnNeighborhood={handleShowOnNeighborhood}
        onSelectEntity={setSelectedEntity}
        onCreateBorrowRequest={handleCreateBorrowRequest}
        onOwnerApprove={handleOwnerApprove}
        onOwnerDecline={handleOwnerDecline}
        onCancelRequest={handleRequesterCancel}
        onBlockMember={handleBlockMember}
        onReportConcern={handleReportConcern}
        onBorrowerStartReturn={handleBorrowerStartReturn}
        onOwnerConfirmReturn={handleOwnerConfirmReturn}
        onTransitionCoordination={handleTransitionCoordination}
        onSendCoordinationMessage={handleSendCoordinationMessage}
        coordinationMessages={coordinationMessages}
        coordinationEvents={coordinationEvents}
        resourcesLoading={resourcesLoading}
        resourcesError={resourcesError}
        onReloadResources={loadLiveResources}
        issuesLoading={issuesLoading}
        issuesError={issuesError}
        onReloadIssues={loadLiveIssues}
        onUpdateIssueStatus={handleUpdateIssueStatus}
        requestsLoading={requestsLoading}
        requestsError={requestsError}
        onReloadRequests={loadLiveRequests}
        coordinationsLoading={coordinationsLoading}
        coordinationsError={coordinationsError}
        onReloadCoordinations={loadLiveCoordinations}
        onAcceptCoverage={handleAcceptCoverage}
        coverageList={coverageList}
      />

      {/* PRIMARY ASK MODAL */}
      <AskModal
        isOpen={isAskModalOpen}
        onClose={() => setIsAskModalOpen(false)}
        initialCategory={askCategory}
        queriesList={queries}
        onAskCreated={(ask) => {
          if (ask && ask.category === 'coverage') {
            loadLiveCoverage();
          } else if (ask && ask.category === 'issue') {
            loadLiveIssues();
          } else if (ask && ask.category === 'query') {
            loadLiveQueries();
          }
        }}
      />
    </div>
  );
}
