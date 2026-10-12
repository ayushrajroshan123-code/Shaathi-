import React, { useRef, useEffect, useState, useCallback } from 'react';
import { NeighborhoodScene } from '../neighborhood/NeighborhoodScene';

const STORIES = [
  {
    id: 'drill',
    title: 'Borrow a drill',
    subtitle: 'Find something nearby',
  },
  {
    id: 'carry',
    title: 'Help carry something',
    subtitle: 'Lend a hand nearby',
  },
  {
    id: 'ladder',
    title: 'Borrow a ladder',
    subtitle: 'Coordinate a quick handoff',
  },
];

/**
 * LandingNeighborhood — Cinematic 3D neighborhood section for the SAATHI landing page.
 *
 * Phase 1 Architecture:
 * - Editorial Showcase Header ("See Saathi in action") with 3 quiet story selectors.
 * - Single-story execution managed by ScenarioDirector.
 * - Quiet story beat caption outside the canvas without in-canvas speech bubbles.
 */
export default function LandingNeighborhood() {
  const sectionRef = useRef(null);
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const observerRef = useRef(null);

  const [activeStory, setActiveStory] = useState(null);
  const [currentBeat, setCurrentBeat] = useState('');

  // ------------------------------------------------------------------
  // Initialize the scene
  // ------------------------------------------------------------------
  const initScene = useCallback(() => {
    if (sceneRef.current || !mountRef.current) return;

    // WebGL guard
    try {
      const tc = document.createElement('canvas');
      const gl = tc.getContext('webgl2') || tc.getContext('webgl');
      if (!gl) {
        if (sectionRef.current) sectionRef.current.classList.add('ln-section--no-webgl');
        return;
      }
    } catch (_) {
      return;
    }

    const scene = new NeighborhoodScene(mountRef.current);
    sceneRef.current = scene;

    // Connect beat updates from ScenarioDirector
    scene.onBeat = (beatText) => {
      setCurrentBeat(beatText);
    };

    // Connect active story state from ScenarioDirector (single source of truth)
    scene.onStoryChange = (storyId) => {
      setActiveStory(storyId);
    };

    // Camera stays stable: NO auto-rotation, user has full free inspection
    scene.controls.enablePan = true;
    scene.controls.autoRotate = false;

    // Responsive DPR and Shadow Rendering
    const isMobile = mountRef.current.clientWidth < 768;
    if (isMobile) {
      scene.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
      scene.renderer.shadowMap.enabled = false;
    } else {
      scene.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      if (scene.renderer.shadowMap.enabled) {
        scene.renderer.shadowMap.autoUpdate = true;
      }
    }

    // In Phase 1, stories do NOT auto-start on initialization.
    // The neighborhood remains in its natural ambient state until a story is chosen.
  }, []);

  // ------------------------------------------------------------------
  // Story selection handler (delegates strictly to ScenarioDirector)
  // ------------------------------------------------------------------
  const handleSelectStory = useCallback((storyId) => {
    if (storyId === 'ladder') {
      console.log('[StoryUI] Ladder button clicked');
    }
    const nextStory = activeStory === storyId ? null : storyId;
    setActiveStory(nextStory);
    if (nextStory === 'ladder') {
      console.log('[StoryUI] Active story: ladder');
    }

    if (!sceneRef.current) {
      initScene();
    }
    if (sceneRef.current) {
      sceneRef.current.toggleScenario(storyId);
    }
  }, [activeStory, initScene]);

  // ------------------------------------------------------------------
  // Pause / Resume lifecycle (scroll-driven efficiency)
  // ------------------------------------------------------------------
  const pauseLandingScene = useCallback(() => {
    const scene = sceneRef.current;
    if (scene) {
      if (scene.animationFrameId) {
        cancelAnimationFrame(scene.animationFrameId);
        scene.animationFrameId = null;
      }
      scene.pauseStory();
    }
  }, []);

  const resumeLandingScene = useCallback(() => {
    const scene = sceneRef.current;
    if (scene && !scene.isDisposed) {
      if (!scene.animationFrameId) {
        scene.animate();
      }
      scene.resumeStory();
    }
  }, []);

  // ------------------------------------------------------------------
  // Dispose scene
  // ------------------------------------------------------------------
  const disposeScene = useCallback(() => {
    if (sceneRef.current) {
      sceneRef.current.dispose();
      sceneRef.current = null;
    }
  }, []);

  // ------------------------------------------------------------------
  // IntersectionObserver lifecycle: initializes ONLY when section is reached
  // ------------------------------------------------------------------
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      if (sectionRef.current) sectionRef.current.classList.add('ln-section--reduced-motion');
      return;
    }

    const section = sectionRef.current;
    if (!section) return;

    // Observe when the user actually scrolls to this section
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio >= 0.15) {
            if (!sceneRef.current) {
              initScene();
            } else {
              resumeLandingScene();
            }
          } else if (!e.isIntersecting || e.intersectionRatio < 0.05) {
            if (sceneRef.current) {
              pauseLandingScene();
            }
          }
        });
      },
      { threshold: [0, 0.15, 0.3] }
    );
    observerRef.current.observe(section);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      disposeScene();
    };
  }, [initScene, disposeScene, resumeLandingScene, pauseLandingScene]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <section
      ref={sectionRef}
      className="ln-section"
      id="neighborhood-scene"
      aria-label="SAATHI Neighborhood — Greenwood Commons coordination"
    >
      {/* 1. Story Showcase Controls Block — Completely OUTSIDE the 3D viewport */}
      <div className="ln-showcase-bar">
        <div className="ln-showcase-content">
          <h2 className="ln-showcase-title">See SAATHI working</h2>

          <div className="ln-story-selectors" role="tablist" aria-label="Neighborhood Stories">
            {STORIES.map((story) => {
              const isActive = activeStory === story.id;
              return (
                <button
                  key={story.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`ln-story-pill ${isActive ? 'ln-story-pill--active' : ''}`}
                  onClick={() => handleSelectStory(story.id)}
                >
                  <div className="ln-story-pill-body">
                    <span className="ln-story-pill-title">{story.title}</span>
                    <span className="ln-story-pill-subtitle">{story.subtitle}</span>
                  </div>
                  <div className="ln-story-pill-peg" aria-hidden="true">
                    <span className="ln-story-peg-core" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Small, quiet story beat caption outside 3D viewport */}
          <div className="ln-beat-container" aria-live="polite">
            {currentBeat ? (
              <p className="ln-beat-caption">{currentBeat}</p>
            ) : (
              <p className="ln-beat-caption ln-beat-caption--muted">
                Select a story above to observe neighborhood coordination
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. 3D Viewport — Dedicated canvas container sitting cleanly below controls */}
      <div className="ln-viewport-wrap">
        <div ref={mountRef} className="ln-canvas-mount" aria-hidden="true" />
        <div className="ln-bottom-fade" aria-hidden="true" />
      </div>

      {/* Reduced-motion / no-WebGL fallback placeholder */}
      <div className="ln-placeholder" aria-hidden="true">
        <span className="ln-placeholder-eyebrow">GREENWOOD COMMONS</span>
        <span className="ln-placeholder-statement">
          One neighborhood.
          <br />
          People coordinate here.
        </span>
      </div>
    </section>
  );
}
