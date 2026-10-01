import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * TwoModes — Phase 04: Normal Mode / Emergency Mode
 *
 * Restrained, minimalist editorial section on a full-bleed dark canvas:
 * - NORMAL MODE: "Everyday care, coordinated." (Share. Borrow. Check in.)
 * - Quiet, dignified visual transition
 * - EMERGENCY MODE: "When something changes, people can coordinate." (Medicine · Transport · Food · Accessibility)
 * - Subtle safety disclaimer: "SAATHI supports community coordination and does not replace professional emergency services."
 * - Minimalist motion: gentle viewport entrance only, no scroll-jacking.
 */
export default function TwoModes() {
  const shouldReduceMotion = useReducedMotion();

  const easeCinematic = [0.16, 1, 0.3, 1];

  return (
    <section className="two-modes-section" id="modes" aria-label="Two Modes of Coordination">
      <div className="two-modes-container">
        {/* ==============================================================
            01. NORMAL MODE
            ============================================================== */}
        <motion.div
          className="mode-editorial-block mode-normal"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.7, ease: easeCinematic }}
        >
          <div className="mode-eyebrow">
            <span className="mode-eyebrow-dot dot-normal" aria-hidden="true" />
            <span className="mode-eyebrow-text">NORMAL MODE</span>
          </div>

          <h2 className="mode-statement">
            Everyday care, coordinated.
          </h2>

          <p className="mode-secondary">
            Share. Borrow. Check in.
          </p>
        </motion.div>

        {/* ==============================================================
            02. QUIET EDITORIAL TRANSITION
            ============================================================== */}
        <div className="mode-transition" aria-hidden="true">
          <div className="mode-transition-line" />
        </div>

        {/* ==============================================================
            03. EMERGENCY MODE
            ============================================================== */}
        <motion.div
          className="mode-editorial-block mode-emergency"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.7, ease: easeCinematic }}
        >
          <div className="mode-eyebrow">
            <span className="mode-eyebrow-dot dot-emergency" aria-hidden="true" />
            <span className="mode-eyebrow-text text-emergency">EMERGENCY MODE</span>
          </div>

          <h2 className="mode-statement">
            When something changes, people can coordinate.
          </h2>

          <p className="mode-secondary secondary-emergency">
            Medicine <span className="dot-sep" aria-hidden="true">·</span> Transport <span className="dot-sep" aria-hidden="true">·</span> Food <span className="dot-sep" aria-hidden="true">·</span> Accessibility
          </p>
        </motion.div>

        {/* ==============================================================
            04. SAFETY DISCLAIMER
            ============================================================== */}
        <motion.p
          className="mode-safety-disclaimer"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.6, delay: shouldReduceMotion ? 0 : 0.15 }}
        >
          SAATHI supports community coordination and does not replace professional emergency services.
        </motion.p>
      </div>
    </section>
  );
}
