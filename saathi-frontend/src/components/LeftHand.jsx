import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { leftHandVariants, reducedLeftHandVariants } from '../motion/variants';

export default function LeftHand({ variants }) {
  const shouldReduceMotion = useReducedMotion();
  const activeVariants = variants || (shouldReduceMotion ? reducedLeftHandVariants : leftHandVariants);

  return (
    <motion.div
      className="hand-wrapper hand-left"
      initial="hidden"
      animate="animate"
      variants={activeVariants}
    >
      <img
        src="/assets/left_hand.png"
        alt="Isolated human left arm and hand reaching toward the center"
        className="hand-image left-img"
        loading="eager"
      />
    </motion.div>
  );
}
