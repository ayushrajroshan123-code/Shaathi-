import React, { useState } from 'react';
import { Search, X, Bell, User, ShieldAlert, CheckCircle2, MapPin, ChevronRight } from 'lucide-react';
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
  searchQuery,
  onSearchChange,
  onLogout,
  onOpenNotifications,
  coordinationCount = 2,
  activeLayer = null,
  selectedItem = null,
  onClearSelectedItem,
  onResetAll,
}) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Compute active layer title
  const layerLabels = {
    coverage: 'Coverage (6)',
    resources: 'Resources (8)',
    issues: 'Issues (3)',
  };
  const activeLayerLabel = activeLayer ? layerLabels[activeLayer] || activeLayer : null;

  // Compute selected item title
  let selectedItemLabel = null;
  if (selectedItem) {
    if (selectedItem.type === 'query') {
      selectedItemLabel = `Shared Query · ${selectedItem.title}`;
    } else if (selectedItem.residentName) {
      selectedItemLabel = `Lot ${selectedItem.id || selectedItem.lotId} · ${selectedItem.residentName}`;
    } else if (selectedItem.name) {
      selectedItemLabel = `${selectedItem.lotId ? `Lot ${selectedItem.lotId} · ` : ''}${selectedItem.name}`;
    } else if (selectedItem.title) {
      selectedItemLabel = `${selectedItem.lotId ? `Lot ${selectedItem.lotId} · ` : ''}${selectedItem.title}`;
    } else if (selectedItem.lotName) {
      selectedItemLabel = `${selectedItem.lotName} · ${selectedItem.counterpart || 'Coordination'}`;
    } else {
      selectedItemLabel = 'Selected Detail';
    }
  }

  return (
    <header className="saathi-topbar" role="banner">
      {/* Left: Brand Identity & Location Breadcrumbs ("Where am I") */}
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-brand-link"
          onClick={onResetAll}
          title="Return to Greenwood Commons Overview"
        >
          <span className="topbar-logo-mark" aria-hidden="true">
            <span className="mark-circle mark-left" />
            <span className="mark-circle mark-right" />
          </span>
          <div className="topbar-brand-titles">
            <span className="brand-name">SAATHI</span>
            <span className="brand-divider">·</span>
            <span className="brand-hub-badge">PILOT HUB</span>
          </div>
        </button>

        {/* Location Breadcrumbs (Jakob's Law & Spatial Orientation) */}
        <nav className="topbar-breadcrumbs" aria-label="Current Location in Neighborhood">
          <button
            type="button"
            className={`breadcrumb-item ${!activeLayer && !selectedItem ? 'is-active' : ''}`}
            onClick={onResetAll}
            title="Overview: Greenwood Commons Pilot Hub"
          >
            <MapPin size={13} className="breadcrumb-pin-icon" aria-hidden="true" />
            <span className="breadcrumb-text">{PILOT_HUB_INFO.name}</span>
          </button>

          {activeLayer && (
            <>
              <ChevronRight size={13} className="breadcrumb-chevron" aria-hidden="true" />
              <button
                type="button"
                className={`breadcrumb-item ${!selectedItem ? 'is-active' : ''}`}
                onClick={onClearSelectedItem}
                title={`Layer: ${activeLayerLabel}. Click to show all items.`}
              >
                <span className="breadcrumb-text">{activeLayerLabel}</span>
              </button>
            </>
          )}

          {selectedItem && (
            <>
              <ChevronRight size={13} className="breadcrumb-chevron" aria-hidden="true" />
              <span className="breadcrumb-item is-current" title={selectedItemLabel}>
                <span className="breadcrumb-text breadcrumb-truncate">{selectedItemLabel}</span>
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Right: Search, Clear Mode Toggle, Notifications, and Profile */}
      <div className="topbar-right">
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

        {/* Mode State Indicator & Clear Action Toggle (Affordance Fix) */}
        <button
          type="button"
          className={`topbar-mode-badge ${mode === 'emergency' ? 'mode-emergency' : 'mode-normal'}`}
          onClick={onToggleMode}
          title={
            mode === 'emergency'
              ? 'Click to return to Normal Neighborhood Coordination Mode'
              : 'Click to simulate Emergency Response Alert (SOS Martha Gable & Responders)'
          }
          aria-label={`Current Mode: ${mode === 'emergency' ? 'Emergency Alert Active' : 'Normal Mode'}. Click to toggle.`}
        >
          <div className="mode-badge-content">
            <span className="mode-status-cluster">
              {mode === 'emergency' ? (
                <ShieldAlert size={14} className="mode-icon-alert" aria-hidden="true" />
              ) : (
                <span className="mode-dot" aria-hidden="true" />
              )}
              <span className="mode-label">
                {mode === 'emergency' ? 'EMERGENCY ALERT' : 'NORMAL MODE'}
              </span>
            </span>
            <span className="mode-action-pill">
              {mode === 'emergency' ? 'Exit Alert' : 'Simulate Alert'}
            </span>
          </div>
        </button>

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
            title={`${CURRENT_USER.name} (${CURRENT_USER.role})`}
          >
            <span className="avatar-initials">{CURRENT_USER.avatar}</span>
          </button>

          {isProfileOpen && (
            <div className="topbar-profile-dropdown" role="menu">
              <div className="dropdown-header">
                <span className="dropdown-name">{CURRENT_USER.name}</span>
                <span className="dropdown-role">{CURRENT_USER.role}</span>
                <span className="dropdown-address">{CURRENT_USER.address}</span>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-info-row">
                <span className="info-label">Pilot Hub</span>
                <span className="info-value">Oakridge Circle</span>
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
