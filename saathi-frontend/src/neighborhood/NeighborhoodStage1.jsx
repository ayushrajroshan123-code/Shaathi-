import React, { useEffect, useRef } from 'react';
import { NeighborhoodScene } from './NeighborhoodScene';
import './neighborhood.css';

/**
 * NeighborhoodStage1
 * Host component for the 3D Neighborhood environment foundation.
 * Renders the Three.js viewport canvas with minimal architectural HUD.
 */

export default function NeighborhoodStage1({ onBack }) {
  const mountRef = useRef(null);
  const sceneInstanceRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Initialize self-contained Three.js scene
    const scene = new NeighborhoodScene(mountRef.current);
    sceneInstanceRef.current = scene;
    scene.startStory();

    return () => {
      scene.dispose();
      sceneInstanceRef.current = null;
    };
  }, []);

  const handleResetCamera = () => {
    if (sceneInstanceRef.current) {
      sceneInstanceRef.current.resetCamera();
    }
  };

  return (
    <div className="saathi-neighborhood-stage">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="saathi-neighborhood-viewport" />

      {/* Top Architectural HUD */}
      <header className="saathi-hud-top">
        <div className="saathi-hud-branding">
          {onBack && (
            <>
              <button
                type="button"
                className="saathi-hud-back-btn"
                onClick={onBack}
                aria-label="Return to Landing Page"
              >
                ← Back
              </button>
              <div className="saathi-hud-divider" />
            </>
          )}
          <span className="saathi-hud-title">SAATHI Neighborhood</span>
          <span className="saathi-hud-badge">Stage 1: World Foundation</span>
        </div>

        <div className="saathi-hud-actions">
          <button
            type="button"
            className="saathi-reset-camera-btn"
            onClick={handleResetCamera}
            aria-label="Reset Camera to default cinematic perspective"
          >
            <svg
              className="saathi-reset-camera-icon"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>Reset Camera</span>
          </button>
        </div>
      </header>

      {/* Bottom Hint Badge */}
      <div className="saathi-hud-bottom">
        <div className="saathi-hud-guide">
          <span className="saathi-hud-guide-dot" />
          <span>Drag to orbit • Right-click or 2-finger drag to pan • Scroll or pinch to zoom</span>
        </div>
      </div>
    </div>
  );
}
