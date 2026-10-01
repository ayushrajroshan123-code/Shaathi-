import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASING } from '../motion/variants';

export default function Moments() {
  const shouldReduceMotion = useReducedMotion();

  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.985 },
    visible: (custom) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.75,
        ease: EASING.cinematic,
        delay: custom * 0.12,
      },
    }),
  };

  return (
    <section className="section moments-section" id="moments">
      <div className="section-container">
        <div className="section-header">
          <div className="section-eyebrow">REAL PEOPLE. REAL NEEDS.</div>
          <h2 className="section-heading">Communities already help each other.</h2>
          <p className="section-supporting">
            SAATHI gives those everyday moments a structure to connect, respond, and coordinate.
          </p>
        </div>

        {/* 4 Physical Editorial Overlapping Cards */}
        <div className="cards-stage" aria-label="Illustrative community coordination situations">
          {/* Card 01 */}
          <motion.article
            className="editorial-card card-01"
            tabIndex={0}
            initial={shouldReduceMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            custom={0}
            variants={cardVariants}
          >
            <div className="card-meta">
              <span className="card-label">MEDICINE</span>
              <span className="card-status status-requested">HELP REQUESTED</span>
            </div>
            <p className="card-quote">“Can someone pick up my medicine?”</p>
            <div className="card-footer">
              <span className="card-context">Flat 402 · Needs collection by 6:00 PM</span>
            </div>
          </motion.article>

          {/* Card 02 */}
          <motion.article
            className="editorial-card card-02"
            tabIndex={0}
            initial={shouldReduceMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            custom={1}
            variants={cardVariants}
          >
            <div className="card-meta">
              <span className="card-label">ACCESSIBILITY</span>
              <span className="card-status status-shared">RESOURCE SHARED</span>
            </div>
            <p className="card-quote">“Wheelchair available for anyone who needs it.”</p>
            <div className="card-footer">
              <span className="card-context">Wing B · Verified equipment</span>
            </div>
          </motion.article>

          {/* Card 03 */}
          <motion.article
            className="editorial-card card-03"
            tabIndex={0}
            initial={shouldReduceMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            custom={2}
            variants={cardVariants}
          >
            <div className="card-meta">
              <span className="card-label">COMMUNITY SERVICE</span>
              <span className="card-status status-group">GROUP REQUEST</span>
            </div>
            <p className="card-quote">“12 residents need AC servicing this weekend.”</p>
            <div className="card-footer">
              <span className="card-context">Shared vendor coordination</span>
            </div>
          </motion.article>

          {/* Card 04 */}
          <motion.article
            className="editorial-card card-04"
            tabIndex={0}
            initial={shouldReduceMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            custom={3}
            variants={cardVariants}
          >
            <div className="card-meta">
              <span className="card-label">COMMUNITY UPDATE</span>
              <span className="card-status status-update">COMMUNITY UPDATE</span>
            </div>
            <p className="card-quote">“Flooding reported near the north entrance.”</p>
            <div className="card-footer">
              <span className="card-context">Verified resident report · 12 min ago</span>
            </div>
          </motion.article>
        </div>

        {/* Built for Communities */}
        <div className="community-types-block">
          <span className="types-label">BUILT FOR COMMUNITIES</span>
          <div className="types-row">
            <span className="type-item">RESIDENTIAL COMMUNITIES</span>
            <span className="type-separator" aria-hidden="true">·</span>
            <span className="type-item">COLLEGES</span>
            <span className="type-separator" aria-hidden="true">·</span>
            <span className="type-item">LOCAL HUBS</span>
          </div>
        </div>
      </div>
    </section>
  );
}
