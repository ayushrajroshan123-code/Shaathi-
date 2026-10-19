import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * dioramaBuildings.js
 * Stage 2E Reference Reconstruction:
 * Strict reference fidelity matching media_1790591038989.png:
 *
 * 1. South (Foreground): Compact 2-Story Cat Building (4.6m x 4.6m) with solid mansard roof,
 *    rooftop deck with cute 3D cat facing camera, storefronts, doors, recessed glowing windows,
 *    cafe patio with pink parasol, flowerbeds, and fenced garden lawn with 2 round trees.
 * 2. West (Left): Slender 3-Story Corner Building (4.6m x 4.6m) with wrap-around red/white awnings,
 *    fruit display, chalkboard, bicycle, and mansard roof + Adjacent 2-Story Peach Cottage (4.2m x 4.4m)
 *    with steep gable roof, green/white striped awning, and residential garden plot.
 * 3. North (Rear-Center): Tallest Landmark Market Building (5.4m x 5.2m x 12.0m) with 3 stories +
 *    steep triangular gable, round Type D porthole window, brick chimney with stylized smoke plume,
 *    wide red/white market awning with fruit crates, parked mint scooter, red circular sign, and black lamps.
 * 4. East (Right): 3-Story Corner Building (4.6m x 4.6m) with orange/white awning, steep gable roof,
 *    and iconic curved silver exhaust duct + Adjacent 2-Story Rooftop Garden Building (4.4m x 4.6m)
 *    with flat roof garden, colorful flowerbeds, and penthouse.
 *
 * All buildings feature:
 * - Genuine architectural punched-wall window openings with ZERO interior solid box occlusion
 * - Deep shadow reveals, inset glass panes (sunk 70-90mm inside wall), 3D mullions, casings, projecting sills
 * - Watertight roofs with solid gables, eaves, fascia, and ridge caps
 * - Proportional compact footprints allowing generous green lawns and continuous sidewalks to breathe
 */

export function createDioramaBuildings(materials) {
  const group = new THREE.Group();
  group.name = 'DioramaBuildings';

  // =========================================================================
  // ARCHITECTURAL PUNCHED-WALL & RECESSED WINDOW SYSTEM
  // =========================================================================

  /**
   * Constructs an architectural facade wall with genuine physical openings/cutouts.
   * Eliminates the "flat painted rectangle" look by creating real wall voids where
   * windows are placed, allowing glass and mullions to sit deeply inside the wall thickness.
   *
   * @param {number} wallW - Total width of the wall
   * @param {number} wallH - Height of the wall section
   * @param {number} depth - Wall thickness (e.g. 0.22m)
   * @param {THREE.Material} wallMat - Wall facade material
   * @param {Array} openings - Array of { x, y, w, h } cutout definitions (relative to wall center at x=0, y=0 to wallH)
   */
  function createPunchedWall(wallW, wallH, depth, wallMat, openings = []) {
    const wallGroup = new THREE.Group();

    if (!openings || openings.length === 0) {
      const solid = new THREE.Mesh(new THREE.BoxGeometry(wallW, wallH, depth), wallMat);
      solid.position.set(0, wallH / 2, 0);
      solid.castShadow = true;
      solid.receiveShadow = true;
      wallGroup.add(solid);
      return wallGroup;
    }

    // Determine vertical span of openings
    let yMin = Infinity;
    let yMax = -Infinity;
    openings.forEach((op) => {
      const bottom = op.y - op.h / 2;
      const top = op.y + op.h / 2;
      if (bottom < yMin) yMin = bottom;
      if (top > yMax) yMax = top;
    });

    yMin = Math.max(0, yMin);
    yMax = Math.min(wallH, yMax);

    // 1. Bottom apron wall slab (below windows)
    if (yMin > 0.02) {
      const apron = new THREE.Mesh(new THREE.BoxGeometry(wallW, yMin, depth), wallMat);
      apron.position.set(0, yMin / 2, 0);
      apron.castShadow = true;
      apron.receiveShadow = true;
      wallGroup.add(apron);
    }

    // 2. Top header wall slab (above windows)
    if (wallH - yMax > 0.02) {
      const headerH = wallH - yMax;
      const header = new THREE.Mesh(new THREE.BoxGeometry(wallW, headerH, depth), wallMat);
      header.position.set(0, yMax + headerH / 2, 0);
      header.castShadow = true;
      header.receiveShadow = true;
      wallGroup.add(header);
    }

    // 3. Middle vertical piers between window openings
    const sorted = [...openings].sort((a, b) => a.x - b.x);
    const bandH = yMax - yMin;
    const bandMidY = (yMin + yMax) / 2;
    let curX = -wallW / 2;

    sorted.forEach((op) => {
      const leftX = op.x - op.w / 2;
      const pierW = leftX - curX;
      if (pierW > 0.01) {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(pierW, bandH, depth), wallMat);
        pier.position.set(curX + pierW / 2, bandMidY, 0);
        pier.castShadow = true;
        pier.receiveShadow = true;
        wallGroup.add(pier);
      }
      curX = op.x + op.w / 2;
    });

    // Rightmost pier
    const rightPierW = wallW / 2 - curX;
    if (rightPierW > 0.01) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(rightPierW, bandH, depth), wallMat);
      pier.position.set(curX + rightPierW / 2, bandMidY, 0);
      pier.castShadow = true;
      pier.receiveShadow = true;
      wallGroup.add(pier);
    }

    // 4. Infill under-window apron blocks for openings that start above yMin
    sorted.forEach((op) => {
      const opBottom = Math.max(0, op.y - op.h / 2);
      if (opBottom > yMin + 0.01) {
        const underH = opBottom - yMin;
        const underWin = new THREE.Mesh(new THREE.BoxGeometry(op.w, underH, depth), wallMat);
        underWin.position.set(op.x, yMin + underH / 2, 0);
        underWin.castShadow = true;
        underWin.receiveShadow = true;
        wallGroup.add(underWin);
      }

      const opTop = Math.min(wallH, op.y + op.h / 2);
      if (yMax - opTop > 0.01) {
        const overH = yMax - opTop;
        const overWin = new THREE.Mesh(new THREE.BoxGeometry(op.w, overH, depth), wallMat);
        overWin.position.set(op.x, opTop + overH / 2, 0);
        overWin.castShadow = true;
        overWin.receiveShadow = true;
        wallGroup.add(overWin);
      }
    });

    return wallGroup;
  }

  /**
   * Deeply Recessed Architectural Window Cassette
   * Fits into punched wall openings with:
   * - Dark shadow cavity backing plate at the rear of the wall
   * - Deeply inset glass pane (sunk 70-90mm inside wall thickness)
   * - 3D Mullion dividers (vertical, cross, or transom)
   * - Crisp outer architrave frame casing framing the opening
   * - Bold projecting architectural sill that casts downward contact shadow
   * - Optional lintel cap and flower box
   */
  function createRecessedWindow(w, h, wallDepth, options = {}) {
    const {
      type = 'B', // 'A' (tall 2-pane), 'B' (4-pane cross), 'C' (storefront), 'D' (circular porthole), 'E' (narrow)
      frameMat = materials.windowFrame,
      glassMat = materials.glassSkyReflect,
      sillMat = materials.windowSill || materials.windowFrame,
      sill = true,
      lintel = true,
      border = 0.08, // 80mm outer architrave frame
    } = options;

    const winGroup = new THREE.Group();

    // Dedicated circular porthole window for Type D (like rear market gable in reference)
    if (type === 'D') {
      const radius = Math.min(w, h) / 2;
      const roundGroup = new THREE.Group();

      // 1. Dark circular cavity backing
      const backGeo = new THREE.CylinderGeometry(radius, radius, 0.01, 24);
      backGeo.rotateX(Math.PI / 2);
      const backMesh = new THREE.Mesh(backGeo, materials.windowInteriorBacking);
      backMesh.position.set(0, 0, 0.005);
      roundGroup.add(backMesh);

      // 2. Colored circular glass pane
      const glassGeo = new THREE.CylinderGeometry(radius * 0.90, radius * 0.90, 0.008, 24);
      glassGeo.rotateX(Math.PI / 2);
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.position.set(0, 0, 0.012);
      roundGroup.add(glassMesh);

      // 3. Cross mullions (+)
      const mThick = 0.045;
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(mThick, radius * 1.8, 0.01), frameMat);
      vBar.position.set(0, 0, 0.02);
      vBar.castShadow = true;
      roundGroup.add(vBar);

      const hBar = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.8, mThick, 0.01), frameMat);
      hBar.position.set(0, 0, 0.02);
      hBar.castShadow = true;
      roundGroup.add(hBar);

      // 4. Outer Torus Architrave Frame
      const ringGeo = new THREE.TorusGeometry(radius, border * 0.65, 8, 28);
      const ringMesh = new THREE.Mesh(ringGeo, frameMat);
      ringMesh.position.set(0, 0, 0.025);
      ringMesh.castShadow = true;
      roundGroup.add(ringMesh);

      // 5. Projecting Sill
      if (sill) {
        const sillW = radius * 2.2;
        const sillH = 0.055;
        const sillD = 0.065;
        const sMesh = new THREE.Mesh(new RoundedBoxGeometry(sillW, sillH, sillD, 2, 0.015), sillMat);
        sMesh.position.set(0, -radius - sillH / 2, 0.035);
        sMesh.castShadow = true;
        roundGroup.add(sMesh);
      }

      return roundGroup;
    }

    const innerW = Math.max(0.18, w - 2 * border);
    const innerH = Math.max(0.18, h - 2 * border);

    // 1. Dark Interior Backing Cavity (at rear of wall opening)
    const backGeo = new THREE.BoxGeometry(w + 0.02, h + 0.02, 0.015);
    const backing = new THREE.Mesh(backGeo, materials.windowInteriorBacking);
    backing.position.set(0, 0, -wallDepth / 2 + 0.01);
    backing.receiveShadow = true;
    winGroup.add(backing);

    // 2. Colored Glass Pane (sunk inside wall thickness at z = 0.0m)
    const glassZ = 0.01;
    const glassGeo = new THREE.BoxGeometry(innerW, innerH, 0.01);
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 0, glassZ);
    winGroup.add(glass);

    // 3. 3D Mullions (Cross / Transom Bars at z = glassZ + 0.015m)
    const mThick = 0.055;
    const mDepth = 0.012;
    const mZ = glassZ + 0.015;

    if (type === 'A') {
      const transomBar = new THREE.Mesh(new THREE.BoxGeometry(innerW, mThick, mDepth), frameMat);
      transomBar.position.set(0, innerH * 0.22, mZ);
      transomBar.castShadow = true;
      winGroup.add(transomBar);

      const vMullion = new THREE.Mesh(new THREE.BoxGeometry(mThick, innerH, mDepth), frameMat);
      vMullion.position.set(0, 0, mZ);
      vMullion.castShadow = true;
      winGroup.add(vMullion);
    } else if (type === 'B') {
      const vMullion = new THREE.Mesh(new THREE.BoxGeometry(mThick, innerH, mDepth), frameMat);
      vMullion.position.set(0, 0, mZ);
      vMullion.castShadow = true;
      winGroup.add(vMullion);

      const hMullion = new THREE.Mesh(new THREE.BoxGeometry(innerW, mThick, mDepth), frameMat);
      hMullion.position.set(0, 0, mZ);
      hMullion.castShadow = true;
      winGroup.add(hMullion);
    } else if (type === 'C') {
      const shelf = new THREE.Mesh(
        new RoundedBoxGeometry(innerW * 0.94, 0.055, 0.08, 2, 0.012),
        materials.woodNatural
      );
      shelf.position.set(0, -innerH / 2 + 0.08, glassZ + 0.02);
      winGroup.add(shelf);

      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.07, 8), materials.wallTerracotta);
      pot.position.set(-innerW * 0.24, -innerH / 2 + 0.14, glassZ + 0.02);
      winGroup.add(pot);

      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), materials.windowDisplayPlant || materials.bushDark);
      plant.position.set(-innerW * 0.24, -innerH / 2 + 0.20, glassZ + 0.02);
      winGroup.add(plant);
    } else if (type === 'E') {
      const vMullion = new THREE.Mesh(new THREE.BoxGeometry(mThick * 0.85, innerH, mDepth), frameMat);
      vMullion.position.set(0, 0, mZ);
      vMullion.castShadow = true;
      winGroup.add(vMullion);
    }

    // 4. Outer Casing Architrave Frame (at exterior wall face z = wallDepth/2)
    const fZ = wallDepth / 2 + 0.012;
    const fThick = 0.025;

    const top = new THREE.Mesh(new THREE.BoxGeometry(w, border, fThick), frameMat);
    top.position.set(0, h / 2 - border / 2, fZ);
    top.castShadow = true;
    winGroup.add(top);

    const bot = new THREE.Mesh(new THREE.BoxGeometry(w, border, fThick), frameMat);
    bot.position.set(0, -h / 2 + border / 2, fZ);
    bot.castShadow = true;
    winGroup.add(bot);

    const left = new THREE.Mesh(new THREE.BoxGeometry(border, innerH, fThick), frameMat);
    left.position.set(-w / 2 + border / 2, 0, fZ);
    left.castShadow = true;
    winGroup.add(left);

    const right = new THREE.Mesh(new THREE.BoxGeometry(border, innerH, fThick), frameMat);
    right.position.set(w / 2 - border / 2, 0, fZ);
    right.castShadow = true;
    winGroup.add(right);

    // 5. Bold Projecting Architectural Window Sill (projects 40mm forward of frame)
    if (sill) {
      const sillW = w + 0.18;
      const sillH = 0.068;
      const sillD = 0.088;
      const sillMesh = new THREE.Mesh(
        new RoundedBoxGeometry(sillW, sillH, sillD, 2, 0.015),
        sillMat
      );
      sillMesh.position.set(0, -h / 2 - sillH / 2 + border / 2, wallDepth / 2 + sillD / 2);
      sillMesh.castShadow = true;
      sillMesh.receiveShadow = true;
      winGroup.add(sillMesh);
    }

    // 6. Projecting Lintel Cap Molding above window
    if (lintel) {
      const lintelW = w + 0.14;
      const lintelH = 0.050;
      const lintelD = 0.060;
      const lintelMesh = new THREE.Mesh(
        new RoundedBoxGeometry(lintelW, lintelH, lintelD, 2, 0.012),
        frameMat
      );
      lintelMesh.position.set(0, h / 2 + lintelH / 2 - border / 2, wallDepth / 2 + lintelD / 2);
      lintelMesh.castShadow = true;
      winGroup.add(lintelMesh);
    }

    return winGroup;
  }

  /**
   * Window Flower Box with lush blossoms and greenery
   */
  function createWindowFlowerBox(w) {
    const boxGroup = new THREE.Group();
    const planter = new THREE.Mesh(
      new RoundedBoxGeometry(w, 0.16, 0.18, 3, 0.03),
      materials.woodNatural
    );
    planter.castShadow = true;
    boxGroup.add(planter);

    const soil = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.04, 0.14), materials.woodDark);
    soil.position.set(0, 0.06, 0);
    boxGroup.add(soil);

    const flowerCols = [materials.flowerPink, materials.flowerYellow, materials.flowerRed, materials.flowerWhite];
    const numFlowers = Math.max(3, Math.floor(w / 0.24));
    for (let i = 0; i < numFlowers; i++) {
      const fx = -w / 2 + 0.12 + i * ((w - 0.24) / Math.max(1, numFlowers - 1));
      const flw = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), flowerCols[i % flowerCols.length]);
      flw.position.set(fx, 0.12, Math.sin(i * 1.5) * 0.04);
      boxGroup.add(flw);

      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), materials.bushLight);
      leaf.scale.set(1.2, 0.5, 1.2);
      leaf.position.set(fx, 0.08, 0.04);
      boxGroup.add(leaf);
    }
    return boxGroup;
  }

  /**
   * Grounded architectural door with casing frame, paneled leaf, brass handle, and threshold
   */
  function createDoor(w, h, options = {}) {
    const {
      frameMat = materials.doorFrame,
      doorMat = materials.doorTeal,
      hasGlass = true,
      isDouble = false,
    } = options;

    const doorGroup = new THREE.Group();
    doorGroup.name = 'DoorGroup';
    const depth = 0.16;
    const border = 0.08;

    // 1. Fixed Door Frame
    const frameGroup = new THREE.Group();
    frameGroup.name = 'DoorFrame';
    doorGroup.add(frameGroup);

    const top = new THREE.Mesh(new THREE.BoxGeometry(w, border, depth), frameMat);
    top.position.set(0, h / 2 - border / 2, 0);
    top.castShadow = true;
    frameGroup.add(top);

    const left = new THREE.Mesh(new THREE.BoxGeometry(border, h - border, depth), frameMat);
    left.position.set(-w / 2 + border / 2, -border / 2, 0);
    left.castShadow = true;
    frameGroup.add(left);

    const right = new THREE.Mesh(new THREE.BoxGeometry(border, h - border, depth), frameMat);
    right.position.set(w / 2 - border / 2, -border / 2, 0);
    right.castShadow = true;
    frameGroup.add(right);

    const threshold = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.04, depth + 0.12), materials.curb);
    threshold.position.set(0, -h / 2 + 0.02, 0.05);
    threshold.receiveShadow = true;
    frameGroup.add(threshold);

    // 2. Door Hinge Pivot & Panel Assembly
    const slabW = w - 2 * border;
    const slabH = h - border;

    if (isDouble) {
      const leafW = slabW / 2;

      // Left Leaf
      const leftPivot = new THREE.Group();
      leftPivot.name = 'DoorPivot_Left';
      leftPivot.position.set(-w / 2 + border, 0, -0.02);
      doorGroup.add(leftPivot);

      const leftSlab = new THREE.Mesh(new THREE.BoxGeometry(leafW, slabH, 0.06), doorMat);
      leftSlab.position.set(leafW / 2, -border / 2, 0);
      leftSlab.castShadow = true;
      leftPivot.add(leftSlab);

      // Right Leaf
      const rightPivot = new THREE.Group();
      rightPivot.name = 'DoorPivot_Right';
      rightPivot.position.set(w / 2 - border, 0, -0.02);
      doorGroup.add(rightPivot);

      const rightSlab = new THREE.Mesh(new THREE.BoxGeometry(leafW, slabH, 0.06), doorMat);
      rightSlab.position.set(-leafW / 2, -border / 2, 0);
      rightSlab.castShadow = true;
      rightPivot.add(rightSlab);

      doorGroup.leftPivot = leftPivot;
      doorGroup.rightPivot = rightPivot;
      doorGroup.isDouble = true;
    } else {
      // Single Leaf: Real physical hinge at left inner jamb
      const doorPivot = new THREE.Group();
      doorPivot.name = 'DoorPivot';
      doorPivot.position.set(-w / 2 + border, 0, -0.02);
      doorGroup.add(doorPivot);

      const panelGroup = new THREE.Group();
      panelGroup.name = 'DoorPanel';
      doorPivot.add(panelGroup);

      // Slab mesh offset so it rotates around the hinge edge
      const slab = new THREE.Mesh(new THREE.BoxGeometry(slabW, slabH, 0.06), doorMat);
      slab.position.set(slabW / 2, -border / 2, 0);
      slab.castShadow = true;
      slab.receiveShadow = true;
      panelGroup.add(slab);

      if (hasGlass) {
        const gW = slabW * 0.7;
        const gH = slabH * 0.42;
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(gW, gH), materials.glassSkyReflect);
        glass.position.set(slabW / 2, slabH * 0.22, 0.035);
        panelGroup.add(glass);

        const gFrame = new THREE.Mesh(new THREE.BoxGeometry(gW + 0.04, gH + 0.04, 0.04), frameMat);
        gFrame.position.set(slabW / 2, slabH * 0.22, 0.03);
        gFrame.castShadow = true;
        panelGroup.add(gFrame);
      }

      // Brass Handle near opening edge
      const handleGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.16, 8);
      const handle = new THREE.Mesh(handleGeo, materials.metalBrass);
      handle.position.set(slabW - 0.09, -0.15, 0.05);
      handle.castShadow = true;
      panelGroup.add(handle);

      doorGroup.doorPivot = doorPivot;
      doorGroup.doorPanel = panelGroup;
      doorGroup.isDouble = false;
    }

    // Door State & Delta-Time Animation Interface
    doorGroup.doorState = 'CLOSED'; // 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING'
    doorGroup.openProgress = 0.0;
    doorGroup.targetOpen = 0.0;
    doorGroup.openSpeed = 2.2; // Smooth opening in ~0.5s
    doorGroup.maxAngle = -Math.PI * 0.48; // Inward swing (~86 deg)

    doorGroup.open = function() {
      this.targetOpen = 1.0;
      this.doorState = 'OPENING';
    };

    doorGroup.close = function() {
      this.targetOpen = 0.0;
      this.doorState = 'CLOSING';
    };

    doorGroup.update = function(delta) {
      if (!delta || delta <= 0) return;
      if (this.doorState === 'CLOSED' && this.targetOpen === 0) return;
      if (this.doorState === 'OPEN' && this.targetOpen === 1.0) return;

      if (this.targetOpen > this.openProgress) {
        this.openProgress = Math.min(1.0, this.openProgress + this.openSpeed * delta);
        if (this.openProgress >= 1.0) {
          this.doorState = 'OPEN';
        } else {
          this.doorState = 'OPENING';
        }
      } else if (this.targetOpen < this.openProgress) {
        this.openProgress = Math.max(0.0, this.openProgress - this.openSpeed * delta);
        if (this.openProgress <= 0.0) {
          this.doorState = 'CLOSED';
        } else {
          this.doorState = 'CLOSING';
        }
      }

      // Smoothstep easing for realistic physical door swing
      const t = this.openProgress;
      const eased = t * t * (3 - 2 * t);

      if (this.isDouble) {
        if (this.leftPivot) this.leftPivot.rotation.y = eased * this.maxAngle;
        if (this.rightPivot) this.rightPivot.rotation.y = -eased * this.maxAngle;
      } else if (this.doorPivot) {
        this.doorPivot.rotation.y = eased * this.maxAngle;
      }
    };

    return doorGroup;
  }

  /**
   * Striped fabric awning with scalloped valance fringe and metal support brackets
   */
  function createStripedAwning(w, depth, drop, primaryMat, secondaryMat, stripes = 8) {
    const awningGroup = new THREE.Group();
    const stripeWidth = w / stripes;

    for (let i = 0; i < stripes; i++) {
      const mat = i % 2 === 0 ? primaryMat : secondaryMat;
      const x = -w / 2 + stripeWidth / 2 + i * stripeWidth;

      const canopyGeo = new THREE.BoxGeometry(stripeWidth * 0.98, 0.03, depth);
      const canopyMesh = new THREE.Mesh(canopyGeo, mat);
      canopyMesh.rotation.x = Math.atan2(drop, depth);
      canopyMesh.position.set(x, -drop / 2, depth / 2);
      canopyMesh.castShadow = true;
      awningGroup.add(canopyMesh);

      const valanceGeo = new RoundedBoxGeometry(stripeWidth * 0.98, 0.22, 0.035, 2, 0.015);
      const valanceMesh = new THREE.Mesh(valanceGeo, mat);
      valanceMesh.position.set(x, -drop - 0.1, depth);
      valanceMesh.castShadow = true;
      awningGroup.add(valanceMesh);
    }

    const bracketGeo = new THREE.CylinderGeometry(0.02, 0.02, depth * 1.1, 6);
    const leftBracket = new THREE.Mesh(bracketGeo, materials.metalDark);
    leftBracket.rotation.x = Math.PI / 4;
    leftBracket.position.set(-w / 2 + 0.04, -drop / 2, depth / 2);
    awningGroup.add(leftBracket);

    const rightBracket = leftBracket.clone();
    rightBracket.position.x = w / 2 - 0.04;
    awningGroup.add(rightBracket);

    return awningGroup;
  }

  /**
   * Solid, Watertight Gabled Roof
   */
  function createSolidGableRoof(spanW, lengthD, heightH, roofMat, wallMat, isSpanAlongX = true) {
    const roofGroup = new THREE.Group();

    if (isSpanAlongX) {
      const halfSpan = spanW / 2;
      const slopeLength = Math.hypot(halfSpan, heightH) + 0.4;
      const angle = Math.atan2(heightH, halfSpan);
      const slabThick = 0.2;
      const eaveOverhangZ = 0.45;

      const leftSlab = new THREE.Mesh(
        new THREE.BoxGeometry(slopeLength, slabThick, lengthD + eaveOverhangZ),
        roofMat
      );
      leftSlab.rotation.z = angle;
      leftSlab.position.set(-halfSpan / 2, heightH / 2, 0);
      leftSlab.castShadow = true;
      roofGroup.add(leftSlab);

      const rightSlab = new THREE.Mesh(
        new THREE.BoxGeometry(slopeLength, slabThick, lengthD + eaveOverhangZ),
        roofMat
      );
      rightSlab.rotation.z = -angle;
      rightSlab.position.set(halfSpan / 2, heightH / 2, 0);
      rightSlab.castShadow = true;
      roofGroup.add(rightSlab);

      const ridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.2, lengthD + eaveOverhangZ + 0.04),
        materials.roofFascia
      );
      ridge.position.set(0, heightH + 0.08, 0);
      roofGroup.add(ridge);

      const shape = new THREE.Shape();
      shape.moveTo(-halfSpan, 0);
      shape.lineTo(halfSpan, 0);
      shape.lineTo(0, heightH);
      shape.closePath();

      const extrudeSettings = { depth: 0.22, bevelEnabled: false };
      const triGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

      const frontGable = new THREE.Mesh(triGeo, wallMat);
      frontGable.position.set(0, 0, lengthD / 2 - 0.22);
      frontGable.receiveShadow = true;
      roofGroup.add(frontGable);

      const rearGable = new THREE.Mesh(triGeo, wallMat);
      rearGable.position.set(0, 0, -lengthD / 2);
      rearGable.receiveShadow = true;
      roofGroup.add(rearGable);

      [-1, 1].forEach((dir) => {
        const soffit = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.08, lengthD + eaveOverhangZ),
          materials.roofFascia
        );
        soffit.position.set(dir * (halfSpan + 0.12), -0.04, 0);
        roofGroup.add(soffit);
      });
    }

    return roofGroup;
  }

  /**
   * Solid, Watertight Mansard Roof with Deck
   */
  function createSolidMansardRoof(baseW, baseD, heightH, deckW, deckD, roofMat) {
    const roofGroup = new THREE.Group();

    const overhang = 0.22;
    const slopeDepthF = (baseD - deckD) / 2;
    const slopeLengthF = Math.hypot(slopeDepthF, heightH);
    const angleF = Math.atan2(heightH, slopeDepthF);

    const slopeF = new THREE.Mesh(new THREE.BoxGeometry(baseW + overhang, 0.18, slopeLengthF), roofMat);
    slopeF.rotation.x = angleF;
    slopeF.position.set(0, heightH / 2, baseD / 2 - slopeDepthF / 2);
    slopeF.castShadow = true;
    roofGroup.add(slopeF);

    const slopeB = new THREE.Mesh(new THREE.BoxGeometry(baseW + overhang, 0.18, slopeLengthF), roofMat);
    slopeB.rotation.x = -angleF;
    slopeB.position.set(0, heightH / 2, -baseD / 2 + slopeDepthF / 2);
    slopeB.castShadow = true;
    roofGroup.add(slopeB);

    const slopeDepthS = (baseW - deckW) / 2;
    const slopeLengthS = Math.hypot(slopeDepthS, heightH);
    const angleS = Math.atan2(heightH, slopeDepthS);

    const slopeL = new THREE.Mesh(new THREE.BoxGeometry(slopeLengthS, 0.18, deckD + 0.1), roofMat);
    slopeL.rotation.z = -angleS;
    slopeL.position.set(-baseW / 2 + slopeDepthS / 2, heightH / 2, 0);
    slopeL.castShadow = true;
    roofGroup.add(slopeL);

    const slopeR = new THREE.Mesh(new THREE.BoxGeometry(slopeLengthS, 0.18, deckD + 0.1), roofMat);
    slopeR.rotation.z = angleS;
    slopeR.position.set(baseW / 2 - slopeDepthS / 2, heightH / 2, 0);
    slopeR.castShadow = true;
    roofGroup.add(slopeR);

    [
      { x: -1, z: -1 },
      { x: 1, z: -1 },
      { x: -1, z: 1 },
      { x: 1, z: 1 },
    ].forEach(({ x, z }) => {
      const p1 = new THREE.Vector3(x * (baseW / 2 + 0.04), 0.06, z * (baseD / 2 + 0.04));
      const p2 = new THREE.Vector3(x * (deckW / 2), heightH, z * (deckD / 2));
      const dir = p2.clone().sub(p1);
      const len = dir.length();
      const mid = p1.clone().add(p2).multiplyScalar(0.5);

      const hipCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, len * 0.94, 8),
        materials.roofFascia
      );
      hipCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      hipCap.position.copy(mid);
      roofGroup.add(hipCap);
    });

    const deck = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.18, deckD), materials.roofDeckWhite);
    deck.position.y = heightH;
    deck.receiveShadow = true;
    roofGroup.add(deck);

    const railH = 0.38;
    const railThick = 0.12;

    const railF = new THREE.Mesh(new RoundedBoxGeometry(deckW + 0.1, railH, railThick, 3, 0.035), materials.wallWhite);
    railF.position.set(0, heightH + railH / 2, deckD / 2);
    roofGroup.add(railF);

    const railB = railF.clone();
    railB.position.z = -deckD / 2;
    roofGroup.add(railB);

    const railL = new THREE.Mesh(new RoundedBoxGeometry(railThick, railH, deckD + 0.1, 3, 0.035), materials.wallWhite);
    railL.position.set(-deckW / 2, heightH + railH / 2, 0);
    roofGroup.add(railL);

    const railR = railL.clone();
    railR.position.x = deckW / 2;
    roofGroup.add(railR);

    return roofGroup;
  }

  /**
   * Sculpted 3D Cute White Cat feature sitting on the rooftop deck
   */
  function createCuteCat(scale = 1.0) {
    const catGroup = new THREE.Group();
    catGroup.name = 'CuteRooftopCat';

    const bodyGeo = new THREE.SphereGeometry(0.75 * scale, 24, 20);
    bodyGeo.scale(1.0, 1.1, 0.95);
    const body = new THREE.Mesh(bodyGeo, materials.catWhite);
    body.position.set(0, 0.8 * scale, 0);
    body.castShadow = true;
    catGroup.add(body);

    const headGeo = new THREE.SphereGeometry(0.68 * scale, 24, 20);
    headGeo.scale(1.05, 0.98, 1.0);
    const head = new THREE.Mesh(headGeo, materials.catWhite);
    head.position.set(0, 1.7 * scale, 0.05 * scale);
    head.castShadow = true;
    catGroup.add(head);

    [-1, 1].forEach((dir) => {
      const earGeo = new THREE.ConeGeometry(0.24 * scale, 0.42 * scale, 12);
      earGeo.scale(0.8, 1.0, 0.6);
      const ear = new THREE.Mesh(earGeo, materials.catWhite);
      ear.position.set(dir * 0.38 * scale, 2.3 * scale, 0.05 * scale);
      ear.rotation.set(-0.1, 0, -dir * 0.35);
      catGroup.add(ear);

      const innerGeo = new THREE.ConeGeometry(0.16 * scale, 0.32 * scale, 12);
      innerGeo.scale(0.7, 1.0, 0.4);
      const innerEar = new THREE.Mesh(innerGeo, materials.catPink);
      innerEar.position.set(dir * 0.38 * scale, 2.28 * scale, 0.12 * scale);
      innerEar.rotation.set(-0.1, 0, -dir * 0.35);
      catGroup.add(innerEar);
    });

    [-1, 1].forEach((dir) => {
      const eyeGeo = new THREE.SphereGeometry(0.065 * scale, 12, 10);
      const eye = new THREE.Mesh(eyeGeo, materials.catBlack);
      eye.position.set(dir * 0.22 * scale, 1.78 * scale, 0.66 * scale);
      catGroup.add(eye);

      const gleamGeo = new THREE.SphereGeometry(0.022 * scale, 8, 8);
      const gleam = new THREE.Mesh(gleamGeo, materials.wallWhite);
      gleam.position.set((dir * 0.22 + 0.02) * scale, 1.81 * scale, 0.71 * scale);
      catGroup.add(gleam);

      const blushGeo = new THREE.CircleGeometry(0.08 * scale, 16);
      const blush = new THREE.Mesh(blushGeo, materials.catPink);
      blush.position.set(dir * 0.35 * scale, 1.62 * scale, 0.62 * scale);
      blush.rotation.y = dir * 0.4;
      catGroup.add(blush);
    });

    const noseGeo = new THREE.ConeGeometry(0.045 * scale, 0.05 * scale, 8);
    const nose = new THREE.Mesh(noseGeo, materials.catPink);
    nose.rotation.x = Math.PI;
    nose.position.set(0, 1.68 * scale, 0.71 * scale);
    catGroup.add(nose);

    [-1, 1].forEach((dir) => {
      const pawGeo = new THREE.SphereGeometry(0.18 * scale, 16, 12);
      pawGeo.scale(0.85, 0.6, 1.25);
      const paw = new THREE.Mesh(pawGeo, materials.catWhite);
      paw.position.set(dir * 0.26 * scale, 0.12 * scale, 0.58 * scale);
      paw.castShadow = true;
      catGroup.add(paw);
    });

    const tailCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 0.3 * scale, -0.6 * scale),
      new THREE.Vector3(0.2 * scale, 0.5 * scale, -0.9 * scale),
      new THREE.Vector3(0.35 * scale, 1.0 * scale, -0.8 * scale),
      new THREE.Vector3(0.25 * scale, 1.2 * scale, -0.6 * scale)
    );
    const tailGeo = new THREE.TubeGeometry(tailCurve, 16, 0.08 * scale, 8, false);
    const tail = new THREE.Mesh(tailGeo, materials.catWhite);
    tail.castShadow = true;
    catGroup.add(tail);

    return catGroup;
  }

  /**
   * Brick chimney with decorative stone cap and stylized smoke plume
   */
  function createChimneyWithSmoke(width = 0.65, depth = 0.65, height = 1.6, withSmoke = true) {
    const chimney = new THREE.Group();

    const shaft = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials.chimneyBrick);
    shaft.position.y = height / 2;
    shaft.castShadow = true;
    chimney.add(shaft);

    const crown1 = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, 0.08, depth + 0.08), materials.chimneyStone);
    crown1.position.y = height + 0.04;
    chimney.add(crown1);

    const crown2 = new THREE.Mesh(new THREE.BoxGeometry(width + 0.14, 0.1, depth + 0.14), materials.chimneyStone);
    crown2.position.y = height + 0.13;
    chimney.add(crown2);

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.42, 10), materials.wallTerracotta);
    pot.position.y = height + 0.38;
    chimney.add(pot);

    if (withSmoke) {
      const puffs = [
        { r: 0.16, y: height + 0.65, x: 0.02, z: 0.02 },
        { r: 0.24, y: height + 0.95, x: -0.03, z: 0.05 },
        { r: 0.32, y: height + 1.32, x: 0.04, z: 0.09 },
        { r: 0.42, y: height + 1.78, x: 0.08, z: 0.15 },
      ];

      puffs.forEach(({ r, y, x, z }) => {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), materials.smokeWhite);
        puff.position.set(x, y, z);
        chimney.add(puff);
      });
    }

    return chimney;
  }

  /**
   * Helper: Builds 4 perimeter enclosure walls for a floor, allowing facades to have punched cutouts
   * with ZERO solid box interior occlusion.
   */
  function createFloorPerimeterWalls(
    width,
    depth,
    height,
    wallThick,
    wallMat,
    frontOpenings = [],
    rightOpenings = [],
    backOpenings = [],
    leftOpenings = []
  ) {
    const floorGroup = new THREE.Group();
    const sideSpan = depth - 2 * wallThick;

    // 1. Back wall (along -Z)
    if (backOpenings && backOpenings.length > 0) {
      const backWall = createPunchedWall(width, height, wallThick, wallMat, backOpenings);
      backWall.rotation.y = Math.PI;
      backWall.position.set(0, 0, -depth / 2 + wallThick / 2);
      floorGroup.add(backWall);
    } else {
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThick), wallMat);
      backWall.position.set(0, height / 2, -depth / 2 + wallThick / 2);
      backWall.castShadow = true;
      backWall.receiveShadow = true;
      floorGroup.add(backWall);
    }

    // 2. Left wall (along -X)
    if (leftOpenings && leftOpenings.length > 0) {
      const leftWall = createPunchedWall(sideSpan, height, wallThick, wallMat, leftOpenings);
      leftWall.rotation.y = -Math.PI / 2;
      leftWall.position.set(-width / 2 + wallThick / 2, 0, 0);
      floorGroup.add(leftWall);
    } else {
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, sideSpan), wallMat);
      leftWall.position.set(-width / 2 + wallThick / 2, height / 2, 0);
      leftWall.castShadow = true;
      leftWall.receiveShadow = true;
      floorGroup.add(leftWall);
    }

    // 3. Right wall (along +X)
    if (rightOpenings && rightOpenings.length > 0) {
      const rightWall = createPunchedWall(sideSpan, height, wallThick, wallMat, rightOpenings);
      rightWall.rotation.y = Math.PI / 2;
      rightWall.position.set(width / 2 - wallThick / 2, 0, 0);
      floorGroup.add(rightWall);
    } else {
      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, sideSpan), wallMat);
      rightWall.position.set(width / 2 - wallThick / 2, height / 2, 0);
      rightWall.castShadow = true;
      rightWall.receiveShadow = true;
      floorGroup.add(rightWall);
    }

    // 4. Front wall (along +Z)
    if (frontOpenings && frontOpenings.length > 0) {
      const frontWall = createPunchedWall(width, height, wallThick, wallMat, frontOpenings);
      frontWall.position.set(0, 0, depth / 2 - wallThick / 2);
      floorGroup.add(frontWall);
    } else {
      const frontWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThick), wallMat);
      frontWall.position.set(0, height / 2, depth / 2 - wallThick / 2);
      frontWall.castShadow = true;
      frontWall.receiveShadow = true;
      floorGroup.add(frontWall);
    }

    // Dark interior floor/ceiling plate to prevent see-through gaps
    const intFloor = new THREE.Mesh(new THREE.BoxGeometry(width - 0.05, 0.05, depth - 0.05), materials.windowInteriorBacking);
    intFloor.position.set(0, 0.025, 0);
    floorGroup.add(intFloor);

    return floorGroup;
  }

  /**
   * Helper: Inserts a recessed architectural window cassette into any building facade.
   * facade: 'front' (+Z) | 'back' (-Z) | 'left' (-X) | 'right' (+X)
   */
  function addFacadeWindow(targetGroup, facade, bW, bD, floorBaseY, wallThick, op, winOptions = {}, flowerBox = false) {
    const win = createRecessedWindow(op.w, op.h, wallThick, winOptions);
    if (facade === 'front') {
      win.position.set(op.x, floorBaseY + op.y, bD / 2 - wallThick / 2);
      win.rotation.y = 0;
      if (flowerBox) {
        const fBox = createWindowFlowerBox(op.w + 0.05);
        fBox.position.set(op.x, floorBaseY + op.y - op.h / 2 - 0.08, bD / 2 + 0.09);
        targetGroup.add(fBox);
      }
    } else if (facade === 'back') {
      win.position.set(-op.x, floorBaseY + op.y, -bD / 2 + wallThick / 2);
      win.rotation.y = Math.PI;
      if (flowerBox) {
        const fBox = createWindowFlowerBox(op.w + 0.05);
        fBox.position.set(-op.x, floorBaseY + op.y - op.h / 2 - 0.08, -bD / 2 - 0.09);
        targetGroup.add(fBox);
      }
    } else if (facade === 'left') {
      win.position.set(-bW / 2 + wallThick / 2, floorBaseY + op.y, op.x);
      win.rotation.y = -Math.PI / 2;
    } else if (facade === 'right') {
      win.position.set(bW / 2 - wallThick / 2, floorBaseY + op.y, -op.x);
      win.rotation.y = Math.PI / 2;
    }
    targetGroup.add(win);
    return win;
  }

  // =========================================================================
  // 1. SOUTH QUADRANT (FOREGROUND) — THE CAT BUILDING
  // Compact 4.6m x 4.6m footprint with front patio, garden lawn, & cat roof
  // =========================================================================
  {
    const q1Group = new THREE.Group();
    q1Group.name = 'Quad1_ForegroundCatBuilding';
    const bX = 11.8;
    const bZ = 11.6;
    q1Group.position.set(bX, 0, bZ);

    const bW = 4.6;
    const bD = 4.6;
    const f1Height = 2.8;
    const f2Height = 2.5;
    const wallThick = 0.22;

    // Base Plinth
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(bW + 0.16, 0.16, bD + 0.16, 3, 0.05), materials.curb);
    plinth.position.y = 0.08;
    q1Group.add(plinth);

    // --- Ground Floor (Height 2.8m) Perimeter Enclosure with Real Punched Openings ---
    const f1Openings1_Front = [
      { x: -0.85, y: 1.35, w: 1.35, h: 1.5 },
      { x: 0.75, y: 1.05, w: 1.1, h: 2.1 },
    ];
    const f1Openings1_Back = [
      { x: 0, y: 1.02, w: 1.0, h: 2.05 },
    ];
    const f1Openings1_Left = [
      { x: 0, y: 1.35, w: 1.1, h: 1.4 },
    ];
    const f1Openings1_Right = [
      { x: 0, y: 1.4, w: 1.2, h: 1.45 },
    ];

    const f1Walls = createFloorPerimeterWalls(
      bW,
      bD,
      f1Height,
      wallThick,
      materials.wallIvory,
      f1Openings1_Front,
      f1Openings1_Right,
      f1Openings1_Back,
      f1Openings1_Left
    );
    f1Walls.position.y = 0.16;
    q1Group.add(f1Walls);

    // Front (+Z) Storefront Awning & Door
    const frontAwning = createStripedAwning(3.8, 1.25, 0.5, materials.awningRed, materials.awningWhite, 8);
    frontAwning.position.set(0, 0.16 + f1Height * 0.85, bD / 2 + 0.04);
    q1Group.add(frontAwning);

    const mainDoor = createDoor(1.1, 2.1, { doorMat: materials.doorTeal, isDouble: false });
    mainDoor.name = 'Door_Quad1_CatBuilding_South';
    mainDoor.position.set(0.75, 0.16 + 1.05, bD / 2 + 0.02);
    q1Group.add(mainDoor);

    const frontShopWin = createRecessedWindow(1.35, 1.5, wallThick, {
      type: 'C',
      glassMat: materials.glassWarmInterior,
      frameMat: materials.windowFrameTeal,
    });
    frontShopWin.position.set(-0.85, 0.16 + 1.35, bD / 2 - wallThick / 2);
    q1Group.add(frontShopWin);

    // Right (+X) Blue-Painted Wall Accent Section with door and window
    const bluePanel = new THREE.Mesh(new THREE.BoxGeometry(0.04, f1Height, bD * 0.88), materials.wallPowderBlue);
    bluePanel.position.set(bW / 2 + 0.02, 0.16 + f1Height / 2, 0);
    q1Group.add(bluePanel);

    const sideWin = createRecessedWindow(1.2, 1.45, wallThick, {
      type: 'B',
      glassMat: materials.glassWarmInterior,
      frameMat: materials.windowFrame,
    });
    sideWin.rotation.y = Math.PI / 2;
    sideWin.position.set(bW / 2 - wallThick / 2, 0.16 + 1.4, 0);
    q1Group.add(sideWin);

    // North (-Z) Front Door facing Gate1_N and Stone Garden Path
    const rearDoor1 = createDoor(1.0, 2.05, { doorMat: materials.doorTeal, isDouble: false });
    rearDoor1.name = 'Door_Quad1_CatBuilding';
    rearDoor1.rotation.y = Math.PI;
    rearDoor1.position.set(0, 0.16 + 1.02, -bD / 2 - 0.02);
    q1Group.add(rearDoor1);

    const leftWin1 = createRecessedWindow(1.1, 1.4, wallThick, {
      type: 'B',
      glassMat: materials.glassWarmInterior,
      frameMat: materials.windowFrame,
    });
    leftWin1.rotation.y = -Math.PI / 2;
    leftWin1.position.set(-bW / 2 + wallThick / 2, 0.16 + 1.35, 0);
    q1Group.add(leftWin1);

    // Floor Division Cornice
    const belt = new THREE.Mesh(new RoundedBoxGeometry(bW + 0.22, 0.14, bD + 0.22, 3, 0.035), materials.wallWhite);
    belt.position.y = 0.16 + f1Height + 0.07;
    belt.castShadow = true;
    q1Group.add(belt);

    // --- Second Floor (Height 2.5m) with Genuine Punched Windows on All 4 Facades ---
    const f2Y = 0.16 + f1Height + 0.14;

    const frontOpenings = [
      { x: -0.95, y: 1.25, w: 1.05, h: 1.45 },
      { x: 0.95, y: 1.25, w: 1.05, h: 1.45 },
    ];
    const rightOpenings = [
      { x: -0.95, y: 1.25, w: 1.05, h: 1.45 },
      { x: 0.95, y: 1.25, w: 1.05, h: 1.45 },
    ];
    const backOpenings = [
      { x: -0.95, y: 1.25, w: 1.05, h: 1.45 },
      { x: 0.95, y: 1.25, w: 1.05, h: 1.45 },
    ];
    const leftOpenings = [
      { x: -0.95, y: 1.25, w: 1.05, h: 1.45 },
      { x: 0.95, y: 1.25, w: 1.05, h: 1.45 },
    ];

    const f2Walls = createFloorPerimeterWalls(
      bW,
      bD,
      f2Height,
      wallThick,
      materials.wallIvory,
      frontOpenings,
      rightOpenings,
      backOpenings,
      leftOpenings
    );
    f2Walls.position.y = f2Y;
    q1Group.add(f2Walls);

    // Inset Recessed Windows in Front (+Z) with Flower Boxes
    frontOpenings.forEach((op) => {
      addFacadeWindow(q1Group, 'front', bW, bD, f2Y, wallThick, op, {
        type: 'B',
        glassMat: materials.glassWarmInterior,
        frameMat: materials.windowFrame,
      }, true);
    });

    // Inset Recessed Windows in Right (+X)
    rightOpenings.forEach((op) => {
      addFacadeWindow(q1Group, 'right', bW, bD, f2Y, wallThick, op, {
        type: 'B',
        glassMat: materials.glassWarmInterior,
        frameMat: materials.windowFrame,
      });
    });

    // Inset Recessed Windows in Back (-Z)
    backOpenings.forEach((op) => {
      addFacadeWindow(q1Group, 'back', bW, bD, f2Y, wallThick, op, {
        type: 'B',
        glassMat: materials.glassWarmInterior,
        frameMat: materials.windowFrame,
      });
    });

    // Inset Recessed Windows in Left (-X)
    leftOpenings.forEach((op) => {
      addFacadeWindow(q1Group, 'left', bW, bD, f2Y, wallThick, op, {
        type: 'B',
        glassMat: materials.glassWarmInterior,
        frameMat: materials.windowFrame,
      });
    });

    // --- Mansard Roof with Deck & Cute Cat ---
    const roofBaseY = f2Y + f2Height;
    const roofH = 1.5;
    const deckW = bW - 1.6;
    const deckD = bD - 1.6;

    const mansardRoof = createSolidMansardRoof(bW, bD, roofH, deckW, deckD, materials.roofSlateTeal);
    mansardRoof.position.y = roofBaseY;
    q1Group.add(mansardRoof);

    // Rooftop Opening with Parapet & Cat
    const openingGroup = new THREE.Group();
    openingGroup.position.set(0, roofBaseY + roofH, 0);

    const openW = 2.2;
    const openD = 2.2;
    const parapetH = 0.38;
    const pThick = 0.16;

    const pF = new THREE.Mesh(new RoundedBoxGeometry(openW, parapetH, pThick, 3, 0.03), materials.wallWhite);
    pF.position.set(0, parapetH / 2, openD / 2 - pThick / 2);
    pF.castShadow = true;
    openingGroup.add(pF);

    const pB = new THREE.Mesh(new RoundedBoxGeometry(openW, parapetH, pThick, 3, 0.03), materials.wallWhite);
    pB.position.set(0, parapetH / 2, -openD / 2 + pThick / 2);
    pB.castShadow = true;
    openingGroup.add(pB);

    const pL = new THREE.Mesh(new RoundedBoxGeometry(pThick, parapetH, openD - 2 * pThick, 3, 0.03), materials.wallWhite);
    pL.position.set(-openW / 2 + pThick / 2, parapetH / 2, 0);
    pL.castShadow = true;
    openingGroup.add(pL);

    const pR = pL.clone();
    pR.position.x = openW / 2 - pThick / 2;
    openingGroup.add(pR);

    const innerWell = new THREE.Mesh(
      new THREE.BoxGeometry(openW - 2 * pThick, 0.4, openD - 2 * pThick),
      materials.windowInteriorBacking
    );
    innerWell.position.set(0, 0.12, 0);
    openingGroup.add(innerWell);

    const cat = createCuteCat(0.88);
    cat.position.set(0, -0.04, 0.08);
    cat.lookAt(44, cat.position.y, 44);
    openingGroup.add(cat);

    q1Group.add(openingGroup);

    // Front-Right Outdoor Terrace (+X, +Z) with Cafe Seating & Tilted Pink Parasol
    const patioGeo = new RoundedBoxGeometry(2.5, 0.08, 2.2, 2, 0.03);
    const patio = new THREE.Mesh(patioGeo, materials.woodNatural);
    patio.position.set(2.5, 0.14 + 0.04, 1.4);
    patio.receiveShadow = true;
    patio.castShadow = true;
    q1Group.add(patio);

    // Wooden Cafe Table & Stools
    const table = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.65, 0.72, 2, 0.04), materials.woodDark);
    table.position.set(2.5, 0.14 + 0.38, 1.4);
    table.castShadow = true;
    q1Group.add(table);

    [-0.55, 0.55].forEach((dx) => {
      const chair = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.42, 0.32, 2, 0.03), materials.woodNatural);
      chair.position.set(2.5 + dx, 0.14 + 0.22, 1.4);
      chair.castShadow = true;
      q1Group.add(chair);
    });

    // Tilted Pink Parasol over Terrace
    const parasolPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 8), materials.metalDark);
    parasolPole.position.set(2.5, 0.14 + 1.15, 1.4);
    parasolPole.castShadow = true;
    q1Group.add(parasolPole);

    const parasolCanopy = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.4, 12, 1, true), materials.umbrellaPink);
    parasolCanopy.rotation.set(0.12, 0, -0.22);
    parasolCanopy.position.set(2.5, 0.14 + 2.15, 1.4);
    parasolCanopy.castShadow = true;
    q1Group.add(parasolCanopy);

    // Planter box along patio edge
    const deckPlanter = createWindowFlowerBox(1.4);
    deckPlanter.position.set(2.5, 0.14 + 0.18, 2.45);
    q1Group.add(deckPlanter);

    group.add(q1Group);
  }

  // =========================================================================
  // 2. WEST QUADRANT (LEFT CLUSTER)
  // Building 2A: Slender 3-Story Corner (4.6m x 4.6m x 8.4m) with wrap awnings
  // Building 2B: 2-Story Peach Cottage (4.2m x 4.4m x 8.4m) with green awning
  // =========================================================================
  {
    // --- Building 2A: 3-Story Corner Building ---
    const b2AGroup = new THREE.Group();
    b2AGroup.name = 'Quad2_Corner3StoryBuilding';
    const b1X = -8.8;
    const b1Z = 8.8;
    b2AGroup.position.set(b1X, 0, b1Z);

    const b1W = 4.6;
    const b1D = 4.6;
    const b1H = 8.2;
    const wallThick = 0.22;
    const floorH = b1H / 3; // 2.73m per story

    // Base Plinth
    const plinth1 = new THREE.Mesh(new RoundedBoxGeometry(b1W + 0.16, 0.16, b1D + 0.16, 3, 0.05), materials.curb);
    plinth1.position.y = 0.08;
    b2AGroup.add(plinth1);

    // Floor Division Cornices
    [floorH, floorH * 2].forEach((h) => {
      const cornice = new THREE.Mesh(new RoundedBoxGeometry(b1W + 0.22, 0.12, b1D + 0.22, 3, 0.03), materials.wallWhite);
      cornice.position.y = 0.16 + h;
      cornice.castShadow = true;
      b2AGroup.add(cornice);
    });

    // Floor 1 Perimeter Enclosure with Real Punched Openings
    const f1Openings2A_Front = [
      { x: -0.85, y: 1.35, w: 1.3, h: 1.5 },
      { x: 0.75, y: 1.05, w: 1.15, h: 2.1 },
    ];
    const f1Openings2A_Back = [
      { x: 0, y: 1.02, w: 1.05, h: 2.05 },
    ];

    const f1Walls2A = createFloorPerimeterWalls(
      b1W,
      b1D,
      floorH,
      wallThick,
      materials.wallIvory,
      f1Openings2A_Front,
      [],
      f1Openings2A_Back,
      []
    );
    f1Walls2A.position.y = 0.16;
    b2AGroup.add(f1Walls2A);

    // Wrap-Around Red/White Striped Awnings on Ground Floor (+Z and +X)
    const awningZ = createStripedAwning(3.8, 1.25, 0.5, materials.awningRed, materials.awningWhite, 8);
    awningZ.position.set(0, 0.16 + floorH * 0.85, b1D / 2 + 0.04);
    b2AGroup.add(awningZ);

    const awningX = createStripedAwning(3.8, 1.25, 0.5, materials.awningRed, materials.awningWhite, 8);
    awningX.rotation.y = Math.PI / 2;
    awningX.position.set(b1W / 2 + 0.04, 0.16 + floorH * 0.85, 0);
    b2AGroup.add(awningX);

    // Ground Floor Storefront Entrance & Displays
    const door2A = createDoor(1.15, 2.1, { doorMat: materials.doorTeal, isDouble: false });
      door2A.name = 'Door_Quad2_CornerBuilding_Front';
    door2A.position.set(0.75, 0.16 + 1.05, b1D / 2 + 0.02);
    b2AGroup.add(door2A);

    const win2AGround = createRecessedWindow(1.3, 1.5, wallThick, {
      type: 'C',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrameTeal,
    });
    win2AGround.position.set(-0.85, 0.16 + 1.35, b1D / 2 - wallThick / 2);
    b2AGroup.add(win2AGround);

    // Rear (-Z) Delivery Service Door on Floor 1
    const rearDoor2A = createDoor(1.05, 2.05, { doorMat: materials.doorTeal, isDouble: false });
      rearDoor2A.name = 'Door_Quad2_CornerBuilding';
    rearDoor2A.rotation.y = Math.PI;
    rearDoor2A.position.set(0, 0.16 + 1.02, -b1D / 2 - 0.02);
    b2AGroup.add(rearDoor2A);

    // Floors 2 & 3: Punched Walls with Deeply Recessed Windows on All 4 Sides
    const winOpeningsFront = [
      { x: -0.95, y: floorH / 2, w: 1.05, h: 1.45 },
      { x: 0.95, y: floorH / 2, w: 1.05, h: 1.45 },
    ];
    const winOpeningsSide = [
      { x: -0.95, y: floorH / 2, w: 1.05, h: 1.45 },
      { x: 0.95, y: floorH / 2, w: 1.05, h: 1.45 },
    ];
    const winOpeningsBack = [
      { x: -0.95, y: floorH / 2, w: 1.05, h: 1.45 },
      { x: 0.95, y: floorH / 2, w: 1.05, h: 1.45 },
    ];
    const winOpeningsLeft = [
      { x: -0.95, y: floorH / 2, w: 1.05, h: 1.45 },
      { x: 0.95, y: floorH / 2, w: 1.05, h: 1.45 },
    ];

    [2, 3].forEach((floorNum) => {
      const floorBaseY = 0.16 + (floorNum - 1) * floorH;
      const fWalls = createFloorPerimeterWalls(
        b1W,
        b1D,
        floorH,
        wallThick,
        materials.wallIvory,
        winOpeningsFront,
        winOpeningsSide,
        winOpeningsBack,
        winOpeningsLeft
      );
      fWalls.position.y = floorBaseY;
      b2AGroup.add(fWalls);

      // Inset Recessed Windows in Front (+Z)
      winOpeningsFront.forEach((op) => {
        addFacadeWindow(b2AGroup, 'front', b1W, b1D, floorBaseY, wallThick, op, {
          type: 'B',
          glassMat: materials.glassSkyReflect,
          frameMat: materials.windowFrame,
        }, floorNum === 2);
      });

      // Inset Recessed Windows in Side (+X)
      winOpeningsSide.forEach((op) => {
        addFacadeWindow(b2AGroup, 'right', b1W, b1D, floorBaseY, wallThick, op, {
          type: 'B',
          glassMat: materials.glassSkyReflect,
          frameMat: materials.windowFrame,
        });
      });

      // Inset Recessed Windows in Back (-Z)
      winOpeningsBack.forEach((op) => {
        addFacadeWindow(b2AGroup, 'back', b1W, b1D, floorBaseY, wallThick, op, {
          type: 'B',
          glassMat: materials.glassSkyReflect,
          frameMat: materials.windowFrame,
        });
      });

      // Inset Recessed Windows in Left (-X)
      winOpeningsLeft.forEach((op) => {
        addFacadeWindow(b2AGroup, 'left', b1W, b1D, floorBaseY, wallThick, op, {
          type: 'B',
          glassMat: materials.glassSkyReflect,
          frameMat: materials.windowFrame,
        });
      });
    });

    // Solid Mansard Roof with Deck
    const roof1H = 1.6;
    const roof1 = createSolidMansardRoof(b1W, b1D, roof1H, b1W - 1.6, b1D - 1.6, materials.roofSlateTeal);
    roof1.position.y = 0.16 + b1H;
    b2AGroup.add(roof1);

    const ventBox = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.35, 0.4, 2, 0.03), materials.awningRed);
    ventBox.position.set(0.4, 0.16 + b1H + roof1H + 0.18, 0);
    ventBox.castShadow = true;
    b2AGroup.add(ventBox);

    // Fruit display crates on sidewalk under awning
    const produceCols = [materials.flowerRed, materials.flowerYellow, materials.awningOrange];
    [-0.9, -0.2, 0.5].forEach((cx, idx) => {
      const crate = new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.32, 0.42, 2, 0.025), materials.woodNatural);
      crate.position.set(cx, 0.16 + 0.16, b1D / 2 + 0.7);
      crate.castShadow = true;
      b2AGroup.add(crate);

      const prod = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), produceCols[idx % produceCols.length]);
      prod.scale.set(1.2, 0.6, 1.0);
      prod.position.set(cx, 0.16 + 0.34, b1D / 2 + 0.7);
      b2AGroup.add(prod);
    });

    group.add(b2AGroup);

    // --- Building 2B: 2-Story Peach Cottage with Green/White Awning ---
    const b2BGroup = new THREE.Group();
    b2BGroup.name = 'Quad2_GabledPeachCottage';
    const b2X = -14.4;
    const b2Z = 13.0;
    b2BGroup.position.set(b2X, 0, b2Z);

    const b2W = 4.2;
    const b2D = 4.4;
    const b2H = 5.6;
    const b2FloorH = 2.8;

    const plinth2 = new THREE.Mesh(new RoundedBoxGeometry(b2W + 0.16, 0.16, b2D + 0.16, 3, 0.05), materials.curb);
    plinth2.position.y = 0.08;
    b2BGroup.add(plinth2);

    // Floor 1 Perimeter Enclosure with Real Punched Openings
    const f1Openings2B_Front = [
      { x: -0.75, y: 1.35, w: 1.2, h: 1.45 },
      { x: 0.65, y: 1.05, w: 1.05, h: 2.1 },
    ];
    const f1Openings2B_Back = [
      { x: 1.15, y: 1.35, w: 1.0, h: 1.4 },
      { x: 0, y: 1.02, w: 1.05, h: 2.05 },
    ];
    const f1Openings2B_Left = [
      { x: 0, y: 1.35, w: 1.1, h: 1.4 },
    ];

    const f1Walls2B = createFloorPerimeterWalls(
      b2W,
      b2D,
      b2FloorH,
      wallThick,
      materials.wallPeach,
      f1Openings2B_Front,
      [],
      f1Openings2B_Back,
      f1Openings2B_Left
    );
    f1Walls2B.position.y = 0.16;
    b2BGroup.add(f1Walls2B);

    const belt2 = new THREE.Mesh(new RoundedBoxGeometry(b2W + 0.2, 0.12, b2D + 0.2, 3, 0.03), materials.wallWhite);
    belt2.position.y = 0.16 + b2FloorH;
    b2BGroup.add(belt2);

    // Green/White Striped Awning on Front (+Z)
    const awningGreen = createStripedAwning(3.4, 1.25, 0.5, materials.awningGreen, materials.awningWhite, 8);
    awningGreen.position.set(0, 0.16 + 2.4, b2D / 2 + 0.04);
    b2BGroup.add(awningGreen);

    // Ground Floor Entrance
    const door2B = createDoor(1.05, 2.1, { doorMat: materials.doorWood, isDouble: false });
    door2B.name = 'Door_Quad2_PeachCottage';
    door2B.position.set(0.65, 0.16 + 1.05, b2D / 2 + 0.02);
    b2BGroup.add(door2B);

    const win2BGround = createRecessedWindow(1.2, 1.45, wallThick, {
      type: 'C',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    win2BGround.position.set(-0.75, 0.16 + 1.35, b2D / 2 - wallThick / 2);
    b2BGroup.add(win2BGround);

    // Floor 1 Rear (-Z) Door & Window + Left (-X) Window facing Garden Path
    const rearDoor2B = createDoor(1.0, 2.05, { doorMat: materials.doorWood, isDouble: false });
    rearDoor2B.name = 'Door_Quad2_PeachCottage_Garden';
    rearDoor2B.rotation.y = Math.PI;
    rearDoor2B.position.set(0, 0.16 + 1.02, -b2D / 2 - 0.02);
    b2BGroup.add(rearDoor2B);

    const rearWin2B = createRecessedWindow(1.0, 1.4, wallThick, {
      type: 'A',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    rearWin2B.rotation.y = Math.PI;
    rearWin2B.position.set(-1.15, 0.16 + 1.35, -b2D / 2 + wallThick / 2);
    b2BGroup.add(rearWin2B);

    const leftWin2B = createRecessedWindow(1.1, 1.4, wallThick, {
      type: 'B',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    leftWin2B.rotation.y = -Math.PI / 2;
    leftWin2B.position.set(-b2W / 2 + wallThick / 2, 0.16 + 1.35, 0);
    b2BGroup.add(leftWin2B);

    // Floor 2 Punched Walls with Inset Windows on All 4 Sides
    const f2Openings2B_Front = [
      { x: -0.85, y: b2FloorH / 2, w: 1.05, h: 1.45 },
      { x: 0.85, y: b2FloorH / 2, w: 1.05, h: 1.45 },
    ];
    const f2Openings2B_Back = [
      { x: -0.85, y: b2FloorH / 2, w: 1.05, h: 1.45 },
      { x: 0.85, y: b2FloorH / 2, w: 1.05, h: 1.45 },
    ];
    const f2Openings2B_Left = [
      { x: -0.85, y: b2FloorH / 2, w: 1.05, h: 1.45 },
      { x: 0.85, y: b2FloorH / 2, w: 1.05, h: 1.45 },
    ];
    const f2Openings2B_Right = [
      { x: 0, y: b2FloorH / 2, w: 1.05, h: 1.45 },
    ];

    const f2Walls2B = createFloorPerimeterWalls(
      b2W,
      b2D,
      b2FloorH,
      wallThick,
      materials.wallPeach,
      f2Openings2B_Front,
      f2Openings2B_Right,
      f2Openings2B_Back,
      f2Openings2B_Left
    );
    f2Walls2B.position.y = 0.16 + b2FloorH;
    b2BGroup.add(f2Walls2B);

    // Inset Recessed Windows in Front (+Z)
    f2Openings2B_Front.forEach((op) => {
      addFacadeWindow(b2BGroup, 'front', b2W, b2D, 0.16 + b2FloorH, wallThick, op, {
        type: 'A',
        glassMat: materials.glassSkyReflect,
        frameMat: materials.windowFrame,
      });
    });

    // Inset Recessed Windows in Right (+X)
    f2Openings2B_Right.forEach((op) => {
      addFacadeWindow(b2BGroup, 'right', b2W, b2D, 0.16 + b2FloorH, wallThick, op, {
        type: 'B',
        glassMat: materials.glassSkyReflect,
        frameMat: materials.windowFrame,
      });
    });

    // Inset Recessed Windows in Back (-Z)
    f2Openings2B_Back.forEach((op) => {
      addFacadeWindow(b2BGroup, 'back', b2W, b2D, 0.16 + b2FloorH, wallThick, op, {
        type: 'A',
        glassMat: materials.glassSkyReflect,
        frameMat: materials.windowFrame,
      });
    });

    // Inset Recessed Windows in Left (-X)
    f2Openings2B_Left.forEach((op) => {
      addFacadeWindow(b2BGroup, 'left', b2W, b2D, 0.16 + b2FloorH, wallThick, op, {
        type: 'A',
        glassMat: materials.glassSkyReflect,
        frameMat: materials.windowFrame,
      });
    });

    // Steep Gabled Roof facing +Z
    const roof2H = 2.8;
    const gRoof2 = createSolidGableRoof(b2W, b2D, roof2H, materials.roofSlateTeal, materials.wallPeach, true);
    gRoof2.position.set(0, 0.16 + b2H, 0);
    b2BGroup.add(gRoof2);

    // Front & Rear Attic Windows in Gables
    const frontAttic2B = createRecessedWindow(0.75, 0.75, wallThick, {
      type: 'B',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    frontAttic2B.position.set(0, 0.16 + b2H + 1.1, b2D / 2 + 0.015);
    b2BGroup.add(frontAttic2B);

    const rearAttic2B = createRecessedWindow(0.75, 0.75, wallThick, {
      type: 'B',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    rearAttic2B.rotation.y = Math.PI;
    rearAttic2B.position.set(0, 0.16 + b2H + 1.1, -b2D / 2 - 0.015);
    b2BGroup.add(rearAttic2B);

    group.add(b2BGroup);
  }

  // =========================================================================
  // 3. NORTH QUADRANT (REAR) — TALLEST CENTRAL ANCHOR MARKET BUILDING
  // 5.4m x 5.2m x 12.0m tall, steep triangular gable, porthole window, chimney
  // =========================================================================
  {
    const q3Group = new THREE.Group();
    q3Group.name = 'Quad3_RearAnchorMarketBuilding';
    const bX = -9.2;
    const bZ = -9.2;
    q3Group.position.set(bX, 0, bZ);

    const bW = 5.4;
    const bD = 5.2;
    const bH = 8.4;
    const wallThick = 0.22;
    const floorH = 2.8;

    // Base Plinth
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(bW + 0.18, 0.16, bD + 0.18, 3, 0.05), materials.curb);
    plinth.position.y = 0.08;
    q3Group.add(plinth);

    // Floor Division Cornices
    [2.8, 5.6].forEach((h) => {
      const cornice = new THREE.Mesh(new RoundedBoxGeometry(bW + 0.24, 0.14, bD + 0.24, 3, 0.035), materials.wallWhite);
      cornice.position.y = 0.16 + h;
      cornice.castShadow = true;
      q3Group.add(cornice);
    });

    // Floor 1 Perimeter Enclosure with Real Punched Openings
    const f1Openings3_Front = [
      { x: -1.6, y: 1.35, w: 1.2, h: 1.45 },
      { x: 0, y: 1.08, w: 1.5, h: 2.15 },
      { x: 1.6, y: 1.35, w: 1.2, h: 1.45 },
    ];
    const f1Openings3_Back = [
      { x: 1.5, y: 1.35, w: 1.1, h: 1.4 },
      { x: -0.6, y: 1.05, w: 1.4, h: 2.1 },
    ];
    const f1Openings3_Left = [
      { x: 0, y: 1.35, w: 1.1, h: 1.4 },
    ];
    const f1Openings3_Right = [
      { x: 0, y: 1.35, w: 1.1, h: 1.4 },
    ];

    const f1Walls3 = createFloorPerimeterWalls(
      bW,
      bD,
      floorH,
      wallThick,
      materials.wallIvory,
      f1Openings3_Front,
      f1Openings3_Right,
      f1Openings3_Back,
      f1Openings3_Left
    );
    f1Walls3.position.y = 0.16;
    q3Group.add(f1Walls3);

    // Solid Steep Gabled Roof facing +Z (Main Street)
    const roofH = 3.6;
    const gRoof = createSolidGableRoof(bW, bD, roofH, materials.roofSlateTeal, materials.wallIvory, true);
    gRoof.position.set(0, 0.16 + bH, 0);
    q3Group.add(gRoof);

    // Signature Round Type D porthole window in front triangular gable wall (+Z)
    const portholeFront = createRecessedWindow(1.1, 1.1, wallThick, {
      type: 'D',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    portholeFront.position.set(0, 0.16 + bH + 1.45, bD / 2 + 0.015);
    q3Group.add(portholeFront);

    // Matching Round Type D porthole window in rear triangular gable wall (-Z)
    const portholeRear = createRecessedWindow(1.1, 1.1, wallThick, {
      type: 'D',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    portholeRear.rotation.y = Math.PI;
    portholeRear.position.set(0, 0.16 + bH + 1.45, -bD / 2 - 0.015);
    q3Group.add(portholeRear);

    // Brick Chimney with Stylized Miniature Smoke Plume
    const marketChimney = createChimneyWithSmoke(0.7, 0.7, 1.8, true);
    marketChimney.position.set(-1.6, 0.16 + bH + 1.3, -0.8);
    q3Group.add(marketChimney);

    // Wide Red/White Striped Market Stall Awning facing +Z
    const marketAwning = createStripedAwning(4.8, 1.6, 0.65, materials.awningRed, materials.awningWhite, 9);
    marketAwning.position.set(0, 0.16 + 2.5, bD / 2 + 0.05);
    q3Group.add(marketAwning);

    // Ground Floor Storefront Entrance (Double Doors + Display Windows) on Front (+Z)
    const marketDoors = createDoor(1.5, 2.15, { doorMat: materials.doorRed, isDouble: true });
    marketDoors.position.set(0, 0.16 + 1.08, bD / 2 + 0.02);
    q3Group.add(marketDoors);

    [-1.6, 1.6].forEach((wx) => {
      const win = createRecessedWindow(1.2, 1.45, wallThick, {
        type: 'C',
        frameMat: materials.windowFrameTeal,
        glassMat: materials.glassWarmInterior,
      });
      win.position.set(wx, 0.16 + 1.35, bD / 2 - wallThick / 2);
      q3Group.add(win);
    });

    // Floor 1 Rear (-Z) Double Delivery Door and Service Windows
    const rearDeliveryDoors = createDoor(1.4, 2.1, { doorMat: materials.doorTeal, isDouble: true });
    rearDeliveryDoors.rotation.y = Math.PI;
    rearDeliveryDoors.position.set(0.6, 0.16 + 1.05, -bD / 2 - 0.02);
    q3Group.add(rearDeliveryDoors);

    const rearWin3A = createRecessedWindow(1.1, 1.4, wallThick, {
      type: 'B',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    rearWin3A.rotation.y = Math.PI;
    rearWin3A.position.set(-1.5, 0.16 + 1.35, -bD / 2 + wallThick / 2);
    q3Group.add(rearWin3A);

    // Floor 1 Side Windows
    const leftWin3Ground = createRecessedWindow(1.1, 1.4, wallThick, {
      type: 'B',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    leftWin3Ground.rotation.y = -Math.PI / 2;
    leftWin3Ground.position.set(-bW / 2 + wallThick / 2, 0.16 + 1.35, 0);
    q3Group.add(leftWin3Ground);

    const rightWin3Ground = createRecessedWindow(1.1, 1.4, wallThick, {
      type: 'B',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    rightWin3Ground.rotation.y = Math.PI / 2;
    rightWin3Ground.position.set(bW / 2 - wallThick / 2, 0.16 + 1.35, 0);
    q3Group.add(rightWin3Ground);

    // Floor 2: Punched Walls with Deeply Recessed Windows on All 4 Sides
    const f2Openings3_Front = [
      { x: -1.5, y: floorH / 2, w: 1.1, h: 1.45 },
      { x: 0, y: floorH / 2, w: 1.1, h: 1.45 },
      { x: 1.5, y: floorH / 2, w: 1.1, h: 1.45 },
    ];
    const f2Openings3_Back = [
      { x: -1.5, y: floorH / 2, w: 1.1, h: 1.45 },
      { x: 0, y: floorH / 2, w: 1.1, h: 1.45 },
      { x: 1.5, y: floorH / 2, w: 1.1, h: 1.45 },
    ];
    const f2Openings3_Left = [
      { x: -1.1, y: floorH / 2, w: 1.05, h: 1.45 },
      { x: 1.1, y: floorH / 2, w: 1.05, h: 1.45 },
    ];
    const f2Openings3_Right = [
      { x: -1.1, y: floorH / 2, w: 1.05, h: 1.45 },
      { x: 1.1, y: floorH / 2, w: 1.05, h: 1.45 },
    ];

    const f2Walls3 = createFloorPerimeterWalls(
      bW,
      bD,
      floorH,
      wallThick,
      materials.wallIvory,
      f2Openings3_Front,
      f2Openings3_Right,
      f2Openings3_Back,
      f2Openings3_Left
    );
    f2Walls3.position.y = 0.16 + floorH;
    q3Group.add(f2Walls3);

    // Inset Recessed Windows on Floor 2
    f2Openings3_Front.forEach((op) => {
      addFacadeWindow(q3Group, 'front', bW, bD, 0.16 + floorH, wallThick, op, {
        type: 'B',
        glassMat: materials.glassSkyReflect,
        frameMat: materials.windowFrame,
      }, true);
    });

    f2Openings3_Right.forEach((op) => {
      addFacadeWindow(q3Group, 'right', bW, bD, 0.16 + floorH, wallThick, op, {
        type: 'B',
        glassMat: materials.glassSkyReflect,
        frameMat: materials.windowFrame,
      });
    });

    f2Openings3_Back.forEach((op) => {
      addFacadeWindow(q3Group, 'back', bW, bD, 0.16 + floorH, wallThick, op, {
        type: 'B',
        glassMat: materials.glassSkyReflect,
        frameMat: materials.windowFrame,
      });
    });

    f2Openings3_Left.forEach((op) => {
      addFacadeWindow(q3Group, 'left', bW, bD, 0.16 + floorH, wallThick, op, {
        type: 'B',
        glassMat: materials.glassSkyReflect,
        frameMat: materials.windowFrame,
      });
    });

    // Floor 3: Punched Walls with Inset Windows on All 4 Sides
    const f3Openings3_Front = [
      { x: -1.3, y: floorH / 2, w: 1.15, h: 1.45 },
      { x: 1.3, y: floorH / 2, w: 1.15, h: 1.45 },
    ];
    const f3Openings3_Back = [
      { x: -1.3, y: floorH / 2, w: 1.15, h: 1.45 },
      { x: 1.3, y: floorH / 2, w: 1.15, h: 1.45 },
    ];
    const f3Openings3_Left = [
      { x: -1.1, y: floorH / 2, w: 1.05, h: 1.45 },
      { x: 1.1, y: floorH / 2, w: 1.05, h: 1.45 },
    ];
    const f3Openings3_Right = [
      { x: -1.1, y: floorH / 2, w: 1.05, h: 1.45 },
      { x: 1.1, y: floorH / 2, w: 1.05, h: 1.45 },
    ];

    const f3Walls3 = createFloorPerimeterWalls(
      bW,
      bD,
      floorH,
      wallThick,
      materials.wallIvory,
      f3Openings3_Front,
      f3Openings3_Right,
      f3Openings3_Back,
      f3Openings3_Left
    );
    f3Walls3.position.y = 0.16 + floorH * 2;
    q3Group.add(f3Walls3);

    f3Openings3_Front.forEach((op) => {
      addFacadeWindow(q3Group, 'front', bW, bD, 0.16 + floorH * 2, wallThick, op, {
        type: 'A',
        glassMat: materials.glassWarmInterior,
        frameMat: materials.windowFrame,
      });
    });

    f3Openings3_Right.forEach((op) => {
      addFacadeWindow(q3Group, 'right', bW, bD, 0.16 + floorH * 2, wallThick, op, {
        type: 'B',
        glassMat: materials.glassSkyReflect,
        frameMat: materials.windowFrame,
      });
    });

    f3Openings3_Back.forEach((op) => {
      addFacadeWindow(q3Group, 'back', bW, bD, 0.16 + floorH * 2, wallThick, op, {
        type: 'A',
        glassMat: materials.glassWarmInterior,
        frameMat: materials.windowFrame,
      });
    });

    f3Openings3_Left.forEach((op) => {
      addFacadeWindow(q3Group, 'left', bW, bD, 0.16 + floorH * 2, wallThick, op, {
        type: 'B',
        glassMat: materials.glassSkyReflect,
        frameMat: materials.windowFrame,
      });
    });

    // 6 Wooden Crates of Market Produce under the awning
    const fruitColors = [materials.flowerRed, materials.flowerYellow, materials.bushDark, materials.awningOrange];
    [-1.7, -1.0, -0.3, 0.4, 1.1, 1.8].forEach((xPos, idx) => {
      const crate = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.34, 0.45, 2, 0.03), materials.woodNatural);
      crate.position.set(xPos, 0.16 + 0.17, bD / 2 + 0.7);
      crate.castShadow = true;
      q3Group.add(crate);

      const produce = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), fruitColors[idx % fruitColors.length]);
      produce.scale.set(1.2, 0.6, 1.0);
      produce.position.set(xPos, 0.16 + 0.38, bD / 2 + 0.7);
      q3Group.add(produce);
    });

    // Parked Mint-Green Scooter on sidewalk by the curb
    const greenScooter = new THREE.Group();
    greenScooter.position.set(2.2, 0.16, bD / 2 + 1.2);
    greenScooter.rotation.y = -Math.PI / 4;

    const gsBody = new THREE.Mesh(new RoundedBoxGeometry(0.35, 0.35, 0.95, 2, 0.05), materials.vehicleMint);
    gsBody.position.y = 0.35;
    gsBody.castShadow = true;
    greenScooter.add(gsBody);

    const gsSeat = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.1, 0.48, 2, 0.03), materials.metalDark);
    gsSeat.position.set(0, 0.55, -0.1);
    greenScooter.add(gsSeat);

    [-0.36, 0.36].forEach((z) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 12), materials.vehicleTire);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.17, z);
      greenScooter.add(wheel);
    });
    q3Group.add(greenScooter);

    // Street Lamp with Hanging Red Circular Medallion Sign
    const lampPost = new THREE.Group();
    lampPost.position.set(bW / 2 + 0.7, 0.16, bD / 2 + 0.9);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 3.4, 8), materials.metalDark);
    post.position.y = 1.7;
    post.castShadow = true;
    lampPost.add(post);

    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), materials.lampGlow);
    globe.position.y = 3.5;
    lampPost.add(globe);

    const sign = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.045, 16), materials.awningRed);
    sign.rotation.x = Math.PI / 2;
    sign.position.set(0.42, 2.5, 0);
    lampPost.add(sign);
    q3Group.add(lampPost);

    group.add(q3Group);
  }

  // =========================================================================
  // 4. EAST QUADRANT (RIGHT CLUSTER)
  // Building 4A: 3-Story Commercial with Orange Awning & Curved Exhaust Duct
  // Building 4B: 2-Story Rooftop Garden Building with Colorful Floral Deck
  // =========================================================================
  {
    // --- Building 4A: 3-Story Commercial Building ---
    const b4AGroup = new THREE.Group();
    b4AGroup.name = 'Quad4_CornerExhaustBuilding';
    const b1X = 9.0;
    const b1Z = -9.0;
    b4AGroup.position.set(b1X, 0, b1Z);

    const b1W = 4.6;
    const b1D = 4.6;
    const b1H = 8.0;
    const wallThick = 0.22;
    const floorH = b1H / 3;

    const plinth1 = new THREE.Mesh(new RoundedBoxGeometry(b1W + 0.16, 0.16, b1D + 0.16, 3, 0.05), materials.curb);
    plinth1.position.y = 0.08;
    b4AGroup.add(plinth1);

    [floorH, floorH * 2].forEach((h) => {
      const cornice = new THREE.Mesh(new RoundedBoxGeometry(b1W + 0.22, 0.12, b1D + 0.22, 3, 0.03), materials.wallWhite);
      cornice.position.y = 0.16 + h;
      cornice.castShadow = true;
      b4AGroup.add(cornice);
    });

    // Floor 1 Perimeter Enclosure with Real Punched Openings
    const f1Openings4A_Front = [
      { x: -0.85, y: 1.35, w: 1.3, h: 1.5 },
      { x: 0.75, y: 1.05, w: 1.15, h: 2.1 },
    ];
    const f1Openings4A_Back = [
      { x: 0, y: 1.02, w: 1.05, h: 2.05 },
    ];
    const f1Openings4A_Left = [
      { x: 0, y: 1.35, w: 1.0, h: 1.35 },
    ];

    const f1Walls4A = createFloorPerimeterWalls(
      b1W,
      b1D,
      floorH,
      wallThick,
      materials.wallSand,
      f1Openings4A_Front,
      [],
      f1Openings4A_Back,
      f1Openings4A_Left
    );
    f1Walls4A.position.y = 0.16;
    b4AGroup.add(f1Walls4A);

    // Orange/White Striped Awning on Front (+Z face facing Main Street)
    const orangeAwning = createStripedAwning(3.8, 1.25, 0.5, materials.awningOrange, materials.awningWhite, 8);
    orangeAwning.position.set(0, 0.16 + floorH * 0.85, b1D / 2 + 0.04);
    b4AGroup.add(orangeAwning);

    // Front (+Z) Commercial Storefront Entrance
    const door4A = createDoor(1.15, 2.1, { doorMat: materials.doorTeal, isDouble: false });
    door4A.position.set(0.75, 0.16 + 1.05, b1D / 2 + 0.02);
    b4AGroup.add(door4A);

    const win4AGround = createRecessedWindow(1.3, 1.5, wallThick, {
      type: 'C',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrameTeal,
    });
    win4AGround.position.set(-0.85, 0.16 + 1.35, b1D / 2 - wallThick / 2);
    b4AGroup.add(win4AGround);

    // Rear (-Z) Delivery Service Door on Floor 1
    const rearDoor4A = createDoor(1.05, 2.05, { doorMat: materials.doorTeal, isDouble: false });
    rearDoor4A.rotation.y = Math.PI;
    rearDoor4A.position.set(0, 0.16 + 1.02, -b1D / 2 - 0.02);
    b4AGroup.add(rearDoor4A);

    // Left (-X) Service Window on Floor 1
    const leftWin4AGround = createRecessedWindow(1.0, 1.35, wallThick, {
      type: 'B',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    leftWin4AGround.rotation.y = -Math.PI / 2;
    leftWin4AGround.position.set(-b1W / 2 + wallThick / 2, 0.16 + 1.35, 0);
    b4AGroup.add(leftWin4AGround);

    // Floors 2 & 3: Punched Walls with Inset Recessed Windows on All 4 Sides
    const winOpenings4A_Front = [
      { x: -0.95, y: floorH / 2, w: 1.05, h: 1.45 },
      { x: 0.95, y: floorH / 2, w: 1.05, h: 1.45 },
    ];
    const winOpenings4A_Back = [
      { x: -0.95, y: floorH / 2, w: 1.05, h: 1.45 },
      { x: 0.95, y: floorH / 2, w: 1.05, h: 1.45 },
    ];
    const winOpenings4A_Left = [
      { x: -0.95, y: floorH / 2, w: 1.05, h: 1.45 },
      { x: 0.95, y: floorH / 2, w: 1.05, h: 1.45 },
    ];
    // Right wall (+X) has exhaust duct at z = 0.6. Window at x = -1.05 maps to z = +1.05 (clear of duct)
    const winOpenings4A_Right = [
      { x: -1.05, y: floorH / 2, w: 1.05, h: 1.45 },
    ];

    [2, 3].forEach((floorNum) => {
      const floorBaseY = 0.16 + (floorNum - 1) * floorH;
      const fWalls = createFloorPerimeterWalls(
        b1W,
        b1D,
        floorH,
        wallThick,
        materials.wallSand,
        winOpenings4A_Front,
        winOpenings4A_Right,
        winOpenings4A_Back,
        winOpenings4A_Left
      );
      fWalls.position.y = floorBaseY;
      b4AGroup.add(fWalls);

      winOpenings4A_Front.forEach((op) => {
        addFacadeWindow(b4AGroup, 'front', b1W, b1D, floorBaseY, wallThick, op, {
          type: 'B',
          glassMat: materials.glassSkyReflect,
          frameMat: materials.windowFrame,
        });
      });

      winOpenings4A_Right.forEach((op) => {
        addFacadeWindow(b4AGroup, 'right', b1W, b1D, floorBaseY, wallThick, op, {
          type: 'B',
          glassMat: materials.glassSkyReflect,
          frameMat: materials.windowFrame,
        });
      });

      winOpenings4A_Back.forEach((op) => {
        addFacadeWindow(b4AGroup, 'back', b1W, b1D, floorBaseY, wallThick, op, {
          type: 'B',
          glassMat: materials.glassSkyReflect,
          frameMat: materials.windowFrame,
        });
      });

      winOpenings4A_Left.forEach((op) => {
        addFacadeWindow(b4AGroup, 'left', b1W, b1D, floorBaseY, wallThick, op, {
          type: 'B',
          glassMat: materials.glassSkyReflect,
          frameMat: materials.windowFrame,
        });
      });
    });

    // Steep Gabled Roof facing +Z
    const roof1H = 3.0;
    const gRoof1 = createSolidGableRoof(b1W, b1D, roof1H, materials.roofSlateTeal, materials.wallSand, true);
    gRoof1.position.set(0, 0.16 + b1H, 0);
    b4AGroup.add(gRoof1);

    // Front & Rear Attic Windows in Gables
    const frontAttic4A = createRecessedWindow(0.75, 0.75, wallThick, {
      type: 'B',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    frontAttic4A.position.set(0, 0.16 + b1H + 1.15, b1D / 2 + 0.015);
    b4AGroup.add(frontAttic4A);

    const rearAttic4A = createRecessedWindow(0.75, 0.75, wallThick, {
      type: 'B',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    rearAttic4A.rotation.y = Math.PI;
    rearAttic4A.position.set(0, 0.16 + b1H + 1.15, -b1D / 2 - 0.015);
    b4AGroup.add(rearAttic4A);

    // Iconic Curved Silver/Metallic Industrial Exhaust Duct rising along side wall (+X)
    const ductCurve = new THREE.CurvePath();
    const p0 = new THREE.Vector3(b1W / 2 + 0.12, 0.16 + 2.5, 0.6);
    const p1 = new THREE.Vector3(b1W / 2 + 0.12, 0.16 + b1H - 0.5, 0.6);
    const p2 = new THREE.Vector3(b1W / 2 + 0.12, 0.16 + b1H + 0.8, 0.6);
    const p3 = new THREE.Vector3(b1W / 2 - 0.3, 0.16 + b1H + 1.6, 0.6);

    const verticalLine = new THREE.LineCurve3(p0, p1);
    const curveTop = new THREE.CubicBezierCurve3(
      p1,
      new THREE.Vector3(b1W / 2 + 0.12, 0.16 + b1H + 0.4, 0.6),
      new THREE.Vector3(b1W / 2 + 0.05, 0.16 + b1H + 1.2, 0.6),
      p3
    );
    ductCurve.add(verticalLine);
    ductCurve.add(curveTop);

    const ductGeo = new THREE.TubeGeometry(ductCurve, 24, 0.18, 12, false);
    const ductMesh = new THREE.Mesh(ductGeo, materials.exhaustSilver);
    ductMesh.castShadow = true;
    b4AGroup.add(ductMesh);

    // Flanged cowl cap on exhaust outlet
    const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.20, 0.18, 12), materials.exhaustSilver);
    cowl.position.set(p3.x - 0.05, p3.y, p3.z);
    cowl.rotation.z = Math.PI / 4;
    cowl.castShadow = true;
    b4AGroup.add(cowl);

    group.add(b4AGroup);

    // --- Building 4B: 2-Story Rooftop Garden Building ---
    const b4BGroup = new THREE.Group();
    b4BGroup.name = 'Quad4_RooftopGardenBuilding';
    const b2X = 14.4;
    const b2Z = -12.8; // Setback -1.0m into plot from -11.8
    b4BGroup.position.set(b2X, 0, b2Z);

    const b2W = 4.4;
    const b2D = 4.6;
    const b2H = 5.4;
    const b2FloorH = 2.7;

    const plinth2 = new THREE.Mesh(new RoundedBoxGeometry(b2W + 0.16, 0.16, b2D + 0.16, 3, 0.05), materials.curb);
    plinth2.position.y = 0.08;
    b4BGroup.add(plinth2);

    const belt2 = new THREE.Mesh(new RoundedBoxGeometry(b2W + 0.2, 0.12, b2D + 0.2, 3, 0.03), materials.wallWhite);
    belt2.position.y = 0.16 + b2FloorH;
    b4BGroup.add(belt2);

    // Floor 1 Perimeter Enclosure with Real Punched Openings
    const f1Openings4B_Front = [
      { x: -1.15, y: 1.35, w: 1.0, h: 1.45 },
      { x: 0, y: 1.02, w: 1.05, h: 2.05 },
    ];
    const f1Openings4B_Back = [
      { x: 0.75, y: 1.35, w: 1.1, h: 1.4 },
      { x: -0.5, y: 1.02, w: 0.95, h: 2.05 },
    ];
    const f1Openings4B_Right = [
      { x: 0, y: 1.35, w: 1.1, h: 1.4 },
    ];
    const f1Openings4B_Left = [
      { x: 0, y: 1.35, w: 1.1, h: 1.4 },
    ];

    const f1Walls4B = createFloorPerimeterWalls(
      b2W,
      b2D,
      b2FloorH,
      wallThick,
      materials.wallPeach,
      f1Openings4B_Front,
      f1Openings4B_Right,
      f1Openings4B_Back,
      f1Openings4B_Left
    );
    f1Walls4B.position.y = 0.16;
    b4BGroup.add(f1Walls4B);

    // Ground Floor Entrance & Awning on Front (+Z) facing Garden Path
    const awning4B = createStripedAwning(3.4, 1.15, 0.45, materials.awningRed, materials.awningWhite, 7);
    awning4B.position.set(0, 0.16 + 2.3, b2D / 2 + 0.04);
    b4BGroup.add(awning4B);

    const door4B = createDoor(1.05, 2.05, { doorMat: materials.doorWood, isDouble: false });
    door4B.name = 'Door_Quad4_RooftopGardenBuilding';
    door4B.position.set(0, 0.16 + 1.02, b2D / 2 + 0.02);
    b4BGroup.add(door4B);

    const win4BGround = createRecessedWindow(1.0, 1.45, wallThick, {
      type: 'C',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    win4BGround.position.set(-1.15, 0.16 + 1.35, b2D / 2 - wallThick / 2);
    b4BGroup.add(win4BGround);

    // Floor 1 Rear (-Z) Door and Window + Side Windows
    const rearDoor4B = createDoor(0.95, 2.05, { doorMat: materials.doorWood, isDouble: false });
    rearDoor4B.rotation.y = Math.PI;
    rearDoor4B.position.set(0.5, 0.16 + 1.02, -b2D / 2 - 0.02);
    b4BGroup.add(rearDoor4B);

    const rearWin4B = createRecessedWindow(1.1, 1.4, wallThick, {
      type: 'A',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    rearWin4B.rotation.y = Math.PI;
    rearWin4B.position.set(-0.75, 0.16 + 1.35, -b2D / 2 + wallThick / 2);
    b4BGroup.add(rearWin4B);

    const rightWin4BGround = createRecessedWindow(1.1, 1.4, wallThick, {
      type: 'B',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    rightWin4BGround.rotation.y = Math.PI / 2;
    rightWin4BGround.position.set(b2W / 2 - wallThick / 2, 0.16 + 1.35, 0);
    b4BGroup.add(rightWin4BGround);

    const leftWin4BGround = createRecessedWindow(1.1, 1.4, wallThick, {
      type: 'B',
      glassMat: materials.glassSkyReflect,
      frameMat: materials.windowFrame,
    });
    leftWin4BGround.rotation.y = -Math.PI / 2;
    leftWin4BGround.position.set(-b2W / 2 + wallThick / 2, 0.16 + 1.35, 0);
    b4BGroup.add(leftWin4BGround);

    // Floor 2 Punched Walls with Inset Windows on All 4 Sides
    const f2Openings4B_Front = [
      { x: -0.85, y: b2FloorH / 2, w: 1.05, h: 1.45 },
      { x: 0.85, y: b2FloorH / 2, w: 1.05, h: 1.45 },
    ];
    const f2Openings4B_Back = [
      { x: -0.85, y: b2FloorH / 2, w: 1.05, h: 1.45 },
      { x: 0.85, y: b2FloorH / 2, w: 1.05, h: 1.45 },
    ];
    const f2Openings4B_Right = [
      { x: -0.85, y: b2FloorH / 2, w: 1.05, h: 1.45 },
      { x: 0.85, y: b2FloorH / 2, w: 1.05, h: 1.45 },
    ];
    const f2Openings4B_Left = [
      { x: 0, y: b2FloorH / 2, w: 1.05, h: 1.45 },
    ];

    const f2Walls4B = createFloorPerimeterWalls(
      b2W,
      b2D,
      b2FloorH,
      wallThick,
      materials.wallPeach,
      f2Openings4B_Front,
      f2Openings4B_Right,
      f2Openings4B_Back,
      f2Openings4B_Left
    );
    f2Walls4B.position.y = 0.16 + b2FloorH;
    b4BGroup.add(f2Walls4B);

    f2Openings4B_Front.forEach((op) => {
      addFacadeWindow(b4BGroup, 'front', b2W, b2D, 0.16 + b2FloorH, wallThick, op, {
        type: 'A',
        glassMat: materials.glassSkyReflect,
        frameMat: materials.windowFrame,
      });
    });

    f2Openings4B_Right.forEach((op) => {
      addFacadeWindow(b4BGroup, 'right', b2W, b2D, 0.16 + b2FloorH, wallThick, op, {
        type: 'B',
        glassMat: materials.glassSkyReflect,
        frameMat: materials.windowFrame,
      });
    });

    f2Openings4B_Back.forEach((op) => {
      addFacadeWindow(b4BGroup, 'back', b2W, b2D, 0.16 + b2FloorH, wallThick, op, {
        type: 'A',
        glassMat: materials.glassSkyReflect,
        frameMat: materials.windowFrame,
      });
    });

    f2Openings4B_Left.forEach((op) => {
      addFacadeWindow(b4BGroup, 'left', b2W, b2D, 0.16 + b2FloorH, wallThick, op, {
        type: 'A',
        glassMat: materials.glassSkyReflect,
        frameMat: materials.windowFrame,
      });
    });

    // Flat Rooftop Garden with White Parapet
    const roofY = 0.16 + b2H;
    const parapetH = 0.42;
    const pThick = 0.14;

    const deckLawn = new THREE.Mesh(new THREE.BoxGeometry(b2W - 0.2, 0.1, b2D - 0.2), materials.grassLawn);
    deckLawn.position.y = roofY + 0.05;
    deckLawn.receiveShadow = true;
    b4BGroup.add(deckLawn);

    const rfF = new THREE.Mesh(new RoundedBoxGeometry(b2W + 0.1, parapetH, pThick, 3, 0.03), materials.wallWhite);
    rfF.position.set(0, roofY + parapetH / 2, b2D / 2);
    rfF.castShadow = true;
    b4BGroup.add(rfF);

    const rfB = rfF.clone();
    rfB.position.z = -b2D / 2;
    b4BGroup.add(rfB);

    const rfL = new THREE.Mesh(new RoundedBoxGeometry(pThick, parapetH, b2D + 0.1, 3, 0.03), materials.wallWhite);
    rfL.position.set(-b2W / 2, roofY + parapetH / 2, 0);
    b4BGroup.add(rfL);

    const rfR = rfL.clone();
    rfR.position.x = b2W / 2;
    b4BGroup.add(rfR);

    // Raised Wooden Planter Beds with Rich Soil & Vibrant Flowers
    const bed1 = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.22, 1.2, 2, 0.03), materials.woodNatural);
    bed1.position.set(-b2W / 2 + 1.2, roofY + 0.11, -0.5);
    bed1.castShadow = true;
    b4BGroup.add(bed1);

    const soil1 = new THREE.Mesh(new RoundedBoxGeometry(1.68, 0.04, 1.08, 2, 0.02), materials.treeTrunk);
    soil1.position.set(-b2W / 2 + 1.2, roofY + 0.23, -0.5);
    b4BGroup.add(soil1);

    const bed2 = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.22, 1.2, 2, 0.03), materials.woodNatural);
    bed2.position.set(-b2W / 2 + 1.1, roofY + 0.11, 1.1);
    bed2.castShadow = true;
    b4BGroup.add(bed2);

    const soil2 = new THREE.Mesh(new RoundedBoxGeometry(1.48, 0.04, 1.08, 2, 0.02), materials.treeTrunk);
    soil2.position.set(-b2W / 2 + 1.1, roofY + 0.23, 1.1);
    b4BGroup.add(soil2);

    // Green Foliage Shrubs in beds
    const shrubPositions = [
      { x: -b2W / 2 + 0.8, y: roofY + 0.28, z: -0.7, r: 0.24 },
      { x: -b2W / 2 + 1.4, y: roofY + 0.28, z: -0.4, r: 0.26 },
      { x: -b2W / 2 + 1.1, y: roofY + 0.29, z: -0.6, r: 0.28 },
      { x: -b2W / 2 + 0.7, y: roofY + 0.28, z: 0.9, r: 0.25 },
      { x: -b2W / 2 + 1.3, y: roofY + 0.28, z: 1.2, r: 0.27 },
      { x: -b2W / 2 + 1.0, y: roofY + 0.29, z: 1.0, r: 0.28 },
    ];
    shrubPositions.forEach((sp, idx) => {
      const sh = new THREE.Mesh(
        new THREE.SphereGeometry(sp.r, 10, 8),
        idx % 2 === 0 ? materials.treeFoliageMid : materials.treeFoliageLight
      );
      sh.position.set(sp.x, sp.y, sp.z);
      sh.castShadow = true;
      b4BGroup.add(sh);
    });

    // Vibrant Flower Blossoms (Pink, Yellow, Red, White) clustering on shrubs and turf
    const flowerColors = [materials.flowerPink, materials.flowerYellow, materials.flowerRed, materials.flowerWhite];
    for (let i = 0; i < 24; i++) {
      const fx = -b2W / 2 + 0.5 + ((i * 1.31) % (b2W - 1.1));
      const fz = -b2D / 2 + 0.5 + ((i * 1.73) % (b2D - 1.1));
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), flowerColors[i % flowerColors.length]);
      const fy = (fx < 0 && (fz < 0 || fz > 0.4)) ? roofY + 0.38 : roofY + 0.14;
      fl.position.set(fx, fy, fz);
      b4BGroup.add(fl);
    }

    // Planter boxes mounted along front parapet
    const parapetPlanter = createWindowFlowerBox(1.5);
    parapetPlanter.position.set(0, roofY + parapetH + 0.08, b2D / 2 - 0.1);
    b4BGroup.add(parapetPlanter);

    // Small White Rooftop Penthouse Structure
    const phW = 1.3;
    const phD = 1.3;
    const phH = 1.1;
    const penthouse = new THREE.Mesh(new RoundedBoxGeometry(phW, phH, phD, 2, 0.03), materials.wallWhite);
    penthouse.position.set(b2W / 2 - phW / 2 - 0.25, roofY + phH / 2 + 0.05, -b2D / 2 + phD / 2 + 0.25);
    penthouse.castShadow = true;
    b4BGroup.add(penthouse);

    const phRoof = createSolidGableRoof(phW + 0.2, phD + 0.2, 0.5, materials.roofSlateTeal, materials.wallWhite, true);
    phRoof.position.set(b2W / 2 - phW / 2 - 0.25, roofY + phH + 0.05, -b2D / 2 + phD / 2 + 0.25);
    b4BGroup.add(phRoof);

    group.add(b4BGroup);
  }

  return group;
}
