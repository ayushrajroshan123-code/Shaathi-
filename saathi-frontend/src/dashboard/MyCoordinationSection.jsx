import React, { useState } from 'react';
import {
  ArrowRight,
  Clock,
  HelpingHand,
  Wrench,
  CheckCircle2,
  Inbox,
  Send,
  RotateCcw,
  ShieldAlert,
  Calendar,
  Check,
} from 'lucide-react';

/**
 * MyCoordinationSection
 * Canonical personal coordination surface (Requirements #22–#29).
 * Preserves the existing position, visual treatment, and card language.
 * Adds internal operational tabs:
 * - INCOMING (Requests requiring current user action as owner/helper)
 * - OUTGOING (Requests submitted by current user awaiting approval)
 * - ACTIVE (Currently active coordinations with explicit state machine)
 * - UPCOMING (Scheduled handoffs and approved coordination)
 * - RETURNS (RETURN_DUE or RETURN_PENDING requiring confirmation)
 * - COMPLETED (Clean, privacy-safe history)
 * - SAFETY (Private safety records & restricted states)
 */
export default function MyCoordinationSection({
  coordinationList = [],
  borrowRequests = [],
  currentUser = null,
  userRoleMode = 'resident',
  onToggleRoleMode,
  onSelectCoordination,
  onSelectRequest,
  onCancelRequest,
  requestsLoading = false,
  requestsError = null,
  onReloadRequests,
  coordinationTabsData = null,
  coordinationsLoading = false,
  coordinationsError = null,
  onReloadCoordinations,
}) {
  const [activeTab, setActiveTab] = useState('ACTIVE');

  const currentUserId = currentUser?.id || 'usr-sarah-04';
  const isOwnerMode = userRoleMode === 'resource_owner';
  const isLive = Boolean(coordinationTabsData);

  // 1. INCOMING: Requests requiring user's action as resource owner
  const incomingRequests = borrowRequests.filter((r) => {
    const isOwner = r.isIncoming || r.ownerId === currentUserId || isOwnerMode;
    return isOwner && r.status === 'REQUESTED';
  });

  // 2. OUTGOING: Requests submitted by user awaiting approval
  const outgoingRequests = borrowRequests.filter((r) => {
    return r.isOutgoing || r.requesterId === currentUserId;
  });

  // 3. ACTIVE: Coordinations currently active (IN_USE, HANDED_OVER, HANDOFF_READY)
  const activeCoordinations = isLive
    ? coordinationTabsData.ACTIVE || []
    : coordinationList.filter((c) => {
        return (
          c.state === 'IN_USE' ||
          c.state === 'HANDED_OVER' ||
          c.state === 'HANDOFF_READY' ||
          (c.status === 'active' && c.state !== 'COMPLETED' && c.state !== 'RETURN_PENDING' && c.state !== 'RETURN_DUE')
        );
      });

  // 4. UPCOMING: Approved & scheduled handoffs
  const upcomingCoordinations = isLive
    ? coordinationTabsData.UPCOMING || []
    : coordinationList.filter((c) => {
        return (
          c.state === 'APPROVED' ||
          c.state === 'SCHEDULED' ||
          (c.status === 'upcoming' && c.state !== 'COMPLETED')
        );
      });

  // 5. RETURNS: RETURN_DUE or RETURN_PENDING (awaiting two-party receipt confirmation)
  const returnCoordinations = isLive
    ? coordinationTabsData.RETURNS || []
    : coordinationList.filter((c) => {
        return (
          c.state === 'RETURN_DUE' ||
          c.state === 'RETURN_PENDING' ||
          c.borrowerReturnInitiated === true
        );
      });

  // 6. COMPLETED: Finished coordinations
  const completedCoordinations = isLive
    ? coordinationTabsData.COMPLETED || []
    : coordinationList.filter((c) => {
        return (
          c.state === 'COMPLETED' ||
          c.status === 'completed' ||
          c.status === 'returned'
        );
      });

  // 7. SAFETY: Blocked or safety concern items
  const safetyItems = isLive
    ? coordinationTabsData.SAFETY || []
    : borrowRequests.filter((r) => r.status === 'BLOCKED');

  const tabs = [
    { id: 'INCOMING', label: 'INCOMING', count: incomingRequests.length, highlight: incomingRequests.length > 0 },
    { id: 'OUTGOING', label: 'OUTGOING', count: outgoingRequests.length },
    { id: 'ACTIVE', label: 'ACTIVE', count: activeCoordinations.length },
    { id: 'UPCOMING', label: 'UPCOMING', count: upcomingCoordinations.length },
    { id: 'RETURNS', label: 'RETURNS', count: returnCoordinations.length, highlight: returnCoordinations.length > 0 },
    { id: 'COMPLETED', label: 'COMPLETED', count: completedCoordinations.length },
    { id: 'SAFETY', label: 'SAFETY', count: safetyItems.length },
  ];

  return (
    <section
      id="my-coordination-section"
      className="my-coordination-section"
      aria-label="My Coordination Section"
    >
      {/* Section Header */}
      <div className="coordination-section-header">
        <div className="coordination-header-titles">
          <span className="coordination-eyebrow">WHAT IS MINE</span>
          <h3 className="coordination-main-title">MY COORDINATION</h3>
        </div>

        {/* Perspective simulation switcher for test verification (Dev/Testing Only) */}
        {import.meta.env.DEV && onToggleRoleMode && (
          <div className="coordination-role-switcher-wrap">
            <button
              type="button"
              className="btn-role-perspective-switch"
              onClick={onToggleRoleMode}
              title="[DEV ONLY] Switch role between Resident (Sarah) and Resource Owner (Marcus) to test approval & return confirmation"
            >
              <span className="perspective-pill-dot" />
              <span>Viewing as: <strong>{isOwnerMode ? 'Marcus Vance (Resource Owner)' : 'Sarah Chen (Resident)'}</strong></span>
              <span className="perspective-hint">⇄ Switch</span>
            </button>
          </div>
        )}
      </div>

      {/* Internal Operational Categories Tabs (Requirement #22) */}
      <nav className="coordination-subtabs-nav" aria-label="Coordination Categories">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`coord-tab-btn ${activeTab === tab.id ? 'is-active' : ''} ${tab.highlight ? 'has-highlight' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            <span>{tab.label}</span>
            <span className="coord-tab-count">{tab.count}</span>
          </button>
        ))}
      </nav>

      {/* Tab Contents */}
      <div className="coordination-tab-panel" role="tabpanel">
        {/* 1. INCOMING REQUESTS (Requirement #23) */}
        {activeTab === 'INCOMING' && (
          requestsLoading ? (
            <div className="coordination-empty-card" role="status">
              <Clock size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">Loading incoming requests…</p>
            </div>
          ) : requestsError ? (
            <div className="coordination-empty-card tone-attention" role="status">
              <ShieldAlert size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">{requestsError}</p>
              {onReloadRequests && (
                <button type="button" className="btn-secondary" onClick={onReloadRequests} style={{ marginTop: '0.5rem' }}>
                  Retry
                </button>
              )}
            </div>
          ) : incomingRequests.length === 0 ? (
            <div className="coordination-empty-card" role="status">
              <Inbox size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">No incoming borrow requests awaiting your approval.</p>
              {import.meta.env.DEV && !isOwnerMode && (
                <button
                  type="button"
                  className="empty-action-hint-btn"
                  onClick={onToggleRoleMode}
                >
                  [DEV ONLY] Switch to Resource Owner perspective (Marcus) to review incoming requests →
                </button>
              )}
            </div>
          ) : (
            <div className="coordination-cards-grid">
              {incomingRequests.map((req) => (
                <article
                  key={req.id}
                  className="my-coordination-card is-incoming tone-incoming-card"
                  onClick={() => onSelectRequest && onSelectRequest(req)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (onSelectRequest) onSelectRequest(req);
                    }
                  }}
                  aria-label={`Incoming request for ${req.resourceName}`}
                >
                  <div className="coord-card-top-row">
                    <span className="coord-role-badge badge-incoming">
                      <Inbox size={12} className="badge-icon" aria-hidden="true" />
                      <span>Borrow Request · Awaiting Approval</span>
                    </span>
                    <span className="coord-counterpart">{req.requesterName} (Verified Neighbor)</span>
                  </div>

                  <h4 className="coord-card-title">{req.resourceName}</h4>
                  <p className="coord-card-purpose">Purpose: {req.purpose}</p>

                  <div className="coord-card-bottom-row">
                    <div className="coord-time-block">
                      <Clock size={13} className="time-icon" aria-hidden="true" />
                      <span className="time-text">Requested for: {req.requestedTime} ({req.duration})</span>
                    </div>

                    <button
                      type="button"
                      className="coord-action-link btn-review-incoming"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectRequest) onSelectRequest(req);
                      }}
                    >
                      <span>Review Request</span>
                      <ArrowRight size={13} className="action-arrow" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )
        )}

        {/* 2. OUTGOING REQUESTS (Requirement #24) */}
        {activeTab === 'OUTGOING' && (
          requestsLoading ? (
            <div className="coordination-empty-card" role="status">
              <Clock size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">Loading outgoing requests…</p>
            </div>
          ) : requestsError ? (
            <div className="coordination-empty-card tone-attention" role="status">
              <ShieldAlert size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">{requestsError}</p>
              {onReloadRequests && (
                <button type="button" className="btn-secondary" onClick={onReloadRequests} style={{ marginTop: '0.5rem' }}>
                  Retry
                </button>
              )}
            </div>
          ) : outgoingRequests.length === 0 ? (
            <div className="coordination-empty-card" role="status">
              <Send size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">You haven't submitted any borrow requests yet.</p>
            </div>
          ) : (
            <div className="coordination-cards-grid">
              {outgoingRequests.map((req) => (
                <article
                  key={req.id}
                  className="my-coordination-card is-outgoing"
                  onClick={() => onSelectRequest && onSelectRequest(req)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (onSelectRequest) onSelectRequest(req);
                    }
                  }}
                  aria-label={`Outgoing request: ${req.resourceName}`}
                >
                  <div className="coord-card-top-row">
                    <span className="coord-role-badge badge-borrowing">
                      <Send size={12} className="badge-icon" aria-hidden="true" />
                      <span>Outgoing Request</span>
                    </span>
                    <span className={`coord-status-chip status-${req.status.toLowerCase()}`}>
                      {req.status === 'REQUESTED' ? 'AWAITING APPROVAL' : req.status}
                    </span>
                  </div>

                  <h4 className="coord-card-title">{req.resourceName}</h4>
                  <p className="coord-card-purpose">Handoff: {req.handoffPreference}</p>

                  <div className="coord-card-bottom-row">
                    <div className="coord-time-block">
                      <Clock size={13} className="time-icon" aria-hidden="true" />
                      <span className="time-text">Requested: {req.requestedTime}</span>
                    </div>

                    <button
                      type="button"
                      className="coord-action-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectRequest) onSelectRequest(req);
                      }}
                    >
                      <span>View Status</span>
                      <ArrowRight size={13} className="action-arrow" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )
        )}

        {/* 3. ACTIVE COORDINATIONS (Requirement #25) */}
        {activeTab === 'ACTIVE' && (
          coordinationsLoading ? (
            <div className="coordination-empty-card" role="status">
              <Clock size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">Loading active coordinations…</p>
            </div>
          ) : coordinationsError ? (
            <div className="coordination-empty-card tone-attention" role="status">
              <ShieldAlert size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">{coordinationsError}</p>
              {onReloadCoordinations && (
                <button type="button" className="btn-secondary" onClick={onReloadCoordinations} style={{ marginTop: '0.5rem' }}>
                  Retry
                </button>
              )}
            </div>
          ) : activeCoordinations.length === 0 ? (
            <div className="coordination-empty-card" role="status">
              <CheckCircle2 size={24} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">No active coordinations currently in progress.</p>
            </div>
          ) : (
            <div className="coordination-cards-grid">
              {activeCoordinations.map((item) => {
                const isBorrowing = item.type === 'receiving' || item.type === 'resource' || item.role === 'borrowing';
                const roleText = isBorrowing ? "You're borrowing" : "You're helping / lending";
                const dueText = item.dueTime || item.time || 'Tomorrow';
                const counterpartText = item.counterpartDisplay || item.counterpart || 'Verified Neighbor';
                const titleText = item.resourceName || item.title;

                return (
                  <article
                    key={item.id}
                    className={`my-coordination-card ${isBorrowing ? 'is-borrowing' : 'is-helping'}`}
                    onClick={() => onSelectCoordination && onSelectCoordination(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (onSelectCoordination) onSelectCoordination(item);
                      }
                    }}
                    aria-label={`Coordination: ${titleText}, ${roleText}`}
                  >
                    <div className="coord-card-top-row">
                      <span className={`coord-role-badge ${isBorrowing ? 'badge-borrowing' : 'badge-helping'}`}>
                        {isBorrowing ? (
                          <Wrench size={12} className="badge-icon" aria-hidden="true" />
                        ) : (
                          <HelpingHand size={12} className="badge-icon" aria-hidden="true" />
                        )}
                        <span>{roleText}</span>
                      </span>

                      <span className="coord-counterpart">{counterpartText}</span>
                    </div>

                    <h4 className="coord-card-title">{titleText}</h4>
                    <div className="coord-card-state-row">
                      <span className="state-badge-pill">{item.state || 'IN USE'}</span>
                      <span className="handoff-note">
                        {item.handoff_details || item.handoff_preference || item.handoffLocation || 'Safe handoff arrangement'}
                      </span>
                    </div>

                    <div className="coord-card-bottom-row">
                      <div className="coord-time-block">
                        <Clock size={13} className="time-icon" aria-hidden="true" />
                        <span className="time-text">Return due: {dueText.replace(/^(Due\s+back\s+|Due\s+)/i, '')}</span>
                      </div>

                      <button
                        type="button"
                        className="coord-action-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectCoordination) onSelectCoordination(item);
                        }}
                      >
                        <span>View coordination</span>
                        <ArrowRight size={13} className="action-arrow" aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        )}

        {/* 4. UPCOMING (Requirement #26) */}
        {activeTab === 'UPCOMING' && (
          coordinationsLoading ? (
            <div className="coordination-empty-card" role="status">
              <Clock size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">Loading upcoming exchanges…</p>
            </div>
          ) : coordinationsError ? (
            <div className="coordination-empty-card tone-attention" role="status">
              <ShieldAlert size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">{coordinationsError}</p>
              {onReloadCoordinations && (
                <button type="button" className="btn-secondary" onClick={onReloadCoordinations} style={{ marginTop: '0.5rem' }}>
                  Retry
                </button>
              )}
            </div>
          ) : upcomingCoordinations.length === 0 ? (
            <div className="coordination-empty-card" role="status">
              <Calendar size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">No upcoming scheduled exchanges.</p>
            </div>
          ) : (
            <div className="coordination-cards-grid">
              {upcomingCoordinations.map((item) => (
                <article
                  key={item.id}
                  className="my-coordination-card is-upcoming-card"
                  onClick={() => onSelectCoordination && onSelectCoordination(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (onSelectCoordination) onSelectCoordination(item);
                    }
                  }}
                  aria-label={`Upcoming: ${item.resourceName || item.title}`}
                >
                  <div className="coord-card-top-row">
                    <span className="coord-role-badge badge-upcoming">
                      <Calendar size={12} className="badge-icon" aria-hidden="true" />
                      <span>{item.state || 'SCHEDULED'}</span>
                    </span>
                    <span className="coord-counterpart">{item.counterpartDisplay || item.counterpart || 'Verified Neighbor'}</span>
                  </div>

                  <h4 className="coord-card-title">{item.resourceName || item.title}</h4>
                  <p className="coord-card-purpose">Exchange Point: {item.handoffLocation || 'Community pickup at Cafe Courtyard'}</p>

                  <div className="coord-card-bottom-row">
                    <div className="coord-time-block">
                      <Clock size={13} className="time-icon" aria-hidden="true" />
                      <span className="time-text">Scheduled: {item.scheduledTime || item.time || 'Today'}</span>
                    </div>

                    <button
                      type="button"
                      className="coord-action-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectCoordination) onSelectCoordination(item);
                      }}
                    >
                      <span>View Details</span>
                      <ArrowRight size={13} className="action-arrow" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )
        )}

        {/* 5. RETURNS (Requirement #27: RETURN_DUE or RETURN_PENDING) */}
        {activeTab === 'RETURNS' && (
          coordinationsLoading ? (
            <div className="coordination-empty-card" role="status">
              <Clock size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">Loading returns…</p>
            </div>
          ) : coordinationsError ? (
            <div className="coordination-empty-card tone-attention" role="status">
              <ShieldAlert size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">{coordinationsError}</p>
              {onReloadCoordinations && (
                <button type="button" className="btn-secondary" onClick={onReloadCoordinations} style={{ marginTop: '0.5rem' }}>
                  Retry
                </button>
              )}
            </div>
          ) : returnCoordinations.length === 0 ? (
            <div className="coordination-empty-card" role="status">
              <RotateCcw size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">No returns currently pending or overdue.</p>
            </div>
          ) : (
            <div className="coordination-cards-grid">
              {returnCoordinations.map((item) => {
                const isPending = item.state === 'RETURN_PENDING' || item.borrowerReturnInitiated;

                return (
                  <article
                    key={item.id}
                    className="my-coordination-card is-return-card"
                    onClick={() => onSelectCoordination && onSelectCoordination(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (onSelectCoordination) onSelectCoordination(item);
                      }
                    }}
                    aria-label={`Return: ${item.resourceName || item.title}`}
                  >
                    <div className="coord-card-top-row">
                      <span className={`coord-role-badge ${isPending ? 'badge-return-pending' : 'badge-return-due'}`}>
                        <RotateCcw size={12} className="badge-icon" aria-hidden="true" />
                        <span>{isPending ? 'RETURN PENDING' : 'RETURN DUE'}</span>
                      </span>
                      <span className="coord-counterpart">{item.counterpartDisplay || item.counterpart || 'Verified Neighbor'}</span>
                    </div>

                    <h4 className="coord-card-title">{item.resourceName || item.title}</h4>
                    <p className="coord-card-purpose">
                      {isPending
                        ? 'Awaiting owner confirmation of receipt'
                        : 'Action required: Initiate return arrangement'}
                    </p>

                    <div className="coord-card-bottom-row">
                      <div className="coord-time-block">
                        <Clock size={13} className="time-icon" aria-hidden="true" />
                        <span className="time-text">
                          {isPending ? 'Return initiated' : `Due: ${item.dueTime || item.time || 'Today'}`}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="coord-action-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectCoordination) onSelectCoordination(item);
                        }}
                      >
                        <span>{isPending ? 'Confirm / Review' : 'Start Return'}</span>
                        <ArrowRight size={13} className="action-arrow" aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        )}

        {/* 6. COMPLETED (Requirement #28: Clean history without private addresses) */}
        {activeTab === 'COMPLETED' && (
          coordinationsLoading ? (
            <div className="coordination-empty-card" role="status">
              <Clock size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">Loading completed coordinations…</p>
            </div>
          ) : coordinationsError ? (
            <div className="coordination-empty-card tone-attention" role="status">
              <ShieldAlert size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">{coordinationsError}</p>
              {onReloadCoordinations && (
                <button type="button" className="btn-secondary" onClick={onReloadCoordinations} style={{ marginTop: '0.5rem' }}>
                  Retry
                </button>
              )}
            </div>
          ) : completedCoordinations.length === 0 ? (
            <div className="coordination-empty-card" role="status">
              <CheckCircle2 size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">No completed coordination history yet.</p>
            </div>
          ) : (
            <div className="coordination-cards-grid">
              {completedCoordinations.map((item) => (
                <article
                  key={item.id}
                  className="my-coordination-card is-completed-card"
                  onClick={() => onSelectCoordination && onSelectCoordination(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (onSelectCoordination) onSelectCoordination(item);
                    }
                  }}
                  aria-label={`Completed: ${item.resourceName || item.title}`}
                >
                  <div className="coord-card-top-row">
                    <span className="coord-role-badge badge-completed">
                      <Check size={12} className="badge-icon" aria-hidden="true" />
                      <span>Completed</span>
                    </span>
                    <span className="coord-scope-tag">Community resource</span>
                  </div>

                  <h4 className="coord-card-title">{item.resourceName || item.title}</h4>
                  <p className="coord-card-purpose">Safe handoff completed · Returned to community inventory</p>

                  <div className="coord-card-bottom-row">
                    <div className="coord-time-block">
                      <Clock size={13} className="time-icon" aria-hidden="true" />
                      <span className="time-text">{item.completedAt || 'Recently completed'}</span>
                    </div>

                    <button
                      type="button"
                      className="coord-action-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectCoordination) onSelectCoordination(item);
                      }}
                    >
                      <span>View record</span>
                      <ArrowRight size={13} className="action-arrow" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )
        )}

        {/* 7. SAFETY (Requirement #29: Private safety coordination) */}
        {activeTab === 'SAFETY' && (
          coordinationsLoading ? (
            <div className="coordination-empty-card" role="status">
              <Clock size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">Loading safety coordinations…</p>
            </div>
          ) : coordinationsError ? (
            <div className="coordination-empty-card tone-attention" role="status">
              <ShieldAlert size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">{coordinationsError}</p>
              {onReloadCoordinations && (
                <button type="button" className="btn-secondary" onClick={onReloadCoordinations} style={{ marginTop: '0.5rem' }}>
                  Retry
                </button>
              )}
            </div>
          ) : safetyItems.length === 0 ? (
            <div className="coordination-empty-card" role="status">
              <ShieldAlert size={22} className="empty-check-icon" aria-hidden="true" />
              <p className="empty-message">No active safety recovery coordinations.</p>
              <p className="empty-submessage">Active physical possessions that remain recoverable after safety actions will surface here.</p>
            </div>
          ) : (
            <div className="coordination-cards-grid">
              {safetyItems.map((item) => {
                const isCoordItem = isLive || item.coordination_id || item.state;
                const title = item.resourceName || item.resource_name || item.title || 'Community Resource';
                const counterpart = item.counterpartDisplay || item.counterpart_display || item.counterpart || 'Verified Neighbor';

                return (
                  <article
                    key={item.id}
                    className="my-coordination-card is-safety-card"
                    onClick={() => onSelectCoordination && isCoordItem && onSelectCoordination(item)}
                    role={isCoordItem ? 'button' : undefined}
                    tabIndex={isCoordItem ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (isCoordItem && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        if (onSelectCoordination) onSelectCoordination(item);
                      }
                    }}
                    aria-label={`Safety coordination: ${title}`}
                  >
                    <div className="coord-card-top-row">
                      <span className="coord-role-badge badge-safety">
                        <ShieldAlert size={12} className="badge-icon" aria-hidden="true" />
                        <span>Safety Recovery · {item.state || 'RESTRICTED'}</span>
                      </span>
                      <span className="coord-counterpart">{counterpart}</span>
                    </div>
                    <h4 className="coord-card-title">{title}</h4>
                    <p className="coord-card-purpose">
                      {item.role === 'borrowing'
                        ? 'Active possession in custody awaiting safe return coordination.'
                        : 'Your resource is currently in circulation awaiting safe return.'}
                    </p>

                    {isCoordItem && (
                      <div className="coord-card-bottom-row">
                        <div className="coord-time-block">
                          <Clock size={13} className="time-icon" aria-hidden="true" />
                          <span className="time-text">Status: {item.state || 'Active recovery'}</span>
                        </div>
                        <button
                          type="button"
                          className="coord-action-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectCoordination) onSelectCoordination(item);
                          }}
                        >
                          <span>View coordination</span>
                          <ArrowRight size={13} className="action-arrow" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )
        )}
      </div>
    </section>
  );
}
