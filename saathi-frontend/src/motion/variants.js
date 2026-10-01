/**
 * SAATHI Motion System — Core Curves, Durations & Framer Motion Variants
 *
 * Exact Asset Dimensions & Visible Fingertip Geometry:
 *
 * Left Hand PNG (public/assets/left_hand.png):
 *   Width: 696px, Height: 768px
 *   Fingertip: X = 695 (rightmost column), Y = 390
 *   Normalized Y: 390 / 768 = 50.78125% from top of image
 *   Normalized X: 695 / 696 = 99.856% (essentially right edge)
 *
 * Right Hand PNG (public/assets/right_hand.png):
 *   Width: 678px, Height: 768px
 *   Fingertip: X = 1 (leftmost non-transparent column), Y = 381
 *   Normalized Y: 381 / 768 = 49.609375% from top of image
 *   Normalized X: 1 / 678 = 0.147% (essentially left edge)
 *
 * Vertical Alignment:
 *   Delta Y = (390 - 381) / 768 = 9 / 768 ≈ 1.171875% of stage height.
 *   Applying `top: calc(9 / 768 * 100%)` to the right hand image ensures
 *   both fingertips meet on the EXACT same horizontal plane (Y = 50.78%)
 *   at all viewport heights.
 *
 * Horizontal Alignment:
 *   Left hand wrapper is anchored at `right: 50%` (right edge at viewport center).
 *   Right hand wrapper is anchored at `left: 50%` (left edge at viewport center).
 *   At x = 0vw, the left fingertip (x=695) and right fingertip (x=1) meet at the
 *   exact center line of the viewport with a natural 0–2px visual gap.
 *
 * Master Sequence:
 *   0.00s - 0.15s: EMPTY HERO (Hands offscreen at -100vw / 100vw, text hidden)
 *   0.15s - 2.00s: APPROACH (Smooth continuous deceleration into center, v -> 0 at contact)
 *   2.00s - 2.30s: STILL HOLD (300ms deliberate motionless contact hold at 0vw)
 *   2.30s - 4.00s: RETREAT (Smooth acceleration outward, exiting viewport completely)
 *   2.40s+:        TEXT REVEAL (Triggers as hands separate, appearing in the space between)
 */

export const EASING = {
  cinematic: [0.16, 1, 0.3, 1], // Smooth Apple/editorial deceleration
  approach: [0.16, 1, 0.3, 1],  // Starts fast, decelerates to velocity 0 at contact
  retreat: [0.35, 0, 0.25, 1],  // Gentle start from 0 velocity, smooth outward acceleration
};

export const DURATIONS = {
  heroSequence: 4.00,
};

// --------------------------------------------------------------------------
// 01. Left Hand Master Keyframes
// Strict Invariant: Opacity = 1 ALWAYS. No scale, no rotate, no blur, no fade.
// Segment 1 (0.00 - 0.15s): Hold offscreen
// Segment 2 (0.15 - 2.00s): Continuous deceleration curve (v -> 0 at contact)
// Segment 3 (2.00 - 2.30s): 300ms motionless hold at 0vw
// Segment 4 (2.30 - 4.00s): Smooth separation outward to clean exit
// --------------------------------------------------------------------------
export const leftHandVariants = {
  hidden: {
    x: '-100vw',
  },
  animate: {
    x: [
      '-100vw', // 0.00s: Off-screen left (canvas completely empty)
      '-100vw', // 0.15s: Hold offscreen for clean initial frame
      '0vw',    // 2.00s: Soft contact at center (velocity smoothly reaches 0)
      '0vw',    // 2.30s: Contact hold (300ms motionless connection)
      '-100vw', // 4.00s: Completely outside viewport
    ],
    transition: {
      duration: DURATIONS.heroSequence,
      times: [0, 0.0375, 0.50, 0.575, 1.0],
      ease: [
        'linear',        // 0.00s - 0.15s: Hold offscreen
        EASING.approach, // 0.15s - 2.00s: Smooth continuous deceleration into soft contact
        'linear',        // 2.00s - 2.30s: Motionless hold
        EASING.retreat,  // 2.30s - 4.00s: Smooth separation accelerating outward
      ],
    },
  },
};

// --------------------------------------------------------------------------
// 02. Right Hand Master Keyframes
// Strict Invariant: Opacity = 1 ALWAYS. Symmetrical positive positional travel.
// --------------------------------------------------------------------------
export const rightHandVariants = {
  hidden: {
    x: '100vw',
  },
  animate: {
    x: [
      '100vw',  // 0.00s: Off-screen right (canvas completely empty)
      '100vw',  // 0.15s: Hold offscreen for clean initial frame
      '0vw',    // 2.00s: Soft contact at center (velocity smoothly reaches 0)
      '0vw',    // 2.30s: Contact hold (300ms motionless connection)
      '100vw',  // 4.00s: Completely outside viewport
    ],
    transition: {
      duration: DURATIONS.heroSequence,
      times: [0, 0.0375, 0.50, 0.575, 1.0],
      ease: [
        'linear',        // 0.00s - 0.15s: Hold offscreen
        EASING.approach, // 0.15s - 2.00s: Smooth continuous deceleration into soft contact
        'linear',        // 2.00s - 2.30s: Motionless hold
        EASING.retreat,  // 2.30s - 4.00s: Smooth separation accelerating outward
      ],
    },
  },
};

// --------------------------------------------------------------------------
// 03. Hero Headline Solid ('SAATHI')
// Emerges first in the space between separating hands.
// --------------------------------------------------------------------------
export const heroHeadlineSolidVariants = {
  hidden: {
    opacity: 0,
    y: 16,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      delay: 0.0,
      ease: EASING.cinematic,
    },
  },
};

// --------------------------------------------------------------------------
// 04. Hero Headline Muted ('care that finds you')
// Follows 'SAATHI' as hands continue separating.
// --------------------------------------------------------------------------
export const heroHeadlineMutedVariants = {
  hidden: {
    opacity: 0,
    y: 14,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      delay: 0.15,
      ease: EASING.cinematic,
    },
  },
};

// --------------------------------------------------------------------------
// 05. Hero Eyebrow Reveal ('COMMUNITY, CONNECTED')
// --------------------------------------------------------------------------
export const heroEyebrowVariants = {
  hidden: {
    opacity: 0,
    y: 10,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.60,
      delay: 0.28,
      ease: EASING.cinematic,
    },
  },
};

// --------------------------------------------------------------------------
// 06. Hero Copy Reveal (Supporting Paragraph)
// --------------------------------------------------------------------------
export const heroCopyVariants = {
  hidden: {
    opacity: 0,
    y: 14,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      delay: 0.40,
      ease: EASING.cinematic,
    },
  },
};

// --------------------------------------------------------------------------
// 07. Hero Actions CTA Reveal
// --------------------------------------------------------------------------
export const heroActionsVariants = {
  hidden: {
    opacity: 0,
    y: 14,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      delay: 0.52,
      ease: EASING.cinematic,
    },
  },
};

// --------------------------------------------------------------------------
// 08. Micro Message (ASK · SHARE · RESPOND · COORDINATE)
// --------------------------------------------------------------------------
export const microMessageVariants = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.70,
      delay: 0.65,
      ease: 'easeOut',
    },
  },
};

// --------------------------------------------------------------------------
// 09. Reduced Motion Fallbacks (Immediate, accessible display, no hands motion)
// --------------------------------------------------------------------------
export const reducedLeftHandVariants = {
  hidden: { x: '-100vw' },
  animate: {
    x: '-100vw',
    transition: { duration: 0.01 },
  },
};

export const reducedRightHandVariants = {
  hidden: { x: '100vw' },
  animate: {
    x: '100vw',
    transition: { duration: 0.01 },
  },
};

export const reducedMotionVariants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.01 } },
  animate: { opacity: 1, y: 0, transition: { duration: 0.01 } },
};
