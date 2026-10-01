import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  heroEyebrowVariants,
  heroHeadlineSolidVariants,
  heroHeadlineMutedVariants,
  heroCopyVariants,
  heroActionsVariants,
  reducedMotionVariants,
} from '../motion/variants';

export default function HeroCopy({ onOpenModal, showCopy }) {
  const shouldReduceMotion = useReducedMotion();
  const animationState = (shouldReduceMotion || showCopy) ? 'visible' : 'hidden';

  const eyebrowMotion = shouldReduceMotion ? reducedMotionVariants : heroEyebrowVariants;
  const solidMotion = shouldReduceMotion ? reducedMotionVariants : heroHeadlineSolidVariants;
  const mutedMotion = shouldReduceMotion ? reducedMotionVariants : heroHeadlineMutedVariants;
  const copyMotion = shouldReduceMotion ? reducedMotionVariants : heroCopyVariants;
  const actionsMotion = shouldReduceMotion ? reducedMotionVariants : heroActionsVariants;

  return (
    <div className="hero-content">
      <motion.div
        className="hero-eyebrow"
        initial="hidden"
        animate={animationState}
        variants={eyebrowMotion}
      >
        COMMUNITY, CONNECTED
      </motion.div>

      <h1 className="hero-headline">
        <motion.span
          className="headline-solid"
          initial="hidden"
          animate={animationState}
          variants={solidMotion}
        >
          SAATHI
        </motion.span>
        <motion.span
          className="headline-muted"
          initial="hidden"
          animate={animationState}
          variants={mutedMotion}
        >
          care that finds you
        </motion.span>
      </h1>

      <motion.p
        className="hero-copy"
        initial="hidden"
        animate={animationState}
        variants={copyMotion}
      >
        A community coordination layer for everyday help, shared resources, and the moments that need people to act together.
      </motion.p>

      <motion.div
        className="hero-actions"
        initial="hidden"
        animate={animationState}
        variants={actionsMotion}
      >
        <button
          type="button"
          className="btn-primary hero-btn"
          id="heroJoinBtn"
          onClick={onOpenModal}
        >
          JOIN YOUR COMMUNITY
        </button>
        <a href="#how-it-works" className="btn-secondary hero-btn">
          SEE HOW IT WORKS
        </a>
      </motion.div>
    </div>
  );
}
