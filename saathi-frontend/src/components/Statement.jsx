import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

export default function Statement() {
  const sectionRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  // Scroll-linked editorial typography reveal
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 85%', 'center 50%'],
  });

  const line1Opacity = useTransform(scrollYProgress, [0, 0.6], [0.35, 1]);
  const line1Y = useTransform(scrollYProgress, [0, 0.6], [18, 0]);

  const line2Opacity = useTransform(scrollYProgress, [0.25, 0.9], [0.15, 1]);
  const line2Y = useTransform(scrollYProgress, [0.25, 0.9], [22, 0]);
  const line2Tracking = useTransform(scrollYProgress, [0.25, 0.9], ['-0.02em', '-0.035em']);

  return (
    <section className="statement-section" id="statement" ref={sectionRef}>
      <div className="statement-container">
        <p className="statement-text">
          <motion.span
            className="statement-line-1 active-dark"
            id="statementLine1"
            style={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: line1Opacity,
                    y: line1Y,
                    display: 'inline-block',
                  }
            }
          >
            SAATHI — where everyday care
          </motion.span>
          <motion.span
            className="statement-line-2"
            style={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: line2Opacity,
                    y: line2Y,
                    letterSpacing: line2Tracking,
                    display: 'inline-block',
                  }
            }
          >
            meets real coordination.
          </motion.span>
        </p>
      </div>
    </section>
  );
}
