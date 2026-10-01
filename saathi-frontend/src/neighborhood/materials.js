import * as THREE from 'three';

/**
 * Architectural visualization materials with procedural textures and physical properties.
 * Palette: warm, natural, desaturated, restrained.
 * Avoids cartoon/candy colors; achieves high-end physical miniature model aesthetics.
 */

function createNoiseTexture(width = 256, height = 256, baseColor = 128, variation = 20) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * variation;
    const val = Math.min(255, Math.max(0, baseColor + noise));
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createAsphaltTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Warm slate charcoal asphalt (architectural tone)
  ctx.fillStyle = '#36393e';
  ctx.fillRect(0, 0, 512, 512);

  // Fine basalt and silica aggregate specks
  for (let i = 0; i < 40000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const val = Math.floor(Math.random() * 26) - 13;
    ctx.fillStyle = `rgb(${54 + val}, ${57 + val}, ${62 + val})`;
    ctx.fillRect(x, y, Math.random() > 0.8 ? 2 : 1, Math.random() > 0.8 ? 2 : 1);
  }

  // Subtle clean traffic path tonal variation
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, 'rgba(48, 51, 56, 0.35)');
  grad.addColorStop(0.25, 'rgba(60, 63, 68, 0.18)');
  grad.addColorStop(0.5, 'rgba(50, 53, 58, 0.25)');
  grad.addColorStop(0.75, 'rgba(60, 63, 68, 0.18)');
  grad.addColorStop(1, 'rgba(48, 51, 56, 0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

function createConcreteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ded9d0';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle warm sand stippling
  for (let i = 0; i < 18000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = Math.floor(Math.random() * 24) - 12;
    ctx.fillStyle = `rgba(${210 + v}, ${205 + v}, ${196 + v}, 0.5)`;
    ctx.fillRect(x, y, 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

function createLawnTexture(isManicured = true) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Natural warm meadow green (warm architectural tone, desaturated, soft)
  ctx.fillStyle = isManicured ? '#68825a' : '#5c744f';
  ctx.fillRect(0, 0, 512, 512);

  // Natural turf fiber stippling
  for (let i = 0; i < 35000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const variation = Math.floor(Math.random() * 26) - 13;
    const r = Math.max(0, Math.min(255, 104 + variation * 0.8));
    const g = Math.max(0, Math.min(255, 130 + variation));
    const b = Math.max(0, Math.min(255, 90 + variation * 0.7));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Soft architectural lawn stripes
  if (isManicured) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let x = 0; x < 512; x += 32) {
      ctx.fillRect(x, 0, 16, 512);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  return texture;
}

function createPaverTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#c5bfb4';
  ctx.fillRect(0, 0, 256, 256);

  // Scored paver grid lines
  ctx.strokeStyle = 'rgba(80, 75, 70, 0.25)';
  ctx.lineWidth = 1.5;

  const tileSize = 32;
  for (let x = 0; x <= 256; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 8);
  return texture;
}

function createContactShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.1)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export function initMaterials() {
  const asphaltRoughness = createNoiseTexture(256, 256, 215, 35);
  const concreteRoughness = createNoiseTexture(256, 256, 195, 25);
  const asphaltMap = createAsphaltTexture();
  const concreteMap = createConcreteTexture();
  const lawnMap = createLawnTexture(true);
  const roughLawnMap = createLawnTexture(false);
  const paverMap = createPaverTexture();
  const contactShadowMap = createContactShadowTexture();

  return {
    // Base Architectural Model Plinth
    basePlinth: new THREE.MeshStandardMaterial({
      color: 0x23262a,
      roughness: 0.88,
      metalness: 0.1,
    }),
    plinthBevel: new THREE.MeshStandardMaterial({
      color: 0x30343a,
      roughness: 0.78,
      metalness: 0.15,
    }),

    // Ground & Grass Surfaces (Warm, natural, soft)
    mainLawn: new THREE.MeshStandardMaterial({
      color: 0x647e56,
      map: lawnMap,
      roughness: 0.94,
      metalness: 0.01,
    }),
    vergeLawn: new THREE.MeshStandardMaterial({
      color: 0x5a724d,
      map: roughLawnMap,
      roughness: 0.95,
      metalness: 0.01,
    }),
    manicuredLotLawn: new THREE.MeshStandardMaterial({
      color: 0x6a845c,
      map: lawnMap,
      roughness: 0.92,
      metalness: 0.01,
    }),
    gardenSoil: new THREE.MeshStandardMaterial({
      color: 0x3a2d20,
      roughness: 0.96,
      metalness: 0.02,
    }),

    // Roads & Pedestrian Surfaces
    asphalt: new THREE.MeshStandardMaterial({
      color: 0x383a40,
      map: asphaltMap,
      roughnessMap: asphaltRoughness,
      roughness: 0.84,
      metalness: 0.04,
    }),
    roadMarkingWhite: new THREE.MeshStandardMaterial({
      color: 0xf6f5f0,
      roughness: 0.76,
      metalness: 0.02,
    }),
    roadMarkingYellow: new THREE.MeshStandardMaterial({
      color: 0xe0b24d,
      roughness: 0.76,
      metalness: 0.02,
    }),
    curbConcrete: new THREE.MeshStandardMaterial({
      color: 0xd2cdc4,
      roughnessMap: concreteRoughness,
      roughness: 0.82,
      metalness: 0.03,
    }),
    sidewalkConcrete: new THREE.MeshStandardMaterial({
      color: 0xdcd6cb,
      map: concreteMap,
      roughnessMap: concreteRoughness,
      roughness: 0.82,
      metalness: 0.03,
    }),
    sidewalkJoint: new THREE.MeshStandardMaterial({
      color: 0xb5afa5,
      roughness: 0.9,
      metalness: 0.02,
    }),
    drivewayPavers: new THREE.MeshStandardMaterial({
      color: 0xc7c1b6,
      map: paverMap,
      roughness: 0.84,
      metalness: 0.04,
    }),
    gardenStone: new THREE.MeshStandardMaterial({
      color: 0xa49f96,
      roughness: 0.85,
      metalness: 0.06,
    }),

    // Architectural Trees & Trunks
    treeBarkOak: new THREE.MeshStandardMaterial({
      color: 0x4a3c32,
      roughness: 0.88,
      metalness: 0.02,
      flatShading: false,
    }),
    treeBarkBranch: new THREE.MeshStandardMaterial({
      color: 0x42362d,
      roughness: 0.86,
      metalness: 0.02,
      flatShading: false,
    }),
    treeBarkBirch: new THREE.MeshStandardMaterial({
      color: 0xe4e0d6,
      roughness: 0.78,
      metalness: 0.04,
      flatShading: false,
    }),
    treeBarkWarm: new THREE.MeshStandardMaterial({
      color: 0x5a483b,
      roughness: 0.85,
      metalness: 0.02,
      flatShading: false,
    }),

    // Multi-Layered Tree Foliage
    treeFoliageDeep: new THREE.MeshStandardMaterial({
      color: 0x33472a,
      roughness: 0.88,
      metalness: 0.01,
      flatShading: false,
    }),
    treeFoliageCanopy: new THREE.MeshStandardMaterial({
      color: 0x475e38,
      roughness: 0.82,
      metalness: 0.01,
      flatShading: false,
    }),
    treeFoliageSunlit: new THREE.MeshStandardMaterial({
      color: 0x5d7946,
      roughness: 0.78,
      metalness: 0.01,
      flatShading: false,
    }),
    treeFoliageBirch: new THREE.MeshStandardMaterial({
      color: 0x768e4c,
      roughness: 0.8,
      metalness: 0.01,
      flatShading: false,
    }),
    treeFoliageBlossom: new THREE.MeshStandardMaterial({
      color: 0xdfcbd0,
      roughness: 0.82,
      metalness: 0.01,
      flatShading: false,
    }),
    treeFoliageBlossomInner: new THREE.MeshStandardMaterial({
      color: 0xc8adb3,
      roughness: 0.85,
      metalness: 0.01,
      flatShading: false,
    }),

    // Shrubs & Hedges
    shrubBoxwood: new THREE.MeshStandardMaterial({
      color: 0x435a34,
      roughness: 0.82,
      metalness: 0.01,
      flatShading: false,
    }),
    shrubSage: new THREE.MeshStandardMaterial({
      color: 0x516b47,
      roughness: 0.86,
      metalness: 0.01,
      flatShading: false,
    }),
    shrubOlive: new THREE.MeshStandardMaterial({
      color: 0x627448,
      roughness: 0.86,
      metalness: 0.01,
      flatShading: false,
    }),
    shrubDark: new THREE.MeshStandardMaterial({
      color: 0x2e3f26,
      roughness: 0.88,
      metalness: 0.01,
      flatShading: false,
    }),
    flowerLavender: new THREE.MeshStandardMaterial({
      color: 0x827a9a,
      roughness: 0.82,
      metalness: 0.04,
      flatShading: false,
    }),
    flowerWhite: new THREE.MeshStandardMaterial({
      color: 0xe8e5df,
      roughness: 0.8,
      metalness: 0.04,
      flatShading: false,
    }),

    // Contemporary Street Lamps
    streetLampMetal: new THREE.MeshStandardMaterial({
      color: 0x232528,
      roughness: 0.35,
      metalness: 0.75,
    }),
    streetLampDiffuser: new THREE.MeshStandardMaterial({
      color: 0xfffdf5,
      roughness: 0.15,
      metalness: 0.05,
      emissive: 0xfffae6,
      emissiveIntensity: 0.95,
    }),
    streetLampBase: new THREE.MeshStandardMaterial({
      color: 0x1d1f22,
      roughness: 0.5,
      metalness: 0.6,
    }),

    // Street Furniture & Props
    cedarWood: new THREE.MeshStandardMaterial({
      color: 0x937356,
      roughness: 0.76,
      metalness: 0.03,
    }),
    darkBenchMetal: new THREE.MeshStandardMaterial({
      color: 0x232528,
      roughness: 0.45,
      metalness: 0.7,
    }),
    mailboxPost: new THREE.MeshStandardMaterial({
      color: 0x5e4c3d,
      roughness: 0.85,
      metalness: 0.04,
    }),
    mailboxBox: new THREE.MeshStandardMaterial({
      color: 0x2a3038,
      roughness: 0.42,
      metalness: 0.5,
    }),
    mailboxFlag: new THREE.MeshStandardMaterial({
      color: 0xc23b32,
      roughness: 0.4,
      metalness: 0.2,
    }),
    trashBinCharcoal: new THREE.MeshStandardMaterial({
      color: 0x2d3034,
      roughness: 0.55,
      metalness: 0.15,
    }),
    recycleBinBlue: new THREE.MeshStandardMaterial({
      color: 0x36587d,
      roughness: 0.55,
      metalness: 0.15,
    }),
    compostBinGreen: new THREE.MeshStandardMaterial({
      color: 0x3d613c,
      roughness: 0.55,
      metalness: 0.15,
    }),
    fireHydrantRed: new THREE.MeshStandardMaterial({
      color: 0xa83832,
      roughness: 0.42,
      metalness: 0.35,
    }),
    brassNut: new THREE.MeshStandardMaterial({
      color: 0xb2944f,
      roughness: 0.32,
      metalness: 0.82,
    }),
    castIronGrate: new THREE.MeshStandardMaterial({
      color: 0x222428,
      roughness: 0.68,
      metalness: 0.85,
    }),

    // Street Signage & Utilities
    streetSignPole: new THREE.MeshStandardMaterial({
      color: 0x2b2d30,
      roughness: 0.35,
      metalness: 0.75,
    }),
    streetSignBlade: new THREE.MeshStandardMaterial({
      color: 0x284738,
      roughness: 0.4,
      metalness: 0.1,
    }),
    streetSignText: new THREE.MeshStandardMaterial({
      color: 0xf5f5f0,
      roughness: 0.3,
      metalness: 0.05,
    }),
    streetSignWarning: new THREE.MeshStandardMaterial({
      color: 0xefb722,
      roughness: 0.35,
      metalness: 0.08,
    }),
    utilityCabinetGreen: new THREE.MeshStandardMaterial({
      color: 0x485c4c,
      roughness: 0.6,
      metalness: 0.2,
    }),

    // Architectural Vehicles (3 Archetypes with high-end automotive finishes)
    carPaintBlue: new THREE.MeshStandardMaterial({
      color: 0x2b445c,
      roughness: 0.24,
      metalness: 0.72,
    }),
    carPaintWarmSilver: new THREE.MeshStandardMaterial({
      color: 0xa8aeb4,
      roughness: 0.22,
      metalness: 0.8,
    }),
    carPaintForestGreen: new THREE.MeshStandardMaterial({
      color: 0x283d31,
      roughness: 0.26,
      metalness: 0.68,
    }),
    carPaintPearlWhite: new THREE.MeshStandardMaterial({
      color: 0xedeae1,
      roughness: 0.28,
      metalness: 0.35,
    }),
    carPaintGraphite: new THREE.MeshStandardMaterial({
      color: 0x36393e,
      roughness: 0.28,
      metalness: 0.65,
    }),
    carGlass: new THREE.MeshStandardMaterial({
      color: 0x141b22,
      roughness: 0.08,
      metalness: 0.92,
    }),
    carTrimBlack: new THREE.MeshStandardMaterial({
      color: 0x1c1e20,
      roughness: 0.75,
      metalness: 0.1,
    }),
    carHeadlight: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xdbe6f0,
      emissiveIntensity: 0.35,
      roughness: 0.12,
      metalness: 0.2,
    }),
    carTaillight: new THREE.MeshStandardMaterial({
      color: 0xb81d1d,
      emissive: 0x820d0d,
      emissiveIntensity: 0.4,
      roughness: 0.2,
      metalness: 0.2,
    }),
    carWheelAlloy: new THREE.MeshStandardMaterial({
      color: 0xd5d8db,
      roughness: 0.24,
      metalness: 0.85,
    }),
    carBrakeDisc: new THREE.MeshStandardMaterial({
      color: 0x4a4d52,
      roughness: 0.4,
      metalness: 0.85,
    }),
    carTireRubber: new THREE.MeshStandardMaterial({
      color: 0x1e2022,
      roughness: 0.9,
      metalness: 0.02,
    }),
    carPlate: new THREE.MeshStandardMaterial({
      color: 0xf8f8f5,
      roughness: 0.3,
      metalness: 0.05,
    }),
    carContactShadow: new THREE.MeshBasicMaterial({
      map: contactShadowMap,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    }),
    bicycleFrame: new THREE.MeshStandardMaterial({
      color: 0x486757,
      roughness: 0.38,
      metalness: 0.55,
    }),

    // Distant Background
    distantBuilding: new THREE.MeshStandardMaterial({
      color: 0xc4ced8,
      roughness: 0.88,
      metalness: 0.04,
    }),
    distantBuildingAccent: new THREE.MeshStandardMaterial({
      color: 0xb7c3cd,
      roughness: 0.85,
      metalness: 0.04,
    }),
    distantTreeFoliage: new THREE.MeshStandardMaterial({
      color: 0x7c947c,
      roughness: 0.92,
      metalness: 0.01,
      flatShading: false,
    }),
  };
}
