import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASING } from '../motion/variants';

export default function Philosophy() {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
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
    <section className="section philosophy-section" id="philosophy">
      <motion.div
        className="section-container philosophy-container"
        initial={shouldReduceMotion ? false : "hidden"}
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={containerVariants}
      >
        <blockquote className="philosophy-quote">
          “Strong communities already contain people willing to help, resources waiting to be shared, and local knowledge. SAATHI gives those pieces a structure to work together.”
        </blockquote>

        <div className="philosophy-tags">
          <span className="pill-tag">COMMUNITY-FIRST</span>
          <span className="pill-tag">PRIVACY-AWARE</span>
          <span className="pill-tag">HUMAN-CENTERED</span>
          <span className="pill-tag">BUILT TO SCALE</span>
        </div>
      </motion.div>
    </section>
  );
}
