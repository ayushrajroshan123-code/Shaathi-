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
 * - Progressive disclosure: rich hover tooltip with lot owner, archetype, active status & shared tools
 * - Clear 3D Map Legend explaining markers
 * - Descriptive "+ ASK NEIGHBORHOOD" button with clear context
 */
export default function NeighborhoodViewport({
  mode = 'normal',
  activeLayer = null,
  onSelectLayer,
  selectedItem,
  onSelectItem,
  onOpenAskModal,
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [markerPositions, setMarkerPositions] = useState([]);
  const [isAutoTouring, setIsAutoTouring] = useState(false);
  const [hoveredMarkerId, setHoveredMarkerId] = useState(null);

  // Compute 2D screen positions for 3D world points
  const updateProjectedMarkers = useCallback(() => {
    if (!sceneRef.current || !mountRef.current) return;
    const scene = sceneRef.current;

    let itemsToProject = [];

    if (mode === 'emergency') {
      // Emergency Mode Markers (Section 23: SHAPE + COLOR)
      // 1. SOS (Lot 5)
      itemsToProject.push({
        id: 'em-sos-1',
        type: 'sos',
        title: 'Martha Gable (Concentrator)',
        shape: 'circle',
        color: '#E5483A',
        icon: <AlertCircle size={13} />,
        pos3D: { x: 9.0, y: 4.8, z: -9.0 },
        data: EMERGENCY_INCIDENT.affectedPeople[0],
      });

      // 2. Responders
      EMERGENCY_INCIDENT.responders.forEach((resp) => {
        itemsToProject.push({
          id: `em-resp-${resp.id}`,
          type: 'responder',
          title: `${resp.name} (${resp.role})`,
          shape: 'pin',
          color: '#24B47E',
          icon: <Check size={13} />,
          pos3D: resp.position3D,
          data: resp,
        });
      });

      // 3. Emergency Resources
      EMERGENCY_INCIDENT.emergencyResources.forEach((res) => {
        itemsToProject.push({
          id: `em-res-${res.id}`,
          type: 'emergency-resource',
          title: res.name,
          shape: 'square',
          color: '#3189D8',
          icon: <BatteryCharging size={13} />,
          pos3D: res.position3D,
          data: res,
        });
      });

      // 4. Warning
      EMERGENCY_INCIDENT.warnings.forEach((warn) => {
        itemsToProject.push({
          id: `em-warn-${warn.id}`,
          type: 'warning',
          title: warn.title,
          shape: 'triangle',
          color: '#E6A928',
          icon: <TriangleAlert size={13} />,
          pos3D: warn.position3D,
          data: warn,
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
            resourceCount: lot.resources?.length || 0,
            statusClass: lotIssue
              ? (lotIssue.severity === 'medium' ? 'status-attention' : 'status-maintenance')
              : 'status-ready',
          });
        });
      }

      if (activeLayer === 'resources') {
        RESIDENTIAL_LOTS.forEach((lot) => {
          lot.resources.forEach((res) => {
            itemsToProject.push({
              id: `lot-res-${res.id}`,
              lotId: lot.id,
              type: 'resource',
              title: res.name,
              subtitle: `Lot ${lot.id} · ${res.sharedBy}`,
              lotNum: lot.id,
              pos3D: { x: lot.position3D.x + (res.id.endsWith('1') ? 1.4 : -1.4), y: lot.position3D.y - 1.2, z: lot.position3D.z },
              data: res,
              parentLot: lot,
              statusClass: 'status-resource',
            });
          });
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
  }, [mode, activeLayer]);

  // Initialize Three.js scene once
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new NeighborhoodScene(mountRef.current);
    sceneRef.current = scene;

    // Connect camera update callback to re-project spatial markers
    scene.onCameraUpdate = () => {
      updateProjectedMarkers();
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
  }, [updateProjectedMarkers]);

  // Update scene mode (Normal vs Emergency) with ~1.5s visual transition
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setMode(mode, 1500);
      updateProjectedMarkers();
    }
  }, [mode, updateProjectedMarkers]);

  // Re-project spatial markers whenever active layer changes (Overview / Coverage / Resources / Issues)
  useEffect(() => {
    updateProjectedMarkers();
  }, [activeLayer, updateProjectedMarkers]);

  // Focus 3D camera when an item with a lot or position is selected
  useEffect(() => {
    if (!sceneRef.current || !selectedItem) return;

    if (selectedItem.lotId) {
      sceneRef.current.focusOnLot(selectedItem.lotId);
    } else if (selectedItem.id && selectedItem.position3D) {
      sceneRef.current.focusOnLot(selectedItem.id);
    }
  }, [selectedItem]);

  const handleResetCamera = () => {
    if (sceneRef.current) {
      sceneRef.current.resetCamera();
      setIsAutoTouring(false);
      if (onSelectItem) onSelectItem(null);
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
          const isSelected = selectedItem && (selectedItem.id === marker.id || (selectedItem.lotId && selectedItem.lotId === marker.lotId));
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

          if (mode === 'emergency') {
            return (
              <button
                key={marker.id}
                type="button"
                className={`emergency-spatial-marker marker-shape-${marker.shape} ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : 'compact'}`}
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
              className={`neighborhood-spatial-marker type-${marker.type} ${marker.statusClass || ''} ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : 'compact'}`}
              style={{
                transform: `translate(${marker.screenX}px, ${marker.screenY}px)`,
              }}
              onMouseEnter={() => setHoveredMarkerId(marker.id)}
              onMouseLeave={() => setHoveredMarkerId(null)}
              onClick={() => onSelectItem && onSelectItem({ type: marker.type, lotId: marker.lotId, ...marker.data })}
              aria-label={`Select ${marker.title}`}
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
                  {marker.type === 'resource' && (
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
                      <span className="hover-card-lot-tag">Lot {marker.lotNum}</span>
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
                      {marker.resourceCount !== undefined && marker.resourceCount > 0 ? (
                        <span className="hover-meta-item">
                          <Wrench size={10} style={{ marginRight: 3 }} />
                          {marker.resourceCount} shared tools
                        </span>
                      ) : (
                        <span className="hover-meta-item">Verified Proximity</span>
                      )}
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
            <span>Shared Tools</span>
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
