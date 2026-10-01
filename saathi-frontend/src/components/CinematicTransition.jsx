import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

export default function CinematicTransition() {
  const containerRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Inset animates from a contained rounded window to full bleed
  const clipPath = useTransform(
    scrollYProgress,
    [0, 1],
    ["inset(15% 5% 15% 5% round 32px)", "inset(0% 0% 0% 0% round 0px)"]
  );

  // Text can subtly scale/fade in as the window opens
  const textOpacity = useTransform(scrollYProgress, [0.2, 0.8], [0, 1]);
  const textY = useTransform(scrollYProgress, [0.2, 0.8], [20, 0]);

  return (
    <section ref={containerRef} className="cinematic-transition-container">
      <div className="cinematic-sticky-stage">
        <motion.div 
          className="cinematic-reveal-window"
          style={{
            clipPath: shouldReduceMotion ? 'inset(0% 0% 0% 0% round 0px)' : clipPath,
            WebkitClipPath: shouldReduceMotion ? 'inset(0% 0% 0% 0% round 0px)' : clipPath
          }}
        >
          <div className="cinematic-content">
            <motion.h2 
              className="cinematic-statement"
              style={{
                opacity: shouldReduceMotion ? 1 : textOpacity,
                y: shouldReduceMotion ? 0 : textY
              }}
            >
              Everyday care meets<br />real coordination.
            </motion.h2>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
