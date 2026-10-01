import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { rightHandVariants, reducedRightHandVariants } from '../motion/variants';

export default function RightHand({ variants }) {
  const shouldReduceMotion = useReducedMotion();
  const activeVariants = variants || (shouldReduceMotion ? reducedRightHandVariants : rightHandVariants);

  return (
    <motion.div
      className="hand-wrapper hand-right"
      initial="hidden"
      animate="animate"
      variants={activeVariants}
    >
      <img
        src="/assets/right_hand.png"
        alt="Isolated human right arm and hand reaching toward the center"
        className="hand-image right-img"
        loading="eager"
      />
    </motion.div>
  );
}
