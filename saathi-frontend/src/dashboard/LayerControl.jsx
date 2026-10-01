import React from 'react';
import { House, HelpingHand, Wrench, TriangleAlert, ShieldAlert } from 'lucide-react';

/**
 * LayerControl
 * Unified Discovery Tabs for the 3D neighborhood workspace.
 * Follows Jakob's Law (≤5 items, clearly labeled with counts and explicit active state).
 * Tabs: OVERVIEW (6 Lots) · COVERAGE (6) · RESOURCES (8) · ISSUES (3)
 */
export default function LayerControl({ activeLayer, onSelectLayer, mode }) {
  const layers = [
    { id: null, label: 'OVERVIEW', icon: <House size={14} />, count: 6, desc: 'Neighborhood 3D Map (All 6 Lots)' },
    { id: 'coverage', label: 'COVERAGE', icon: <HelpingHand size={14} />, count: 6, desc: 'Resident Availability & Support' },
    { id: 'resources', label: 'RESOURCES', icon: <Wrench size={14} />, count: 8, desc: 'Shared Equipment & Tools' },
    { id: 'issues', label: 'ISSUES', icon: <TriangleAlert size={14} />, count: 3, desc: 'Attention Items & Observations' },
  ];

  if (mode === 'emergency') {
    return (
      <div className="saathi-layer-control-wrap emergency-banner-wrap" role="region" aria-label="Emergency Mode Operational Status">
        <div className="saathi-emergency-pill">
          <ShieldAlert size={15} className="emergency-pill-pulse-icon" aria-hidden="true" />
          <span className="emergency-pill-title">OPERATIONAL STATE: ALERT → RESPOND → COORDINATE → RESOLVE</span>
          <span className="emergency-pill-tag">INCIDENT ACTIVE (LOT 5 & 6)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="saathi-layer-control-wrap" role="toolbar" aria-label="Neighborhood Discovery Layers">
      <div className="saathi-layer-pill">
        {layers.map((layer) => {
          const isActive = activeLayer === layer.id;
          return (
            <button
              key={layer.label}
              type="button"
              className={`saathi-layer-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectLayer(layer.id)}
              aria-pressed={isActive}
              title={`${layer.label}: ${layer.desc}`}
            >
              <span className="saathi-layer-icon" aria-hidden="true">{layer.icon}</span>
              <span className="saathi-layer-text">{layer.label}</span>
              <span className="saathi-layer-count">{layer.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
