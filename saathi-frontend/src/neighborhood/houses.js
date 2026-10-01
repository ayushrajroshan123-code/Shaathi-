import * as THREE from 'three';

/**
 * houses.js
 * 
 * Implements the six distinct architectural residences for SAATHI Phase 2:
 * - HOUSE 01: Warm Modern Family Home (Two-story, offset volumes, parapet roof, warm plaster + cedar + stone)
 * - HOUSE 02: Compact Urban Contemporary (Asymmetrical upper volume, vertical rhythm, wood slats + metal)
 * - HOUSE 03: Modern Pitched-Roof Family House (Prominent gable roof with overhangs, front porch with columns & railings, gutters/downspouts)
 * - HOUSE 04: Accessible Single-Story Residence (Low horizontal profile, integrated architectural ramp with handrail, broad sheltered entrance, wide door)
 * - HOUSE 05: Courtyard Contemporary (L-shaped massing, partially enclosed private courtyard, privacy wall with louvers, deep window reveals)
 * - HOUSE 06: Large Contemporary Family Residence (Layered masses, stepped flat roofs, recessed garage, upper master terrace, rich masonry accents)
 * 
 * Reusable architectural construction helpers:
 * - Foundations & plinths sitting firmly on terrain (zero floating/sinking)
 * - Recessed 3D windows with outer frames, sills, head reveals, inset glass, and mullions
 * - Articulated entrances with door slabs, frames, thresholds, canopies, and exterior sconces
 * - Realistic roofs with parapet caps, gable overhangs, fascia, and drainage downspouts
 * - Balconies, porches, railings, timber louvers, and garage doors
 */

export function createHouses(sceneMaterials) {
  const group = new THREE.Group();
  group.name = 'HousesGroup';

  // =========================================================================
  // 1. DEDICATED ARCHITECTURAL MATERIALS PALETTE
  // =========================================================================
  // High-performance shared PBR materials tailored for ACES Filmic tone mapping
  const houseMats = {
    // Plaster / Stucco finishes
    plasterWarmIvory: new THREE.MeshStandardMaterial({
      color: 0xede8df,
      roughness: 0.82,
      metalness: 0.02,
    }),
    plasterLightGreige: new THREE.MeshStandardMaterial({
      color: 0xdcd6cb,
      roughness: 0.84,
      metalness: 0.02,
    }),
    plasterCrispWhite: new THREE.MeshStandardMaterial({
      color: 0xf5f3ee,
      roughness: 0.80,
      metalness: 0.02,
    }),
    plasterMutedGray: new THREE.MeshStandardMaterial({
      color: 0xc4c0b8,
      roughness: 0.85,
      metalness: 0.03,
    }),
    plasterTerracotta: new THREE.MeshStandardMaterial({
      color: 0xb56952,
      roughness: 0.82,
      metalness: 0.04,
    }),

    // Masonry / Stone / Concrete accents
    stoneDarkBasalt: new THREE.MeshStandardMaterial({
      color: 0x36393e,
      roughness: 0.88,
      metalness: 0.08,
    }),
    concretePaleSand: new THREE.MeshStandardMaterial({
      color: 0xbdb7ab,
      roughness: 0.85,
      metalness: 0.05,
    }),
    plinthDarkStone: new THREE.MeshStandardMaterial({
      color: 0x2e3236,
      roughness: 0.86,
      metalness: 0.1,
    }),

    // Architectural Timbers
    woodNaturalCedar: new THREE.MeshStandardMaterial({
      color: 0x9e7351,
      roughness: 0.68,
      metalness: 0.02,
    }),
    woodDarkTeak: new THREE.MeshStandardMaterial({
      color: 0x6e4e37,
      roughness: 0.72,
      metalness: 0.02,
    }),
    woodPaleOak: new THREE.MeshStandardMaterial({
      color: 0xbf9b73,
      roughness: 0.7,
      metalness: 0.02,
    }),

    // Metals & Trims
    metalDarkBronze: new THREE.MeshStandardMaterial({
      color: 0x222428,
      roughness: 0.35,
      metalness: 0.82,
    }),
    metalWindowFrame: new THREE.MeshStandardMaterial({
      color: 0x1e2023,
      roughness: 0.4,
      metalness: 0.8,
    }),
    metalAluminumTrim: new THREE.MeshStandardMaterial({
      color: 0x8a8e94,
      roughness: 0.38,
      metalness: 0.75,
    }),
    metalHandrail: new THREE.MeshStandardMaterial({
      color: 0x1d1f22,
      roughness: 0.35,
      metalness: 0.85,
    }),
    downspoutMetal: new THREE.MeshStandardMaterial({
      color: 0x303338,
      roughness: 0.45,
      metalness: 0.75,
    }),

    // Roofs
    roofPitchedSlate: new THREE.MeshStandardMaterial({
      color: 0x2b3036,
      roughness: 0.52,
      metalness: 0.5,
    }),
    roofMembraneFlat: new THREE.MeshStandardMaterial({
      color: 0x585b61,
      roughness: 0.92,
      metalness: 0.04,
    }),
    parapetCapping: new THREE.MeshStandardMaterial({
      color: 0x282a2e,
      roughness: 0.35,
      metalness: 0.78,
    }),

    // Glazing & Openings
    glassArchitectural: new THREE.MeshStandardMaterial({
      color: 0x141d24,
      roughness: 0.08,
      metalness: 0.92,
    }),
    glassBalustrade: new THREE.MeshStandardMaterial({
      color: 0x202b33,
      roughness: 0.12,
      metalness: 0.85,
      transparent: true,
      opacity: 0.75,
    }),
    interiorShadowReveal: new THREE.MeshStandardMaterial({
      color: 0x0c0f12,
      roughness: 0.95,
      metalness: 0.0,
    }),

    // Doors & Lighting
    doorPanelWood: new THREE.MeshStandardMaterial({
      color: 0x855f41,
      roughness: 0.6,
      metalness: 0.04,
    }),
    doorHandleMetal: new THREE.MeshStandardMaterial({
      color: 0xc8c3b7,
      roughness: 0.25,
      metalness: 0.9,
    }),
    wallSconceGlow: new THREE.MeshStandardMaterial({
      color: 0xfff2d4,
      emissive: 0xffe2a4,
      emissiveIntensity: 1.1,
      roughness: 0.2,
    }),
    garagePaneling: new THREE.MeshStandardMaterial({
      color: 0x2a2d32,
      roughness: 0.5,
      metalness: 0.55,
    }),
  };

  // =========================================================================
  // 2. REUSABLE ARCHITECTURAL CONSTRUCTION HELPERS
  // =========================================================================

  /**
   * Creates a solid foundation plinth sitting at terrain elevation (y = 0.12m)
   */
  function createPlinth(w, d, h = 0.24, mat = houseMats.plinthDarkStone) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.12 + h / 2 - 0.02; // Sits 0.02m into pad to guarantee zero light leaks
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * Creates an architectural wall volume with clean shadow behavior
   */
  function createWallVolume(w, h, d, mat, x = 0, y = 0, z = 0) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * Creates a detailed 3D recessed window assembly:
   * - Outer beveled frame
   * - Projecting bottom sill
   * - Inset reflective glass
   * - Dark interior reveal backing
   * - Optional vertical / horizontal mullions
   */
  function createWindow(w, h, options = {}) {
    const {
      sill = true,
      mullionV = 0,
      mullionH = 0,
      frameThick = 0.07,
      frameDepth = 0.12,
      frameMat = houseMats.metalWindowFrame,
      glassMat = houseMats.glassArchitectural,
    } = options;

    const win = new THREE.Group();

    // Dark interior reveal plane (gives genuine depth illusion)
    const revealGeo = new THREE.PlaneGeometry(w - frameThick * 2, h - frameThick * 2);
    const reveal = new THREE.Mesh(revealGeo, houseMats.interiorShadowReveal);
    reveal.position.z = -frameDepth / 2 + 0.01;
    win.add(reveal);

    // Inset reflective glass plane
    const glassGeo = new THREE.PlaneGeometry(w - frameThick * 2, h - frameThick * 2);
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.z = -frameDepth / 2 + 0.035;
    win.add(glass);

    // Outer perimeter frame
    // Top & Bottom
    const hBarGeo = new THREE.BoxGeometry(w, frameThick, frameDepth);
    const topBar = new THREE.Mesh(hBarGeo, frameMat);
    topBar.position.y = h / 2 - frameThick / 2;
    topBar.castShadow = true;
    win.add(topBar);

    const bottomBar = new THREE.Mesh(hBarGeo, frameMat);
    bottomBar.position.y = -h / 2 + frameThick / 2;
    bottomBar.castShadow = true;
    win.add(bottomBar);

    // Left & Right
    const vBarGeo = new THREE.BoxGeometry(frameThick, h - frameThick * 2, frameDepth);
    const leftBar = new THREE.Mesh(vBarGeo, frameMat);
    leftBar.position.x = -w / 2 + frameThick / 2;
    leftBar.castShadow = true;
    win.add(leftBar);

    const rightBar = new THREE.Mesh(vBarGeo, frameMat);
    rightBar.position.x = w / 2 - frameThick / 2;
    rightBar.castShadow = true;
    win.add(rightBar);

    // Projecting architectural sill at base
    if (sill) {
      const sillGeo = new THREE.BoxGeometry(w + 0.12, 0.065, frameDepth + 0.08);
      const sillMesh = new THREE.Mesh(sillGeo, frameMat);
      sillMesh.position.set(0, -h / 2 - 0.03, 0.03);
      sillMesh.castShadow = true;
      win.add(sillMesh);
    }

    // Vertical mullions
    if (mullionV > 0) {
      const mGeo = new THREE.BoxGeometry(0.045, h - frameThick * 2, frameDepth * 0.8);
      for (let i = 1; i <= mullionV; i++) {
        const mx = -w / 2 + (i * w) / (mullionV + 1);
        const mMesh = new THREE.Mesh(mGeo, frameMat);
        mMesh.position.set(mx, 0, -frameDepth * 0.1);
        mMesh.castShadow = true;
        win.add(mMesh);
      }
    }

    // Horizontal mullions
    if (mullionH > 0) {
      const mGeoH = new THREE.BoxGeometry(w - frameThick * 2, 0.045, frameDepth * 0.8);
      for (let i = 1; i <= mullionH; i++) {
        const my = -h / 2 + (i * h) / (mullionH + 1);
        const mMeshH = new THREE.Mesh(mGeoH, frameMat);
        mMeshH.position.set(0, my, -frameDepth * 0.1);
        mMeshH.castShadow = true;
        win.add(mMeshH);
      }
    }

    return win;
  }

  /**
   * Creates an architectural entrance door with frame, door slab, lever handle, and threshold
   */
  function createDoor(w, h, options = {}) {
    const {
      doorMat = houseMats.doorPanelWood,
      frameMat = houseMats.metalWindowFrame,
      handleSide = 'right',
      glassPanel = false,
    } = options;

    const doorGroup = new THREE.Group();
    const frameThick = 0.07;
    const depth = 0.14;

    // Door Slab
    const slabW = w - frameThick * 2;
    const slabH = h - frameThick;
    const slabGeo = new THREE.BoxGeometry(slabW, slabH, 0.06);
    const slab = new THREE.Mesh(slabGeo, doorMat);
    slab.position.set(0, slabH / 2, -depth / 2 + 0.04);
    slab.castShadow = true;
    doorGroup.add(slab);

    // Optional glass sidelight / vertical vision slit
    if (glassPanel) {
      const slitGeo = new THREE.PlaneGeometry(0.18, slabH * 0.65);
      const slit = new THREE.Mesh(slitGeo, houseMats.glassArchitectural);
      slit.position.set(-slabW * 0.22, slabH * 0.55, -depth / 2 + 0.075);
      doorGroup.add(slit);
    }

    // Perimeter Frame (Jambs & Head)
    const headGeo = new THREE.BoxGeometry(w, frameThick, depth);
    const head = new THREE.Mesh(headGeo, frameMat);
    head.position.set(0, h - frameThick / 2, 0);
    head.castShadow = true;
    doorGroup.add(head);

    const jambGeo = new THREE.BoxGeometry(frameThick, h, depth);
    const leftJamb = new THREE.Mesh(jambGeo, frameMat);
    leftJamb.position.set(-w / 2 + frameThick / 2, h / 2, 0);
    leftJamb.castShadow = true;
    doorGroup.add(leftJamb);

    const rightJamb = new THREE.Mesh(jambGeo, frameMat);
    rightJamb.position.set(w / 2 - frameThick / 2, h / 2, 0);
    rightJamb.castShadow = true;
    doorGroup.add(rightJamb);

    // Metal lever / pull handle
    const handleGeo = new THREE.BoxGeometry(0.035, 0.45, 0.04);
    const handle = new THREE.Mesh(handleGeo, houseMats.doorHandleMetal);
    const hx = handleSide === 'right' ? slabW / 2 - 0.12 : -slabW / 2 + 0.12;
    handle.position.set(hx, 1.05, -depth / 2 + 0.08);
    handle.castShadow = true;
    doorGroup.add(handle);

    // Aluminum threshold
    const threshGeo = new THREE.BoxGeometry(w + 0.04, 0.03, depth + 0.06);
    const thresh = new THREE.Mesh(threshGeo, houseMats.metalAluminumTrim);
    thresh.position.set(0, 0.015, 0.02);
    thresh.receiveShadow = true;
    doorGroup.add(thresh);

    return doorGroup;
  }

  /**
   * Creates an architectural wall sconce with up/down warm emissive glow
   */
  function createWallSconce(x, y, z, rotY = 0) {
    const sconce = new THREE.Group();
    sconce.position.set(x, y, z);
    sconce.rotation.y = rotY;

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.08, 0.22, 0.07);
    const body = new THREE.Mesh(bodyGeo, houseMats.metalDarkBronze);
    body.position.z = 0.035;
    body.castShadow = true;
    sconce.add(body);

    // Top & Bottom emissive optical diffuser lenses
    const lensGeo = new THREE.BoxGeometry(0.06, 0.025, 0.05);
    const lensTop = new THREE.Mesh(lensGeo, houseMats.wallSconceGlow);
    lensTop.position.set(0, 0.1, 0.035);
    sconce.add(lensTop);

    const lensBtm = new THREE.Mesh(lensGeo, houseMats.wallSconceGlow);
    lensBtm.position.set(0, -0.1, 0.035);
    sconce.add(lensBtm);

    return sconce;
  }

  /**
   * Creates an architectural downspout pipe running down the facade
   */
  function createDownspout(x, yTop, z, height, rotY = 0) {
    const downspout = new THREE.Group();
    downspout.position.set(x, yTop - height, z);
    downspout.rotation.y = rotY;

    // Main vertical pipe
    const pipeGeo = new THREE.CylinderGeometry(0.042, 0.042, height, 8);
    const pipe = new THREE.Mesh(pipeGeo, houseMats.downspoutMetal);
    pipe.position.set(0, height / 2, 0.05);
    pipe.castShadow = true;
    downspout.add(pipe);

    // Collector hopper head at top
    const hopperGeo = new THREE.BoxGeometry(0.18, 0.2, 0.16);
    const hopper = new THREE.Mesh(hopperGeo, houseMats.downspoutMetal);
    hopper.position.set(0, height - 0.1, 0.06);
    hopper.castShadow = true;
    downspout.add(hopper);

    // Curved shoe at base
    const shoeGeo = new THREE.BoxGeometry(0.09, 0.08, 0.14);
    const shoe = new THREE.Mesh(shoeGeo, houseMats.downspoutMetal);
    shoe.position.set(0, 0.04, 0.1);
    downspout.add(shoe);

    // Pipe mounting bracket collars
    const collarGeo = new THREE.BoxGeometry(0.11, 0.03, 0.12);
    for (let h = 1.0; h < height - 0.5; h += 2.0) {
      const collar = new THREE.Mesh(collarGeo, houseMats.metalDarkBronze);
      collar.position.set(0, h, 0.04);
      downspout.add(collar);
    }

    return downspout;
  }

  /**
   * Creates a flat roof with raised parapet walls, metal coping caps, and recessed roof membrane
   */
  function createParapetRoof(w, d, parapetH = 0.38, wallMat = houseMats.plasterCrispWhite) {
    const roof = new THREE.Group();
    const wallThick = 0.22;

    // Recessed roof membrane / gravel surface
    const membraneGeo = new THREE.BoxGeometry(w - wallThick * 2, 0.08, d - wallThick * 2);
    const membrane = new THREE.Mesh(membraneGeo, houseMats.roofMembraneFlat);
    membrane.position.y = -parapetH / 2 + 0.04;
    membrane.receiveShadow = true;
    roof.add(membrane);

    // Parapet Wall Edges
    const frontGeo = new THREE.BoxGeometry(w, parapetH, wallThick);
    const sideGeo = new THREE.BoxGeometry(wallThick, parapetH, d - wallThick * 2);

    const pNorth = new THREE.Mesh(frontGeo, wallMat);
    pNorth.position.set(0, 0, -d / 2 + wallThick / 2);
    pNorth.castShadow = true;
    roof.add(pNorth);

    const pSouth = new THREE.Mesh(frontGeo, wallMat);
    pSouth.position.set(0, 0, d / 2 - wallThick / 2);
    pSouth.castShadow = true;
    roof.add(pSouth);

    const pWest = new THREE.Mesh(sideGeo, wallMat);
    pWest.position.set(-w / 2 + wallThick / 2, 0, 0);
    pWest.castShadow = true;
    roof.add(pWest);

    const pEast = new THREE.Mesh(sideGeo, wallMat);
    pEast.position.set(w / 2 - wallThick / 2, 0, 0);
    pEast.castShadow = true;
    roof.add(pEast);

    // Continuous Architectural Metal Coping Cap along top rim
    const capThick = 0.05;
    const capOverhang = 0.04;
    const capFrontGeo = new THREE.BoxGeometry(w + capOverhang * 2, capThick, wallThick + capOverhang * 2);
    const capSideGeo = new THREE.BoxGeometry(wallThick + capOverhang * 2, capThick, d - wallThick * 2);

    const capN = new THREE.Mesh(capFrontGeo, houseMats.parapetCapping);
    capN.position.set(0, parapetH / 2 + capThick / 2, -d / 2 + wallThick / 2);
    capN.castShadow = true;
    roof.add(capN);

    const capS = new THREE.Mesh(capFrontGeo, houseMats.parapetCapping);
    capS.position.set(0, parapetH / 2 + capThick / 2, d / 2 - wallThick / 2);
    capS.castShadow = true;
    roof.add(capS);

    const capW = new THREE.Mesh(capSideGeo, houseMats.parapetCapping);
    capW.position.set(-w / 2 + wallThick / 2, parapetH / 2 + capThick / 2, 0);
    capW.castShadow = true;
    roof.add(capW);

    const capE = new THREE.Mesh(capSideGeo, houseMats.parapetCapping);
    capE.position.set(w / 2 - wallThick / 2, parapetH / 2 + capThick / 2, 0);
    capE.castShadow = true;
    roof.add(capE);

    return roof;
  }

  /**
   * Creates an architectural cantilever canopy with fascia drip edge and optional slim posts
   */
  function createCanopy(w, d, thick = 0.12, mat = houseMats.metalDarkBronze, postCount = 0) {
    const canopy = new THREE.Group();

    // Canopy slab
    const slabGeo = new THREE.BoxGeometry(w, thick, d);
    const slab = new THREE.Mesh(slabGeo, mat);
    slab.castShadow = true;
    slab.receiveShadow = true;
    canopy.add(slab);

    // Optional slim structural support columns (for porches)
    if (postCount > 0) {
      const postH = 2.8;
      const postGeo = new THREE.BoxGeometry(0.11, postH, 0.11);
      const pxList = postCount === 1 ? [w / 2 - 0.15] : [-w / 2 + 0.18, w / 2 - 0.18];
      pxList.forEach((px) => {
        const post = new THREE.Mesh(postGeo, mat);
        post.position.set(px, -postH / 2, d / 2 - 0.15);
        post.castShadow = true;
        canopy.add(post);
      });
    }

    return canopy;
  }

  /**
   * Creates an upper balcony with floor slab, soffit shadow line, and perimeter safety railing
   */
  function createBalcony(w, d, options = {}) {
    const {
      slabThick = 0.16,
      railHeight = 1.0,
      railType = 'metal', // 'metal' or 'glass'
      slabMat = houseMats.concretePaleSand,
      railMat = houseMats.metalHandrail,
    } = options;

    const balc = new THREE.Group();

    // Cantilever floor slab
    const slabGeo = new THREE.BoxGeometry(w, slabThick, d);
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.castShadow = true;
    slab.receiveShadow = true;
    balc.add(slab);

    // Soffit shadow trim
    const trimGeo = new THREE.BoxGeometry(w + 0.04, 0.04, d + 0.04);
    const trim = new THREE.Mesh(trimGeo, houseMats.metalDarkBronze);
    trim.position.y = -slabThick / 2 - 0.02;
    balc.add(trim);

    // Railing Assembly
    const topRailGeo = new THREE.BoxGeometry(w, 0.05, 0.06);
    const topRail = new THREE.Mesh(topRailGeo, railMat);
    topRail.position.set(0, slabThick / 2 + railHeight, d / 2 - 0.03);
    topRail.castShadow = true;
    balc.add(topRail);

    // Side top rails
    const sideRailGeo = new THREE.BoxGeometry(0.06, 0.05, d);
    const leftRail = new THREE.Mesh(sideRailGeo, railMat);
    leftRail.position.set(-w / 2 + 0.03, slabThick / 2 + railHeight, 0);
    balc.add(leftRail);

    const rightRail = new THREE.Mesh(sideRailGeo, railMat);
    rightRail.position.set(w / 2 - 0.03, slabThick / 2 + railHeight, 0);
    balc.add(rightRail);

    if (railType === 'glass') {
      const glassGeo = new THREE.PlaneGeometry(w - 0.1, railHeight - 0.12);
      const glassFront = new THREE.Mesh(glassGeo, houseMats.glassBalustrade);
      glassFront.position.set(0, slabThick / 2 + railHeight / 2, d / 2 - 0.03);
      balc.add(glassFront);

      const sideGlassGeo = new THREE.PlaneGeometry(d - 0.1, railHeight - 0.12);
      sideGlassGeo.rotateY(Math.PI / 2);
      const glassL = new THREE.Mesh(sideGlassGeo, houseMats.glassBalustrade);
      glassL.position.set(-w / 2 + 0.03, slabThick / 2 + railHeight / 2, 0);
      balc.add(glassL);

      const glassR = new THREE.Mesh(sideGlassGeo, houseMats.glassBalustrade);
      glassR.position.set(w / 2 - 0.03, slabThick / 2 + railHeight / 2, 0);
      balc.add(glassR);
    } else {
      // Vertical metal balusters
      const balusterCount = Math.floor(w / 0.18);
      const bGeo = new THREE.BoxGeometry(0.025, railHeight - 0.06, 0.025);
      for (let i = 0; i <= balusterCount; i++) {
        const bx = -w / 2 + 0.05 + (i * (w - 0.1)) / balusterCount;
        const b = new THREE.Mesh(bGeo, railMat);
        b.position.set(bx, slabThick / 2 + (railHeight - 0.06) / 2, d / 2 - 0.03);
        b.castShadow = true;
        balc.add(b);
      }
    }

    return balc;
  }

  /**
   * Creates an architectural garage door with horizontal segmented panels and perimeter trim
   */
  function createGarageDoor(w, h, mat = houseMats.garagePaneling) {
    const garage = new THREE.Group();

    // Recessed door face
    const doorGeo = new THREE.BoxGeometry(w, h, 0.06);
    const door = new THREE.Mesh(doorGeo, mat);
    door.position.set(0, h / 2, 0);
    door.castShadow = true;
    garage.add(door);

    // Horizontal architectural panel joints
    const panelCount = 4;
    const jointGeo = new THREE.BoxGeometry(w + 0.02, 0.035, 0.075);
    for (let i = 1; i < panelCount; i++) {
      const jy = (i * h) / panelCount;
      const joint = new THREE.Mesh(jointGeo, houseMats.metalDarkBronze);
      joint.position.set(0, jy, 0);
      joint.castShadow = true;
      garage.add(joint);
    }

    // Outer perimeter casing frame
    const headGeo = new THREE.BoxGeometry(w + 0.16, 0.08, 0.12);
    const head = new THREE.Mesh(headGeo, houseMats.metalDarkBronze);
    head.position.set(0, h + 0.04, 0.03);
    head.castShadow = true;
    garage.add(head);

    const jambGeo = new THREE.BoxGeometry(0.08, h + 0.08, 0.12);
    const jambL = new THREE.Mesh(jambGeo, houseMats.metalDarkBronze);
    jambL.position.set(-w / 2 - 0.04, (h + 0.08) / 2, 0.03);
    garage.add(jambL);

    const jambR = new THREE.Mesh(jambGeo, houseMats.metalDarkBronze);
    jambR.position.set(w / 2 + 0.04, (h + 0.08) / 2, 0.03);
    garage.add(jambR);

    return garage;
  }

  /**
   * Creates a vertical or horizontal timber louver privacy screen
   */
  function createTimberLouvers(w, h, slatCount = 12, mat = houseMats.woodNaturalCedar) {
    const louverGroup = new THREE.Group();
    const slatW = w / slatCount * 0.55;
    const slatGeo = new THREE.BoxGeometry(slatW, h, 0.04);

    for (let i = 0; i < slatCount; i++) {
      const x = -w / 2 + slatW / 2 + (i * (w - slatW)) / (slatCount - 1);
      const slat = new THREE.Mesh(slatGeo, mat);
      slat.position.set(x, h / 2, 0);
      slat.castShadow = true;
      louverGroup.add(slat);
    }

    return louverGroup;
  }

  // =========================================================================
  // 3. THE SIX RESIDENTIAL HOUSES
  // =========================================================================

  // -------------------------------------------------------------------------
  // HOUSE 01: WARM MODERN FAMILY HOME (Lot 1: North side, x = -24, z = -17)
  // Two main floors, offset volumes, low-profile parapet, warm plaster + cedar + stone
  // -------------------------------------------------------------------------
  function buildHouse01() {
    const house = new THREE.Group();
    house.position.set(-24.0, 0, -17.5);

    // 1. Foundation Plinth (width 11.2m, depth 9.0m)
    const plinth = createPlinth(11.2, 9.0, 0.22);
    house.add(plinth);

    // 2. Primary Two-Story Volume (Living/Dining + Bedrooms)
    // Width 7.2m, Depth 7.6m, Height 6.2m, Center at x = 1.6, z = 0.2
    const primH = 6.2;
    const primW = 7.2;
    const primD = 7.6;
    const primX = 1.6;
    const primZ = 0.2;
    const primMass = createWallVolume(primW, primH, primD, houseMats.plasterWarmIvory, primX, 0.22 + primH / 2, primZ);
    house.add(primMass);

    // Parapet roof on primary mass
    const primRoof = createParapetRoof(primW, primD, 0.38, houseMats.plasterWarmIvory);
    primRoof.position.set(primX, 0.22 + primH + 0.19, primZ);
    house.add(primRoof);

    // 3. Secondary Ground-Floor Wing (Garage / Service Studio)
    // Width 3.8m, Depth 6.4m, Height 3.3m, Center at x = -3.7, z = 0.7
    const secW = 3.8;
    const secH = 3.3;
    const secD = 6.4;
    const secX = -3.7;
    const secZ = 0.7;
    const secMass = createWallVolume(secW, secH, secD, houseMats.stoneDarkBasalt, secX, 0.22 + secH / 2, secZ);
    house.add(secMass);

    // Garage door facing front driveway (+Z)
    const garageDoor = createGarageDoor(2.8, 2.4, houseMats.garagePaneling);
    garageDoor.position.set(secX, 0.22, secZ + secD / 2 + 0.04);
    house.add(garageDoor);

    const secRoof = createParapetRoof(secW, secD, 0.32, houseMats.stoneDarkBasalt);
    secRoof.position.set(secX, 0.22 + secH + 0.16, secZ);
    house.add(secRoof);

    // 4. Recessed Front Entrance with Warm Cedar Accent Wall
    // Positioned at x = -0.6, z = 3.8
    const entryW = 2.4;
    const entryH = 3.1;
    const cedarWall = createWallVolume(entryW, entryH, 0.15, houseMats.woodNaturalCedar, -0.4, 0.22 + entryH / 2, primZ + primD / 2 - 0.2);
    house.add(cedarWall);

    // Front door
    const frontDoor = createDoor(1.15, 2.35, { doorMat: houseMats.woodDarkTeak, glassPanel: true });
    frontDoor.position.set(-0.4, 0.22, primZ + primD / 2 - 0.12);
    house.add(frontDoor);

    // Architectural Entrance Canopy (extends out over threshold)
    const entryCanopy = createCanopy(3.2, 1.6, 0.12, houseMats.metalDarkBronze, 1);
    entryCanopy.position.set(-0.2, 0.22 + 3.1, primZ + primD / 2 + 0.7);
    house.add(entryCanopy);

    // Sconce at door
    house.add(createWallSconce(0.45, 0.22 + 1.8, primZ + primD / 2 + 0.02, 0));

    // 5. Windows on Primary Volume
    // Ground Floor: Large Living Room Glass (Width 3.2m, Height 2.2m)
    const winLiving = createWindow(3.2, 2.2, { mullionV: 2, sill: true });
    winLiving.position.set(3.4, 0.22 + 1.45, primZ + primD / 2 + 0.04);
    house.add(winLiving);

    // Upper Floor: Master Bedroom Balcony & Windows
    // Upper Balcony cantilevered out at x = 3.2, z = 4.4, y = 3.4
    const balc = createBalcony(3.4, 1.2, { railType: 'metal', slabMat: houseMats.concretePaleSand });
    balc.position.set(3.4, 0.22 + 3.2, primZ + primD / 2 + 0.6);
    house.add(balc);

    // Sliding Balcony Door
    const balcDoor = createWindow(2.8, 2.2, { mullionV: 1, sill: false });
    balcDoor.position.set(3.4, 0.22 + 4.4, primZ + primD / 2 + 0.04);
    house.add(balcDoor);

    // Upper Bedroom Window 2
    const winBed = createWindow(1.4, 1.5, { mullionV: 1, sill: true });
    winBed.position.set(0.2, 0.22 + 4.75, primZ + primD / 2 + 0.04);
    house.add(winBed);

    // Downspouts on corners
    house.add(createDownspout(primX + primW / 2 + 0.05, 0.22 + primH + 0.2, primZ + primD / 2, primH, 0));
    house.add(createDownspout(secX - secW / 2 - 0.05, 0.22 + secH + 0.15, secZ + secD / 2, secH, 0));

    return house;
  }

  // -------------------------------------------------------------------------
  // HOUSE 02: COMPACT URBAN CONTEMPORARY (Lot 2: North side, x = -5, z = -17)
  // Compact footprint, two floors, asymmetrical cantilevered upper volume, vertical slat accents
  // -------------------------------------------------------------------------
  function buildHouse02() {
    const house = new THREE.Group();
    house.position.set(-5.0, 0, -17.5);

    // 1. Foundation Plinth (width 8.8m, depth 8.4m)
    const plinth = createPlinth(8.8, 8.4, 0.24);
    house.add(plinth);

    // 2. Ground Floor Volume (Width 8.0m, Depth 7.6m, Height 3.1m)
    const gH = 3.1;
    const gW = 8.0;
    const gD = 7.6;
    const groundMass = createWallVolume(gW, gH, gD, houseMats.plasterLightGreige, 0, 0.24 + gH / 2, 0);
    house.add(groundMass);

    // 3. Asymmetrical Cantilevered Upper Volume (Width 5.6m, Depth 8.0m, Height 3.2m)
    // Offset to the right (x = 1.0) and projecting 0.6m forward over the ground floor
    const uW = 5.6;
    const uH = 3.2;
    const uD = 8.0;
    const uX = 1.0;
    const uZ = 0.3;
    const upperMass = createWallVolume(uW, uH, uD, houseMats.plasterCrispWhite, uX, 0.24 + gH + uH / 2, uZ);
    house.add(upperMass);

    // Upper Parapet Roof
    const upperRoof = createParapetRoof(uW, uD, 0.36, houseMats.plasterCrispWhite);
    upperRoof.position.set(uX, 0.24 + gH + uH + 0.18, uZ);
    house.add(upperRoof);

    // Ground floor roof terrace on the left side (x = -2.8)
    const terW = 2.4;
    const terD = 7.6;
    const terRoof = createParapetRoof(terW, terD, 0.28, houseMats.plasterLightGreige);
    terRoof.position.set(-2.8, 0.24 + gH + 0.14, 0);
    house.add(terRoof);

    // 4. Feature Vertical Slat Wall & Carport Zone on the Left (x = -2.8, facing driveway)
    const slatScreen = createTimberLouvers(2.2, 2.7, 10, houseMats.woodNaturalCedar);
    slatScreen.position.set(-2.8, 0.24, gD / 2 + 0.05);
    house.add(slatScreen);

    // Compact carport gate / panel
    const carportWall = createWallVolume(2.2, 2.8, 0.12, houseMats.metalDarkBronze, -2.8, 0.24 + 1.4, gD / 2 - 0.2);
    house.add(carportWall);

    // 5. Recessed Front Door & Covered Canopy
    const frontDoor = createDoor(1.05, 2.3, { doorMat: houseMats.woodPaleOak });
    frontDoor.position.set(0.2, 0.24, gD / 2 + 0.02);
    house.add(frontDoor);

    const canopy = createCanopy(2.0, 1.2, 0.1, houseMats.metalDarkBronze);
    canopy.position.set(0.2, 0.24 + 2.85, gD / 2 + 0.6);
    house.add(canopy);

    house.add(createWallSconce(-0.6, 0.24 + 1.8, gD / 2 + 0.08, 0));

    // 6. Asymmetric Windows with Vertical Proportion
    // Ground Floor: Tall vertical ribbon window beside entrance
    const winG1 = createWindow(1.2, 2.1, { sill: true, mullionH: 1 });
    winG1.position.set(2.4, 0.24 + 1.4, gD / 2 + 0.04);
    house.add(winG1);

    // Upper Floor: Pair of tall vertical architectural slit windows
    const winU1 = createWindow(0.9, 1.9, { sill: true });
    winU1.position.set(0.0, 0.24 + gH + 1.6, uZ + uD / 2 + 0.04);
    house.add(winU1);

    const winU2 = createWindow(1.8, 1.9, { mullionV: 1, sill: true });
    winU2.position.set(2.2, 0.24 + gH + 1.6, uZ + uD / 2 + 0.04);
    house.add(winU2);

    // Upper small cantilever balcony on the side
    const sideBalc = createBalcony(1.6, 0.9, { railType: 'metal' });
    sideBalc.position.set(uX + uW / 2 + 0.45, 0.24 + gH + 0.8, uZ);
    sideBalc.rotation.y = Math.PI / 2;
    house.add(sideBalc);

    // Downspout on northeast corner
    house.add(createDownspout(uX + uW / 2 + 0.04, 0.24 + gH + uH + 0.18, uZ + uD / 2, gH + uH, 0));

    return house;
  }

  // -------------------------------------------------------------------------
  // HOUSE 03: MODERN PITCHED-ROOF FAMILY HOUSE (Lot 3: North side, x = 14, z = -17)
  // Prominent pitched gable roof, timber accent, front porch with columns & railings, gutters
  // -------------------------------------------------------------------------
  function buildHouse03() {
    const house = new THREE.Group();
    house.position.set(14.5, 0, -17.5);

    // 1. Foundation Plinth (width 9.8m, depth 8.6m)
    const plinth = createPlinth(9.8, 8.6, 0.26);
    house.add(plinth);

    // 2. Main Two-Story Body (Width 8.8m, Depth 7.8m, Eaves Height 5.4m)
    const bodyW = 8.8;
    const bodyD = 7.8;
    const eavesH = 5.4;
    const mainBody = createWallVolume(bodyW, eavesH, bodyD, houseMats.plasterWarmIvory, 0, 0.26 + eavesH / 2, 0);
    house.add(mainBody);

    // 3. Gable Ends & Prominent Pitched Roof
    // Ridge runs along Z axis (from -bodyD/2 to +bodyD/2). Gable triangles face Front (+Z) and Rear (-Z)
    const roofPitchH = 2.4; // Total height = 5.4 + 2.4 = 7.8m
    const roofOverhang = 0.55;
    const roofThickness = 0.18;

    // Gable triangular wall cladding (Front +Z and Rear -Z)
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-bodyW / 2, 0);
    gableShape.lineTo(bodyW / 2, 0);
    gableShape.lineTo(0, roofPitchH);
    gableShape.closePath();

    const gableExtrudeSettings = { depth: 0.16, bevelEnabled: false };
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, gableExtrudeSettings);

    const frontGable = new THREE.Mesh(gableGeo, houseMats.woodPaleOak);
    frontGable.position.set(0, 0.26 + eavesH, bodyD / 2 - 0.16);
    frontGable.castShadow = true;
    house.add(frontGable);

    const rearGable = new THREE.Mesh(gableGeo, houseMats.plasterWarmIvory);
    rearGable.position.set(0, 0.26 + eavesH, -bodyD / 2);
    rearGable.castShadow = true;
    house.add(rearGable);

    // Left and Right Pitched Roof Slabs with genuine thickness and overhang
    const roofSlopeLen = Math.sqrt(Math.pow(bodyW / 2 + roofOverhang, 2) + Math.pow(roofPitchH, 2));
    const roofAngle = Math.atan2(roofPitchH, bodyW / 2 + roofOverhang);
    const roofTotalD = bodyD + roofOverhang * 2;

    const slabGeo = new THREE.BoxGeometry(roofSlopeLen, roofThickness, roofTotalD);

    // Left roof slope
    const roofLeft = new THREE.Mesh(slabGeo, houseMats.roofPitchedSlate);
    roofLeft.rotation.z = roofAngle;
    const midX_L = -(bodyW / 2 + roofOverhang) / 2;
    const midY_L = 0.26 + eavesH + roofPitchH / 2;
    roofLeft.position.set(midX_L, midY_L, 0);
    roofLeft.castShadow = true;
    roofLeft.receiveShadow = true;
    house.add(roofLeft);

    // Right roof slope
    const roofRight = new THREE.Mesh(slabGeo, houseMats.roofPitchedSlate);
    roofRight.rotation.z = -roofAngle;
    const midX_R = (bodyW / 2 + roofOverhang) / 2;
    const midY_R = 0.26 + eavesH + roofPitchH / 2;
    roofRight.position.set(midX_R, midY_R, 0);
    roofRight.castShadow = true;
    roofRight.receiveShadow = true;
    house.add(roofRight);

    // Ridge cap along top
    const ridgeGeo = new THREE.BoxGeometry(0.24, 0.1, roofTotalD + 0.05);
    const ridge = new THREE.Mesh(ridgeGeo, houseMats.metalDarkBronze);
    ridge.position.set(0, 0.26 + eavesH + roofPitchH + 0.04, 0);
    ridge.castShadow = true;
    house.add(ridge);

    // Eaves Gutters (Left & Right along roof bottoms)
    const gutterGeo = new THREE.BoxGeometry(0.12, 0.1, roofTotalD);
    const gutterL = new THREE.Mesh(gutterGeo, houseMats.metalDarkBronze);
    gutterL.position.set(-bodyW / 2 - roofOverhang + 0.04, 0.26 + eavesH - 0.06, 0);
    house.add(gutterL);

    const gutterR = new THREE.Mesh(gutterGeo, houseMats.metalDarkBronze);
    gutterR.position.set(bodyW / 2 + roofOverhang - 0.04, 0.26 + eavesH - 0.06, 0);
    house.add(gutterR);

    // Downspouts from gutters
    house.add(createDownspout(-bodyW / 2 - roofOverhang + 0.08, 0.26 + eavesH - 0.06, bodyD / 2, eavesH, 0));
    house.add(createDownspout(bodyW / 2 + roofOverhang - 0.08, 0.26 + eavesH - 0.06, bodyD / 2, eavesH, 0));

    // 4. Front Porch with Slender Columns, Porch Roof, and Railing
    // Width 4.8m, Depth 1.8m, positioned on the right side connecting to walkway (x = 1.4)
    const porchW = 4.8;
    const porchD = 1.8;
    const porchX = 1.6;
    const porchZ = bodyD / 2 + porchD / 2;

    // Porch floor slab at y = 0.26
    const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(porchW, 0.16, porchD), houseMats.concretePaleSand);
    porchFloor.position.set(porchX, 0.26 + 0.08, porchZ);
    porchFloor.receiveShadow = true;
    house.add(porchFloor);

    // Porch canopy roof at y = 3.2m
    const porchRoof = createCanopy(porchW + 0.4, porchD + 0.3, 0.14, houseMats.metalDarkBronze, 2);
    porchRoof.position.set(porchX, 0.26 + 3.1, porchZ);
    house.add(porchRoof);

    // Porch perimeter handrail
    const porchRail = new THREE.Mesh(new THREE.BoxGeometry(porchW * 0.4, 0.04, 0.05), houseMats.metalHandrail);
    porchRail.position.set(porchX - porchW * 0.28, 0.26 + 0.95, porchZ + porchD / 2 - 0.05);
    house.add(porchRail);

    // Porch steps (2 steps down to walkway)
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.45), houseMats.concretePaleSand);
    step1.position.set(porchX + 1.1, 0.26 - 0.02, porchZ + porchD / 2 + 0.22);
    house.add(step1);

    const step2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.45), houseMats.concretePaleSand);
    step2.position.set(porchX + 1.1, 0.14, porchZ + porchD / 2 + 0.55);
    house.add(step2);

    // Front Entrance Door on porch
    const frontDoor = createDoor(1.1, 2.3, { doorMat: houseMats.woodNaturalCedar, glassPanel: true });
    frontDoor.position.set(porchX + 1.1, 0.26, bodyD / 2 + 0.02);
    house.add(frontDoor);

    house.add(createWallSconce(porchX + 0.2, 0.26 + 1.8, bodyD / 2 + 0.06, 0));

    // 5. Windows with Deliberate Architectural Rhythm
    // Ground Floor: Porch double window
    const winP = createWindow(1.8, 1.8, { mullionV: 1, mullionH: 1, sill: true });
    winP.position.set(porchX - 1.2, 0.26 + 1.6, bodyD / 2 + 0.04);
    house.add(winP);

    // Ground Floor: Left Living Room Bay Window (x = -2.4)
    const winG = createWindow(2.8, 2.1, { mullionV: 2, sill: true });
    winG.position.set(-2.4, 0.26 + 1.5, bodyD / 2 + 0.04);
    house.add(winG);

    // Upper Floor: Pair of balanced mullioned windows
    const winU_L = createWindow(1.8, 1.7, { mullionV: 1, mullionH: 1, sill: true });
    winU_L.position.set(-2.4, 0.26 + 4.1, bodyD / 2 + 0.04);
    house.add(winU_L);

    const winU_R = createWindow(1.8, 1.7, { mullionV: 1, mullionH: 1, sill: true });
    winU_R.position.set(2.4, 0.26 + 4.1, bodyD / 2 + 0.04);
    house.add(winU_R);

    // Attic Gable Feature Round/Hex or Square Vent Window
    const atticWin = createWindow(1.0, 1.0, { mullionV: 1, mullionH: 1, sill: true });
    atticWin.position.set(0, 0.26 + eavesH + 1.0, bodyD / 2 + 0.02);
    house.add(atticWin);

    return house;
  }

  // -------------------------------------------------------------------------
  // HOUSE 04: ACCESSIBLE SINGLE-STORY RESIDENCE (Lot 4: South side, x = -24, z = 17)
  // Low horizontal profile, integrated architectural ramp with handrail, broad sheltered entry, wide door
  // Faces NORTH towards the street (front is at -Z)
  // -------------------------------------------------------------------------
  function buildHouse04() {
    const house = new THREE.Group();
    house.position.set(-24.0, 0, 17.5);

    // 1. Foundation Plinth (wider horizontal footprint: 11.4m x 8.4m)
    const plinth = createPlinth(11.4, 8.4, 0.26);
    house.add(plinth);

    // 2. Single-Story Main Living Mass (Height 3.6m)
    const massW = 10.8;
    const massH = 3.6;
    const massD = 7.8;
    const mainMass = createWallVolume(massW, massH, massD, houseMats.plasterCrispWhite, 0, 0.26 + massH / 2, 0);
    house.add(mainMass);

    // Terracotta / Sandstone Facade Accent Panel on bedroom wing (x = -3.2)
    const accentW = 4.2;
    const accentH = 3.6;
    const accentMass = createWallVolume(accentW, accentH, 0.12, houseMats.plasterTerracotta, -3.2, 0.26 + massH / 2, -massD / 2 - 0.05);
    house.add(accentMass);

    // Low-profile parapet roof with broad perimeter fascia
    const roof = createParapetRoof(massW, massD, 0.35, houseMats.plasterCrispWhite);
    roof.position.set(0, 0.26 + massH + 0.17, 0);
    house.add(roof);

    // 3. Sheltered Porch & Broad Entrance Landing (facing -Z towards avenue)
    const porchW = 4.6;
    const porchD = 2.2;
    const porchX = 2.4;
    const porchZ = -massD / 2 - porchD / 2;

    const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(porchW, 0.14, porchD), houseMats.concretePaleSand);
    porchFloor.position.set(porchX, 0.26 + 0.07, porchZ);
    porchFloor.receiveShadow = true;
    house.add(porchFloor);

    // Deep sheltering porch canopy extending forward
    const porchCanopy = createCanopy(porchW + 0.4, porchD + 0.6, 0.14, houseMats.woodNaturalCedar, 2);
    porchCanopy.position.set(porchX, 0.26 + 3.2, porchZ);
    house.add(porchCanopy);

    // 4. Integrated Architectural Accessibility Ramp (Gentle slope from walkway up to porch landing)
    // Runs along front from x = -0.4 up to porch at x = 1.0 (length 2.8m, rise 0.22m, slope ~1:13)
    const rampL = 2.8;
    const rampW = 1.4;
    const rampSlope = Math.atan2(0.22, rampL);

    const rampShape = new THREE.Shape();
    rampShape.moveTo(0, 0);
    rampShape.lineTo(rampL, 0.22);
    rampShape.lineTo(rampL, 0);
    rampShape.closePath();

    const rampExtrude = new THREE.ExtrudeGeometry(rampShape, { depth: rampW, bevelEnabled: false });
    const rampMesh = new THREE.Mesh(rampExtrude, houseMats.concretePaleSand);
    // Extrude extends along Z, position so it connects smoothly
    rampMesh.position.set(porchX - porchW / 2 - rampL, 0.12, porchZ - rampW / 2);
    rampMesh.receiveShadow = true;
    house.add(rampMesh);

    // Architectural Ramp Handrail (Continuous brushed metal handrail along outer edge)
    const railLen = Math.sqrt(rampL * rampL + 0.22 * 0.22);
    const railGeo = new THREE.CylinderGeometry(0.024, 0.024, railLen, 8);
    railGeo.rotateZ(Math.PI / 2 - rampSlope);
    const rampRail = new THREE.Mesh(railGeo, houseMats.metalHandrail);
    rampRail.position.set(porchX - porchW / 2 - rampL / 2, 0.12 + 0.95 + 0.11, porchZ - rampW / 2);
    rampRail.castShadow = true;
    house.add(rampRail);

    // Handrail vertical stanchions
    const stanchionGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.95, 6);
    for (let i = 0; i <= 3; i++) {
      const sx = porchX - porchW / 2 - rampL + (i * rampL) / 3;
      const sy = 0.12 + (i * 0.22) / 3 + 0.475;
      const stanchion = new THREE.Mesh(stanchionGeo, houseMats.metalHandrail);
      stanchion.position.set(sx, sy, porchZ - rampW / 2);
      stanchion.castShadow = true;
      house.add(stanchion);
    }

    // 5. Wide Accessible Entrance Door (Width 1.35m, clear threshold)
    const frontDoor = createDoor(1.35, 2.3, { doorMat: houseMats.woodPaleOak, glassPanel: true });
    frontDoor.position.set(porchX + 0.8, 0.26, -massD / 2 - 0.02);
    frontDoor.rotation.y = Math.PI; // Faces -Z towards street
    house.add(frontDoor);

    house.add(createWallSconce(porchX - 0.3, 0.26 + 1.8, -massD / 2 - 0.06, Math.PI));

    // 6. Generous Daylight Ribbon & Picture Windows
    // Living Room Picture Window on Porch (Width 2.4m, Height 2.1m)
    const winPorch = createWindow(2.4, 2.1, { mullionV: 1, sill: true });
    winPorch.position.set(porchX - 1.2, 0.26 + 1.45, -massD / 2 - 0.04);
    winPorch.rotation.y = Math.PI;
    house.add(winPorch);

    // Bedroom Wing Horizontal Ribbon Windows (Width 3.6m, Height 1.4m)
    const winRibbon = createWindow(3.6, 1.4, { mullionV: 2, sill: true });
    winRibbon.position.set(-3.2, 0.26 + 1.9, -massD / 2 - 0.12);
    winRibbon.rotation.y = Math.PI;
    house.add(winRibbon);

    // Downspout on northwest corner
    house.add(createDownspout(-massW / 2 - 0.04, 0.26 + massH + 0.15, -massD / 2, massH, Math.PI));

    return house;
  }

  // -------------------------------------------------------------------------
  // HOUSE 05: COURTYARD CONTEMPORARY (Lot 5: South side, x = -5, z = 17)
  // L-shaped massing, partially enclosed courtyard, privacy screen, deep window reveals
  // Faces NORTH towards street (courtyard is at the front-right)
  // -------------------------------------------------------------------------
  function buildHouse05() {
    const house = new THREE.Group();
    house.position.set(-5.0, 0, 17.5);

    // 1. Foundation Plinth (width 10.4m, depth 9.2m)
    const plinth = createPlinth(10.4, 9.2, 0.24);
    house.add(plinth);

    // 2. L-Shaped Massing Composition
    // Wing A: Rear Master & Living Wing (Runs full width 9.8m, depth 4.4m, height 5.8m, Center at z = 2.0)
    const rW = 9.8;
    const rH = 5.8;
    const rD = 4.4;
    const rZ = 2.0;
    const rearWing = createWallVolume(rW, rH, rD, houseMats.plasterWarmIvory, 0, 0.24 + rH / 2, rZ);
    house.add(rearWing);

    const rearRoof = createParapetRoof(rW, rD, 0.36, houseMats.plasterWarmIvory);
    rearRoof.position.set(0, 0.24 + rH + 0.18, rZ);
    house.add(rearRoof);

    // Wing B: Forward Studio & Garage Wing (Left side: width 4.2m, depth 4.4m, height 3.2m, Center at x = -2.8, z = -2.4)
    const fW = 4.2;
    const fH = 3.2;
    const fD = 4.4;
    const fX = -2.8;
    const fZ = -2.4;
    const forwardWing = createWallVolume(fW, fH, fD, houseMats.stoneDarkBasalt, fX, 0.24 + fH / 2, fZ);
    house.add(forwardWing);

    // Garage door on forward wing facing driveway (towards -Z street)
    const garageDoor = createGarageDoor(2.8, 2.4, houseMats.garagePaneling);
    garageDoor.position.set(fX, 0.24, fZ - fD / 2 - 0.04);
    garageDoor.rotation.y = Math.PI;
    house.add(garageDoor);

    const fwdRoof = createParapetRoof(fW, fD, 0.32, houseMats.stoneDarkBasalt);
    fwdRoof.position.set(fX, 0.24 + fH + 0.16, fZ);
    house.add(fwdRoof);

    // 3. Partially Enclosed Courtyard (Right side: width 5.2m, depth 4.4m, Center at x = 2.2, z = -2.4)
    // Courtyard Paver Terrace Floor
    const courtFloorGeo = new THREE.BoxGeometry(5.2, 0.08, 4.4);
    const courtFloor = new THREE.Mesh(courtFloorGeo, sceneMaterials.drivewayPavers);
    courtFloor.position.set(2.2, 0.24 + 0.04, -2.4);
    courtFloor.receiveShadow = true;
    house.add(courtFloor);

    // Front Privacy Wall & Timber Screen along street edge (z = -4.5)
    // Low masonry plinth wall + vertical cedar louvers
    const privacyWallGeo = new THREE.BoxGeometry(5.0, 0.7, 0.2);
    const privacyWall = new THREE.Mesh(privacyWallGeo, houseMats.concretePaleSand);
    privacyWall.position.set(2.2, 0.24 + 0.35, -4.5);
    privacyWall.castShadow = true;
    house.add(privacyWall);

    const courtLouvers = createTimberLouvers(4.6, 1.6, 12, houseMats.woodNaturalCedar);
    courtLouvers.position.set(2.2, 0.24 + 0.7, -4.5);
    house.add(courtLouvers);

    // Courtyard Planter with small architectural ornamental shrub
    const planterGeo = new THREE.BoxGeometry(1.6, 0.45, 1.2);
    const planter = new THREE.Mesh(planterGeo, houseMats.concretePaleSand);
    planter.position.set(3.6, 0.24 + 0.22, -1.6);
    planter.castShadow = true;
    house.add(planter);

    const plantSoilGeo = new THREE.BoxGeometry(1.4, 0.08, 1.0);
    const plantSoil = new THREE.Mesh(plantSoilGeo, sceneMaterials.gardenSoil);
    plantSoil.position.set(3.6, 0.24 + 0.45, -1.6);
    house.add(plantSoil);

    // 4. Large Courtyard-Facing Openings (Floor-to-ceiling sliding glass doors)
    // Facing north into the courtyard from rear wing (at z = -0.2)
    const glassSliding = createWindow(4.4, 2.4, { mullionV: 2, sill: false });
    glassSliding.position.set(2.2, 0.24 + 1.4, rZ - rD / 2 - 0.04);
    glassSliding.rotation.y = Math.PI;
    house.add(glassSliding);

    // Recessed Entrance Door accessed via the courtyard (at x = -0.6)
    const courtDoor = createDoor(1.15, 2.35, { doorMat: houseMats.woodNaturalCedar });
    courtDoor.position.set(-0.6, 0.24, -0.2);
    courtDoor.rotation.y = Math.PI;
    house.add(courtDoor);

    house.add(createWallSconce(0.3, 0.24 + 1.8, -0.25, Math.PI));

    // 5. Upper Floor Courtyard Windows
    const upperWin1 = createWindow(2.2, 1.6, { mullionV: 1, sill: true });
    upperWin1.position.set(2.2, 0.24 + 4.3, rZ - rD / 2 - 0.04);
    upperWin1.rotation.y = Math.PI;
    house.add(upperWin1);

    const upperWin2 = createWindow(1.4, 1.6, { sill: true });
    upperWin2.position.set(-2.2, 0.24 + 4.3, rZ - rD / 2 - 0.04);
    upperWin2.rotation.y = Math.PI;
    house.add(upperWin2);

    // Downspouts on courtyard corners
    house.add(createDownspout(-rW / 2 - 0.04, 0.24 + rH + 0.16, rZ + rD / 2, rH, Math.PI));
    house.add(createDownspout(rW / 2 + 0.04, 0.24 + rH + 0.16, rZ - rD / 2, rH, Math.PI));

    return house;
  }

  // -------------------------------------------------------------------------
  // HOUSE 06: LARGE CONTEMPORARY FAMILY RESIDENCE (Lot 6: South side, x = 14, z = 17)
  // Largest residence: layered masses, stepped flat roofs, recessed double garage, upper terrace, masonry accents
  // Faces NORTH towards street (front is at -Z)
  // -------------------------------------------------------------------------
  function buildHouse06() {
    const house = new THREE.Group();
    house.position.set(14.5, 0, 17.5);

    // 1. Foundation Plinth (width 12.0m, depth 9.8m)
    const plinth = createPlinth(12.0, 9.8, 0.28);
    house.add(plinth);

    // 2. Primary Ground Floor Body (Width 11.2m, Depth 8.8m, Height 3.4m)
    const gH = 3.4;
    const gW = 11.2;
    const gD = 8.8;
    const gMass = createWallVolume(gW, gH, gD, houseMats.plasterCrispWhite, 0, 0.28 + gH / 2, 0);
    house.add(gMass);

    // 3. Double-Width Recessed Garage Volume on Left (x = -3.4, width 4.8m)
    const garageDoor = createGarageDoor(4.2, 2.4, houseMats.garagePaneling);
    garageDoor.position.set(-3.2, 0.28, -gD / 2 - 0.04);
    garageDoor.rotation.y = Math.PI;
    house.add(garageDoor);

    // 4. Feature Masonry Stone Pier (Anchor wall running from ground to upper roof at x = -0.5)
    const pierW = 1.2;
    const pierH = 6.9;
    const pierD = 0.8;
    const stonePier = createWallVolume(pierW, pierH, pierD, houseMats.stoneDarkBasalt, -0.6, 0.28 + pierH / 2, -gD / 2 - 0.2);
    house.add(stonePier);

    // 5. Grand Entrance Composition beside the Stone Pier (x = 0.8)
    const entryW = 2.2;
    const entryCanopy = createCanopy(2.8, 1.8, 0.14, houseMats.woodNaturalCedar, 1);
    entryCanopy.position.set(1.1, 0.28 + 3.1, -gD / 2 - 0.8);
    house.add(entryCanopy);

    const frontDoor = createDoor(1.3, 2.45, { doorMat: houseMats.woodDarkTeak, glassPanel: true });
    frontDoor.position.set(1.1, 0.28, -gD / 2 - 0.02);
    frontDoor.rotation.y = Math.PI;
    house.add(frontDoor);

    house.add(createWallSconce(-0.1, 0.28 + 2.0, -gD / 2 - 0.06, Math.PI));

    // Ground Floor Living Room Glazing (x = 3.6, width 3.4m, height 2.4m)
    const winLiving = createWindow(3.4, 2.4, { mullionV: 2, sill: true });
    winLiving.position.set(3.6, 0.28 + 1.5, -gD / 2 - 0.04);
    winLiving.rotation.y = Math.PI;
    house.add(winLiving);

    // 6. Upper Floor Volume (Width 8.2m, Depth 8.0m, Height 3.2m, Center at x = 1.5)
    const uW = 8.2;
    const uH = 3.2;
    const uD = 8.0;
    const uX = 1.5;
    const uZ = 0.2;
    const upperMass = createWallVolume(uW, uH, uD, houseMats.plasterWarmIvory, uX, 0.28 + gH + uH / 2, uZ);
    house.add(upperMass);

    // Upper Parapet Roof
    const upperRoof = createParapetRoof(uW, uD, 0.38, houseMats.plasterWarmIvory);
    upperRoof.position.set(uX, 0.28 + gH + uH + 0.19, uZ);
    house.add(upperRoof);

    // Ground floor roof terrace on top of the garage (Left side: x = -3.8, width 3.8m, depth 8.0m)
    const terW = 3.6;
    const terD = 8.0;
    const terRoof = createParapetRoof(terW, terD, 0.3, houseMats.plasterCrispWhite);
    terRoof.position.set(-3.7, 0.28 + gH + 0.15, 0);
    house.add(terRoof);

    // Upper Master Suite Cantilever Balcony (Front at x = 3.6, z = -gD/2, width 3.6m)
    const upperBalc = createBalcony(3.6, 1.4, { railType: 'glass', slabMat: houseMats.concretePaleSand });
    upperBalc.position.set(3.4, 0.28 + gH, -gD / 2 - 0.65);
    upperBalc.rotation.y = Math.PI;
    house.add(upperBalc);

    // Upper Master Sliding Door
    const balcDoor = createWindow(3.0, 2.3, { mullionV: 1, sill: false });
    balcDoor.position.set(3.4, 0.28 + gH + 1.45, -gD / 2 - 0.04);
    balcDoor.rotation.y = Math.PI;
    house.add(balcDoor);

    // Upper Bedroom Window beside stone pier (x = 1.0)
    const winBed = createWindow(1.6, 1.8, { mullionV: 1, sill: true });
    winBed.position.set(1.0, 0.28 + gH + 1.7, -gD / 2 - 0.04);
    winBed.rotation.y = Math.PI;
    house.add(winBed);

    // Timber Slat Feature Bay on upper floor right side
    const louverPanel = createTimberLouvers(1.8, 2.4, 9, houseMats.woodNaturalCedar);
    louverPanel.position.set(uX + uW / 2 - 0.9, 0.28 + gH + 0.2, -gD / 2 - 0.15);
    louverPanel.rotation.y = Math.PI;
    house.add(louverPanel);

    // Downspouts on corners
    house.add(createDownspout(uX + uW / 2 + 0.04, 0.28 + gH + uH + 0.18, -gD / 2, gH + uH, Math.PI));
    house.add(createDownspout(-gW / 2 - 0.04, 0.28 + gH + 0.15, -gD / 2, gH, Math.PI));

    return house;
  }

  // =========================================================================
  // 4. ADD THE SIX RESIDENTIAL HOUSES TO THE NEIGHBORHOOD
  // =========================================================================
  group.add(buildHouse01());
  group.add(buildHouse02());
  group.add(buildHouse03());
  group.add(buildHouse04());
  group.add(buildHouse05());
  group.add(buildHouse06());

  return group;
}

