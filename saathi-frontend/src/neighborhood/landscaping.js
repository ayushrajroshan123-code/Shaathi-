import * as THREE from 'three';

/**
 * Creates the neighborhood landscaping:
 * - High-fidelity architectural tree system with 5 distinct archetypes:
 *   1. Mature broad-canopy oak/maple
 *   2. Slim street linden/elm
 *   3. Birch/aspen accent tree
 *   4. Ornamental flowering blossom tree
 *   5. Residential garden tree / magnolia
 * - Realistic multi-segment tapered trunks with actual 3D branching structures
 * - Multi-layer asymmetric foliage clouds with internal shadowing
 * - Layered shrubbery, manicured hedges, and perennial flower beds
 */

// Deterministic pseudo-random number generator for consistent natural variations
function createPRNG(seed = 12345) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function createLandscaping(materials) {
  const group = new THREE.Group();
  group.name = 'LandscapingGroup';

  const rand = createPRNG(42);

  // 1. REUSABLE SHARED GEOMETRIES
  // Shared foliage cluster shapes (smooth architectural volumes with slight organic asymmetry)
  const clusterGeoLg = new THREE.DodecahedronGeometry(1.6, 1);
  const clusterGeoMed = new THREE.DodecahedronGeometry(1.15, 1);
  const clusterGeoSm = new THREE.DodecahedronGeometry(0.8, 1);
  const clusterGeoMini = new THREE.DodecahedronGeometry(0.55, 1);

  // Shrub & Hedge shapes
  const shrubGeoMed = new THREE.DodecahedronGeometry(0.7, 1);
  const shrubGeoSm = new THREE.DodecahedronGeometry(0.48, 1);
  const flowerGeo = new THREE.DodecahedronGeometry(0.26, 1);

  // =========================================================================
  // TREE ARCHETYPE BUILDERS
  // =========================================================================

  // ARCHETYPE 1: Mature Broad-Canopy Tree (Oak / Maple)
  function buildMatureCanopyTree(x, z, scale = 1.0, seed = 1) {
    const tree = new THREE.Group();
    tree.position.set(x, 0.15, z);
    const r = createPRNG(seed);
    const rotY = r() * Math.PI * 2;
    tree.rotation.y = rotY;

    const s = scale * (0.92 + r() * 0.16);
    tree.scale.set(s, s, s);

    // Main Tapered Trunk
    const trunkH = 2.4 + r() * 0.4;
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.42, trunkH, 10);
    const trunk = new THREE.Mesh(trunkGeo, materials.treeBarkOak);
    trunk.position.y = trunkH / 2;
    trunk.rotation.z = (r() - 0.5) * 0.08;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    // 3 to 4 Structural Climbing Branches
    const numBranches = 3 + Math.floor(r() * 2);
    const branchAngles = [0.1, 1.8, 3.6, 5.0];

    for (let i = 0; i < numBranches; i++) {
      const bAngle = branchAngles[i % 4] + (r() - 0.5) * 0.4;
      const bPitch = 0.55 + r() * 0.35; // Angle from vertical
      const bLen = 2.2 + r() * 0.6;
      const bGeo = new THREE.CylinderGeometry(0.1, 0.2, bLen, 8);

      const branch = new THREE.Group();
      branch.position.set(0, trunkH * 0.85, 0);
      branch.rotation.y = bAngle;
      branch.rotation.z = bPitch;

      const branchMesh = new THREE.Mesh(bGeo, materials.treeBarkBranch);
      branchMesh.position.y = bLen / 2;
      branchMesh.castShadow = true;
      branchMesh.receiveShadow = true;
      branch.add(branchMesh);
      tree.add(branch);

      // Foliage clusters supported by this branch
      const tipX = Math.sin(bAngle) * Math.sin(bPitch) * bLen;
      const tipZ = Math.cos(bAngle) * Math.sin(bPitch) * bLen;
      const tipY = trunkH * 0.85 + Math.cos(bPitch) * bLen;

      // Lower/Inner shadow cluster
      const shadowCluster = new THREE.Mesh(clusterGeoMed, materials.treeFoliageDeep);
      shadowCluster.position.set(tipX * 0.75, tipY - 0.4, tipZ * 0.75);
      shadowCluster.scale.set(1.1, 0.8, 1.1);
      shadowCluster.castShadow = true;
      shadowCluster.receiveShadow = true;
      tree.add(shadowCluster);

      // Main canopy cluster
      const mainCluster = new THREE.Mesh(clusterGeoLg, materials.treeFoliageCanopy);
      mainCluster.position.set(tipX, tipY, tipZ);
      mainCluster.scale.set(1.15 + r() * 0.2, 0.85 + r() * 0.2, 1.1 + r() * 0.2);
      mainCluster.castShadow = true;
      mainCluster.receiveShadow = true;
      tree.add(mainCluster);

      // Top sunlit accent cluster
      const sunCluster = new THREE.Mesh(clusterGeoMed, materials.treeFoliageSunlit);
      sunCluster.position.set(tipX * 0.85, tipY + 0.65, tipZ * 0.85);
      sunCluster.scale.set(0.95, 0.75, 0.95);
      sunCluster.castShadow = true;
      sunCluster.receiveShadow = true;
      tree.add(sunCluster);
    }

    // Central Dome Foliage Crown (ties all branches together naturally)
    const centralCrown = new THREE.Mesh(clusterGeoLg, materials.treeFoliageCanopy);
    centralCrown.position.set(0, trunkH + 1.8, 0);
    centralCrown.scale.set(1.4, 1.05, 1.35);
    centralCrown.castShadow = true;
    centralCrown.receiveShadow = true;
    tree.add(centralCrown);

    const centralSunCap = new THREE.Mesh(clusterGeoMed, materials.treeFoliageSunlit);
    centralSunCap.position.set(0.2, trunkH + 2.7, -0.2);
    centralSunCap.scale.set(1.1, 0.85, 1.05);
    centralSunCap.castShadow = true;
    centralSunCap.receiveShadow = true;
    tree.add(centralSunCap);

    return tree;
  }

  // ARCHETYPE 2: Slim Street Tree (Linden / Elm for sidewalk verges)
  function buildSlimStreetTree(x, z, scale = 1.0, seed = 2) {
    const tree = new THREE.Group();
    tree.position.set(x, 0.15, z);
    const r = createPRNG(seed);
    tree.rotation.y = r() * Math.PI * 2;

    const s = scale * (0.95 + r() * 0.12);
    tree.scale.set(s, s, s);

    // Slender upright trunk
    const trunkH = 2.6 + r() * 0.3;
    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, trunkH, 8);
    const trunk = new THREE.Mesh(trunkGeo, materials.treeBarkWarm);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    // 3 Upright high branches
    for (let i = 0; i < 3; i++) {
      const bAngle = (i * 2.1) + (r() - 0.5) * 0.3;
      const bPitch = 0.32 + r() * 0.18; // Narrow angle
      const bLen = 1.8 + r() * 0.3;
      const bGeo = new THREE.CylinderGeometry(0.07, 0.12, bLen, 6);

      const branch = new THREE.Group();
      branch.position.set(0, trunkH * 0.88, 0);
      branch.rotation.y = bAngle;
      branch.rotation.z = bPitch;

      const branchMesh = new THREE.Mesh(bGeo, materials.treeBarkBranch);
      branchMesh.position.y = bLen / 2;
      branchMesh.castShadow = true;
      branch.add(branchMesh);
      tree.add(branch);

      const tipX = Math.sin(bAngle) * Math.sin(bPitch) * bLen;
      const tipZ = Math.cos(bAngle) * Math.sin(bPitch) * bLen;
      const tipY = trunkH * 0.88 + Math.cos(bPitch) * bLen;

      const foliage = new THREE.Mesh(clusterGeoMed, materials.treeFoliageCanopy);
      foliage.position.set(tipX, tipY, tipZ);
      foliage.scale.set(0.9, 1.25, 0.9); // Slender vertical profile
      foliage.castShadow = true;
      foliage.receiveShadow = true;
      tree.add(foliage);
    }

    // Tall central spire crown
    const centralGeo = new THREE.Mesh(clusterGeoLg, materials.treeFoliageCanopy);
    centralGeo.position.set(0, trunkH + 1.6, 0);
    centralGeo.scale.set(0.95, 1.5, 0.95);
    centralGeo.castShadow = true;
    centralGeo.receiveShadow = true;
    tree.add(centralGeo);

    const topCap = new THREE.Mesh(clusterGeoSm, materials.treeFoliageSunlit);
    topCap.position.set(0, trunkH + 2.8, 0);
    topCap.scale.set(0.85, 1.1, 0.85);
    topCap.castShadow = true;
    topCap.receiveShadow = true;
    tree.add(topCap);

    return tree;
  }

  // ARCHETYPE 3: Birch / Aspen Accent Tree
  function buildBirchTree(x, z, scale = 1.0, seed = 3) {
    const tree = new THREE.Group();
    tree.position.set(x, 0.15, z);
    const r = createPRNG(seed);
    tree.rotation.y = r() * Math.PI * 2;

    const s = scale * (0.95 + r() * 0.15);
    tree.scale.set(s, s, s);

    // Thin pale silvery trunk
    const trunkH = 2.8 + r() * 0.4;
    const trunkGeo = new THREE.CylinderGeometry(0.09, 0.16, trunkH, 8);
    const trunk = new THREE.Mesh(trunkGeo, materials.treeBarkBirch);
    trunk.position.y = trunkH / 2;
    trunk.rotation.z = (r() - 0.5) * 0.1;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    // Delicate airy birch branches
    for (let i = 0; i < 4; i++) {
      const bAngle = i * 1.55 + (r() - 0.5) * 0.3;
      const bPitch = 0.4 + r() * 0.25;
      const bLen = 1.6 + r() * 0.4;
      const bGeo = new THREE.CylinderGeometry(0.05, 0.09, bLen, 6);

      const branch = new THREE.Group();
      branch.position.set(0, trunkH * (0.65 + i * 0.1), 0);
      branch.rotation.y = bAngle;
      branch.rotation.z = bPitch;

      const branchMesh = new THREE.Mesh(bGeo, materials.treeBarkBirch);
      branchMesh.position.y = bLen / 2;
      branchMesh.castShadow = true;
      branch.add(branchMesh);
      tree.add(branch);

      const tipX = Math.sin(bAngle) * Math.sin(bPitch) * bLen;
      const tipZ = Math.cos(bAngle) * Math.sin(bPitch) * bLen;
      const tipY = trunkH * (0.65 + i * 0.1) + Math.cos(bPitch) * bLen;

      const foliage = new THREE.Mesh(clusterGeoMed, materials.treeFoliageBirch);
      foliage.position.set(tipX, tipY, tipZ);
      foliage.scale.set(0.9, 0.8, 0.9);
      foliage.castShadow = true;
      foliage.receiveShadow = true;
      tree.add(foliage);
    }

    const crown = new THREE.Mesh(clusterGeoMed, materials.treeFoliageBirch);
    crown.position.set(0, trunkH + 1.2, 0);
    crown.scale.set(1.0, 1.2, 1.0);
    crown.castShadow = true;
    crown.receiveShadow = true;
    tree.add(crown);

    return tree;
  }

  // ARCHETYPE 4: Ornamental Flowering Blossom Tree
  function buildFloweringTree(x, z, scale = 1.0, seed = 4) {
    const tree = new THREE.Group();
    tree.position.set(x, 0.15, z);
    const r = createPRNG(seed);
    tree.rotation.y = r() * Math.PI * 2;

    const s = scale * (0.92 + r() * 0.15);
    tree.scale.set(s, s, s);

    // Sculptural dark branching trunk
    const trunkH = 1.6 + r() * 0.3;
    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.24, trunkH, 8);
    const trunk = new THREE.Mesh(trunkGeo, materials.treeBarkOak);
    trunk.position.y = trunkH / 2;
    trunk.rotation.z = (r() - 0.5) * 0.15;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    // 3 Spreading sculptural blossom branches
    for (let i = 0; i < 3; i++) {
      const bAngle = i * 2.1 + (r() - 0.5) * 0.3;
      const bPitch = 0.65 + r() * 0.25; // Wide spread
      const bLen = 1.8 + r() * 0.4;
      const bGeo = new THREE.CylinderGeometry(0.08, 0.14, bLen, 6);

      const branch = new THREE.Group();
      branch.position.set(0, trunkH * 0.85, 0);
      branch.rotation.y = bAngle;
      branch.rotation.z = bPitch;

      const branchMesh = new THREE.Mesh(bGeo, materials.treeBarkOak);
      branchMesh.position.y = bLen / 2;
      branchMesh.castShadow = true;
      branch.add(branchMesh);
      tree.add(branch);

      const tipX = Math.sin(bAngle) * Math.sin(bPitch) * bLen;
      const tipZ = Math.cos(bAngle) * Math.sin(bPitch) * bLen;
      const tipY = trunkH * 0.85 + Math.cos(bPitch) * bLen;

      // Inner shadow petal cluster
      const inner = new THREE.Mesh(clusterGeoMed, materials.treeFoliageBlossomInner);
      inner.position.set(tipX * 0.8, tipY - 0.2, tipZ * 0.8);
      inner.scale.set(0.9, 0.7, 0.9);
      inner.castShadow = true;
      inner.receiveShadow = true;
      tree.add(inner);

      // Outer soft blossom cloud
      const blossom = new THREE.Mesh(clusterGeoLg, materials.treeFoliageBlossom);
      blossom.position.set(tipX, tipY, tipZ);
      blossom.scale.set(1.05, 0.8, 1.05);
      blossom.castShadow = true;
      blossom.receiveShadow = true;
      tree.add(blossom);
    }

    const centerBlossom = new THREE.Mesh(clusterGeoLg, materials.treeFoliageBlossom);
    centerBlossom.position.set(0, trunkH + 1.2, 0);
    centerBlossom.scale.set(1.15, 0.9, 1.15);
    centerBlossom.castShadow = true;
    centerBlossom.receiveShadow = true;
    tree.add(centerBlossom);

    return tree;
  }

  // ARCHETYPE 5: Smaller Residential Garden Tree (Magnolia / Japanese Maple)
  function buildGardenTree(x, z, scale = 1.0, seed = 5) {
    const tree = new THREE.Group();
    tree.position.set(x, 0.15, z);
    const r = createPRNG(seed);
    tree.rotation.y = r() * Math.PI * 2;

    const s = scale * (0.9 + r() * 0.15);
    tree.scale.set(s, s, s);

    const trunkH = 1.3 + r() * 0.25;
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.18, trunkH, 8);
    const trunk = new THREE.Mesh(trunkGeo, materials.treeBarkWarm);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    const crown = new THREE.Mesh(clusterGeoMed, materials.treeFoliageCanopy);
    crown.position.set(0, trunkH + 0.8, 0);
    crown.scale.set(1.1, 0.9, 1.1);
    crown.castShadow = true;
    crown.receiveShadow = true;
    tree.add(crown);

    const cap = new THREE.Mesh(clusterGeoSm, materials.treeFoliageSunlit);
    cap.position.set(0.15, trunkH + 1.35, -0.15);
    cap.scale.set(0.9, 0.75, 0.9);
    cap.castShadow = true;
    cap.receiveShadow = true;
    tree.add(cap);

    return tree;
  }

  // =========================================================================
  // TREE PLACEMENT ACROSS NEIGHBORHOOD
  // =========================================================================
  const treeList = [
    // North Sidewalk Verge Trees (Straight along avenue at z = -4.55m)
    { type: 'street', x: -36, z: -4.55, s: 1.05, seed: 101 },
    { type: 'street', x: -18, z: -4.55, s: 0.95, seed: 102 },
    { type: 'birch', x: 2, z: -4.55, s: 1.1, seed: 103 },
    { type: 'street', x: 20, z: -4.55, s: 1.0, seed: 104 },
    { type: 'blossom', x: 38, z: -4.55, s: 1.0, seed: 105 },

    // South Sidewalk Verge Trees (Straight along avenue at z = +4.55m)
    { type: 'birch', x: -34, z: 4.55, s: 1.0, seed: 201 },
    { type: 'street', x: -20, z: 4.55, s: 1.08, seed: 202 },
    { type: 'blossom', x: -6, z: 4.55, s: 0.95, seed: 203 },
    { type: 'street', x: 12, z: 4.55, s: 1.05, seed: 204 },

    // Mature Oak in Public Pocket Parklet (between Lot 1 and Lot 2)
    { type: 'mature', x: -15, z: -10.5, s: 1.35, seed: 301 },

    // Cul-de-sac Island Centerpiece Tree
    { type: 'birch', x: 26, z: 22.5, s: 1.15, seed: 302 },

    // Residential Garden Trees (inside front garden beds)
    { type: 'garden', x: -23.5, z: -10.2, s: 1.0, seed: 401 },
    { type: 'garden', x: 14.5, z: -10.2, s: 1.05, seed: 402 },
    { type: 'garden', x: -4.5, z: 10.2, s: 1.0, seed: 403 },

    // Lot Backyard / Rear Boundary Trees
    // North Lots Rear
    { type: 'mature', x: -31, z: -25.5, s: 1.1, seed: 501 },
    { type: 'birch', x: -17, z: -25.8, s: 0.95, seed: 502 },
    { type: 'blossom', x: -12, z: -26.0, s: 1.0, seed: 503 },
    { type: 'mature', x: 1, z: -25.8, s: 1.15, seed: 504 },
    { type: 'mature', x: 7, z: -26.0, s: 1.0, seed: 505 },
    { type: 'birch', x: 21, z: -25.5, s: 1.05, seed: 506 },

    // South Lots Rear
    { type: 'mature', x: -31, z: 25.8, s: 1.15, seed: 601 },
    { type: 'birch', x: -17, z: 25.5, s: 0.9, seed: 602 },
    { type: 'blossom', x: -12, z: 25.8, s: 1.05, seed: 603 },
    { type: 'mature', x: 1, z: 25.5, s: 1.1, seed: 604 },
    { type: 'birch', x: 8, z: 25.2, s: 1.0, seed: 605 },
    { type: 'mature', x: 21, z: 25.8, s: 1.15, seed: 606 },

    // Outer Perimeter Hillock Framing Trees
    { type: 'mature', x: -39, z: -32, s: 1.25, seed: 701 },
    { type: 'mature', x: 37, z: -30, s: 1.3, seed: 702 },
    { type: 'mature', x: -37, z: 34, s: 1.2, seed: 703 },
    { type: 'mature', x: 39, z: 32, s: 1.25, seed: 704 },
  ];

  treeList.forEach((t) => {
    let treeMesh;
    if (t.type === 'mature') {
      treeMesh = buildMatureCanopyTree(t.x, t.z, t.s, t.seed);
    } else if (t.type === 'street') {
      treeMesh = buildSlimStreetTree(t.x, t.z, t.s, t.seed);
    } else if (t.type === 'birch') {
      treeMesh = buildBirchTree(t.x, t.z, t.s, t.seed);
    } else if (t.type === 'blossom') {
      treeMesh = buildFloweringTree(t.x, t.z, t.s, t.seed);
    } else {
      treeMesh = buildGardenTree(t.x, t.z, t.s, t.seed);
    }
    group.add(treeMesh);
  });

  // =========================================================================
  // SHRUBS, HEDGES & PERENNIAL FLOWER BEDS
  // =========================================================================

  // Helper for layered shrub clumps
  function buildShrubClump(x, z, count = 3, scale = 1.0, mat = materials.shrubBoxwood) {
    const clump = new THREE.Group();
    clump.position.set(x, 0.16, z);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = 0.35 * scale;
      const s = (0.7 + rand() * 0.5) * scale;
      const bush = new THREE.Mesh(shrubGeoMed, mat);
      bush.position.set(Math.cos(angle) * dist, 0.45 * s, Math.sin(angle) * dist);
      bush.scale.set(s, s * 0.85, s);
      bush.castShadow = true;
      bush.receiveShadow = true;
      clump.add(bush);
    }
    return clump;
  }

  // Helper for layered perennial flower beds
  function buildFlowerBed(x, z, width = 3.6, depth = 1.6) {
    const bed = new THREE.Group();
    bed.position.set(x, 0.17, z);

    const rows = 3;
    const cols = Math.floor(width / 0.6);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = -width / 2 + (c + 0.5) * (width / cols) + (rand() - 0.5) * 0.15;
        const pz = -depth / 2 + (r + 0.5) * (depth / rows) + (rand() - 0.5) * 0.15;
        const mat = (r + c) % 3 === 0 ? materials.flowerLavender : materials.flowerWhite;
        const flower = new THREE.Mesh(flowerGeo, mat);
        const s = 0.8 + rand() * 0.4;
        flower.position.set(px, 0.22 * s, pz);
        flower.scale.set(s, s * 1.3, s);
        flower.castShadow = true;
        bed.add(flower);
      }
    }
    return bed;
  }

  // Shrub placements along front yard borders and sidewalks
  const shrubLocations = [
    { x: -33, z: -5.8, m: materials.shrubBoxwood },
    { x: -25, z: -5.8, m: materials.shrubSage },
    { x: -7, z: -5.8, m: materials.shrubOlive },
    { x: 10, z: -5.8, m: materials.shrubBoxwood },
    { x: 28, z: -5.8, m: materials.shrubDark },

    { x: -33, z: 5.8, m: materials.shrubSage },
    { x: -16, z: 5.8, m: materials.shrubBoxwood },
    { x: 4, z: 5.8, m: materials.shrubOlive },
    { x: 18, z: 5.8, m: materials.shrubBoxwood },

    // Pocket parklet lush hedges
    { x: -16.5, z: -9.0, m: materials.shrubBoxwood },
    { x: -12.5, z: -9.0, m: materials.shrubBoxwood },
    { x: -14.5, z: -12.2, m: materials.shrubDark },
  ];

  shrubLocations.forEach((loc) => {
    group.add(buildShrubClump(loc.x, loc.z, 3, 1.0, loc.m));
  });

  // Flower beds in lot front gardens
  const flowerBedLocations = [
    { x: -23.5, z: -10.2 },
    { x: -4.5, z: -10.2 },
    { x: 14.5, z: -10.2 },
    { x: -23.5, z: 10.2 },
    { x: -4.5, z: 10.2 },
    { x: 14.5, z: 10.2 },
  ];

  flowerBedLocations.forEach((loc) => {
    group.add(buildFlowerBed(loc.x, loc.z, 3.8, 1.4));
  });

  return group;
}
