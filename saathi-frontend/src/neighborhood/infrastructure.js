import * as THREE from 'three';

/**
 * Creates neighborhood street infrastructure, vehicles, and environmental props:
 * - Contemporary architectural street lamps with tapered poles, base plates, cantilever arms, and visible LED fixtures
 * - Believable 3D vehicles across 3 distinct archetypes (Compact Hatchback, Executive Sedan, Urban Crossover/SUV)
 * - Complete vehicle detailing: hoods, windshields, window glass, wheel arches, rubber tires, alloy rims, headlights, taillights, side mirrors, and contact shadows
 * - Small environmental props: street name signs, pedestrian crossing sign, mailboxes, teak parklet bench, commuter bicycle, wheelie bins, utility pedestal cabinet, and fire hydrant
 */

export function createInfrastructure(materials) {
  const group = new THREE.Group();
  group.name = 'InfrastructureGroup';

  // =========================================================================
  // 1. CONTEMPORARY ARCHITECTURAL STREET LAMPS
  // =========================================================================
  // Sturdy base plate, tapered pole, cantilever bracket arm, and downward LED luminaire
  const lampBaseGeo = new THREE.BoxGeometry(0.36, 0.08, 0.36);
  const lampPoleGeo = new THREE.CylinderGeometry(0.07, 0.11, 4.4, 12);
  const lampArmGeo = new THREE.CylinderGeometry(0.045, 0.055, 1.15, 8);
  const lampHeadGeo = new THREE.BoxGeometry(0.32, 0.12, 0.75);
  const lampLensGeo = new THREE.PlaneGeometry(0.24, 0.62);
  lampLensGeo.rotateX(Math.PI / 2);

  function buildStreetLamp(x, z, rotationY = 0) {
    const lamp = new THREE.Group();
    lamp.position.set(x, 0.15, z);
    lamp.rotation.y = rotationY;

    // Base flange plate on sidewalk
    const basePlate = new THREE.Mesh(lampBaseGeo, materials.streetLampBase);
    basePlate.position.y = 0.04;
    basePlate.receiveShadow = true;
    basePlate.castShadow = true;
    lamp.add(basePlate);

    // Tapered circular pole
    const pole = new THREE.Mesh(lampPoleGeo, materials.streetLampMetal);
    pole.position.y = 2.24;
    pole.castShadow = true;
    pole.receiveShadow = true;
    lamp.add(pole);

    // Cantilever mounting bracket arm extending out over curb
    const arm = new THREE.Mesh(lampArmGeo, materials.streetLampMetal);
    arm.rotation.z = Math.PI / 2.25; // Slight upward architectural pitch
    arm.position.set(0.52, 4.35, 0);
    arm.castShadow = true;
    lamp.add(arm);

    // Luminaire housing head
    const head = new THREE.Mesh(lampHeadGeo, materials.streetLampMetal);
    head.position.set(1.08, 4.42, 0);
    head.castShadow = true;
    head.receiveShadow = true;
    lamp.add(head);

    // Downward LED optical diffuser panel (visible daytime warm glow)
    const lens = new THREE.Mesh(lampLensGeo, materials.streetLampDiffuser);
    lens.position.set(1.08, 4.355, 0);
    lamp.add(lens);

    return lamp;
  }

  // Street lamps placed firmly on sidewalks (North z = -5.3m, South z = +5.3m)
  const lampPositions = [
    // North sidewalk (facing south towards street, rot = 0)
    { x: -32, z: -5.3, rot: 0 },
    { x: -12, z: -5.3, rot: 0 },
    { x: 8, z: -5.3, rot: 0 },
    { x: 28, z: -5.3, rot: 0 },

    // South sidewalk (facing north towards street, rot = Math.PI)
    { x: -36, z: 5.3, rot: Math.PI },
    { x: -16, z: 5.3, rot: Math.PI },
    { x: 4, z: 5.3, rot: Math.PI },
    { x: 24, z: 5.3, rot: Math.PI },
  ];

  lampPositions.forEach((l) => {
    group.add(buildStreetLamp(l.x, l.z, l.rot));
  });

  // =========================================================================
  // 2. REUSABLE VEHICLE COMPONENTS & GEOMETRIES
  // =========================================================================
  const tireGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.22, 16);
  tireGeo.rotateZ(Math.PI / 2);

  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.23, 12);
  rimGeo.rotateZ(Math.PI / 2);

  const brakeGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.225, 8);
  brakeGeo.rotateZ(Math.PI / 2);

  const mirrorGeo = new THREE.BoxGeometry(0.18, 0.1, 0.14);
  const headlampGeo = new THREE.BoxGeometry(0.28, 0.08, 0.08);
  const taillampGeo = new THREE.BoxGeometry(0.35, 0.09, 0.06);
  const plateGeo = new THREE.BoxGeometry(0.48, 0.16, 0.03);

  // Helper to build a complete 4-wheel assembly
  function attachWheels(car, halfTrack, frontZ, rearZ, tireR = 0.31) {
    const wheels = [
      { x: -halfTrack, z: frontZ },
      { x: halfTrack, z: frontZ },
      { x: -halfTrack, z: rearZ },
      { x: halfTrack, z: rearZ },
    ];

    wheels.forEach((w) => {
      const tire = new THREE.Mesh(tireGeo, materials.carTireRubber);
      tire.position.set(w.x, tireR, w.z);
      tire.castShadow = true;
      car.add(tire);

      const rim = new THREE.Mesh(rimGeo, materials.carWheelAlloy);
      rim.position.set(w.x, tireR, w.z);
      car.add(rim);

      const brake = new THREE.Mesh(brakeGeo, materials.carBrakeDisc);
      brake.position.set(w.x, tireR, w.z);
      car.add(brake);
    });
  }

  // =========================================================================
  // VEHICLE ARCHETYPE 1: Modern Compact Hatchback
  // =========================================================================
  function buildHatchback(paintMat) {
    const car = new THREE.Group();
    const len = 4.25;
    const wid = 1.82;
    const halfW = wid / 2;

    // Contact shadow plane
    const shadowGeo = new THREE.PlaneGeometry(wid * 1.35, len * 1.15);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadow = new THREE.Mesh(shadowGeo, materials.carContactShadow);
    shadow.position.set(0, 0.015, 0);
    car.add(shadow);

    // Lower Main Body Chassis
    const lowerGeo = new THREE.BoxGeometry(wid, 0.44, len);
    const lower = new THREE.Mesh(lowerGeo, paintMat);
    lower.position.set(0, 0.46, 0);
    lower.castShadow = true;
    lower.receiveShadow = true;
    car.add(lower);

    // Front Sloping Hood
    const hoodGeo = new THREE.BoxGeometry(wid - 0.08, 0.22, 1.25);
    const hood = new THREE.Mesh(hoodGeo, paintMat);
    hood.position.set(0, 0.72, 1.3);
    hood.rotation.x = -0.08;
    hood.castShadow = true;
    car.add(hood);

    // Passenger Cabin / Greenhouse (Sloping hatchback roofline)
    const cabinGeo = new THREE.BoxGeometry(wid - 0.2, 0.52, 2.2);
    const cabin = new THREE.Mesh(cabinGeo, paintMat);
    cabin.position.set(0, 0.98, -0.22);
    cabin.castShadow = true;
    car.add(cabin);

    // Dark Tinted Flush Window Glass
    const glassGeo = new THREE.BoxGeometry(wid - 0.16, 0.45, 2.12);
    const glass = new THREE.Mesh(glassGeo, materials.carGlass);
    glass.position.set(0, 0.96, -0.22);
    car.add(glass);

    // Aerodynamic Rear Roof Spoiler
    const spoilerGeo = new THREE.BoxGeometry(wid - 0.24, 0.05, 0.35);
    const spoiler = new THREE.Mesh(spoilerGeo, paintMat);
    spoiler.position.set(0, 1.26, -1.35);
    spoiler.castShadow = true;
    car.add(spoiler);

    // Black Lower Body Rocker Trim
    const trimGeo = new THREE.BoxGeometry(wid + 0.02, 0.12, len);
    const trim = new THREE.Mesh(trimGeo, materials.carTrimBlack);
    trim.position.set(0, 0.26, 0);
    car.add(trim);

    // Headlights
    const hLeft = new THREE.Mesh(headlampGeo, materials.carHeadlight);
    hLeft.position.set(-halfW + 0.28, 0.62, len / 2 + 0.01);
    car.add(hLeft);
    const hRight = new THREE.Mesh(headlampGeo, materials.carHeadlight);
    hRight.position.set(halfW - 0.28, 0.62, len / 2 + 0.01);
    car.add(hRight);

    // Taillights
    const tLeft = new THREE.Mesh(taillampGeo, materials.carTaillight);
    tLeft.position.set(-halfW + 0.3, 0.72, -len / 2 - 0.01);
    car.add(tLeft);
    const tRight = new THREE.Mesh(taillampGeo, materials.carTaillight);
    tRight.position.set(halfW - 0.3, 0.72, -len / 2 - 0.01);
    car.add(tRight);

    // Side Mirrors
    const mirL = new THREE.Mesh(mirrorGeo, paintMat);
    mirL.position.set(-halfW - 0.08, 0.9, 0.65);
    car.add(mirL);
    const mirR = new THREE.Mesh(mirrorGeo, paintMat);
    mirR.position.set(halfW + 0.08, 0.9, 0.65);
    car.add(mirR);

    // License Plates
    const frontPlate = new THREE.Mesh(plateGeo, materials.carPlate);
    frontPlate.position.set(0, 0.35, len / 2 + 0.02);
    car.add(frontPlate);
    const rearPlate = new THREE.Mesh(plateGeo, materials.carPlate);
    rearPlate.position.set(0, 0.42, -len / 2 - 0.02);
    car.add(rearPlate);

    // 4 Wheels
    attachWheels(car, halfW + 0.01, 1.25, -1.25);

    return car;
  }

  // =========================================================================
  // VEHICLE ARCHETYPE 2: Executive Modern Sedan
  // =========================================================================
  function buildSedan(paintMat) {
    const car = new THREE.Group();
    const len = 4.75;
    const wid = 1.84;
    const halfW = wid / 2;

    // Contact shadow
    const shadowGeo = new THREE.PlaneGeometry(wid * 1.35, len * 1.15);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadow = new THREE.Mesh(shadowGeo, materials.carContactShadow);
    shadow.position.set(0, 0.015, 0);
    car.add(shadow);

    // Lower Chassis
    const lowerGeo = new THREE.BoxGeometry(wid, 0.42, len);
    const lower = new THREE.Mesh(lowerGeo, paintMat);
    lower.position.set(0, 0.44, 0);
    lower.castShadow = true;
    lower.receiveShadow = true;
    car.add(lower);

    // Elongated Low Hood
    const hoodGeo = new THREE.BoxGeometry(wid - 0.08, 0.2, 1.55);
    const hood = new THREE.Mesh(hoodGeo, paintMat);
    hood.position.set(0, 0.68, 1.45);
    hood.rotation.x = -0.06;
    hood.castShadow = true;
    car.add(hood);

    // Arched Cabin
    const cabinGeo = new THREE.BoxGeometry(wid - 0.22, 0.5, 2.25);
    const cabin = new THREE.Mesh(cabinGeo, paintMat);
    cabin.position.set(0, 0.94, -0.15);
    cabin.castShadow = true;
    car.add(cabin);

    // Tinted Glass
    const glassGeo = new THREE.BoxGeometry(wid - 0.18, 0.44, 2.18);
    const glass = new THREE.Mesh(glassGeo, materials.carGlass);
    glass.position.set(0, 0.92, -0.15);
    car.add(glass);

    // Rear Trunk Decklid (Distinct 3-box sedan shape)
    const trunkGeo = new THREE.BoxGeometry(wid - 0.1, 0.18, 0.95);
    const trunk = new THREE.Mesh(trunkGeo, paintMat);
    trunk.position.set(0, 0.67, -1.82);
    trunk.castShadow = true;
    car.add(trunk);

    // Headlights
    const hLeft = new THREE.Mesh(headlampGeo, materials.carHeadlight);
    hLeft.position.set(-halfW + 0.28, 0.58, len / 2 + 0.01);
    car.add(hLeft);
    const hRight = new THREE.Mesh(headlampGeo, materials.carHeadlight);
    hRight.position.set(halfW - 0.28, 0.58, len / 2 + 0.01);
    car.add(hRight);

    // Taillights
    const tLeft = new THREE.Mesh(taillampGeo, materials.carTaillight);
    tLeft.position.set(-halfW + 0.3, 0.68, -len / 2 - 0.01);
    car.add(tLeft);
    const tRight = new THREE.Mesh(taillampGeo, materials.carTaillight);
    tRight.position.set(halfW - 0.3, 0.68, -len / 2 - 0.01);
    car.add(tRight);

    // Side Mirrors
    const mirL = new THREE.Mesh(mirrorGeo, paintMat);
    mirL.position.set(-halfW - 0.08, 0.86, 0.75);
    car.add(mirL);
    const mirR = new THREE.Mesh(mirrorGeo, paintMat);
    mirR.position.set(halfW + 0.08, 0.86, 0.75);
    car.add(mirR);

    // License Plates
    const frontPlate = new THREE.Mesh(plateGeo, materials.carPlate);
    frontPlate.position.set(0, 0.32, len / 2 + 0.02);
    car.add(frontPlate);
    const rearPlate = new THREE.Mesh(plateGeo, materials.carPlate);
    rearPlate.position.set(0, 0.42, -len / 2 - 0.02);
    car.add(rearPlate);

    // 4 Wheels
    attachWheels(car, halfW + 0.01, 1.45, -1.45);

    return car;
  }

  // =========================================================================
  // VEHICLE ARCHETYPE 3: Urban Compact Crossover / Small SUV
  // =========================================================================
  function buildCrossover(paintMat) {
    const car = new THREE.Group();
    const len = 4.5;
    const wid = 1.88;
    const halfW = wid / 2;

    // Contact shadow
    const shadowGeo = new THREE.PlaneGeometry(wid * 1.35, len * 1.15);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadow = new THREE.Mesh(shadowGeo, materials.carContactShadow);
    shadow.position.set(0, 0.015, 0);
    car.add(shadow);

    // Rugged Matte Black Underbody Cladding & Wheel Arches
    const underGeo = new THREE.BoxGeometry(wid, 0.22, len);
    const under = new THREE.Mesh(underGeo, materials.carTrimBlack);
    under.position.set(0, 0.32, 0);
    car.add(under);

    // Main Body
    const lowerGeo = new THREE.BoxGeometry(wid - 0.04, 0.46, len - 0.08);
    const lower = new THREE.Mesh(lowerGeo, paintMat);
    lower.position.set(0, 0.56, 0);
    lower.castShadow = true;
    lower.receiveShadow = true;
    car.add(lower);

    // Upright SUV Hood
    const hoodGeo = new THREE.BoxGeometry(wid - 0.1, 0.26, 1.3);
    const hood = new THREE.Mesh(hoodGeo, paintMat);
    hood.position.set(0, 0.84, 1.4);
    hood.rotation.x = -0.05;
    hood.castShadow = true;
    car.add(hood);

    // Tall SUV Cabin
    const cabinGeo = new THREE.BoxGeometry(wid - 0.2, 0.6, 2.5);
    const cabin = new THREE.Mesh(cabinGeo, paintMat);
    cabin.position.set(0, 1.14, -0.15);
    cabin.castShadow = true;
    car.add(cabin);

    // Tinted Glass
    const glassGeo = new THREE.BoxGeometry(wid - 0.16, 0.52, 2.42);
    const glass = new THREE.Mesh(glassGeo, materials.carGlass);
    glass.position.set(0, 1.11, -0.15);
    car.add(glass);

    // Roof Rails (Architectural silver rails)
    const railGeo = new THREE.BoxGeometry(0.04, 0.06, 1.9);
    const railL = new THREE.Mesh(railGeo, materials.carTrimBlack);
    railL.position.set(-halfW + 0.22, 1.48, -0.15);
    car.add(railL);
    const railR = new THREE.Mesh(railGeo, materials.carTrimBlack);
    railR.position.set(halfW - 0.22, 1.48, -0.15);
    car.add(railR);

    // Headlights
    const hLeft = new THREE.Mesh(headlampGeo, materials.carHeadlight);
    hLeft.position.set(-halfW + 0.28, 0.72, len / 2 + 0.01);
    car.add(hLeft);
    const hRight = new THREE.Mesh(headlampGeo, materials.carHeadlight);
    hRight.position.set(halfW - 0.28, 0.72, len / 2 + 0.01);
    car.add(hRight);

    // Taillights
    const tLeft = new THREE.Mesh(taillampGeo, materials.carTaillight);
    tLeft.position.set(-halfW + 0.3, 0.85, -len / 2 - 0.01);
    car.add(tLeft);
    const tRight = new THREE.Mesh(taillampGeo, materials.carTaillight);
    tRight.position.set(halfW - 0.3, 0.85, -len / 2 - 0.01);
    car.add(tRight);

    // Side Mirrors
    const mirL = new THREE.Mesh(mirrorGeo, paintMat);
    mirL.position.set(-halfW - 0.08, 1.02, 0.75);
    car.add(mirL);
    const mirR = new THREE.Mesh(mirrorGeo, paintMat);
    mirR.position.set(halfW + 0.08, 1.02, 0.75);
    car.add(mirR);

    // License Plates
    const frontPlate = new THREE.Mesh(plateGeo, materials.carPlate);
    frontPlate.position.set(0, 0.36, len / 2 + 0.02);
    car.add(frontPlate);
    const rearPlate = new THREE.Mesh(plateGeo, materials.carPlate);
    rearPlate.position.set(0, 0.44, -len / 2 - 0.02);
    car.add(rearPlate);

    // 4 Wheels with slightly higher ride height
    attachWheels(car, halfW + 0.01, 1.35, -1.35, 0.33);

    return car;
  }

  // =========================================================================
  // CAR PLACEMENTS
  // =========================================================================
  // Car 1: Modern Hatchback (Metallic Slate Blue) parked in Lot 2 driveway
  const car1 = buildHatchback(materials.carPaintBlue);
  car1.position.set(-10.5, 0.02, -12.5);
  car1.rotation.y = Math.PI; // Backed in facing the street
  group.add(car1);

  // Car 2: Executive Sedan (Warm Silver) parked in curbside parallel stall
  const car2 = buildSedan(materials.carPaintWarmSilver);
  car2.position.set(-4.0, 0.02, 2.5);
  car2.rotation.y = Math.PI / 2; // Parked parallel to curb
  group.add(car2);

  // Car 3: Urban Crossover / SUV (Nordic Forest Green) parked in Lot 5 driveway
  const car3 = buildCrossover(materials.carPaintForestGreen);
  car3.position.set(-10.5, 0.02, 12.8);
  car3.rotation.y = 0; // Pulled in facing south
  group.add(car3);

  // Car 4: Pearl White Executive Sedan parked in Lot 1 driveway
  const car4 = buildSedan(materials.carPaintPearlWhite);
  car4.position.set(-29.5, 0.02, -13.0);
  car4.rotation.y = Math.PI;
  group.add(car4);

  // =========================================================================
  // 3. HORIZONTAL CEDAR PROPERTY FENCES
  // =========================================================================
  function buildFenceSection(x, z, length, rotationY = 0) {
    const fence = new THREE.Group();
    fence.position.set(x, 0.16, z);
    fence.rotation.y = rotationY;

    const postCount = Math.floor(length / 2.2) + 1;
    const postGeo = new THREE.BoxGeometry(0.12, 1.4, 0.12);

    for (let i = 0; i < postCount; i++) {
      const px = -length / 2 + (i * length) / (postCount - 1);
      const post = new THREE.Mesh(postGeo, materials.cedarWood);
      post.position.set(px, 0.7, 0);
      post.castShadow = true;
      fence.add(post);
    }

    const slatGeo = new THREE.BoxGeometry(length, 0.16, 0.04);
    const slatHeights = [0.35, 0.65, 0.95, 1.25];
    slatHeights.forEach((h) => {
      const slat = new THREE.Mesh(slatGeo, materials.cedarWood);
      slat.position.set(0, h, 0);
      slat.castShadow = true;
      fence.add(slat);
    });

    return fence;
  }

  // Fences dividing rear/side boundaries of the 6 lots
  group.add(buildFenceSection(-14.5, -17.5, 17.5, Math.PI / 2));
  group.add(buildFenceSection(4.5, -17.5, 17.5, Math.PI / 2));
  group.add(buildFenceSection(-5.0, -26.0, 16.0, 0));
  group.add(buildFenceSection(14.0, -26.0, 16.0, 0));

  group.add(buildFenceSection(-14.5, 17.5, 17.5, Math.PI / 2));
  group.add(buildFenceSection(4.5, 17.5, 17.5, Math.PI / 2));
  group.add(buildFenceSection(-5.0, 26.0, 16.0, 0));

  // =========================================================================
  // 4. ARCHITECTURAL MAILBOXES (One per lot)
  // =========================================================================
  const postGeo = new THREE.BoxGeometry(0.12, 1.1, 0.12);
  const boxBodyGeo = new THREE.BoxGeometry(0.28, 0.28, 0.52);
  const flagGeo = new THREE.BoxGeometry(0.02, 0.12, 0.08);

  function buildMailbox(x, z, rotY = 0) {
    const mb = new THREE.Group();
    mb.position.set(x, 0.15, z);
    mb.rotation.y = rotY;

    const post = new THREE.Mesh(postGeo, materials.mailboxPost);
    post.position.y = 0.55;
    post.castShadow = true;
    mb.add(post);

    const box = new THREE.Mesh(boxBodyGeo, materials.mailboxBox);
    box.position.set(0, 1.02, 0.06);
    box.castShadow = true;
    mb.add(box);

    const flag = new THREE.Mesh(flagGeo, materials.mailboxFlag);
    flag.position.set(0.15, 1.06, 0.12);
    mb.add(flag);

    return mb;
  }

  // Mailboxes positioned beside driveway curb cuts on North and South verges
  group.add(buildMailbox(-27.2, -4.55, 0)); // Lot 1
  group.add(buildMailbox(-8.2, -4.55, 0));  // Lot 2
  group.add(buildMailbox(10.8, -4.55, 0));  // Lot 3

  group.add(buildMailbox(-27.2, 4.55, Math.PI)); // Lot 4
  group.add(buildMailbox(-8.2, 4.55, Math.PI));  // Lot 5
  group.add(buildMailbox(10.8, 4.55, Math.PI));  // Lot 6

  // =========================================================================
  // 5. POCKET PARKLET TEAK BENCH & COMMUTER BIKE STATION
  // =========================================================================
  function buildParkletBench(x, z, rotY = 0) {
    const bench = new THREE.Group();
    bench.position.set(x, 0.15, z);
    bench.rotation.y = rotY;

    // Metal legs
    const legGeo = new THREE.BoxGeometry(0.06, 0.5, 0.55);
    const legL = new THREE.Mesh(legGeo, materials.darkBenchMetal);
    legL.position.set(-0.85, 0.25, 0);
    legL.castShadow = true;
    bench.add(legL);

    const legR = new THREE.Mesh(legGeo, materials.darkBenchMetal);
    legR.position.set(0.85, 0.25, 0);
    legR.castShadow = true;
    bench.add(legR);

    // Teak seat slats
    const seatSlatGeo = new THREE.BoxGeometry(1.8, 0.04, 0.12);
    for (let i = 0; i < 3; i++) {
      const slat = new THREE.Mesh(seatSlatGeo, materials.cedarWood);
      slat.position.set(0, 0.48, -0.16 + i * 0.15);
      slat.castShadow = true;
      bench.add(slat);
    }

    // Backrest slats
    const backSlatGeo = new THREE.BoxGeometry(1.8, 0.14, 0.04);
    for (let i = 0; i < 2; i++) {
      const bSlat = new THREE.Mesh(backSlatGeo, materials.cedarWood);
      bSlat.position.set(0, 0.65 + i * 0.17, -0.26);
      bSlat.castShadow = true;
      bench.add(bSlat);
    }

    return bench;
  }

  // Teak bench in the pocket parklet (between Lot 1 & Lot 2)
  group.add(buildParkletBench(-14.5, -7.2, 0));

  // Commuter bicycle and hoop bike rack
  function buildBicycleStation(x, z, rotY = 0) {
    const station = new THREE.Group();
    station.position.set(x, 0.15, z);
    station.rotation.y = rotY;

    // Stainless steel inverted U-hoop bike rack
    const hoopGeo = new THREE.TorusGeometry(0.42, 0.035, 8, 20, Math.PI);
    const hoop = new THREE.Mesh(hoopGeo, materials.streetLampMetal);
    hoop.position.set(0, 0.55, 0);
    hoop.castShadow = true;
    station.add(hoop);

    const legGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8);
    const post1 = new THREE.Mesh(legGeo, materials.streetLampMetal);
    post1.position.set(-0.42, 0.275, 0);
    station.add(post1);
    const post2 = new THREE.Mesh(legGeo, materials.streetLampMetal);
    post2.position.set(0.42, 0.275, 0);
    station.add(post2);

    // Bicycle parked against the rack
    const bike = new THREE.Group();
    bike.position.set(0.12, 0, 0);
    bike.rotation.y = 0.08;

    // Frame tubes
    const tubeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.85, 6);
    const topTube = new THREE.Mesh(tubeGeo, materials.bicycleFrame);
    topTube.rotation.z = Math.PI / 2;
    topTube.position.set(0, 0.75, 0);
    bike.add(topTube);

    const downTube = new THREE.Mesh(tubeGeo, materials.bicycleFrame);
    downTube.rotation.z = Math.PI / 3;
    downTube.position.set(-0.15, 0.55, 0);
    bike.add(downTube);

    // Two thin wheels with rims
    const bikeWheelGeo = new THREE.TorusGeometry(0.32, 0.022, 6, 24);
    const fWheel = new THREE.Mesh(bikeWheelGeo, materials.carTireRubber);
    fWheel.position.set(0.55, 0.32, 0);
    bike.add(fWheel);
    const rWheel = new THREE.Mesh(bikeWheelGeo, materials.carTireRubber);
    rWheel.position.set(-0.55, 0.32, 0);
    bike.add(rWheel);

    // Handlebars & Saddle
    const barGeo = new THREE.BoxGeometry(0.04, 0.03, 0.44);
    const bar = new THREE.Mesh(barGeo, materials.darkBenchMetal);
    bar.position.set(0.45, 0.88, 0);
    bike.add(bar);

    const seatGeo = new THREE.BoxGeometry(0.22, 0.04, 0.12);
    const seat = new THREE.Mesh(seatGeo, materials.darkBenchMetal);
    seat.position.set(-0.25, 0.82, 0);
    bike.add(seat);

    station.add(bike);
    return station;
  }

  group.add(buildBicycleStation(-12.8, -7.2, 0));

  // =========================================================================
  // 6. STREET SIGNAGE (Intersection blade & Pedestrian crossing)
  // =========================================================================
  function buildIntersectionStreetSign(x, z) {
    const sign = new THREE.Group();
    sign.position.set(x, 0.15, z);

    // Signpost
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8), materials.streetSignPole);
    post.position.y = 1.6;
    post.castShadow = true;
    sign.add(post);

    // Street blade 1: MEADOW WAY (along main avenue)
    const blade1Geo = new THREE.BoxGeometry(1.1, 0.18, 0.03);
    const blade1 = new THREE.Mesh(blade1Geo, materials.streetSignBlade);
    blade1.position.set(0.4, 3.0, 0);
    sign.add(blade1);

    // Street blade 2: SAATHI BLVD (perpendicular along side street)
    const blade2Geo = new THREE.BoxGeometry(0.03, 0.18, 1.1);
    const blade2 = new THREE.Mesh(blade2Geo, materials.streetSignBlade);
    blade2.position.set(0, 2.78, 0.4);
    sign.add(blade2);

    // Small octagonal stop sign facing side street
    const stopSignGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.03, 8);
    stopSignGeo.rotateX(Math.PI / 2);
    const stopSign = new THREE.Mesh(stopSignGeo, materials.fireHydrantRed);
    stopSign.position.set(0, 2.2, 0.05);
    sign.add(stopSign);

    return sign;
  }

  group.add(buildIntersectionStreetSign(24.2, 5.4));

  // Pedestrian Crosswalk Warning Sign (near crosswalk at x = -17)
  function buildCrosswalkSign(x, z) {
    const sign = new THREE.Group();
    sign.position.set(x, 0.15, z);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 8), materials.streetSignPole);
    post.position.y = 1.4;
    post.castShadow = true;
    sign.add(post);

    // Yellow diamond pedestrian crossing sign
    const diamondGeo = new THREE.BoxGeometry(0.48, 0.48, 0.02);
    const diamond = new THREE.Mesh(diamondGeo, materials.streetSignWarning);
    diamond.rotation.z = Math.PI / 4; // Rotated diamond
    diamond.position.set(0, 2.4, 0.02);
    sign.add(diamond);

    return sign;
  }

  group.add(buildCrosswalkSign(-17.2, 5.3));

  // =========================================================================
  // 7. UTILITY SERVICE CABINET & MANHOLES
  // =========================================================================
  // Low green utility transformer / telecom cabinet in grass verge
  function buildUtilityCabinet(x, z) {
    const cab = new THREE.Group();
    cab.position.set(x, 0.14, z);

    const bodyGeo = new THREE.BoxGeometry(0.65, 0.85, 0.45);
    const body = new THREE.Mesh(bodyGeo, materials.utilityCabinetGreen);
    body.position.y = 0.425;
    body.castShadow = true;
    body.receiveShadow = true;
    cab.add(body);

    const lidGeo = new THREE.BoxGeometry(0.7, 0.08, 0.5);
    const lid = new THREE.Mesh(lidGeo, materials.utilityCabinetGreen);
    lid.position.y = 0.88;
    lid.castShadow = true;
    cab.add(lid);

    return cab;
  }

  group.add(buildUtilityCabinet(7.5, -4.55));

  // Round cast iron utility manhole covers
  const manholeGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.02, 20);
  const mh1 = new THREE.Mesh(manholeGeo, materials.castIronGrate);
  mh1.position.set(-20.5, 0.155, -6.0);
  mh1.receiveShadow = true;
  group.add(mh1);

  const mh2 = new THREE.Mesh(manholeGeo, materials.castIronGrate);
  mh2.position.set(16.5, 0.155, 6.0);
  mh2.receiveShadow = true;
  group.add(mh2);

  // =========================================================================
  // 8. CURBSIDE WHEELIE BINS & FIRE HYDRANT
  // =========================================================================
  function buildWheelieBin(x, z, binMaterial, rotY = 0) {
    const bin = new THREE.Group();
    bin.position.set(x, 0.15, z);
    bin.rotation.y = rotY;

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.48, 0.88, 0.48);
    const body = new THREE.Mesh(bodyGeo, binMaterial);
    body.position.y = 0.44;
    body.castShadow = true;
    bin.add(body);

    // Lid
    const lidGeo = new THREE.BoxGeometry(0.52, 0.08, 0.52);
    const lid = new THREE.Mesh(lidGeo, binMaterial);
    lid.position.y = 0.92;
    bin.add(lid);

    // Wheels
    const wGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12);
    wGeo.rotateZ(Math.PI / 2);
    const wheelL = new THREE.Mesh(wGeo, materials.carTireRubber);
    wheelL.position.set(-0.24, 0.08, -0.16);
    bin.add(wheelL);

    const wheelR = new THREE.Mesh(wGeo, materials.carTireRubber);
    wheelR.position.set(0.24, 0.08, -0.16);
    bin.add(wheelR);

    return bin;
  }

  // Wheelie bins by driveways
  group.add(buildWheelieBin(-27.2, -5.2, materials.trashBinCharcoal, 0.1));
  group.add(buildWheelieBin(-27.8, -5.2, materials.recycleBinBlue, -0.05));
  group.add(buildWheelieBin(-8.2, -5.2, materials.trashBinCharcoal, 0.05));
  group.add(buildWheelieBin(-8.8, -5.2, materials.compostBinGreen, 0.15));

  // Red Fire Hydrant near crosswalk
  function buildFireHydrant(x, z) {
    const hydrant = new THREE.Group();
    hydrant.position.set(x, 0.15, z);

    const barrelGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.72, 10);
    const barrel = new THREE.Mesh(barrelGeo, materials.fireHydrantRed);
    barrel.position.y = 0.36;
    barrel.castShadow = true;
    hydrant.add(barrel);

    const domeGeo = new THREE.SphereGeometry(0.13, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, materials.fireHydrantRed);
    dome.position.y = 0.72;
    hydrant.add(dome);

    const nutGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6);
    const nut = new THREE.Mesh(nutGeo, materials.brassNut);
    nut.position.y = 0.82;
    hydrant.add(nut);

    const capGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8);
    capGeo.rotateZ(Math.PI / 2);
    const cap1 = new THREE.Mesh(capGeo, materials.brassNut);
    cap1.position.set(0.12, 0.48, 0);
    hydrant.add(cap1);

    const cap2 = new THREE.Mesh(capGeo, materials.brassNut);
    cap2.position.set(-0.12, 0.48, 0);
    hydrant.add(cap2);

    return hydrant;
  }

  group.add(buildFireHydrant(-16.5, 4.55));

  return group;
}
