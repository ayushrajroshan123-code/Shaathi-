import * as THREE from 'three';

/**
 * Creates the restrained distant environment:
 * - Distant surrounding neighborhood silhouettes and stepped architectural massings
 * - Distant tree canopy lines
 * - Establishes scale, depth, and location without competing with the foreground.
 */

export function createBackground(materials) {
  const group = new THREE.Group();
  group.name = 'BackgroundGroup';

  // 1. Distant Architectural Massings / Stepped Skyline Volumes
  // Clean geometric building envelopes positioned at radius 65m - 105m
  const distantBuildings = [
    // North Skyline (Behind north lots)
    { x: -35, z: -75, w: 18, h: 14, d: 14, rot: 0.1 },
    { x: -12, z: -82, w: 22, h: 18, d: 16, rot: -0.05 },
    { x: 16, z: -76, w: 16, h: 12, d: 15, rot: 0.15 },
    { x: 42, z: -82, w: 20, h: 16, d: 18, rot: -0.1 },

    // North-West Skyline
    { x: -78, z: -45, w: 20, h: 15, d: 18, rot: 0.3 },
    { x: -84, z: -15, w: 24, h: 21, d: 20, rot: 0.2 },

    // North-East Skyline
    { x: 72, z: -48, w: 18, h: 13, d: 16, rot: -0.25 },
    { x: 80, z: -20, w: 22, h: 19, d: 18, rot: -0.15 },

    // South Skyline
    { x: -38, z: 78, w: 19, h: 13, d: 15, rot: -0.1 },
    { x: -10, z: 85, w: 25, h: 20, d: 18, rot: 0.08 },
    { x: 22, z: 78, w: 17, h: 15, d: 14, rot: -0.12 },
    { x: 48, z: 82, w: 21, h: 17, d: 16, rot: 0.18 },

    // South-West & South-East
    { x: -80, z: 42, w: 22, h: 17, d: 16, rot: -0.2 },
    { x: 78, z: 38, w: 20, h: 14, d: 15, rot: 0.15 },
  ];

  distantBuildings.forEach((b, idx) => {
    // Primary mass
    const bGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
    const mat = idx % 2 === 0 ? materials.distantBuilding : materials.distantBuildingAccent;
    const bMesh = new THREE.Mesh(bGeo, mat);
    bMesh.position.set(b.x, b.h / 2, b.z);
    bMesh.rotation.y = b.rot;
    bMesh.receiveShadow = true;
    group.add(bMesh);

    // Stepped upper tier / setback on taller masses
    if (b.h > 14) {
      const pGeo = new THREE.BoxGeometry(b.w * 0.65, 3.2, b.d * 0.65);
      const pMesh = new THREE.Mesh(pGeo, materials.distantBuildingAccent);
      pMesh.position.set(b.x, b.h + 1.6, b.z);
      pMesh.rotation.y = b.rot;
      group.add(pMesh);
    }
  });

  // 2. Distant Horizon Tree Canopy Line (Smooth architectural foliage)
  const distantTreeGeo = new THREE.IcosahedronGeometry(5.2, 2);
  const distantTrees = [
    // North ring
    { x: -50, z: -60 },
    { x: -38, z: -62 },
    { x: -24, z: -64 },
    { x: -8, z: -66 },
    { x: 8, z: -65 },
    { x: 24, z: -63 },
    { x: 40, z: -61 },
    { x: 55, z: -58 },

    // South ring
    { x: -52, z: 60 },
    { x: -36, z: 64 },
    { x: -20, z: 65 },
    { x: -4, z: 67 },
    { x: 12, z: 66 },
    { x: 28, z: 64 },
    { x: 44, z: 61 },
    { x: 58, z: 58 },

    // West & East flanks
    { x: -66, z: -35 },
    { x: -68, z: -10 },
    { x: -67, z: 15 },
    { x: -65, z: 38 },
    { x: 64, z: -32 },
    { x: 67, z: -8 },
    { x: 66, z: 18 },
    { x: 63, z: 36 },
  ];

  const distantTreeInst = new THREE.InstancedMesh(distantTreeGeo, materials.distantTreeFoliage, distantTrees.length);
  const dummy = new THREE.Object3D();

  distantTrees.forEach((t, i) => {
    dummy.position.set(t.x, 3.6, t.z);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    const s = 0.85 + Math.random() * 0.35;
    dummy.scale.set(s * 1.3, s * 0.9, s * 1.2);
    dummy.updateMatrix();
    distantTreeInst.setMatrixAt(i, dummy.matrix);
  });
  distantTreeInst.instanceMatrix.needsUpdate = true;
  group.add(distantTreeInst);

  // 3. Extended Ground Skirt
  const skirtGeo = new THREE.PlaneGeometry(320, 320);
  skirtGeo.rotateX(-Math.PI / 2);
  const skirtMesh = new THREE.Mesh(skirtGeo, materials.mainLawn);
  skirtMesh.position.y = -0.15;
  skirtMesh.receiveShadow = true;
  group.add(skirtMesh);

  return group;
}
