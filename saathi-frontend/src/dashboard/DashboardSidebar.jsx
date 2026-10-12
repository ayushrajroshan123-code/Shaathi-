import React from 'react';
import { ArrowRight, HelpingHand, MapPin, UserCheck } from 'lucide-react';
import { CURRENT_USER } from './dashboardData';
import { isDemoMode } from '../utils/demoConfig';

/**
 * DashboardSidebar — "MY SAATHI"
 * Refactored strictly per Part 8 & 9 of the implementation contract:
 * - Represents personal information ONLY: "What is mine?"
 * - Does NOT contain neighborhood-wide feeds, duplicate Pulse, or duplicate attention lists.
 * - Allowed content:
 *   MY SAATHI
 *   {N} Active coordinations
 *   {N} My areas
 *   View activity →
 */
export default function DashboardSidebar({
  activeCoordinationsCount = 2,
  incomingCount = 0,
  myAreasCount = 1,
  userRoleMode = 'resident',
  onToggleRoleMode,
  onViewActivity,
  currentUser,
}) {
  const activeUser = currentUser || CURRENT_USER;
  const isOwnerMode = userRoleMode === 'resource_owner';
  const displayedUser = isOwnerMode
    ? { name: 'Marcus Vance', role: 'Tool Host · Lot 3', avatar: 'MV' }
    : activeUser;

  return (
    <aside className="saathi-sidebar my-saathi-rail" aria-label="Personal SAATHI Summary">
      <div className="my-saathi-header">
        <span className="my-saathi-eyebrow">PERSONAL OS</span>
        <h2 className="my-saathi-title">MY SAATHI</h2>
        <div className="my-saathi-user-badge">
          <span className="user-avatar-tag">{displayedUser.avatar}</span>
          <div className="user-meta-text">
            <span className="user-name">{displayedUser.name}</span>
            <span className="user-role">{displayedUser.role}</span>
          </div>
        </div>

        {/* Quick Role Simulation Switch for Verification (Demo Mode Only) */}
        {isDemoMode() && onToggleRoleMode && (
          <button
            type="button"
            className="sidebar-role-toggle-btn"
            onClick={onToggleRoleMode}
            title="[DEV ONLY] Toggle between Resident borrower and Resource owner perspective for full lifecycle testing"
          >
            <span>Perspective: {isOwnerMode ? 'Resource Owner (Marcus)' : 'Resident (Sarah)'}</span>
          </button>
        )}
      </div>

      <div className="my-saathi-metrics">
        {/* Incoming Requests Metric (when owner has pending requests) */}
        {incomingCount > 0 && (
          <div className="my-saathi-metric-card tone-incoming">
            <div className="metric-header-row">
              <HelpingHand size={15} className="metric-icon" aria-hidden="true" />
              <span className="metric-scope-tag">Needs Approval</span>
            </div>
            <span className="metric-number text-amber">{incomingCount}</span>
            <span className="metric-label">{incomingCount === 1 ? 'Incoming request' : 'Incoming requests'}</span>
          </div>
        )}

        {/* Active Coordinations Metric */}
        <div className="my-saathi-metric-card">
          <div className="metric-header-row">
            <HelpingHand size={15} className="metric-icon" aria-hidden="true" />
            <span className="metric-scope-tag">Personal Scope</span>
          </div>
          <span className="metric-number">{activeCoordinationsCount}</span>
          <span className="metric-label">Active coordinations</span>
        </div>

        {/* My Areas Metric */}
        <div className="my-saathi-metric-card">
          <div className="metric-header-row">
            <MapPin size={15} className="metric-icon" aria-hidden="true" />
            <span className="metric-scope-tag">Personal Coverage</span>
          </div>
          <span className="metric-number">{myAreasCount}</span>
          <span className="metric-label">{myAreasCount === 1 ? 'My area' : 'My areas'}</span>
        </div>
      </div>

      {/* View Activity Link */}
      <div className="my-saathi-footer">
        <button
          type="button"
          className="my-saathi-activity-btn"
          onClick={() => {
            if (onViewActivity) {
              onViewActivity();
            } else {
              const el = document.getElementById('my-coordination-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          aria-label="View personal coordination activity"
        >
          <span>View activity</span>
          <ArrowRight size={13} className="btn-arrow-icon" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

