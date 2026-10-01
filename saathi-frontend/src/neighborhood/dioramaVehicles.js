import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * dioramaVehicles.js
 * Reference Reconstruction Pass:
 * - White compact car on central-left road (-X axis) with cyan roof accent & chrome trim
 * - White/yellow delivery van on center-right road (+X axis) with rounded roof cap
 * - Pastel pink food truck parked in lower-left road area (+Z axis) with service counter & menu
 * - Mint scooter on right-middle road with a small, understated, proportional 3D rider
 * - Clean grounded stance on roadbed (Y = 0.01m)
 */

export function createDioramaVehicles(materials) {
  const group = new THREE.Group();
  group.name = 'DioramaVehicles';

  const ROAD_ASPHALT_Y = 0.01;

  // =========================================================================
  // HELPER: WHEEL ASSEMBLY
  // =========================================================================
  function createWheel(radius = 0.34, width = 0.18) {
    const wGroup = new THREE.Group();

    // Rubber Tire
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
    const tire = new THREE.Mesh(tireGeo, materials.vehicleTire);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wGroup.add(tire);

    // Silver Rim
    const rimGeo = new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width + 0.02, 12);
    const rim = new THREE.Mesh(rimGeo, materials.vehicleRim);
    rim.rotation.z = Math.PI / 2;
    wGroup.add(rim);

    // Center Hub Cap
    const hubGeo = new THREE.CylinderGeometry(radius * 0.25, radius * 0.25, width + 0.04, 8);
    const hub = new THREE.Mesh(hubGeo, materials.metalDark);
    hub.rotation.z = Math.PI / 2;
    wGroup.add(hub);

    return wGroup;
  }

  // =========================================================================
  // 1. WHITE COMPACT CAR (Central-Left Road / Upper-Left Branch)
  // =========================================================================
  {
    const car = new THREE.Group();
    car.name = 'CompactCar_White';

    const wheelR = 0.34;
    const wheelW = 0.18;
    const bodyW = 1.55;
    const bodyL = 3.3;
    const bodyH = 0.65;
    const cabinH = 0.75;
    const cabinL = 1.85;

    // Aligned westbound along the central-left road (-X axis)
    car.position.set(-8.5, ROAD_ASPHALT_Y, -1.65);
    car.rotation.y = -Math.PI / 2; // facing -X

    // 1. Rounded Lower Body (Pure White)
    const lowerGeo = new RoundedBoxGeometry(bodyW, bodyH, bodyL, 3, 0.16);
    const lowerBody = new THREE.Mesh(lowerGeo, materials.vehicleWhite);
    lowerBody.position.y = wheelR + bodyH / 2 - 0.05;
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    car.add(lowerBody);

    // Blue & Yellow Ambulance Side Stripes (matching media_1790591038989.png)
    const blueStripe = new THREE.Mesh(
      new THREE.BoxGeometry(bodyW + 0.02, 0.08, bodyL * 0.95),
      materials.vehicleAmbulanceBlue
    );
    blueStripe.position.y = wheelR + bodyH * 0.58;
    car.add(blueStripe);

    const yellowStripe = new THREE.Mesh(
      new THREE.BoxGeometry(bodyW + 0.02, 0.06, bodyL * 0.95),
      materials.vehicleAmbulanceYellow
    );
    yellowStripe.position.y = wheelR + bodyH * 0.44;
    car.add(yellowStripe);

    // 2. Rounded Greenhouse Cabin (White with soft cyan roof accent)
    const cabinW = bodyW * 0.88;
    const cabinGeo = new RoundedBoxGeometry(cabinW, cabinH, cabinL, 3, 0.14);
    const cabin = new THREE.Mesh(cabinGeo, materials.vehicleWhite);
    cabin.position.set(0, wheelR + bodyH + cabinH / 2 - 0.08, -0.2);
    cabin.castShadow = true;
    car.add(cabin);

    // Roof cap panel (Cyan accent)
    const roofGeo = new RoundedBoxGeometry(cabinW * 0.94, 0.06, cabinL * 0.92, 2, 0.03);
    const roof = new THREE.Mesh(roofGeo, materials.vehicleCyan);
    roof.position.set(0, wheelR + bodyH + cabinH - 0.05, -0.2);
    car.add(roof);

    // Miniature Roof Light Bar
    const lightBar = new THREE.Mesh(
      new RoundedBoxGeometry(cabinW * 0.45, 0.12, 0.22, 2, 0.03),
      materials.vehicleAmbulanceBlue
    );
    lightBar.position.set(0, wheelR + bodyH + cabinH + 0.04, -0.2);
    lightBar.castShadow = true;
    car.add(lightBar);

    // 3. Front Windshield
    const frontWindshieldGeo = new THREE.PlaneGeometry(cabinW * 0.9, cabinH * 0.95);
    const frontWindshield = new THREE.Mesh(frontWindshieldGeo, materials.vehicleWindow);
    frontWindshield.rotation.x = -Math.PI / 6;
    frontWindshield.position.set(0, wheelR + bodyH + cabinH * 0.45, -0.2 + cabinL / 2 + 0.02);
    car.add(frontWindshield);

    // 4. Rear Windshield
    const rearWindshieldGeo = new THREE.PlaneGeometry(cabinW * 0.88, cabinH * 0.9);
    const rearWindshield = new THREE.Mesh(rearWindshieldGeo, materials.vehicleWindow);
    rearWindshield.rotation.x = Math.PI - Math.PI / 5;
    rearWindshield.position.set(0, wheelR + bodyH + cabinH * 0.45, -0.2 - cabinL / 2 - 0.02);
    car.add(rearWindshield);

    // 5. Side Windows & Mirrors
    [-1, 1].forEach((dir) => {
      const sideWinGeo = new THREE.BoxGeometry(0.04, cabinH * 0.72, cabinL * 0.82);
      const sideWin = new THREE.Mesh(sideWinGeo, materials.vehicleWindow);
      sideWin.position.set(dir * (cabinW / 2 + 0.01), wheelR + bodyH + cabinH * 0.45, -0.2);
      car.add(sideWin);

      const mirror = new THREE.Mesh(
        new RoundedBoxGeometry(0.18, 0.1, 0.12, 2, 0.04),
        materials.metalDark
      );
      mirror.position.set(dir * (bodyW / 2 + 0.09), wheelR + bodyH * 0.85, 0.55);
      car.add(mirror);
    });

    // 6. Bumpers
    const fBump = new THREE.Mesh(new RoundedBoxGeometry(bodyW + 0.04, 0.18, 0.14, 2, 0.04), materials.metalDark);
    fBump.position.set(0, wheelR + 0.05, bodyL / 2 + 0.05);
    fBump.castShadow = true;
    car.add(fBump);

    const rBump = new THREE.Mesh(new RoundedBoxGeometry(bodyW + 0.04, 0.18, 0.14, 2, 0.04), materials.metalDark);
    rBump.position.set(0, wheelR + 0.05, -bodyL / 2 - 0.05);
    rBump.castShadow = true;
    car.add(rBump);

    // 7. Headlights & Taillights
    [-0.52, 0.52].forEach((x) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.05), materials.vehicleHeadlight);
      hl.position.set(x, wheelR + bodyH * 0.65, bodyL / 2 + 0.02);
      car.add(hl);
    });

    [-0.52, 0.52].forEach((x) => {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.05), materials.vehicleTaillight);
      tl.position.set(x, wheelR + bodyH * 0.7, -bodyL / 2 - 0.02);
      car.add(tl);
    });

    // 8. 4 Wheels Grounded
    [
      { x: -bodyW / 2 - 0.02, z: -0.95 },
      { x: bodyW / 2 + 0.02, z: -0.95 },
      { x: -bodyW / 2 - 0.02, z: 0.95 },
      { x: bodyW / 2 + 0.02, z: 0.95 },
    ].forEach(({ x, z }) => {
      const wheel = createWheel(wheelR, wheelW);
      wheel.position.set(x, wheelR, z);
      car.add(wheel);
    });

    group.add(car);
  }

  // =========================================================================
  // 2. WHITE / YELLOW DELIVERY VAN (Center-Right Road)
  // =========================================================================
  {
    const van = new THREE.Group();
    van.name = 'DeliveryVan_YellowStripe';

    const wheelR = 0.38;
    const wheelW = 0.22;
    const vanW = 1.75;
    const vanL = 3.9;
    const vanH = 1.85;

    // Placed on center-right road (+X branch) westbound towards intersection
    van.position.set(8.5, ROAD_ASPHALT_Y, 1.65);
    van.rotation.y = -Math.PI / 2; // facing -X (westbound towards intersection matching media_1790591038989.png)

    const lowerH = 0.6;
    const lower = new THREE.Mesh(
      new RoundedBoxGeometry(vanW, lowerH, vanL, 2, 0.12),
      materials.vehicleWhite
    );
    lower.position.y = wheelR + lowerH / 2 - 0.04;
    lower.castShadow = true;
    lower.receiveShadow = true;
    van.add(lower);

    // Warm yellow/lime stripe around middle belt
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(vanW + 0.02, 0.14, vanL + 0.02),
      materials.vehicleYellow
    );
    stripe.position.y = wheelR + lowerH + 0.05;
    van.add(stripe);

    const upperH = vanH - lowerH - 0.14;
    const upper = new THREE.Mesh(
      new RoundedBoxGeometry(vanW, upperH, vanL, 2, 0.12),
      materials.vehicleWhite
    );
    upper.position.y = wheelR + lowerH + 0.14 + upperH / 2;
    upper.castShadow = true;
    van.add(upper);

    // Rounded Roof Cap
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(vanW / 2, vanW / 2, vanL, 16),
      materials.vehicleWhite
    );
    roof.rotation.x = Math.PI / 2;
    roof.position.y = wheelR + vanH;
    van.add(roof);

    // Windshield
    const windshieldGeo = new THREE.PlaneGeometry(vanW * 0.86, 0.72);
    const windshield = new THREE.Mesh(windshieldGeo, materials.vehicleWindow);
    windshield.rotation.x = -Math.PI / 7;
    windshield.position.set(0, wheelR + lowerH + 0.55, vanL / 2 + 0.02);
    van.add(windshield);

    // Side Windows
    [-1, 1].forEach((dir) => {
      const sideWin = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.58, 0.95),
        materials.vehicleWindow
      );
      sideWin.position.set(dir * (vanW / 2 + 0.01), wheelR + lowerH + 0.52, 0.95);
      van.add(sideWin);

      const mirror = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.12, 0.14, 2, 0.04), materials.metalDark);
      mirror.position.set(dir * (vanW / 2 + 0.11), wheelR + lowerH + 0.5, 1.35);
      van.add(mirror);
    });

    // Bumpers
    const fBump = new THREE.Mesh(new RoundedBoxGeometry(vanW + 0.06, 0.22, 0.16, 2, 0.04), materials.metalDark);
    fBump.position.set(0, wheelR + 0.06, vanL / 2 + 0.06);
    fBump.castShadow = true;
    van.add(fBump);

    const rBump = new THREE.Mesh(new RoundedBoxGeometry(vanW + 0.06, 0.22, 0.16, 2, 0.04), materials.metalDark);
    rBump.position.set(0, wheelR + 0.06, -vanL / 2 - 0.06);
    rBump.castShadow = true;
    van.add(rBump);

    // Headlights & Taillights
    [-0.58, 0.58].forEach((x) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.05), materials.vehicleHeadlight);
      hl.position.set(x, wheelR + lowerH * 0.8, vanL / 2 + 0.02);
      van.add(hl);
    });

    [-0.58, 0.58].forEach((x) => {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.05), materials.vehicleTaillight);
      tl.position.set(x, wheelR + lowerH * 0.8, -vanL / 2 - 0.02);
      van.add(tl);
    });

    // 4 Wheels
    [
      { x: -vanW / 2 - 0.03, z: -1.2 },
      { x: vanW / 2 + 0.03, z: -1.2 },
      { x: -vanW / 2 - 0.03, z: 1.2 },
      { x: vanW / 2 + 0.03, z: 1.2 },
    ].forEach(({ x, z }) => {
      const wheel = createWheel(wheelR, wheelW);
      wheel.position.set(x, wheelR, z);
      van.add(wheel);
    });

    group.add(van);
  }

  // =========================================================================
  // 3. PASTEL PINK DELIVERY VEHICLE (Lower-Left Road Area / +Z Axis)
  // =========================================================================
  {
    const truck = new THREE.Group();
    truck.name = 'PinkDeliveryTruck_Parked';

    const wheelR = 0.32;
    const wheelW = 0.18;
    const tW = 1.6;
    const tL = 3.3;
    const tH = 1.95;

    // Positioned on the south-west lane of the road (+Z branch)
    truck.position.set(-1.8, ROAD_ASPHALT_Y, 8.5);
    truck.rotation.y = 0; // facing +Z along road lane

    // Rounded Pink Body
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(tW, tH * 0.78, tL, 3, 0.16),
      materials.vehiclePink
    );
    body.position.y = wheelR + (tH * 0.78) / 2 - 0.03;
    body.castShadow = true;
    body.receiveShadow = true;
    truck.add(body);

    // Rounded White Roof
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(tW / 2 + 0.04, tW / 2 + 0.04, tL + 0.06, 16),
      materials.wallWhite
    );
    roof.rotation.x = Math.PI / 2;
    roof.position.y = wheelR + tH * 0.78;
    roof.castShadow = true;
    truck.add(roof);

    // Service Hatch Window facing sidewalk (+X)
    const hatchFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.72, 1.55),
      materials.windowFrame
    );
    hatchFrame.position.set(tW / 2 + 0.02, wheelR + 0.95, -0.15);
    truck.add(hatchFrame);

    const hatchGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.45, 0.62),
      materials.vehicleWindow
    );
    hatchGlass.rotation.y = Math.PI / 2;
    hatchGlass.position.set(tW / 2 + 0.04, wheelR + 0.95, -0.15);
    truck.add(hatchGlass);

    // Serving Awning Flap above Hatch
    const hatchAwning = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.04, 1.55),
      materials.awningWhite
    );
    hatchAwning.rotation.z = Math.PI / 8;
    hatchAwning.position.set(tW / 2 + 0.2, wheelR + 1.35, -0.15);
    hatchAwning.castShadow = true;
    truck.add(hatchAwning);

    // Counter Shelf
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 1.55), materials.woodNatural);
    shelf.position.set(tW / 2 + 0.12, wheelR + 0.58, -0.15);
    shelf.castShadow = true;
    truck.add(shelf);

    // Tiny Chalkboard Menu on side
    const menuBoard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.35), materials.metalDark);
    menuBoard.position.set(tW / 2 + 0.02, wheelR + 0.85, 0.95);
    truck.add(menuBoard);

    // Windshield
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(tW * 0.85, 0.65), materials.vehicleWindow);
    ws.rotation.x = -Math.PI / 8;
    ws.position.set(0, wheelR + 1.05, tL / 2 + 0.02);
    truck.add(ws);

    // 4 Wheels Grounded
    [
      { x: -tW / 2 - 0.03, z: -1.0 },
      { x: tW / 2 + 0.03, z: -1.0 },
      { x: -tW / 2 - 0.03, z: 1.0 },
      { x: tW / 2 + 0.03, z: 1.0 },
    ].forEach(({ x, z }) => {
      const wheel = createWheel(wheelR, wheelW);
      wheel.position.set(x, wheelR, z);
      truck.add(wheel);
    });

    group.add(truck);
  }

  // =========================================================================
  // 4. MINT SCOOTER WITH SMALL UNDERSTATED 3D RIDER (Right-Middle Road)
  // =========================================================================
  {
    const scooterGroup = new THREE.Group();
    scooterGroup.name = 'Scooter_WithRider';

    // Positioned on the right-middle road (+X lane near center intersection)
    scooterGroup.position.set(3.4, ROAD_ASPHALT_Y, -1.65);
    scooterGroup.rotation.y = Math.PI / 2; // traveling along road eastward (+X)

    const wheelR = 0.22;

    // 1. Rounded Mint Body Frame
    const bodyGeo = new RoundedBoxGeometry(0.38, 0.34, 1.25, 2, 0.06);
    const body = new THREE.Mesh(bodyGeo, materials.vehicleMint);
    body.position.y = wheelR + 0.12;
    body.castShadow = true;
    scooterGroup.add(body);

    // 2. Cushioned Seat
    const seatGeo = new RoundedBoxGeometry(0.3, 0.12, 0.55, 2, 0.04);
    const seat = new THREE.Mesh(seatGeo, materials.metalDark);
    seat.position.set(0, wheelR + 0.32, -0.15);
    seat.castShadow = true;
    scooterGroup.add(seat);

    // 3. Rear Delivery Box on Luggage Rack
    const boxGeo = new RoundedBoxGeometry(0.36, 0.32, 0.36, 2, 0.04);
    const deliveryBox = new THREE.Mesh(boxGeo, materials.wallWhite);
    deliveryBox.position.set(0, wheelR + 0.45, -0.58);
    deliveryBox.castShadow = true;
    scooterGroup.add(deliveryBox);

    // 4. Steering Column & Handlebars
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), materials.metalDark);
    column.rotation.x = -0.18;
    column.position.set(0, wheelR + 0.45, 0.45);
    scooterGroup.add(column);

    const handleBar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.04), materials.metalDark);
    handleBar.position.set(0, wheelR + 0.78, 0.4);
    scooterGroup.add(handleBar);

    // 5. Headlight
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), materials.vehicleHeadlight);
    hl.rotation.x = Math.PI / 2;
    hl.position.set(0, wheelR + 0.68, 0.56);
    scooterGroup.add(hl);

    // 6. 2 Wheels Grounded
    [-0.48, 0.48].forEach((z) => {
      const wheel = createWheel(wheelR, 0.12);
      wheel.position.set(0, wheelR, z);
      scooterGroup.add(wheel);
    });
    scooterGroup.castShadow = true;
    group.add(scooterGroup);
  }

  return group;
}
