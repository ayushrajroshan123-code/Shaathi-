import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASING } from '../motion/variants';

export default function ProductFacts() {
  const shouldReduceMotion = useReducedMotion();

  const facts = [
    { number: '2', label: 'MODES', sub: 'Normal + Emergency' },
    { number: '3', label: 'COMMUNITY TYPES', sub: 'Residential + College + Local' },
    { number: '1', label: 'COORDINATION LAYER', sub: 'Ask + Share + Respond' },
  ];

  const factVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: (custom) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: EASING.cinematic,
        delay: custom * 0.1,
      },
    }),
  };

  return (
    <section className="section facts-section">
      <div className="section-container">
        <div className="section-header center-header">
          <div className="section-eyebrow">BY DESIGN</div>
        </div>

        <div className="facts-grid">
          {facts.map((fact, idx) => (
            <motion.div
              key={fact.label}
              className="fact-item"
              initial={shouldReduceMotion ? false : "hidden"}
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              custom={idx}
              variants={factVariants}
            >
              <div className="fact-number">{fact.number}</div>
              <div className="fact-label">{fact.label}</div>
              <div className="fact-sub">{fact.sub}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
