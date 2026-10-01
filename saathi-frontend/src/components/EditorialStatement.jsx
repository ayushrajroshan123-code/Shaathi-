import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

/**
 * EditorialStatement — Scene 02: Sequential Editorial Typography
 *
 * Sequence:
 *   1. Initial State (Progress 0.00 - 0.10):
 *      "A neighborhood is more than a place." is dominant (#111111, opacity 1, y 0).
 *      "It's people." is COMPLETELY HIDDEN (opacity 0, visibility hidden).
 *
 *   2. First Statement Exit (Progress 0.10 - 0.38):
 *      "A neighborhood is more than a place." gradually fades and moves up (opacity 1 -> 0, y 0 -> -20px).
 *      "It's people." remains completely invisible.
 *
 *   3. Silent Breathing Pause (Progress 0.38 - 0.54):
 *      First statement = 0 (completely gone, visibility hidden).
 *      Second statement = 0 (completely hidden, visibility hidden).
 *      Short visual separation / editorial silence between thoughts.
 *
 *   4. Second Statement Reveal (Progress 0.54 - 0.78):
 *      "It's people." rises into focal center (opacity 0 -> 1, y 20px -> 0).
 *      First statement remains completely invisible.
 *
 *   5. Final Settled State (Progress 0.78 - 1.00):
 *      "It's people." remains dominant until section naturally releases.
 */
export default function EditorialStatement() {
  const sectionRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  // Section-relative scroll progress (0.0 at top pin, 1.0 at bottom release)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Statement 1: "A neighborhood is more than a place."
  // Progress 0.00 - 0.10: Opacity 1.0, Y 0px
  // Progress 0.10 - 0.38: Opacity 1.0 -> 0.0, Y 0px -> -20px
  // Progress 0.38 - 1.00: Opacity 0.0, Y -20px
  const firstOpacity = useTransform(scrollYProgress, [0.0, 0.10, 0.38, 1.0], [1.0, 1.0, 0.0, 0.0]);
  const firstY = useTransform(scrollYProgress, [0.0, 0.10, 0.38, 1.0], [0, 0, -20, -20]);
  const firstVisibility = useTransform(firstOpacity, (v) => (v > 0.001 ? 'visible' : 'hidden'));

  // Statement 2: "It's people."
  // Progress 0.00 - 0.54: Opacity 0.0, Y 20px (COMPLETELY INVISIBLE during statement 1 and pause)
  // Progress 0.54 - 0.78: Opacity 0.0 -> 1.0, Y 20px -> 0px
  // Progress 0.78 - 1.00: Opacity 1.0, Y 0px
  const secondOpacity = useTransform(scrollYProgress, [0.0, 0.54, 0.78, 1.0], [0.0, 0.0, 1.0, 1.0]);
  const secondY = useTransform(scrollYProgress, [0.0, 0.54, 0.78, 1.0], [20, 20, 0, 0]);
  const secondVisibility = useTransform(secondOpacity, (v) => (v > 0.001 ? 'visible' : 'hidden'));

  const firstStyle = shouldReduceMotion
    ? { opacity: 1, transform: 'none', visibility: 'visible' }
    : { opacity: firstOpacity, y: firstY, visibility: firstVisibility };

  const secondStyle = shouldReduceMotion
    ? { opacity: 1, transform: 'none', visibility: 'visible' }
    : { opacity: secondOpacity, y: secondY, visibility: secondVisibility };

  return (
    <section
      className="editorial-statement-section"
      id="editorial-statement"
      ref={sectionRef}
      aria-label="Editorial statement: A neighborhood is more than a place. It's people."
    >
      <div className="editorial-sticky-stage">
        <div className="editorial-container">
          <div className="editorial-content">
            {/* Statement 1: "A neighborhood is more than a place." */}
            <motion.div
              className="editorial-primary"
              style={firstStyle}
            >
              <span className="editorial-phrase">A neighborhood</span>{' '}
              <span className="editorial-phrase">is more than a place.</span>
            </motion.div>

            {/* Statement 2: "It's people." (Appears sequentially after statement 1 disappears) */}
            <motion.div
              className="editorial-secondary"
              style={secondStyle}
            >
              <span className="editorial-accent">It’s people.</span>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
