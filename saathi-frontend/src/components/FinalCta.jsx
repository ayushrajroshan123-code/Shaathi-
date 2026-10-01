import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASING } from '../motion/variants';

export default function FinalCta({ onOpenModal }) {
  const shouldReduceMotion = useReducedMotion();

  const ctaVariants = {
    hidden: { opacity: 0, y: 22 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        ease: EASING.cinematic,
      },
    },
  };

  return (
    <section className="section final-cta-section" id="join">
      <motion.div
        className="section-container final-cta-container"
        initial={shouldReduceMotion ? false : "hidden"}
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={ctaVariants}
      >
        <h2 className="cta-headline">
          <span>Your community is already here.</span>
          <span className="cta-headline-sub">Give it a way to coordinate.</span>
        </h2>

        <div className="cta-buttons">
          <button
            type="button"
            className="btn-primary cta-btn"
            id="ctaJoinBtn"
            onClick={onOpenModal}
          >
            JOIN YOUR COMMUNITY
          </button>
          <a href="#how-it-works" className="btn-secondary cta-btn">
            SEE HOW IT WORKS
          </a>
        </div>
      </motion.div>
    </section>
  );
}
