import * as THREE from 'three';

/**
 * Creates the residential road network, precision curbs with sloped driveway aprons,
 * continuous sidewalks with scored expansion joints, mathematically exact road-edge lines,
 * pedestrian crosswalks, lane markings, and cast iron storm drain sewer grates.
 */

export function createRoads(materials) {
  const group = new THREE.Group();
  group.name = 'RoadsGroup';

  const roadWidth = 7.6;
  const roadHalfW = roadWidth / 2; // 3.8m
  const roadLength = 96;
  const halfLen = roadLength / 2; // 48m
  const roadY = 0.02;
  const markingY = roadY + 0.003; // Physically elevated slightly above road to eliminate z-fighting

  // 1. PRIMARY RESIDENTIAL STREET (Straight, clean architectural avenue)
  const mainRoadGeo = new THREE.PlaneGeometry(roadLength, roadWidth);
  mainRoadGeo.rotateX(-Math.PI / 2);
  const mainRoadMesh = new THREE.Mesh(mainRoadGeo, materials.asphalt);
  mainRoadMesh.position.set(0, roadY, 0);
  mainRoadMesh.receiveShadow = true;
  group.add(mainRoadMesh);

  // 2. INTERSECTING SIDE STREET & CUL-DE-SAC (East side, x = 26)
  const sideRoadX = 26;
  const sideRoadW = 6.4;
  const sideRoadHalfW = sideRoadW / 2; // 3.2m
  const sideRoadL = 14.5;
  const sideRoadZStart = roadHalfW; // 3.8m
  const sideRoadZCenter = sideRoadZStart + sideRoadL / 2; // 11.05m

  const sideRoadGeo = new THREE.PlaneGeometry(sideRoadW, sideRoadL);
  sideRoadGeo.rotateX(-Math.PI / 2);
  const sideRoadMesh = new THREE.Mesh(sideRoadGeo, materials.asphalt);
  sideRoadMesh.position.set(sideRoadX, roadY, sideRoadZCenter);
  sideRoadMesh.receiveShadow = true;
  group.add(sideRoadMesh);

  // Cul-de-sac turnaround bulb
  const culDeSacRadius = 7.5;
  const culDeSacZ = 22.5;
  const culDeSacGeo = new THREE.CircleGeometry(culDeSacRadius, 40);
  culDeSacGeo.rotateX(-Math.PI / 2);
  const culDeSacMesh = new THREE.Mesh(culDeSacGeo, materials.asphalt);
  culDeSacMesh.position.set(sideRoadX, roadY, culDeSacZ);
  culDeSacMesh.receiveShadow = true;
  group.add(culDeSacMesh);

  // Cul-de-sac landscaped center island
  const islandRadius = 2.4;
  const islandGeo = new THREE.CylinderGeometry(islandRadius, islandRadius + 0.15, 0.18, 32);
  const islandMesh = new THREE.Mesh(islandGeo, materials.curbConcrete);
  islandMesh.position.set(sideRoadX, 0.09, culDeSacZ);
  islandMesh.receiveShadow = true;
  islandMesh.castShadow = true;
  group.add(islandMesh);

  const islandGrassGeo = new THREE.CylinderGeometry(islandRadius - 0.15, islandRadius - 0.15, 0.06, 32);
  const islandGrassMesh = new THREE.Mesh(islandGrassGeo, materials.vergeLawn);
  islandGrassMesh.position.set(sideRoadX, 0.2, culDeSacZ);
  islandGrassMesh.receiveShadow = true;
  group.add(islandGrassMesh);

  // 3. ROAD EDGE LINES (Continuous, mathematically straight, constant offset from curb)
  const edgeLineW = 0.12;
  const edgeOffsetFromCurb = 0.35; // 35cm inward from curb
  const northEdgeZ = -roadHalfW + edgeOffsetFromCurb; // -3.45m
  const southEdgeZ = roadHalfW - edgeOffsetFromCurb;  // +3.45m

  // North road-edge white line (runs continuously and straight across full avenue)
  const northEdgeGeo = new THREE.PlaneGeometry(roadLength - 2, edgeLineW);
  northEdgeGeo.rotateX(-Math.PI / 2);
  const northEdgeMesh = new THREE.Mesh(northEdgeGeo, materials.roadMarkingWhite);
  northEdgeMesh.position.set(0, markingY, northEdgeZ);
  northEdgeMesh.receiveShadow = true;
  group.add(northEdgeMesh);

  // South road-edge line (runs straight, breaks cleanly at side street intersection with rounded returns)
  const southEdgeWestLen = (sideRoadX - sideRoadHalfW - 1.2) - (-halfLen + 1);
  const southEdgeWestGeo = new THREE.PlaneGeometry(southEdgeWestLen, edgeLineW);
  southEdgeWestGeo.rotateX(-Math.PI / 2);
  const southEdgeWestMesh = new THREE.Mesh(southEdgeWestGeo, materials.roadMarkingWhite);
  southEdgeWestMesh.position.set(-halfLen + 1 + southEdgeWestLen / 2, markingY, southEdgeZ);
  southEdgeWestMesh.receiveShadow = true;
  group.add(southEdgeWestMesh);

  const southEdgeEastStart = sideRoadX + sideRoadHalfW + 1.2;
  const southEdgeEastLen = (halfLen - 1) - southEdgeEastStart;
  const southEdgeEastGeo = new THREE.PlaneGeometry(southEdgeEastLen, edgeLineW);
  southEdgeEastGeo.rotateX(-Math.PI / 2);
  const southEdgeEastMesh = new THREE.Mesh(southEdgeEastGeo, materials.roadMarkingWhite);
  southEdgeEastMesh.position.set(southEdgeEastStart + southEdgeEastLen / 2, markingY, southEdgeZ);
  southEdgeEastMesh.receiveShadow = true;
  group.add(southEdgeEastMesh);

  // Side street edge lines (continuous, straight along side street into cul-de-sac)
  const sideEdgeL = 10.5;
  const sideEdgeGeo = new THREE.PlaneGeometry(edgeLineW, sideEdgeL);
  sideEdgeGeo.rotateX(-Math.PI / 2);

  const sideEdgeWest = new THREE.Mesh(sideEdgeGeo, materials.roadMarkingWhite);
  sideEdgeWest.position.set(sideRoadX - sideRoadHalfW + edgeOffsetFromCurb, markingY, roadHalfW + 1.2 + sideEdgeL / 2);
  sideEdgeWest.receiveShadow = true;
  group.add(sideEdgeWest);

  const sideEdgeEast = new THREE.Mesh(sideEdgeGeo, materials.roadMarkingWhite);
  sideEdgeEast.position.set(sideRoadX + sideRoadHalfW - edgeOffsetFromCurb, markingY, roadHalfW + 1.2 + sideEdgeL / 2);
  sideEdgeEast.receiveShadow = true;
  group.add(sideEdgeEast);

  // 4. CENTERLINE (Dashed white centerlines along primary avenue)
  const dashLength = 2.4;
  const dashGap = 3.2;
  const dashWidth = 0.13;
  const dashGeo = new THREE.PlaneGeometry(dashLength, dashWidth);
  dashGeo.rotateX(-Math.PI / 2);

  const numDashes = Math.floor(roadLength / (dashLength + dashGap));
  for (let i = 0; i < numDashes; i++) {
    const dX = -halfLen + i * (dashLength + dashGap) + dashLength / 2;

    // Skip centerline at crosswalk and side street intersection
    if (Math.abs(dX - (-14)) < 4.0 || Math.abs(dX - sideRoadX) < 4.5) {
      continue;
    }

    const dMesh = new THREE.Mesh(dashGeo, materials.roadMarkingWhite);
    dMesh.position.set(dX, markingY, 0);
    dMesh.receiveShadow = true;
    group.add(dMesh);
  }

  // Side street dashed centerline
  const sideDashes = 2;
  for (let i = 0; i < sideDashes; i++) {
    const sZ = roadHalfW + 2.8 + i * (dashLength + dashGap);
    const sDashGeo = new THREE.PlaneGeometry(dashWidth, dashLength);
    sDashGeo.rotateX(-Math.PI / 2);
    const sDashMesh = new THREE.Mesh(sDashGeo, materials.roadMarkingWhite);
    sDashMesh.position.set(sideRoadX, markingY, sZ);
    sDashMesh.receiveShadow = true;
    group.add(sDashMesh);
  }

  // 5. PEDESTRIAN CROSSWALK & STOP BARS (Near x = -14)
  const crosswalkX = -14;
  const stripeWidth = 0.55;
  const stripeLength = 3.0;
  const stripeGap = 0.45;
  const numStripes = 7;

  const stripeGeo = new THREE.PlaneGeometry(stripeWidth, stripeLength);
  stripeGeo.rotateX(-Math.PI / 2);

  for (let i = 0; i < numStripes; i++) {
    const sZ = -roadHalfW + 0.65 + i * (stripeWidth + stripeGap);
    const sMesh = new THREE.Mesh(stripeGeo, materials.roadMarkingWhite);
    sMesh.position.set(crosswalkX, markingY, sZ);
    sMesh.receiveShadow = true;
    group.add(sMesh);
  }

  // Stop Bar Lines (approaching crosswalk and side intersection)
  const stopBarGeo = new THREE.PlaneGeometry(0.45, 3.4);
  stopBarGeo.rotateX(-Math.PI / 2);

  // Stop line westbound before crosswalk
  const stopWest = new THREE.Mesh(stopBarGeo, materials.roadMarkingWhite);
  stopWest.position.set(crosswalkX + 2.8, markingY, -1.8);
  stopWest.receiveShadow = true;
  group.add(stopWest);

  // Stop line eastbound before crosswalk
  const stopEast = new THREE.Mesh(stopBarGeo, materials.roadMarkingWhite);
  stopEast.position.set(crosswalkX - 2.8, markingY, 1.8);
  stopEast.receiveShadow = true;
  group.add(stopEast);

  // Stop line on side street approaching main avenue
  const stopSideGeo = new THREE.PlaneGeometry(2.8, 0.45);
  stopSideGeo.rotateX(-Math.PI / 2);
  const stopSide = new THREE.Mesh(stopSideGeo, materials.roadMarkingWhite);
  stopSide.position.set(sideRoadX + 1.4, markingY, roadHalfW + 1.4);
  stopSide.receiveShadow = true;
  group.add(stopSide);

  // Parallel parking bay markings (south side between x = -7 and x = -1)
  const parkLineGeo = new THREE.PlaneGeometry(0.12, 2.2);
  parkLineGeo.rotateX(-Math.PI / 2);
  [-6.8, -1.2].forEach((bx) => {
    const pMesh = new THREE.Mesh(parkLineGeo, materials.roadMarkingWhite);
    pMesh.position.set(bx, markingY, roadHalfW - 1.2);
    pMesh.receiveShadow = true;
    group.add(pMesh);
  });

  // 6. CURBS & DRIVEWAY APRONS (Precision straight geometry, seamless transitions)
  const curbH = 0.15; // 15cm standard curb
  const curbW = 0.20; // 20cm curb width
  const apronH = 0.025; // 2.5cm lowered driveway apron
  const northCurbZ = -roadHalfW - curbW / 2; // -3.90m
  const southCurbZ = roadHalfW + curbW / 2;  // +3.90m

  // Driveway locations along X matching the 6 lots (width 4.0m)
  const driveways = [
    { start: -31.5, end: -27.5 }, // Lot 1 & Lot 4
    { start: -12.5, end: -8.5 },  // Lot 2 & Lot 5
    { start: 6.5, end: 10.5 },    // Lot 3 & Lot 6
  ];

  // Helper to build a curb section between two X coordinates
  function createCurbInterval(x1, x2, zPos, isNorth) {
    const curbRun = new THREE.Group();
    let currentX = x1;

    driveways.forEach((dw) => {
      if (dw.start >= x1 && dw.end <= x2) {
        // High curb before driveway
        if (dw.start > currentX) {
          const len = dw.start - currentX;
          const cGeo = new THREE.BoxGeometry(len, curbH, curbW);
          const cMesh = new THREE.Mesh(cGeo, materials.curbConcrete);
          cMesh.position.set(currentX + len / 2, curbH / 2, zPos);
          cMesh.receiveShadow = true;
          cMesh.castShadow = true;
          curbRun.add(cMesh);
        }

        // Lowered driveway apron
        const apronLen = dw.end - dw.start;
        const aGeo = new THREE.BoxGeometry(apronLen, apronH, curbW);
        const aMesh = new THREE.Mesh(aGeo, materials.curbConcrete);
        aMesh.position.set(dw.start + apronLen / 2, apronH / 2, zPos);
        aMesh.receiveShadow = true;
        curbRun.add(aMesh);

        currentX = dw.end;
      }
    });

    // Remaining high curb after last driveway
    if (currentX < x2) {
      const len = x2 - currentX;
      const cGeo = new THREE.BoxGeometry(len, curbH, curbW);
      const cMesh = new THREE.Mesh(cGeo, materials.curbConcrete);
      cMesh.position.set(currentX + len / 2, curbH / 2, zPos);
      cMesh.receiveShadow = true;
      cMesh.castShadow = true;
      curbRun.add(cMesh);
    }

    return curbRun;
  }

  // North curb (full 96m run with driveway aprons)
  group.add(createCurbInterval(-halfLen, halfLen, northCurbZ, true));

  // South curb (west of side street and east of side street)
  const cornerRadius = 1.6;
  const southWestCurbEnd = sideRoadX - sideRoadHalfW - cornerRadius;
  const southEastCurbStart = sideRoadX + sideRoadHalfW + cornerRadius;
  group.add(createCurbInterval(-halfLen, southWestCurbEnd, southCurbZ, false));
  group.add(createCurbInterval(southEastCurbStart, halfLen, southCurbZ, false));

  // Corner rounded curb returns at side street intersection
  const cornerGeo = new THREE.CylinderGeometry(cornerRadius, cornerRadius, curbH, 16, 1, false, 0, Math.PI / 2);
  const cornerWest = new THREE.Mesh(cornerGeo, materials.curbConcrete);
  cornerWest.position.set(southWestCurbEnd, curbH / 2, southCurbZ + cornerRadius);
  cornerWest.rotation.y = Math.PI;
  cornerWest.receiveShadow = true;
  cornerWest.castShadow = true;
  group.add(cornerWest);

  const cornerEast = new THREE.Mesh(cornerGeo, materials.curbConcrete);
  cornerEast.position.set(southEastCurbStart, curbH / 2, southCurbZ + cornerRadius);
  cornerEast.rotation.y = -Math.PI / 2;
  cornerEast.receiveShadow = true;
  cornerEast.castShadow = true;
  group.add(cornerEast);

  // Side street straight curbs
  const sideCurbLen = 10.5;
  const sideCurbGeo = new THREE.BoxGeometry(curbW, curbH, sideCurbLen);

  const sideCurbWest = new THREE.Mesh(sideCurbGeo, materials.curbConcrete);
  sideCurbWest.position.set(sideRoadX - sideRoadHalfW - curbW / 2, curbH / 2, southCurbZ + cornerRadius + sideCurbLen / 2);
  sideCurbWest.receiveShadow = true;
  sideCurbWest.castShadow = true;
  group.add(sideCurbWest);

  const sideCurbEast = new THREE.Mesh(sideCurbGeo, materials.curbConcrete);
  sideCurbEast.position.set(sideRoadX + sideRoadHalfW + curbW / 2, curbH / 2, southCurbZ + cornerRadius + sideCurbLen / 2);
  sideCurbEast.receiveShadow = true;
  sideCurbEast.castShadow = true;
  group.add(sideCurbEast);

  // 7. PLANTING VERGE (Green lawn buffer between curb and sidewalk)
  const vergeW = 1.1; // 1.1m wide
  const vergeH = 0.14;
  const northVergeZ = northCurbZ - curbW / 2 - vergeW / 2; // -4.55m
  const southVergeZ = southCurbZ + curbW / 2 + vergeW / 2; // +4.55m

  function createVergeInterval(x1, x2, zPos) {
    const vergeRun = new THREE.Group();
    let currentX = x1;

    driveways.forEach((dw) => {
      if (dw.start >= x1 && dw.end <= x2) {
        if (dw.start > currentX) {
          const len = dw.start - currentX;
          const vGeo = new THREE.BoxGeometry(len, vergeH, vergeW);
          const vMesh = new THREE.Mesh(vGeo, materials.vergeLawn);
          vMesh.position.set(currentX + len / 2, vergeH / 2, zPos);
          vMesh.receiveShadow = true;
          vergeRun.add(vMesh);
        }
        currentX = dw.end; // Driveways cross through the verge with pavers
      }
    });

    if (currentX < x2) {
      const len = x2 - currentX;
      const vGeo = new THREE.BoxGeometry(len, vergeH, vergeW);
      const vMesh = new THREE.Mesh(vGeo, materials.vergeLawn);
      vMesh.position.set(currentX + len / 2, vergeH / 2, zPos);
      vMesh.receiveShadow = true;
      vergeRun.add(vMesh);
    }

    return vergeRun;
  }

  group.add(createVergeInterval(-halfLen, halfLen, northVergeZ));
  group.add(createVergeInterval(-halfLen, southWestCurbEnd, southVergeZ));
  group.add(createVergeInterval(southEastCurbStart, halfLen, southVergeZ));

  // 8. SIDEWALKS WITH EXPANSION JOINTS (Concrete pedestrian paths)
  const sidewalkW = 1.8;
  const sidewalkH = 0.15;
  const northSidewalkZ = northVergeZ - vergeW / 2 - sidewalkW / 2; // -6.00m
  const southSidewalkZ = southVergeZ + vergeW / 2 + sidewalkW / 2; // +6.00m

  function createSidewalkRun(x1, x2, zPos) {
    const swGroup = new THREE.Group();
    const totalLen = x2 - x1;
    const slabLen = 1.8; // Standard 1.8m concrete slabs
    const numSlabs = Math.floor(totalLen / slabLen);

    for (let i = 0; i < numSlabs; i++) {
      const sX = x1 + i * slabLen + slabLen / 2;
      const sGeo = new THREE.BoxGeometry(slabLen - 0.03, sidewalkH, sidewalkW);
      const sMesh = new THREE.Mesh(sGeo, materials.sidewalkConcrete);
      sMesh.position.set(sX, sidewalkH / 2, zPos);
      sMesh.receiveShadow = true;
      swGroup.add(sMesh);

      // Expansion joint seam
      const jGeo = new THREE.BoxGeometry(0.03, sidewalkH + 0.001, sidewalkW);
      const jMesh = new THREE.Mesh(jGeo, materials.sidewalkJoint);
      jMesh.position.set(x1 + (i + 1) * slabLen - 0.015, sidewalkH / 2, zPos);
      swGroup.add(jMesh);
    }

    // Remainder slab
    const remainder = totalLen - numSlabs * slabLen;
    if (remainder > 0.1) {
      const sX = x1 + numSlabs * slabLen + remainder / 2;
      const sGeo = new THREE.BoxGeometry(remainder, sidewalkH, sidewalkW);
      const sMesh = new THREE.Mesh(sGeo, materials.sidewalkConcrete);
      sMesh.position.set(sX, sidewalkH / 2, zPos);
      sMesh.receiveShadow = true;
      swGroup.add(sMesh);
    }

    return swGroup;
  }

  group.add(createSidewalkRun(-halfLen, halfLen, northSidewalkZ));
  group.add(createSidewalkRun(-halfLen, southWestCurbEnd, southSidewalkZ));
  group.add(createSidewalkRun(southEastCurbStart, halfLen, southSidewalkZ));

  // 9. CAST IRON STORM DRAIN SEWER GRATES (Recessed in asphalt gutter)
  const grateLocations = [
    { x: -18, z: northCurbZ + curbW / 2 + 0.35 },
    { x: -2, z: southCurbZ - curbW / 2 - 0.35 },
    { x: 18, z: northCurbZ + curbW / 2 + 0.35 },
    { x: 33, z: southCurbZ - curbW / 2 - 0.35 },
  ];

  const grateFrameGeo = new THREE.BoxGeometry(0.95, 0.03, 0.6);
  const grateBarsGeo = new THREE.BoxGeometry(0.85, 0.035, 0.5);

  grateLocations.forEach((loc) => {
    const grateGroup = new THREE.Group();
    grateGroup.position.set(loc.x, roadY + 0.005, loc.z);

    const frame = new THREE.Mesh(grateFrameGeo, materials.castIronGrate);
    frame.receiveShadow = true;
    grateGroup.add(frame);

    const bars = new THREE.Mesh(grateBarsGeo, materials.castIronGrate);
    bars.receiveShadow = true;
    grateGroup.add(bars);

    group.add(grateGroup);
  });

  return group;
}
