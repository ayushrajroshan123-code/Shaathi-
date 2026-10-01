import React from 'react';
import {
  HelpingHand,
  Wrench,
  TriangleAlert,
  Clock,
  ShieldCheck,
  Radio,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Users,
} from 'lucide-react';
import {
  PILOT_HUB_INFO,
  MY_COORDINATION,
  NEIGHBORHOOD_PULSE,
  NEIGHBORHOOD_ISSUES,
} from './dashboardData';

/**
 * DashboardSidebar
 * Prime F-Pattern Top-Left Space (236px wide).
 * Demoted from redundant navigation to rich neighborhood context:
 * 1. Today's Focus & Attention Items (e.g. Lot 3 Safety Issue)
 * 2. My Coordination (Active commitments including coordinated shared queries)
 * 3. Live Neighborhood Pulse Feed (including active Neighborhood Queries)
 * 4. Mutual Keyholder Verification baseline
 */
export default function DashboardSidebar({
  coordinationList = MY_COORDINATION,
  pulseList = NEIGHBORHOOD_PULSE,
  mode = 'normal',
  primaryContextualIds = [],
  onSelectCoordination,
  onSelectPulseItem,
  onSelectIssue,
}) {
  const attentionIssue = NEIGHBORHOOD_ISSUES.find((i) => i.id === 'iss-2') || NEIGHBORHOOD_ISSUES[0];

  const TYPE_RELEVANCE = {
    issue: 1,
    query: 2,
    coverage: 3,
    resource: 4,
    coordination: 5,
  };

  const primaryIdsSet = new Set(primaryContextualIds || []);

  // Deduplicate feed events: If an event's ID or related item ID is already rendered
  // as a primary item/card in the contextual panel, do NOT duplicate it in sidebar pulse.
  // Display approximately 4–5 of the most relevant active signals in relevance order:
  // 1. active issues requiring attention
  // 2. active coordination/query opportunities
  // 3. active coverage
  // 4. resource activity
  // 5. recent completed coordination
  const eligiblePulse = (pulseList || NEIGHBORHOOD_PULSE)
    .filter((item) => {
      if (mode === 'emergency' && item.type === 'query') return false;
      if (
        primaryIdsSet.has(item.id) ||
        (item.queryId && primaryIdsSet.has(item.queryId)) ||
        (item.issueId && primaryIdsSet.has(item.issueId)) ||
        (item.resourceId && primaryIdsSet.has(item.resourceId)) ||
        (item.relatedId && primaryIdsSet.has(item.relatedId))
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const pA = TYPE_RELEVANCE[a.type] || (a.priority || 99);
      const pB = TYPE_RELEVANCE[b.type] || (b.priority || 99);
      return pA - pB;
    });

  const displayPulse = eligiblePulse.slice(0, 5);

  const displayCoordination = (coordinationList || MY_COORDINATION).filter((item) =>
    mode === 'emergency' ? item.type !== 'query' : true
  );

  const CATEGORY_LABELS = {
    issue: 'NEEDS ATTENTION',
    attention: 'NEEDS ATTENTION',
    query: 'COORDINATION',
    coordination: 'COORDINATION',
    coverage: 'COVERAGE',
    resource: 'RESOURCE',
  };

  return (
    <aside className="saathi-sidebar" aria-label="Neighborhood Hub Context and Activity">
      {/* 1. Prime Top-Left Header: Today's Action & Immediate Attention */}
      <div className="sidebar-action-header">
        <div className="sidebar-hub-status-row">
          <span className="hub-status-pill">
            <span className="hub-pulse-dot" aria-hidden="true" />
            <span>PILOT HUB ACTIVE</span>
          </span>
          <span className="hub-neighbors-count" title="24 connected residents in Oakridge Circle">
            24 Neighbors
          </span>
        </div>

        <div className="sidebar-focus-titles">
          <h2 className="sidebar-focus-title">Today's Schedule & Pulse</h2>
          <span className="sidebar-focus-sub">Oakridge Circle Ward 4</span>
        </div>

        {/* Actionable Attention Alert (Surfaced in prime F-pattern space) */}
        {attentionIssue && (
          <button
            type="button"
            className="sidebar-attention-card"
            onClick={() => onSelectIssue && onSelectIssue(attentionIssue)}
            title="Click to focus Lot 3 on 3D map and inspect issue details"
            aria-label={`Attention needed: ${attentionIssue.title}`}
          >
            <div className="attention-card-top">
              <span className="attention-badge">
                <AlertTriangle size={11} className="attention-icon" aria-hidden="true" />
                <span>NEEDS ATTENTION</span>
              </span>
              <span className="attention-lot">Lot {attentionIssue.lotId}</span>
            </div>
            <p className="attention-title">{attentionIssue.title}</p>
            <div className="attention-action-row">
              <span className="attention-inspect-link">Inspect on 3D map</span>
              <ArrowRight size={11} className="attention-arrow" aria-hidden="true" />
            </div>
          </button>
        )}
      </div>

      {/* 2. My Coordination: Reusable coordination surface per Section 13 */}
      <div className="sidebar-coordination-section">
        <div className="coordination-header">
          <div className="coordination-header-text">
            <span className="coordination-title">MY COORDINATION</span>
            <span className="coordination-sub-detail">
              {displayCoordination.filter(c => c.type === 'query').length > 0
                ? `${displayCoordination.filter(c => c.type !== 'query').length} individual · ${displayCoordination.filter(c => c.type === 'query').length} shared`
                : '1 giving · 1 borrowing'}
            </span>
          </div>
          <span
            className="coordination-count-badge"
            title={`${displayCoordination.length} active coordination commitments with neighbors`}
          >
            {displayCoordination.length} Active
          </span>
        </div>

        <div className="coordination-list">
          {displayCoordination.map((item) => {
            const isBorrowing = item.type === 'receiving';
            const resourceTitle = item.resourceName || (isBorrowing ? item.title.replace(/^Borrowing\s+/i, '').replace(/\s+from.*$/i, '') : item.title);
            const dueText = item.dueTime ? `Due back ${item.dueTime}` : item.time;

            return (
              <button
                key={item.id}
                type="button"
                className={`coordination-item-card ${isBorrowing ? 'is-borrowing' : ''}`}
                onClick={() => onSelectCoordination && onSelectCoordination(item)}
                title={
                  item.type === 'query'
                    ? `Click to view coordination for ${item.title}`
                    : `Click to focus ${item.lotName}: ${item.title} with ${item.counterpart}`
                }
              >
                <div className="coord-card-top">
                  <span className={`coord-badge badge-${item.type}`}>
                    {item.type === 'giving' ? (
                      <>
                        <HelpingHand size={11} style={{ marginRight: 4 }} aria-hidden="true" />
                        <span>You're Helping</span>
                      </>
                    ) : isBorrowing ? (
                      <>
                        <Wrench size={11} style={{ marginRight: 4 }} aria-hidden="true" />
                        <span>YOU'RE BORROWING</span>
                      </>
                    ) : item.type === 'query' ? (
                      <>
                        <Users size={11} style={{ marginRight: 4 }} aria-hidden="true" />
                        <span>Coordinating</span>
                      </>
                    ) : (
                      <span>{item.badge || 'Active'}</span>
                    )}
                  </span>
                  <span className="coord-time">{isBorrowing ? dueText : item.time}</span>
                </div>
                <p className="coord-card-title">{isBorrowing ? resourceTitle : item.title}</p>
                <div className="coord-card-sub">
                  <span className="coord-person">
                    {item.type === 'query' ? item.counterpart : `${item.counterpart} · ${item.lotName}`}
                  </span>
                  <span className="coord-action-link">View coordination →</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Live Neighborhood Pulse Activity Summary */}
      <div className="sidebar-pulse-section">
        <div className="sidebar-pulse-header">
          <div className="sidebar-pulse-title-wrap">
            <Radio size={12} className="pulse-radio-icon" aria-hidden="true" />
            <span className="sidebar-pulse-title">NEIGHBORHOOD PULSE</span>
          </div>
          <span className="sidebar-live-pill">LIVE</span>
        </div>
        <p className="sidebar-pulse-summary">
          {eligiblePulse.length} active coordination signals
        </p>

        <div className="sidebar-pulse-list">
          {displayPulse.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-pulse-card pulse-type-${item.type}`}
              onClick={() => onSelectPulseItem && onSelectPulseItem(item)}
              title={
                item.type === 'query'
                  ? `Click to view query: ${item.title}`
                  : `Click to view ${item.title}`
              }
              aria-label={`${CATEGORY_LABELS[item.type] || 'ACTIVITY'}: ${item.title} — ${item.subtitle}`}
            >
              <div className="pulse-card-category-row">
                <span className={`pulse-category-dot dot-${item.type}`} aria-hidden="true" />
                <span className={`pulse-category-label cat-${item.type}`}>
                  {CATEGORY_LABELS[item.type] || (item.type ? item.type.toUpperCase() : 'ACTIVITY')}
                </span>
              </div>
              <span className="pulse-card-title">{item.title}</span>
              <div className="pulse-card-subline">
                <span className="pulse-card-subtitle">{item.subtitle}</span>
              </div>
              <div className="pulse-card-action-row">
                <span className="pulse-action-link">{item.actionLabel || 'View details →'}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Mutual Verification Baseline */}
      <div className="sidebar-footer">
        <div className="trust-indicator-box">
          <ShieldCheck size={16} className="trust-shield-icon" aria-hidden="true" />
          <div className="trust-text-group">
            <span className="trust-primary">Mutual Verification</span>
            <span className="trust-secondary">Single-hop physical keyholder network</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
