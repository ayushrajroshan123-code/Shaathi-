import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  RotateCcw,
  Play,
  Pause,
  Plus,
  Wrench,
  TriangleAlert,
  AlertCircle,
  Check,
  CheckCircle2,
  AlertTriangle,
  BatteryCharging,
  HelpingHand,
  ShieldAlert,
} from 'lucide-react';
import { NeighborhoodScene } from '../neighborhood/NeighborhoodScene';
import LayerControl from './LayerControl';
import {
  RESIDENTIAL_LOTS,
  NEIGHBORHOOD_ISSUES,
  EMERGENCY_INCIDENT,
} from './dashboardData';

/**
 * NeighborhoodViewport
 * Dominates 55–65% of the main workspace.
 * The primary discovery surface: where the neighborhood itself is the interface.
 * 
 * Features:
 * - Color-coded markers by issue/coverage status (amber for issues, green/teal for available)
 * - Progressive disclosure: rich hover tooltip with lot owner, archetype, active status & verified proximity
 * - Clear 3D Map Legend explaining markers
 * - Descriptive "+ ASK NEIGHBORHOOD" button with clear context
 */
export default function NeighborhoodViewport({
  mode = 'normal',
  liveIncidents = [],
  activeLayer = null,
  onSelectLayer,
  selectedItem,
  selectedLotId = null,
  highlightedLotIds = [],
  onSelectLot,
  onClearSelection,
  onSelectItem,
  onOpenAskModal,
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [markerPositions, setMarkerPositions] = useState([]);
  const [isAutoTouring, setIsAutoTouring] = useState(false);
  const [hoveredMarkerId, setHoveredMarkerId] = useState(null);

  // Safe coarse lot-to-diorama anchor projection (never uses GPS coordinates)
  const mapIncidentLocationToPos3D = useCallback((locationStr) => {
    if (!locationStr || typeof locationStr !== 'string') {
      return { x: 0.0, y: 3.5, z: 0.0 };
    }
    const match = locationStr.match(/(?:lot|house|residence)\s*([1-6])\b/i);
    if (match) {
      const lotId = parseInt(match[1], 10);
      const lot = RESIDENTIAL_LOTS.find((l) => l.id === lotId);
      if (lot && lot.position3D) {
        return {
          x: lot.position3D.x,
          y: (lot.position3D.y || 1.5) + 1.8,
          z: lot.position3D.z,
        };
      }
    }
    return { x: 0.0, y: 3.5, z: 0.0 };
  }, []);

  // Compute 2D screen positions for 3D world points
  const updateProjectedMarkers = useCallback(() => {
    if (!sceneRef.current || !mountRef.current) return;
    const scene = sceneRef.current;

    let itemsToProject = [];

    // 1. Server-authoritative live incidents (presentation-layer only, zero GPS coordinates)
    if (Array.isArray(liveIncidents) && liveIncidents.length > 0) {
      liveIncidents.forEach((inc) => {
        const incId = inc.incident_id || inc.id || 'inc';
        itemsToProject.push({
          id: `live-inc-${incId}`,
          type: 'live_incident',
          title: `[LIVE ALERT] Incident #${String(incId).slice(0, 8)} (${inc.priority_level || 'CRITICAL'})`,
          shape: 'circle',
          color: '#E5483A',
          icon: <ShieldAlert size={13} />,
          pos3D: mapIncidentLocationToPos3D(inc.location),
          isLive: true,
          data: {
            type: 'live_incident',
            incident_id: incId,
            status: inc.status,
            priority_level: inc.priority_level,
            priority_score: inc.priority_score,
            source: inc.source,
            location: inc.location,
            affected_people: inc.affected_people,
            vulnerable_people: inc.vulnerable_people,
            created_at: inc.created_at,
            isLive: true,
          },
        });
      });
    }

    if (mode === 'emergency') {
      // Local Simulation Mode Markers (Explicitly badged as simulation)
      // 1. SOS (Lot 5 - Demonstration Scenario)
      itemsToProject.push({
        id: 'em-sos-1',
        type: 'simulated_incident',
        title: '[SIMULATED] Martha Gable (Demo)',
        shape: 'circle',
        color: '#E5483A',
        icon: <AlertCircle size={13} />,
        pos3D: { x: 9.0, y: 4.8, z: -9.0 },
        isSimulated: true,
        data: {
          type: 'simulated_incident',
          ...EMERGENCY_INCIDENT.affectedPeople[0],
          isSimulated: true,
          title: 'Martha Gable (Concentrator)',
        },
      });

      // 2. Responders
      EMERGENCY_INCIDENT.responders.forEach((resp) => {
        itemsToProject.push({
          id: `em-resp-${resp.id}`,
          type: 'simulated_incident',
          title: `[SIMULATED] ${resp.name} (${resp.role})`,
          shape: 'pin',
          color: '#24B47E',
          icon: <Check size={13} />,
          pos3D: resp.position3D,
          isSimulated: true,
          data: {
            type: 'simulated_incident',
            ...resp,
            isSimulated: true,
          },
        });
      });

      // 3. Emergency Resources
      EMERGENCY_INCIDENT.emergencyResources.forEach((res) => {
        itemsToProject.push({
          id: `em-res-${res.id}`,
          type: 'simulated_incident',
          title: `[SIMULATED] ${res.name}`,
          shape: 'square',
          color: '#3189D8',
          icon: <BatteryCharging size={13} />,
          pos3D: res.position3D,
          isSimulated: true,
          data: {
            type: 'simulated_incident',
            ...res,
            isSimulated: true,
          },
        });
      });

      // 4. Warning
      EMERGENCY_INCIDENT.warnings.forEach((warn) => {
        itemsToProject.push({
          id: `em-warn-${warn.id}`,
          type: 'simulated_incident',
          title: `[SIMULATED] ${warn.title}`,
          shape: 'triangle',
          color: '#E6A928',
          icon: <TriangleAlert size={13} />,
          pos3D: warn.position3D,
          isSimulated: true,
          data: {
            type: 'simulated_incident',
            ...warn,
            isSimulated: true,
          },
        });
      });
    } else {
      // Normal Mode Markers based on active layer
      if (activeLayer === 'coverage' || activeLayer === null) {
        RESIDENTIAL_LOTS.forEach((lot) => {
          const lotIssue = NEIGHBORHOOD_ISSUES.find((i) => i.lotId === lot.id);
          itemsToProject.push({
            id: `lot-cov-${lot.id}`,
            lotId: lot.id,
            type: 'coverage',
            title: lot.residentName,
            subtitle: lot.coverageItems[0]?.title || 'Resident',
            avatar: lot.avatar,
            lotNum: lot.id,
            archetype: lot.description,
            pos3D: lot.position3D,
            data: lot,
            hasIssue: !!lotIssue,
            issueSeverity: lotIssue?.severity || null,
            issueTitle: lotIssue?.title || null,
            coverageItems: lot.coverageItems || [],
            statusClass: lotIssue
              ? (lotIssue.severity === 'medium' ? 'status-attention' : 'status-maintenance')
              : 'status-ready',
          });
        });
      }

      if (activeLayer === 'resources') {
        // Privacy-First: Single generic neighborhood coordination point at common exchange courtyard (Lot 1 cafe base)
        // Never places individual resource pins on private residential rooftops!
        itemsToProject.push({
          id: 'community-exchange-hub',
          type: 'resource_hub',
          title: 'COMMUNITY EXCHANGE',
          subtitle: '11 shared resources nearby',
          pos3D: { x: 11.8, y: 5.5, z: 11.6 },
          data: { type: 'discovery', category: 'resources' },
          statusClass: 'status-resource',
        });
      }

      if (activeLayer === 'issues') {
        NEIGHBORHOOD_ISSUES.forEach((iss) => {
          itemsToProject.push({
            id: `iss-${iss.id}`,
            lotId: iss.lotId,
            type: 'issue',
            title: iss.title,
            subtitle: `${iss.severity.toUpperCase()} · ${iss.status}`,
            lotNum: iss.lotId,
            pos3D: iss.position3D,
            data: iss,
            hasIssue: true,
            issueSeverity: iss.severity,
            issueTitle: iss.title,
            statusClass: iss.severity === 'medium' ? 'status-attention' : 'status-maintenance',
          });
        });
      }
    }

    const projected = itemsToProject.map((item) => {
      const coords = scene.getScreenCoordinates(item.pos3D.x, item.pos3D.y, item.pos3D.z);
      return {
        ...item,
        screenX: coords?.x || 0,
        screenY: coords?.y || 0,
        visible: coords?.visible || false,
      };
    });

    setMarkerPositions(projected);
  }, [mode, activeLayer, liveIncidents, mapIncidentLocationToPos3D]);

  // Initialize Three.js scene once
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new NeighborhoodScene(mountRef.current);
    sceneRef.current = scene;

    // Connect camera update callback to re-project spatial markers
    scene.onCameraUpdate = () => {
      updateProjectedMarkers();
    };

    // Connect lot selection and empty scene click
    scene.onSelectLot = (lotId) => {
      if (onSelectLot) {
        onSelectLot(lotId);
      }
    };

    scene.onSelectEmptyScene = () => {
      if (onClearSelection) {
        onClearSelection();
      }
    };

    // Initial projection
    const timer = setTimeout(() => {
      updateProjectedMarkers();
    }, 150);

    return () => {
      clearTimeout(timer);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [updateProjectedMarkers, onSelectLot, onClearSelection]);

  // Update scene mode (Normal vs Emergency) with ~1.5s visual transition
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setMode(mode, 1500);
      updateProjectedMarkers();
    }
  }, [mode, updateProjectedMarkers]);

  // Update 3D scene lot highlight rings based on Pulse filter & selected lot
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setLotHighlights(highlightedLotIds, selectedLotId);
    }
  }, [highlightedLotIds, selectedLotId]);

  // Re-project spatial markers whenever active layer or live incidents change
  useEffect(() => {
    updateProjectedMarkers();
  }, [activeLayer, liveIncidents, updateProjectedMarkers]);

  // NOTE: Camera is STRICTLY LOCKED during lot selection / Pulse filtering (Parts 13, 82, 110)
  // focusOnLot is NOT called on selection!

  const handleResetCamera = () => {
    if (sceneRef.current) {
      sceneRef.current.resetCamera();
      setIsAutoTouring(false);
      if (onClearSelection) onClearSelection();
    }
  };

  const handleToggleTour = () => {
    if (sceneRef.current) {
      const touring = sceneRef.current.toggleAutoTour();
      setIsAutoTouring(touring);
    }
  };

  return (
    <div className="saathi-neighborhood-viewport-container" aria-label="3D Neighborhood Discovery Viewport">
      {/* Three.js Canvas */}
      <div ref={mountRef} className="saathi-3d-canvas-mount" />

      {/* Layer Control Segmented Tabs (Unified Discovery Navigation) */}
      <LayerControl
        activeLayer={activeLayer}
        onSelectLayer={onSelectLayer}
        mode={mode}
      />

      {/* Camera Utility Controls (Reset & Tour) */}
      <div className="saathi-camera-hud" role="toolbar" aria-label="Camera Controls">
        <button
          type="button"
          className="camera-hud-btn"
          onClick={handleResetCamera}
          title="Reset Camera to Visual Authority Perspective"
          aria-label="Reset Camera"
        >
          <RotateCcw size={13} aria-hidden="true" />
          <span>Reset View</span>
        </button>

        <button
          type="button"
          className={`camera-hud-btn ${isAutoTouring ? 'active' : ''}`}
          onClick={handleToggleTour}
          title={isAutoTouring ? 'Pause 360° Auto-Tour' : 'Start 360° Slow Orbit Tour'}
          aria-label="Toggle Auto-Tour"
        >
          {isAutoTouring ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
          <span>{isAutoTouring ? 'Touring' : 'Tour'}</span>
        </button>
      </div>

      {/* 3D Spatial Overlay Interactive Markers (Color-coded & Progressive Disclosure) */}
      <div className="saathi-3d-overlay-layer" aria-hidden="false">
        {markerPositions.map((marker) => {
          if (!marker.visible) return null;
          const isSelected = selectedLotId === marker.lotNum || (selectedItem && (selectedItem.id === marker.id || (selectedItem.lotId && selectedItem.lotId === marker.lotNum)));
          const isHighlighted = Array.isArray(highlightedLotIds) && highlightedLotIds.includes(marker.lotNum);
          const isHovered = hoveredMarkerId === marker.id;
          const isExpanded = isSelected || isHovered;

          // Safe placement calculation to prevent clipping outside viewport
          const containerWidth = mountRef.current?.clientWidth || 1156;
          const isNearTop = marker.screenY < 135;
          const isNearLeft = marker.screenX < 140;
          const isNearRight = marker.screenX > containerWidth - 140;

          let placementClass = isNearTop ? 'place-bottom' : 'place-top';
          if (isNearLeft) placementClass += ' align-left';
          else if (isNearRight) placementClass += ' align-right';
          else placementClass += ' align-center';

          if (marker.isLive || marker.type === 'live_incident' || mode === 'emergency') {
            return (
              <button
                key={marker.id}
                type="button"
                className={`emergency-spatial-marker marker-shape-${marker.shape} ${marker.isLive ? 'marker-live-incident' : 'marker-simulated'} ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : 'compact'}`}
                style={{
                  transform: `translate(${marker.screenX}px, ${marker.screenY}px)`,
                  '--marker-color': marker.color,
                }}
                onMouseEnter={() => setHoveredMarkerId(marker.id)}
                onMouseLeave={() => setHoveredMarkerId(null)}
                onClick={() => onSelectItem && onSelectItem({ type: marker.type, ...marker.data })}
                aria-label={`Emergency marker: ${marker.title}`}
              >
                <div className="emergency-marker-body">
                  <span className="emergency-marker-icon">{marker.icon}</span>
                  {isExpanded && <span className="emergency-marker-label">{marker.title}</span>}
                </div>
              </button>
            );
          }

          return (
            <button
              key={marker.id}
              type="button"
              className={`neighborhood-spatial-marker type-${marker.type} ${marker.statusClass || ''} ${isSelected ? 'selected' : ''} ${isHighlighted ? 'pulse-highlighted' : ''} ${isExpanded ? 'expanded' : 'compact'}`}
              style={{
                transform: `translate(${marker.screenX}px, ${marker.screenY}px)`,
              }}
              onMouseEnter={() => setHoveredMarkerId(marker.id)}
              onMouseLeave={() => setHoveredMarkerId(null)}
              onClick={() => {
                if (marker.type === 'resource_hub') {
                  if (onSelectItem) onSelectItem({ type: 'discovery', category: 'resources' });
                } else if (onSelectLot && marker.lotNum) {
                  onSelectLot(marker.lotNum);
                } else if (onSelectItem) {
                  onSelectItem({ type: marker.type, lotId: marker.lotId, ...marker.data });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (marker.type === 'resource_hub') {
                    if (onSelectItem) onSelectItem({ type: 'discovery', category: 'resources' });
                  } else if (onSelectLot && marker.lotNum) {
                    onSelectLot(marker.lotNum);
                  }
                }
              }}
              aria-label={marker.lotNum ? `Lot ${marker.lotNum} · ${marker.title}` : marker.title}
              aria-pressed={isSelected}
            >
              <div className={`spatial-marker-pin ${marker.statusClass || ''}`}>
                {/* Compact Anchor Glyph */}
                <div className="marker-anchor-glyph">
                  {marker.type === 'coverage' && (
                    <>
                      <span className="marker-lot-dot">{marker.lotNum}</span>
                      {marker.hasIssue && (
                        <span className={`marker-issue-badge severity-${marker.issueSeverity || 'low'}`} aria-label="Issue Reported">
                          !
                        </span>
                      )}
                    </>
                  )}
                  {(marker.type === 'resource' || marker.type === 'resource_hub') && (
                    <Wrench size={11} className="marker-icon-glyph" />
                  )}
                  {marker.type === 'issue' && (
                    <TriangleAlert size={11} className="marker-icon-glyph" />
                  )}
                </div>

                {/* Progressive Disclosure Hover Card (SAATHI Unified Card Language) */}
                {isExpanded && (
                  <div className={`spatial-marker-hover-card ${placementClass}`} role="tooltip">
                    <div className="hover-card-header-row">
                      <span className="hover-card-resident">{marker.title}</span>
                      {marker.lotNum && <span className="hover-card-lot-tag">Lot {marker.lotNum}</span>}
                      {marker.type === 'resource_hub' && <span className="hover-card-lot-tag">Central Point</span>}
                    </div>

                    {marker.hasIssue && (
                      <div className={`hover-card-issue-row severity-${marker.issueSeverity || 'low'}`}>
                        <AlertTriangle size={11} className="hover-issue-icon" />
                        <span className="hover-issue-text">{marker.issueTitle}</span>
                      </div>
                    )}

                    {marker.type === 'coverage' && marker.coverageItems && marker.coverageItems.length > 0 && (
                      <div className="hover-card-coverage-chips">
                        {marker.coverageItems.slice(0, 3).map((cov, idx) => (
                          <span key={idx} className="hover-coverage-chip">
                            {cov.title.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    )}

                    {marker.type !== 'coverage' && !marker.hasIssue && (
                      <div className="hover-card-status-row">
                        <CheckCircle2 size={11} className="hover-status-icon" />
                        <span className="hover-status-text">{marker.subtitle}</span>
                      </div>
                    )}

                    <div className="hover-card-meta-row">
                      <span className="hover-meta-item">Verified Proximity</span>
                      <span className="hover-meta-cta">Click to inspect</span>
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 3D Map Legend (Quiet Orientation Aid in Bottom Left) */}
      <div className="saathi-map-legend" role="region" aria-label="Map Marker Legend">
        <span className="legend-label">MAP LEGEND:</span>
        <div className="legend-pills">
          <span className="legend-chip">
            <span className="legend-dot dot-ready" />
            <span>Ready / Available</span>
          </span>
          <span className="legend-chip">
            <span className="legend-dot dot-attention" />
            <span>Attention Needed</span>
          </span>
          <span className="legend-chip">
            <span className="legend-dot dot-resource" />
            <span>Community Exchange</span>
          </span>
        </div>
      </div>

      {/* Primary + ASK NEIGHBORHOOD Button (Clear Context & Affordance) */}
      <div className="saathi-primary-ask-container">
        <button
          type="button"
          className="saathi-btn-ask"
          id="primaryAskBtn"
          onClick={onOpenAskModal}
          aria-label="Create Neighborhood Ask"
          title="Create a neighborhood ask: request coverage, borrow tools, or report an issue"
        >
          <Plus size={16} strokeWidth={2.8} aria-hidden="true" />
          <span className="ask-text">ASK NEIGHBORHOOD</span>
        </button>
      </div>
    </div>
  );
}
