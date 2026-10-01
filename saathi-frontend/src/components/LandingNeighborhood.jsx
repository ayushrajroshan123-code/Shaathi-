import React, { useRef, useEffect, useCallback } from 'react';
import { NeighborhoodScene } from '../neighborhood/NeighborhoodScene';

/**
 * LandingNeighborhood — cinematic 3D neighborhood section for the landing page.
 *
 * Single job: make the abstract idea of neighborhood coordination physically real.
 * Story: Martha Gable (Lot 5) has a wheelchair → Dr. Thorne (Lot 2) is responding.
 *
 * Architecture:
 *   - Reuses NeighborhoodScene directly (no second renderer, no new packages)
 *   - Lazy-inits via IntersectionObserver; disposes on exit
 *   - Cards are HTML overlays positioned once at scene-ready
 *   - Dashboard untouched — NeighborhoodScene.js unmodified
 */
export default function LandingNeighborhood() {
  const sectionRef = useRef(null);
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cardARef = useRef(null);
  const cardBRef = useRef(null);
  const arcRef = useRef(null);
  const resetTimeoutRef = useRef(null);
  const beatTimerRef = useRef(null);
  const beatCycleRef = useRef(null);
  const isOrbitingRef = useRef(false);
  const cardsVisibleRef = useRef(false);
  const observerRef = useRef(null);

  // ------------------------------------------------------------------
  // Wheelchair coordination scenario (from dashboardData.js)
  // Lot 5 · Martha Gable · res-9 · Drive Medical Lightweight Folding Wheelchair
  // Lot 2 · Dr. Aris Thorne
  // ------------------------------------------------------------------
  const LOT5_POS = { x: 9.0, y: 5.2, z: -9.0 };
  const LOT2_POS = { x: -8.8, y: 5.2, z: 8.8 };

  // ------------------------------------------------------------------
  // Position cards at computed screen coords (once at scene-ready)
  // ------------------------------------------------------------------
  const anchorCards = useCallback(() => {
    const scene = sceneRef.current;
    const mount = mountRef.current;
    if (!scene || !mount) return;
    if (typeof scene.getScreenCoordinates !== 'function') return;

    const coordA = scene.getScreenCoordinates(LOT5_POS.x, LOT5_POS.y, LOT5_POS.z);
    const coordB = scene.getScreenCoordinates(LOT2_POS.x, LOT2_POS.y, LOT2_POS.z);

    if (!coordA || !coordB) return;

    const w = mount.clientWidth;
    const h = mount.clientHeight;

    const MARGIN_X = 130;
    const MARGIN_Y = 80;
    const clampX = (x) => Math.max(MARGIN_X, Math.min(w - MARGIN_X, x));
    const clampY = (y) => Math.max(MARGIN_Y, Math.min(h - MARGIN_Y, y));

    const ax = clampX(coordA.x);
    const ay = clampY(coordA.y);
    const bx = clampX(coordB.x);
    const by = clampY(coordB.y);

    if (cardARef.current) {
      cardARef.current.style.left = ax + 'px';
      cardARef.current.style.top = ay + 'px';
    }
    if (cardBRef.current) {
      cardBRef.current.style.left = bx + 'px';
      cardBRef.current.style.top = by + 'px';
    }

    // Draw SVG arc
    const svg = arcRef.current;
    if (svg) {
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      svg.style.width = w + 'px';
      svg.style.height = h + 'px';

      const line = svg.querySelector('.ln-arc-line');
      if (line) {
        const mx = (ax + bx) / 2;
        const my = Math.min(ay, by) - 48;
        line.setAttribute('d', 'M ' + ax + ' ' + ay + ' Q ' + mx + ' ' + my + ' ' + bx + ' ' + by);
        try {
          const length = line.getTotalLength();
          line.style.strokeDasharray = length;
          line.style.strokeDashoffset = length;
        } catch (_) {
          line.style.strokeDasharray = '300';
          line.style.strokeDashoffset = '300';
        }
      }
    }
  }, []);

  // ------------------------------------------------------------------
  // Show / hide coordination overlay
  // ------------------------------------------------------------------
  const showOverlay = useCallback(() => {
    if (isOrbitingRef.current) return;
    cardsVisibleRef.current = true;
    if (cardARef.current) cardARef.current.classList.add('ln-card--visible');
    if (cardBRef.current) cardBRef.current.classList.add('ln-card--visible');

    const svg = arcRef.current;
    if (svg) {
      svg.classList.add('ln-arc--visible');
      const line = svg.querySelector('.ln-arc-line');
      if (line) {
        let length = line._cachedLength || 300;
        try {
          if (!line._cachedLength) {
            length = line.getTotalLength();
            line._cachedLength = length;
          }
        } catch (_) {}
        line.style.transition = 'none';
        line.style.strokeDashoffset = String(length);
        requestAnimationFrame(() => {
          if (!cardsVisibleRef.current) return;
          line.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
          line.style.strokeDashoffset = '0';
        });
      }
    }
  }, []);

  const hideOverlay = useCallback(() => {
    cardsVisibleRef.current = false;
    if (cardARef.current) cardARef.current.classList.remove('ln-card--visible');
    if (cardBRef.current) cardBRef.current.classList.remove('ln-card--visible');
    if (arcRef.current) arcRef.current.classList.remove('ln-arc--visible');
  }, []);

  // ------------------------------------------------------------------
  // Beat cycle: 5s pure → 4s story → 2s rest → loop
  // ------------------------------------------------------------------
  const stopBeatCycle = useCallback(() => {
    if (beatTimerRef.current) { clearTimeout(beatTimerRef.current); beatTimerRef.current = null; }
    if (beatCycleRef.current) { clearTimeout(beatCycleRef.current); beatCycleRef.current = null; }
  }, []);

  const startBeatCycle = useCallback(() => {
    stopBeatCycle();

    const runCycle = () => {
      beatTimerRef.current = setTimeout(() => {
        showOverlay();
        beatTimerRef.current = setTimeout(() => {
          hideOverlay();
          beatCycleRef.current = setTimeout(runCycle, 2000);
        }, 4000);
      }, 5000);
    };

    runCycle();
  }, [stopBeatCycle, showOverlay, hideOverlay]);

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
    } catch (_) { return; }

    const scene = new NeighborhoodScene(mountRef.current);
    sceneRef.current = scene;

    // Landing-specific configuration (NeighborhoodScene.js remains completely untouched)
    scene.controls.enablePan = false;
    scene.controls.autoRotate = true;
    scene.controls.autoRotateSpeed = 0.4;

    // 1. Landing-only shadow map caching:
    // The diorama geometry and studio sunlight are static; freezing autoUpdate
    // renders the shadow map once and reuses it, eliminating ~1,500 redundant draw calls per frame
    if (scene.renderer.shadowMap.enabled) {
      scene.renderer.shadowMap.autoUpdate = false;
      scene.renderer.shadowMap.needsUpdate = true;
    }

    // 2. Landing-only DPR cap:
    // Cap to 1.5 on desktop, 1.2 on mobile to avoid 4x shading overhead on high-DPI displays
    const isMobile = mountRef.current.clientWidth < 768;
    if (isMobile) {
      scene.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
      scene.renderer.shadowMap.enabled = false;
    } else {
      scene.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    }

    // Settle 150ms before anchoring cards
    beatTimerRef.current = setTimeout(() => {
      anchorCards();
      startBeatCycle();
    }, 150);
  }, [anchorCards, startBeatCycle]);

  // ------------------------------------------------------------------
  // Landing-specific pause / resume (zero changes to NeighborhoodScene.js)
  // ------------------------------------------------------------------
  const pauseLandingScene = useCallback(() => {
    const scene = sceneRef.current;
    if (scene && scene.animationFrameId) {
      cancelAnimationFrame(scene.animationFrameId);
      scene.animationFrameId = null;
    }
    stopBeatCycle();
    hideOverlay();
  }, [stopBeatCycle, hideOverlay]);

  const resumeLandingScene = useCallback(() => {
    const scene = sceneRef.current;
    if (scene && !scene.animationFrameId && !scene.isDisposed) {
      scene.animate();
      startBeatCycle();
    }
  }, [startBeatCycle]);

  // ------------------------------------------------------------------
  // Dispose scene
  // ------------------------------------------------------------------
  const disposeScene = useCallback(() => {
    stopBeatCycle();
    hideOverlay();
    if (resetTimeoutRef.current) { clearTimeout(resetTimeoutRef.current); resetTimeoutRef.current = null; }
    if (sceneRef.current) {
      sceneRef.current.dispose();
      sceneRef.current = null;
    }
  }, [stopBeatCycle, hideOverlay]);

  // ------------------------------------------------------------------
  // Orbit interaction handlers
  // ------------------------------------------------------------------
  const handlePointerDown = useCallback(() => {
    isOrbitingRef.current = true;
    cardsVisibleRef.current = false;
    if (cardARef.current) cardARef.current.classList.remove('ln-card--visible');
    if (cardBRef.current) cardBRef.current.classList.remove('ln-card--visible');
    if (arcRef.current) arcRef.current.classList.remove('ln-arc--visible');
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    stopBeatCycle();
  }, [stopBeatCycle]);

  const handlePointerUp = useCallback(() => {
    isOrbitingRef.current = false;
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    // After 4s inactivity → smooth camera reset
    resetTimeoutRef.current = setTimeout(() => {
      if (sceneRef.current) {
        sceneRef.current.resetCamera();
        // Re-enable auto-orbit (resetCamera internally sets autoRotate=false)
        // and re-anchor cards after the 850ms reset animation settles
        setTimeout(() => {
          if (sceneRef.current && sceneRef.current.controls) {
            sceneRef.current.controls.autoRotate = true;
            sceneRef.current.controls.autoRotateSpeed = 0.4;
          }
          anchorCards();
          startBeatCycle();
        }, 1000);
      }
    }, 4000);

  }, [anchorCards, startBeatCycle]);

  // ------------------------------------------------------------------
  // Window resize handler
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleResize = () => {
      anchorCards();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [anchorCards]);

  // ------------------------------------------------------------------
  // IntersectionObserver lifecycle
  // ------------------------------------------------------------------
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      if (sectionRef.current) sectionRef.current.classList.add('ln-section--reduced-motion');
      return;
    }

    const section = sectionRef.current;
    if (!section) return;

    // Lifecycle: initialize once when approaching viewport (rootMargin: 300px);
    // pause rendering when sufficiently offscreen, resume when visible.
    // WebGL resources are only disposed when the component truly unmounts.
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            if (!sceneRef.current) {
              initScene();
            } else {
              resumeLandingScene();
            }
          } else {
            if (sceneRef.current) {
              pauseLandingScene();
            }
          }
        });
      },
      { rootMargin: '300px 0px' }
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
  // Pointer event listeners
  // ------------------------------------------------------------------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    mount.addEventListener('pointerdown', handlePointerDown);
    mount.addEventListener('pointerup', handlePointerUp);
    mount.addEventListener('pointerleave', handlePointerUp);
    return () => {
      mount.removeEventListener('pointerdown', handlePointerDown);
      mount.removeEventListener('pointerup', handlePointerUp);
      mount.removeEventListener('pointerleave', handlePointerUp);
    };
  }, [handlePointerDown, handlePointerUp]);

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
      <div className="ln-sticky-wrap">
        {/* Section eyebrow — light editorial label above the canvas */}
        <div className="ln-eyebrow" aria-hidden="true">
          <span className="ln-eyebrow-text">GREENWOOD COMMONS</span>
          <span className="ln-eyebrow-sep">·</span>
          <span className="ln-eyebrow-sub">Oakridge Circle</span>
        </div>

        {/* Three.js canvas mount — fills the section */}
        <div ref={mountRef} className="ln-canvas-mount" aria-hidden="true" />

        {/* Reduced-motion / no-WebGL fallback placeholder */}
        <div className="ln-placeholder" aria-hidden="true">
          <span className="ln-placeholder-eyebrow">GREENWOOD COMMONS</span>
          <span className="ln-placeholder-statement">One neighborhood.<br />People coordinate here.</span>
        </div>

        {/* Editorial card A — Lot 5, Martha Gable */}
        <div
          ref={cardARef}
          className="ln-card ln-card-a"
          role="presentation"
          aria-hidden="true"
        >
          <span className="ln-card-label">WHEELCHAIR · LOT 5</span>
          <span className="ln-card-value">Available now</span>
        </div>

        {/* Editorial card B — Lot 2, Dr. Thorne */}
        <div
          ref={cardBRef}
          className="ln-card ln-card-b"
          role="presentation"
          aria-hidden="true"
        >
          <span className="ln-card-label">DR. THORNE · LOT 2</span>
          <span className="ln-card-value">Responding</span>
        </div>

        {/* SVG connection arc */}
        <svg
          ref={arcRef}
          className="ln-arc-svg"
          aria-hidden="true"
        >
          <path
            className="ln-arc-line"
            fill="none"
            stroke="rgba(42,111,99,0.28)"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>

        {/* Bottom gradient bridge — transitions into TwoModes dark background (#0A0C10) */}
        <div className="ln-bottom-fade" aria-hidden="true" />
      </div>
    </section>
  );
}
