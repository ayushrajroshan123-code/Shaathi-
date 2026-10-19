import * as THREE from 'three';

/**
 * dioramaPeople.js
 * Procedural resident characters for the SAATHI diorama neighborhood.
 *
 * Supported Variants:
 * 1. 'girl' (default):
 *    - Faithful collectible vinyl figurine styling
 *    - White pinafore dress with gold buttons and Peter Pan collar
 *    - Voluminous long black hair with asymmetrical bangs and cascading locks
 *    - White cuffed socks and chunky black Mary Jane shoes
 *
 * 2. 'neighbor' (second resident):
 *    - Faithful collectible vinyl figurine styling from reference
 *    - Chocolate brown hair with stylish side-part swoop
 *    - Deep navy button eyes with specular highlights & thick brown eyebrows
 *    - Bright lime-green crew-neck T-shirt with collar torus and sleeve cuffs
 *    - Open teal/emerald-green sleeveless vest with front panels and hem
 *    - Classic straight denim-blue jeans with rolled ankle cuffs
 *    - Chunky mocha-brown sneakers with lime-green accent tongue and charcoal sole
 *
 * Both variants strictly share the underlying architecture:
 * - root group, hip/pelvis hierarchy (hipPivot at y = 0.48m)
 * - torso group, neck/head hierarchy (neckPivot at y = 0.25m, head at y = 0.22m)
 * - articulated shoulder, elbow, and wrist hand groups (leftHandGroup, rightHandGroup)
 * - articulated hip, knee, and foot groups
 * - identical ground alignment (soles touch y = 0.0m exactly)
 * - delta-time walking and idle animations, smooth turns, and route following
 */

export class DioramaPerson {
  constructor(options = {}) {
    this.variant = options.variant || 'girl';

    this.root = new THREE.Group();
    if (this.variant === 'neighbor') {
      this.root.name = 'DioramaPerson_Neighbor';
    } else if (this.variant === 'boy_blue') {
      this.root.name = 'DioramaPerson_BoyBlue';
    } else if (this.variant === 'helper') {
      this.root.name = 'DioramaPerson_Helper';
    } else if (this.variant === 'carry_requester') {
      this.root.name = 'DioramaPerson_CarryRequester';
    } else if (this.variant === 'ladder_lender') {
      this.root.name = 'DioramaPerson_LadderLender';
    } else {
      this.root.name = 'DioramaPerson_Girl';
    }

    // Walking & Animation Config
    this.walkSpeed = 1.1;
    this.isCarrying = false;
    this.isCarryingLadder = false;
    this.isCarryingBox = false;
    this.targetRotationY = null;
    this.reachAmount = 0.0;
    this.state = 'WALKING';
    this.walkCycle = 0;
    this.walkWeight = 0.0;
    this.route = [];
    this.routeIndex = 0;
    this.targetPosition = new THREE.Vector3();
    this.tempVec = new THREE.Vector3();

    // Scale for enhanced storytelling and diorama character readability
    this.root.scale.set(1.24, 1.24, 1.24);
    this.bubbleOffsetY = 1.48;

    // Reusable Materials Palette per variant
    if (this.variant === 'neighbor') {
      this.materials = this.createNeighborMaterials();
    } else if (this.variant === 'boy_blue') {
      this.materials = this.createBoyBlueMaterials();
    } else if (this.variant === 'helper') {
      this.materials = this.createHelperMaterials();
    } else if (this.variant === 'carry_requester') {
      this.materials = this.createRequesterMaterials();
    } else if (this.variant === 'ladder_lender') {
      this.materials = this.createLadderLenderMaterials();
    } else {
      this.materials = this.createGirlMaterials();
    }

    this.createGeometry();
  }

  createGirlMaterials() {
    return {
      skin: new THREE.MeshStandardMaterial({
        color: 0xffd8c2,
        roughness: 0.55,
        metalness: 0.0,
      }),
      dress: new THREE.MeshStandardMaterial({
        color: 0xfefefe,
        roughness: 0.42,
        metalness: 0.02,
      }),
      collar: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.38,
        metalness: 0.02,
      }),
      buttons: new THREE.MeshStandardMaterial({
        color: 0xdeb840,
        roughness: 0.3,
        metalness: 0.25,
      }),
      hair: new THREE.MeshStandardMaterial({
        color: 0x1c1c1f,
        roughness: 0.35,
        metalness: 0.05,
      }),
      eyes: new THREE.MeshStandardMaterial({
        color: 0x0e0e11,
        roughness: 0.15,
        metalness: 0.1,
      }),
      eyeShine: new THREE.MeshBasicMaterial({
        color: 0xffffff,
      }),
      eyebrows: new THREE.MeshStandardMaterial({
        color: 0x222225,
        roughness: 0.6,
      }),
      mouth: new THREE.MeshStandardMaterial({
        color: 0xd97575,
        roughness: 0.5,
      }),
      blush: new THREE.MeshStandardMaterial({
        color: 0xfdae9e,
        roughness: 0.8,
        transparent: true,
        opacity: 0.65,
      }),
      socks: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.65,
        metalness: 0.0,
      }),
      shoes: new THREE.MeshStandardMaterial({
        color: 0x141416,
        roughness: 0.28,
        metalness: 0.1,
      }),
      shoeSole: new THREE.MeshStandardMaterial({
        color: 0x222225,
        roughness: 0.6,
      }),
    };
  }

  createNeighborMaterials() {
    return {
      skin: new THREE.MeshStandardMaterial({
        color: 0xffd8c2,
        roughness: 0.55,
        metalness: 0.0,
      }),
      shirt: new THREE.MeshStandardMaterial({
        color: 0x91d13b, // Bright lime / spring green T-shirt
        roughness: 0.50,
        metalness: 0.02,
      }),
      vest: new THREE.MeshStandardMaterial({
        color: 0x20987a, // Open teal / emerald green vest
        roughness: 0.45,
        metalness: 0.02,
      }),
      pants: new THREE.MeshStandardMaterial({
        color: 0x336bb5, // Denim blue jeans
        roughness: 0.60,
        metalness: 0.02,
      }),
      pantsCuff: new THREE.MeshStandardMaterial({
        color: 0x2d5c9c, // Rolled denim cuff
        roughness: 0.60,
      }),
      hair: new THREE.MeshStandardMaterial({
        color: 0x4a2a18, // Rich chocolate brown sculpted hair
        roughness: 0.38,
        metalness: 0.05,
      }),
      eyes: new THREE.MeshStandardMaterial({
        color: 0x1b2845, // Deep glossy navy/blue eyes
        roughness: 0.15,
        metalness: 0.1,
      }),
      eyeShine: new THREE.MeshBasicMaterial({
        color: 0xffffff,
      }),
      eyebrows: new THREE.MeshStandardMaterial({
        color: 0x3a1f11, // Thick dark brown eyebrows
        roughness: 0.6,
      }),
      mouth: new THREE.MeshStandardMaterial({
        color: 0xd97575,
        roughness: 0.5,
      }),
      blush: new THREE.MeshStandardMaterial({
        color: 0xfdae9e,
        roughness: 0.8,
        transparent: true,
        opacity: 0.45,
      }),
      shoes: new THREE.MeshStandardMaterial({
        color: 0x523322, // Rich mocha brown sneakers
        roughness: 0.35,
        metalness: 0.05,
      }),
      shoeSole: new THREE.MeshStandardMaterial({
        color: 0x222225, // Charcoal rubber sole
        roughness: 0.65,
      }),
      shoeAccent: new THREE.MeshStandardMaterial({
        color: 0x91d13b, // Lime green tongue accent
        roughness: 0.5,
      }),
    };
  }

  createBoyBlueMaterials() {
    return {
      skin: new THREE.MeshStandardMaterial({
        color: 0xffd8c2,
        roughness: 0.55,
        metalness: 0.0,
      }),
      jacket: new THREE.MeshStandardMaterial({
        color: 0x8cbce8, // Light sky-blue buttoned jacket matching reference
        roughness: 0.48,
        metalness: 0.02,
      }),
      collar: new THREE.MeshStandardMaterial({
        color: 0xffffff, // Crisp white Peter Pan / spread collar
        roughness: 0.38,
        metalness: 0.01,
      }),
      cuffs: new THREE.MeshStandardMaterial({
        color: 0xffffff, // Crisp white sleeve cuffs
        roughness: 0.38,
        metalness: 0.01,
      }),
      buttons: new THREE.MeshStandardMaterial({
        color: 0xbfdcf9, // Soft pastel blue buttons
        roughness: 0.35,
        metalness: 0.1,
      }),
      badge: new THREE.MeshStandardMaterial({
        color: 0xde3b33, // Signature red square pocket badge on upper left chest
        roughness: 0.40,
        metalness: 0.05,
      }),
      pants: new THREE.MeshStandardMaterial({
        color: 0x384f74, // Slate navy blue trousers
        roughness: 0.58,
        metalness: 0.02,
      }),
      pantsCuff: new THREE.MeshStandardMaterial({
        color: 0x2e4262, // Rolled navy ankle cuffs
        roughness: 0.58,
      }),
      hair: new THREE.MeshStandardMaterial({
        color: 0x18181c, // Jet black glossy sculpted hair
        roughness: 0.28,
        metalness: 0.08,
      }),
      eyes: new THREE.MeshStandardMaterial({
        color: 0x0e0e11, // Glossy black button eyes
        roughness: 0.15,
        metalness: 0.1,
      }),
      eyeShine: new THREE.MeshBasicMaterial({
        color: 0xffffff, // Crisp white specular shine
      }),
      eyebrows: new THREE.MeshStandardMaterial({
        color: 0x202024,
        roughness: 0.6,
      }),
      mouth: new THREE.MeshStandardMaterial({
        color: 0xd97575,
        roughness: 0.5,
      }),
      blush: new THREE.MeshStandardMaterial({
        color: 0xfdae9e,
        roughness: 0.8,
        transparent: true,
        opacity: 0.55,
      }),
      shoes: new THREE.MeshStandardMaterial({
        color: 0x1c1c20, // Chunky black shoes
        roughness: 0.30,
        metalness: 0.08,
      }),
      shoeSole: new THREE.MeshStandardMaterial({
        color: 0x121215, // Charcoal rubber sole
        roughness: 0.65,
      }),
      shoeTrim: new THREE.MeshStandardMaterial({
        color: 0xffffff, // White shoe accent trim
        roughness: 0.45,
      }),
    };
  }

  createGeometry() {
    // Shared Base Hip Pivot (y = 0.48m)
    this.hipPivot = new THREE.Group();
    this.hipPivot.name = 'HipPivot';
    this.hipPivot.position.y = 0.48;
    this.root.add(this.hipPivot);

    // Shared Torso Group
    this.torso = new THREE.Group();
    this.torso.name = 'TorsoGroup';
    this.hipPivot.add(this.torso);

    // Torso Details
    if (this.variant === 'neighbor') {
      this.createNeighborTorso(this.torso);
    } else if (this.variant === 'boy_blue') {
      this.createBoyBlueTorso(this.torso);
    } else if (this.variant === 'helper') {
      this.createHelperTorso(this.torso);
    } else if (this.variant === 'carry_requester') {
      this.createRequesterTorso(this.torso);
    } else if (this.variant === 'ladder_lender') {
      this.createLadderLenderTorso(this.torso);
    } else {
      this.createGirlTorso(this.torso);
    }

    // Shared Neck & Head Hierarchy
    this.neckPivot = new THREE.Group();
    this.neckPivot.name = 'NeckPivot';
    this.neckPivot.position.y = 0.25;
    this.torso.add(this.neckPivot);

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 0.06, 12),
      this.materials.skin
    );
    neck.position.y = 0.03;
    neck.castShadow = true;
    this.neckPivot.add(neck);

    this.head = new THREE.Group();
    this.head.name = 'HeadGroup';
    this.head.position.y = 0.22;
    this.neckPivot.add(this.head);

    if (this.variant === 'neighbor') {
      this.createNeighborHead(this.head);
    } else if (this.variant === 'boy_blue') {
      this.createBoyBlueHead(this.head);
    } else if (this.variant === 'helper') {
      this.createHelperHead(this.head);
    } else if (this.variant === 'carry_requester') {
      this.createRequesterHead(this.head);
    } else if (this.variant === 'ladder_lender') {
      this.createLadderLenderHead(this.head);
    } else {
      this.createGirlHead(this.head);
    }

    // Arms & Hand Groups Hierarchy
    if (this.variant === 'neighbor') {
      this.createNeighborArms(this.torso);
    } else if (this.variant === 'boy_blue') {
      this.createBoyBlueArms(this.torso);
    } else if (this.variant === 'helper') {
      this.createHelperArms(this.torso);
    } else if (this.variant === 'carry_requester') {
      this.createRequesterArms(this.torso);
    } else if (this.variant === 'ladder_lender') {
      this.createLadderLenderArms(this.torso);
    } else {
      this.createGirlArms(this.torso);
    }

    // Legs Hierarchy
    if (this.variant === 'neighbor') {
      this.createNeighborLegs(this.hipPivot);
    } else if (this.variant === 'boy_blue') {
      this.createBoyBlueLegs(this.hipPivot);
    } else if (this.variant === 'helper') {
      this.createHelperLegs(this.hipPivot);
    } else if (this.variant === 'carry_requester') {
      this.createRequesterLegs(this.hipPivot);
    } else if (this.variant === 'ladder_lender') {
      this.createLadderLenderLegs(this.hipPivot);
    } else {
      this.createGirlLegs(this.hipPivot);
    }
  }

  // ===========================================================================
  // GIRL CHARACTER IMPLEMENTATION (100% UNCHANGED)
  // ===========================================================================
  createGirlTorso(torso) {
    const m = this.materials;
    const bodiceGeo = new THREE.CylinderGeometry(0.12, 0.145, 0.25, 18);
    const bodice = new THREE.Mesh(bodiceGeo, m.dress);
    bodice.position.y = 0.125;
    bodice.castShadow = true;
    bodice.receiveShadow = true;
    torso.add(bodice);

    const waistBelt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.148, 0.148, 0.02, 18),
      m.dress
    );
    waistBelt.position.y = 0.01;
    waistBelt.castShadow = true;
    torso.add(waistBelt);

    [-0.055, 0.055].forEach((bx) => {
      const button = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.012, 10),
        m.buttons
      );
      button.rotation.x = Math.PI / 2;
      button.position.set(bx, 0.185, 0.125);
      button.castShadow = true;
      torso.add(button);
    });

    const collarGroup = new THREE.Group();
    collarGroup.position.set(0, 0.245, 0.08);
    collarGroup.rotation.x = 0.25;

    [-0.045, 0.045].forEach((cx, idx) => {
      const lobe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.048, 0.014, 12),
        m.collar
      );
      lobe.scale.set(1.2, 1, 0.85);
      lobe.rotation.y = idx === 0 ? -0.2 : 0.2;
      lobe.position.set(cx, 0, 0);
      lobe.castShadow = true;
      collarGroup.add(lobe);
    });
    torso.add(collarGroup);

    const skirtGeo = new THREE.CylinderGeometry(0.145, 0.235, 0.18, 20);
    const skirt = new THREE.Mesh(skirtGeo, m.dress);
    skirt.position.y = -0.09;
    skirt.castShadow = true;
    skirt.receiveShadow = true;
    torso.add(skirt);

    const hemGeo = new THREE.TorusGeometry(0.232, 0.014, 8, 24);
    hemGeo.rotateX(Math.PI / 2);
    const skirtHem = new THREE.Mesh(hemGeo, m.dress);
    skirtHem.position.y = -0.18;
    skirtHem.castShadow = true;
    torso.add(skirtHem);
  }

  createGirlHead(head) {
    const m = this.materials;
    const headGeo = new THREE.SphereGeometry(0.20, 20, 18);
    headGeo.scale(1.1, 0.95, 1.0);
    const headMesh = new THREE.Mesh(headGeo, m.skin);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    head.add(headMesh);

    [-0.12, 0.12].forEach((cx) => {
      const cheekPuff = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 10),
        m.skin
      );
      cheekPuff.scale.set(1.1, 0.8, 0.9);
      cheekPuff.position.set(cx, -0.05, 0.08);
      head.add(cheekPuff);
    });

    [-0.205, 0.205].forEach((ex, idx) => {
      const ear = new THREE.Mesh(
        new THREE.SphereGeometry(0.048, 10, 10),
        m.skin
      );
      ear.scale.set(0.4, 1.1, 0.9);
      ear.rotation.y = idx === 0 ? -0.15 : 0.15;
      ear.position.set(ex, -0.01, 0.01);
      ear.castShadow = true;
      head.add(ear);
    });

    [-0.095, 0.095].forEach((eyeX, idx) => {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.044, 16, 14),
        m.eyes
      );
      eye.scale.set(1.0, 1.05, 0.4);
      eye.position.set(eyeX, 0.005, 0.176);
      head.add(eye);

      const shinePrimary = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 8),
        m.eyeShine
      );
      shinePrimary.position.set(eyeX + 0.014, 0.018, 0.194);
      head.add(shinePrimary);

      const shineSecondary = new THREE.Mesh(
        new THREE.SphereGeometry(0.006, 6, 6),
        m.eyeShine
      );
      shineSecondary.position.set(eyeX - 0.012, -0.010, 0.193);
      head.add(shineSecondary);

      const lashGeo = new THREE.BoxGeometry(0.018, 0.006, 0.008);
      const lash = new THREE.Mesh(lashGeo, m.eyes);
      lash.rotation.z = idx === 0 ? -0.45 : 0.45;
      lash.position.set(idx === 0 ? eyeX - 0.038 : eyeX + 0.038, 0.028, 0.178);
      head.add(lash);
    });

    [-0.095, 0.095].forEach((browX, idx) => {
      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.007, 0.042, 4, 8),
        m.eyebrows
      );
      brow.rotation.z = idx === 0 ? Math.PI / 2 - 0.18 : Math.PI / 2 + 0.18;
      brow.position.set(browX, 0.076, 0.178);
      head.add(brow);
    });

    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 8, 8),
      m.skin
    );
    nose.scale.set(1.0, 0.7, 0.7);
    nose.position.set(0, -0.032, 0.198);
    head.add(nose);

    const mouth = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.008, 0.024, 4, 8),
      m.mouth
    );
    mouth.rotation.z = Math.PI / 2;
    mouth.position.set(0, -0.072, 0.188);
    head.add(mouth);

    [-0.128, 0.128].forEach((bx) => {
      const blush = new THREE.Mesh(
        new THREE.CylinderGeometry(0.034, 0.034, 0.008, 12),
        m.blush
      );
      blush.rotation.x = Math.PI / 2;
      blush.scale.set(1.2, 1, 0.75);
      blush.position.set(bx, -0.046, 0.172);
      head.add(blush);
    });

    const hairCapGeo = new THREE.SphereGeometry(0.218, 20, 18);
    hairCapGeo.scale(1.12, 1.02, 1.05);
    const hairCap = new THREE.Mesh(hairCapGeo, m.hair);
    hairCap.position.set(0, 0.035, -0.025);
    hairCap.castShadow = true;
    head.add(hairCap);

    const mainBang = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.042, 0.14, 8, 12),
      m.hair
    );
    mainBang.rotation.set(-0.25, 0.15, Math.PI / 2 - 0.28);
    mainBang.position.set(0.045, 0.115, 0.175);
    mainBang.castShadow = true;
    head.add(mainBang);

    const leftTuft = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.038, 0.09, 8, 10),
      m.hair
    );
    leftTuft.rotation.set(-0.22, -0.2, Math.PI / 2 + 0.35);
    leftTuft.position.set(-0.065, 0.118, 0.172);
    leftTuft.castShadow = true;
    head.add(leftTuft);

    const leftFringe = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.04, 0.11, 8, 10),
      m.hair
    );
    leftFringe.rotation.set(-0.15, -0.3, Math.PI / 2 + 0.65);
    leftFringe.position.set(-0.125, 0.095, 0.15);
    leftFringe.castShadow = true;
    head.add(leftFringe);

    const leftSideLock = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.042, 0.26, 8, 12),
      m.hair
    );
    leftSideLock.rotation.set(0.12, 0.1, -0.15);
    leftSideLock.position.set(-0.185, -0.08, 0.075);
    leftSideLock.castShadow = true;
    head.add(leftSideLock);

    const rightSideLock = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.042, 0.26, 8, 12),
      m.hair
    );
    rightSideLock.rotation.set(0.12, -0.1, 0.15);
    rightSideLock.position.set(0.185, -0.08, 0.075);
    rightSideLock.castShadow = true;
    head.add(rightSideLock);

    const backHairGroup = new THREE.Group();
    backHairGroup.position.set(0, -0.06, -0.11);

    const backHairMain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.25, 0.36, 16),
      m.hair
    );
    backHairMain.position.y = -0.12;
    backHairMain.castShadow = true;
    backHairGroup.add(backHairMain);

    const backHairTips = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.038, 8, 20, Math.PI),
      m.hair
    );
    backHairTips.rotation.set(Math.PI / 2, 0, Math.PI);
    backHairTips.position.set(0, -0.30, 0.02);
    backHairTips.castShadow = true;
    backHairGroup.add(backHairTips);

    head.add(backHairGroup);
  }

  createGirlArms(torso) {
    const m = this.materials;
    const armRadius = 0.038;
    const upperArmLen = 0.14;
    const lowerArmLen = 0.13;

    // --- LEFT ARM ---
    this.leftShoulderPivot = new THREE.Group();
    this.leftShoulderPivot.name = 'LeftShoulderPivot';
    this.leftShoulderPivot.position.set(0.155, 0.22, 0);
    torso.add(this.leftShoulderPivot);

    const lUpperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(armRadius, upperArmLen, 8, 8),
      m.skin
    );
    lUpperArm.position.y = -upperArmLen / 2;
    lUpperArm.castShadow = true;
    this.leftShoulderPivot.add(lUpperArm);

    this.leftElbowPivot = new THREE.Group();
    this.leftElbowPivot.name = 'LeftElbowPivot';
    this.leftElbowPivot.position.set(0, -upperArmLen, 0);
    this.leftShoulderPivot.add(this.leftElbowPivot);

    const lLowerArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(armRadius * 0.95, lowerArmLen, 8, 8),
      m.skin
    );
    lLowerArm.position.y = -lowerArmLen / 2;
    lLowerArm.castShadow = true;
    this.leftElbowPivot.add(lLowerArm);

    this.leftHandGroup = new THREE.Group();
    this.leftHandGroup.name = 'LeftHandGroup';
    this.leftHandGroup.position.set(0, -lowerArmLen, 0);
    this.leftElbowPivot.add(this.leftHandGroup);

    const lHand = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 10, 10),
      m.skin
    );
    lHand.scale.set(0.9, 1.2, 0.7);
    lHand.position.y = -0.025;
    lHand.castShadow = true;
    this.leftHandGroup.add(lHand);

    const lThumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.014, 0.026, 6, 6),
      m.skin
    );
    lThumb.rotation.z = 0.6;
    lThumb.position.set(-0.025, -0.02, 0.01);
    this.leftHandGroup.add(lThumb);

    // --- RIGHT ARM ---
    this.rightShoulderPivot = new THREE.Group();
    this.rightShoulderPivot.name = 'RightShoulderPivot';
    this.rightShoulderPivot.position.set(-0.155, 0.22, 0);
    torso.add(this.rightShoulderPivot);

    const rUpperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(armRadius, upperArmLen, 8, 8),
      m.skin
    );
    rUpperArm.position.y = -upperArmLen / 2;
    rUpperArm.castShadow = true;
    this.rightShoulderPivot.add(rUpperArm);

    this.rightElbowPivot = new THREE.Group();
    this.rightElbowPivot.name = 'RightElbowPivot';
    this.rightElbowPivot.position.set(0, -upperArmLen, 0);
    this.rightShoulderPivot.add(this.rightElbowPivot);

    const rLowerArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(armRadius * 0.95, lowerArmLen, 8, 8),
      m.skin
    );
    rLowerArm.position.y = -lowerArmLen / 2;
    rLowerArm.castShadow = true;
    this.rightElbowPivot.add(rLowerArm);

    this.rightHandGroup = new THREE.Group();
    this.rightHandGroup.name = 'RightHandGroup';
    this.rightHandGroup.position.set(0, -lowerArmLen, 0);
    this.rightElbowPivot.add(this.rightHandGroup);

    const rHand = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 10, 10),
      m.skin
    );
    rHand.scale.set(0.9, 1.2, 0.7);
    rHand.position.y = -0.025;
    rHand.castShadow = true;
    this.rightHandGroup.add(rHand);

    const rThumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.014, 0.026, 6, 6),
      m.skin
    );
    rThumb.rotation.z = -0.6;
    rThumb.position.set(0.025, -0.02, 0.01);
    this.rightHandGroup.add(rThumb);

    this.leftShoulderPivot.rotation.z = -0.18;
    this.rightShoulderPivot.rotation.z = 0.18;
    this.leftElbowPivot.rotation.x = -0.12;
    this.rightElbowPivot.rotation.x = -0.12;
  }

  createGirlLegs(hipPivot) {
    const m = this.materials;
    const legRadius = 0.052;
    const upperLegLen = 0.20;
    const lowerLegLen = 0.20;
    const legSpacing = 0.095;

    const createLowerLegAssembly = (kneePivotGroup, isLeft) => {
      const calf = new THREE.Mesh(
        new THREE.CapsuleGeometry(legRadius * 0.95, lowerLegLen * 0.5, 8, 8),
        m.skin
      );
      calf.position.y = -lowerLegLen * 0.28;
      calf.castShadow = true;
      kneePivotGroup.add(calf);

      const sockBody = new THREE.Mesh(
        new THREE.CylinderGeometry(legRadius * 0.98, legRadius * 1.02, lowerLegLen * 0.55, 12),
        m.socks
      );
      sockBody.position.y = -lowerLegLen * 0.72;
      sockBody.castShadow = true;
      kneePivotGroup.add(sockBody);

      const sockCuff = new THREE.Mesh(
        new THREE.TorusGeometry(legRadius * 1.02, 0.012, 8, 16),
        m.socks
      );
      sockCuff.rotateX(Math.PI / 2);
      sockCuff.position.y = -lowerLegLen * 0.45;
      sockCuff.castShadow = true;
      kneePivotGroup.add(sockCuff);

      const shoeGroup = new THREE.Group();
      shoeGroup.position.set(0, -lowerLegLen, 0);
      kneePivotGroup.add(shoeGroup);

      const soleGeo = new THREE.BoxGeometry(0.115, 0.025, 0.165);
      const sole = new THREE.Mesh(soleGeo, m.shoeSole);
      sole.position.set(0, -0.0675, 0.025);
      sole.castShadow = true;
      sole.receiveShadow = true;
      shoeGroup.add(sole);

      const upperGeo = new THREE.SphereGeometry(0.062, 14, 12);
      upperGeo.scale(0.92, 0.72, 1.25);
      const shoeUpper = new THREE.Mesh(upperGeo, m.shoes);
      shoeUpper.position.set(0, -0.038, 0.028);
      shoeUpper.castShadow = true;
      shoeGroup.add(shoeUpper);

      const heel = new THREE.Mesh(
        new THREE.BoxGeometry(0.108, 0.016, 0.065),
        m.shoeSole
      );
      heel.position.set(0, -0.072, -0.025);
      heel.castShadow = true;
      shoeGroup.add(heel);

      const strap = new THREE.Mesh(
        new THREE.BoxGeometry(0.118, 0.014, 0.026),
        m.shoes
      );
      strap.position.set(0, -0.018, 0.015);
      strap.castShadow = true;
      shoeGroup.add(strap);

      const buckle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.007, 0.007, 0.008, 8),
        m.buttons
      );
      buckle.rotation.z = Math.PI / 2;
      buckle.position.set(isLeft ? 0.06 : -0.06, -0.018, 0.015);
      shoeGroup.add(buckle);
    };

    this.leftHipPivot = new THREE.Group();
    this.leftHipPivot.name = 'LeftHipPivot';
    this.leftHipPivot.position.set(legSpacing, 0, 0);
    hipPivot.add(this.leftHipPivot);

    const lUpperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(legRadius, upperLegLen, 8, 8),
      m.skin
    );
    lUpperLeg.position.y = -upperLegLen / 2;
    lUpperLeg.castShadow = true;
    this.leftHipPivot.add(lUpperLeg);

    this.leftKneePivot = new THREE.Group();
    this.leftKneePivot.name = 'LeftKneePivot';
    this.leftKneePivot.position.set(0, -upperLegLen, 0);
    this.leftHipPivot.add(this.leftKneePivot);

    createLowerLegAssembly(this.leftKneePivot, true);

    this.rightHipPivot = new THREE.Group();
    this.rightHipPivot.name = 'RightHipPivot';
    this.rightHipPivot.position.set(-legSpacing, 0, 0);
    hipPivot.add(this.rightHipPivot);

    const rUpperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(legRadius, upperLegLen, 8, 8),
      m.skin
    );
    rUpperLeg.position.y = -upperLegLen / 2;
    rUpperLeg.castShadow = true;
    this.rightHipPivot.add(rUpperLeg);

    this.rightKneePivot = new THREE.Group();
    this.rightKneePivot.name = 'RightKneePivot';
    this.rightKneePivot.position.set(0, -upperLegLen, 0);
    this.rightHipPivot.add(this.rightKneePivot);

    createLowerLegAssembly(this.rightKneePivot, false);
  }

  // ===========================================================================
  // NEIGHBOR CHARACTER IMPLEMENTATION (RECONSTRUCTED FROM REFERENCE IMAGE)
  // ===========================================================================
  createNeighborTorso(torso) {
    const m = this.materials;

    // 1. Lime-Green Crew-Neck T-shirt Core
    const shirtGeo = new THREE.CylinderGeometry(0.12, 0.145, 0.25, 18);
    const shirt = new THREE.Mesh(shirtGeo, m.shirt);
    shirt.position.y = 0.125;
    shirt.castShadow = true;
    shirt.receiveShadow = true;
    torso.add(shirt);

    // Crew-neck collar torus in matching lime green
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.065, 0.012, 8, 20),
      m.shirt
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.245, 0.01);
    collar.castShadow = true;
    torso.add(collar);

    // 2. Open Teal/Emerald-Green Sleeveless Vest
    // Back and side wrap panel (revealing front lime shirt)
    const vestWrapGeo = new THREE.CylinderGeometry(0.128, 0.152, 0.235, 18, 1, false, Math.PI * 0.42, Math.PI * 1.16);
    const vestWrap = new THREE.Mesh(vestWrapGeo, m.vest);
    vestWrap.position.y = 0.120;
    vestWrap.castShadow = true;
    vestWrap.receiveShadow = true;
    torso.add(vestWrap);

    // Left front vertical vest panel
    const leftPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.23, 0.035),
      m.vest
    );
    leftPanel.position.set(0.088, 0.118, 0.12);
    leftPanel.rotation.y = 0.22;
    leftPanel.castShadow = true;
    torso.add(leftPanel);

    // Right front vertical vest panel
    const rightPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.23, 0.035),
      m.vest
    );
    rightPanel.position.set(-0.088, 0.118, 0.12);
    rightPanel.rotation.y = -0.22;
    rightPanel.castShadow = true;
    torso.add(rightPanel);

    // Vest shoulder straps/lapels framing neck
    const leftStrap = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.035, 0.13),
      m.vest
    );
    leftStrap.position.set(0.105, 0.235, 0.02);
    leftStrap.castShadow = true;
    torso.add(leftStrap);

    const rightStrap = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.035, 0.13),
      m.vest
    );
    rightStrap.position.set(-0.105, 0.235, 0.02);
    rightStrap.castShadow = true;
    torso.add(rightStrap);

    // Vest bottom rolled hem rim
    const vestHem = new THREE.Mesh(
      new THREE.TorusGeometry(0.152, 0.012, 8, 24),
      m.vest
    );
    vestHem.rotateX(Math.PI / 2);
    vestHem.position.y = 0.01;
    vestHem.castShadow = true;
    torso.add(vestHem);
  }

  createNeighborHead(head) {
    const m = this.materials;

    // 1. Base Squircle Head Sphere (matching chibi proportions)
    const headGeo = new THREE.SphereGeometry(0.20, 20, 18);
    headGeo.scale(1.1, 0.95, 1.0);
    const headMesh = new THREE.Mesh(headGeo, m.skin);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    head.add(headMesh);

    // Soft rounded lower cheeks
    [-0.12, 0.12].forEach((cx) => {
      const cheekPuff = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 10),
        m.skin
      );
      cheekPuff.scale.set(1.1, 0.8, 0.9);
      cheekPuff.position.set(cx, -0.05, 0.08);
      head.add(cheekPuff);
    });

    // Cute rounded ears
    [-0.205, 0.205].forEach((ex, idx) => {
      const ear = new THREE.Mesh(
        new THREE.SphereGeometry(0.048, 10, 10),
        m.skin
      );
      ear.scale.set(0.4, 1.1, 0.9);
      ear.rotation.y = idx === 0 ? -0.15 : 0.15;
      ear.position.set(ex, -0.01, 0.01);
      ear.castShadow = true;
      head.add(ear);
    });

    // 2. Large Round Glossy Navy Eyes (from reference)
    [-0.095, 0.095].forEach((eyeX) => {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.044, 16, 14),
        m.eyes
      );
      eye.scale.set(1.0, 1.05, 0.4);
      eye.position.set(eyeX, 0.005, 0.176);
      head.add(eye);

      // Primary white specular shine catchlight
      const shinePrimary = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 8),
        m.eyeShine
      );
      shinePrimary.position.set(eyeX + 0.014, 0.018, 0.194);
      head.add(shinePrimary);

      // Secondary tiny shine highlight
      const shineSecondary = new THREE.Mesh(
        new THREE.SphereGeometry(0.006, 6, 6),
        m.eyeShine
      );
      shineSecondary.position.set(eyeX - 0.012, -0.010, 0.193);
      head.add(shineSecondary);
    });

    // 3. Distinct Thick Curved Dark Brown Eyebrows (reference signature)
    [-0.095, 0.095].forEach((browX, idx) => {
      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.012, 0.046, 6, 8),
        m.eyebrows
      );
      brow.rotation.z = idx === 0 ? Math.PI / 2 - 0.16 : Math.PI / 2 + 0.16;
      brow.position.set(browX, 0.082, 0.180);
      head.add(brow);
    });

    // 4. Subtle Button Nose
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 8, 8),
      m.skin
    );
    nose.scale.set(1.0, 0.7, 0.7);
    nose.position.set(0, -0.032, 0.198);
    head.add(nose);

    // 5. Friendly Sweet Mouth Smile
    const mouth = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.008, 0.026, 4, 8),
      m.mouth
    );
    mouth.rotation.z = Math.PI / 2;
    mouth.position.set(0, -0.072, 0.188);
    head.add(mouth);

    // 6. Soft Peach Cheek Blush
    [-0.128, 0.128].forEach((bx) => {
      const blush = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.008, 12),
        m.blush
      );
      blush.rotation.x = Math.PI / 2;
      blush.position.set(bx, -0.046, 0.172);
      head.add(blush);
    });

    // 7. Sculpted Chocolate Brown Hair (Side-part swoop from reference)
    // A. Main Hair Cap
    const hairCapGeo = new THREE.SphereGeometry(0.222, 20, 18);
    hairCapGeo.scale(1.12, 1.06, 1.08);
    const hairCap = new THREE.Mesh(hairCapGeo, m.hair);
    hairCap.position.set(0, 0.038, -0.025);
    hairCap.castShadow = true;
    head.add(hairCap);

    // B. Prominent Sweeping Front Bang (swooping from character right to left across forehead)
    const mainSwoop = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.16, 8, 12),
      m.hair
    );
    mainSwoop.rotation.set(-0.25, 0.18, Math.PI / 2 - 0.35);
    mainSwoop.position.set(0.04, 0.125, 0.182);
    mainSwoop.castShadow = true;
    head.add(mainSwoop);

    // Secondary side-part tuft on character right
    const partLock = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.042, 0.11, 8, 10),
      m.hair
    );
    partLock.rotation.set(-0.20, -0.22, Math.PI / 2 + 0.40);
    partLock.position.set(-0.08, 0.125, 0.176);
    partLock.castShadow = true;
    head.add(partLock);

    // Top volume crest lock
    const topLock = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.045, 0.14, 8, 10),
      m.hair
    );
    topLock.rotation.set(-0.15, 0.10, Math.PI / 2 - 0.10);
    topLock.position.set(0.02, 0.185, 0.10);
    topLock.castShadow = true;
    head.add(topLock);

    // Sideburn hair locks framing ears neatly
    [-0.19, 0.19].forEach((sx, idx) => {
      const sideHair = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.040, 0.12, 8, 8),
        m.hair
      );
      sideHair.rotation.set(0.10, 0, idx === 0 ? -0.15 : 0.15);
      sideHair.position.set(sx, 0.01, 0.04);
      sideHair.castShadow = true;
      head.add(sideHair);
    });

    // Clean boyish haircut back at nape of neck
    const backHair = new THREE.Mesh(
      new THREE.CylinderGeometry(0.185, 0.17, 0.14, 14),
      m.hair
    );
    backHair.position.set(0, -0.07, -0.10);
    backHair.castShadow = true;
    head.add(backHair);
  }

  createNeighborArms(torso) {
    const m = this.materials;
    const armRadius = 0.038;
    const upperArmLen = 0.14;
    const lowerArmLen = 0.13;

    // Helper to build arm with lime-green short sleeve and bare skin
    const buildNeighborArm = (shoulderPivot, isLeft) => {
      // Short sleeve upper cuff in lime green
      const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(armRadius * 1.15, armRadius * 1.15, 0.055, 12),
        m.shirt
      );
      sleeve.position.y = -0.028;
      sleeve.castShadow = true;
      shoulderPivot.add(sleeve);

      // Rolled sleeve cuff torus
      const sleeveCuff = new THREE.Mesh(
        new THREE.TorusGeometry(armRadius * 1.15, 0.010, 8, 16),
        m.shirt
      );
      sleeveCuff.rotateX(Math.PI / 2);
      sleeveCuff.position.y = -0.055;
      sleeveCuff.castShadow = true;
      shoulderPivot.add(sleeveCuff);

      // Bare skin upper arm
      const upperArm = new THREE.Mesh(
        new THREE.CapsuleGeometry(armRadius, upperArmLen - 0.04, 8, 8),
        m.skin
      );
      upperArm.position.y = -0.07 - (upperArmLen - 0.04) / 2;
      upperArm.castShadow = true;
      shoulderPivot.add(upperArm);
    };

    // --- LEFT ARM ---
    this.leftShoulderPivot = new THREE.Group();
    this.leftShoulderPivot.name = 'LeftShoulderPivot';
    this.leftShoulderPivot.position.set(0.155, 0.22, 0);
    torso.add(this.leftShoulderPivot);

    buildNeighborArm(this.leftShoulderPivot, true);

    this.leftElbowPivot = new THREE.Group();
    this.leftElbowPivot.name = 'LeftElbowPivot';
    this.leftElbowPivot.position.set(0, -upperArmLen, 0);
    this.leftShoulderPivot.add(this.leftElbowPivot);

    const lLowerArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(armRadius * 0.95, lowerArmLen, 8, 8),
      m.skin
    );
    lLowerArm.position.y = -lowerArmLen / 2;
    lLowerArm.castShadow = true;
    this.leftElbowPivot.add(lLowerArm);

    this.leftHandGroup = new THREE.Group();
    this.leftHandGroup.name = 'LeftHandGroup';
    this.leftHandGroup.position.set(0, -lowerArmLen, 0);
    this.leftElbowPivot.add(this.leftHandGroup);

    const lHand = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 10, 10),
      m.skin
    );
    lHand.scale.set(0.9, 1.2, 0.7);
    lHand.position.y = -0.025;
    lHand.castShadow = true;
    this.leftHandGroup.add(lHand);

    const lThumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.014, 0.026, 6, 6),
      m.skin
    );
    lThumb.rotation.z = 0.6;
    lThumb.position.set(-0.025, -0.02, 0.01);
    this.leftHandGroup.add(lThumb);

    // --- RIGHT ARM ---
    this.rightShoulderPivot = new THREE.Group();
    this.rightShoulderPivot.name = 'RightShoulderPivot';
    this.rightShoulderPivot.position.set(-0.155, 0.22, 0);
    torso.add(this.rightShoulderPivot);

    buildNeighborArm(this.rightShoulderPivot, false);

    this.rightElbowPivot = new THREE.Group();
    this.rightElbowPivot.name = 'RightElbowPivot';
    this.rightElbowPivot.position.set(0, -upperArmLen, 0);
    this.rightShoulderPivot.add(this.rightElbowPivot);

    const rLowerArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(armRadius * 0.95, lowerArmLen, 8, 8),
      m.skin
    );
    rLowerArm.position.y = -lowerArmLen / 2;
    rLowerArm.castShadow = true;
    this.rightElbowPivot.add(rLowerArm);

    this.rightHandGroup = new THREE.Group();
    this.rightHandGroup.name = 'RightHandGroup';
    this.rightHandGroup.position.set(0, -lowerArmLen, 0);
    this.rightElbowPivot.add(this.rightHandGroup);

    const rHand = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 10, 10),
      m.skin
    );
    rHand.scale.set(0.9, 1.2, 0.7);
    rHand.position.y = -0.025;
    rHand.castShadow = true;
    this.rightHandGroup.add(rHand);

    const rThumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.014, 0.026, 6, 6),
      m.skin
    );
    rThumb.rotation.z = -0.6;
    rThumb.position.set(0.025, -0.02, 0.01);
    this.rightHandGroup.add(rThumb);

    this.leftShoulderPivot.rotation.z = -0.18;
    this.rightShoulderPivot.rotation.z = 0.18;
    this.leftElbowPivot.rotation.x = -0.12;
    this.rightElbowPivot.rotation.x = -0.12;
  }

  createNeighborLegs(hipPivot) {
    const m = this.materials;
    const legRadius = 0.052;
    const upperLegLen = 0.20;
    const lowerLegLen = 0.20;
    const legSpacing = 0.095;

    const createNeighborLowerLegAssembly = (kneePivotGroup, isLeft) => {
      // Lower leg jeans in denim blue
      const jeansLower = new THREE.Mesh(
        new THREE.CylinderGeometry(legRadius * 1.02, legRadius * 1.08, lowerLegLen * 0.75, 12),
        m.pants
      );
      jeansLower.position.y = -lowerLegLen * 0.40;
      jeansLower.castShadow = true;
      kneePivotGroup.add(jeansLower);

      // Rolled denim ankle cuff torus (signature reference feature)
      const cuff = new THREE.Mesh(
        new THREE.TorusGeometry(legRadius * 1.08, 0.016, 8, 16),
        m.pantsCuff
      );
      cuff.rotateX(Math.PI / 2);
      cuff.position.y = -lowerLegLen * 0.78;
      cuff.castShadow = true;
      kneePivotGroup.add(cuff);

      // Bare skin ankle connector
      const ankle = new THREE.Mesh(
        new THREE.CylinderGeometry(legRadius * 0.85, legRadius * 0.85, 0.04, 10),
        m.skin
      );
      ankle.position.y = -lowerLegLen * 0.90;
      kneePivotGroup.add(ankle);

      // Chunky Mocha Brown Sneaker (anchored at ankle y = -lowerLegLen)
      const shoeGroup = new THREE.Group();
      shoeGroup.position.set(0, -lowerLegLen, 0);
      kneePivotGroup.add(shoeGroup);

      // Thick dark charcoal rubber sole
      const soleGeo = new THREE.BoxGeometry(0.12, 0.025, 0.17);
      const sole = new THREE.Mesh(soleGeo, m.shoeSole);
      sole.position.set(0, -0.0675, 0.025);
      sole.castShadow = true;
      sole.receiveShadow = true;
      shoeGroup.add(sole);

      // Rounded mocha brown shoe upper body
      const upperGeo = new THREE.SphereGeometry(0.065, 14, 12);
      upperGeo.scale(0.95, 0.75, 1.25);
      const shoeUpper = new THREE.Mesh(upperGeo, m.shoes);
      shoeUpper.position.set(0, -0.038, 0.028);
      shoeUpper.castShadow = true;
      shoeGroup.add(shoeUpper);

      // Heel lift on back of shoe
      const heel = new THREE.Mesh(
        new THREE.BoxGeometry(0.112, 0.016, 0.068),
        m.shoeSole
      );
      heel.position.set(0, -0.072, -0.025);
      heel.castShadow = true;
      shoeGroup.add(heel);

      // Lime green accent tongue on front instep (reference feature)
      const tongue = new THREE.Mesh(
        new THREE.BoxGeometry(0.048, 0.018, 0.065),
        m.shoeAccent
      );
      tongue.position.set(0, -0.020, 0.035);
      tongue.castShadow = true;
      shoeGroup.add(tongue);

      // Sneaker lace strap detail
      const lace = new THREE.Mesh(
        new THREE.BoxGeometry(0.052, 0.008, 0.022),
        m.shoeAccent
      );
      lace.position.set(0, -0.016, 0.022);
      shoeGroup.add(lace);
    };

    // --- LEFT LEG ---
    this.leftHipPivot = new THREE.Group();
    this.leftHipPivot.name = 'LeftHipPivot';
    this.leftHipPivot.position.set(legSpacing, 0, 0);
    hipPivot.add(this.leftHipPivot);

    const lUpperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(legRadius * 1.05, upperLegLen, 8, 8),
      m.pants
    );
    lUpperLeg.position.y = -upperLegLen / 2;
    lUpperLeg.castShadow = true;
    this.leftHipPivot.add(lUpperLeg);

    this.leftKneePivot = new THREE.Group();
    this.leftKneePivot.name = 'LeftKneePivot';
    this.leftKneePivot.position.set(0, -upperLegLen, 0);
    this.leftHipPivot.add(this.leftKneePivot);

    createNeighborLowerLegAssembly(this.leftKneePivot, true);

    // --- RIGHT LEG ---
    this.rightHipPivot = new THREE.Group();
    this.rightHipPivot.name = 'RightHipPivot';
    this.rightHipPivot.position.set(-legSpacing, 0, 0);
    hipPivot.add(this.rightHipPivot);

    const rUpperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(legRadius * 1.05, upperLegLen, 8, 8),
      m.pants
    );
    rUpperLeg.position.y = -upperLegLen / 2;
    rUpperLeg.castShadow = true;
    this.rightHipPivot.add(rUpperLeg);

    this.rightKneePivot = new THREE.Group();
    this.rightKneePivot.name = 'RightKneePivot';
    this.rightKneePivot.position.set(0, -upperLegLen, 0);
    this.rightHipPivot.add(this.rightKneePivot);

    createNeighborLowerLegAssembly(this.rightKneePivot, false);
  }

  // ===========================================================================
  // BOY BLUE RESIDENT IMPLEMENTATION (Reference Vinyl Figurine)
  // ===========================================================================
  createBoyBlueTorso(torso) {
    const m = this.materials;

    // 1. Light sky-blue jacket bodice
    const jacketGeo = new THREE.CylinderGeometry(0.125, 0.145, 0.25, 18);
    const jacket = new THREE.Mesh(jacketGeo, m.jacket);
    jacket.position.y = 0.125;
    jacket.castShadow = true;
    jacket.receiveShadow = true;
    torso.add(jacket);

    // 2. Rolled bottom hem rim in jacket fabric
    const hem = new THREE.Mesh(
      new THREE.TorusGeometry(0.146, 0.012, 8, 24),
      m.jacket
    );
    hem.rotateX(Math.PI / 2);
    hem.position.y = 0.01;
    hem.castShadow = true;
    torso.add(hem);

    // 3. Vertical center front button placket strip
    const placket = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.22, 0.012),
      m.jacket
    );
    placket.position.set(0, 0.125, 0.138);
    placket.castShadow = true;
    torso.add(placket);

    // 3 Cute round pastel blue buttons down the front
    [0.065, 0.125, 0.185].forEach((by) => {
      const btn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.01, 10),
        m.buttons
      );
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, by, 0.144);
      btn.castShadow = true;
      torso.add(btn);
    });

    // 4. White Peter Pan / spread collar framing the neck
    const collarGroup = new THREE.Group();
    collarGroup.position.set(0, 0.245, 0.08);
    collarGroup.rotation.x = 0.22;

    [-0.045, 0.045].forEach((cx, idx) => {
      const lobe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.046, 0.046, 0.014, 12),
        m.collar
      );
      lobe.scale.set(1.25, 1, 0.85);
      lobe.rotation.y = idx === 0 ? -0.22 : 0.22;
      lobe.position.set(cx, 0, 0);
      lobe.castShadow = true;
      collarGroup.add(lobe);
    });
    torso.add(collarGroup);

    // 5. Signature Red Square Chest Pocket Badge (reference feature on upper left chest)
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.046, 0.012),
      m.badge
    );
    badge.position.set(0.068, 0.165, 0.138);
    badge.castShadow = true;
    torso.add(badge);
  }

  createBoyBlueHead(head) {
    const m = this.materials;

    // 1. Chibi Vinyl Head Sphere
    const headGeo = new THREE.SphereGeometry(0.20, 20, 18);
    headGeo.scale(1.1, 0.95, 1.0);
    const headMesh = new THREE.Mesh(headGeo, m.skin);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    head.add(headMesh);

    // Soft rounded lower cheeks
    [-0.12, 0.12].forEach((cx) => {
      const cheekPuff = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 10),
        m.skin
      );
      cheekPuff.scale.set(1.1, 0.8, 0.9);
      cheekPuff.position.set(cx, -0.05, 0.08);
      head.add(cheekPuff);
    });

    // Cute rounded ears
    [-0.205, 0.205].forEach((ex, idx) => {
      const ear = new THREE.Mesh(
        new THREE.SphereGeometry(0.048, 10, 10),
        m.skin
      );
      ear.scale.set(0.4, 1.1, 0.9);
      ear.rotation.y = idx === 0 ? -0.15 : 0.15;
      ear.position.set(ex, -0.01, 0.01);
      ear.castShadow = true;
      head.add(ear);
    });

    // 2. Large Round Glossy Black Button Eyes with Catchlight Shine
    [-0.095, 0.095].forEach((eyeX) => {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.044, 16, 14),
        m.eyes
      );
      eye.scale.set(1.0, 1.05, 0.4);
      eye.position.set(eyeX, 0.005, 0.176);
      head.add(eye);

      // Primary white specular shine
      const shinePrimary = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 8),
        m.eyeShine
      );
      shinePrimary.position.set(eyeX + 0.014, 0.018, 0.194);
      head.add(shinePrimary);

      // Secondary tiny shine highlight
      const shineSecondary = new THREE.Mesh(
        new THREE.SphereGeometry(0.006, 6, 6),
        m.eyeShine
      );
      shineSecondary.position.set(eyeX - 0.012, -0.010, 0.193);
      head.add(shineSecondary);
    });

    // 3. Subtle Curved Black Eyebrows
    [-0.095, 0.095].forEach((browX, idx) => {
      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.010, 0.044, 6, 8),
        m.eyebrows
      );
      brow.rotation.z = idx === 0 ? Math.PI / 2 - 0.14 : Math.PI / 2 + 0.14;
      brow.position.set(browX, 0.080, 0.180);
      head.add(brow);
    });

    // 4. Subtle Button Nose
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 8, 8),
      m.skin
    );
    nose.scale.set(1.0, 0.7, 0.7);
    nose.position.set(0, -0.032, 0.198);
    head.add(nose);

    // 5. Friendly Sweet Mouth Smile
    const mouth = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.008, 0.026, 4, 8),
      m.mouth
    );
    mouth.rotation.z = Math.PI / 2;
    mouth.position.set(0, -0.072, 0.188);
    head.add(mouth);

    // 6. Soft Peach Cheek Blush
    [-0.128, 0.128].forEach((bx) => {
      const blush = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.008, 12),
        m.blush
      );
      blush.rotation.x = Math.PI / 2;
      blush.position.set(bx, -0.046, 0.172);
      head.add(blush);
    });

    // 7. Glossy Jet Black Sculpted Hair (Asymmetrical side-swept bangs from reference image)
    // A. Main Hair Cap
    const hairCapGeo = new THREE.SphereGeometry(0.222, 20, 18);
    hairCapGeo.scale(1.12, 1.06, 1.08);
    const hairCap = new THREE.Mesh(hairCapGeo, m.hair);
    hairCap.position.set(0, 0.038, -0.025);
    hairCap.castShadow = true;
    head.add(hairCap);

    // B. Prominent Sweeping Front Bang (sweeps from character right to left across forehead)
    const mainSwoop = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.052, 0.18, 8, 12),
      m.hair
    );
    mainSwoop.rotation.set(-0.24, 0.22, Math.PI / 2 - 0.42);
    mainSwoop.position.set(0.03, 0.13, 0.184);
    mainSwoop.castShadow = true;
    head.add(mainSwoop);

    // Front bang flick lock (signature reference tip pointing down-left)
    const bangFlick = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.036, 0.09, 8, 10),
      m.hair
    );
    bangFlick.rotation.set(-0.18, 0.35, Math.PI / 2 - 0.65);
    bangFlick.position.set(0.08, 0.08, 0.195);
    bangFlick.castShadow = true;
    head.add(bangFlick);

    // Secondary side-part lock on character right
    const partLock = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.045, 0.12, 8, 10),
      m.hair
    );
    partLock.rotation.set(-0.20, -0.20, Math.PI / 2 + 0.38);
    partLock.position.set(-0.09, 0.13, 0.176);
    partLock.castShadow = true;
    head.add(partLock);

    // Top volume crest lock
    const topLock = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.046, 0.15, 8, 10),
      m.hair
    );
    topLock.rotation.set(-0.15, 0.10, Math.PI / 2 - 0.10);
    topLock.position.set(0.01, 0.19, 0.09);
    topLock.castShadow = true;
    head.add(topLock);

    // Sideburn locks framing ears neatly
    [-0.19, 0.19].forEach((sx, idx) => {
      const sideHair = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.040, 0.12, 8, 8),
        m.hair
      );
      sideHair.rotation.set(0.10, 0, idx === 0 ? -0.15 : 0.15);
      sideHair.position.set(sx, 0.01, 0.04);
      sideHair.castShadow = true;
      head.add(sideHair);
    });

    // Clean boyish haircut back at nape of neck
    const backHair = new THREE.Mesh(
      new THREE.CylinderGeometry(0.185, 0.17, 0.14, 14),
      m.hair
    );
    backHair.position.set(0, -0.07, -0.10);
    backHair.castShadow = true;
    head.add(backHair);
  }

  createBoyBlueArms(torso) {
    const m = this.materials;
    const armRadius = 0.038;
    const upperArmLen = 0.14;
    const lowerArmLen = 0.13;

    // Helper to build arm with sky-blue long sleeves and white rolled cuffs
    const buildBoyBlueArm = (shoulderPivot, isLeft) => {
      // Sky blue upper arm sleeve
      const upperSleeve = new THREE.Mesh(
        new THREE.CapsuleGeometry(armRadius * 1.08, upperArmLen - 0.02, 8, 8),
        m.jacket
      );
      upperSleeve.position.y = -0.04 - (upperArmLen - 0.02) / 2;
      upperSleeve.castShadow = true;
      shoulderPivot.add(upperSleeve);
    };

    const buildBoyBlueLowerArm = (elbowPivot) => {
      // Sky blue lower arm sleeve
      const lowerSleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(armRadius * 1.06, armRadius * 1.02, lowerArmLen * 0.80, 10),
        m.jacket
      );
      lowerSleeve.position.y = -lowerArmLen * 0.42;
      lowerSleeve.castShadow = true;
      elbowPivot.add(lowerSleeve);

      // Signature White Rolled Cuff Torus at wrist
      const cuff = new THREE.Mesh(
        new THREE.TorusGeometry(armRadius * 1.15, 0.014, 8, 16),
        m.cuffs
      );
      cuff.rotateX(Math.PI / 2);
      cuff.position.y = -lowerArmLen * 0.85;
      cuff.castShadow = true;
      elbowPivot.add(cuff);

      // Bare skin wrist connector
      const wrist = new THREE.Mesh(
        new THREE.CylinderGeometry(armRadius * 0.85, armRadius * 0.85, 0.035, 10),
        m.skin
      );
      wrist.position.y = -lowerArmLen * 0.94;
      elbowPivot.add(wrist);
    };

    // --- LEFT ARM ---
    this.leftShoulderPivot = new THREE.Group();
    this.leftShoulderPivot.name = 'LeftShoulderPivot';
    this.leftShoulderPivot.position.set(0.155, 0.22, 0);
    torso.add(this.leftShoulderPivot);

    buildBoyBlueArm(this.leftShoulderPivot, true);

    this.leftElbowPivot = new THREE.Group();
    this.leftElbowPivot.name = 'LeftElbowPivot';
    this.leftElbowPivot.position.set(0, -upperArmLen, 0);
    this.leftShoulderPivot.add(this.leftElbowPivot);

    buildBoyBlueLowerArm(this.leftElbowPivot);

    this.leftHandGroup = new THREE.Group();
    this.leftHandGroup.name = 'LeftHandGroup';
    this.leftHandGroup.position.set(0, -lowerArmLen, 0);
    this.leftElbowPivot.add(this.leftHandGroup);

    const lHand = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 10, 10),
      m.skin
    );
    lHand.scale.set(0.9, 1.2, 0.7);
    lHand.position.y = -0.025;
    lHand.castShadow = true;
    this.leftHandGroup.add(lHand);

    const lThumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.014, 0.026, 6, 6),
      m.skin
    );
    lThumb.rotation.z = 0.6;
    lThumb.position.set(-0.025, -0.02, 0.01);
    this.leftHandGroup.add(lThumb);

    // --- RIGHT ARM ---
    this.rightShoulderPivot = new THREE.Group();
    this.rightShoulderPivot.name = 'RightShoulderPivot';
    this.rightShoulderPivot.position.set(-0.155, 0.22, 0);
    torso.add(this.rightShoulderPivot);

    buildBoyBlueArm(this.rightShoulderPivot, false);

    this.rightElbowPivot = new THREE.Group();
    this.rightElbowPivot.name = 'RightElbowPivot';
    this.rightElbowPivot.position.set(0, -upperArmLen, 0);
    this.rightShoulderPivot.add(this.rightElbowPivot);

    buildBoyBlueLowerArm(this.rightElbowPivot);

    this.rightHandGroup = new THREE.Group();
    this.rightHandGroup.name = 'RightHandGroup';
    this.rightHandGroup.position.set(0, -lowerArmLen, 0);
    this.rightElbowPivot.add(this.rightHandGroup);

    const rHand = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 10, 10),
      m.skin
    );
    rHand.scale.set(0.9, 1.2, 0.7);
    rHand.position.y = -0.025;
    rHand.castShadow = true;
    this.rightHandGroup.add(rHand);

    const rThumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.014, 0.026, 6, 6),
      m.skin
    );
    rThumb.rotation.z = -0.6;
    rThumb.position.set(0.025, -0.02, 0.01);
    this.rightHandGroup.add(rThumb);
  }

  createBoyBlueLegs(hipPivot) {
    const m = this.materials;
    const legSpacing = 0.088;
    const legRadius = 0.048;
    const upperLegLen = 0.20;
    const lowerLegLen = 0.20;

    const createBoyBlueLowerLegAssembly = (kneePivotGroup, isLeft) => {
      // Lower leg trousers
      const pantsLower = new THREE.Mesh(
        new THREE.CylinderGeometry(legRadius * 1.02, legRadius * 1.08, lowerLegLen * 0.75, 12),
        m.pants
      );
      pantsLower.position.y = -lowerLegLen * 0.40;
      pantsLower.castShadow = true;
      kneePivotGroup.add(pantsLower);

      // Signature Rolled Denim Cuff Torus at ankle
      const cuff = new THREE.Mesh(
        new THREE.TorusGeometry(legRadius * 1.08, 0.016, 8, 16),
        m.pantsCuff
      );
      cuff.rotateX(Math.PI / 2);
      cuff.position.y = -lowerLegLen * 0.78;
      cuff.castShadow = true;
      kneePivotGroup.add(cuff);

      // Ankle skin connector
      const ankle = new THREE.Mesh(
        new THREE.CylinderGeometry(legRadius * 0.85, legRadius * 0.85, 0.04, 10),
        m.skin
      );
      ankle.position.y = -lowerLegLen * 0.90;
      kneePivotGroup.add(ankle);

      // Chunky Glossy Black Shoes (anchored at ankle y = -lowerLegLen)
      const shoeGroup = new THREE.Group();
      shoeGroup.position.set(0, -lowerLegLen, 0);
      kneePivotGroup.add(shoeGroup);

      // Thick dark charcoal rubber sole
      const soleGeo = new THREE.BoxGeometry(0.12, 0.025, 0.17);
      const sole = new THREE.Mesh(soleGeo, m.shoeSole);
      sole.position.set(0, -0.0675, 0.025);
      sole.castShadow = true;
      sole.receiveShadow = true;
      shoeGroup.add(sole);

      // Rounded glossy black shoe upper body
      const upperGeo = new THREE.SphereGeometry(0.065, 14, 12);
      upperGeo.scale(0.95, 0.75, 1.25);
      const shoeUpper = new THREE.Mesh(upperGeo, m.shoes);
      shoeUpper.position.set(0, -0.038, 0.028);
      shoeUpper.castShadow = true;
      shoeGroup.add(shoeUpper);

      // Heel lift on back of shoe
      const heel = new THREE.Mesh(
        new THREE.BoxGeometry(0.112, 0.016, 0.068),
        m.shoeSole
      );
      heel.position.set(0, -0.072, -0.025);
      heel.castShadow = true;
      shoeGroup.add(heel);

      // Subtle white shoe trim / lace collar
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(0.052, 0.008, 0.032),
        m.shoeTrim
      );
      trim.position.set(0, -0.016, 0.025);
      shoeGroup.add(trim);
    };

    // --- LEFT LEG ---
    this.leftHipPivot = new THREE.Group();
    this.leftHipPivot.name = 'LeftHipPivot';
    this.leftHipPivot.position.set(legSpacing, 0, 0);
    hipPivot.add(this.leftHipPivot);

    const lUpperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(legRadius * 1.05, upperLegLen, 8, 8),
      m.pants
    );
    lUpperLeg.position.y = -upperLegLen / 2;
    lUpperLeg.castShadow = true;
    this.leftHipPivot.add(lUpperLeg);

    this.leftKneePivot = new THREE.Group();
    this.leftKneePivot.name = 'LeftKneePivot';
    this.leftKneePivot.position.set(0, -upperLegLen, 0);
    this.leftHipPivot.add(this.leftKneePivot);

    createBoyBlueLowerLegAssembly(this.leftKneePivot, true);

    // --- RIGHT LEG ---
    this.rightHipPivot = new THREE.Group();
    this.rightHipPivot.name = 'RightHipPivot';
    this.rightHipPivot.position.set(-legSpacing, 0, 0);
    hipPivot.add(this.rightHipPivot);

    const rUpperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(legRadius * 1.05, upperLegLen, 8, 8),
      m.pants
    );
    rUpperLeg.position.y = -upperLegLen / 2;
    rUpperLeg.castShadow = true;
    this.rightHipPivot.add(rUpperLeg);

    this.rightKneePivot = new THREE.Group();
    this.rightKneePivot.name = 'RightKneePivot';
    this.rightKneePivot.position.set(0, -upperLegLen, 0);
    this.rightHipPivot.add(this.rightKneePivot);

    createBoyBlueLowerLegAssembly(this.rightKneePivot, false);
  }

  // ===========================================================================
  // HELPER CHARACTER IMPLEMENTATION (Streetwear Overalls & Bucket Hat Figurine)
  // ===========================================================================
  createHelperMaterials() {
    return {
      skin: new THREE.MeshStandardMaterial({
        color: 0xffd8c2,
        roughness: 0.55,
        metalness: 0.0,
      }),
      overalls: new THREE.MeshStandardMaterial({
        color: 0x365463, // Slate-teal work overalls from reference
        roughness: 0.50,
        metalness: 0.02,
      }),
      overallsStraps: new THREE.MeshStandardMaterial({
        color: 0x2e4754,
        roughness: 0.52,
      }),
      overallsBuckles: new THREE.MeshStandardMaterial({
        color: 0xc0c8d0, // Metallic silver buckle clips
        roughness: 0.25,
        metalness: 0.85,
      }),
      overallsPocket: new THREE.MeshStandardMaterial({
        color: 0x304c5a,
        roughness: 0.55,
      }),
      shirt: new THREE.MeshStandardMaterial({
        color: 0x78808a, // Grey cotton tee
        roughness: 0.52,
      }),
      undersleeves: new THREE.MeshStandardMaterial({
        color: 0x23272e, // Dark charcoal undersleeves
        roughness: 0.48,
      }),
      bucketHat: new THREE.MeshStandardMaterial({
        color: 0x243346, // Dark slate-navy bucket hat
        roughness: 0.42,
        metalness: 0.02,
      }),
      bucketHatBand: new THREE.MeshStandardMaterial({
        color: 0x182230,
        roughness: 0.5,
      }),
      bucketHatBadge: new THREE.MeshStandardMaterial({
        color: 0xf0f3f6, // Signature white logo patch on hat
        roughness: 0.35,
      }),
      hair: new THREE.MeshStandardMaterial({
        color: 0x1c1c1f, // Sculpted dark hair
        roughness: 0.35,
        metalness: 0.05,
      }),
      eyes: new THREE.MeshStandardMaterial({
        color: 0x1b2845, // Glossy deep navy/slate button eyes
        roughness: 0.15,
        metalness: 0.1,
      }),
      eyeShine: new THREE.MeshBasicMaterial({
        color: 0xffffff,
      }),
      eyebrows: new THREE.MeshStandardMaterial({
        color: 0x2a2421,
        roughness: 0.6,
      }),
      mouth: new THREE.MeshStandardMaterial({
        color: 0xd97575,
        roughness: 0.5,
      }),
      blush: new THREE.MeshStandardMaterial({
        color: 0xfdae9e,
        roughness: 0.8,
        transparent: true,
        opacity: 0.45,
      }),
      watch: new THREE.MeshStandardMaterial({
        color: 0x3e4856, // Watch strap and case
        roughness: 0.35,
        metalness: 0.3,
      }),
      watchDial: new THREE.MeshStandardMaterial({
        color: 0x8b99ad, // Lavender/grey watch face from reference
        roughness: 0.25,
      }),
      shoes: new THREE.MeshStandardMaterial({
        color: 0x252830, // Charcoal sneaker upper
        roughness: 0.38,
      }),
      shoeSole: new THREE.MeshStandardMaterial({
        color: 0xedf0f2, // White vulcanized rubber sole
        roughness: 0.45,
      }),
      shoeAccent: new THREE.MeshStandardMaterial({
        color: 0x365463, // Slate-teal tongue and heel accent
        roughness: 0.48,
      }),
      pantsCuff: new THREE.MeshStandardMaterial({
        color: 0x2c4550, // Rolled cuff at ankle
        roughness: 0.58,
      }),
    };
  }

  createHelperTorso(torso) {
    const m = this.materials;

    // 1. Inner grey t-shirt bodice
    const shirtGeo = new THREE.CylinderGeometry(0.125, 0.145, 0.25, 18);
    const shirt = new THREE.Mesh(shirtGeo, m.shirt);
    shirt.position.y = 0.125;
    shirt.castShadow = true;
    shirt.receiveShadow = true;
    torso.add(shirt);

    // 2. Slate-teal work overalls bib (front)
    const bibFrontGeo = new THREE.BoxGeometry(0.20, 0.18, 0.024);
    const bibFront = new THREE.Mesh(bibFrontGeo, m.overalls);
    bibFront.position.set(0, 0.11, 0.136);
    bibFront.castShadow = true;
    torso.add(bibFront);

    // Front center bib pocket
    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.09, 0.016),
      m.overallsPocket
    );
    pocket.position.set(0, 0.10, 0.146);
    pocket.castShadow = true;
    torso.add(pocket);

    // Center asterisk / snowflake logo patch on chest
    const logoBadge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.008, 6),
      m.bucketHatBadge
    );
    logoBadge.rotation.x = Math.PI / 2;
    logoBadge.position.set(0, 0.148, 0.150);
    torso.add(logoBadge);

    // 3. Overalls bib (back)
    const bibBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.16, 0.024),
      m.overalls
    );
    bibBack.position.set(0, 0.11, -0.136);
    bibBack.castShadow = true;
    torso.add(bibBack);

    // 4. Overalls suspender straps over shoulders
    [-0.062, 0.062].forEach((sx) => {
      // Shoulder strap
      const strap = new THREE.Mesh(
        new THREE.BoxGeometry(0.032, 0.22, 0.29),
        m.overallsStraps
      );
      strap.position.set(sx, 0.14, 0);
      torso.add(strap);

      // Silver metal buckle clip at front top of bib
      const buckle = new THREE.Mesh(
        new THREE.BoxGeometry(0.038, 0.020, 0.016),
        m.overallsBuckles
      );
      buckle.position.set(sx, 0.185, 0.146);
      buckle.castShadow = true;
      torso.add(buckle);
    });

    // 5. Waist hem torus band
    const waist = new THREE.Mesh(
      new THREE.TorusGeometry(0.148, 0.014, 8, 24),
      m.overalls
    );
    waist.rotateX(Math.PI / 2);
    waist.position.y = 0.015;
    waist.castShadow = true;
    torso.add(waist);
  }

  createHelperHead(head) {
    const m = this.materials;

    // 1. Chibi Vinyl Head Base Sphere
    const headGeo = new THREE.SphereGeometry(0.20, 20, 18);
    const headMesh = new THREE.Mesh(headGeo, m.skin);
    headMesh.castShadow = true;
    head.add(headMesh);

    // 2. Chibi Vinyl Eyes
    [-0.062, 0.062].forEach((ex, idx) => {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 12, 10),
        m.eyes
      );
      eye.scale.set(0.9, 1.25, 0.7);
      eye.position.set(ex, 0.015, 0.185);
      head.add(eye);

      // Specular highlights
      const shineLarge = new THREE.Mesh(
        new THREE.SphereGeometry(0.009, 8, 8),
        m.eyeShine
      );
      shineLarge.position.set(ex + (idx === 0 ? 0.008 : -0.008), 0.028, 0.198);
      head.add(shineLarge);

      const shineSmall = new THREE.Mesh(
        new THREE.SphereGeometry(0.005, 8, 8),
        m.eyeShine
      );
      shineSmall.position.set(ex + (idx === 0 ? -0.008 : 0.008), 0.005, 0.198);
      head.add(shineSmall);
    });

    // 3. Eyebrows
    [-0.062, 0.062].forEach((bx, idx) => {
      const brow = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, 0.012, 0.014),
        m.eyebrows
      );
      brow.rotation.z = idx === 0 ? -0.15 : 0.15;
      brow.position.set(bx, 0.065, 0.182);
      head.add(brow);
    });

    // 4. Subtle Smile
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.018, 0.005, 8, 16, Math.PI),
      m.mouth
    );
    mouth.rotation.x = Math.PI;
    mouth.position.set(0, -0.042, 0.185);
    head.add(mouth);

    // 5. Peach Blush
    [-0.105, 0.105].forEach((blx) => {
      const blush = new THREE.Mesh(
        new THREE.CircleGeometry(0.028, 12),
        m.blush
      );
      blush.position.set(blx, -0.018, 0.165);
      blush.rotation.y = blx > 0 ? 0.35 : -0.35;
      head.add(blush);
    });

    // 6. Sculpted Dark Hair peeking under hat
    // Front straight bangs fringe
    const fringe = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.045, 0.08),
      m.hair
    );
    fringe.position.set(0, 0.105, 0.152);
    head.add(fringe);

    // Sideburns framing cheeks
    [-0.185, 0.185].forEach((sx, idx) => {
      const sideHair = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.038, 0.10, 8, 8),
        m.hair
      );
      sideHair.position.set(sx, 0.02, 0.04);
      head.add(sideHair);
    });

    // Back hair at nape
    const backHair = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.16, 0.12, 14),
      m.hair
    );
    backHair.position.set(0, -0.06, -0.09);
    head.add(backHair);

    // 7. Streetwear Bucket Hat (Faithful collectible vinyl styling from reference)
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.11, -0.015);
    hatGroup.rotation.x = -0.08;

    // Crown cylinder
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.182, 0.205, 0.13, 20),
      m.bucketHat
    );
    crown.castShadow = true;
    hatGroup.add(crown);

    // Top crown cap
    const crownCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.182, 0.015, 20),
      m.bucketHat
    );
    crownCap.position.y = 0.068;
    hatGroup.add(crownCap);

    // Dark trim band around crown base
    const hatBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.206, 0.010, 8, 24),
      m.bucketHatBand
    );
    hatBand.rotateX(Math.PI / 2);
    hatBand.position.y = -0.055;
    hatGroup.add(hatBand);

    // Signature downward flared brim
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.205, 0.278, 0.055, 24, 1, true),
      m.bucketHat
    );
    brim.position.y = -0.082;
    brim.castShadow = true;
    hatGroup.add(brim);

    // Front white patch logo badge
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.042, 0.010),
      m.bucketHatBadge
    );
    badge.position.set(0, 0.01, 0.204);
    badge.castShadow = true;
    hatGroup.add(badge);

    head.add(hatGroup);
  }

  createHelperArms(torso) {
    const m = this.materials;
    const armRadius = 0.038;
    const upperArmLen = 0.14;
    const lowerArmLen = 0.13;

    // Helper to build arm with grey short sleeve and dark undersleeve
    const buildHelperArm = (shoulderPivot, isLeft) => {
      // Grey short sleeve
      const sleeve = new THREE.Mesh(
        new THREE.CapsuleGeometry(armRadius * 1.15, upperArmLen * 0.55, 8, 8),
        m.shirt
      );
      sleeve.position.y = -0.03 - (upperArmLen * 0.55) / 2;
      sleeve.castShadow = true;
      shoulderPivot.add(sleeve);

      // Dark long undersleeve
      const underArm = new THREE.Mesh(
        new THREE.CapsuleGeometry(armRadius * 1.02, upperArmLen * 0.50, 8, 8),
        m.undersleeves
      );
      underArm.position.y = -0.07 - (upperArmLen * 0.50) / 2;
      underArm.castShadow = true;
      shoulderPivot.add(underArm);
    };

    const buildHelperLowerArm = (elbowPivot, isLeft) => {
      // Dark long undersleeve extending down forearm
      const lowerArm = new THREE.Mesh(
        new THREE.CylinderGeometry(armRadius * 1.02, armRadius * 0.98, lowerArmLen * 0.78, 10),
        m.undersleeves
      );
      lowerArm.position.y = -lowerArmLen * 0.40;
      lowerArm.castShadow = true;
      elbowPivot.add(lowerArm);

      // Left wrist has wristwatch
      if (isLeft) {
        const watchStrap = new THREE.Mesh(
          new THREE.TorusGeometry(armRadius * 1.12, 0.012, 8, 16),
          m.watch
        );
        watchStrap.rotateX(Math.PI / 2);
        watchStrap.position.y = -lowerArmLen * 0.75;
        elbowPivot.add(watchStrap);

        const watchFace = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, 0.008, 12),
          m.watchDial
        );
        watchFace.rotation.z = Math.PI / 2;
        watchFace.position.set(-armRadius * 1.08, -lowerArmLen * 0.75, 0);
        elbowPivot.add(watchFace);
      }
    };

    // --- LEFT ARM ---
    this.leftShoulderPivot = new THREE.Group();
    this.leftShoulderPivot.name = 'LeftShoulderPivot';
    this.leftShoulderPivot.position.set(0.19, 0.21, 0);
    torso.add(this.leftShoulderPivot);

    buildHelperArm(this.leftShoulderPivot, true);

    this.leftElbowPivot = new THREE.Group();
    this.leftElbowPivot.name = 'LeftElbowPivot';
    this.leftElbowPivot.position.set(0, -upperArmLen, 0);
    this.leftShoulderPivot.add(this.leftElbowPivot);

    buildHelperLowerArm(this.leftElbowPivot, true);

    this.leftWristPivot = new THREE.Group();
    this.leftWristPivot.name = 'LeftWristPivot';
    this.leftWristPivot.position.set(0, -lowerArmLen, 0);
    this.leftElbowPivot.add(this.leftWristPivot);

    this.leftHandGroup = new THREE.Group();
    this.leftHandGroup.name = 'LeftHandGroup';
    const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), m.skin);
    lHand.castShadow = true;
    this.leftHandGroup.add(lHand);
    this.leftWristPivot.add(this.leftHandGroup);

    // --- RIGHT ARM ---
    this.rightShoulderPivot = new THREE.Group();
    this.rightShoulderPivot.name = 'RightShoulderPivot';
    this.rightShoulderPivot.position.set(-0.19, 0.21, 0);
    torso.add(this.rightShoulderPivot);

    buildHelperArm(this.rightShoulderPivot, false);

    this.rightElbowPivot = new THREE.Group();
    this.rightElbowPivot.name = 'RightElbowPivot';
    this.rightElbowPivot.position.set(0, -upperArmLen, 0);
    this.rightShoulderPivot.add(this.rightElbowPivot);

    buildHelperLowerArm(this.rightElbowPivot, false);

    this.rightWristPivot = new THREE.Group();
    this.rightWristPivot.name = 'RightWristPivot';
    this.rightWristPivot.position.set(0, -lowerArmLen, 0);
    this.rightElbowPivot.add(this.rightWristPivot);

    this.rightHandGroup = new THREE.Group();
    this.rightHandGroup.name = 'RightHandGroup';
    const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), m.skin);
    rHand.castShadow = true;
    this.rightHandGroup.add(rHand);
    this.rightWristPivot.add(this.rightHandGroup);
  }

  createHelperLegs(hipPivot) {
    const m = this.materials;
    const legRadius = 0.046;
    const upperLegLen = 0.16;
    const lowerLegLen = 0.14;
    const legSpacing = 0.075;

    const createHelperLowerLegAssembly = (kneePivot, isLeft) => {
      // Overalls straight trouser leg
      const shin = new THREE.Mesh(
        new THREE.CylinderGeometry(legRadius * 1.08, legRadius * 1.04, lowerLegLen * 0.78, 10),
        m.overalls
      );
      shin.position.y = -lowerLegLen * 0.38;
      shin.castShadow = true;
      kneePivot.add(shin);

      // Rolled ankle cuff
      const cuff = new THREE.Mesh(
        new THREE.TorusGeometry(legRadius * 1.15, 0.016, 8, 16),
        m.pantsCuff
      );
      cuff.rotateX(Math.PI / 2);
      cuff.position.y = -lowerLegLen * 0.74;
      cuff.castShadow = true;
      kneePivot.add(cuff);

      // Chunky skate sneaker
      const shoeGroup = new THREE.Group();
      shoeGroup.name = isLeft ? 'LeftShoeGroup' : 'RightShoeGroup';
      shoeGroup.position.set(0, -lowerLegLen * 0.85, 0.018);
      kneePivot.add(shoeGroup);

      // Thick white vulcanized rubber sole
      const sole = new THREE.Mesh(
        new THREE.BoxGeometry(0.125, 0.030, 0.185),
        m.shoeSole
      );
      sole.position.set(0, -0.065, 0.01);
      sole.castShadow = true;
      sole.receiveShadow = true;
      shoeGroup.add(sole);

      // Charcoal upper body
      const upperGeo = new THREE.SphereGeometry(0.068, 14, 12);
      upperGeo.scale(0.98, 0.78, 1.28);
      const shoeUpper = new THREE.Mesh(upperGeo, m.shoes);
      shoeUpper.position.set(0, -0.035, 0.026);
      shoeUpper.castShadow = true;
      shoeGroup.add(shoeUpper);

      // Slate tongue accent
      const tongue = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.018, 0.040),
        m.shoeAccent
      );
      tongue.position.set(0, -0.014, 0.028);
      shoeGroup.add(tongue);
    };

    // --- LEFT LEG ---
    this.leftHipPivot = new THREE.Group();
    this.leftHipPivot.name = 'LeftHipPivot';
    this.leftHipPivot.position.set(legSpacing, 0, 0);
    hipPivot.add(this.leftHipPivot);

    const lUpperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(legRadius * 1.08, upperLegLen, 8, 8),
      m.overalls
    );
    lUpperLeg.position.y = -upperLegLen / 2;
    lUpperLeg.castShadow = true;
    this.leftHipPivot.add(lUpperLeg);

    this.leftKneePivot = new THREE.Group();
    this.leftKneePivot.name = 'LeftKneePivot';
    this.leftKneePivot.position.set(0, -upperLegLen, 0);
    this.leftHipPivot.add(this.leftKneePivot);

    createHelperLowerLegAssembly(this.leftKneePivot, true);

    // --- RIGHT LEG ---
    this.rightHipPivot = new THREE.Group();
    this.rightHipPivot.name = 'RightHipPivot';
    this.rightHipPivot.position.set(-legSpacing, 0, 0);
    hipPivot.add(this.rightHipPivot);

    const rUpperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(legRadius * 1.08, upperLegLen, 8, 8),
      m.overalls
    );
    rUpperLeg.position.y = -upperLegLen / 2;
    rUpperLeg.castShadow = true;
    this.rightHipPivot.add(rUpperLeg);

    this.rightKneePivot = new THREE.Group();
    this.rightKneePivot.name = 'RightKneePivot';
    this.rightKneePivot.position.set(0, -upperLegLen, 0);
    this.rightHipPivot.add(this.rightKneePivot);

    createHelperLowerLegAssembly(this.rightKneePivot, false);
  }

  // ===========================================================================
  // CARRY REQUESTER CHARACTER IMPLEMENTATION (FROM REFERENCE IMAGE 1)
  // Streetwear Collectible Figurine: Black Baseball Cap, Sleek Bangs & Sidelocks,
  // Pink Hooded Bomber Jacket, Crop Top, High-Waisted Skirt & Chunky Combat Boots
  // ===========================================================================
  createRequesterMaterials() {
    return {
      skin: new THREE.MeshStandardMaterial({
        color: 0xffd8c2, // Warm peach collectible skin tone
        roughness: 0.55,
        metalness: 0.0,
      }),
      jacket: new THREE.MeshStandardMaterial({
        color: 0xf69bb7, // Soft baby-pink hooded bomber jacket from reference
        roughness: 0.44,
        metalness: 0.02,
      }),
      jacketRib: new THREE.MeshStandardMaterial({
        color: 0xe986a4, // Ribbed knit pink cuffs and hem
        roughness: 0.52,
      }),
      innerTop: new THREE.MeshStandardMaterial({
        color: 0xf7bed0, // Pastel pink cropped t-shirt
        roughness: 0.48,
      }),
      innerCollar: new THREE.MeshStandardMaterial({
        color: 0x202025, // Charcoal crew-neck collar trim
        roughness: 0.45,
      }),
      skirt: new THREE.MeshStandardMaterial({
        color: 0x1c1c20, // Matte black high-waisted miniskirt
        roughness: 0.45,
      }),
      belt: new THREE.MeshStandardMaterial({
        color: 0x111114, // Black leather belt
        roughness: 0.4,
      }),
      silverHardware: new THREE.MeshStandardMaterial({
        color: 0xd0d4da, // Silver zipper, belt buckle, hardware clips
        roughness: 0.25,
        metalness: 0.75,
      }),
      jacketBadge: new THREE.MeshStandardMaterial({
        color: 0x18181c, // Black chest logo patch
        roughness: 0.4,
      }),
      cap: new THREE.MeshStandardMaterial({
        color: 0x1c1c20, // Matte black baseball cap from reference
        roughness: 0.38,
        metalness: 0.02,
      }),
      capLogo: new THREE.MeshStandardMaterial({
        color: 0x32323a, // Raised monogram logo on front of cap
        roughness: 0.35,
      }),
      hair: new THREE.MeshStandardMaterial({
        color: 0x16161a, // Jet black glossy sculpted vinyl hair
        roughness: 0.25,
        metalness: 0.05,
      }),
      eyes: new THREE.MeshStandardMaterial({
        color: 0x121216, // Dark cat-eye eyeliner & lashes
        roughness: 0.2,
      }),
      iris: new THREE.MeshStandardMaterial({
        color: 0xf25b88, // Glowing hot/rose pink irises from reference
        roughness: 0.25,
        metalness: 0.05,
      }),
      pupil: new THREE.MeshStandardMaterial({
        color: 0x141418, // Black center pupil
        roughness: 0.1,
      }),
      eyeShine: new THREE.MeshBasicMaterial({
        color: 0xffffff, // Crisp white catchlight
      }),
      eyebrows: new THREE.MeshStandardMaterial({
        color: 0x1c1c20,
        roughness: 0.6,
      }),
      mouth: new THREE.MeshStandardMaterial({
        color: 0xd47480, // Soft rose lips
        roughness: 0.5,
      }),
      blush: new THREE.MeshStandardMaterial({
        color: 0xffa69e,
        roughness: 0.8,
        transparent: true,
        opacity: 0.45,
      }),
      boots: new THREE.MeshStandardMaterial({
        color: 0x18181c, // Chunky black combat boots
        roughness: 0.32,
        metalness: 0.08,
      }),
      bootSole: new THREE.MeshStandardMaterial({
        color: 0x101014, // Thick black lug sole
        roughness: 0.65,
      }),
      bootLaces: new THREE.MeshStandardMaterial({
        color: 0x28282e, // Criss-cross laces
        roughness: 0.5,
      }),
    };
  }

  createRequesterTorso(torso) {
    const m = this.materials;

    // 1. Inner pastel pink cropped top
    const cropTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.138, 0.15, 18),
      m.innerTop
    );
    cropTop.position.y = 0.15;
    cropTop.castShadow = true;
    cropTop.receiveShadow = true;
    torso.add(cropTop);

    // Collar dark trim ring
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.062, 0.010, 8, 20),
      m.innerCollar
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.23, 0.01);
    collar.castShadow = true;
    torso.add(collar);

    // Exposed skin midriff between crop top and high-waisted skirt
    const midriff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.128, 0.134, 0.038, 16),
      m.skin
    );
    midriff.position.y = 0.065;
    midriff.castShadow = true;
    torso.add(midriff);

    // 2. High-waisted black miniskirt
    const skirtGroup = new THREE.Group();
    skirtGroup.position.y = 0.01;

    // Leather belt with silver square buckle
    const belt = new THREE.Mesh(
      new THREE.TorusGeometry(0.138, 0.012, 8, 20),
      m.belt
    );
    belt.rotateX(Math.PI / 2);
    belt.position.y = 0.042;
    skirtGroup.add(belt);

    const buckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.030, 0.024, 0.015),
      m.silverHardware
    );
    buckle.position.set(0, 0.042, 0.144);
    buckle.castShadow = true;
    skirtGroup.add(buckle);

    // Flared A-line skirt
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.134, 0.165, 0.11, 18),
      m.skirt
    );
    skirt.position.y = -0.018;
    skirt.castShadow = true;
    skirtGroup.add(skirt);
    torso.add(skirtGroup);

    // 3. Baby-pink hooded zip-up bomber jacket (worn open at front)
    const jacketWrapGeo = new THREE.CylinderGeometry(0.138, 0.162, 0.22, 18, 1, false, Math.PI * 0.40, Math.PI * 1.20);
    const jacketWrap = new THREE.Mesh(jacketWrapGeo, m.jacket);
    jacketWrap.position.y = 0.13;
    jacketWrap.castShadow = true;
    jacketWrap.receiveShadow = true;
    torso.add(jacketWrap);

    // Left front vertical jacket lapel
    const leftLapel = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.21, 0.025),
      m.jacket
    );
    leftLapel.position.set(0.095, 0.13, 0.126);
    leftLapel.rotation.y = 0.22;
    leftLapel.castShadow = true;
    torso.add(leftLapel);

    // Right front vertical jacket lapel
    const rightLapel = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.21, 0.025),
      m.jacket
    );
    rightLapel.position.set(-0.095, 0.13, 0.126);
    rightLapel.rotation.y = -0.22;
    rightLapel.castShadow = true;
    torso.add(rightLapel);

    // Silver zipper teeth along front opening
    [-0.076, 0.076].forEach((zx) => {
      const zip = new THREE.Mesh(
        new THREE.BoxGeometry(0.007, 0.20, 0.008),
        m.silverHardware
      );
      zip.position.set(zx, 0.13, 0.136);
      zip.castShadow = true;
      torso.add(zip);
    });

    // Hanging silver zipper pull tab on left hem
    const zipPull = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.032, 0.008),
      m.silverHardware
    );
    zipPull.position.set(0.076, 0.018, 0.142);
    zipPull.castShadow = true;
    torso.add(zipPull);

    // Ribbed pink bottom hem band
    const hem = new THREE.Mesh(
      new THREE.TorusGeometry(0.158, 0.012, 8, 24),
      m.jacketRib
    );
    hem.rotateX(Math.PI / 2);
    hem.position.y = 0.025;
    hem.castShadow = true;
    torso.add(hem);

    // Left chest black rectangular logo patch
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.020, 0.010),
      m.jacketBadge
    );
    badge.position.set(0.070, 0.165, 0.140);
    badge.castShadow = true;
    torso.add(badge);

    // Right chest vertical strap detail
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.042, 0.008),
      m.jacketRib
    );
    strap.position.set(-0.070, 0.170, 0.140);
    strap.castShadow = true;
    torso.add(strap);

    // Bunched fabric hood hanging on upper back
    const hood = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.11, 0.08, 14),
      m.jacket
    );
    hood.rotation.x = -0.35;
    hood.position.set(0, 0.20, -0.115);
    hood.castShadow = true;
    torso.add(hood);
  }

  createRequesterHead(head) {
    const m = this.materials;

    // 1. Chibi Vinyl Head Sphere
    const headGeo = new THREE.SphereGeometry(0.20, 20, 18);
    headGeo.scale(1.05, 0.98, 1.0);
    const headMesh = new THREE.Mesh(headGeo, m.skin);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    head.add(headMesh);

    // Soft rounded lower cheeks
    [-0.115, 0.115].forEach((cx) => {
      const cheekPuff = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 12, 10),
        m.skin
      );
      cheekPuff.scale.set(1.05, 0.8, 0.85);
      cheekPuff.position.set(cx, -0.045, 0.085);
      head.add(cheekPuff);
    });

    // 2. Stylized Anime Eyes with Vibrant Rose-Pink Irises
    [-0.082, 0.082].forEach((ex, idx) => {
      // Eyeliner frame base
      const eyeLiner = new THREE.Mesh(
        new THREE.BoxGeometry(0.052, 0.034, 0.010),
        m.eyes
      );
      eyeLiner.rotation.z = idx === 0 ? 0.10 : -0.10;
      eyeLiner.position.set(ex, 0.018, 0.185);
      head.add(eyeLiner);

      // Wing flick on upper outer eye corner
      const wingFlick = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.007, 0.024, 4, 8),
        m.eyes
      );
      wingFlick.rotation.z = idx === 0 ? 0.65 : -0.65;
      wingFlick.position.set(ex + (idx === 0 ? 0.035 : -0.035), 0.036, 0.182);
      head.add(wingFlick);

      // Glowing pink iris
      const iris = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, 0.008, 14),
        m.iris
      );
      iris.rotation.x = Math.PI / 2;
      iris.position.set(ex, 0.018, 0.192);
      head.add(iris);

      // Center pupil
      const pupil = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.009, 10),
        m.pupil
      );
      pupil.rotation.x = Math.PI / 2;
      pupil.position.set(ex, 0.018, 0.194);
      head.add(pupil);

      // White specular catchlight
      const shine = new THREE.Mesh(
        new THREE.SphereGeometry(0.007, 8, 8),
        m.eyeShine
      );
      shine.position.set(ex + (idx === 0 ? -0.006 : 0.006), 0.026, 0.197);
      head.add(shine);
    });

    // 3. Eyebrows
    [-0.080, 0.080].forEach((bx, idx) => {
      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.006, 0.036, 4, 8),
        m.eyebrows
      );
      brow.rotation.z = idx === 0 ? Math.PI / 2 - 0.14 : Math.PI / 2 + 0.14;
      brow.position.set(bx, 0.068, 0.182);
      head.add(brow);
    });

    // 4. Cute Button Nose
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 8, 8),
      m.skin
    );
    nose.scale.set(1.0, 0.7, 0.7);
    nose.position.set(0, -0.028, 0.198);
    head.add(nose);

    // 5. Neutral Calm Mouth
    const mouth = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.007, 0.020, 4, 8),
      m.mouth
    );
    mouth.rotation.z = Math.PI / 2;
    mouth.position.set(0, -0.065, 0.188);
    head.add(mouth);

    // 6. Soft Peach Blush Discs
    [-0.118, 0.118].forEach((blx) => {
      const blush = new THREE.Mesh(
        new THREE.CircleGeometry(0.026, 12),
        m.blush
      );
      blush.position.set(blx, -0.036, 0.170);
      blush.rotation.y = blx > 0 ? 0.35 : -0.35;
      head.add(blush);
    });

    // 7. Sleek Black Sculpted Hair
    // Straight blunt bangs across forehead
    const bangsGroup = new THREE.Group();
    bangsGroup.position.set(0, 0.095, 0.170);

    const centerBangs = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.055, 0.038),
      m.hair
    );
    centerBangs.castShadow = true;
    bangsGroup.add(centerBangs);

    [-0.08, 0.08].forEach((bx) => {
      const bangEnd = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.022, 0.045, 6, 8),
        m.hair
      );
      bangEnd.position.set(bx, -0.022, 0.005);
      bangEnd.castShadow = true;
      bangsGroup.add(bangEnd);
    });
    head.add(bangsGroup);

    // Long front sidelocks framing cheeks and descending in front of shoulders
    [-0.175, 0.175].forEach((sx, idx) => {
      const sidelock = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.030, 0.34, 8, 10),
        m.hair
      );
      sidelock.rotation.set(0.12, idx === 0 ? 0.10 : -0.10, idx === 0 ? -0.08 : 0.08);
      sidelock.position.set(sx, -0.08, 0.085);
      sidelock.castShadow = true;
      head.add(sidelock);
    });

    // Voluminous long back hair cascading down back
    const backHairGroup = new THREE.Group();
    backHairGroup.position.set(0, -0.08, -0.105);

    const backHairMain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.27, 0.38, 16),
      m.hair
    );
    backHairMain.position.y = -0.10;
    backHairMain.castShadow = true;
    backHairGroup.add(backHairMain);

    const backHairTips = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.038, 8, 20, Math.PI),
      m.hair
    );
    backHairTips.rotation.x = Math.PI;
    backHairTips.position.set(0, -0.28, 0);
    backHairTips.castShadow = true;
    backHairGroup.add(backHairTips);
    head.add(backHairGroup);

    // 8. Matte Black Baseball Cap
    const capGroup = new THREE.Group();
    capGroup.position.set(0, 0.055, -0.010);
    capGroup.rotation.x = 0.06;

    // Cap crown dome
    const crownGeo = new THREE.SphereGeometry(0.216, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62);
    crownGeo.scale(1.04, 1.0, 1.02);
    const crown = new THREE.Mesh(crownGeo, m.cap);
    crown.castShadow = true;
    capGroup.add(crown);

    // Cap top button
    const capButton = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 8, 8),
      m.cap
    );
    capButton.position.set(0, 0.218, 0);
    capGroup.add(capButton);

    // Raised circular monogram logo badge on front crown
    const capBadge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.012, 16),
      m.capLogo
    );
    capBadge.rotation.x = Math.PI / 2 - 0.22;
    capBadge.position.set(0, 0.125, 0.188);
    capBadge.castShadow = true;
    capGroup.add(capBadge);

    // Curved front cap visor/brim extending forward over forehead
    const visorGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.016, 18, 1, false, Math.PI * 0.32, Math.PI * 0.36);
    const visor = new THREE.Mesh(visorGeo, m.cap);
    visor.rotation.set(-0.35, 0, 0);
    visor.position.set(0, 0.075, 0.225);
    visor.castShadow = true;
    capGroup.add(visor);

    head.add(capGroup);
  }

  createRequesterArms(torso) {
    const m = this.materials;
    const armRadius = 0.036;
    const upperArmLen = 0.14;
    const lowerArmLen = 0.13;

    const buildRequesterArm = (shoulderPivot, isLeft) => {
      // Puffy pink bomber sleeve
      const upperSleeve = new THREE.Mesh(
        new THREE.CapsuleGeometry(armRadius * 1.25, upperArmLen * 0.75, 8, 8),
        m.jacket
      );
      upperSleeve.position.y = -upperArmLen / 2;
      upperSleeve.castShadow = true;
      shoulderPivot.add(upperSleeve);

      // On left arm: black logo strap with silver buckle
      if (isLeft) {
        const patch = new THREE.Mesh(
          new THREE.BoxGeometry(0.018, 0.038, 0.035),
          m.jacketBadge
        );
        patch.position.set(armRadius * 1.15, -upperArmLen * 0.45, 0);
        shoulderPivot.add(patch);

        const buckle = new THREE.Mesh(
          new THREE.BoxGeometry(0.014, 0.016, 0.024),
          m.silverHardware
        );
        buckle.position.set(armRadius * 1.22, -upperArmLen * 0.45, 0);
        shoulderPivot.add(buckle);
      }
    };

    const buildRequesterLowerArm = (elbowPivot, isLeft) => {
      // Lower bomber sleeve
      const lowerSleeve = new THREE.Mesh(
        new THREE.CapsuleGeometry(armRadius * 1.18, lowerArmLen * 0.65, 8, 8),
        m.jacket
      );
      lowerSleeve.position.y = -lowerArmLen * 0.38;
      lowerSleeve.castShadow = true;
      elbowPivot.add(lowerSleeve);

      // Ribbed pink wrist cuff
      const cuff = new THREE.Mesh(
        new THREE.TorusGeometry(armRadius * 1.15, 0.014, 8, 16),
        m.jacketRib
      );
      cuff.rotateX(Math.PI / 2);
      cuff.position.y = -lowerArmLen * 0.75;
      cuff.castShadow = true;
      elbowPivot.add(cuff);
    };

    // --- LEFT ARM ---
    this.leftShoulderPivot = new THREE.Group();
    this.leftShoulderPivot.name = 'LeftShoulderPivot';
    this.leftShoulderPivot.position.set(0.185, 0.21, 0);
    torso.add(this.leftShoulderPivot);

    buildRequesterArm(this.leftShoulderPivot, true);

    this.leftElbowPivot = new THREE.Group();
    this.leftElbowPivot.name = 'LeftElbowPivot';
    this.leftElbowPivot.position.set(0, -upperArmLen, 0);
    this.leftShoulderPivot.add(this.leftElbowPivot);

    buildRequesterLowerArm(this.leftElbowPivot, true);

    this.leftWristPivot = new THREE.Group();
    this.leftWristPivot.name = 'LeftWristPivot';
    this.leftWristPivot.position.set(0, -lowerArmLen, 0);
    this.leftElbowPivot.add(this.leftWristPivot);

    this.leftHandGroup = new THREE.Group();
    this.leftHandGroup.name = 'LeftHandGroup';
    const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), m.skin);
    lHand.castShadow = true;
    this.leftHandGroup.add(lHand);
    this.leftWristPivot.add(this.leftHandGroup);

    // --- RIGHT ARM ---
    this.rightShoulderPivot = new THREE.Group();
    this.rightShoulderPivot.name = 'RightShoulderPivot';
    this.rightShoulderPivot.position.set(-0.185, 0.21, 0);
    torso.add(this.rightShoulderPivot);

    buildRequesterArm(this.rightShoulderPivot, false);

    this.rightElbowPivot = new THREE.Group();
    this.rightElbowPivot.name = 'RightElbowPivot';
    this.rightElbowPivot.position.set(0, -upperArmLen, 0);
    this.rightShoulderPivot.add(this.rightElbowPivot);

    buildRequesterLowerArm(this.rightElbowPivot, false);

    this.rightWristPivot = new THREE.Group();
    this.rightWristPivot.name = 'RightWristPivot';
    this.rightWristPivot.position.set(0, -lowerArmLen, 0);
    this.rightElbowPivot.add(this.rightWristPivot);

    this.rightHandGroup = new THREE.Group();
    this.rightHandGroup.name = 'RightHandGroup';
    const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), m.skin);
    rHand.castShadow = true;
    this.rightHandGroup.add(rHand);
    this.rightWristPivot.add(this.rightHandGroup);
  }

  createRequesterLegs(hipPivot) {
    const m = this.materials;
    const legRadius = 0.040;
    const upperLegLen = 0.16;
    const lowerLegLen = 0.14;
    const legSpacing = 0.072;

    const createRequesterLowerLegAssembly = (kneePivot, isLeft) => {
      // Bare vinyl skin calf
      const calf = new THREE.Mesh(
        new THREE.CapsuleGeometry(legRadius * 0.95, lowerLegLen * 0.50, 8, 8),
        m.skin
      );
      calf.position.y = -lowerLegLen * 0.28;
      calf.castShadow = true;
      kneePivot.add(calf);

      // High-top black combat boot shaft
      const bootShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(legRadius * 1.15, legRadius * 1.10, lowerLegLen * 0.55, 12),
        m.boots
      );
      bootShaft.position.y = -lowerLegLen * 0.65;
      bootShaft.castShadow = true;
      kneePivot.add(bootShaft);

      // Silver side buckle on outer shaft
      const buckle = new THREE.Mesh(
        new THREE.BoxGeometry(0.010, 0.016, 0.018),
        m.silverHardware
      );
      buckle.position.set(isLeft ? legRadius * 1.12 : -legRadius * 1.12, -lowerLegLen * 0.65, 0);
      kneePivot.add(buckle);

      // Boot foot assembly
      const shoeGroup = new THREE.Group();
      shoeGroup.name = isLeft ? 'LeftShoeGroup' : 'RightShoeGroup';
      shoeGroup.position.set(0, -lowerLegLen * 0.85, 0.015);
      kneePivot.add(shoeGroup);

      // Thick black rubber lug sole
      const sole = new THREE.Mesh(
        new THREE.BoxGeometry(0.115, 0.030, 0.175),
        m.bootSole
      );
      sole.position.set(0, -0.065, 0.012);
      sole.castShadow = true;
      sole.receiveShadow = true;
      shoeGroup.add(sole);

      // Rounded leather upper
      const upperGeo = new THREE.SphereGeometry(0.064, 14, 12);
      upperGeo.scale(0.92, 0.76, 1.25);
      const shoeUpper = new THREE.Mesh(upperGeo, m.boots);
      shoeUpper.position.set(0, -0.036, 0.025);
      shoeUpper.castShadow = true;
      shoeGroup.add(shoeUpper);

      // Front criss-cross laces accent
      const laces = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.016, 0.035),
        m.bootLaces
      );
      laces.position.set(0, -0.016, 0.030);
      shoeGroup.add(laces);
    };

    // --- LEFT LEG ---
    this.leftHipPivot = new THREE.Group();
    this.leftHipPivot.name = 'LeftHipPivot';
    this.leftHipPivot.position.set(legSpacing, 0, 0);
    hipPivot.add(this.leftHipPivot);

    const lUpperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(legRadius, upperLegLen, 8, 8),
      m.skin
    );
    lUpperLeg.position.y = -upperLegLen / 2;
    lUpperLeg.castShadow = true;
    this.leftHipPivot.add(lUpperLeg);

    this.leftKneePivot = new THREE.Group();
    this.leftKneePivot.name = 'LeftKneePivot';
    this.leftKneePivot.position.set(0, -upperLegLen, 0);
    this.leftHipPivot.add(this.leftKneePivot);

    createRequesterLowerLegAssembly(this.leftKneePivot, true);

    // --- RIGHT LEG ---
    this.rightHipPivot = new THREE.Group();
    this.rightHipPivot.name = 'RightHipPivot';
    this.rightHipPivot.position.set(-legSpacing, 0, 0);
    hipPivot.add(this.rightHipPivot);

    const rUpperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(legRadius, upperLegLen, 8, 8),
      m.skin
    );
    rUpperLeg.position.y = -upperLegLen / 2;
    rUpperLeg.castShadow = true;
    this.rightHipPivot.add(rUpperLeg);

    this.rightKneePivot = new THREE.Group();
    this.rightKneePivot.name = 'RightKneePivot';
    this.rightKneePivot.position.set(0, -upperLegLen, 0);
    this.rightHipPivot.add(this.rightKneePivot);

    createRequesterLowerLegAssembly(this.rightKneePivot, false);
  }

  // ===========================================================================
  // LADDER LENDER CHARACTER IMPLEMENTATION (FROM REFERENCE IMAGE)
  // Kindly older gentleman figurine: silver-grey hair, full silver-grey mustache & beard,
  // button nose, sage green cardigan with warm caramel trim, taupe trousers with cuffs,
  // caramel shoes, and wooden walking cane with blue rubber ferrule tip.
  // ===========================================================================
  createLadderLenderMaterials() {
    return {
      skin: new THREE.MeshStandardMaterial({
        color: 0xf7cbb0, // Warm peach vinyl skin
        roughness: 0.65,
        metalness: 0.0,
      }),
      hair: new THREE.MeshStandardMaterial({
        color: 0xaba49c, // Silver-grey neatly groomed hair
        roughness: 0.75,
        metalness: 0.0,
      }),
      eyebrows: new THREE.MeshStandardMaterial({
        color: 0xe5dfd5, // Light cream/white arched eyebrows
        roughness: 0.8,
        metalness: 0.0,
      }),
      mustache: new THREE.MeshStandardMaterial({
        color: 0xe5dfd5, // Thick white/light cream mustache
        roughness: 0.8,
        metalness: 0.0,
      }),
      beard: new THREE.MeshStandardMaterial({
        color: 0xd6ccc2, // Soft oatmeal / warm silver-grey beard
        roughness: 0.8,
        metalness: 0.0,
      }),
      eyes: new THREE.MeshStandardMaterial({
        color: 0x1a1a1a, // Glossy black bead eyes
        roughness: 0.2,
      }),
      nose: new THREE.MeshStandardMaterial({
        color: 0xf2b498, // Warm prominent button nose
        roughness: 0.65,
      }),
      sweater: new THREE.MeshStandardMaterial({
        color: 0x5f8458, // Sage / olive green cardigan sweater
        roughness: 0.72,
        metalness: 0.0,
      }),
      trim: new THREE.MeshStandardMaterial({
        color: 0xa45b32, // Warm cognac / caramel collar, placket, hem, cuffs
        roughness: 0.65,
        metalness: 0.0,
      }),
      trousers: new THREE.MeshStandardMaterial({
        color: 0x6e625a, // Taupe / warm brownish-grey straight pants
        roughness: 0.75,
        metalness: 0.0,
      }),
      cuffs: new THREE.MeshStandardMaterial({
        color: 0x7a6e66, // Rolled trouser hem cuff
        roughness: 0.72,
        metalness: 0.0,
      }),
      shoes: new THREE.MeshStandardMaterial({
        color: 0x9e582f, // Warm caramel leather shoes
        roughness: 0.55,
        metalness: 0.04,
      }),
      caneWood: new THREE.MeshStandardMaterial({
        color: 0x4e3220, // Dark polished wood cane shaft & curved handle
        roughness: 0.45,
        metalness: 0.05,
      }),
      caneTip: new THREE.MeshStandardMaterial({
        color: 0x1e3860, // Deep blue rubber cane ferrule tip
        roughness: 0.6,
      }),
    };
  }

  createLadderLenderTorso(torso) {
    const m = this.materials;

    // 1. Sage green cardigan sweater body
    const sweaterGeo = new THREE.CylinderGeometry(0.145, 0.165, 0.27, 18);
    const sweater = new THREE.Mesh(sweaterGeo, m.sweater);
    sweater.position.y = 0.135;
    sweater.castShadow = true;
    sweater.receiveShadow = true;
    torso.add(sweater);

    // 2. Caramel bottom hem band
    const hem = new THREE.Mesh(
      new THREE.TorusGeometry(0.165, 0.014, 8, 24),
      m.trim
    );
    hem.rotateX(Math.PI / 2);
    hem.position.y = 0.015;
    hem.castShadow = true;
    torso.add(hem);

    // 3. Central vertical placket stripe down front
    const placket = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.26, 0.018),
      m.trim
    );
    placket.position.set(0, 0.142, 0.148);
    placket.castShadow = true;
    torso.add(placket);

    // 4. Pointed / rounded collar in caramel trim
    const collarGroup = new THREE.Group();
    collarGroup.position.set(0, 0.265, 0.015);

    // Left collar flap
    const lCollar = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.038, 0.016),
      m.trim
    );
    lCollar.position.set(0.048, 0.0, 0.115);
    lCollar.rotation.set(-0.25, 0.35, -0.25);
    lCollar.castShadow = true;
    collarGroup.add(lCollar);

    // Right collar flap
    const rCollar = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.038, 0.016),
      m.trim
    );
    rCollar.position.set(-0.048, 0.0, 0.115);
    rCollar.rotation.set(-0.25, -0.35, 0.25);
    rCollar.castShadow = true;
    collarGroup.add(rCollar);

    // Rear collar roll
    const rearCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.013, 8, 18, Math.PI * 1.2),
      m.trim
    );
    rearCollar.rotateX(Math.PI / 2);
    rearCollar.position.set(0, 0.01, -0.015);
    rearCollar.castShadow = true;
    collarGroup.add(rearCollar);

    torso.add(collarGroup);
  }

  createLadderLenderHead(head) {
    const m = this.materials;

    // 1. Chibi vinyl head sphere
    const headGeo = new THREE.SphereGeometry(0.205, 20, 18);
    headGeo.scale(1.02, 1.0, 1.02);
    const headMesh = new THREE.Mesh(headGeo, m.skin);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    head.add(headMesh);

    // 2. Ears
    [-0.208, 0.208].forEach((ex) => {
      const ear = new THREE.Mesh(
        new THREE.SphereGeometry(0.046, 12, 10),
        m.skin
      );
      ear.scale.set(0.65, 1.05, 0.85);
      ear.position.set(ex, 0.0, -0.015);
      ear.castShadow = true;
      head.add(ear);
    });

    // 3. Eyes (glossy black beads)
    [-0.068, 0.068].forEach((eyeX) => {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.024, 12, 12),
        m.eyes
      );
      eye.position.set(eyeX, 0.038, 0.188);
      head.add(eye);
    });

    // 4. White / cream arched eyebrows
    [-0.070, 0.070].forEach((browX, idx) => {
      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.011, 0.046, 8, 8),
        m.eyebrows
      );
      brow.position.set(browX, 0.092, 0.182);
      brow.rotation.z = idx === 0 ? 0.35 : -0.35;
      brow.castShadow = true;
      head.add(brow);
    });

    // 5. Prominent button nose
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.046, 14, 14),
      m.nose
    );
    nose.position.set(0, 0.005, 0.205);
    nose.castShadow = true;
    head.add(nose);

    // 6. Thick puffy two-lobed mustache right below nose
    const mustacheGroup = new THREE.Group();
    mustacheGroup.position.set(0, -0.035, 0.198);

    const lMoustache = new THREE.Mesh(
      new THREE.SphereGeometry(0.044, 14, 12),
      m.mustache
    );
    lMoustache.scale.set(1.25, 0.72, 0.90);
    lMoustache.position.set(0.040, 0, 0);
    lMoustache.rotation.z = -0.14;
    lMoustache.castShadow = true;
    mustacheGroup.add(lMoustache);

    const rMoustache = new THREE.Mesh(
      new THREE.SphereGeometry(0.044, 14, 12),
      m.mustache
    );
    rMoustache.scale.set(1.25, 0.72, 0.90);
    rMoustache.position.set(-0.040, 0, 0);
    rMoustache.rotation.z = 0.14;
    rMoustache.castShadow = true;
    mustacheGroup.add(rMoustache);

    head.add(mustacheGroup);

    // 7. Full sculpted beard wrapping around chin and jawline
    const beardGroup = new THREE.Group();

    // Chin beard
    const chinBeard = new THREE.Mesh(
      new THREE.SphereGeometry(0.098, 16, 14),
      m.beard
    );
    chinBeard.scale.set(1.15, 0.92, 1.05);
    chinBeard.position.set(0, -0.115, 0.130);
    chinBeard.castShadow = true;
    beardGroup.add(chinBeard);

    // Jawline left & right beard volume connecting to sideburns
    [-0.125, 0.125].forEach((bx) => {
      const jawBeard = new THREE.Mesh(
        new THREE.SphereGeometry(0.082, 14, 12),
        m.beard
      );
      jawBeard.scale.set(0.9, 1.1, 1.0);
      jawBeard.position.set(bx, -0.065, 0.075);
      jawBeard.castShadow = true;
      beardGroup.add(jawBeard);
    });

    head.add(beardGroup);

    // 8. Silver-grey sculpted hair cap with side part
    const hairGroup = new THREE.Group();

    // Main top / back dome
    const hairDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.218, 20, 18, 0, Math.PI * 2, 0, Math.PI * 0.58),
      m.hair
    );
    hairDome.position.set(0, 0.025, -0.015);
    hairDome.castShadow = true;
    hairGroup.add(hairDome);

    // Parted hair swoop on top
    const hairSwoop = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 14, 12),
      m.hair
    );
    hairSwoop.scale.set(1.5, 0.55, 1.1);
    hairSwoop.position.set(0.045, 0.185, 0.045);
    hairSwoop.rotation.z = -0.18;
    hairSwoop.castShadow = true;
    hairGroup.add(hairSwoop);

    // Left and right sideburn hair tufts
    [-0.195, 0.195].forEach((sx) => {
      const sideburn = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.025, 0.065, 8, 8),
        m.hair
      );
      sideburn.position.set(sx, 0.035, 0.02);
      sideburn.castShadow = true;
      hairGroup.add(sideburn);
    });

    head.add(hairGroup);
  }

  createLadderLenderArms(torso) {
    const m = this.materials;
    const armRadius = 0.042;
    const upperArmLen = 0.13;
    const lowerArmLen = 0.12;

    const buildArm = (pivot, isLeft) => {
      const upperArm = new THREE.Mesh(
        new THREE.CapsuleGeometry(armRadius, upperArmLen, 8, 8),
        m.sweater
      );
      upperArm.position.y = -upperArmLen / 2;
      upperArm.castShadow = true;
      pivot.add(upperArm);
    };

    const buildLowerArm = (pivot, isLeft) => {
      const lowerArm = new THREE.Mesh(
        new THREE.CapsuleGeometry(armRadius * 0.94, lowerArmLen, 8, 8),
        m.sweater
      );
      lowerArm.position.y = -lowerArmLen / 2;
      lowerArm.castShadow = true;
      pivot.add(lowerArm);

      // Caramel sleeve cuff ring
      const cuff = new THREE.Mesh(
        new THREE.TorusGeometry(armRadius * 1.05, 0.012, 8, 16),
        m.trim
      );
      cuff.rotateX(Math.PI / 2);
      cuff.position.y = -lowerArmLen * 0.88;
      cuff.castShadow = true;
      pivot.add(cuff);
    };

    // --- LEFT ARM ---
    this.leftShoulderPivot = new THREE.Group();
    this.leftShoulderPivot.name = 'LeftShoulderPivot';
    this.leftShoulderPivot.position.set(0.185, 0.22, 0);
    torso.add(this.leftShoulderPivot);

    buildArm(this.leftShoulderPivot, true);

    this.leftElbowPivot = new THREE.Group();
    this.leftElbowPivot.name = 'LeftElbowPivot';
    this.leftElbowPivot.position.set(0, -upperArmLen, 0);
    this.leftShoulderPivot.add(this.leftElbowPivot);

    buildLowerArm(this.leftElbowPivot, true);

    this.leftWristPivot = new THREE.Group();
    this.leftWristPivot.name = 'LeftWristPivot';
    this.leftWristPivot.position.set(0, -lowerArmLen, 0);
    this.leftElbowPivot.add(this.leftWristPivot);

    this.leftHandGroup = new THREE.Group();
    this.leftHandGroup.name = 'LeftHandGroup';
    const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), m.skin);
    lHand.castShadow = true;
    this.leftHandGroup.add(lHand);
    this.leftWristPivot.add(this.leftHandGroup);

    // --- RIGHT ARM ---
    this.rightShoulderPivot = new THREE.Group();
    this.rightShoulderPivot.name = 'RightShoulderPivot';
    this.rightShoulderPivot.position.set(-0.185, 0.22, 0);
    torso.add(this.rightShoulderPivot);

    buildArm(this.rightShoulderPivot, false);

    this.rightElbowPivot = new THREE.Group();
    this.rightElbowPivot.name = 'RightElbowPivot';
    this.rightElbowPivot.position.set(0, -upperArmLen, 0);
    this.rightShoulderPivot.add(this.rightElbowPivot);

    buildLowerArm(this.rightElbowPivot, false);

    this.rightWristPivot = new THREE.Group();
    this.rightWristPivot.name = 'RightWristPivot';
    this.rightWristPivot.position.set(0, -lowerArmLen, 0);
    this.rightElbowPivot.add(this.rightWristPivot);

    this.rightHandGroup = new THREE.Group();
    this.rightHandGroup.name = 'RightHandGroup';
    const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), m.skin);
    rHand.castShadow = true;
    this.rightHandGroup.add(rHand);
    this.rightWristPivot.add(this.rightHandGroup);

    // --- WALKING CANE (held in right hand) ---
    const caneGroup = new THREE.Group();
    caneGroup.name = 'LadderLenderWalkingCane';
    caneGroup.position.set(0, -0.01, 0);

    // Cane curved crook handle
    const handleGeo = new THREE.TorusGeometry(0.030, 0.010, 8, 16, Math.PI * 1.35);
    const handle = new THREE.Mesh(handleGeo, m.caneWood);
    handle.rotation.z = Math.PI * 0.95;
    handle.rotation.y = Math.PI / 2;
    handle.position.set(0, 0.025, 0.02);
    handle.castShadow = true;
    caneGroup.add(handle);

    // Cane straight wood shaft
    const caneShaftLen = 0.44;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.0075, caneShaftLen, 10),
      m.caneWood
    );
    shaft.position.y = -caneShaftLen / 2 + 0.01;
    shaft.castShadow = true;
    caneGroup.add(shaft);

    // Cane tip (blue rubber ferrule)
    const ferrule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0095, 0.011, 0.028, 10),
      m.caneTip
    );
    ferrule.position.y = -caneShaftLen + 0.01;
    ferrule.castShadow = true;
    caneGroup.add(ferrule);

    this.rightHandGroup.add(caneGroup);
    this.walkingCane = caneGroup;
  }

  createLadderLenderLegs(hipPivot) {
    const m = this.materials;
    const legRadius = 0.046;
    const upperLegLen = 0.16;
    const lowerLegLen = 0.14;
    const legSpacing = 0.076;

    const buildLowerLeg = (kneePivot, isLeft) => {
      // Taupe trouser calf
      const calf = new THREE.Mesh(
        new THREE.CapsuleGeometry(legRadius * 0.96, lowerLegLen * 0.70, 8, 8),
        m.trousers
      );
      calf.position.y = -lowerLegLen * 0.38;
      calf.castShadow = true;
      kneePivot.add(calf);

      // Rolled cuff at ankle
      const cuff = new THREE.Mesh(
        new THREE.TorusGeometry(legRadius * 1.10, 0.014, 8, 16),
        m.cuffs
      );
      cuff.rotateX(Math.PI / 2);
      cuff.position.y = -lowerLegLen * 0.74;
      cuff.castShadow = true;
      kneePivot.add(cuff);

      // Shoe
      const shoeUpper = new THREE.Mesh(
        new THREE.SphereGeometry(0.056, 14, 12),
        m.shoes
      );
      shoeUpper.scale.set(0.92, 0.65, 1.40);
      shoeUpper.position.set(0, -lowerLegLen * 0.94, 0.024);
      shoeUpper.castShadow = true;
      kneePivot.add(shoeUpper);
    };

    // --- LEFT LEG ---
    this.leftHipPivot = new THREE.Group();
    this.leftHipPivot.name = 'LeftHipPivot';
    this.leftHipPivot.position.set(legSpacing, 0, 0);
    hipPivot.add(this.leftHipPivot);

    const lUpperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(legRadius, upperLegLen, 8, 8),
      m.trousers
    );
    lUpperLeg.position.y = -upperLegLen / 2;
    lUpperLeg.castShadow = true;
    this.leftHipPivot.add(lUpperLeg);

    this.leftKneePivot = new THREE.Group();
    this.leftKneePivot.name = 'LeftKneePivot';
    this.leftKneePivot.position.set(0, -upperLegLen, 0);
    this.leftHipPivot.add(this.leftKneePivot);

    buildLowerLeg(this.leftKneePivot, true);

    // --- RIGHT LEG ---
    this.rightHipPivot = new THREE.Group();
    this.rightHipPivot.name = 'RightHipPivot';
    this.rightHipPivot.position.set(-legSpacing, 0, 0);
    hipPivot.add(this.rightHipPivot);

    const rUpperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(legRadius, upperLegLen, 8, 8),
      m.trousers
    );
    rUpperLeg.position.y = -upperLegLen / 2;
    rUpperLeg.castShadow = true;
    this.rightHipPivot.add(rUpperLeg);

    this.rightKneePivot = new THREE.Group();
    this.rightKneePivot.name = 'RightKneePivot';
    this.rightKneePivot.position.set(0, -upperLegLen, 0);
    this.rightHipPivot.add(this.rightKneePivot);

    buildLowerLeg(this.rightKneePivot, false);
  }

  // ===========================================================================
  // SHARED RESIDENT INTERFACES & ANIMATION LOOP
  // ===========================================================================
  setCarryingItem(isCarrying = true) {
    this.isCarrying = isCarrying;
    this.isCarryingLadder = false;
    this.isCarryingBox = false;
    if (!isCarrying) {
      if (this.rightShoulderPivot) {
        this.rightShoulderPivot.rotation.z = 0;
        this.rightShoulderPivot.rotation.y = 0;
      }
    }
  }

  setCarryingLadder(isCarrying = true) {
    this.isCarryingLadder = isCarrying;
    this.isCarrying = isCarrying;
    this.isCarryingBox = false;
    if (!isCarrying) {
      if (this.rightShoulderPivot) {
        this.rightShoulderPivot.rotation.z = 0;
        this.rightShoulderPivot.rotation.y = 0;
      }
    }
  }

  setCarryingBox(isCarrying = true) {
    this.isCarryingBox = isCarrying;
    this.isCarrying = false;
    this.isCarryingLadder = false;
    if (!isCarrying) {
      if (this.rightShoulderPivot) {
        this.rightShoulderPivot.rotation.set(0, 0, 0);
        this.rightElbowPivot.rotation.set(0, 0, 0);
      }
      if (this.leftShoulderPivot) {
        this.leftShoulderPivot.rotation.set(0, 0, 0);
        this.leftElbowPivot.rotation.set(0, 0, 0);
      }
    }
  }

  setWorkingOnTask(isWorking = true) {
    this.isWorkingOnTask = isWorking;
    if (!isWorking) {
      if (this.rightShoulderPivot) {
        this.rightShoulderPivot.rotation.z = 0;
        this.rightShoulderPivot.rotation.x = 0;
        this.rightShoulderPivot.rotation.y = 0;
      }
      if (this.leftShoulderPivot) {
        this.leftShoulderPivot.rotation.z = 0;
        this.leftShoulderPivot.rotation.x = 0;
        this.leftShoulderPivot.rotation.y = 0;
      }
      if (this.neckPivot) {
        this.neckPivot.rotation.x = 0;
      }
    }
  }

  turnTo(targetAngle) {
    this.targetRotationY = targetAngle;
  }

  getHeadingDiff(targetAngle) {
    let diff = targetAngle - this.root.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  }

  reachForHandoff(amount = 1.0) {
    this.reachAmount = amount;
  }

  setRoute(points, resetPosition = false) {
    this.route = points;
    this.routeIndex = 0;
    this.targetRotationY = null;
    this.reachAmount = 0.0;
    if (this.route.length > 0) {
      if (resetPosition || this.route.length === 1) {
        this.root.position.copy(this.route[0]);
      }
      if (this.route.length > 1) {
        const distToStart = this.root.position.distanceTo(this.route[0]);
        if (distToStart < 0.15) {
          this.routeIndex = 1;
          this.targetPosition.copy(this.route[1]);
        } else {
          this.routeIndex = 0;
          this.targetPosition.copy(this.route[0]);
        }
        this.state = 'WALKING';
      } else {
        this.state = 'IDLE';
      }
    }
  }

  update(delta) {
    if (!delta || delta <= 0) return;

    if (this.state === 'WALKING' && this.route.length > 1) {
      this.walkWeight = Math.min(1.0, this.walkWeight + delta * 8.0);
      const dist = this.root.position.distanceTo(this.targetPosition);

      // Clamp movement step so it never overshoots target
      const step = Math.min(dist, this.walkSpeed * delta);

      if (dist <= 0.08 || dist <= step + 0.001) {
        this.root.position.copy(this.targetPosition);
        if (this.routeIndex < this.route.length - 1) {
          this.routeIndex++;
          this.targetPosition.copy(this.route[this.routeIndex]);
        } else {
          this.state = 'IDLE';
        }
      } else {
        this.tempVec.subVectors(this.targetPosition, this.root.position);
        this.tempVec.y = 0;
        this.tempVec.normalize();

        this.root.position.addScaledVector(this.tempVec, step);

        const targetAngle = Math.atan2(this.tempVec.x, this.tempVec.z);
        let diff = targetAngle - this.root.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.root.rotation.y += diff * Math.min(1.0, 10.0 * delta);

        this.walkCycle = (this.walkCycle + delta * this.walkSpeed * 4.2) % (Math.PI * 2);
      }
    } else {
      // Smoothly blend walk weight down to 0 without corrupting phase
      this.walkWeight = Math.max(0.0, this.walkWeight - delta * 6.0);

      if (this.state === 'IDLE' && this.targetRotationY !== null) {
        let diff = this.targetRotationY - this.root.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.root.rotation.y += diff * Math.min(1.0, 8.0 * delta);
      }
    }

    const sin = Math.sin(this.walkCycle) * this.walkWeight;
    const cos = Math.cos(this.walkCycle) * this.walkWeight;

    const legSwingAngle = 0.38;
    this.leftHipPivot.rotation.x = sin * legSwingAngle;
    this.rightHipPivot.rotation.x = -sin * legSwingAngle;

    const kneeBend = 0.45;
    this.leftKneePivot.rotation.x = sin > 0 ? -sin * kneeBend : 0;
    this.rightKneePivot.rotation.x = -sin > 0 ? sin * kneeBend : 0;

    const armSwingAngle = 0.32;

    if (this.isWorkingOnTask) {
      // Reaching up working pose at cottage gutters/eaves:
      this.taskTimer = (this.taskTimer || 0) + delta * 2.8;
      const workWiggle = Math.sin(this.taskTimer);
      this.rightShoulderPivot.rotation.x = -1.35 + workWiggle * 0.08;
      this.rightShoulderPivot.rotation.y = 0.08;
      this.rightShoulderPivot.rotation.z = -0.22;
      this.rightElbowPivot.rotation.x = -0.95 + workWiggle * 0.06;

      this.leftShoulderPivot.rotation.x = -1.25 - workWiggle * 0.08;
      this.leftShoulderPivot.rotation.y = -0.08;
      this.leftShoulderPivot.rotation.z = 0.22;
      this.leftElbowPivot.rotation.x = -0.85 - workWiggle * 0.06;

      this.neckPivot.rotation.x = -0.18; // Looking up at the gutter/eaves
    } else if (this.isCarryingLadder) {
      // Physically authentic under-arm/hip ladder carry pose:
      // Right shoulder abducted slightly outward so arm clears ribcage
      this.rightShoulderPivot.rotation.x = -0.10 + sin * 0.012;
      this.rightShoulderPivot.rotation.y = 0.0;
      this.rightShoulderPivot.rotation.z = -0.24;
      // Forearm bent forward ~78 degrees to firmly grip the ladder rail:
      this.rightElbowPivot.rotation.x = -1.35;
      this.rightElbowPivot.rotation.y = 0.0;
      this.rightElbowPivot.rotation.z = 0.0;

      // Left arm natural counter-balance pose:
      this.leftShoulderPivot.rotation.x = -0.25 - sin * 0.04;
      this.leftShoulderPivot.rotation.y = 0.0;
      this.leftShoulderPivot.rotation.z = 0.16;
      this.leftElbowPivot.rotation.x = -0.75;
    } else if (this.isCarryingBox) {
      // Two-handed box carrying pose holding heavy cardboard moving box
      const boxBob = Math.sin(this.walkCycle * 2) * 0.015 * this.walkWeight;
      this.leftShoulderPivot.rotation.x = -0.58 + boxBob;
      this.leftShoulderPivot.rotation.y = 0.06;
      this.leftShoulderPivot.rotation.z = -0.10;
      this.leftElbowPivot.rotation.x = -0.78;

      this.rightShoulderPivot.rotation.x = -0.58 + boxBob;
      this.rightShoulderPivot.rotation.y = -0.06;
      this.rightShoulderPivot.rotation.z = 0.10;
      this.rightElbowPivot.rotation.x = -0.78;
    } else if (this.isCarrying) {
      this.leftShoulderPivot.rotation.x = -sin * armSwingAngle;
      this.rightShoulderPivot.rotation.x = -0.32 + sin * 0.06;
      this.rightShoulderPivot.rotation.z = -0.15;
      this.rightElbowPivot.rotation.x = -0.65;
      this.leftElbowPivot.rotation.x = -0.12 + (sin < 0 ? 0.08 : -0.06);
    } else if (this.reachAmount > 0.001) {
      this.leftShoulderPivot.rotation.x = -sin * armSwingAngle;
      this.rightShoulderPivot.rotation.x = -0.45 * this.reachAmount;
      this.rightShoulderPivot.rotation.z = -0.10 * this.reachAmount;
      this.rightElbowPivot.rotation.x = -0.45 * this.reachAmount;
      this.leftElbowPivot.rotation.x = -0.12 + (sin < 0 ? 0.08 : -0.06);
    } else if (this.variant === 'ladder_lender') {
      // Dignified older gentleman posture: cane held in right hand, gentle arm swing
      this.leftShoulderPivot.rotation.x = -sin * armSwingAngle * 0.6;
      this.leftShoulderPivot.rotation.z = 0.08;
      this.leftElbowPivot.rotation.x = -0.42;
      this.rightShoulderPivot.rotation.x = -0.16 + sin * 0.08;
      this.rightShoulderPivot.rotation.y = 0.04;
      this.rightShoulderPivot.rotation.z = -0.12;
      this.rightElbowPivot.rotation.x = -0.32;
    } else {
      this.leftShoulderPivot.rotation.x = -sin * armSwingAngle;
      this.rightShoulderPivot.rotation.x = sin * armSwingAngle;
      this.rightShoulderPivot.rotation.z = 0;
      this.rightElbowPivot.rotation.x = -0.12 + (-sin < 0 ? 0.08 : -0.06);
      this.leftElbowPivot.rotation.x = -0.12 + (sin < 0 ? 0.08 : -0.06);
    }

    if (this.walkingCane) {
      this.walkingCane.visible = !this.isCarryingLadder && !this.isCarrying;
    }

    this.torso.position.y = Math.abs(cos) * 0.018;
    this.torso.rotation.y = sin * 0.05;
    this.neckPivot.rotation.z = -sin * 0.025;
  }

  dispose() {
    Object.values(this.materials).forEach((mat) => {
      if (mat && mat.dispose) mat.dispose();
    });
  }
}
