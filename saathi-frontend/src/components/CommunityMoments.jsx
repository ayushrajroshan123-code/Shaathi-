import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

/**
 * CommunityMoments — Phase 03: Editorial Neighborhood Coordination
 *
 * Cinematic Scroll-Position Driven Narrative:
 * Each beat features three calibrated phases:
 *   1. ENTRANCE:   New text enters responsively (~2-2.5% progress)
 *   2. HOLD:       Once settled, text remains completely stable for reading (~4.5-9.0% progress)
 *   3. TRANSITION: Smooth release before the next moment (~2% progress)
 *
 * Special Pacing:
 *   "Use Gate 4 instead" receives an extended hold (0.610 - 0.700, 9.0% progress)
 *   to establish a deliberate, settled answer to the flood alert.
 *
 * 100% Scroll-Position Driven & Fully Reversible:
 *   - Stopping scroll halts the narrative in place.
 *   - Upward scroll reverses naturally.
 *   - Natural exit into Landing Neighborhood at progress 1.000.
 *   - Natural exit back into Editorial Statement at progress 0.000.
 */

export default function CommunityMoments() {
  const sectionRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  // Section-relative scroll progress — single source of truth for both directions
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // =========================================================================
  // MOMENT 01: WHEELCHAIR RESOURCE (0.010 - 0.170)
  // Entrance: 0.010 - 0.025 | Need Hold: 0.025 - 0.045 | Resp Entrance: 0.045 - 0.060
  // Combined Hold: 0.060 - 0.115 (5.5% hold) | Exit: 0.115 - 0.130
  // Quiet Interval: 0.130 - 0.170 (4.0% larger breathing space)
  // =========================================================================
  const m1LayerOpacity = useTransform(scrollYProgress, [0.010, 0.025, 0.115, 0.130], [0, 1, 1, 0]);
  const m1Visibility = useTransform(m1LayerOpacity, (o) => (o > 0.001 ? 'visible' : 'hidden'));
  const m1PointerEvents = useTransform(m1LayerOpacity, (o) => (o > 0.001 ? 'auto' : 'none'));

  const m1NeedOpacity = useTransform(scrollYProgress, [0.010, 0.025, 0.115, 0.130], [0, 1, 1, 0]);
  const m1NeedY = useTransform(scrollYProgress, [0.010, 0.025, 0.115, 0.130], [20, 0, 0, -16]);
  const m1RespOpacity = useTransform(scrollYProgress, [0.045, 0.060, 0.115, 0.130], [0, 1, 1, 0]);
  const m1RespY = useTransform(scrollYProgress, [0.045, 0.060, 0.115, 0.130], [16, 0, 0, -16]);
  const m1RespX = useTransform(scrollYProgress, [0.045, 0.060, 0.115, 0.130], [-8, 0, 0, 0]);
  const m1LineProgress = useTransform(scrollYProgress, [0.045, 0.070], [0, 1]);

  // =========================================================================
  // MOMENT 02: MEDICINE NEARBY (0.170 - 0.320)
  // Entrance: 0.170 - 0.185 | Need Hold: 0.185 - 0.205 | Resp Entrance: 0.205 - 0.220
  // Combined Hold: 0.220 - 0.275 (5.5% hold) | Exit: 0.275 - 0.290
  // Quiet Interval: 0.290 - 0.320 (3.0% clear breathing space)
  // =========================================================================
  const m2LayerOpacity = useTransform(scrollYProgress, [0.170, 0.185, 0.275, 0.290], [0, 1, 1, 0]);
  const m2Visibility = useTransform(m2LayerOpacity, (o) => (o > 0.001 ? 'visible' : 'hidden'));
  const m2PointerEvents = useTransform(m2LayerOpacity, (o) => (o > 0.001 ? 'auto' : 'none'));

  const m2NeedOpacity = useTransform(scrollYProgress, [0.170, 0.185, 0.275, 0.290], [0, 1, 1, 0]);
  const m2NeedY = useTransform(scrollYProgress, [0.170, 0.185, 0.275, 0.290], [20, 0, 0, -16]);
  const m2NeedX = useTransform(scrollYProgress, [0.170, 0.185, 0.275, 0.290], [-12, 0, 0, 0]);
  const m2RespOpacity = useTransform(scrollYProgress, [0.205, 0.220, 0.275, 0.290], [0, 1, 1, 0]);
  const m2RespY = useTransform(scrollYProgress, [0.205, 0.220, 0.275, 0.290], [16, 0, 0, -16]);
  const m2RespX = useTransform(scrollYProgress, [0.205, 0.220, 0.275, 0.290], [12, 0, 0, 0]);

  // =========================================================================
  // MOMENT 03: AC SERVICING MULTIPLIER (0.320 - 0.470)
  // Entrance: 0.320 - 0.335 | Need Hold: 0.335 - 0.355 | Resp Entrance: 0.355 - 0.370
  // Combined Hold: 0.370 - 0.425 (5.5% hold) | Exit: 0.425 - 0.440
  // Quiet Interval: 0.440 - 0.470 (3.0% clear breathing space)
  // =========================================================================
  const m3LayerOpacity = useTransform(scrollYProgress, [0.320, 0.335, 0.425, 0.440], [0, 1, 1, 0]);
  const m3Visibility = useTransform(m3LayerOpacity, (o) => (o > 0.001 ? 'visible' : 'hidden'));
  const m3PointerEvents = useTransform(m3LayerOpacity, (o) => (o > 0.001 ? 'auto' : 'none'));

  const m3NeedOpacity = useTransform(scrollYProgress, [0.320, 0.335, 0.425, 0.440], [0, 1, 1, 0]);
  const m3NeedY = useTransform(scrollYProgress, [0.320, 0.335, 0.425, 0.440], [20, 0, 0, -16]);
  const m3RespOpacity = useTransform(scrollYProgress, [0.355, 0.370, 0.425, 0.440], [0, 1, 1, 0]);
  const m3RespScale = useTransform(scrollYProgress, [0.355, 0.370, 0.425, 0.440], [0.96, 1, 1, 0.98]);
  const m3RespY = useTransform(scrollYProgress, [0.355, 0.370, 0.425, 0.440], [16, 0, 0, -16]);

  // =========================================================================
  // MOMENT 04: FLOOD ROUTE INFORMATION (0.470 - 0.670)
  // Entrance: 0.470 - 0.485 | Need Hold: 0.485 - 0.505
  // Resp Entrance: 0.505 - 0.520
  // - PRESERVED EXTENDED HOLD: 0.520 - 0.615 (9.5% steady plateau for "Use Gate 4 instead")
  // Exit: 0.615 - 0.630
  // Quiet Interval: 0.630 - 0.670 (4.0% larger breathing space)
  // =========================================================================
  const m4LayerOpacity = useTransform(scrollYProgress, [0.470, 0.485, 0.615, 0.630], [0, 1, 1, 0]);
  const m4Visibility = useTransform(m4LayerOpacity, (o) => (o > 0.001 ? 'visible' : 'hidden'));
  const m4PointerEvents = useTransform(m4LayerOpacity, (o) => (o > 0.001 ? 'auto' : 'none'));

  const m4NeedOpacity = useTransform(scrollYProgress, [0.470, 0.485, 0.615, 0.630], [0, 1, 1, 0]);
  const m4NeedY = useTransform(scrollYProgress, [0.470, 0.485, 0.615, 0.630], [20, 0, 0, -16]);
  const m4RespOpacity = useTransform(scrollYProgress, [0.505, 0.520, 0.615, 0.630], [0, 1, 1, 0]);
  const m4RespY = useTransform(scrollYProgress, [0.505, 0.520, 0.615, 0.630], [16, 0, 0, -16]);
  const m4RespX = useTransform(scrollYProgress, [0.505, 0.520, 0.615, 0.630], [12, 0, 0, 0]);

  // =========================================================================
  // BEAT 6: ACCUMULATION & CONNECTION (0.670 - 0.770)
  // Entrance: 0.670 - 0.685 | Hold: 0.685 - 0.725 (4.0% hold) | Exit: 0.725 - 0.740
  // Quiet Interval: 0.740 - 0.770 (3.0% clear breathing space)
  // =========================================================================
  const accumLayerOpacity = useTransform(scrollYProgress, [0.670, 0.685, 0.725, 0.740], [0, 1, 1, 0]);
  const accumVisibility = useTransform(accumLayerOpacity, (o) => (o > 0.001 ? 'visible' : 'hidden'));
  const accumPointerEvents = useTransform(accumLayerOpacity, (o) => (o > 0.001 ? 'auto' : 'none'));

  const accumScale = useTransform(scrollYProgress, [0.670, 0.685, 0.725, 0.740], [0.97, 1, 1, 1.01]);
  const accumLineProgress = useTransform(scrollYProgress, [0.675, 0.705], [0, 1]);

  // =========================================================================
  // BEAT 8: THE REALIZATION (0.770 - 0.925)
  // Entrance 1: 0.770 - 0.785 | Entrance 2: 0.785 - 0.800
  // Hold: 0.800 - 0.850 (5.0% deliberate hold for "Different moments. One neighborhood.")
  // Exit: 0.850 - 0.865
  // - MAJOR NARRATIVE QUIET INTERVAL: 0.865 - 0.925 (6.0% largest cinematic breathing space before payoff)
  // =========================================================================
  const realLayerOpacity = useTransform(scrollYProgress, [0.770, 0.800, 0.850, 0.865], [0, 1, 1, 0]);
  const realVisibility = useTransform(realLayerOpacity, (o) => (o > 0.001 ? 'visible' : 'hidden'));
  const realPointerEvents = useTransform(realLayerOpacity, (o) => (o > 0.001 ? 'auto' : 'none'));

  const real1Opacity = useTransform(scrollYProgress, [0.770, 0.785, 0.850, 0.865], [0, 1, 1, 0]);
  const real1Y = useTransform(scrollYProgress, [0.770, 0.785, 0.850, 0.865], [16, 0, 0, -16]);
  const real2Opacity = useTransform(scrollYProgress, [0.785, 0.800, 0.850, 0.865], [0, 1, 1, 0]);
  const real2Y = useTransform(scrollYProgress, [0.785, 0.800, 0.850, 0.865], [20, 0, 0, -16]);

  // =========================================================================
  // BEAT 9: FINAL PAYOFF - COORDINATE (0.925 - 1.000)
  // Deliberate entrance: 0.925 - 0.940 | Subtitle: 0.933 - 0.945
  // Climactic Settled Hold: 0.940 - 1.000
  // =========================================================================
  const coordLayerOpacity = useTransform(scrollYProgress, [0.925, 0.940, 1.000], [0, 1, 1]);
  const coordVisibility = useTransform(coordLayerOpacity, (o) => (o > 0.001 ? 'visible' : 'hidden'));
  const coordPointerEvents = useTransform(coordLayerOpacity, (o) => (o > 0.001 ? 'auto' : 'none'));

  const coordOpacity = useTransform(scrollYProgress, [0.925, 0.940, 1.000], [0, 1, 1]);
  const coordY = useTransform(scrollYProgress, [0.925, 0.940, 1.000], [20, 0, 0]);
  const coordScale = useTransform(scrollYProgress, [0.925, 0.940, 1.000], [0.98, 1, 1]);
  const coordLetterSpacing = useTransform(scrollYProgress, [0.925, 0.940, 1.000], ['0.24em', '0.18em', '0.18em']);
  const coordSubOpacity = useTransform(scrollYProgress, [0.933, 0.945, 1.000], [0, 0.85, 0.85]);
  const coordSubY = useTransform(scrollYProgress, [0.933, 0.945, 1.000], [12, 0, 0]);

  return (
    <section
      className="community-moments-section"
      id="moments"
      ref={sectionRef}
      aria-label="Community Coordination: How a neighborhood discovers it can help itself"
    >
      <div className="community-moments-sticky">
        <div className="community-stage">
          {/* ==============================================================
              MOMENT 01: RESOURCE (WHEELCHAIR)
              Spatial Dialogue: Center-left Need -> Offset lower-right Response
              ============================================================== */}
          <motion.div
            className="moment-layer moment-01-layer"
            style={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: m1LayerOpacity,
                    visibility: m1Visibility,
                    pointerEvents: m1PointerEvents,
                  }
            }
          >
            <div className="moment-dialogue dialogue-offset-right">
              {/* Need */}
              <motion.div
                className="moment-need-block"
                style={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: m1NeedOpacity,
                        y: m1NeedY,
                      }
                }
              >
                <div className="moment-editorial-tag">
                  <span className="tag-dot" aria-hidden="true" />
                  <span className="tag-label">NEED</span>
                </div>
                <h3 className="moment-sentence moment-sentence-primary">
                  Does anyone have a wheelchair I can borrow?
                </h3>
              </motion.div>

              {/* Spatial connector line */}
              {!shouldReduceMotion && (
                <motion.div
                  className="moment-link-visual link-diagonal"
                  aria-hidden="true"
                  style={{ opacity: m1RespOpacity }}
                >
                  <svg className="link-svg" viewBox="0 0 160 56" fill="none">
                    <motion.path
                      d="M 12 12 C 60 12, 90 44, 148 44"
                      stroke="rgba(42, 111, 99, 0.3)"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      style={{ pathLength: m1LineProgress }}
                    />
                    <circle cx="12" cy="12" r="3" fill="var(--text-muted)" />
                    <circle cx="148" cy="44" r="3.5" fill="var(--teal-accent)" />
                  </svg>
                </motion.div>
              )}

              {/* Response */}
              <motion.div
                className="moment-response-block response-aligned-right"
                style={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: m1RespOpacity,
                        y: m1RespY,
                        x: m1RespX,
                      }
                }
              >
                <div className="moment-response-arrow" aria-hidden="true">
                  <span className="arrow-glyph">↳</span>
                </div>
                <p className="moment-sentence moment-sentence-response">
                  Yes. Block C, 2nd floor.
                </p>
              </motion.div>
            </div>
          </motion.div>

          {/* ==============================================================
              MOMENT 02: MEDICINE NEARBY
              Spatial Dialogue: Left Need -> Center-right Response
              ============================================================== */}
          <motion.div
            className="moment-layer moment-02-layer"
            style={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: m2LayerOpacity,
                    visibility: m2Visibility,
                    pointerEvents: m2PointerEvents,
                  }
            }
          >
            <div className="moment-dialogue dialogue-wide-left">
              {/* Need */}
              <motion.div
                className="moment-need-block need-left"
                style={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: m2NeedOpacity,
                        y: m2NeedY,
                        x: m2NeedX,
                      }
                }
              >
                <div className="moment-editorial-tag">
                  <span className="tag-dot" aria-hidden="true" />
                  <span className="tag-label">NEED</span>
                </div>
                <h3 className="moment-sentence moment-sentence-primary">
                  I need medicine nearby.
                </h3>
              </motion.div>

              {/* Response */}
              <motion.div
                className="moment-response-block response-center-offset"
                style={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: m2RespOpacity,
                        y: m2RespY,
                        x: m2RespX,
                      }
                }
              >
                <div className="response-stem" aria-hidden="true" />
                <p className="moment-sentence moment-sentence-response">
                  I can help.
                </p>
              </motion.div>
            </div>
          </motion.div>

          {/* ==============================================================
              MOMENT 03: COMMUNITY MULTIPLIER (AC SERVICING)
              Spatial Dialogue: Single request -> Community response multiplier
              ============================================================== */}
          <motion.div
            className="moment-layer moment-03-layer"
            style={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: m3LayerOpacity,
                    visibility: m3Visibility,
                    pointerEvents: m3PointerEvents,
                  }
            }
          >
            <div className="moment-dialogue dialogue-centered">
              {/* Request */}
              <motion.div
                className="moment-need-block need-centered"
                style={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: m3NeedOpacity,
                        y: m3NeedY,
                      }
                }
              >
                <h3 className="moment-sentence moment-sentence-primary">
                  Anyone else needs AC servicing?
                </h3>
              </motion.div>

              {/* Multiplier reveal */}
              <motion.div
                className="moment-multiplier-block"
                style={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: m3RespOpacity,
                        scale: m3RespScale,
                        y: m3RespY,
                      }
                }
              >
                <div className="multiplier-value">12 homes.</div>
                <div className="multiplier-caption">
                  One person’s request becomes a community coordination.
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* ==============================================================
              MOMENT 04: LOCAL INFORMATION (GATE 2 FLOODED)
              Spatial Dialogue: Community awareness -> Immediate local route
              ============================================================== */}
          <motion.div
            className="moment-layer moment-04-layer"
            style={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: m4LayerOpacity,
                    visibility: m4Visibility,
                    pointerEvents: m4PointerEvents,
                  }
            }
          >
            <div className="moment-dialogue dialogue-split">
              {/* Information */}
              <motion.div
                className="moment-need-block info-left"
                style={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: m4NeedOpacity,
                        y: m4NeedY,
                      }
                }
              >
                <div className="moment-editorial-tag tag-info">
                  <span className="tag-dot dot-info" aria-hidden="true" />
                  <span className="tag-label">LOCAL INFORMATION</span>
                </div>
                <h3 className="moment-sentence moment-sentence-primary">
                  Road near Gate 2 is flooded.
                </h3>
              </motion.div>

              {/* Route response */}
              <motion.div
                className="moment-response-block response-route"
                style={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: m4RespOpacity,
                        y: m4RespY,
                        x: m4RespX,
                      }
                }
              >
                <div className="route-arrow-icon" aria-hidden="true">→</div>
                <p className="moment-sentence moment-sentence-response">
                  Use Gate 4 instead.
                </p>
              </motion.div>
            </div>
          </motion.div>

          {/* ==============================================================
              BEAT 6: ACCUMULATION & CONNECTION
              The separate moments connect into one neighborhood tapestry
              (Editorial, human, quiet hairline vectors — NO tech network look)
              ============================================================== */}
          <motion.div
            className="moment-layer accumulation-layer"
            style={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: accumLayerOpacity,
                    scale: accumScale,
                    visibility: accumVisibility,
                    pointerEvents: accumPointerEvents,
                  }
            }
          >
            <div className="accumulation-constellation">
              {/* Delicate SVG connecting lines to center nexus */}
              {!shouldReduceMotion && (
                <svg className="accumulation-lines-svg" viewBox="0 0 1000 600" fill="none" preserveAspectRatio="none">
                  {/* Top-left to center */}
                  <motion.path
                    d="M 260 140 Q 420 180, 500 300"
                    stroke="rgba(0, 0, 0, 0.08)"
                    strokeWidth="1.25"
                    strokeDasharray="3 3"
                    style={{ pathLength: accumLineProgress }}
                  />
                  {/* Top-right to center */}
                  <motion.path
                    d="M 740 140 Q 580 180, 500 300"
                    stroke="rgba(0, 0, 0, 0.08)"
                    strokeWidth="1.25"
                    strokeDasharray="3 3"
                    style={{ pathLength: accumLineProgress }}
                  />
                  {/* Bottom-left to center */}
                  <motion.path
                    d="M 260 460 Q 420 420, 500 300"
                    stroke="rgba(0, 0, 0, 0.08)"
                    strokeWidth="1.25"
                    strokeDasharray="3 3"
                    style={{ pathLength: accumLineProgress }}
                  />
                  {/* Bottom-right to center */}
                  <motion.path
                    d="M 740 460 Q 580 420, 500 300"
                    stroke="rgba(0, 0, 0, 0.08)"
                    strokeWidth="1.25"
                    strokeDasharray="3 3"
                    style={{ pathLength: accumLineProgress }}
                  />
                </svg>
              )}

              {/* Central nexus dot */}
              <div className="accumulation-nexus" aria-hidden="true">
                <span className="nexus-core" />
              </div>

              {/* Node 1: Wheelchair */}
              <div className="accum-node node-top-left">
                <span className="accum-node-type">RESOURCE</span>
                <span className="accum-node-need">Wheelchair needed</span>
                <span className="accum-node-resp">Block C, 2nd floor</span>
              </div>

              {/* Node 2: Medicine */}
              <div className="accum-node node-top-right">
                <span className="accum-node-type">CARE</span>
                <span className="accum-node-need">Medicine nearby</span>
                <span className="accum-node-resp">I can help</span>
              </div>

              {/* Node 3: Service */}
              <div className="accum-node node-bottom-left">
                <span className="accum-node-type">SERVICE</span>
                <span className="accum-node-need">AC servicing</span>
                <span className="accum-node-resp">12 homes grouped</span>
              </div>

              {/* Node 4: Knowledge */}
              <div className="accum-node node-bottom-right">
                <span className="accum-node-type">INFORMATION</span>
                <span className="accum-node-need">Gate 2 flooded</span>
                <span className="accum-node-resp">Use Gate 4</span>
              </div>
            </div>
          </motion.div>

          {/* ==============================================================
              BEAT 8: THE REALIZATION
              "Different moments. One neighborhood."
              ============================================================== */}
          <motion.div
            className="moment-layer realization-layer"
            style={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: realLayerOpacity,
                    visibility: realVisibility,
                    pointerEvents: realPointerEvents,
                  }
            }
          >
            <div className="realization-stage">
              <motion.div
                className="realization-line line-secondary"
                style={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: real1Opacity,
                        y: real1Y,
                      }
                }
              >
                Different moments.
              </motion.div>
              <motion.div
                className="realization-line line-primary"
                style={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: real2Opacity,
                        y: real2Y,
                      }
                }
              >
                One neighborhood.
              </motion.div>
            </div>
          </motion.div>

          {/* ==============================================================
              BEAT 9: FINAL PAYOFF — COORDINATE
              Large, confident, dominant, calm
              ============================================================== */}
          <motion.div
            className="moment-layer payoff-layer"
            style={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: coordLayerOpacity,
                    visibility: coordVisibility,
                    pointerEvents: coordPointerEvents,
                  }
            }
          >
            <div className="payoff-stage">
              <motion.h2
                className="payoff-word"
                style={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: coordOpacity,
                        y: coordY,
                        scale: coordScale,
                        letterSpacing: coordLetterSpacing,
                      }
                }
              >
                COORDINATE
              </motion.h2>
              <motion.p
                className="payoff-sub"
                style={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: coordSubOpacity,
                        y: coordSubY,
                      }
                }
              >
                People who can help are already around us.
              </motion.p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
