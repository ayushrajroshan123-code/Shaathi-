import React, { useState } from 'react';
import { Search, X, Bell, User, ShieldAlert, CheckCircle2, MapPin, ChevronRight, RotateCcw } from 'lucide-react';
import { PILOT_HUB_INFO, CURRENT_USER } from './dashboardData';

/**
 * DashboardTopBar
 * Top navigation bar communicating the real neighborhood network context.
 * Features:
 * - Breadcrumbs showing exact location in app hierarchy (Greenwood Commons › [Layer] › [Lot/Item])
 * - Clear, unambiguous Mode toggle ("NORMAL MODE / Simulate Alert")
 * - Rich affordances and notification tooltips
 */
export default function DashboardTopBar({
  mode,
  onToggleMode,
  emergencyStatus = 'idle',
  emergencyIncidents = [],
  emergencyError = null,
  onRefreshEmergency = null,
  searchQuery,
  onSearchChange,
  onLogout,
  onOpenNotifications,
  coordinationCount = 2,
  activeLayer = null,
  activeNav = 'overview',
  onSelectNav,
  selectedItem = null,
  onClearSelectedItem,
  onResetAll,
  onOpenAskModal,
  onNavigateLanding,
  currentUser,
}) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const activeUser = currentUser || CURRENT_USER;
  const userInitials = activeUser.avatar || (activeUser.name ? activeUser.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'SC');

  // Compute active layer title
  const layerLabels = {
    coverage: 'Coverage (6)',
    resources: 'Resources (11)',
    issues: 'Issues (3)',
  };
  const activeLayerLabel = activeLayer ? layerLabels[activeLayer] || activeLayer : null;

  // Compute privacy-safe breadcrumbs (Part 34: Never place owner names or private lot numbers into resource breadcrumbs)
  let selectedItemLabel = null;
  if (selectedItem) {
    if (selectedItem.type === 'live_incident' || selectedItem.isLive) {
      selectedItemLabel = `Emergency › Active Incident #${String(selectedItem.incident_id || selectedItem.id || '').slice(0, 8)}`;
    } else if (selectedItem.type === 'simulated_incident' || selectedItem.isSimulated || selectedItem.type === 'sos') {
      selectedItemLabel = `Simulation › Demo Alert (${selectedItem.name || 'Martha Gable'})`;
    } else if (selectedItem.type === 'query') {
      selectedItemLabel = `Shared Query · ${selectedItem.title}`;
    } else if (selectedItem.type === 'borrow_request' || selectedItem.category === 'borrow_request') {
      selectedItemLabel = `Resources › ${selectedItem.name || selectedItem.resourceName || 'Resource'} › Request`;
    } else if (selectedItem.type === 'owner_review') {
      selectedItemLabel = `My Coordination › Review Request · ${selectedItem.request?.resourceName || 'Resource'}`;
    } else if (selectedItem.type === 'request_status') {
      selectedItemLabel = `My Coordination › ${selectedItem.request?.resourceName || 'Request'}`;
    } else if (selectedItem.type === 'coordination' || selectedItem.dueTime !== undefined || selectedItem.scheduledTime !== undefined) {
      selectedItemLabel = `My Coordination › ${selectedItem.resourceName || selectedItem.title || 'Coordination'}`;
    } else if (selectedItem.type === 'resource' || selectedItem.type === 'resource_detail' || (selectedItem.name && selectedItem.category && selectedItem.category !== 'coverage')) {
      selectedItemLabel = `Resources › ${selectedItem.name} · Nearby`;
    } else if (selectedItem.type === 'issue' || selectedItem.severity !== undefined) {
      selectedItemLabel = `Issues › ${selectedItem.title}`;
    } else if (selectedItem.residentName || selectedItem.archetype) {
      selectedItemLabel = `Greenwood Commons › ${selectedItem.name || `Area ${selectedItem.id || selectedItem.lotId}`}`;
    } else if (selectedItem.title) {
      selectedItemLabel = `Neighborhood › ${selectedItem.title}`;
    } else {
      selectedItemLabel = 'Neighborhood Coordination';
    }
  }

  return (
    <header className="saathi-topbar" role="banner">
      {/* Left: Brand Identity & Top Navigation (Part 5: SAATHI, Overview, Coverage, Resources, Issues) */}
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-brand-link"
          onClick={onResetAll}
          title={`Return to ${PILOT_HUB_INFO.name} Overview`}
        >
          <span className="topbar-logo-mark" aria-hidden="true">
            <span className="mark-circle mark-left" />
            <span className="mark-circle mark-right" />
          </span>
          <div className="topbar-brand-titles">
            <span className="brand-name">SAATHI</span>
            <span className="brand-divider">·</span>
            <span className="brand-hub-badge">{PILOT_HUB_INFO.name.toUpperCase()}</span>
          </div>
        </button>

        {/* Top Navigation (Part 5 Locked Contract) */}
        <nav className="topbar-main-nav" aria-label="Main Navigation">
          <button
            type="button"
            className={`topbar-nav-link ${activeNav === 'overview' && !activeLayer ? 'is-active' : ''}`}
            onClick={() => {
              if (onSelectNav) onSelectNav('overview');
            }}
          >
            Overview
          </button>
          <button
            type="button"
            className={`topbar-nav-link ${activeNav === 'coverage' || activeLayer === 'coverage' ? 'is-active' : ''}`}
            onClick={() => {
              if (onSelectNav) onSelectNav('coverage');
            }}
          >
            Coverage
          </button>
          <button
            type="button"
            className={`topbar-nav-link ${activeNav === 'resources' || activeLayer === 'resources' ? 'is-active' : ''}`}
            onClick={() => {
              if (onSelectNav) onSelectNav('resources');
            }}
          >
            Resources
          </button>
          <button
            type="button"
            className={`topbar-nav-link ${activeNav === 'issues' || activeLayer === 'issues' ? 'is-active' : ''}`}
            onClick={() => {
              if (onSelectNav) onSelectNav('issues');
            }}
          >
            Issues
          </button>
        </nav>

        {/* Breadcrumb path when specific lot/detail is inspected */}
        {selectedItem && (
          <nav className="topbar-breadcrumbs" aria-label="Current Location in Neighborhood">
            <span className="breadcrumb-item is-current" title={selectedItemLabel}>
              <span className="breadcrumb-text breadcrumb-truncate">{selectedItemLabel}</span>
            </span>
          </nav>
        )}
      </div>

      {/* Right: ASK Action, Search, Clear Mode Toggle, Notifications, Landing Page & Profile */}
      <div className="topbar-right">
        {/* Primary ASK Action (Part 5: ASK remains an action) */}
        <button
          type="button"
          className="topbar-ask-action-btn"
          onClick={onOpenAskModal}
          title="Create a neighborhood ask: request coverage, borrow tools, or report an issue"
          aria-label="Ask Neighborhood"
        >
          <span>ASK</span>
        </button>
        {/* Contextual Search */}
        <div className="topbar-search-box">
          <Search size={15} className="search-icon" aria-hidden="true" />
          <input
            type="search"
            className="topbar-search-input"
            placeholder="Search neighbors, tools, active asks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search neighborhood coordination"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Mode State Indicator & Live Emergency Controls */}
        {emergencyStatus === 'loading' && (
          <span
            className="mode-action-pill"
            style={{ opacity: 0.75, fontSize: '0.65rem' }}
            title="Checking emergency route status..."
            aria-label="Checking emergency state"
          >
            Checking...
          </span>
        )}

        {/* Transient Failure Retry Control */}
        {emergencyStatus === 'idle' && emergencyError && onRefreshEmergency && (
          <button
            type="button"
            className="topbar-mode-badge"
            onClick={onRefreshEmergency}
            title={`Emergency status check failed: ${emergencyError.message || 'Network error'}. Click to retry.`}
            style={{ background: 'rgba(230, 169, 40, 0.12)', borderColor: 'rgba(230, 169, 40, 0.4)', color: 'var(--saathi-amber, #D97706)' }}
            aria-label="Retry checking emergency status"
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
              <RotateCcw size={11} aria-hidden="true" />
              <span>Retry Check</span>
            </span>
          </button>
        )}

        {/* Server-Authoritative Live Emergency Badge */}
        {emergencyStatus === 'available' && Array.isArray(emergencyIncidents) && emergencyIncidents.length > 0 && (
          <div
            className="topbar-mode-badge mode-emergency"
            role="status"
            aria-live="assertive"
            title={`Active emergency: ${emergencyIncidents.length} verified incident(s) reported in hub.`}
            style={{ cursor: 'default' }}
          >
            <div className="mode-badge-content">
              <span className="mode-status-cluster">
                <ShieldAlert size={14} className="mode-icon-alert" aria-hidden="true" />
                <span className="mode-label">LIVE ALERT ({emergencyIncidents.length})</span>
              </span>
              <span className="mode-action-pill" style={{ background: 'var(--saathi-em-red, #E5483A)', color: '#FFFFFF' }}>
                Verified
              </span>
            </div>
          </div>
        )}

        {/* Local Simulation Mode Action Toggle (Always Distinguishable) */}
        <button
          type="button"
          className={`topbar-mode-badge ${mode === 'emergency' ? 'mode-emergency' : 'mode-normal'}`}
          onClick={onToggleMode}
          title={
            mode === 'emergency'
              ? 'Click to exit local visual simulation and return to Normal Mode'
              : emergencyStatus === 'unavailable'
                ? 'Normal mode active. Emergency backend routes inactive (HTTP 404). Click to test simulated alert.'
                : 'Click to simulate Emergency Response Alert (Local UI Demo)'
          }
          aria-label={`Current Mode: ${mode === 'emergency' ? 'Simulated Alert Active' : 'Normal Mode'}. Click to toggle simulation.`}
        >
          <div className="mode-badge-content">
            <span className="mode-status-cluster">
              {mode === 'emergency' ? (
                <ShieldAlert size={14} className="mode-icon-alert" aria-hidden="true" />
              ) : (
                <span className="mode-dot" aria-hidden="true" />
              )}
              <span className="mode-label">
                {mode === 'emergency' ? 'SIMULATED ALERT' : 'NORMAL MODE'}
              </span>
            </span>
            <span className="mode-action-pill">
              {mode === 'emergency' ? 'Exit Simulation' : 'Simulate Alert'}
            </span>
          </div>
        </button>

        {/* Landing Page Action (Integrated, never overlapping content) */}
        {onNavigateLanding && (
          <button
            type="button"
            className="topbar-landing-nav-btn"
            onClick={onNavigateLanding}
            title="Return to Public Landing Page"
            aria-label="View Landing Page"
          >
            <span>Landing Page</span>
            <span style={{ opacity: 0.6 }}>↗</span>
          </button>
        )}

        {/* Notifications Control with Clear Tooltip */}
        <button
          type="button"
          className="topbar-icon-btn topbar-notif-btn"
          onClick={onOpenNotifications}
          aria-label={`${coordinationCount} active coordinations`}
          title={`${coordinationCount} active coordination commitments: 1 helping Dr. Thorne, 1 borrowing from Marcus Vance`}
        >
          <Bell size={16} aria-hidden="true" />
          {coordinationCount > 0 && <span className="notif-badge">{coordinationCount}</span>}
        </button>

        {/* Profile Avatar Control */}
        <div className="topbar-profile-container">
          <button
            type="button"
            className="topbar-avatar-btn"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            aria-expanded={isProfileOpen}
            aria-label="Resident profile menu"
            title={`${activeUser.name} (${activeUser.role})`}
          >
            <span className="avatar-initials">{userInitials}</span>
          </button>

          {isProfileOpen && (
            <div className="topbar-profile-dropdown" role="menu">
              <div className="dropdown-header">
                <span className="dropdown-name">{activeUser.name}</span>
                <span className="dropdown-role">{activeUser.role}</span>
                <span className="dropdown-address">{activeUser.address || 'Oakridge Circle Pilot Hub'}</span>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-info-row">
                <span className="info-label">Pilot Hub</span>
                <span className="info-value">{PILOT_HUB_INFO.name}</span>
              </div>
              <div className="dropdown-info-row">
                <span className="info-label">Trust Graph</span>
                <span className="info-value">Direct Neighbor Keyholder</span>
              </div>
              <div className="dropdown-divider" />
              <button
                type="button"
                className="dropdown-logout-btn"
                onClick={() => {
                  setIsProfileOpen(false);
                  onLogout();
                }}
              >
                Exit / Switch Resident
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
