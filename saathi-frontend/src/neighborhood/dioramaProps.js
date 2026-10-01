import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * dioramaProps.js
 * Stage 2E Reference Reconstruction:
 * Strict reference fidelity matching media_1790591038989.png:
 *
 * - Reusable miniature post-and-rail wooden fences defining residential/garden property boundaries
 * - Stylized garden gates with posts, swinging leaves, Z-bracing, and stone thresholds
 * - Pedestrian garden paths of warm stone pavers leading from gates to front doors
 * - Multi-lobed stylized trees (fresh two-tone green canopies) with ZERO building collisions
 * - Sidewalk cafe seating, pink parasols, produce crates, street lamps, and lollipop sign
 * - Commercial frontages remain open and accessible to the public sidewalks
 */

export function createDioramaProps(materials) {
  const group = new THREE.Group();
  group.name = 'DioramaProps';

  // =========================================================================
  // 1. MULTI-LOBED TOY TOWN TREE BUILDER (3-4 rounded lobes, 2 green tones)
  // =========================================================================
  function createStylizedTree(radius = 1.25, height = 2.5) {
    const tree = new THREE.Group();

    // Base soil mound
    const baseGeo = new THREE.CylinderGeometry(0.45, 0.6, 0.08, 12);
    const base = new THREE.Mesh(baseGeo, materials.treeTrunk);
    base.position.y = 0.04;
    base.receiveShadow = true;
    tree.add(base);

    // Tapered smooth wooden trunk
    const trunkGeo = new THREE.CylinderGeometry(0.10, 0.16, height, 10);
    const trunk = new THREE.Mesh(trunkGeo, materials.treeTrunk);
    trunk.position.y = height / 2;
    trunk.castShadow = true;
    tree.add(trunk);

    // Canopy Group
    const canopyGroup = new THREE.Group();
    canopyGroup.position.y = height;

    // Lobe 1: Central main sphere
    const lobe1Geo = new THREE.SphereGeometry(radius, 16, 14);
    lobe1Geo.scale(1.0, 1.05, 1.0);
    const lobe1 = new THREE.Mesh(lobe1Geo, materials.treeFoliageMid);
    lobe1.position.set(0, radius * 0.85, 0);
    lobe1.castShadow = true;
    lobe1.receiveShadow = true;
    canopyGroup.add(lobe1);

    // Lobe 2: Top-left sunny lobe
    const lobe2Geo = new THREE.SphereGeometry(radius * 0.68, 14, 12);
    const lobe2 = new THREE.Mesh(lobe2Geo, materials.treeFoliageLight);
    lobe2.position.set(-radius * 0.38, radius * 1.15, -radius * 0.2);
    lobe2.castShadow = true;
    canopyGroup.add(lobe2);

    // Lobe 3: Top-right lobe
    const lobe3Geo = new THREE.SphereGeometry(radius * 0.65, 14, 12);
    const lobe3 = new THREE.Mesh(lobe3Geo, materials.treeFoliageLight);
    lobe3.position.set(radius * 0.38, radius * 0.95, radius * 0.25);
    lobe3.castShadow = true;
    canopyGroup.add(lobe3);

    // Lobe 4: Front accent lobe
    const lobe4Geo = new THREE.SphereGeometry(radius * 0.58, 12, 10);
    const lobe4 = new THREE.Mesh(lobe4Geo, materials.treeFoliageMid);
    lobe4.position.set(0.1, radius * 0.72, radius * 0.42);
    lobe4.castShadow = true;
    canopyGroup.add(lobe4);

    tree.add(canopyGroup);
    return tree;
  }

  // =========================================================================
  // 2. REUSABLE POST-AND-RAIL WOODEN FENCE BUILDER
  // =========================================================================
  function createPostAndRailFence(length, isAlongX = true) {
    const fenceGroup = new THREE.Group();
    const postHeight = 0.80;
    const postRadius = 0.05;
    const postSpacing = 1.35;
    const postCount = Math.max(2, Math.floor(length / postSpacing) + 1);
    const actualSpacing = length / (postCount - 1);

    // Posts with beveled pyramid top caps
    for (let i = 0; i < postCount; i++) {
      const postMesh = new THREE.Group();
      const pGeo = new THREE.CylinderGeometry(postRadius, postRadius * 1.05, postHeight, 8);
      const post = new THREE.Mesh(pGeo, materials.woodFence);
      post.position.y = postHeight / 2 - 0.04;
      post.castShadow = true;
      postMesh.add(post);

      const capGeo = new THREE.ConeGeometry(postRadius * 1.35, 0.07, 4);
      capGeo.rotateY(Math.PI / 4);
      const cap = new THREE.Mesh(capGeo, materials.woodFence);
      cap.position.y = postHeight - 0.04;
      cap.castShadow = true;
      postMesh.add(cap);

      const offset = (i - (postCount - 1) / 2) * actualSpacing;
      if (isAlongX) {
        postMesh.position.set(offset, 0, 0);
      } else {
        postMesh.position.set(0, 0, offset);
      }
      fenceGroup.add(postMesh);
    }

    // 2 Continuous rounded horizontal rails
    [0.26, 0.56].forEach((railY) => {
      const railGeo = new RoundedBoxGeometry(
        isAlongX ? length : 0.06,
        0.06,
        isAlongX ? 0.06 : length,
        2,
        0.015
      );
      const rail = new THREE.Mesh(railGeo, materials.woodFence);
      rail.position.y = railY;
      rail.castShadow = true;
      fenceGroup.add(rail);
    });

    return fenceGroup;
  }

  // =========================================================================
  // 3. REUSABLE GARDEN GATE BUILDER
  // =========================================================================
  function createGardenGate(width = 1.05, isAlongX = true) {
    const gateGroup = new THREE.Group();
    gateGroup.name = 'GardenGate';

    // Stone threshold step
    const stepW = isAlongX ? width + 0.26 : 0.42;
    const stepD = isAlongX ? 0.42 : width + 0.26;
    const threshold = new THREE.Mesh(
      new RoundedBoxGeometry(stepW, 0.035, stepD, 2, 0.015),
      materials.sidewalk
    );
    threshold.position.y = 0.018;
    threshold.receiveShadow = true;
    gateGroup.add(threshold);

    // Gate Posts on both sides
    const postH = 0.92;
    const postR = 0.07;
    [-width / 2, width / 2].forEach((offset) => {
      const pGeo = new THREE.CylinderGeometry(postR, postR * 1.1, postH, 8);
      const post = new THREE.Mesh(pGeo, materials.woodFence);
      post.position.set(isAlongX ? offset : 0, postH / 2 - 0.04, isAlongX ? 0 : offset);
      post.castShadow = true;
      gateGroup.add(post);

      const capGeo = new THREE.ConeGeometry(postR * 1.35, 0.09, 4);
      capGeo.rotateY(Math.PI / 4);
      const cap = new THREE.Mesh(capGeo, materials.woodFence);
      cap.position.set(isAlongX ? offset : 0, postH - 0.04, isAlongX ? 0 : offset);
      cap.castShadow = true;
      gateGroup.add(cap);
    });

    // Two wooden gate leaves with Z-braces
    const leafW = (width - 0.12) / 2;
    const leafH = 0.70;
    const leafThick = 0.04;

    [-1, 1].forEach((dir) => {
      const leafGroup = new THREE.Group();
      const pivotOffset = dir * (width / 2 - 0.06);

      // Slats
      for (let s = 0; s < 3; s++) {
        const slatGeo = new RoundedBoxGeometry(
          isAlongX ? leafW / 3.4 : leafThick,
          leafH,
          isAlongX ? leafThick : leafW / 3.4,
          2,
          0.01
        );
        const slat = new THREE.Mesh(slatGeo, materials.woodNatural);
        const u = -leafW / 2 + (s + 0.5) * (leafW / 3);
        if (isAlongX) {
          slat.position.set(u, leafH / 2 + 0.04, 0);
        } else {
          slat.position.set(0, leafH / 2 + 0.04, u);
        }
        slat.castShadow = true;
        leafGroup.add(slat);
      }

      // Rails
      [0.2, 0.52].forEach((ry) => {
        const railGeo = new RoundedBoxGeometry(
          isAlongX ? leafW : leafThick * 1.1,
          0.05,
          isAlongX ? leafThick * 1.1 : leafW,
          2,
          0.01
        );
        const rail = new THREE.Mesh(railGeo, materials.woodFence);
        rail.position.y = ry;
        rail.castShadow = true;
        leafGroup.add(rail);
      });

      if (isAlongX) {
        leafGroup.position.set(pivotOffset - dir * (leafW / 2), 0, 0);
      } else {
        leafGroup.position.set(0, 0, pivotOffset - dir * (leafW / 2));
      }
      gateGroup.add(leafGroup);
    });

    return gateGroup;
  }

  // =========================================================================
  // 4. REUSABLE GARDEN PATH BUILDER (Stepping stone pavers)
  // =========================================================================
  function createGardenPath(startX, startZ, endX, endZ, width = 0.65) {
    const pathGroup = new THREE.Group();
    pathGroup.name = 'GardenPath';

    const dx = endX - startX;
    const dz = endZ - startZ;
    const totalDist = Math.hypot(dx, dz);
    const paverPitch = 0.52;
    const numPavers = Math.max(2, Math.floor(totalDist / paverPitch));
    const angle = Math.atan2(dz, dx);

    const paverLength = 0.38;
    const paverThick = 0.025;

    for (let i = 0; i < numPavers; i++) {
      const t = (i + 0.5) / numPavers;
      const px = startX + t * dx;
      const pz = startZ + t * dz;

      const paverGeo = new RoundedBoxGeometry(paverLength, paverThick, width, 2, 0.015);
      const paver = new THREE.Mesh(paverGeo, materials.sidewalk);
      paver.position.set(px, 0.14 + paverThick / 2 + 0.005, pz);
      paver.rotation.y = -angle;
      paver.receiveShadow = true;
      paver.castShadow = true;
      pathGroup.add(paver);
    }

    return pathGroup;
  }

  // =========================================================================
  // 5. STREET LAMP BUILDER
  // =========================================================================
  function createStreetLamp() {
    const lamp = new THREE.Group();

    const baseGeo = new THREE.CylinderGeometry(0.16, 0.22, 0.32, 8);
    const base = new THREE.Mesh(baseGeo, materials.metalDark);
    base.position.y = 0.16;
    lamp.add(base);

    const poleGeo = new THREE.CylinderGeometry(0.055, 0.08, 3.2, 8);
    const pole = new THREE.Mesh(poleGeo, materials.metalDark);
    pole.position.y = 1.75;
    pole.castShadow = true;
    lamp.add(pole);

    const armGeo = new THREE.BoxGeometry(0.42, 0.055, 0.055);
    const arm = new THREE.Mesh(armGeo, materials.metalDark);
    arm.position.set(0.2, 3.25, 0);
    lamp.add(arm);

    const globeGeo = new THREE.SphereGeometry(0.22, 14, 12);
    const globe = new THREE.Mesh(globeGeo, materials.lampGlow);
    globe.position.set(0.38, 3.12, 0);
    lamp.add(globe);

    return lamp;
  }

  // =========================================================================
  // 5B. SIGNATURE REAR-CENTER RED CIRCULAR SIGN (Lollipop Sign)
  // =========================================================================
  function createLollipopSign() {
    const signGroup = new THREE.Group();
    signGroup.name = 'RearCenter_LollipopSign';

    const poleH = 2.0;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, poleH, 12), materials.metalDark);
    pole.position.y = poleH / 2;
    pole.castShadow = true;
    signGroup.add(pole);

    const diskR = 0.35;
    const diskThick = 0.04;
    const signDisk = new THREE.Mesh(new THREE.CylinderGeometry(diskR, diskR, diskThick, 24), materials.awningRed);
    signDisk.rotation.x = Math.PI / 2;
    signDisk.position.set(0, poleH + diskR * 0.72, 0);
    signDisk.castShadow = true;
    signGroup.add(signDisk);

    const whiteCenter = new THREE.Mesh(new THREE.CylinderGeometry(diskR * 0.68, diskR * 0.68, diskThick + 0.005, 20), materials.signWhite);
    whiteCenter.rotation.x = Math.PI / 2;
    whiteCenter.position.set(0, poleH + diskR * 0.72, 0);
    signGroup.add(whiteCenter);

    const redBar = new THREE.Mesh(new THREE.BoxGeometry(diskR * 0.88, 0.1, diskThick + 0.01), materials.awningRed);
    redBar.position.set(0, poleH + diskR * 0.72, 0);
    signGroup.add(redBar);

    signGroup.rotation.y = -Math.PI / 4;
    return signGroup;
  }

  // =========================================================================
  // 6. SIDEWALK FLOWER PLANTER BOX BUILDER
  // =========================================================================
  function createPlanterBox(w = 1.1, h = 0.38, d = 0.42) {
    const pGroup = new THREE.Group();

    const box = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.03), materials.woodNatural);
    box.position.y = h / 2;
    box.castShadow = true;
    pGroup.add(box);

    const soil = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.05, d - 0.06), materials.treeTrunk);
    soil.position.y = h + 0.01;
    pGroup.add(soil);

    const flowerColors = [materials.flowerRed, materials.flowerYellow, materials.flowerPink];
    [-0.32, 0, 0.32].forEach((fx, idx) => {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), flowerColors[idx % flowerColors.length]);
      fl.position.set(fx, h + 0.08, idx % 2 === 0 ? 0.03 : -0.03);
      pGroup.add(fl);
    });

    return pGroup;
  }

  // =========================================================================
  // QUADRANT 1: SOUTH (Foreground Cat Building Property Plot)
  // =========================================================================
  {
    // A. Multi-lobed Trees positioned cleanly in open garden lawn
    const tree1A = createStylizedTree(1.3, 2.5);
    tree1A.position.set(15.8, 0.14, 9.2);
    group.add(tree1A);

    const tree1B = createStylizedTree(1.2, 2.3);
    tree1B.position.set(8.6, 0.14, 15.6);
    group.add(tree1B);

    // Wooden picnic / garden bench in the lawn
    const bench = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.45, 0.6, 2, 0.03), materials.woodNatural);
    bench.position.set(15.2, 0.14 + 0.22, 15.4);
    bench.rotation.y = -Math.PI / 4;
    bench.castShadow = true;
    group.add(bench);

    // B. Perimeter Fence Enclosure defining the Cat Building Garden Plot
    // North garden fence facing sidewalk along Z = 6.0: left of gate (from X = 6.0 to 11.25)
    const fence1_NL = createPostAndRailFence(5.25, true);
    fence1_NL.position.set(8.625, 0.14, 6.0);
    group.add(fence1_NL);

    // Garden Gate facing Main Street sidewalk approach aligned with door at X = 11.8
    const gate1_N = createGardenGate(1.1, true);
    gate1_N.position.set(11.8, 0.14, 6.0);
    group.add(gate1_N);

    // North garden fence facing sidewalk along Z = 6.0: right of gate (from X = 12.35 to 17.5)
    const fence1_NR = createPostAndRailFence(5.15, true);
    fence1_NR.position.set(14.925, 0.14, 6.0);
    group.add(fence1_NR);

    // West boundary along platform edge / sidewalk (X = 6.0, from Z = 6.0 to 17.2)
    const fence1_W = createPostAndRailFence(11.2, false);
    fence1_W.position.set(6.0, 0.14, 11.6);
    group.add(fence1_W);

    // East boundary along platform edge (X = 17.5, from Z = 6.0 to 17.2)
    const fence1_E = createPostAndRailFence(11.2, false);
    fence1_E.position.set(17.5, 0.14, 11.6);
    group.add(fence1_E);

    // South boundary along platform edge (Z = 17.2)
    const fence1_S = createPostAndRailFence(11.5, true);
    fence1_S.position.set(11.75, 0.14, 17.2);
    group.add(fence1_S);

    // Stone Garden Path: from sidewalk (11.8, 5.5) through Gate (11.8, 6.0) across lawn to Door (11.8, 9.3)
    const path1 = createGardenPath(11.8, 5.5, 11.8, 9.3, 0.65);
    group.add(path1);

    // Street Lamp near corner crosswalk
    const lamp1 = createStreetLamp();
    lamp1.position.set(4.2, 0.16, 5.2);
    lamp1.rotation.y = Math.PI / 4;
    group.add(lamp1);

    // Sidewalk Planter on sidewalk corner
    const planter1 = createPlanterBox(1.1, 0.38, 0.42);
    planter1.position.set(4.4, 0.16, 4.4);
    planter1.rotation.y = Math.PI / 4;
    group.add(planter1);

    // Bushes in lawn
    [
      { x: 15.2, z: 7.6, r: 0.42 },
      { x: 7.6, z: 15.2, r: 0.42 },
    ].forEach(({ x, z, r }) => {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), materials.bushDark);
      bush.position.set(x, 0.14 + r * 0.8, z);
      bush.castShadow = true;
      group.add(bush);
    });
  }

  // =========================================================================
  // QUADRANT 2: WEST (Left Building 2A Commercial + 2B Residential Plot)
  // =========================================================================
  {
    // A. Multi-lobed Trees positioned cleanly in rear lawn (clear of walls)
    const tree2A = createStylizedTree(1.4, 2.7);
    tree2A.position.set(-14.8, 0.14, 16.2);
    group.add(tree2A);

    const tree2B = createStylizedTree(1.2, 2.3);
    tree2B.position.set(-8.5, 0.14, 15.2);
    group.add(tree2B);

    // B. Connected Perimeter Fence for Building 2B Residential Plot
    // Front Fence along Z = 6.0 (from X = -11.5 to -13.8)
    const fence2_fL = createPostAndRailFence(2.3, true);
    fence2_fL.position.set(-12.65, 0.14, 6.0);
    group.add(fence2_fL);

    // Garden Gate facing sidewalk approach aligned with Building 2B front door at X = -14.4
    const gate2 = createGardenGate(1.05, true);
    gate2.position.set(-14.4, 0.14, 6.0);
    group.add(gate2);

    // Front Fence continuation (from X = -15.0 to -17.5)
    const fence2_fR = createPostAndRailFence(2.5, true);
    fence2_fR.position.set(-16.25, 0.14, 6.0);
    group.add(fence2_fR);

    // West boundary along platform edge (X = -17.5)
    const fence2_W = createPostAndRailFence(11.2, false);
    fence2_W.position.set(-17.5, 0.14, 11.6);
    group.add(fence2_W);

    // South boundary along platform edge (Z = 17.2)
    const fence2_S = createPostAndRailFence(6.0, true);
    fence2_S.position.set(-14.5, 0.14, 17.2);
    group.add(fence2_S);

    // Stone Garden Path from Gate (-14.4, 6.0) across lawn to Door (-14.4, 10.8)
    const path2 = createGardenPath(-14.4, 5.5, -14.4, 10.8, 0.65);
    group.add(path2);

    // Street Lamp near corner crosswalk
    const lamp2 = createStreetLamp();
    lamp2.position.set(-4.2, 0.16, 5.6);
    lamp2.rotation.y = -Math.PI / 4;
    group.add(lamp2);

    // Miniature bicycle leaning against Building 2A sidewalk wall
    const bike = new THREE.Group();
    bike.position.set(-8.8 + 2.4, 0.16, 8.8 + 2.4);
    bike.rotation.y = Math.PI / 3;

    const bFrame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.08), materials.awningRed);
    bFrame.position.y = 0.28;
    bike.add(bFrame);

    [-0.38, 0.38].forEach((bx) => {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 8, 16), materials.vehicleTire);
      wheel.position.set(bx, 0.24, 0);
      bike.add(wheel);
    });
    group.add(bike);

    // Chalkboard easel menu on sidewalk outside 2A
    const easel = new THREE.Group();
    easel.position.set(-8.8 + 1.2, 0.16, 8.8 + 2.5);
    easel.rotation.y = 0.2;
    const board = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.55, 0.04, 2, 0.015), materials.woodDark);
    board.position.y = 0.35;
    easel.add(board);
    group.add(easel);

    // Third Pink Umbrella outside Building 2B near green awning (Reference Landmark)
    const umbrellaLeft = new THREE.Group();
    umbrellaLeft.position.set(-11.5, 0.16, 7.6);

    const uPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 8), materials.metalDark);
    uPole.position.y = 1.15;
    uPole.castShadow = true;
    umbrellaLeft.add(uPole);

    const uCanopy = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.38, 12, 1, true), materials.umbrellaPink);
    uCanopy.rotation.set(-0.15, 0, 0.18);
    uCanopy.position.y = 2.15;
    uCanopy.castShadow = true;
    umbrellaLeft.add(uCanopy);

    const uTable = new THREE.Mesh(new RoundedBoxGeometry(0.65, 0.62, 0.65, 2, 0.03), materials.woodNatural);
    uTable.position.y = 0.31;
    uTable.castShadow = true;
    umbrellaLeft.add(uTable);

    group.add(umbrellaLeft);
  }

  // =========================================================================
  // QUADRANT 3: NORTH (Rear Market Building & Side Garden Plot)
  // =========================================================================
  {
    // Multi-lobed Tree in side/rear garden
    const tree3 = createStylizedTree(1.5, 3.0);
    tree3.position.set(-15.2, 0.14, -14.2);
    group.add(tree3);

    // Perimeter Fence around Market's side property plot
    const fence3_fL = createPostAndRailFence(1.8, true);
    fence3_fL.position.set(-13.3, 0.14, -6.0);
    group.add(fence3_fL);

    const gate3 = createGardenGate(1.05, true);
    gate3.position.set(-14.7, 0.14, -6.0);
    group.add(gate3);

    const fence3_fR = createPostAndRailFence(2.3, true);
    fence3_fR.position.set(-16.35, 0.14, -6.0);
    group.add(fence3_fR);

    const fence3_W = createPostAndRailFence(11.2, false);
    fence3_W.position.set(-17.5, 0.14, -11.6);
    group.add(fence3_W);

    const fence3_N = createPostAndRailFence(11.5, true);
    fence3_N.position.set(-11.75, 0.14, -17.2);
    group.add(fence3_N);

    const path3 = createGardenPath(-14.7, -5.5, -14.7, -8.5, 0.65);
    group.add(path3);

    // Two black decorative street lamps flanking Market frontage
    const lamp3A = createStreetLamp();
    lamp3A.position.set(-6.4, 0.16, -4.2);
    lamp3A.rotation.y = -Math.PI / 4;
    group.add(lamp3A);

    const lamp3B = createStreetLamp();
    lamp3B.position.set(-12.0, 0.16, -4.2);
    lamp3B.rotation.y = -Math.PI / 4;
    group.add(lamp3B);

    // Red Circular Lollipop Sign on thin dark pole
    const lollipopSign = createLollipopSign();
    lollipopSign.position.set(-7.0, 0.16, -4.0);
    group.add(lollipopSign);
  }

  // =========================================================================
  // QUADRANT 4: EAST (Right Building 4A Store + 4B Garden Property)
  // =========================================================================
  {
    // Multi-lobed Tree in rear garden (clear of Building 4B)
    const tree4 = createStylizedTree(1.4, 2.6);
    tree4.position.set(16.2, 0.14, -16.4);
    group.add(tree4);

    // Perimeter Fence around East Garden Property
    const fence4_fL = createPostAndRailFence(2.3, true);
    fence4_fL.position.set(12.85, 0.14, -6.0);
    group.add(fence4_fL);

    const gate4 = createGardenGate(1.05, true);
    gate4.position.set(14.4, 0.14, -6.0);
    group.add(gate4);

    const fence4_fR = createPostAndRailFence(2.5, true);
    fence4_fR.position.set(16.25, 0.14, -6.0);
    group.add(fence4_fR);

    const fence4_E = createPostAndRailFence(11.2, false);
    fence4_E.position.set(17.5, 0.14, -11.6);
    group.add(fence4_E);

    const fence4_N = createPostAndRailFence(6.0, true);
    fence4_N.position.set(14.5, 0.14, -17.2);
    group.add(fence4_N);

    // Garden Path to front door of 4B
    const path4 = createGardenPath(14.4, -5.5, 14.4, -10.5, 0.65);
    group.add(path4);

    // Street Lamp on East Sidewalk
    const lamp4 = createStreetLamp();
    lamp4.position.set(5.8, 0.16, -4.2);
    lamp4.rotation.y = Math.PI / 2;
    group.add(lamp4);

    // Sidewalk cafe table with pink umbrella outside Building 4A
    const cafeGroup = new THREE.Group();
    cafeGroup.position.set(5.0, 0.16, -4.2);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 8), materials.metalDark);
    pole.position.y = 1.2;
    pole.castShadow = true;
    cafeGroup.add(pole);

    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.4, 12, 1, true), materials.umbrellaPink);
    canopy.position.y = 2.3;
    canopy.castShadow = true;
    cafeGroup.add(canopy);

    const table = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.68, 0.8, 2, 0.03), materials.woodNatural);
    table.position.y = 0.34;
    table.castShadow = true;
    cafeGroup.add(table);

    group.add(cafeGroup);
  }

  return group;
}
