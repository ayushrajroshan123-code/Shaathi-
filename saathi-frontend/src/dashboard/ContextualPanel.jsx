import React, { useState } from 'react';
import {
  HelpingHand,
  Wrench,
  TriangleAlert,
  ShieldCheck,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  AlertCircle,
  BatteryCharging,
  X,
  ArrowRight,
  Users,
} from 'lucide-react';
import {
  NEIGHBORHOOD_PULSE,
  EMERGENCY_INCIDENT,
  PILOT_HUB_INFO,
  RESIDENTIAL_LOTS,
  NEIGHBORHOOD_ISSUES,
  NEIGHBORHOOD_QUERIES,
} from './dashboardData';

/**
 * ContextualPanel
 * Positioned below the 3D neighborhood workspace.
 * 
 * Features:
 * - Direct visual connection to what was selected in the 3D neighborhood or pulse.
 * - Intentional whitespace and clean typography hierarchy instead of card-in-card clutter.
 * - Support for Section 11 & 12: NEIGHBORHOOD QUERIES (Aggregate demand, "I need this too", "✓ You're included", "Coordinate service").
 * - Full privacy protection (never leaks participating house IDs).
 * - Lucide React icon family.
 * - Single prominent primary action for each state.
 */
export default function ContextualPanel({
  mode = 'normal',
  selectedItem = null,
  onDeselectItem,
  onOpenAskModal,
  onSelectItem,
  onJoinQuery,
  onCoordinateQuery,
  onCompleteQuery,
  pulseList = NEIGHBORHOOD_PULSE,
  queries = NEIGHBORHOOD_QUERIES,
}) {
  const [actionFeedback, setActionFeedback] = useState('');

  const triggerAction = (msg) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(''), 4500);
  };

  // ---------------------------------------------------------------------------
  // 1. EMERGENCY OPERATIONAL CONTEXT
  // ---------------------------------------------------------------------------
  if (mode === 'emergency') {
    return (
      <div className="saathi-contextual-panel emergency-contextual-panel" role="region" aria-label="Emergency Operational Center">
        <div className="emergency-panel-header">
          <div className="emergency-header-left">
            <div className="emergency-badge-row">
              <span className="emergency-alert-tag">ACTIVE INCIDENT #2026-09</span>
              <span className="emergency-status-tag">STATUS: {EMERGENCY_INCIDENT.status?.toUpperCase()}</span>
            </div>
            <h3 className="emergency-title">{EMERGENCY_INCIDENT.title}</h3>
            <p className="emergency-meta">
              <MapPin size={13} aria-hidden="true" />
              <span>{EMERGENCY_INCIDENT.affectedLocation}</span>
              <span className="meta-sep">•</span>
              <Clock size={13} aria-hidden="true" />
              <span>Reported {EMERGENCY_INCIDENT.timestamp}</span>
              <span className="meta-sep">•</span>
              <span>All 6 Lots Notified</span>
            </p>
          </div>

          <div className="emergency-header-actions">
            <button
              type="button"
              className="btn-emergency-action"
              onClick={() => triggerAction('Check-in transmitted to Dr. Thorne and Marcus Vance. Logged as Standby Responder.')}
            >
              Check-in as Standby Responder
            </button>
          </div>
        </div>

        {actionFeedback && (
          <div className="panel-feedback-toast emergency-toast">
            <Check size={14} className="toast-icon" />
            <span>{actionFeedback}</span>
          </div>
        )}

        <div className="emergency-grid-layout">
          {/* Priority 1: Immediate Need */}
          <div className="emergency-card priority-card">
            <div className="card-top-eyebrow">
              <span className="priority-badge">1. IMMEDIATE NEED (SOS)</span>
              <span className="eyebrow-lot">{EMERGENCY_INCIDENT.affectedPeople[0].lot}</span>
            </div>
            <h4 className="card-person-name">{EMERGENCY_INCIDENT.affectedPeople[0].name}</h4>
            <p className="card-need-text">{EMERGENCY_INCIDENT.affectedPeople[0].need}</p>
            <div className="card-status-pill alert-pulse">
              <span className="dot-pulse" />
              <span>Status: {EMERGENCY_INCIDENT.affectedPeople[0].status}</span>
            </div>
          </div>

          {/* Priority 2: Responders En Route */}
          <div className="emergency-card responders-card">
            <div className="card-top-eyebrow">
              <span className="responders-badge">2. ACTIVE RESPONDERS</span>
              <span className="eyebrow-lot">2 En Route</span>
            </div>
            <div className="responders-mini-list">
              {EMERGENCY_INCIDENT.responders.map((resp) => (
                <div key={resp.id} className="responder-mini-item">
                  <Check size={12} className="resp-check" />
                  <div className="responder-info">
                    <span className="resp-name">{resp.name} · {resp.role}</span>
                    <span className="resp-action">{resp.action} ({resp.eta})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Priority 3: Critical Resources */}
          <div className="emergency-card resources-card">
            <div className="card-top-eyebrow">
              <span className="resource-badge">3. CRITICAL EQUIPMENT</span>
              <span className="eyebrow-lot">Staged</span>
            </div>
            <div className="emergency-res-list">
              {EMERGENCY_INCIDENT.emergencyResources.map((res) => (
                <div key={res.id} className="em-res-item">
                  <BatteryCharging size={14} className="em-res-icon" />
                  <div className="em-res-details">
                    <span className="em-res-name">{res.name}</span>
                    <span className="em-res-sub">{res.owner} · {res.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Priority 4: Incident Timeline */}
          <div className="emergency-card timeline-card">
            <div className="card-top-eyebrow">
              <span className="timeline-badge">4. INCIDENT LOG</span>
              <span className="eyebrow-lot">Live Updates</span>
            </div>
            <div className="incident-timeline">
              {EMERGENCY_INCIDENT.timeline.slice(-3).map((item, idx) => (
                <div key={idx} className="timeline-row">
                  <span className="tl-time">{item.time}</span>
                  <span className="tl-text">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. SELECTED PERSON / COVERAGE CONTEXT
  // ---------------------------------------------------------------------------
  if (
    selectedItem &&
    selectedItem.type !== 'resource' &&
    selectedItem.type !== 'issue' &&
    selectedItem.type !== 'query' &&
    (selectedItem.type === 'coverage' || selectedItem.residentName)
  ) {
    const lot = selectedItem;
    return (
      <div className="saathi-contextual-panel" role="region" aria-label="Resident Coverage Context">
        <div className="context-card-wrapper">
          {/* Header Row: WHAT IS IT? */}
          <div className="context-header">
            <div className="context-resident-meta">
              <span className="context-avatar">{lot.avatar}</span>
              <div className="context-resident-titles">
                <div className="context-title-row">
                  <h3 className="resident-title">{lot.residentName}</h3>
                  <span className="resident-lot-pill">{lot.name || `Lot ${lot.lotId}`}</span>
                </div>
                <p className="resident-relation-text">{lot.relation}</p>
              </div>
            </div>

            <button
              type="button"
              className="context-close-btn"
              onClick={onDeselectItem}
              aria-label="Return to Neighborhood Pulse"
            >
              <X size={14} aria-hidden="true" />
              <span>Close</span>
            </button>
          </div>

          {actionFeedback && (
            <div className="panel-feedback-toast">
              <Check size={14} className="toast-icon" />
              <span>{actionFeedback}</span>
            </div>
          )}

          {/* Body Columns: WHAT IS HAPPENING + WHO/WHERE + WHAT CAN I DO */}
          <div className="context-body-columns">
            {/* Left Column: Active Availability */}
            <div className="context-column-left">
              <span className="column-eyebrow">WHAT IS HAPPENING</span>
              <h4 className="column-label">ACTIVE AVAILABILITY & COVERAGE</h4>
              <div className="coverage-items-group">
                {lot.coverageItems?.map((cov) => (
                  <div key={cov.id} className="coverage-item-row">
                    <HelpingHand size={16} className="cov-icon" aria-hidden="true" />
                    <div className="cov-text-block">
                      <div className="cov-item-header">
                        <span className="cov-item-title">{cov.title}</span>
                        <span className="cov-status-badge">{cov.status}</span>
                      </div>
                      <span className="cov-item-window">{cov.window}</span>
                      <p className="cov-item-detail">{cov.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Relational Trust & Primary Action */}
            <div className="context-column-right">
              <div className="context-trust-block">
                <span className="column-eyebrow">WHO & WHERE</span>
                <h4 className="column-label">RELATIONAL TRUST CONTEXT</h4>
                <div className="trust-cardlet">
                  <ShieldCheck size={18} className="trust-shield-icon" aria-hidden="true" />
                  <div className="trust-cardlet-text">
                    <span className="trust-cardlet-title">Physical Keyholder Verified</span>
                    <p className="trust-cardlet-detail">{lot.mutualConnections}</p>
                  </div>
                </div>

                {lot.resources && lot.resources.length > 0 && (
                  <div className="lot-tools-block">
                    <span className="sub-label">SHARED TOOLS AT THIS LOT:</span>
                    <div className="resource-items-mini-list">
                      {lot.resources.map((res) => (
                        <span key={res.id} className="resource-mini-tag">
                          <Wrench size={11} style={{ marginRight: 4 }} />
                          {res.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Primary Action Button */}
              <div className="context-action-cta">
                <button
                  type="button"
                  className="btn-primary context-cta-btn"
                  onClick={() => triggerAction(`Coordination request sent to ${lot.residentName}. Notification sent to Oakridge Circle keyholders.`)}
                >
                  Offer Assistance
                </button>
                <span className="context-cta-hint">Coordinate with {lot.residentName?.split('&')[0].trim()} • Logged in Pilot Hub</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 3. SELECTED RESOURCE CONTEXT
  // ---------------------------------------------------------------------------
  if (selectedItem && (selectedItem.type === 'resource' || selectedItem.condition)) {
    const res = selectedItem;
    return (
      <div className="saathi-contextual-panel" role="region" aria-label="Shared Resource Context">
        <div className="context-card-wrapper">
          <div className="context-header">
            <div className="context-resident-meta">
              <span className="context-avatar resource-glyph-avatar">
                <Wrench size={18} />
              </span>
              <div className="context-resident-titles">
                <div className="context-title-row">
                  <h3 className="resident-title">{res.name}</h3>
                  <span className="resident-lot-pill">{res.category?.toUpperCase()}</span>
                </div>
                <p className="resident-relation-text">Shared by {res.sharedBy} • Condition: {res.condition}</p>
              </div>
            </div>

            <button
              type="button"
              className="context-close-btn"
              onClick={onDeselectItem}
              aria-label="Return to Neighborhood Pulse"
            >
              <X size={14} aria-hidden="true" />
              <span>Close</span>
            </button>
          </div>

          {actionFeedback && (
            <div className="panel-feedback-toast">
              <Check size={14} className="toast-icon" />
              <span>{actionFeedback}</span>
            </div>
          )}

          <div className="context-body-columns">
            <div className="context-column-left">
              <span className="column-eyebrow">WHAT IS HAPPENING</span>
              <h4 className="column-label">RESOURCE LOCATION & AVAILABILITY</h4>
              <div className="resource-details-box">
                <div className="res-detail-item">
                  <span className="detail-key">Physical Location</span>
                  <span className="detail-val">{res.location}</span>
                </div>
                <div className="res-detail-item">
                  <span className="detail-key">Availability Status</span>
                  <span className="detail-val status-green">
                    <span className="status-dot green" />
                    {res.available ? 'Ready for immediate pickup' : 'Currently in use'}
                  </span>
                </div>
                <div className="res-detail-item">
                  <span className="detail-key">Lending Protocol</span>
                  <span className="detail-val">Return cleaned within 48h or coordinate extension with owner.</span>
                </div>
              </div>
            </div>

            <div className="context-column-right">
              <div className="context-trust-block">
                <span className="column-eyebrow">WHO & WHERE</span>
                <h4 className="column-label">OWNER & VERIFICATION</h4>
                <div className="trust-cardlet">
                  <ShieldCheck size={18} className="trust-shield-icon" aria-hidden="true" />
                  <div className="trust-cardlet-text">
                    <span className="trust-cardlet-title">Shared by {res.sharedBy}</span>
                    <p className="trust-cardlet-detail">Available free for verified Oakridge Circle residents. Keyholder pickup at {res.location}.</p>
                  </div>
                </div>
              </div>

              <div className="context-action-cta">
                <button
                  type="button"
                  className="btn-primary context-cta-btn"
                  onClick={() => triggerAction(`Borrow request sent to ${res.sharedBy}. You will be notified once confirmed.`)}
                >
                  {res.name.toLowerCase().includes('ladder') ? 'Coordinate Ladder Loan' : `Coordinate ${res.name.split(' ')[0]} Loan`}
                </button>
                <span className="context-cta-hint">Self-service pickup once accepted by owner</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 4. SELECTED ISSUE CONTEXT
  // ---------------------------------------------------------------------------
  if (selectedItem && (selectedItem.type === 'issue' || selectedItem.severity)) {
    const iss = selectedItem;
    return (
      <div className="saathi-contextual-panel" role="region" aria-label="Neighborhood Issue Context">
        <div className="context-card-wrapper">
          <div className="context-header">
            <div className="context-resident-meta">
              <span className="context-avatar issue-glyph-avatar">
                <TriangleAlert size={18} />
              </span>
              <div className="context-resident-titles">
                <div className="context-title-row">
                  <h3 className="resident-title">{iss.title}</h3>
                  <span className={`severity-badge severity-${iss.severity}`}>{iss.severity?.toUpperCase()} SEVERITY</span>
                </div>
                <p className="resident-relation-text">{iss.locationDesc} • Reported by {iss.reportedBy}</p>
              </div>
            </div>

            <button
              type="button"
              className="context-close-btn"
              onClick={onDeselectItem}
              aria-label="Return to Neighborhood Pulse"
            >
              <X size={14} aria-hidden="true" />
              <span>Close</span>
            </button>
          </div>

          {actionFeedback && (
            <div className="panel-feedback-toast">
              <Check size={14} className="toast-icon" />
              <span>{actionFeedback}</span>
            </div>
          )}

          <div className="context-body-columns">
            <div className="context-column-left">
              <span className="column-eyebrow">WHAT IS HAPPENING</span>
              <h4 className="column-label">OBSERVATION & STATUS</h4>
              <p className="issue-desc-text">{iss.detail}</p>
              <div className="issue-status-pill">
                <span>Current Status:</span> <strong>{iss.status}</strong>
              </div>
            </div>

            <div className="context-column-right">
              <div className="context-trust-block">
                <span className="column-eyebrow">WHO & WHERE</span>
                <h4 className="column-label">REPORTED BY & IMPACT</h4>
                <div className="trust-cardlet">
                  <TriangleAlert size={18} className="trust-shield-icon" aria-hidden="true" />
                  <div className="trust-cardlet-text">
                    <span className="trust-cardlet-title">{iss.reportedBy}</span>
                    <p className="trust-cardlet-detail">{iss.locationDesc}. Affects evening walkway security and visibility.</p>
                  </div>
                </div>
              </div>

              <div className="context-action-cta">
                <button
                  type="button"
                  className="btn-primary context-cta-btn"
                  onClick={() => triggerAction(`Volunteer offer sent to ${iss.reportedBy}. Coordinated via Pilot Hub.`)}
                >
                  I'll take this
                </button>
                <span className="context-cta-hint">{iss.action || 'Community maintenance organized by neighbors'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 4B. SELECTED NEIGHBORHOOD QUERY CONTEXT (Section 11, 12, 14 & Privacy)
  // ---------------------------------------------------------------------------
  if (selectedItem && (selectedItem.type === 'query' || selectedItem.interestedCount !== undefined)) {
    const query = selectedItem;
    const isIncluded = !!query.currentUserIncluded;
    const isCoordinating = query.status === 'coordinating';
    const isCompleted = query.status === 'completed';

    return (
      <div className="saathi-contextual-panel query-contextual-panel" role="region" aria-label="Neighborhood Query Detail">
        <div className="context-card-wrapper">
          {/* Header Row: WHAT IS IT? */}
          <div className="context-header">
            <div className="context-resident-meta">
              <span className="context-avatar query-glyph-avatar">
                <Users size={18} />
              </span>
              <div className="context-resident-titles">
                <div className="context-title-row">
                  <h3 className="resident-title">{query.title}</h3>
                  <span className={`query-status-pill status-${query.status}`}>
                    {isCompleted ? 'COORDINATION COMPLETED' : isCoordinating ? 'COORDINATION UNDERWAY' : 'SHARED DEMAND'}
                  </span>
                </div>
                <p className="resident-relation-text">
                  Shared neighborhood need · Preferred timing: {query.preferredTiming}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="context-close-btn"
              onClick={onDeselectItem}
              aria-label="Return to Neighborhood Pulse"
            >
              <X size={14} aria-hidden="true" />
              <span>Close</span>
            </button>
          </div>

          {actionFeedback && (
            <div className="panel-feedback-toast">
              <Check size={14} className="toast-icon" />
              <span>{actionFeedback}</span>
            </div>
          )}

          {/* Body Columns: WHAT IS HAPPENING + WHO/WHERE + WHAT CAN I DO */}
          <div className="context-body-columns">
            {/* Left Column: Shared Demand Aggregation (Privacy Guaranteed) */}
            <div className="context-column-left">
              <span className="column-eyebrow">WHAT IS HAPPENING</span>
              <h4 className="column-label">SHARED DEMAND AGGREGATION</h4>

              <div className="query-demand-banner">
                <div className="query-demand-count-wrap">
                  <span className="query-demand-count">{query.interestedCount}</span>
                  <span className="query-demand-label">
                    {isCompleted
                      ? 'homes coordinated'
                      : isCoordinating
                      ? 'homes coordinating'
                      : 'homes interested'}
                  </span>
                </div>
                {isIncluded && (
                  <span className="query-included-pill">
                    <Check size={12} style={{ marginRight: 4 }} />
                    You're included
                  </span>
                )}
              </div>

              <p className="query-desc-text">{query.description}</p>

              <div className="query-details-list">
                <div className="query-detail-item">
                  <span className="detail-key">Preferred Window</span>
                  <span className="detail-val">{query.preferredTiming}</span>
                </div>
                <div className="query-detail-item">
                  <span className="detail-key">Coordination Status</span>
                  <span className="detail-val">
                    {isCompleted
                      ? 'Completed · Service fulfilled'
                      : isCoordinating
                      ? 'Active coordination underway'
                      : 'Aggregating neighborhood interest'}
                  </span>
                </div>
              </div>

              {/* Strict Privacy Callout (Section 8: Never reveal individual houses) */}
              <div className="query-privacy-notice">
                <ShieldCheck size={14} className="privacy-shield-icon" aria-hidden="true" />
                <span>
                  <strong>Privacy Protected:</strong> Aggregate demand is visible to the neighborhood. Participating homes are not listed publicly.
                </span>
              </div>
            </div>

            {/* Right Column: Relational Context & Primary Action */}
            <div className="context-column-right">
              <div className="context-trust-block">
                <span className="column-eyebrow">WHO & WHERE</span>
                <h4 className="column-label">NEIGHBORHOOD COORDINATION CONTEXT</h4>
                <div className="trust-cardlet">
                  <Users size={18} className="trust-shield-icon" aria-hidden="true" />
                  <div className="trust-cardlet-text">
                    <span className="trust-cardlet-title">Shared Practical Need</span>
                    <p className="trust-cardlet-detail">
                      Discovering shared demand across Greenwood Commons allows joint scheduling, lower call-out fees, and synchronized neighbor visits.
                    </p>
                  </div>
                </div>
              </div>

              {/* Primary Action Button (Strict state transitions per Section 5, 6, 7, 11, 12, 14) */}
              <div className="context-action-cta">
                {!isIncluded && !isCoordinating && !isCompleted && (
                  <>
                    <button
                      type="button"
                      className="btn-primary context-cta-btn"
                      onClick={() => {
                        if (onJoinQuery) onJoinQuery(query.id);
                        triggerAction("You're included in this shared query. Aggregate count updated.");
                      }}
                    >
                      I need this too
                    </button>
                    <span className="context-cta-hint">Indicate your household has this need · Updates count</span>
                  </>
                )}

                {isIncluded && !isCoordinating && !isCompleted && (
                  <>
                    <div className="query-action-included-row">
                      <span className="query-included-affirmation">
                        <Check size={13} style={{ marginRight: 4 }} />
                        You're included
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-primary context-cta-btn btn-coordinate"
                      onClick={() => {
                        if (onCoordinateQuery) onCoordinateQuery(query.id);
                        triggerAction("Coordination underway. Added to My Coordination.");
                      }}
                    >
                      Coordinate service
                    </button>
                    <span className="context-cta-hint">Transition demand into active coordination for {query.interestedCount} homes</span>
                  </>
                )}

                {isCoordinating && !isCompleted && (
                  <>
                    <div className="query-coordinating-pill">
                      <Users size={13} style={{ marginRight: 5 }} />
                      <span>Coordination underway ({query.interestedCount} homes)</span>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary context-cta-btn"
                      onClick={() => {
                        if (onCompleteQuery) onCompleteQuery(query.id);
                        triggerAction("Coordination marked as completed.");
                      }}
                    >
                      Mark coordination complete
                    </button>
                    <span className="context-cta-hint">Fulfill and close this shared query</span>
                  </>
                )}

                {isCompleted && (
                  <div className="query-completed-callout">
                    <CheckCircle2 size={16} className="completed-check-icon" />
                    <div>
                      <strong>✓ Coordination completed</strong>
                      <p>{query.interestedCount} homes coordinated.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 5. DEFAULT OVERVIEW: NEIGHBORHOOD PULSE (Clean Editorial Stream)
  // ---------------------------------------------------------------------------
  const activeSharedQuery = (queries || []).find((q) => q.status === 'open');

  return (
    <div className="saathi-contextual-panel pulse-panel" role="region" aria-label="Neighborhood Pulse">
      <div className="pulse-body-layout">
        {/* Left Column: Timeline Activity Stream */}
        <div className="pulse-stream-column">
          <div className="pulse-header-row">
            <div className="pulse-titles">
              <span className="pulse-eyebrow">LIVE NEIGHBORHOOD CONTEXT</span>
              <h3 className="pulse-title">NEIGHBORHOOD PULSE</h3>
              <p className="pulse-subtitle">Recent coordination context, mutual availability, & updates across Oakridge Circle (Click any item to inspect)</p>
            </div>
          </div>

          <div className="pulse-timeline-list">
            {(pulseList || NEIGHBORHOOD_PULSE).map((item) => (
              <div
                key={item.id}
                className="pulse-timeline-row clickable-pulse-row"
                onClick={() => {
                  if (item.type === 'query') {
                    const targetQuery = (queries || []).find((q) => q.id === (item.queryId || item.relatedId)) || {
                      id: item.queryId || 'query-1',
                      title: item.title || 'AC servicing',
                      description: 'Several homes in Greenwood Commons are interested in AC servicing this week.',
                      preferredTiming: 'This week',
                      interestedCount: 3,
                      currentUserIncluded: false,
                      status: 'open',
                    };
                    if (onSelectItem) onSelectItem({ type: 'query', ...targetQuery });
                    return;
                  }
                  if (item.type === 'issue' || item.issueId) {
                    const targetIssue =
                      NEIGHBORHOOD_ISSUES.find((i) => i.id === (item.issueId || item.relatedId)) ||
                      NEIGHBORHOOD_ISSUES.find((i) => i.lotId === item.lotId) ||
                      NEIGHBORHOOD_ISSUES[0];
                    if (targetIssue && onSelectItem) {
                      onSelectItem(targetIssue);
                      return;
                    }
                  }
                  if (item.type === 'resource' || item.resourceId) {
                    for (const lot of RESIDENTIAL_LOTS) {
                      const targetRes = lot.resources?.find((r) => r.id === (item.resourceId || item.relatedId));
                      if (targetRes && onSelectItem) {
                        onSelectItem({ ...targetRes, lotId: lot.id, type: 'resource' });
                        return;
                      }
                    }
                  }
                  const targetLot = RESIDENTIAL_LOTS.find((l) => l.id === item.lotId) || RESIDENTIAL_LOTS[0];
                  if (targetLot && onSelectItem) {
                    onSelectItem({ type: item.type, lotId: item.lotId, ...targetLot });
                  }
                }}
                title={
                  item.type === 'query'
                    ? `Click to inspect shared query: ${item.title || item.text}`
                    : `Click to inspect ${item.title || item.text}`
                }
                role="button"
                tabIndex={0}
              >
                <div className="tl-left-rail">
                  <span className="tl-time-pill">{item.time}</span>
                  <span className={`tl-dot dot-${item.type}`} />
                </div>
                <div className="tl-content-block">
                  <div className="tl-badge-row">
                    <span className={`pulse-type-badge badge-${item.type}`}>
                      {item.type === 'query' ? 'SHARED QUERY' : item.type.toUpperCase()}
                    </span>
                    <span className="tl-lot-tag">
                      {item.type === 'query' ? 'Greenwood Commons · Shared Demand' : `Oakridge Circle · Lot ${item.lotId}`}
                    </span>
                  </div>
                  <p className="tl-event-text">
                    {item.title ? (
                      <>
                        <strong style={{ fontWeight: 700, color: 'var(--saathi-text-primary)', marginRight: 4 }}>
                          {item.title}
                        </strong>
                        {item.subtitle ? `· ${item.subtitle}` : ''}
                      </>
                    ) : (
                      item.text
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Actionable Hub Attention & Shared Demand (No Duplicate Titles) */}
        <div className="pulse-summary-column">
          <div className="hub-summary-cardlet">
            <span className="summary-eyebrow">ACTIONABLE HUB ATTENTION</span>
            <h4 className="summary-hub-title">Today's Attention & Schedule</h4>
            <p className="summary-hub-sub">Ward 4 · 24 Verified Proximity Keyholders</p>

            {/* Actionable Item 1: Open Safety Attention */}
            <div className="summary-action-item attention-item">
              <div className="item-badge-row">
                <span className="summary-alert-tag">⚠️ 1 ATTENTION NEEDED</span>
                <span className="summary-lot-tag">Lot 3</span>
              </div>
              <p className="summary-action-title">Loose Paving Stone Near West Crosswalk</p>
              <button
                type="button"
                className="summary-inline-action-btn"
                onClick={() => {
                  const issue = NEIGHBORHOOD_ISSUES.find((i) => i.id === 'iss-2');
                  if (issue && onSelectItem) onSelectItem(issue);
                }}
              >
                Inspect issue on 3D map →
              </button>
            </div>

            {/* Actionable Item 2: Active Shared Query (if open) */}
            {activeSharedQuery && (
              <div className="summary-action-item query-summary-item">
                <div className="item-badge-row">
                  <span className="summary-query-tag">SHARED DEMAND</span>
                  <span className="summary-lot-tag">{activeSharedQuery.interestedCount} homes</span>
                </div>
                <p className="summary-action-title">{activeSharedQuery.title}</p>
                <button
                  type="button"
                  className="summary-inline-action-btn"
                  onClick={() => {
                    if (onSelectItem) onSelectItem({ type: 'query', ...activeSharedQuery });
                  }}
                >
                  View shared query →
                </button>
              </div>
            )}

            {/* Actionable Item 3: Scheduled Coordination */}
            <div className="summary-action-item schedule-item">
              <div className="item-badge-row">
                <span className="summary-schedule-tag">2 COORDINATIONS TODAY</span>
                <span className="summary-lot-tag">Lot 2 & 3</span>
              </div>
              <p className="summary-action-title">Fern watering at 6:00 PM · Pruner borrow tomorrow</p>
            </div>

            <div className="summary-stats-pill">
              <div className="stat-unit">
                <span className="stat-val">{PILOT_HUB_INFO.connectedCount}</span>
                <span className="stat-lbl">Connected</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-unit">
                <span className="stat-val">6</span>
                <span className="stat-lbl">Lots</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-unit">
                <span className="stat-val">100%</span>
                <span className="stat-lbl">Keyholders</span>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary summary-ask-btn"
              onClick={onOpenAskModal}
              title="Post a request or query to Greenwood Commons neighbors"
            >
              <span>+ Create Neighborhood Ask</span>
              <ArrowRight size={14} className="btn-arrow" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
