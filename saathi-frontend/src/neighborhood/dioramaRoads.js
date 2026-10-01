import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * dioramaRoads.js
 * High-precision 3D road, curb, sidewalk, and crosswalk system.
 * Features:
 * - Soft dark-grey asphalt roadbeds (#54585F) with warm white markings (#FFFAF0)
 * - Rounded curb edges (radius 0.05m) in warm limestone tone
 * - Warm cream sidewalk paving slabs with tactile joint patterns
 * - Crisp white zebra pedestrian crossings and dashed centerline lane dividers
 * - Subtle road detail (manhole covers)
 */

export function createDioramaRoads(materials) {
  const group = new THREE.Group();
  group.name = 'DioramaRoads';

  const PLATFORM_SIZE = 38.0;
  const HALF_SIZE = PLATFORM_SIZE / 2;
  const ROAD_WIDTH = 6.6;
  const HALF_ROAD = ROAD_WIDTH / 2;
  const ROAD_Y = 0.01;
  const CURB_HEIGHT = 0.16;
  const CURB_WIDTH = 0.22;
  const SIDEWALK_WIDTH = 2.2;

  // 1. Soft Charcoal Asphalt Roadway Surface
  const mainRoadGeo = new THREE.PlaneGeometry(PLATFORM_SIZE, ROAD_WIDTH);
  const mainRoadMesh = new THREE.Mesh(mainRoadGeo, materials.asphalt);
  mainRoadMesh.rotation.x = -Math.PI / 2;
  mainRoadMesh.position.set(0, ROAD_Y, 0);
  mainRoadMesh.receiveShadow = true;
  group.add(mainRoadMesh);

  const crossRoadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, PLATFORM_SIZE);
  const crossRoadMesh = new THREE.Mesh(crossRoadGeo, materials.asphalt);
  crossRoadMesh.rotation.x = -Math.PI / 2;
  crossRoadMesh.position.set(0, ROAD_Y, 0);
  crossRoadMesh.receiveShadow = true;
  group.add(crossRoadMesh);

  // 2. Sidewalks and Rounded Curbs for each of the 4 Quadrants
  const quadrants = [
    { dirX: 1, dirZ: 1 },
    { dirX: -1, dirZ: 1 },
    { dirX: -1, dirZ: -1 },
    { dirX: 1, dirZ: -1 },
  ];

  quadrants.forEach(({ dirX, dirZ }) => {
    const qGroup = new THREE.Group();

    // Sidewalk section along X road
    const swLenX = HALF_SIZE - HALF_ROAD;
    const swGeoX = new THREE.BoxGeometry(swLenX, CURB_HEIGHT, SIDEWALK_WIDTH);
    const swMeshX = new THREE.Mesh(swGeoX, materials.sidewalk);
    swMeshX.position.set(
      dirX * (HALF_ROAD + swLenX / 2),
      CURB_HEIGHT / 2,
      dirZ * (HALF_ROAD + SIDEWALK_WIDTH / 2)
    );
    swMeshX.receiveShadow = true;
    qGroup.add(swMeshX);

    // Rounded curb edge along X road (radius 0.05m)
    const curbGeoX = new RoundedBoxGeometry(swLenX, CURB_HEIGHT + 0.01, CURB_WIDTH, 2, 0.05);
    const curbMeshX = new THREE.Mesh(curbGeoX, materials.curb);
    curbMeshX.position.set(
      dirX * (HALF_ROAD + swLenX / 2),
      (CURB_HEIGHT + 0.01) / 2,
      dirZ * (HALF_ROAD + CURB_WIDTH / 2)
    );
    curbMeshX.receiveShadow = true;
    curbMeshX.castShadow = true;
    qGroup.add(curbMeshX);

    // Sidewalk section along Z road
    const swLenZ = HALF_SIZE - HALF_ROAD - SIDEWALK_WIDTH;
    const swGeoZ = new THREE.BoxGeometry(SIDEWALK_WIDTH, CURB_HEIGHT, swLenZ);
    const swMeshZ = new THREE.Mesh(swGeoZ, materials.sidewalk);
    swMeshZ.position.set(
      dirX * (HALF_ROAD + SIDEWALK_WIDTH / 2),
      CURB_HEIGHT / 2,
      dirZ * (HALF_ROAD + SIDEWALK_WIDTH + swLenZ / 2)
    );
    swMeshZ.receiveShadow = true;
    qGroup.add(swMeshZ);

    // Rounded curb edge along Z road (radius 0.05m)
    const curbGeoZ = new RoundedBoxGeometry(CURB_WIDTH, CURB_HEIGHT + 0.01, swLenZ + SIDEWALK_WIDTH, 2, 0.05);
    const curbMeshZ = new THREE.Mesh(curbGeoZ, materials.curb);
    curbMeshZ.position.set(
      dirX * (HALF_ROAD + CURB_WIDTH / 2),
      (CURB_HEIGHT + 0.01) / 2,
      dirZ * (HALF_ROAD + (swLenZ + SIDEWALK_WIDTH) / 2)
    );
    curbMeshZ.receiveShadow = true;
    curbMeshZ.castShadow = true;
    qGroup.add(curbMeshZ);

    // Sidewalk paving joint lines
    const jointCount = Math.floor(swLenX / 1.5);
    for (let j = 1; j <= jointCount; j++) {
      const jx = dirX * (HALF_ROAD + j * 1.5);
      const jointGeo = new THREE.PlaneGeometry(0.03, SIDEWALK_WIDTH - 0.1);
      const jMesh = new THREE.Mesh(jointGeo, materials.sidewalkJoint);
      jMesh.rotation.x = -Math.PI / 2;
      jMesh.position.set(jx, CURB_HEIGHT + 0.005, dirZ * (HALF_ROAD + SIDEWALK_WIDTH / 2));
      qGroup.add(jMesh);
    }

    group.add(qGroup);
  });

  // 3. Road Markings (Crisp warm white dashed centerline + Zebra crossings)
  const MARKING_Y = ROAD_Y + 0.005;

  const dashLen = 1.4;
  const dashGap = 1.6;
  const dashWidth = 0.18;

  // East and West Main Street dashes
  [-1, 1].forEach((dir) => {
    let currentX = dir * (HALF_ROAD + 3.8);
    while (Math.abs(currentX) < HALF_SIZE - 1.0) {
      const dashGeo = new THREE.PlaneGeometry(dashLen, dashWidth);
      const dashMesh = new THREE.Mesh(dashGeo, materials.roadMarkingWhite);
      dashMesh.rotation.x = -Math.PI / 2;
      dashMesh.position.set(currentX + (dir * dashLen) / 2, MARKING_Y, 0);
      dashMesh.receiveShadow = true;
      group.add(dashMesh);
      currentX += dir * (dashLen + dashGap);
    }
  });

  // North and South Cross Street dashes
  [-1, 1].forEach((dir) => {
    let currentZ = dir * (HALF_ROAD + 3.8);
    while (Math.abs(currentZ) < HALF_SIZE - 1.0) {
      const dashGeo = new THREE.PlaneGeometry(dashWidth, dashLen);
      const dashMesh = new THREE.Mesh(dashGeo, materials.roadMarkingWhite);
      dashMesh.rotation.x = -Math.PI / 2;
      dashMesh.position.set(0, MARKING_Y, currentZ + (dir * dashLen) / 2);
      dashMesh.receiveShadow = true;
      group.add(dashMesh);
      currentZ += dir * (dashLen + dashGap);
    }
  });

  // 4. Zebra Crossings (Four prominent crosswalks at intersection entrances)
  function createZebraCrossing(centerX, centerZ, isHorizontal) {
    const crossGroup = new THREE.Group();
    const barWidth = 0.48;
    const barLength = 2.8;
    const barSpacing = 0.36;
    const totalBars = 8;

    for (let i = 0; i < totalBars; i++) {
      const offset = (i - (totalBars - 1) / 2) * (barWidth + barSpacing);
      const barGeo = new THREE.PlaneGeometry(
        isHorizontal ? barLength : barWidth,
        isHorizontal ? barWidth : barLength
      );
      const barMesh = new THREE.Mesh(barGeo, materials.crosswalkWhite);
      barMesh.rotation.x = -Math.PI / 2;

      if (isHorizontal) {
        barMesh.position.set(centerX, MARKING_Y, centerZ + offset);
      } else {
        barMesh.position.set(centerX + offset, MARKING_Y, centerZ);
      }
      barMesh.receiveShadow = true;
      crossGroup.add(barMesh);
    }

    // Solid Stop Line before the crossing
    const stopWidth = isHorizontal ? 0.35 : ROAD_WIDTH * 0.9;
    const stopLength = isHorizontal ? ROAD_WIDTH * 0.9 : 0.35;
    const stopGeo = new THREE.PlaneGeometry(stopWidth, stopLength);
    const stopMesh = new THREE.Mesh(stopGeo, materials.roadMarkingWhite);
    stopMesh.rotation.x = -Math.PI / 2;

    const stopOffset = isHorizontal ? (centerX > 0 ? 1.6 : -1.6) : (centerZ > 0 ? 1.6 : -1.6);
    if (isHorizontal) {
      stopMesh.position.set(centerX + stopOffset, MARKING_Y, centerZ);
    } else {
      stopMesh.position.set(centerX, MARKING_Y, centerZ + stopOffset);
    }
    crossGroup.add(stopMesh);

    return crossGroup;
  }

  group.add(createZebraCrossing(-4.8, 0, true));
  group.add(createZebraCrossing(4.8, 0, true));
  group.add(createZebraCrossing(0, 4.8, false));
  group.add(createZebraCrossing(0, -4.8, false));

  // 5. Subtle Cast-Iron Manhole Covers (placed safely in lanes)
  const manholeGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.015, 16);
  [
    { x: -7.5, z: 1.65 },
    { x: 7.5, z: -1.65 },
  ].forEach(({ x, z }) => {
    const mh = new THREE.Mesh(manholeGeo, materials.metalDark);
    mh.position.set(x, ROAD_Y + 0.008, z);
    mh.receiveShadow = true;
    group.add(mh);
  });

  return group;
}
