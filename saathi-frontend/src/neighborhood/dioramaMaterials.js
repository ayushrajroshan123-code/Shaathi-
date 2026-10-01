import * as THREE from 'three';

/**
 * dioramaMaterials.js
 * Stage 2A Visual Polish: Cheerful European toy town / cozy architectural miniature palette.
 * - Soft, saturated pastel walls (cream, peach, blush, powder blue, warm ivory trim)
 * - Cheerful slate blue roofs (#4A6D9C) replacing dark navy/grey
 * - Vivid meadow green grass (#67C63F and #86D95A)
 * - Soft warm asphalt (#54585F) and warm limestone sidewalks (#EFE9DE)
 * - Satin/matte physical textures (roughness: 0.6 - 0.85, metalness: 0.0) with glossy toy accents on vehicles
 */

export function createDioramaMaterials() {
  return {
    // -------------------------------------------------------------------------
    // DIORAMA PLATFORM & BASE
    // -------------------------------------------------------------------------
    platformBase: new THREE.MeshStandardMaterial({
      color: 0xfaf9f5,
      roughness: 0.45,
      metalness: 0.02,
    }),
    platformBevel: new THREE.MeshStandardMaterial({
      color: 0xf0eee7,
      roughness: 0.4,
      metalness: 0.02,
    }),
    platformSide: new THREE.MeshStandardMaterial({
      color: 0xe6e2d8,
      roughness: 0.5,
      metalness: 0.02,
    }),
    shadowPlane: new THREE.ShadowMaterial({
      opacity: 0.16,
    }),

    // -------------------------------------------------------------------------
    // GROUND, ROADS & INFRASTRUCTURE
    // -------------------------------------------------------------------------
    grassLawn: new THREE.MeshStandardMaterial({
      color: 0x54bf2a, // Fresh, cheerful vibrant meadow green matching reference
      roughness: 0.72,
      metalness: 0.0,
    }),
    grassLightPatch: new THREE.MeshStandardMaterial({
      color: 0x78d440, // Cheerful sunlight meadow patch
      roughness: 0.74,
      metalness: 0.0,
    }),
    grassBorder: new THREE.MeshStandardMaterial({
      color: 0x42a01e,
      roughness: 0.78,
      metalness: 0.0,
    }),
    asphalt: new THREE.MeshStandardMaterial({
      color: 0x3a3f47, // Deep warm charcoal asphalt with rich contrast
      roughness: 0.82,
      metalness: 0.02,
    }),
    curb: new THREE.MeshStandardMaterial({
      color: 0xd8d0c2, // Warm limestone curb
      roughness: 0.65,
      metalness: 0.02,
    }),
    sidewalk: new THREE.MeshStandardMaterial({
      color: 0xede6da, // Warm European sidewalk pavers
      roughness: 0.68,
      metalness: 0.01,
    }),
    sidewalkJoint: new THREE.MeshStandardMaterial({
      color: 0xcfc8ba,
      roughness: 0.88,
      metalness: 0.0,
    }),
    roadMarkingWhite: new THREE.MeshStandardMaterial({
      color: 0xfffaf0, // Crisp warm off-white road markings
      roughness: 0.38,
      metalness: 0.02,
    }),
    crosswalkWhite: new THREE.MeshStandardMaterial({
      color: 0xfffaf0,
      roughness: 0.40,
      metalness: 0.02,
    }),

    // -------------------------------------------------------------------------
    // ARCHITECTURAL WALL FACADES (Warm Saturation & Pastels)
    // -------------------------------------------------------------------------
    wallIvory: new THREE.MeshStandardMaterial({
      color: 0xf7eedc, // Warm Biscuit Cream
      roughness: 0.62,
      metalness: 0.0,
    }),
    wallPeach: new THREE.MeshStandardMaterial({
      color: 0xf5ceab, // Warm Soft Peach
      roughness: 0.62,
      metalness: 0.0,
    }),
    wallSand: new THREE.MeshStandardMaterial({
      color: 0xebdcc4, // Warm Sand Cream
      roughness: 0.65,
      metalness: 0.0,
    }),
    wallBlush: new THREE.MeshStandardMaterial({
      color: 0xefbeaf, // Warm Pastel Blush
      roughness: 0.64,
      metalness: 0.0,
    }),
    wallWhite: new THREE.MeshStandardMaterial({
      color: 0xfffaf0, // Crisp warm architectural trim
      roughness: 0.48,
      metalness: 0.0,
    }),
    wallPowderBlue: new THREE.MeshStandardMaterial({
      color: 0x7aa4be, // Rich Cornflower/Powder Blue
      roughness: 0.58,
      metalness: 0.0,
    }),
    wallTerracotta: new THREE.MeshStandardMaterial({
      color: 0xe27a58, // Terracotta Accent
      roughness: 0.68,
      metalness: 0.0,
    }),

    // -------------------------------------------------------------------------
    // ROOFS (Slate Blue Authority Palette)
    // -------------------------------------------------------------------------
    roofSlateTeal: new THREE.MeshStandardMaterial({
      color: 0x325573, // Main rich slate blue from reference
      roughness: 0.44,
      metalness: 0.04,
    }),
    roofSlateDark: new THREE.MeshStandardMaterial({
      color: 0x23405b, // Deep eave/ridge trim slate blue
      roughness: 0.48,
      metalness: 0.04,
    }),
    roofFascia: new THREE.MeshStandardMaterial({
      color: 0x3f6b8f, // Ridge cap & fascia accent
      roughness: 0.42,
      metalness: 0.04,
    }),
    roofDeckWhite: new THREE.MeshStandardMaterial({
      color: 0xf5efe6, // Clean terrace deck
      roughness: 0.58,
      metalness: 0.0,
    }),

    // -------------------------------------------------------------------------
    // AWNINGS (Vibrant Primary & Secondary Stripes)
    // -------------------------------------------------------------------------
    awningRed: new THREE.MeshStandardMaterial({
      color: 0xde3f3f, // Cherry Red
      roughness: 0.50,
      metalness: 0.0,
    }),
    awningOrange: new THREE.MeshStandardMaterial({
      color: 0xf2862e, // Tangerine Orange
      roughness: 0.50,
      metalness: 0.0,
    }),
    awningGreen: new THREE.MeshStandardMaterial({
      color: 0x28b09f, // Bright Emerald/Teal Green
      roughness: 0.50,
      metalness: 0.0,
    }),
    awningWhite: new THREE.MeshStandardMaterial({
      color: 0xfffaf0, // Warm Cream White Stripe
      roughness: 0.50,
      metalness: 0.0,
    }),

    // -------------------------------------------------------------------------
    // WINDOWS & GLASS (Deep Contrast & Warm Interior Options)
    // -------------------------------------------------------------------------
    windowFrame: new THREE.MeshStandardMaterial({
      color: 0xfffaf0, // Crisp bright white architectural casing
      roughness: 0.38,
      metalness: 0.01,
    }),
    windowFrameWood: new THREE.MeshStandardMaterial({
      color: 0x8a5836, // Warm wood casing & sill
      roughness: 0.58,
      metalness: 0.0,
    }),
    windowFrameTeal: new THREE.MeshStandardMaterial({
      color: 0x2a5975, // Rich teal storefront frame
      roughness: 0.42,
      metalness: 0.02,
    }),
    glassSkyReflect: new THREE.MeshStandardMaterial({
      color: 0x386082, // Crisp cool Nordic slate teal-blue glass (high contrast, zero white blowout)
      roughness: 0.32,
      metalness: 0.02,
      transparent: false,
      opacity: 1.0,
      envMapIntensity: 0.08,
    }),
    glassWarmInterior: new THREE.MeshStandardMaterial({
      color: 0xf2a65a, // Warm glowing evening interior amber/peach glass
      roughness: 0.42,
      metalness: 0.0,
      emissive: 0x331c08,
      emissiveIntensity: 0.35,
    }),
    glassDark: new THREE.MeshStandardMaterial({
      color: 0x14222e, // Deep shadow-box glass
      roughness: 0.70,
      metalness: 0.0,
    }),
    windowInteriorBacking: new THREE.MeshStandardMaterial({
      color: 0x101820, // Deep dark shadow-box backing cavity
      roughness: 0.95,
      metalness: 0.0,
    }),
    windowSill: new THREE.MeshStandardMaterial({
      color: 0xf0eee7, // Crisp limestone projecting sill
      roughness: 0.46,
      metalness: 0.01,
    }),
    windowDisplayPlant: new THREE.MeshStandardMaterial({
      color: 0x2e8532, // Foliage for tiny sill/counter plant silhouettes
      roughness: 0.65,
      metalness: 0.0,
    }),

    // -------------------------------------------------------------------------
    // DOORS & ARCHITECTURAL ACCENTS
    // -------------------------------------------------------------------------
    doorWood: new THREE.MeshStandardMaterial({
      color: 0x5a3922,
      roughness: 0.62,
      metalness: 0.0,
    }),
    doorTeal: new THREE.MeshStandardMaterial({
      color: 0x2f6a88,
      roughness: 0.48,
      metalness: 0.04,
    }),
    doorRed: new THREE.MeshStandardMaterial({
      color: 0xc83e34,
      roughness: 0.52,
      metalness: 0.02,
    }),
    doorFrame: new THREE.MeshStandardMaterial({
      color: 0xe8e2d5,
      roughness: 0.48,
      metalness: 0.02,
    }),
    chimneyBrick: new THREE.MeshStandardMaterial({
      color: 0xc45a42,
      roughness: 0.82,
      metalness: 0.0,
    }),
    chimneyStone: new THREE.MeshStandardMaterial({
      color: 0x9ca4ac,
      roughness: 0.68,
      metalness: 0.04,
    }),
    smokeWhite: new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.85,
    }),

    // -------------------------------------------------------------------------
    // WOOD & STRUCTURAL TRIM
    // -------------------------------------------------------------------------
    woodNatural: new THREE.MeshStandardMaterial({
      color: 0xc89355,
      roughness: 0.72,
      metalness: 0.0,
    }),
    woodDark: new THREE.MeshStandardMaterial({
      color: 0x6b4728,
      roughness: 0.72,
      metalness: 0.0,
    }),
    woodFence: new THREE.MeshStandardMaterial({
      color: 0xd9a66c,
      roughness: 0.78,
      metalness: 0.0,
    }),

    // -------------------------------------------------------------------------
    // METALS
    // -------------------------------------------------------------------------
    metalDark: new THREE.MeshStandardMaterial({
      color: 0x2e3238,
      roughness: 0.38,
      metalness: 0.55,
    }),
    metalSilver: new THREE.MeshStandardMaterial({
      color: 0xbac5d2,
      roughness: 0.32,
      metalness: 0.75,
    }),
    metalBrass: new THREE.MeshStandardMaterial({
      color: 0xdca845,
      roughness: 0.28,
      metalness: 0.82,
    }),

    // -------------------------------------------------------------------------
    // LANDSCAPING, TREES & FLORA
    // -------------------------------------------------------------------------
    treeTrunk: new THREE.MeshStandardMaterial({
      color: 0x855333,
      roughness: 0.84,
      metalness: 0.0,
    }),
    treeFoliageLight: new THREE.MeshStandardMaterial({
      color: 0x86d95a, // Soft bright apple green canopy
      roughness: 0.78,
      metalness: 0.0,
    }),
    treeFoliageMid: new THREE.MeshStandardMaterial({
      color: 0x67c63f, // Rich fresh lime canopy
      roughness: 0.8,
      metalness: 0.0,
    }),
    bushDark: new THREE.MeshStandardMaterial({
      color: 0x489626,
      roughness: 0.82,
      metalness: 0.0,
    }),
    flowerPink: new THREE.MeshStandardMaterial({
      color: 0xf4789b,
      roughness: 0.55,
      metalness: 0.0,
    }),
    flowerRed: new THREE.MeshStandardMaterial({
      color: 0xe53935,
      roughness: 0.55,
      metalness: 0.0,
    }),
    flowerYellow: new THREE.MeshStandardMaterial({
      color: 0xfbc02d,
      roughness: 0.55,
      metalness: 0.0,
    }),
    flowerPurple: new THREE.MeshStandardMaterial({
      color: 0xab47bc,
      roughness: 0.55,
      metalness: 0.0,
    }),

    // -------------------------------------------------------------------------
    // VEHICLES (Controlled Satin/Gloss Toy Miniature Finish)
    // -------------------------------------------------------------------------
    vehicleRed: new THREE.MeshStandardMaterial({
      color: 0xe04040,
      roughness: 0.28,
      metalness: 0.12,
    }),
    vehicleWhite: new THREE.MeshStandardMaterial({
      color: 0xfaf8f5,
      roughness: 0.28,
      metalness: 0.12,
    }),
    vehicleCyan: new THREE.MeshStandardMaterial({
      color: 0x2bb5e8,
      roughness: 0.28,
      metalness: 0.12,
    }),
    vehicleYellow: new THREE.MeshStandardMaterial({
      color: 0xf7c130,
      roughness: 0.28,
      metalness: 0.12,
    }),
    vehiclePink: new THREE.MeshStandardMaterial({
      color: 0xf48eb0,
      roughness: 0.3,
      metalness: 0.08,
    }),
    vehicleMint: new THREE.MeshStandardMaterial({
      color: 0x5ec8a5,
      roughness: 0.28,
      metalness: 0.12,
    }),
    vehicleAmbulanceBlue: new THREE.MeshStandardMaterial({
      color: 0x2266aa,
      roughness: 0.32,
      metalness: 0.08,
    }),
    vehicleAmbulanceYellow: new THREE.MeshStandardMaterial({
      color: 0xf5b822,
      roughness: 0.32,
      metalness: 0.08,
    }),
    vehicleTire: new THREE.MeshStandardMaterial({
      color: 0x2c2e33,
      roughness: 0.82,
      metalness: 0.08,
    }),
    vehicleRim: new THREE.MeshStandardMaterial({
      color: 0xdce4ec,
      roughness: 0.25,
      metalness: 0.65,
    }),
    vehicleWindow: new THREE.MeshStandardMaterial({
      color: 0x486b80,
      roughness: 0.14,
      metalness: 0.42,
    }),
    vehicleHeadlight: new THREE.MeshStandardMaterial({
      color: 0xfffae6,
      emissive: 0xfff0b3,
      emissiveIntensity: 0.65,
      roughness: 0.18,
    }),
    vehicleTaillight: new THREE.MeshStandardMaterial({
      color: 0xe53935,
      emissive: 0xd32f2f,
      emissiveIntensity: 0.45,
      roughness: 0.18,
    }),

    // -------------------------------------------------------------------------
    // THE CENTRAL CAT FEATURE
    // -------------------------------------------------------------------------
    catWhite: new THREE.MeshStandardMaterial({
      color: 0xfefefe,
      roughness: 0.32,
      metalness: 0.01,
    }),
    catPink: new THREE.MeshStandardMaterial({
      color: 0xff9ebb,
      roughness: 0.38,
      metalness: 0.0,
    }),
    catBlack: new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 0.25,
      metalness: 0.05,
    }),

    // -------------------------------------------------------------------------
    // STREET FURNITURE & MICRO-PROPS
    // -------------------------------------------------------------------------
    umbrellaPink: new THREE.MeshStandardMaterial({
      color: 0xf4789b,
      roughness: 0.52,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
    lampGlow: new THREE.MeshStandardMaterial({
      color: 0xfffaee,
      emissive: 0xfffaee,
      emissiveIntensity: 0.8,
      roughness: 0.18,
    }),
    signRed: new THREE.MeshStandardMaterial({
      color: 0xd63333,
      roughness: 0.42,
      metalness: 0.02,
    }),
    signWhite: new THREE.MeshStandardMaterial({
      color: 0xfffaf0,
      roughness: 0.42,
      metalness: 0.02,
    }),
    vehicleOrange: new THREE.MeshStandardMaterial({
      color: 0xf2762a,
      roughness: 0.3,
      metalness: 0.1,
    }),
    riderHelmet: new THREE.MeshStandardMaterial({
      color: 0x3b79a8,
      roughness: 0.32,
      metalness: 0.1,
    }),
    riderJacket: new THREE.MeshStandardMaterial({
      color: 0xdf8472,
      roughness: 0.58,
      metalness: 0.0,
    }),
  };
}
