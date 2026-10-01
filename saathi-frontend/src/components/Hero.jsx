import React, { useRef, useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import HeroCopy from './HeroCopy';
import LeftHand from './LeftHand';
import RightHand from './RightHand';
import {
  microMessageVariants,
  reducedMotionVariants,
  leftHandVariants,
  rightHandVariants,
  reducedLeftHandVariants,
  reducedRightHandVariants,
} from '../motion/variants';

export default function Hero({ onOpenModal }) {
  const heroRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  const [showCopy, setShowCopy] = useState(Boolean(shouldReduceMotion));

  useEffect(() => {
    if (shouldReduceMotion) {
      setShowCopy(true);
      return;
    }

    // Master Timeline Choreography:
    // 0.00s - 0.15s: Empty hero canvas
    // 0.15s - 2.00s: Hands approach center
    // 2.00s - 2.30s: Fingertips touch and hold still (300ms)
    // 2.30s: Hands begin separating smoothly
    // 2.40s: Hero text begins revealing in the space created between retreating hands
    const timer = setTimeout(() => {
      setShowCopy(true);
    }, 2400);

    return () => clearTimeout(timer);
  }, [shouldReduceMotion]);

  const microMotion = shouldReduceMotion ? reducedMotionVariants : microMessageVariants;
  const leftMotion = shouldReduceMotion ? reducedLeftHandVariants : leftHandVariants;
  const rightMotion = shouldReduceMotion ? reducedRightHandVariants : rightHandVariants;

  return (
    <section className="hero-section" id="hero" ref={heroRef}>
      <div className="hero-ambient-glow" aria-hidden="true" />

      {/* Layer 2: Hero Typography & CTAs (Revealed during separation) */}
      <HeroCopy onOpenModal={onOpenModal} showCopy={showCopy} />

      {/* Layer 10: Signature Hero Visual — Large Reaching Hands (Full-width shared stage) */}
      <div
        className="hero-visual-stage"
        aria-label="Two isolated human arms and hands entering from opposite sides, touching fingertips at the center, and retreating outward to reveal the SAATHI coordination platform"
      >
        <div className="hands-track">
          {/* Left Hand: Anchored at center right-edge, travels from offscreen to contact to retreat */}
          <LeftHand variants={leftMotion} />

          {/* Right Hand: Anchored at center left-edge, travels from offscreen to contact to retreat */}
          <RightHand variants={rightMotion} />
        </div>
      </div>

      {/* Micro Message */}
      <motion.div
        className="hero-micro-message"
        initial="hidden"
        animate={showCopy ? 'visible' : 'hidden'}
        variants={microMotion}
      >
        <span>ASK</span>
        <span className="bullet" aria-hidden="true">·</span>
        <span>SHARE</span>
        <span className="bullet" aria-hidden="true">·</span>
        <span>RESPOND</span>
        <span className="bullet" aria-hidden="true">·</span>
        <span>COORDINATE</span>
      </motion.div>
    </section>
  );
}
