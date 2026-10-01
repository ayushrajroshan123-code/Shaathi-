import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASING } from '../motion/variants';

export default function Trust() {
  const shouldReduceMotion = useReducedMotion();

  const trustVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (custom) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.65,
        ease: EASING.cinematic,
        delay: custom * 0.12,
      },
    }),
  };

  return (
    <section className="section trust-section" id="trust">
      <div className="section-container">
        <div className="section-header">
          <div className="section-eyebrow">DESIGN INVARIANTS</div>
          <h2 className="section-heading">BUILT AROUND TRUST.</h2>
        </div>

        <div className="trust-grid">
          {/* Card 1 */}
          <motion.article
            className="trust-card"
            initial={shouldReduceMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            custom={0}
            variants={trustVariants}
          >
            <div className="trust-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <h3 className="trust-title">VERIFIED</h3>
            <p className="trust-desc">
              Community participation can use approval and verification mechanisms.
            </p>
          </motion.article>

          {/* Card 2 */}
          <motion.article
            className="trust-card"
            initial={shouldReduceMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            custom={1}
            variants={trustVariants}
          >
            <div className="trust-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 className="trust-title">PRIVACY-AWARE</h3>
            <p className="trust-desc">
              Access to information can be controlled according to the user's role and context.
            </p>
          </motion.article>

          {/* Card 3 */}
          <motion.article
            className="trust-card"
            initial={shouldReduceMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            custom={2}
            variants={trustVariants}
          >
            <div className="trust-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
            <h3 className="trust-title">ACCOUNTABLE</h3>
            <p className="trust-desc">
              Structured workflows help communities coordinate actions and requests.
            </p>
          </motion.article>
        </div>
      </div>
    </section>
  );
}
