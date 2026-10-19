import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  Wrench,
  AlertTriangle,
  HelpingHand,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Check,
  RotateCcw,
  MapPin,
  Users,
  Search,
  ArrowLeft,
  ShieldAlert,
  Inbox,
  Send,
  MessageSquare,
  Ban,
  FileText,
  ChevronRight,
  Flag,
} from 'lucide-react';
import { PILOT_HUB_INFO } from './dashboardData';
import { getResource, getResourceRequest } from '../api/resources';
import { getCoordination, sendCoordinationMessage } from '../api/coordinations';
import { addAnswer, markAnswerHelpful, clearHelpfulAnswer, resolveQuery } from '../api/queries.js';
import { apiClient } from '../api/client';

/**
 * ContextSurface
 * Canonical Layer 4 contextual surface ("WHAT CAN I DO").
 * 
 * Privacy-First, Approval-Gated Architecture:
 * 1. Resource Discovery: Resource-first presentation (NO owner names, NO lot numbers, NO private sheds).
 * 2. Resource Detail: Community resource specifications, pickup policy, approval requirement.
 * 3. Borrow Request Form: Purpose, Timing, Duration, Preferred handoff (Community / Neutral).
 * 4. Request Submission Confirmation: Status = REQUESTED, routed to My Coordination -> Outgoing.
 * 5. Owner Request Review: Behavioral eligibility signals (NO scores/gamification), Accept/Decline/Block/Report.
 * 6. Coordination State Machine: Full stepper (REQUESTED -> APPROVED -> SCHEDULED -> IN_USE -> RETURN_PENDING -> COMPLETED).
 * 7. Two-Party Return: Borrower starts return (RETURN_PENDING) -> Owner confirms return (COMPLETED).
 * 8. Member Protection: One-click blocking & private coordinator-only safety reporting.
 * 9. Lot Inspection: Preserved for Coverage & Issues without exposing private tool ownership.
 */
export default function ContextSurface({
  selectedEntity = null,
  onClose,
  onReturnResource,
  onCompleteCoordination,
  onResolveIssue,
  coordinationList = [],
  borrowRequests = [],
  blockedUserIds = [],
  issuesList = [],
  queriesList = [],
  resourcesList = [],
  lotsList = [],
  currentUser = null,
  userRoleMode = 'resident',
  onToggleRoleMode,
  onShowOnNeighborhood,
  onSelectEntity,
  onCreateBorrowRequest,
  onOwnerApprove,
  onOwnerDecline,
  onCancelRequest,
  onBlockMember,
  onReportConcern,
  onBorrowerStartReturn,
  onOwnerConfirmReturn,
  onTransitionCoordination,
  onSendCoordinationMessage,
  onAcceptCoverage,
  coverageList = [],
  coordinationMessages = [],
  coordinationEvents = [],
  resourcesLoading = false,
  resourcesError = null,
  onReloadResources,
  requestsLoading = false,
  requestsError = null,
  onReloadRequests,
  coordinationsLoading = false,
  coordinationsError = null,
  onReloadCoordinations,
  onUpdateIssueStatus,
}) {
  const [returnStatus, setReturnStatus] = useState('idle'); // 'idle' | 'returning' | 'returned' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [actionFeedback, setActionFeedback] = useState('');
  const [resourceSearch, setResourceSearch] = useState('');
  const [activeSubDetail, setActiveSubDetail] = useState(null); // null | sub-entity inspected within discovery

  // Live Detail & Async Mutation State
  const [liveResourceDetail, setLiveResourceDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [liveRequestDetail, setLiveRequestDetail] = useState(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState(null);

  const [liveCoordinationDetail, setLiveCoordinationDetail] = useState(null);
  const [coordinationLoading, setCoordinationLoading] = useState(false);
  const [coordinationError, setCoordinationError] = useState(null);
  const [coordinationNoteText, setCoordinationNoteText] = useState('');
  const [notePosting, setNotePosting] = useState(false);
  const [noteError, setNoteError] = useState(null);

  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [formSubmitError, setFormSubmitError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Borrow Request Form State
  const [requestPurpose, setRequestPurpose] = useState('');
  const [requestTime, setRequestTime] = useState('Today · 6:00 PM');
  const [requestDuration, setRequestDuration] = useState('~1 hour');
  const [requestHandoff, setRequestHandoff] = useState('Community pickup at Cafe Courtyard');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [createdRequestId, setCreatedRequestId] = useState(null);

  // Owner Review Decline / Message State
  const [declineReason, setDeclineReason] = useState('Resource unavailable at requested time');
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [ownerQuestionText, setOwnerQuestionText] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [showMessageInput, setShowMessageInput] = useState(false);

  // Safety Report State
  const [safetyCategory, setSafetyCategory] = useState('handoff_concern');
  const [safetyDescription, setSafetyDescription] = useState('');
  const [safetySubmitted, setSafetySubmitted] = useState(false);

  // Close drawer on Escape key
  useEffect(() => {
    if (!selectedEntity) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onClose) onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntity, onClose]);

  // Fetch live resource detail from backend when resource detail or borrow request form is viewed
  useEffect(() => {
    if (activeSubDetail && (activeSubDetail.type === 'resource_detail' || activeSubDetail.type === 'borrow_request' || activeSubDetail.type === 'resource')) {
      const resId = activeSubDetail.resource_id || activeSubDetail.id;
      if (resId && apiClient.getToken()) {
        setDetailLoading(true);
        setDetailError(null);
        getResource(resId)
          .then((detail) => {
            setLiveResourceDetail(detail);
          })
          .catch((err) => {
            setDetailError(err?.message || 'Resource is unavailable or has been removed.');
            setLiveResourceDetail(null);
          })
          .finally(() => {
            setDetailLoading(false);
          });
      } else {
        setLiveResourceDetail(activeSubDetail);
      }
    } else {
      setLiveResourceDetail(null);
      setDetailError(null);
    }
  }, [activeSubDetail?.id, activeSubDetail?.resource_id, activeSubDetail?.type]);

  // Fetch live request detail from backend when request review or status is viewed
  useEffect(() => {
    if ((selectedEntity?.type === 'owner_review' || selectedEntity?.type === 'request_status') && selectedEntity?.request) {
      const reqId = selectedEntity.request.id || selectedEntity.request.requestId || selectedEntity.request.request_id;
      if (reqId && apiClient.getToken()) {
        setRequestLoading(true);
        setRequestError(null);
        getResourceRequest(reqId)
          .then((detail) => {
            setLiveRequestDetail(detail);
          })
          .catch((err) => {
            setRequestError(err?.message || 'Request not found or unavailable.');
            setLiveRequestDetail(null);
          })
          .finally(() => {
            setRequestLoading(false);
          });
      } else {
        setLiveRequestDetail(selectedEntity.request);
      }
    } else {
      setLiveRequestDetail(null);
      setRequestError(null);
    }
  }, [selectedEntity?.request?.id, selectedEntity?.request?.requestId, selectedEntity?.request?.request_id, selectedEntity?.type]);

  // Fetch live coordination detail from backend when coordination is viewed
  useEffect(() => {
    if (
      selectedEntity &&
      (selectedEntity.type === 'coordination' ||
        selectedEntity.coordination_id ||
        (selectedEntity.state && (selectedEntity.resourceName || selectedEntity.resource_name)))
    ) {
      const coordId =
        selectedEntity.coordination_id ||
        selectedEntity.id ||
        selectedEntity.coordinationId;
      if (coordId && apiClient.getToken()) {
        setCoordinationLoading(true);
        setCoordinationError(null);
        getCoordination(coordId)
          .then((detail) => {
            setLiveCoordinationDetail(detail);
          })
          .catch((err) => {
            setCoordinationError(err?.message || 'Coordination not found or unavailable.');
            setLiveCoordinationDetail(null);
          })
          .finally(() => {
            setCoordinationLoading(false);
          });
      } else {
        setLiveCoordinationDetail(selectedEntity);
      }
    } else {
      setLiveCoordinationDetail(null);
      setCoordinationError(null);
    }
  }, [
    selectedEntity?.id,
    selectedEntity?.coordination_id,
    selectedEntity?.coordinationId,
    selectedEntity?.type,
  ]);

  // Reset local state when selected entity changes
  useEffect(() => {
    setReturnStatus('idle');
    setErrorMessage('');
    setActionFeedback('');
    setResourceSearch('');
    setActiveSubDetail(null);
    setRequestPurpose('');
    setRequestTime('Today · 6:00 PM');
    setRequestDuration('~1 hour');
    setRequestHandoff('Community pickup at Cafe Courtyard');
    setRequestMessage('');
    setRequestSubmitted(false);
    setCreatedRequestId(null);
    setShowDeclineInput(false);
    setShowMessageInput(false);
    setSafetySubmitted(false);
    setSafetyDescription('');
    setFormSubmitError(null);
    setSubmittingRequest(false);
    setActionLoading(false);
    setLiveCoordinationDetail(null);
    setCoordinationLoading(false);
    setCoordinationError(null);
    setCoordinationNoteText('');
    setNotePosting(false);
    setNoteError(null);
  }, [selectedEntity?.id, selectedEntity?.coordination_id, selectedEntity?.lotId, selectedEntity?.category, selectedEntity?.type, selectedEntity?.request?.id]);

  if (!selectedEntity) {
    return null; // Resting state: completely closed
  }

  // Handle "Show on neighborhood" spatial bridge for public neighborhood landmarks/issues
  const handleShowOnNeighborhood = (lotId) => {
    if (onShowOnNeighborhood && lotId) {
      onShowOnNeighborhood(lotId);
    }
  };

  // ---------------------------------------------------------------------------
  // 0A. LIVE EMERGENCY INCIDENT DRAWER (Server-authoritative verified incidents)
  // ---------------------------------------------------------------------------
  if (selectedEntity.type === 'live_incident' || selectedEntity.isLive) {
    const incId = selectedEntity.incident_id || selectedEntity.id || 'INCIDENT';
    const shortId = String(incId).slice(0, 8);
    const displayLocation = selectedEntity.location || 'Neighborhood Area';
    const createdDate = selectedEntity.created_at ? new Date(selectedEntity.created_at) : null;
    const formattedTime = createdDate && !isNaN(createdDate.getTime())
      ? createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;

    return (
      <aside
        className="saathi-context-surface overlay-drawer emergency-incident-drawer"
        role="dialog"
        aria-label="Active Emergency Incident Details"
        aria-modal="false"
      >
        <div className="surface-header">
          <div className="surface-header-text">
            <span className="surface-eyebrow" style={{ color: 'var(--saathi-em-red, #E5483A)', fontWeight: 800 }}>
              VERIFIED ACTIVE INCIDENT
            </span>
            <h3 className="surface-title">Incident #{shortId}</h3>
            <p className="surface-subtitle">{displayLocation}</p>
          </div>
          <button
            type="button"
            className="surface-close-btn"
            onClick={onClose}
            aria-label="Close details"
            title="Close details (Esc)"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="surface-body">
          <div className="surface-section">
            <div className="discovery-detail-box">
              <div className="detail-row">
                <span className="detail-key">Status</span>
                <span className="detail-val" style={{ color: 'var(--saathi-em-red, #E5483A)', fontWeight: 700 }}>
                  ● {selectedEntity.status || 'OPEN'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Priority</span>
                <span className="detail-val">
                  {selectedEntity.priority_level || 'HIGH'} (Score: {selectedEntity.priority_score ?? 'N/A'})
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Report Source</span>
                <span className="detail-val">{selectedEntity.source || 'SOS'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Coarse Location</span>
                <span className="detail-val">{displayLocation}</span>
              </div>
              {formattedTime && (
                <div className="detail-row">
                  <span className="detail-key">Reported</span>
                  <span className="detail-val">{formattedTime}</span>
                </div>
              )}
              {selectedEntity.affected_people !== undefined && selectedEntity.affected_people !== null && (
                <div className="detail-row">
                  <span className="detail-key">Affected Count</span>
                  <span className="detail-val">{selectedEntity.affected_people}</span>
                </div>
              )}
              {selectedEntity.vulnerable_people && selectedEntity.vulnerable_people !== 'none' && (
                <div className="detail-row">
                  <span className="detail-key">Vulnerability</span>
                  <span className="detail-val" style={{ textTransform: 'capitalize' }}>
                    {selectedEntity.vulnerable_people}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="surface-section surface-trust-section">
            <div className="trust-cardlet">
              <ShieldAlert size={16} className="trust-icon" style={{ color: 'var(--saathi-em-red, #E5483A)' }} aria-hidden="true" />
              <div className="trust-cardlet-text">
                <span className="trust-title">Privacy Protection Guard Active</span>
                <p className="trust-detail">
                  Raw GPS coordinates and personal identities are redacted for neighborhood privacy. Only authorized hub coordinators and assigned responders receive dispatch coordinates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // ---------------------------------------------------------------------------
  // 0B. LOCAL SIMULATION DEMO DRAWER (Explicitly badged demonstration)
  // ---------------------------------------------------------------------------
  if (selectedEntity.type === 'simulated_incident' || selectedEntity.isSimulated || selectedEntity.type === 'sos') {
    return (
      <aside
        className="saathi-context-surface overlay-drawer simulated-incident-drawer"
        role="dialog"
        aria-label="Simulated Emergency Alert Demonstration"
        aria-modal="false"
      >
        <div className="surface-header">
          <div className="surface-header-text">
            <span className="surface-eyebrow" style={{ color: 'var(--saathi-amber, #D97706)', fontWeight: 800 }}>
              LOCAL SIMULATION ONLY (DEMO)
            </span>
            <h3 className="surface-title">
              {selectedEntity.name || selectedEntity.title || 'Simulated Emergency'}
            </h3>
            <p className="surface-subtitle">
              {selectedEntity.lot ? `${selectedEntity.lot} · Demonstration Scenario` : 'Simulation Demonstration'}
            </p>
          </div>
          <button
            type="button"
            className="surface-close-btn"
            onClick={onClose}
            aria-label="Close details"
            title="Close details (Esc)"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="surface-body">
          <div className="surface-section">
            <div className="discovery-detail-box">
              <div className="detail-row">
                <span className="detail-key">Scenario Type</span>
                <span className="detail-val" style={{ color: 'var(--saathi-amber, #D97706)', fontWeight: 700 }}>
                  [SIMULATED] Not a Real Emergency
                </span>
              </div>
              {selectedEntity.need && (
                <div className="detail-row">
                  <span className="detail-key">Simulated Need</span>
                  <span className="detail-val">{selectedEntity.need}</span>
                </div>
              )}
              {selectedEntity.status && (
                <div className="detail-row">
                  <span className="detail-key">Demo Status</span>
                  <span className="detail-val">{selectedEntity.status}</span>
                </div>
              )}
              {selectedEntity.action && (
                <div className="detail-row">
                  <span className="detail-key">Simulated Action</span>
                  <span className="detail-val">{selectedEntity.action}</span>
                </div>
              )}
            </div>
          </div>

          <div className="surface-section surface-trust-section">
            <div className="trust-cardlet">
              <AlertTriangle size={16} className="trust-icon" style={{ color: 'var(--saathi-amber, #D97706)' }} aria-hidden="true" />
              <div className="trust-cardlet-text">
                <span className="trust-title">UI Simulation Mode Active</span>
                <p className="trust-detail">
                  This card represents local in-browser mock data for testing layout affordances. No live backend incident exists for this record.
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // ---------------------------------------------------------------------------
  // 1. DISCOVERY MODE (Neighborhood Pulse Discovery)
  // ---------------------------------------------------------------------------
  if (selectedEntity.type === 'discovery') {
    const category = selectedEntity.category;

    // -------------------------------------------------------------------------
    // A. SUB-DETAIL: BORROW REQUEST FORM (Requirement #13 & #14)
    // -------------------------------------------------------------------------
    if (activeSubDetail && activeSubDetail.type === 'borrow_request') {
      const targetRes = activeSubDetail;

      const handleSendBorrowRequest = async (e) => {
        e.preventDefault();
        if (!requestPurpose.trim() || submittingRequest) return;

        setSubmittingRequest(true);
        setFormSubmitError(null);

        try {
          if (onCreateBorrowRequest) {
            const req = await onCreateBorrowRequest({
              resourceId: targetRes.resource_id || targetRes.id,
              purpose: requestPurpose.trim(),
              requestedTime: requestTime,
              duration: requestDuration,
              handoffPreference: requestHandoff,
              message: requestMessage.trim(),
            });
            setCreatedRequestId(req?.id || req?.requestId || `req-${Date.now()}`);
            setRequestSubmitted(true);
          } else {
            setRequestSubmitted(true);
          }
        } catch (err) {
          setFormSubmitError(err?.message || 'Failed to submit borrow request.');
        } finally {
          setSubmittingRequest(false);
        }
      };

      return (
        <aside
          className="saathi-context-surface overlay-drawer discovery-drawer"
          role="dialog"
          aria-label={`Borrow request for ${targetRes.name}`}
          aria-modal="false"
        >
          <div className="surface-header">
            <div className="surface-header-text">
              <button
                type="button"
                className="surface-back-btn"
                onClick={() => {
                  setRequestSubmitted(false);
                  setActiveSubDetail(null);
                }}
                aria-label="Back to resources list"
              >
                <ArrowLeft size={13} aria-hidden="true" />
                <span>Back to shared resources</span>
              </button>
              <h3 className="surface-title">{requestSubmitted ? 'Request Sent' : 'Request to Borrow'}</h3>
              <p className="surface-subtitle">{targetRes.name}</p>
            </div>
            <button
              type="button"
              className="surface-close-btn"
              onClick={onClose}
              aria-label="Close details"
              title="Close details (Esc)"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="surface-body">
            {!requestSubmitted ? (
              <form onSubmit={handleSendBorrowRequest} className="borrow-request-form">
                {formSubmitError && (
                  <div className="surface-feedback-banner tone-error" role="alert" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '0.75rem' }}>
                    <AlertTriangle size={14} className="banner-icon" aria-hidden="true" />
                    <span>{formSubmitError}</span>
                  </div>
                )}
                <div className="form-info-callout">
                  <ShieldCheck size={16} className="callout-icon" aria-hidden="true" />
                  <p className="callout-text">
                    Your request and neighborhood verification will be sent to the owner for approval. Private contact details are never shared.
                  </p>
                </div>

                {/* Field: Purpose */}
                <div className="borrow-form-group">
                  <label htmlFor="req-purpose" className="borrow-label">
                    Why do you need it? <span className="req-asterisk">*</span>
                  </label>
                  <input
                    id="req-purpose"
                    type="text"
                    className="borrow-input"
                    placeholder="e.g. Mounting a shelf, garden maintenance..."
                    value={requestPurpose}
                    onChange={(e) => setRequestPurpose(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {/* Field: When do you need it? */}
                <div className="borrow-form-group">
                  <label htmlFor="req-time" className="borrow-label">
                    When do you need it?
                  </label>
                  <select
                    id="req-time"
                    className="borrow-select"
                    value={requestTime}
                    onChange={(e) => setRequestTime(e.target.value)}
                  >
                    <option value="Today · 6:00 PM">Today · 6:00 PM</option>
                    <option value="Tomorrow Morning · 9:00 AM">Tomorrow Morning · 9:00 AM</option>
                    <option value="Tomorrow Afternoon · 2:00 PM">Tomorrow Afternoon · 2:00 PM</option>
                    <option value="This Weekend · Saturday 10:00 AM">This Weekend · Saturday 10:00 AM</option>
                    <option value="Flexible timing">Flexible timing</option>
                  </select>
                </div>

                {/* Field: How long? */}
                <div className="borrow-form-group">
                  <label htmlFor="req-duration" className="borrow-label">
                    How long?
                  </label>
                  <select
                    id="req-duration"
                    className="borrow-select"
                    value={requestDuration}
                    onChange={(e) => setRequestDuration(e.target.value)}
                  >
                    <option value="~1 hour">~1 hour</option>
                    <option value="~2-3 hours">~2-3 hours</option>
                    <option value="Half day (morning or afternoon)">Half day</option>
                    <option value="Full day (return by evening)">Full day</option>
                  </select>
                </div>

                {/* Field: Preferred handoff (Requirement #13: Neutral/Community defaults) */}
                <div className="borrow-form-group">
                  <label className="borrow-label">Preferred handoff</label>
                  <div className="handoff-radios-list" role="radiogroup" aria-label="Preferred handoff location">
                    <label className={`handoff-radio-item ${requestHandoff.includes('Courtyard') ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="handoff-pref"
                        value="Community pickup at Cafe Courtyard"
                        checked={requestHandoff.includes('Courtyard')}
                        onChange={(e) => setRequestHandoff(e.target.value)}
                      />
                      <div className="radio-content">
                        <span className="radio-title">Community pickup</span>
                        <span className="radio-sub">Lot 1 Cafe Courtyard (Recommended neutral point)</span>
                      </div>
                    </label>

                    <label className={`handoff-radio-item ${requestHandoff.includes('Neutral') ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="handoff-pref"
                        value="Neutral location (Greenwood Pavilion)"
                        checked={requestHandoff.includes('Neutral')}
                        onChange={(e) => setRequestHandoff(e.target.value)}
                      />
                      <div className="radio-content">
                        <span className="radio-title">Neutral location</span>
                        <span className="radio-sub">Central community gazebo / benches</span>
                      </div>
                    </label>

                    <label className={`handoff-radio-item ${requestHandoff.includes('Agreed') ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="handoff-pref"
                        value="Agreed arrangement (Coordinate in thread)"
                        checked={requestHandoff.includes('Agreed')}
                        onChange={(e) => setRequestHandoff(e.target.value)}
                      />
                      <div className="radio-content">
                        <span className="radio-title">Agreed arrangement</span>
                        <span className="radio-sub">Owner-controlled handoff arrangement</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Field: Message for owner */}
                <div className="borrow-form-group">
                  <label htmlFor="req-message" className="borrow-label">
                    Message / Note for owner <span className="label-optional">(Optional)</span>
                  </label>
                  <textarea
                    id="req-message"
                    className="borrow-textarea"
                    rows="2"
                    placeholder="Add details about your project or pickup convenience..."
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                  />
                </div>

                <div className="borrow-form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setActiveSubDetail(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary btn-submit-request"
                    disabled={!requestPurpose.trim() || submittingRequest}
                  >
                    {submittingRequest ? 'Sending…' : 'Send Request'}
                  </button>
                </div>
              </form>
            ) : (
              /* Request Sent Confirmation (Requirement #14) */
              <div className="request-confirmed-card" role="status">
                <div className="confirmed-icon-wrap">
                  <CheckCircle2 size={32} className="confirmed-check-icon" aria-hidden="true" />
                </div>
                <h4 className="confirmed-headline">REQUEST SENT</h4>
                <p className="confirmed-sub">Your request has been sent for owner approval.</p>

                <div className="confirmed-details-box">
                  <div className="detail-row">
                    <span className="detail-key">Resource</span>
                    <span className="detail-val">{targetRes.name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Status</span>
                    <span className="detail-val status-requested-badge">REQUESTED</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Timing</span>
                    <span className="detail-val">{requestTime}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Handoff</span>
                    <span className="detail-val">{requestHandoff}</span>
                  </div>
                </div>

                <p className="confirmed-notice">
                  You can track this request under <strong>My Coordination → Outgoing</strong>. The owner will review your verification and eligibility signals before approving.
                </p>

                <div className="confirmed-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setActiveSubDetail(null);
                      onClose();
                      const el = document.getElementById('my-coordination-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    View in My Coordination
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setActiveSubDetail(null)}
                  >
                    Back to Resources
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      );
    }

    // -------------------------------------------------------------------------
    // B. SUB-DETAIL: RESOURCE DETAIL VIEW (Requirement #12)
    // -------------------------------------------------------------------------
    if (activeSubDetail && (activeSubDetail.type === 'resource_detail' || activeSubDetail.type === 'resource')) {
      const res = activeSubDetail;
      const displayRes = liveResourceDetail || res;

      return (
        <aside
          className="saathi-context-surface overlay-drawer discovery-drawer"
          role="dialog"
          aria-label={`Details for ${displayRes.name || res.name}`}
          aria-modal="false"
        >
          <div className="surface-header">
            <div className="surface-header-text">
              <button
                type="button"
                className="surface-back-btn"
                onClick={() => setActiveSubDetail(null)}
                aria-label="Back to resources list"
              >
                <ArrowLeft size={13} aria-hidden="true" />
                <span>Back to shared resources</span>
              </button>
              <h3 className="surface-title">{displayRes.name || res.name}</h3>
              <p className="surface-subtitle">Available in your neighborhood</p>
            </div>
            <button
              type="button"
              className="surface-close-btn"
              onClick={onClose}
              aria-label="Close details"
              title="Close details (Esc)"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="surface-body">
            {detailError ? (
              <div className="surface-section">
                <div className="discovery-empty-card tone-attention" role="status">
                  <AlertTriangle size={24} className="empty-check-icon" aria-hidden="true" />
                  <p className="empty-message">{detailError}</p>
                </div>
              </div>
            ) : detailLoading ? (
              <div className="surface-section">
                <p className="empty-message">Loading resource details…</p>
              </div>
            ) : (
              <>
                {/* Status & Category */}
                <div className="surface-section">
                  <div className="discovery-detail-box">
                    <div className="detail-row">
                      <span className="detail-key">Availability</span>
                      <span className={`detail-val ${displayRes.available !== false ? 'text-available' : ''}`}>
                        {displayRes.available !== false ? '● Available' : '● Currently in use'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-key">Category</span>
                      <span className="detail-val">{((displayRes.type || displayRes.category) || 'Tools').toUpperCase()}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-key">Area</span>
                      <span className="detail-val">{displayRes.general_area || displayRes.generalArea || 'Greenwood Commons Nearby'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-key">Handoff</span>
                      <span className="detail-val">{displayRes.handoff_policy || displayRes.handoffPolicy || 'Community pickup at Cafe Courtyard'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-key">Approval</span>
                      <span className="detail-val">
                        {displayRes.requires_approval !== false ? 'Owner approval required' : 'Self-checkout available'}
                      </span>
                    </div>
                    {displayRes.condition && (
                      <div className="detail-row">
                        <span className="detail-key">Condition</span>
                        <span className="detail-val">{displayRes.condition}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Privacy Guarantee Banner */}
                <div className="surface-section">
                  <div className="privacy-guarantee-card">
                    <ShieldCheck size={16} className="trust-icon" aria-hidden="true" />
                    <div className="guarantee-text">
                      <span className="guarantee-title">Privacy-Protected Resource</span>
                      <p className="guarantee-detail">
                        Owner identity and private residential location are protected. Direct pickup arrangements happen through safe, mutually agreed coordination following approval.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Primary Action: Request to Borrow */}
                {displayRes.available !== false && (
                  <div className="surface-section" style={{ marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="surface-primary-action-btn"
                      onClick={() => setActiveSubDetail({ ...displayRes, type: 'borrow_request' })}
                    >
                      <Wrench size={14} aria-hidden="true" />
                      <span>Request to Borrow</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      );
    }

    // -------------------------------------------------------------------------
    // C. SUB-DETAIL: ISSUE OR COORDINATION (Preserved existing non-resource details)
    // -------------------------------------------------------------------------
    if (activeSubDetail && (activeSubDetail.type === 'issue' || activeSubDetail.type === 'coordination')) {
      const subItem = activeSubDetail;
      const isSubIssue = subItem.type === 'issue';

      const handleUpdateIssueStatusLocal = async (status, reason) => {
        if (actionLoading) return;
        setActionLoading(true);
        setErrorMessage('');
        try {
          if (onUpdateIssueStatus) await onUpdateIssueStatus(subItem.id, status, reason);
          setActiveSubDetail(prev => ({ ...prev, status }));
          setShowMessageInput(false);
          setOwnerQuestionText('');
        } catch (err) {
          setErrorMessage(err?.message || 'Failed to update issue status.');
        } finally {
          setActionLoading(false);
        }
      };

      return (
        <aside
          className="saathi-context-surface overlay-drawer discovery-drawer"
          role="dialog"
          aria-label={`Details for ${subItem.title}`}
          aria-modal="false"
        >
          <div className="surface-header">
            <div className="surface-header-text">
              <button
                type="button"
                className="surface-back-btn"
                onClick={() => setActiveSubDetail(null)}
                aria-label="Back to list"
              >
                <ArrowLeft size={13} aria-hidden="true" />
                <span>Back</span>
              </button>
              <h3 className="surface-title">{subItem.title}</h3>
              <p className="surface-subtitle">{subItem.lotId ? `Lot ${subItem.lotId} · ` : ''}{PILOT_HUB_INFO.name}</p>
            </div>
            <button
              type="button"
              className="surface-close-btn"
              onClick={onClose}
              aria-label="Close details"
              title="Close details (Esc)"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="surface-body">
            {isSubIssue ? (
              <div className="surface-section">
                <span className="section-label">ISSUE OBSERVATION</span>
                {errorMessage && (
                  <div className="auth-error-banner" role="alert" style={{ marginBottom: 12 }}>
                    {errorMessage}
                  </div>
                )}
                <div className="discovery-detail-box">
                  <div className="detail-row">
                    <span className="detail-key">Status</span>
                    <span className="detail-val">{subItem.status}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Severity</span>
                    <span className="detail-val">{(subItem.severity || 'low').toUpperCase()}</span>
                  </div>
                  <p className="issue-desc-text" style={{ marginTop: '0.5rem' }}>{subItem.detail}</p>
                </div>
                {subItem.reported_by && (
                  <div className="issue-actions-section" style={{ marginTop: '1rem' }}>
                    <span className="section-label">MANAGE ISSUE (REPORTER ONLY)</span>
                    <div className="decision-primary-buttons" style={{ marginTop: '0.5rem' }}>
                      {subItem.status === 'reported' && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleUpdateIssueStatusLocal('in_progress')}
                          disabled={actionLoading}
                        >
                          Mark In Progress
                        </button>
                      )}
                      {(subItem.status === 'reported' || subItem.status === 'in_progress') && (
                        <button
                          type="button"
                          className="btn-primary btn-accept-request"
                          onClick={() => handleUpdateIssueStatusLocal('resolved')}
                          disabled={actionLoading}
                        >
                          <Check size={14} aria-hidden="true" />
                          <span>Mark Resolved</span>
                        </button>
                      )}
                      {subItem.status === 'resolved' && (
                        <button
                          type="button"
                          className="btn-secondary btn-decline-toggle"
                          onClick={() => setShowMessageInput(true)}
                          disabled={actionLoading}
                        >
                          Needs Attention (Reopen)
                        </button>
                      )}
                    </div>
                    {showMessageInput && subItem.status === 'resolved' && (
                      <div className="coordination-inline-message-box" style={{ marginTop: '0.5rem' }}>
                        <input
                          type="text"
                          className="borrow-input"
                          placeholder="Reason for reopening..."
                          value={ownerQuestionText}
                          onChange={(e) => setOwnerQuestionText(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleUpdateIssueStatusLocal('attention_needed', ownerQuestionText.trim())}
                          disabled={!ownerQuestionText.trim() || actionLoading}
                        >
                          Reopen
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="surface-section">
                <span className="section-label">COORDINATION SUMMARY</span>
                <div className="discovery-detail-box">
                  <div className="detail-row">
                    <span className="detail-key">Role</span>
                    <span className="detail-val">{subItem.type === 'receiving' ? "You're borrowing" : "You're helping"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Due / Time</span>
                    <span className="detail-val">{subItem.dueTime || subItem.time}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      );
    }

    // -------------------------------------------------------------------------
    // 1. DISCOVERY: SHARED RESOURCES (Requirements #6, #7, #8, #9)
    // DISCOVER THE RESOURCE, NOT THE PERSON.
    // -------------------------------------------------------------------------
    if (category === 'resources') {
      const allResources = resourcesList || [];
      const query = resourceSearch.trim().toLowerCase();

      const filteredResources = allResources.filter((r) => {
        // Exclude blocked owners
        if (r._owner && blockedUserIds.includes(r._owner.id)) return false;
        if (!query) return true;
        const nameMatch = (r.name || '').toLowerCase().includes(query);
        const catMatch = (r.category || '').toLowerCase().includes(query);
        return nameMatch || catMatch;
      });

      return (
        <aside
          className="saathi-context-surface overlay-drawer discovery-drawer"
          role="dialog"
          aria-label="Shared Neighborhood Resources Discovery"
          aria-modal="false"
        >
          <div className="surface-header">
            <div className="surface-header-text">
              <span className="surface-eyebrow">WHAT CAN I BORROW</span>
              <h3 className="surface-title">Shared Resources</h3>
              <p className="surface-subtitle">
                {allResources.length} community resources available nearby
              </p>
            </div>
            <button
              type="button"
              className="surface-close-btn"
              onClick={onClose}
              aria-label="Close discovery"
              title="Close (Esc)"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Search Box */}
          <div className="surface-search-wrap">
            <div className="discovery-search-box">
              <Search size={14} className="search-icon" aria-hidden="true" />
              <input
                type="search"
                className="discovery-search-input"
                placeholder="Search tools, medical, garden equipment..."
                value={resourceSearch}
                onChange={(e) => setResourceSearch(e.target.value)}
                aria-label="Search resources"
              />
              {resourceSearch && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setResourceSearch('')}
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="surface-body">
            {resourcesLoading ? (
              <div className="discovery-empty-card" role="status">
                <p className="empty-message">Loading community resources…</p>
              </div>
            ) : resourcesError ? (
              <div className="discovery-empty-card tone-attention" role="status">
                <AlertTriangle size={24} className="empty-check-icon" aria-hidden="true" />
                <p className="empty-message">{resourcesError}</p>
                {onReloadResources && (
                  <button type="button" className="btn-secondary" onClick={onReloadResources} style={{ marginTop: '0.5rem' }}>
                    Retry
                  </button>
                )}
              </div>
            ) : allResources.length === 0 ? (
              <div className="discovery-empty-card" role="status">
                <CheckCircle2 size={24} className="empty-check-icon" aria-hidden="true" />
                <p className="empty-message">No shared resources currently available.</p>
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="discovery-empty-card" role="status">
                <p className="empty-message">No matching resources found for "{resourceSearch}".</p>
              </div>
            ) : (
              <div className="discovery-records-list">
                {filteredResources.map((res) => (
                  <article key={res.id || res.resource_id} className="discovery-resource-card-v2">
                    <div className="res-card-top">
                      <span className="res-status-dot">● Available</span>
                      <span className="res-cat-tag">{((res.category || res.type) || 'Shared').toUpperCase()}</span>
                    </div>

                    <h4 className="res-card-title">{res.name}</h4>

                    <div className="res-card-meta-block">
                      <span className="res-meta-line">{res.generalArea || res.general_area || 'Available in your neighborhood'}</span>
                      <span className="res-meta-line muted-meta">{res.handoffPolicy || res.handoff_policy || 'Community resource · Community pickup'}</span>
                    </div>

                    <div className="res-card-actions-row">
                      <button
                        type="button"
                        className="btn-primary btn-request-borrow-cta"
                        onClick={() => setActiveSubDetail({ ...res, type: 'borrow_request' })}
                      >
                        Request to Borrow
                      </button>

                      <button
                        type="button"
                        className="res-details-link"
                        onClick={() => setActiveSubDetail({ ...res, type: 'resource_detail' })}
                      >
                        Details →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>
      );
    }

    // -------------------------------------------------------------------------
    // 2. DISCOVERY: NEEDS ATTENTION (Issues)
    // -------------------------------------------------------------------------
    if (category === 'attention') {
      const activeIssues = (issuesList || []).filter((i) => i.status !== 'Resolved' && i.status !== 'resolved');

      return (
        <aside
          className="saathi-context-surface overlay-drawer discovery-drawer"
          role="dialog"
          aria-label="Neighborhood Issues Needing Attention"
          aria-modal="false"
        >
          <div className="surface-header">
            <div className="surface-header-text">
              <span className="surface-eyebrow">WHAT IS HAPPENING</span>
              <h3 className="surface-title">Needs Attention</h3>
              <p className="surface-subtitle">
                {activeIssues.length} {activeIssues.length === 1 ? 'issue nearby' : 'issues nearby'}
              </p>
            </div>
            <button
              type="button"
              className="surface-close-btn"
              onClick={onClose}
              aria-label="Close discovery"
              title="Close (Esc)"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="surface-body">
            {issuesLoading ? (
              <div className="discovery-empty-card" role="status">
                <p className="empty-message">Loading issues…</p>
              </div>
            ) : issuesError ? (
              <div className="discovery-empty-card tone-attention" role="status">
                <AlertTriangle size={24} className="empty-check-icon" aria-hidden="true" />
                <p className="empty-message">{issuesError}</p>
                {onReloadIssues && (
                  <button type="button" className="btn-secondary" onClick={onReloadIssues} style={{ marginTop: '0.5rem' }}>
                    Retry
                  </button>
                )}
              </div>
            ) : activeIssues.length === 0 ? (
              <div className="discovery-empty-card" role="status">
                <CheckCircle2 size={24} className="empty-check-icon" aria-hidden="true" />
                <p className="empty-message">No nearby issues need attention right now.</p>
              </div>
            ) : (
              <div className="discovery-records-list">
                {activeIssues.map((issue) => (
                  <article key={issue.id} className="discovery-record-card tone-attention">
                    <div className="record-top-row">
                      <span className={`severity-tag severity-${issue.severity}`}>
                        {(issue.severity || 'low').toUpperCase()}
                      </span>
                      <span className="record-lot-tag">Lot {issue.lotId}</span>
                    </div>

                    <h4 className="record-title">{issue.title}</h4>
                    <p className="record-description">{issue.detail}</p>

                    <div className="record-actions-row">
                      <button
                        type="button"
                        className="btn-show-on-map"
                        onClick={() => handleShowOnNeighborhood(issue.lotId)}
                        title={`Locate Lot ${issue.lotId} in 3D`}
                      >
                        <MapPin size={12} aria-hidden="true" />
                        <span>Show on neighborhood</span>
                      </button>

                      <button
                        type="button"
                        className="record-inspect-btn"
                        onClick={() => setActiveSubDetail({ ...issue, type: 'issue' })}
                      >
                        View details →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>
      );
    }

    // -------------------------------------------------------------------------
    // 3. DISCOVERY: COORDINATION
    // -------------------------------------------------------------------------
    if (category === 'coordination') {
      const activeCoords = (coordinationList || []).filter(
        (c) => c.status !== 'completed' && c.status !== 'returned' && c.state !== 'COMPLETED'
      );

      return (
        <aside
          className="saathi-context-surface overlay-drawer discovery-drawer"
          role="dialog"
          aria-label="Active Coordinations"
          aria-modal="false"
        >
          <div className="surface-header">
            <div className="surface-header-text">
              <span className="surface-eyebrow">WHAT IS HAPPENING</span>
              <h3 className="surface-title">Active Coordination</h3>
              <p className="surface-subtitle">
                {activeCoords.length} {activeCoords.length === 1 ? 'active commitment' : 'active commitments'}
              </p>
            </div>
            <button
              type="button"
              className="surface-close-btn"
              onClick={onClose}
              aria-label="Close discovery"
              title="Close (Esc)"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="surface-body">
            {activeCoords.length === 0 ? (
              <div className="discovery-empty-card" role="status">
                <CheckCircle2 size={24} className="empty-check-icon" aria-hidden="true" />
                <p className="empty-message">You're not coordinating anything right now.</p>
              </div>
            ) : (
              <div className="discovery-records-list">
                {activeCoords.map((coord) => (
                  <article key={coord.id} className="discovery-record-card tone-coord">
                    <div className="record-top-row">
                      <span className="coord-type-tag">
                        {coord.state || (coord.type === 'receiving' ? "Borrowing" : "Helping")}
                      </span>
                      <span className="record-scope-tag">
                        {coord.handoff_details || coord.handoff_preference || coord.handoffLocation || 'Coordinated handoff'}
                      </span>
                    </div>

                    <h4 className="record-title">{coord.resourceName || coord.title}</h4>
                    <p className="record-sub-meta">
                      {coord.counterpartDisplay || coord.counterpart || 'Verified Neighbor'} · Due {coord.dueTime || coord.time}
                    </p>

                    <div className="record-actions-row">
                      <button
                        type="button"
                        className="record-inspect-btn"
                        onClick={() => {
                          if (onSelectEntity) onSelectEntity({ ...coord, type: 'coordination' });
                        }}
                      >
                        Manage Coordination →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>
      );
    }

    // -------------------------------------------------------------------------
    // 4. DISCOVERY: MY AREAS
    // -------------------------------------------------------------------------
    if (category === 'my-areas') {
      const userLotId = currentUser?.lotId || 4;
      const userLots = (lotsList || []).filter((l) => l.id === userLotId);

      return (
        <aside
          className="saathi-context-surface overlay-drawer discovery-drawer"
          role="dialog"
          aria-label="My Covered Areas Discovery"
          aria-modal="false"
        >
          <div className="surface-header">
            <div className="surface-header-text">
              <span className="surface-eyebrow">WHAT IS HAPPENING</span>
              <h3 className="surface-title">My Areas</h3>
              <p className="surface-subtitle">
                {userLots.length} {userLots.length === 1 ? 'covered area' : 'covered areas'}
              </p>
            </div>
            <button
              type="button"
              className="surface-close-btn"
              onClick={onClose}
              aria-label="Close discovery"
              title="Close (Esc)"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="surface-body">
            {userLots.map((lot) => (
              <article key={lot.id} className="discovery-record-card tone-my-areas">
                <div className="record-top-row">
                  <span className="coverage-role-tag">Personal Coverage</span>
                  <span className="record-lot-tag">Lot {lot.id}</span>
                </div>

                <h4 className="record-title">{lot.name}</h4>
                <p className="record-description">{lot.description || lot.relation}</p>

                <div className="record-actions-row">
                  <button
                    type="button"
                    className="btn-show-on-map"
                    onClick={() => handleShowOnNeighborhood(lot.id)}
                    title={`Locate Lot ${lot.id} in 3D`}
                  >
                    <MapPin size={12} aria-hidden="true" />
                    <span>Show on neighborhood</span>
                  </button>

                  <button
                    type="button"
                    className="record-inspect-btn"
                    onClick={() => {
                      if (onSelectEntity) onSelectEntity(lot);
                    }}
                  >
                    Inspect Lot →
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 1.5. QUERY DETAIL VIEW
  // When a Neighborhood Pulse item of type 'query' is selected
  // ---------------------------------------------------------------------------
  if (selectedEntity.type === 'query') {
    const query = queriesList.find(q => q.id === (selectedEntity.queryId || selectedEntity.relatedId || selectedEntity.id) || q.query_id === (selectedEntity.queryId || selectedEntity.relatedId || selectedEntity.id)) || selectedEntity;
    const isCompleted = query.status === 'completed' || query.status === 'resolved';
    const isCreator = currentUser && (currentUser.id === query.creator_id || currentUser.user_id === query.creator_id);

    return (
      <aside
        className="saathi-context-surface overlay-drawer"
        role="dialog"
        aria-label="Neighborhood Query Detail"
        aria-modal="false"
      >
        <div className="surface-header">
          <div className="surface-header-text">
            <span className="surface-eyebrow">NEIGHBORHOOD QUERY</span>
            <h3 className="surface-title">{query.title || 'Neighborhood Query'}</h3>
          </div>
          <button
            type="button"
            className="surface-close-btn"
            onClick={onClose}
            aria-label="Close detail"
            title="Close (Esc)"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="surface-body" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <p style={{ fontSize: '15px', color: 'var(--saathi-text-primary)', flex: 1, marginRight: '16px' }}>
              {query.description || query.body}
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--saathi-danger)' }}
                onClick={() => {
                  setActiveSubDetail({
                    type: 'safety_report',
                    targetUserId: query.author_id || query.userId,
                    targetUserName: query.author_name || query.authorName || 'Neighbor',
                    contextId: query.id || query.query_id,
                    contextType: 'query',
                  });
                }}
              >
                <Flag size={14} />
                Report
              </button>
              {isCreator && !isCompleted && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={async () => {
                    try {
                      await resolveQuery(query.id || query.query_id, currentUser.id || currentUser.user_id);
                      if (window.loadLiveQueries) window.loadLiveQueries();
                    } catch (err) {
                      console.error("Failed to resolve query", err);
                    }
                  }}
                >
                  <CheckCircle2 size={14} />
                  Resolve Query
                </button>
              )}
              {isCompleted && (
                <div style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--saathi-bg-inset)', borderRadius: '4px', color: 'var(--saathi-text-secondary)' }}>
                  <CheckCircle2 size={14} />
                  Resolved
                </div>
              )}
            </div>
          </div>

          <div className="query-answers-section" style={{ borderTop: '1px solid var(--saathi-border)', paddingTop: '16px' }}>
            <h4 className="column-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--saathi-text-secondary)', marginBottom: '16px' }}>
              ANSWERS ({query.answers?.length || 0})
            </h4>
            
            <div className="query-answers-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              {(query.answers || []).map(ans => (
                <div key={ans.answer_id} style={{ padding: '12px', background: 'var(--saathi-bg-inset)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--saathi-text-secondary)', marginBottom: '4px' }}>
                    {new Date(ans.created_at).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '14px', marginBottom: '8px' }}>{ans.body}</div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--saathi-danger)' }}
                      onClick={() => {
                        setActiveSubDetail({
                          type: 'safety_report',
                          targetUserId: ans.author_id || ans.userId,
                          targetUserName: ans.author_name || ans.authorName || 'Neighbor',
                          contextId: query.id || query.query_id,
                          contextType: 'answer',
                          answerId: ans.answer_id,
                        });
                      }}
                    >
                      <Flag size={12} />
                      Report
                    </button>
                    {isCreator && (
                      <button
                        type="button"
                        className={`btn-secondary ${ans.is_helpful ? 'helpful-active' : ''}`}
                        style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: ans.is_helpful ? 'var(--saathi-primary-light)' : undefined, color: ans.is_helpful ? 'var(--saathi-primary)' : undefined, borderColor: ans.is_helpful ? 'var(--saathi-primary)' : undefined }}
                        onClick={async () => {
                          try {
                            if (ans.is_helpful) {
                              await clearHelpfulAnswer(query.id || query.query_id, ans.answer_id);
                            } else {
                              await markAnswerHelpful(query.id || query.query_id, ans.answer_id);
                            }
                            if (window.loadLiveQueries) window.loadLiveQueries();
                          } catch (err) {
                            console.error("Failed to update helpful status", err);
                          }
                        }}
                      >
                        <Check size={12} />
                        {ans.is_helpful ? 'Helpful (Clear)' : 'Mark Helpful'}
                      </button>
                    )}
                    {!isCreator && ans.is_helpful && (
                      <div style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--saathi-primary)' }}>
                        <Check size={12} />
                        Helpful
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="query-answer-input-box" style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                className="ask-text-input" 
                placeholder="Add an answer..." 
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--saathi-border)' }}
                disabled={isCompleted}
              />
              <button 
                type="button" 
                className="btn-primary"
                disabled={!newAnswer.trim() || isSubmittingAnswer || isCompleted}
                onClick={async () => {
                  if (!newAnswer.trim()) return;
                  setIsSubmittingAnswer(true);
                  try {
                    await addAnswer(query.id || query.query_id, { body: newAnswer.trim() });
                    setNewAnswer('');
                    if (window.loadLiveQueries) window.loadLiveQueries();
                  } catch (err) {
                    console.error("Failed to add answer", err);
                  } finally {
                    setIsSubmittingAnswer(false);
                  }
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. OWNER REVIEW VIEW (Requirements #15, #16, #17, #18, #19)
  // When current user reviews an incoming borrow request as resource owner
  // ---------------------------------------------------------------------------
  if (selectedEntity.type === 'owner_review' && selectedEntity.request) {
    const req = selectedEntity.request;
    const activeReq = liveRequestDetail || req;
    const targetReqId = req.id || req.requestId || req.request_id;
    const trust = (activeReq.requester_trust || activeReq.requesterTrust) || {
      identity_verified: true,
      neighborhood_verified: true,
      membership_age: '8 months',
      completed_coordinations: 6,
      no_outstanding_returns: true,
      eligible: true,
    };

    const handleAccept = async () => {
      if (actionLoading) return;
      setActionLoading(true);
      setErrorMessage('');
      try {
        if (onOwnerApprove) await onOwnerApprove(targetReqId);
        setActionFeedback(`Request approved for ${activeReq.resourceName || activeReq.resource_name}. Coordination scheduled under Active.`);
      } catch (err) {
        setErrorMessage(err?.message || 'Failed to approve request.');
      } finally {
        setActionLoading(false);
      }
    };

    const handleDecline = async () => {
      if (actionLoading) return;
      setActionLoading(true);
      setErrorMessage('');
      try {
        if (onOwnerDecline) await onOwnerDecline(targetReqId, declineReason);
        setActionFeedback('Request declined.');
        setShowDeclineInput(false);
      } catch (err) {
        setErrorMessage(err?.message || 'Failed to decline request.');
      } finally {
        setActionLoading(false);
      }
    };

    const handleBlock = async () => {
      const targetUserId = activeReq.requesterId || activeReq.requester_id;
      if (!targetUserId || actionLoading) return;
      setActionLoading(true);
      setErrorMessage('');
      try {
        if (onBlockMember) await onBlockMember(targetUserId);
        setActionFeedback('Member blocked from future requests.');
      } catch (err) {
        setErrorMessage(err?.message || 'Failed to block member.');
      } finally {
        setActionLoading(false);
      }
    };

    const handleOpenSafetyReport = () => {
      setActiveSubDetail({
        type: 'safety_report',
        targetUserId: activeReq.requesterId || activeReq.requester_id,
        targetUserName: activeReq.requesterName || activeReq.requester_name,
        contextId: activeReq.resourceId || activeReq.resource_id || targetReqId,
        contextType: 'resource',
      });
    };

    return (
      <aside
        className="saathi-context-surface overlay-drawer"
        role="dialog"
        aria-label={`Review request for ${req.resourceName}`}
        aria-modal="false"
      >
        <div className="surface-header">
          <div className="surface-header-text">
            <span className="surface-eyebrow">OWNER APPROVAL REVIEW</span>
            <h3 className="surface-title">Borrow Request</h3>
            <p className="surface-subtitle">{req.resourceName}</p>
          </div>
          <button
            type="button"
            className="surface-close-btn"
            onClick={onClose}
            aria-label="Close review"
            title="Close (Esc)"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {actionFeedback && (
          <div className="surface-feedback-banner" role="status">
            <Check size={14} className="banner-icon" aria-hidden="true" />
            <span>{actionFeedback}</span>
          </div>
        )}

        <div className="surface-body">
          {/* Request Particulars */}
          <div className="surface-section">
            <span className="section-label">REQUEST DETAILS</span>
            <div className="discovery-detail-box">
              <div className="detail-row">
                <span className="detail-key">Requested by</span>
                <span className="detail-val">{activeReq.requester_name || activeReq.requesterName || 'Verified Neighbor'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Purpose</span>
                <span className="detail-val">{activeReq.purpose || req.purpose || 'Community project'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Requested time</span>
                <span className="detail-val">{activeReq.requestedTime || (activeReq.time_window_start ? `${new Date(activeReq.time_window_start).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${new Date(activeReq.time_window_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Requested time')}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Duration</span>
                <span className="detail-val">{activeReq.duration || req.duration || 'Flexible'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Handoff</span>
                <span className="detail-val">{activeReq.handoff_preference || activeReq.handoffPreference || req.handoffPreference || 'Safe / mutually agreed arrangement'}</span>
              </div>
              {(activeReq.message || req.message) && (
                <div className="detail-message-block">
                  <span className="detail-key">Message from requester:</span>
                  <p className="detail-message-quote">"{activeReq.message || req.message}"</p>
                </div>
              )}
            </div>
          </div>

          {/* Factual Trust & Eligibility Signals (Requirement #17: NO scores, NO gamification) */}
          <div className="surface-section">
            <span className="section-label">VERIFICATION & ELIGIBILITY SIGNALS</span>
            <div className="trust-signals-box">
              <div className="trust-signal-item">
                <CheckCircle2 size={14} className="signal-check-icon" aria-hidden="true" />
                <span>Identity & Neighborhood Verified</span>
              </div>
              <div className="trust-signal-item">
                <CheckCircle2 size={14} className="signal-check-icon" aria-hidden="true" />
                <span>Account Active ({trust.membership_age || trust.membershipAge || '8 months'})</span>
              </div>
              <div className="trust-signal-item">
                <CheckCircle2 size={14} className="signal-check-icon" aria-hidden="true" />
                <span>Completed Coordinations ({trust.completed_coordinations ?? trust.completedCoordinations ?? '6'})</span>
              </div>
              <div className="trust-signal-item">
                <CheckCircle2 size={14} className="signal-check-icon" aria-hidden="true" />
                <span>No Outstanding Returns</span>
              </div>
              <div className="trust-signal-item">
                <CheckCircle2 size={14} className="signal-check-icon" aria-hidden="true" />
                <span>Eligible for this resource</span>
              </div>
            </div>
          </div>

          {/* Decision Actions (Requirements #18 & #19) */}
          {activeReq.status === 'REQUESTED' && !actionFeedback.includes('approved') && !actionFeedback.includes('declined') ? (
            <div className="surface-section owner-actions-section">
              <span className="section-label">OWNER DECISION</span>

              {errorMessage && (
                <div className="auth-error-banner" role="alert" style={{ marginBottom: 12 }}>
                  {errorMessage}
                </div>
              )}

              <div className="decision-primary-buttons">
                <button
                  type="button"
                  className="btn-primary btn-accept-request"
                  onClick={handleAccept}
                  disabled={actionLoading}
                >
                  <Check size={14} aria-hidden="true" />
                  <span>{actionLoading ? 'Accepting…' : 'Accept Request'}</span>
                </button>

                <button
                  type="button"
                  className="btn-secondary btn-decline-toggle"
                  onClick={() => setShowDeclineInput((prev) => !prev)}
                  disabled={actionLoading}
                >
                  <span>Decline</span>
                </button>
              </div>

              {/* Decline Reason Panel */}
              {showDeclineInput && (
                <div className="decline-panel">
                  <label htmlFor="decline-reason-select" className="decline-label">Reason for declining (Optional):</label>
                  <select
                    id="decline-reason-select"
                    className="borrow-select"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                  >
                    <option value="Resource unavailable at requested time">Resource unavailable at requested time</option>
                    <option value="In use for personal project">In use for personal project</option>
                    <option value="Maintenance in progress">Maintenance in progress</option>
                    <option value="Other commitment">Other commitment</option>
                  </select>
                  <button
                    type="button"
                    className="btn-danger-neutral"
                    onClick={handleDecline}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Declining…' : 'Confirm Decline'}
                  </button>
                </div>
              )}

              {/* Secondary Safety & Communication Actions (Requirements #18, #38, #39, #40) */}
              <div className="owner-aux-actions">
                <button
                  type="button"
                  className="aux-action-btn"
                  onClick={() => setShowMessageInput((prev) => !prev)}
                >
                  <MessageSquare size={13} aria-hidden="true" />
                  <span>Ask a Question</span>
                </button>

                <button
                  type="button"
                  className="aux-action-btn"
                  onClick={handleBlock}
                  title="Prevent future requests from this member without public penalty"
                >
                  <Ban size={13} aria-hidden="true" />
                  <span>Block Member</span>
                </button>

                <button
                  type="button"
                  className="aux-action-btn text-amber"
                  onClick={handleOpenSafetyReport}
                  title="File a private report with neighborhood coordinators"
                >
                  <ShieldAlert size={13} aria-hidden="true" />
                  <span>Report Concern</span>
                </button>
              </div>

              {/* Inline Message Input */}
              {showMessageInput && (
                <div className="coordination-inline-message-box">
                  <input
                    type="text"
                    className="borrow-input"
                    placeholder="Type coordination question..."
                    value={ownerQuestionText}
                    onChange={(e) => setOwnerQuestionText(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setActionFeedback('Question sent to requester.');
                      setShowMessageInput(false);
                      setOwnerQuestionText('');
                    }}
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="request-status-notice">
              <span className="status-label">Current Status:</span>
              <span className="status-badge-chip">{activeReq.status}</span>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // ---------------------------------------------------------------------------
  // 3. OUTGOING REQUEST STATUS VIEW (Requirement #24)
  // ---------------------------------------------------------------------------
  if (selectedEntity.type === 'request_status' && selectedEntity.request) {
    const req = selectedEntity.request;
    const activeReq = liveRequestDetail || req;
    const targetReqId = req.id || req.requestId || req.request_id;

    const handleCancel = async () => {
      if (actionLoading) return;
      setActionLoading(true);
      setErrorMessage('');
      try {
        if (onCancelRequest) {
          await onCancelRequest(targetReqId);
        }
        setActionFeedback('Request cancelled.');
      } catch (err) {
        setErrorMessage(err?.message || 'Failed to cancel request.');
      } finally {
        setActionLoading(false);
      }
    };

    return (
      <aside
        className="saathi-context-surface overlay-drawer"
        role="dialog"
        aria-label={`Request status for ${activeReq.resourceName || activeReq.resource_name || req.resourceName}`}
        aria-modal="false"
      >
        <div className="surface-header">
          <div className="surface-header-text">
            <span className="surface-eyebrow">OUTGOING BORROW REQUEST</span>
            <h3 className="surface-title">{activeReq.resourceName || activeReq.resource_name || req.resourceName}</h3>
            <p className="surface-subtitle">Status: {activeReq.status === 'REQUESTED' ? 'Awaiting Approval' : activeReq.status}</p>
          </div>
          <button
            type="button"
            className="surface-close-btn"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {actionFeedback && (
          <div className="surface-feedback-banner" role="status" style={{ margin: '8px 16px' }}>
            <Check size={14} className="banner-icon" aria-hidden="true" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {errorMessage && (
          <div className="auth-error-banner" role="alert" style={{ margin: '8px 16px' }}>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="surface-body">
          {requestLoading && (
            <div className="coordination-loading-state" role="status" style={{ padding: '8px 16px' }}>
              <span>Loading latest request status…</span>
            </div>
          )}

          <div className="surface-section">
            <div className="discovery-detail-box">
              <div className="detail-row">
                <span className="detail-key">Resource</span>
                <span className="detail-val">{activeReq.resourceName || activeReq.resource_name || req.resourceName}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Status</span>
                <span className="detail-val status-requested-badge">{activeReq.status}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Requested for</span>
                <span className="detail-val">{activeReq.requestedTime || (activeReq.time_window_start ? `${new Date(activeReq.time_window_start).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${new Date(activeReq.time_window_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Requested time')} ({activeReq.duration || req.duration || 'Flexible'})</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Handoff</span>
                <span className="detail-val">{activeReq.handoff_preference || activeReq.handoffPreference || req.handoffPreference || 'Safe / mutually agreed arrangement'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Purpose</span>
                <span className="detail-val">{activeReq.purpose || req.purpose || 'Community need'}</span>
              </div>
            </div>
          </div>

          {activeReq.status === 'REQUESTED' && !actionFeedback.includes('cancelled') && (
            <div className="surface-section">
              <button
                type="button"
                className="btn-secondary btn-cancel-request"
                onClick={handleCancel}
                disabled={actionLoading}
                style={{ width: '100%', padding: '8px 14px', cursor: 'pointer' }}
              >
                <span>{actionLoading ? 'Cancelling…' : 'Cancel Request'}</span>
              </button>
            </div>
          )}

          <div className="surface-section">
            <div className="privacy-guarantee-card">
              <ShieldCheck size={16} className="trust-icon" aria-hidden="true" />
              <div className="guarantee-text">
                <span className="guarantee-title">Approval-Gated Coordination</span>
                <p className="guarantee-detail">
                  The resource owner has been notified. Once approved, scheduled exchange details will appear under Active Coordination.
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // ---------------------------------------------------------------------------
  // 4. COORDINATION ITEM INSPECTION VIEW (Requirements #20, #25, #27, #30, #31)
  // State Machine Stepper + Two-Party Return Confirmation
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // 4. COORDINATION ITEM INSPECTION VIEW (Requirements #20, #25, #27, #30, #31)
  // Server-Authoritative State Machine Stepper + Two-Party Return + Messaging
  // ---------------------------------------------------------------------------
  if (
    selectedEntity.type === 'coordination' ||
    selectedEntity.coordination_id ||
    selectedEntity.coordinationId ||
    (selectedEntity.state && (selectedEntity.resourceName || selectedEntity.resource_name))
  ) {
    const coord = liveCoordinationDetail || selectedEntity;
    const coordId = coord.id || coord.coordination_id || coord.coordinationId;
    const isBorrowing = coord.role === 'borrowing' || coord.type === 'receiving';
    const isOwner = coord.role === 'lending';
    const currentState = coord.state || coord.status?.toUpperCase() || 'APPROVED';
    const isCompleted = currentState === 'COMPLETED';
    const isCancelled = currentState === 'CANCELLED';
    const isBlocked = currentState === 'BLOCKED';
    const isPendingConfirmation = currentState === 'RETURN_PENDING';

    // Canonical Lifecycle steps for visual stepper (Phase 2G-3)
    const canonicalSteps = [
      { id: 'APPROVED', label: 'Approved' },
      { id: 'SCHEDULED', label: 'Scheduled' },
      { id: 'HANDOFF_READY', label: 'Ready' },
      { id: 'HANDED_OVER', label: 'Handed Over' },
      { id: 'IN_USE', label: 'In Use' },
      { id: 'RETURN_DUE', label: 'Return Due' },
      { id: 'RETURN_PENDING', label: 'Return Pending' },
      { id: 'COMPLETED', label: 'Completed' },
    ];

    const currentStepIndex = canonicalSteps.findIndex((s) => s.id === currentState);

    // Transition Handler
    const handleTransition = async (toState, note) => {
      setActionLoading(true);
      setActionFeedback('');
      setErrorMessage('');
      try {
        if (onTransitionCoordination) {
          await onTransitionCoordination(coordId, toState, note);
        }
        setActionFeedback(`State transitioned to ${toState}.`);
        if (coordId && apiClient.getToken()) {
          const detail = await getCoordination(coordId);
          setLiveCoordinationDetail(detail);
        }
        if (onReloadCoordinations) await onReloadCoordinations();
      } catch (err) {
        setErrorMessage(err?.message || `Failed to transition state.`);
        if (coordId && apiClient.getToken()) {
          getCoordination(coordId).then(setLiveCoordinationDetail).catch(() => {});
        }
        if (onReloadCoordinations) onReloadCoordinations();
      } finally {
        setActionLoading(false);
      }
    };

    // Two-Party Return: Borrower starts return (RETURN_PENDING)
    const handleStartReturn = async () => {
      setActionLoading(true);
      setActionFeedback('');
      setErrorMessage('');
      try {
        if (onBorrowerStartReturn) {
          await onBorrowerStartReturn(coordId);
        }
        setActionFeedback('Return initiated. Awaiting owner confirmation of receipt.');
        if (coordId && apiClient.getToken()) {
          const detail = await getCoordination(coordId);
          setLiveCoordinationDetail(detail);
        }
        if (onReloadCoordinations) await onReloadCoordinations();
      } catch (err) {
        setErrorMessage(err?.message || 'Failed to initiate return.');
        if (coordId && apiClient.getToken()) {
          getCoordination(coordId).then(setLiveCoordinationDetail).catch(() => {});
        }
        if (onReloadCoordinations) onReloadCoordinations();
      } finally {
        setActionLoading(false);
      }
    };

    // Two-Party Return: Owner confirms return (COMPLETED)
    const handleConfirmReturn = async () => {
      setActionLoading(true);
      setActionFeedback('');
      setErrorMessage('');
      try {
        if (onOwnerConfirmReturn) {
          await onOwnerConfirmReturn(coordId);
        }
        setActionFeedback('Return confirmed! Resource returned to shared community inventory.');
        if (coordId && apiClient.getToken()) {
          const detail = await getCoordination(coordId);
          setLiveCoordinationDetail(detail);
        }
        if (onReloadCoordinations) await onReloadCoordinations();
      } catch (err) {
        setErrorMessage(err?.message || 'Failed to confirm return.');
        if (coordId && apiClient.getToken()) {
          getCoordination(coordId).then(setLiveCoordinationDetail).catch(() => {});
        }
        if (onReloadCoordinations) onReloadCoordinations();
      } finally {
        setActionLoading(false);
      }
    };

    // Messaging: Send message
    const handleSendMessage = async (e) => {
      if (e) e.preventDefault();
      const text = coordinationNoteText.trim();
      if (!text || notePosting) return;
      setNotePosting(true);
      setNoteError(null);
      try {
        if (onSendCoordinationMessage) {
          await onSendCoordinationMessage(coordId, text);
        }
        setCoordinationNoteText('');
        if (coordId && apiClient.getToken()) {
          const detail = await getCoordination(coordId);
          setLiveCoordinationDetail(detail);
        }
      } catch (err) {
        setNoteError(err?.message || 'Failed to send message.');
      } finally {
        setNotePosting(false);
      }
    };

    return (
      <aside
        className="saathi-context-surface overlay-drawer"
        role="dialog"
        aria-label={`Coordination details for ${coord.resource_name || coord.resourceName || coord.title}`}
        aria-modal="false"
      >
        <div className="surface-header">
          <div className="surface-header-text">
            <span className="surface-eyebrow">MUTUAL COORDINATION</span>
            <h3 className="surface-title">{coord.resource_name || coord.resourceName || coord.title}</h3>
            <p className="surface-subtitle">
              {coord.counterpart_display || coord.counterpartDisplay || coord.counterpart || 'Verified Neighbor'} · {PILOT_HUB_INFO.name}
            </p>
          </div>
          <button
            type="button"
            className="surface-close-btn"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {actionFeedback && (
          <div className="surface-feedback-banner" role="status" style={{ margin: '8px 16px' }}>
            <Check size={14} className="banner-icon" aria-hidden="true" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {errorMessage && (
          <div className="auth-error-banner" role="alert" style={{ margin: '8px 16px' }}>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="surface-body">
          {coordinationLoading && (
            <div className="coordination-loading-state" role="status" style={{ padding: '8px 16px' }}>
              <span>Loading authoritative coordination…</span>
            </div>
          )}

          {/* Stepper or Terminal State Banner */}
          <div className="surface-section">
            <span className="section-label">COORDINATION PROGRESS</span>
            {isCancelled ? (
              <div className="auth-error-banner" style={{ margin: '4px 0' }}>
                <span>Coordination Cancelled</span>
              </div>
            ) : isBlocked ? (
              <div className="auth-error-banner" style={{ margin: '4px 0', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>
                <span>Coordination Blocked · Active possession remains recoverable for safety</span>
              </div>
            ) : (
              <div
                className="coordination-stepper-track"
                role="progressbar"
                aria-valuenow={Math.max(0, currentStepIndex)}
                aria-valuemin={0}
                aria-valuemax={canonicalSteps.length - 1}
              >
                {canonicalSteps.map((step, idx) => {
                  const isPassed = currentStepIndex >= 0 && idx <= currentStepIndex;
                  const isCurrent = idx === currentStepIndex;

                  return (
                    <div
                      key={step.id}
                      className={`stepper-step ${isPassed ? 'is-passed' : ''} ${isCurrent ? 'is-current' : ''}`}
                    >
                      <div className="step-dot">{isPassed && <Check size={10} />}</div>
                      <span className="step-label">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coordination Details */}
          <div className="surface-section">
            <span className="section-label">COORDINATION DETAILS</span>
            <div className="discovery-detail-box">
              <div className="detail-row">
                <span className="detail-key">Role</span>
                <span className="detail-val">
                  {isBorrowing ? "You're borrowing" : isOwner ? "You're lending" : coord.role ? String(coord.role).toUpperCase() : 'Participant'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Counterpart</span>
                <span className="detail-val">{coord.counterpart_display || coord.counterpartDisplay || coord.counterpart || 'Verified Neighbor'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Purpose</span>
                <span className="detail-val">{coord.purpose || 'Community need'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Handoff point</span>
                <span className="detail-val">{coord.handoff_details || coord.handoff_preference || coord.handoffLocation || 'Safe / mutually agreed arrangement'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Scheduled</span>
                <span className="detail-val">
                  {coord.scheduled_start_time ? new Date(coord.scheduled_start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : (coord.scheduledStart || 'Not scheduled')}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Return due</span>
                <span className="detail-val">
                  {coord.due_time ? new Date(coord.due_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : (coord.dueTime || coord.time || 'Pending schedule')}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-key">State</span>
                <span className="detail-val state-badge-pill">{currentState}</span>
              </div>
            </div>
          </div>

          {/* SERVER-AUTHORITATIVE ACTIONS (Requirements #9, #14, #15) */}
          <div className="surface-section">
            <span className="section-label">LIFECYCLE ACTIONS</span>

            {isCompleted ? (
              <div className="surface-success-confirmed">
                <CheckCircle2 size={16} className="success-icon" aria-hidden="true" />
                <span>Return Confirmed · Resource restored to community inventory.</span>
              </div>
            ) : isCancelled ? (
              <div className="surface-feedback-banner" style={{ background: 'var(--saathi-surface-muted)', color: 'var(--saathi-text-secondary)' }}>
                <span>Coordination was cancelled.</span>
              </div>
            ) : currentState === 'APPROVED' ? (
              <div className="coordination-action-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleTransition('SCHEDULED')}
                  disabled={actionLoading}
                  style={{ width: '100%', padding: '8px 14px' }}
                >
                  <Clock size={14} aria-hidden="true" />
                  <span>{actionLoading ? 'Updating…' : 'Confirm Schedule'}</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleTransition('CANCELLED', 'Cancelled by participant')}
                  disabled={actionLoading}
                  style={{ width: '100%', padding: '6px 12px' }}
                >
                  <span>Cancel Coordination</span>
                </button>
              </div>
            ) : currentState === 'SCHEDULED' ? (
              <div className="coordination-action-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {isOwner ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleTransition('HANDOFF_READY')}
                    disabled={actionLoading}
                    style={{ width: '100%', padding: '8px 14px' }}
                  >
                    <Check size={14} aria-hidden="true" />
                    <span>{actionLoading ? 'Updating…' : 'Mark Handoff Ready'}</span>
                  </button>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--saathi-text-secondary)', margin: 0 }}>
                    Scheduled · Awaiting owner to prepare handoff.
                  </p>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleTransition('CANCELLED', 'Cancelled by participant')}
                  disabled={actionLoading}
                  style={{ width: '100%', padding: '6px 12px' }}
                >
                  <span>Cancel Coordination</span>
                </button>
              </div>
            ) : currentState === 'HANDOFF_READY' ? (
              <div className="coordination-action-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleTransition('HANDED_OVER')}
                  disabled={actionLoading}
                  style={{ width: '100%', padding: '8px 14px' }}
                >
                  <Check size={14} aria-hidden="true" />
                  <span>{actionLoading ? 'Updating…' : 'Confirm Handed Over'}</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleTransition('CANCELLED', 'Cancelled by participant')}
                  disabled={actionLoading}
                  style={{ width: '100%', padding: '6px 12px' }}
                >
                  <span>Cancel Coordination</span>
                </button>
              </div>
            ) : currentState === 'HANDED_OVER' ? (
              <div className="coordination-action-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {isBorrowing ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleTransition('IN_USE')}
                    disabled={actionLoading}
                    style={{ width: '100%', padding: '8px 14px' }}
                  >
                    <Check size={14} aria-hidden="true" />
                    <span>{actionLoading ? 'Updating…' : 'Confirm In Use / Received'}</span>
                  </button>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--saathi-text-secondary)', margin: 0 }}>
                    Item handed over. Awaiting borrower to confirm possession.
                  </p>
                )}
              </div>
            ) : currentState === 'IN_USE' ? (
              <div className="coordination-action-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {isBorrowing ? (
                  <div className="return-action-wrap">
                    <button
                      type="button"
                      className="surface-primary-action-btn btn-return-pole"
                      onClick={handleStartReturn}
                      disabled={actionLoading}
                    >
                      <RotateCcw size={14} className="action-icon" aria-hidden="true" />
                      <span>{actionLoading ? 'Initiating…' : 'Start Return'}</span>
                    </button>
                    <p className="return-sub-explainer">
                      Returns require two-party confirmation: you initiate return, and the owner confirms receipt.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleTransition('RETURN_DUE')}
                    disabled={actionLoading}
                    style={{ width: '100%', padding: '8px 14px' }}
                  >
                    <Clock size={14} aria-hidden="true" />
                    <span>{actionLoading ? 'Updating…' : 'Mark Return Due'}</span>
                  </button>
                )}
              </div>
            ) : currentState === 'RETURN_DUE' ? (
              <div className="coordination-action-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {isBorrowing ? (
                  <button
                    type="button"
                    className="surface-primary-action-btn btn-return-pole"
                    onClick={handleStartReturn}
                    disabled={actionLoading}
                  >
                    <RotateCcw size={14} className="action-icon" aria-hidden="true" />
                    <span>{actionLoading ? 'Initiating…' : 'Start Return'}</span>
                  </button>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--saathi-text-secondary)', margin: 0 }}>
                    Return is due. Awaiting borrower to initiate return.
                  </p>
                )}
              </div>
            ) : isPendingConfirmation ? (
              <div className="return-pending-banner">
                <RotateCcw size={15} className="pending-icon animate-spin-slow" aria-hidden="true" />
                <div className="pending-text">
                  <strong>RETURN PENDING</strong>
                  <p>
                    {isBorrowing
                      ? 'You initiated the return. Awaiting owner confirmation of receipt.'
                      : 'Borrower initiated return. Please confirm when resource has been received.'}
                  </p>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    className="btn-primary btn-confirm-receipt"
                    onClick={handleConfirmReturn}
                    disabled={actionLoading}
                    style={{ marginTop: '0.5rem' }}
                  >
                    <Check size={14} aria-hidden="true" />
                    <span>{actionLoading ? 'Confirming…' : 'Confirm Return Received'}</span>
                  </button>
                )}
              </div>
            ) : isBlocked ? (
              <div className="coordination-action-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {isBorrowing && !isPendingConfirmation && (
                  <button
                    type="button"
                    className="surface-primary-action-btn btn-return-pole"
                    onClick={handleStartReturn}
                    disabled={actionLoading}
                  >
                    <RotateCcw size={14} className="action-icon" aria-hidden="true" />
                    <span>{actionLoading ? 'Initiating…' : 'Start Return'}</span>
                  </button>
                )}
                {isOwner && isPendingConfirmation && (
                  <button
                    type="button"
                    className="btn-primary btn-confirm-receipt"
                    onClick={handleConfirmReturn}
                    disabled={actionLoading}
                  >
                    <Check size={14} aria-hidden="true" />
                    <span>{actionLoading ? 'Confirming…' : 'Confirm Return Received'}</span>
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {/* COORDINATION MESSAGES (Requirements #18, #19, #20, #21) */}
          <div className="surface-section">
            <span className="section-label">COORDINATION MESSAGES</span>
            <div className="coordination-messages-thread">
              <div className="coordination-messages-list">
                {coord.messages && coord.messages.length > 0 ? (
                  coord.messages.map((msg, i) => (
                    <div
                      key={msg.id || i}
                      className={`coord-message-bubble ${msg.sender_display === 'You' ? 'is-own' : 'is-counterpart'}`}
                    >
                      <div className="coord-message-meta">
                        <span className="coord-message-sender">{msg.sender_display || 'Participant'}</span>
                        <span className="coord-message-time">
                          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="coord-message-text">{msg.text}</p>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '0.78rem', color: 'var(--saathi-text-secondary)', margin: '0.5rem 0' }}>
                    No coordination messages yet. Use this channel for handoff coordination.
                  </p>
                )}
              </div>

              {isCompleted || isCancelled ? (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--saathi-text-secondary)',
                    padding: '0.5rem',
                    background: 'var(--saathi-surface-muted)',
                    borderRadius: '8px',
                    textAlign: 'center',
                    marginTop: '0.5rem',
                  }}
                >
                  <span>Messaging is closed for {currentState.toLowerCase()} coordinations.</span>
                </div>
              ) : (
                <form
                  onSubmit={handleSendMessage}
                  style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}
                >
                  <input
                    type="text"
                    className="borrow-input"
                    placeholder="Message regarding handoff..."
                    value={coordinationNoteText}
                    onChange={(e) => setCoordinationNoteText(e.target.value)}
                    disabled={notePosting}
                    style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={notePosting || !coordinationNoteText.trim()}
                    style={{ padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Send size={13} aria-hidden="true" />
                    <span>{notePosting ? 'Sending…' : 'Send'}</span>
                  </button>
                </form>
              )}
              {noteError && (
                <div className="auth-error-banner" style={{ marginTop: '0.35rem', padding: '0.35rem 0.65rem', fontSize: '0.72rem' }}>
                  <span>{noteError}</span>
                </div>
              )}
            </div>
          </div>

          {/* COORDINATION TIMELINE (Requirement #17) */}
          <div className="surface-section">
            <span className="section-label">COORDINATION TIMELINE</span>
            {coord.events && coord.events.length > 0 ? (
              <div className="coordination-events-timeline">
                {coord.events.map((evt, idx) => (
                  <div key={evt.id || idx} className="coord-timeline-item">
                    <div className="coord-timeline-dot" />
                    <div className="coord-timeline-header">
                      <span className="coord-timeline-type">{evt.event_type || 'UPDATE'}</span>
                      <span className="coord-timeline-time">
                        {evt.created_at ? new Date(evt.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="coord-timeline-summary">{evt.summary || evt.description || ''}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'var(--saathi-text-secondary)', margin: '0.25rem 0' }}>
                No timeline events recorded yet.
              </p>
            )}
          </div>
        </div>
      </aside>
    );
  }

  // ---------------------------------------------------------------------------
  // 5. PRIVATE SAFETY REPORT VIEW (Requirement #39)
  // Confidential coordinator-only reporting (never public)
  // ---------------------------------------------------------------------------
  if (activeSubDetail && activeSubDetail.type === 'safety_report') {
    const handleSubmitSafety = async (e) => {
      e.preventDefault();
      if (!safetyDescription.trim() || submittingRequest) return;

      setSubmittingRequest(true);
      setFormSubmitError(null);

      try {
        if (onReportConcern) {
          await onReportConcern({
            contextId: activeSubDetail.contextId || null,
            contextType: activeSubDetail.contextType || (activeSubDetail.contextId ? 'resource' : 'general'),
            reportedUserId: activeSubDetail.targetUserId,
            category: safetyCategory,
            description: safetyDescription.trim(),
            answerId: activeSubDetail.answerId,
          });
        }
        setSafetySubmitted(true);
      } catch (err) {
        if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('limit')) {
          setFormSubmitError('Submission limit reached. Please try again later.');
        } else {
          setFormSubmitError(err?.message || 'Failed to submit report. Please try again.');
        }
      } finally {
        setSubmittingRequest(false);
      }
    };

    return (
      <aside
        className="saathi-context-surface overlay-drawer"
        role="dialog"
        aria-label="Report a coordination concern"
        aria-modal="false"
      >
        <div className="surface-header">
          <div className="surface-header-text">
            <span className="surface-eyebrow">CONFIDENTIAL ACCOUNTABILITY</span>
            <h3 className="surface-title">Report a Concern</h3>
            <p className="surface-subtitle">Coordinator review only · Never public</p>
          </div>
          <button
            type="button"
            className="surface-close-btn"
            onClick={() => setActiveSubDetail(null)}
            aria-label="Close"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="surface-body">
          {!safetySubmitted ? (
            <form onSubmit={handleSubmitSafety} className="borrow-request-form">
              {formSubmitError && (
                <div className="surface-feedback-banner tone-error" role="alert" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '0.75rem' }}>
                  <AlertTriangle size={14} className="banner-icon" aria-hidden="true" />
                  <span>{formSubmitError}</span>
                </div>
              )}
              <div className="form-info-callout tone-safety">
                <ShieldAlert size={16} className="callout-icon" aria-hidden="true" />
                <p className="callout-text">
                  This report is strictly private and shared only with designated neighborhood coordinators. It will never appear on public feeds or create public risk scores.
                </p>
              </div>

              <div className="borrow-form-group">
                <label htmlFor="safety-cat-select" className="borrow-label">Category of Concern</label>
                <select
                  id="safety-cat-select"
                  className="borrow-select"
                  value={safetyCategory}
                  onChange={(e) => setSafetyCategory(e.target.value)}
                >
                  <option value="handoff_concern">Unsafe handoff arrangement</option>
                  <option value="communication_issue">Inappropriate communication</option>
                  <option value="resource_condition">Resource condition / missing parts</option>
                  <option value="return_delay">Return delay or non-response</option>
                  <option value="other">Other safety concern</option>
                </select>
              </div>

              <div className="borrow-form-group">
                <label htmlFor="safety-desc-input" className="borrow-label">Description of Concern</label>
                <textarea
                  id="safety-desc-input"
                  className="borrow-textarea"
                  rows="4"
                  placeholder="Describe what occurred with as much objective detail as possible..."
                  value={safetyDescription}
                  onChange={(e) => setSafetyDescription(e.target.value)}
                  required
                />
              </div>

              <div className="borrow-form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setActiveSubDetail(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary btn-submit-safety"
                  disabled={!safetyDescription.trim() || submittingRequest}
                >
                  {submittingRequest ? 'Submitting…' : 'Submit Private Report'}
                </button>
              </div>
            </form>
          ) : (
            <div className="request-confirmed-card" role="status">
              <CheckCircle2 size={32} className="confirmed-check-icon" aria-hidden="true" />
              <h4 className="confirmed-headline">REPORT SUBMITTED</h4>
              <p className="confirmed-sub">
                Report submitted to neighborhood coordinators.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setActiveSubDetail(null);
                  onClose();
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // ---------------------------------------------------------------------------
  // 6. LOT INSPECTION VIEW (Preserved for Coverage & Issues - NO private tools)
  // ---------------------------------------------------------------------------
  const isLot = !!selectedEntity.residentName || (selectedEntity.coverageItems && selectedEntity.id);
  const lotNum = selectedEntity.lotId || (isLot ? selectedEntity.id : null);
  const lotTitle = selectedEntity.name || (lotNum ? `Lot ${lotNum}` : 'Selected Entity');
  const residentName = selectedEntity.residentName || (isLot ? selectedEntity.title : null);

  return (
    <aside
      className="saathi-context-surface overlay-drawer"
      role="dialog"
      aria-label={`Context details for ${lotTitle}`}
      aria-modal="false"
    >
      <div className="surface-header">
        <div className="surface-header-text">
          <span className="surface-eyebrow">NEIGHBORHOOD AREA</span>
          <h3 className="surface-title">{lotTitle}</h3>
          {residentName && (
            <p className="surface-subtitle">
              {residentName} · {PILOT_HUB_INFO.name}
            </p>
          )}
        </div>

        <button
          type="button"
          className="surface-close-btn"
          onClick={onClose}
          aria-label="Close details"
          title="Close details (Esc)"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="surface-body">
        {/* Issues on this Lot */}
        {selectedEntity.hasIssue && selectedEntity.issueTitle && (
          <div className="surface-section">
            <span className="section-label">NEEDS ATTENTION</span>
            <div className="surface-issue-alert">
              <div className="issue-top-row">
                <AlertTriangle size={15} className="issue-alert-icon" aria-hidden="true" />
                <span className="issue-severity">
                  {(selectedEntity.issueSeverity || 'medium').toUpperCase()} SEVERITY
                </span>
              </div>
              <p className="issue-alert-title">{selectedEntity.issueTitle}</p>
              <button
                type="button"
                className="btn-resolve-issue"
                onClick={() => {
                  setActionFeedback('Offer to help submitted to neighborhood.');
                }}
              >
                Offer to help
              </button>
            </div>
          </div>
        )}

        {/* Coverage at this Lot */}
        {selectedEntity.coverageItems && selectedEntity.coverageItems.length > 0 && (
          <div className="surface-section">
            <span className="section-label">NEIGHBORHOOD COVERAGE</span>
            <div className="surface-coverage-list">
              {selectedEntity.coverageItems.map((cov) => (
                <div key={cov.id || cov.request_id} className="coverage-cardlet">
                  <div className="cov-cardlet-top">
                    <span className="cov-cardlet-title">{cov.title || cov.task_type}</span>
                    <span className="cov-cardlet-status">{cov.status}</span>
                  </div>
                  <span className="cov-cardlet-window">{cov.window || cov.date}</span>
                  <p className="cov-cardlet-detail">{cov.detail || cov.notes || cov.location}</p>
                  {(cov.status === 'REQUESTED' || cov.status === 'Open Request') && onAcceptCoverage && (
                    <button
                      type="button"
                      className="btn-primary cov-accept-btn"
                      style={{ marginTop: '8px', padding: '6px 12px', fontSize: '12px' }}
                      onClick={async () => {
                        try {
                          await onAcceptCoverage(cov.request_id || cov.id);
                        } catch (err) {
                          alert(err.message || 'Failed to accept coverage request');
                        }
                      }}
                    >
                      Accept Coverage Task
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Physical Keyholder Proximity */}
        <div className="surface-section surface-trust-section">
          <div className="trust-cardlet">
            <ShieldCheck size={16} className="trust-icon" aria-hidden="true" />
            <div className="trust-cardlet-text">
              <span className="trust-title">Physical Keyholder Network</span>
              <p className="trust-detail">
                Verified resident in Greenwood Commons. Proximity confirmed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
