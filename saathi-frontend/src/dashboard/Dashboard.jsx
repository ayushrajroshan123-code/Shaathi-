import React, { useState, useEffect } from 'react';
import DashboardTopBar from './DashboardTopBar';
import DashboardSidebar from './DashboardSidebar';
import NeighborhoodViewport from './NeighborhoodViewport';
import ContextualPanel from './ContextualPanel';
import AskModal from './AskModal';
import {
  RESIDENTIAL_LOTS,
  NEIGHBORHOOD_ISSUES,
  NEIGHBORHOOD_QUERIES,
  NEIGHBORHOOD_PULSE,
  MY_COORDINATION,
  PILOT_HUB_INFO,
  CURRENT_USER,
} from './dashboardData';

/**
 * Dashboard
 * The primary SAATHI resident dashboard & neighborhood coordination OS.
 * Desktop frame designed around 1440 × 1024 px.
 * 
 * Features:
 * - 3 Coordination Primitives: ISSUES, REQUESTS/ASKS, and NEIGHBORHOOD QUERIES.
 * - Neighborhood Queries: Shared demand discovery ("I need this too" -> "Coordinate service").
 * - Single unified top tabs: OVERVIEW, COVERAGE, RESOURCES, ISSUES.
 * - Sidebar demoted to rich context (Schedule, Coordination, Pulse).
 * - Full Emergency Mode suppression of casual queries.
 */
export default function Dashboard({ onLogout }) {
  const [mode, setMode] = useState('normal'); // 'normal' | 'emergency'
  const [activeLayer, setActiveLayer] = useState(null); // 'coverage' | 'resources' | 'issues' | null
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [askCategory, setAskCategory] = useState('coverage');

  // Dynamic Coordination States (Clean frontend model ready for backend API)
  const [queries, setQueries] = useState(NEIGHBORHOOD_QUERIES);
  const [pulseItems, setPulseItems] = useState(NEIGHBORHOOD_PULSE);
  const [coordinationList, setCoordinationList] = useState(MY_COORDINATION);

  // Select layer from top tabs
  const handleSelectLayer = (layerId) => {
    setActiveLayer(layerId);
    setSelectedItem(null);
  };

  const handleToggleMode = () => {
    const nextMode = mode === 'normal' ? 'emergency' : 'normal';
    setMode(nextMode);
    if (nextMode === 'emergency') {
      // In emergency, focus strictly on the primary incident; suppress casual queries
      setSelectedItem(null);
      setActiveLayer(null);
    }
  };

  const handleSelectCoordinationItem = (item) => {
    if (item.type === 'query' || item.queryId) {
      const targetQuery = queries.find((q) => q.id === item.queryId);
      if (targetQuery) {
        setSelectedItem({ type: 'query', ...targetQuery });
        setActiveLayer(null);
        return;
      }
    }
    if (item.lotName) {
      const lotNum = parseInt(item.lotName.replace(/\D/g, ''), 10);
      const targetLot = RESIDENTIAL_LOTS.find((l) => l.id === lotNum);
      if (targetLot) {
        setSelectedItem(targetLot);
        setActiveLayer('coverage');
      }
    }
  };

  const handleSelectPulseItem = (pulseItem) => {
    // 1. Issue Pulse Item -> selects existing Issue -> Contextual Panel opens
    if (pulseItem.type === 'issue' || pulseItem.issueId) {
      const targetIssue =
        NEIGHBORHOOD_ISSUES.find((i) => i.id === (pulseItem.issueId || pulseItem.relatedId)) ||
        NEIGHBORHOOD_ISSUES.find((i) => i.lotId === pulseItem.lotId) ||
        NEIGHBORHOOD_ISSUES[0];
      if (targetIssue) {
        setSelectedItem(targetIssue);
        setActiveLayer('issues');
        return;
      }
    }

    // 2. Query Pulse Item -> selects existing Query -> Contextual Panel opens
    if (pulseItem.type === 'query' || pulseItem.queryId) {
      const targetQuery =
        queries.find((q) => q.id === (pulseItem.queryId || pulseItem.relatedId)) ||
        queries[0] || {
          id: pulseItem.queryId || 'query-1',
          title: pulseItem.title || 'AC servicing',
          description: 'Several homes in Greenwood Commons are interested in AC servicing this week.',
          preferredTiming: 'This week',
          interestedCount: 3,
          currentUserIncluded: false,
          status: 'open',
        };
      setSelectedItem({ type: 'query', ...targetQuery });
      setActiveLayer(null);
      return;
    }

    // 3. Shared Resource Pulse Item -> selects existing Resource -> Contextual Panel opens
    if (pulseItem.type === 'resource' || pulseItem.resourceId) {
      for (const lot of RESIDENTIAL_LOTS) {
        const targetRes = lot.resources?.find(
          (r) => r.id === (pulseItem.resourceId || pulseItem.relatedId)
        );
        if (targetRes) {
          setSelectedItem({ ...targetRes, lotId: lot.id, type: 'resource' });
          setActiveLayer('resources');
          return;
        }
      }
      const targetLot = RESIDENTIAL_LOTS.find((l) => l.id === pulseItem.lotId);
      if (targetLot) {
        setSelectedItem(targetLot.resources?.[0] || targetLot);
        setActiveLayer('resources');
        return;
      }
    }

    // 4. Coverage Pulse Item -> selects existing Coverage Lot -> Contextual Panel opens
    if (pulseItem.type === 'coverage') {
      const targetLot = RESIDENTIAL_LOTS.find((l) => l.id === pulseItem.lotId);
      if (targetLot) {
        setSelectedItem(targetLot);
        setActiveLayer('coverage');
        return;
      }
    }

    // 5. Recent Coordination Item -> selects existing Lot/Coordination
    if (pulseItem.type === 'coordination') {
      const targetCoord = coordinationList.find((c) => c.id === pulseItem.relatedId);
      if (targetCoord) {
        handleSelectCoordinationItem(targetCoord);
        return;
      }
      const targetLot = RESIDENTIAL_LOTS.find((l) => l.id === pulseItem.lotId) || RESIDENTIAL_LOTS[0];
      setSelectedItem(targetLot);
      setActiveLayer('coverage');
      return;
    }

    const targetLot = RESIDENTIAL_LOTS.find((l) => l.id === pulseItem.lotId);
    if (targetLot) {
      setSelectedItem(targetLot);
      setActiveLayer(pulseItem.type || 'coverage');
    }
  };

  const handleSelectIssue = (issue) => {
    setSelectedItem(issue);
    setActiveLayer('issues');
  };

  // Neighborhood Query Actions (Section 4, 5, 6, 12, 14)
  const handleCreateQuery = (askData) => {
    const newQuery = {
      id: `query-${Date.now()}`,
      neighborhoodId: PILOT_HUB_INFO.hubId,
      creatorId: CURRENT_USER.id,
      title: askData.title,
      description: askData.details || `Several homes in Greenwood Commons may need ${askData.title.toLowerCase()} (${askData.timeWindow}).`,
      category: 'home_service',
      preferredTiming: askData.timeWindow || 'This week',
      interestedCount: 1, // Section 5: Creator automatically counts as 1st interested household
      currentUserIncluded: true,
      status: 'open',
      createdAt: 'Just now',
      updatedAt: 'Just now',
    };

    setQueries((prev) => [newQuery, ...prev]);

    const newPulse = {
      id: `pulse-query-${Date.now()}`,
      time: 'Just now',
      type: 'query',
      text: `${newQuery.title}: 1 home interested (${newQuery.preferredTiming}).`,
      queryId: newQuery.id,
    };
    setPulseItems((prev) => [newPulse, ...prev]);

    // Open newly created query in Contextual Panel immediately
    setSelectedItem({ type: 'query', ...newQuery });
    setActiveLayer(null);
  };

  const handleJoinQuery = (queryId) => {
    setQueries((prev) =>
      prev.map((q) => {
        if (q.id === queryId) {
          const updated = {
            ...q,
            interestedCount: q.interestedCount + (q.currentUserIncluded ? 0 : 1),
            currentUserIncluded: true,
            updatedAt: 'Just now',
          };
          setSelectedItem((cur) => (cur && cur.id === queryId ? { ...cur, ...updated } : cur));
          return updated;
        }
        return q;
      })
    );

    setPulseItems((prev) =>
      prev.map((p) => {
        if (p.queryId === queryId) {
          const q = queries.find((item) => item.id === queryId);
          const newCount = q ? q.interestedCount + (q.currentUserIncluded ? 0 : 1) : 4;
          return {
            ...p,
            time: 'Just now',
            text: `${q?.title || 'Shared Query'}: ${newCount} homes interested in joint service call.`,
          };
        }
        return p;
      })
    );
  };

  const handleCoordinateQuery = (queryId) => {
    let updatedTarget = null;
    setQueries((prev) =>
      prev.map((q) => {
        if (q.id === queryId) {
          updatedTarget = { ...q, status: 'coordinating', updatedAt: 'Just now' };
          setSelectedItem((cur) => (cur && cur.id === queryId ? { ...cur, ...updatedTarget } : cur));
          return updatedTarget;
        }
        return q;
      })
    );

    // Section 13: Coordinated query appears under existing MY COORDINATION
    const targetQ = updatedTarget || queries.find((q) => q.id === queryId);
    if (targetQ) {
      const coordEntry = {
        id: `coord-query-${queryId}`,
        type: 'query',
        title: `${targetQ.title} Service`,
        counterpart: `${targetQ.interestedCount} homes`,
        lotName: 'Shared Query',
        time: targetQ.preferredTiming,
        status: 'coordinating',
        badge: 'Shared Service',
        actionText: 'View Coordination',
        queryId: queryId,
      };
      setCoordinationList((prev) => [coordEntry, ...prev.filter((c) => c.queryId !== queryId)]);

      setPulseItems((prev) =>
        prev.map((p) => {
          if (p.queryId === queryId) {
            return {
              ...p,
              time: 'Just now',
              text: `${targetQ.title}: Coordination underway across ${targetQ.interestedCount} homes.`,
            };
          }
          return p;
        })
      );
    }
  };

  const handleCompleteQuery = (queryId) => {
    setQueries((prev) =>
      prev.map((q) => {
        if (q.id === queryId) {
          const completed = { ...q, status: 'completed', updatedAt: 'Just now' };
          setSelectedItem((cur) => (cur && cur.id === queryId ? { ...cur, ...completed } : cur));
          return completed;
        }
        return q;
      })
    );

    setCoordinationList((prev) =>
      prev.map((c) => (c.queryId === queryId ? { ...c, status: 'completed', actionText: 'Completed' } : c))
    );
  };

  // Search filter across residents, resources, issues, and queries
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const query = searchQuery.toLowerCase();

    // Check queries
    const matchedQuery = queries.find((q) => q.title.toLowerCase().includes(query));
    if (matchedQuery) {
      setSelectedItem({ type: 'query', ...matchedQuery });
      setActiveLayer(null);
      return;
    }

    // Check residents / coverage
    const matchedLot = RESIDENTIAL_LOTS.find(
      (l) =>
        l.residentName.toLowerCase().includes(query) ||
        l.coverageItems.some((c) => c.title.toLowerCase().includes(query))
    );
    if (matchedLot) {
      setSelectedItem(matchedLot);
      setActiveLayer('coverage');
      return;
    }

    // Check resources
    for (const lot of RESIDENTIAL_LOTS) {
      const matchedRes = lot.resources.find((r) => r.name.toLowerCase().includes(query));
      if (matchedRes) {
        setSelectedItem({ ...matchedRes, lotId: lot.id });
        setActiveLayer('resources');
        return;
      }
    }

    // Check issues
    const matchedIssue = NEIGHBORHOOD_ISSUES.find((i) => i.title.toLowerCase().includes(query));
    if (matchedIssue) {
      setSelectedItem(matchedIssue);
      setActiveLayer('issues');
    }
  }, [searchQuery, queries]);

  return (
    <div className={`saathi-dashboard-frame mode-${mode}`}>
      {/* Top Bar with Brand & Location Breadcrumbs */}
      <DashboardTopBar
        mode={mode}
        onToggleMode={handleToggleMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onLogout={onLogout}
        onOpenNotifications={() => {
          setActiveLayer('coverage');
        }}
        activeLayer={activeLayer}
        selectedItem={selectedItem}
        onSelectLayer={handleSelectLayer}
        onClearSelectedItem={() => setSelectedItem(null)}
        onResetAll={() => {
          setActiveLayer(null);
          setSelectedItem(null);
        }}
      />

      {/* Main Workspace Body */}
      <div className="saathi-workspace-body">
        {/* Sidebar: Reused existing surfaces (Schedule, My Coordination, Live Pulse) */}
        <DashboardSidebar
          mode={mode}
          coordinationList={coordinationList}
          pulseList={pulseItems}
          primaryContextualIds={
            selectedItem
              ? [selectedItem.id, selectedItem.queryId, selectedItem.issueId, selectedItem.resourceId, selectedItem.relatedId].filter(Boolean)
              : []
          }
          onSelectCoordination={handleSelectCoordinationItem}
          onSelectPulseItem={handleSelectPulseItem}
          onSelectIssue={handleSelectIssue}
        />

        {/* Primary Center Workspace */}
        <main className="saathi-center-workspace">
          {/* 3D Neighborhood Workspace (Calm, architectural, uncluttered) */}
          <section className="neighborhood-scene-section" aria-label="3D Interactive Neighborhood">
            <NeighborhoodViewport
              mode={mode}
              activeLayer={activeLayer}
              onSelectLayer={handleSelectLayer}
              selectedItem={selectedItem}
              onSelectItem={setSelectedItem}
              onOpenAskModal={() => {
                setAskCategory(activeLayer || 'coverage');
                setIsAskModalOpen(true);
              }}
            />
          </section>

          {/* Contextual Information / Neighborhood Detail Inspector */}
          <section className="neighborhood-contextual-section" aria-label="Contextual Information">
            <ContextualPanel
              mode={mode}
              selectedItem={selectedItem}
              onDeselectItem={() => setSelectedItem(null)}
              onSelectItem={setSelectedItem}
              onOpenAskModal={() => {
                setAskCategory('query');
                setIsAskModalOpen(true);
              }}
              onJoinQuery={handleJoinQuery}
              onCoordinateQuery={handleCoordinateQuery}
              onCompleteQuery={handleCompleteQuery}
              pulseList={pulseItems}
              queries={queries}
            />
          </section>
        </main>
      </div>

      {/* Primary + ASK Modal (Extended with Start a Neighborhood Query) */}
      <AskModal
        isOpen={isAskModalOpen}
        onClose={() => setIsAskModalOpen(false)}
        initialCategory={askCategory}
        onAskCreated={(ask) => {
          if (ask.category === 'query') {
            handleCreateQuery(ask);
          } else {
            console.log('Ask Created:', ask);
          }
        }}
      />
    </div>
  );
}
