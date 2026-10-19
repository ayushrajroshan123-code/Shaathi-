import React from 'react';
import { AlertTriangle, HelpingHand, Wrench, MapPin } from 'lucide-react';

/**
 * NeighborhoodPulse
 * Canonical control/navigation layer immediately below the 3D scene (Parts 16–25).
 * Contains exactly four controls:
 * 1. NEEDS ATTENTION
 * 2. COORDINATION
 * 3. RESOURCES
 * 4. MY AREAS
 * 
 * Rules:
 * - Data-driven counts and contextual descriptors.
 * - Single active filter state: null | 'attention' | 'coordination' | 'resources' | 'my-areas'.
 * - Clicking active filter toggles it to null.
 * - Clicking another replaces previous filter.
 * - Controls 3D highlighting without moving camera and without opening ContextSurface.
 * - Fully keyboard accessible (Enter, Space).
 */
export default function NeighborhoodPulse({
  activeFilter = null,
  onToggleFilter,
  attentionCount = 3,
  coordinationCount = 2,
  resourcesCount = 11,
  myAreasCount = 1,
}) {
  const pulseControls = [
    {
      id: 'attention',
      label: 'NEEDS ATTENTION',
      count: attentionCount,
      descriptor: 'nearby',
      icon: <AlertTriangle size={15} className="pulse-ctrl-icon attention-icon" aria-hidden="true" />,
      toneClass: 'tone-attention',
    },
    {
      id: 'coordination',
      label: 'COORDINATION',
      count: coordinationCount,
      descriptor: 'active',
      icon: <HelpingHand size={15} className="pulse-ctrl-icon coord-icon" aria-hidden="true" />,
      toneClass: 'tone-coord',
    },
    {
      id: 'resources',
      label: 'RESOURCES',
      count: resourcesCount,
      descriptor: 'available',
      icon: <Wrench size={15} className="pulse-ctrl-icon res-icon" aria-hidden="true" />,
      toneClass: 'tone-resource',
    },
    {
      id: 'my-areas',
      label: 'MY AREAS',
      count: myAreasCount,
      descriptor: 'covered',
      icon: <MapPin size={15} className="pulse-ctrl-icon my-icon" aria-hidden="true" />,
      toneClass: 'tone-my-areas',
    },
  ];

  return (
    <section className="neighborhood-pulse-section" aria-label="Neighborhood Pulse Filter Controls">
      <div className="pulse-section-header">
        <div className="pulse-header-titles">
          <span className="pulse-eyebrow">WHAT MATTERS</span>
          <h3 className="pulse-main-title">NEIGHBORHOOD PULSE</h3>
        </div>
        <span className="pulse-filter-status" aria-live="polite">
          {activeFilter
            ? `Category open: ${pulseControls.find((c) => c.id === activeFilter)?.label}`
            : 'Click a pulse category to browse records & locate in 3D'}
        </span>
      </div>

      <div className="pulse-controls-grid" role="toolbar" aria-label="Neighborhood Pulse Controls">
        {pulseControls.map((ctrl) => {
          const isActive = activeFilter === ctrl.id;
          return (
            <button
              key={ctrl.id}
              type="button"
              className={`pulse-control-card ${ctrl.toneClass} ${isActive ? 'is-active' : ''}`}
              onClick={() => onToggleFilter && onToggleFilter(ctrl.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (onToggleFilter) onToggleFilter(ctrl.id);
                }
              }}
              aria-pressed={isActive}
              title={`${ctrl.label}: ${ctrl.count} ${ctrl.descriptor}. Click to ${isActive ? 'close' : 'browse'}.`}
            >
              <div className="pulse-card-top">
                <span className="pulse-card-label">{ctrl.label}</span>
                {ctrl.icon}
              </div>
              <div className="pulse-card-body">
                <span className="pulse-card-count">{ctrl.count}</span>
                <span className="pulse-card-descriptor">{ctrl.descriptor}</span>
              </div>
              <div className="pulse-active-indicator" aria-hidden="true">
                <span className="indicator-pill">{isActive ? 'Browsing' : 'Browse'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
