import * as THREE from 'three';

/**
 * Creates the terrain foundation, architectural plinth, elevation changes,
 * and the 6 reserved residential lots with driveways, walkways, and lawn terraces.
 *
 * NOTE: Strictly NO placeholder house boxes are created.
 * The 6 lots are established organically through landscape, driveways, stone edging,
 * and lawn envelopes.
 */

export function createTerrain(materials) {
  const group = new THREE.Group();
  group.name = 'TerrainGroup';

  // 1. Architectural Display Plinth / Presentation Base
  // Gives the neighborhood the feel of a high-end architectural physical miniature model.
  const plinthWidth = 104;
  const plinthDepth = 104;
  const plinthHeight = 2.4;

  const plinthGeo = new THREE.BoxGeometry(plinthWidth, plinthHeight, plinthDepth);
  const plinthMesh = new THREE.Mesh(plinthGeo, materials.basePlinth);
  plinthMesh.position.y = -plinthHeight / 2 - 0.05;
  plinthMesh.receiveShadow = true;
  group.add(plinthMesh);

  // Plinth upper perimeter beveled edge (architectural trim)
  const trimGeo = new THREE.BoxGeometry(plinthWidth + 0.6, 0.12, plinthDepth + 0.6);
  const trimMesh = new THREE.Mesh(trimGeo, materials.plinthBevel);
  trimMesh.position.y = -0.06;
  trimMesh.receiveShadow = true;
  group.add(trimMesh);

  // 2. Base Ground Level (Natural lawn terrain across the neighborhood)
  const terrainGeo = new THREE.PlaneGeometry(plinthWidth, plinthDepth, 32, 32);
  terrainGeo.rotateX(-Math.PI / 2);

  // Add subtle natural elevation waves to perimeter terrain
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const distFromCenter = Math.hypot(x, z);

    // Keep the core street & lots flat and clean, elevate natural perimeter berms
    if (distFromCenter > 34) {
      const angle = Math.atan2(z, x);
      const elevation = Math.sin(x * 0.08) * Math.cos(z * 0.08) * 0.45 + (distFromCenter - 34) * 0.035;
      pos.setY(i, Math.max(0, elevation));
    } else {
      pos.setY(i, 0.01);
    }
  }
  terrainGeo.computeVertexNormals();

  const terrainMesh = new THREE.Mesh(terrainGeo, materials.mainLawn);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // 3. Gentle Grassy Berms & Landscape Hillocks around outer rim
  const bermGeos = [
    { x: -38, z: -32, rx: 12, rz: 8, h: 0.8 },
    { x: 36, z: -30, rx: 14, rz: 9, h: 0.9 },
    { x: -36, z: 34, rx: 10, rz: 11, h: 0.75 },
    { x: 38, z: 32, rx: 13, rz: 8, h: 0.85 },
    { x: -44, z: 2, rx: 7, rz: 16, h: 0.65 },
    { x: 44, z: -4, rx: 8, rz: 18, h: 0.7 },
  ];

  bermGeos.forEach((b) => {
    const bermGeo = new THREE.ConeGeometry(b.rx, b.h, 16);
    bermGeo.scale(1, 1, b.rz / b.rx);
    const bermMesh = new THREE.Mesh(bermGeo, materials.vergeLawn);
    bermMesh.position.set(b.x, b.h / 2, b.z);
    bermMesh.receiveShadow = true;
    group.add(bermMesh);
  });

  // 4. SIX RESERVED RESIDENTIAL LOTS
  // Distinct lot definitions with driveways, walkways, terraced lawns, and garden borders
  const lots = [
    // North side of street (Z < 0)
    { id: 1, x: -24, z: -17, w: 17, d: 19, side: 'north', drivewayOffset: -5.5 },
    { id: 2, x: -5, z: -17, w: 17, d: 19, side: 'north', drivewayOffset: -5.5 },
    { id: 3, x: 14, z: -17, w: 17, d: 19, side: 'north', drivewayOffset: -5.5 },

    // South side of street (Z > 0)
    { id: 4, x: -24, z: 17, w: 17, d: 19, side: 'south', drivewayOffset: -5.5 },
    { id: 5, x: -5, z: 17, w: 17, d: 19, side: 'south', drivewayOffset: -5.5 },
    { id: 6, x: 14, z: 17, w: 17, d: 19, side: 'south', drivewayOffset: -5.5 },
  ];

  lots.forEach((lot) => {
    // A. Slightly elevated manicured lot lawn pad (Y = 0.18m)
    const lotLawnGeo = new THREE.BoxGeometry(lot.w, 0.12, lot.d);
    const lotLawnMesh = new THREE.Mesh(lotLawnGeo, materials.manicuredLotLawn);
    lotLawnMesh.position.set(lot.x, 0.06, lot.z);
    lotLawnMesh.receiveShadow = true;
    group.add(lotLawnMesh);

    // B. Stone / Paver perimeter curb along the sides & back of the lot
    const edgeThickness = 0.22;
    const edgeHeight = 0.18;

    // Back border
    const backZ = lot.side === 'north' ? lot.z - lot.d / 2 : lot.z + lot.d / 2;
    const backEdgeGeo = new THREE.BoxGeometry(lot.w + 0.2, edgeHeight, edgeThickness);
    const backEdgeMesh = new THREE.Mesh(backEdgeGeo, materials.gardenStone);
    backEdgeMesh.position.set(lot.x, edgeHeight / 2, backZ);
    backEdgeMesh.receiveShadow = true;
    backEdgeMesh.castShadow = true;
    group.add(backEdgeMesh);

    // Left border
    const leftEdgeGeo = new THREE.BoxGeometry(edgeThickness, edgeHeight, lot.d);
    const leftEdgeMesh = new THREE.Mesh(leftEdgeGeo, materials.gardenStone);
    leftEdgeMesh.position.set(lot.x - lot.w / 2, edgeHeight / 2, lot.z);
    leftEdgeMesh.receiveShadow = true;
    leftEdgeMesh.castShadow = true;
    group.add(leftEdgeMesh);

    // Right border
    const rightEdgeMesh = new THREE.Mesh(leftEdgeGeo, materials.gardenStone);
    rightEdgeMesh.position.set(lot.x + lot.w / 2, edgeHeight / 2, lot.z);
    rightEdgeMesh.receiveShadow = true;
    rightEdgeMesh.castShadow = true;
    group.add(rightEdgeMesh);

    // C. Paver Driveway connecting seamlessly from street curb apron (z = ±3.8m) to future garage zone
    const drivewayWidth = 3.6;
    const drivewayLength = 16.0;
    const drivewayX = lot.x + lot.drivewayOffset;
    const drivewayZ = lot.side === 'north' ? -11.8 : 11.8;

    const drivewayGeo = new THREE.BoxGeometry(drivewayWidth, 0.145, drivewayLength);
    const drivewayMesh = new THREE.Mesh(drivewayGeo, materials.drivewayPavers);
    drivewayMesh.position.set(drivewayX, 0.0725, drivewayZ);
    drivewayMesh.receiveShadow = true;
    group.add(drivewayMesh);

    // D. Pedestrian Concrete Walkway connecting from sidewalk (z = ±6.0m) to front entry
    const walkwayWidth = 1.3;
    const walkwayLength = 7.5;
    const walkwayX = lot.x + 3.2;
    const walkwayZ = lot.side === 'north' ? -10.25 : 10.25;

    const walkwayGeo = new THREE.BoxGeometry(walkwayWidth, 0.152, walkwayLength);
    const walkwayMesh = new THREE.Mesh(walkwayGeo, materials.sidewalkConcrete);
    walkwayMesh.position.set(walkwayX, 0.076, walkwayZ);
    walkwayMesh.receiveShadow = true;
    group.add(walkwayMesh);

    // E. Garden Soil Bed along front border
    const gardenBedW = 4.5;
    const gardenBedD = 2.2;
    const gardenBedX = lot.x + 0.5;
    const gardenBedZ = lot.side === 'north' ? -10.2 : 10.2;

    const gardenSoilGeo = new THREE.BoxGeometry(gardenBedW, 0.16, gardenBedD);
    const gardenSoilMesh = new THREE.Mesh(gardenSoilGeo, materials.gardenSoil);
    gardenSoilMesh.position.set(gardenBedX, 0.08, gardenBedZ);
    gardenSoilMesh.receiveShadow = true;
    group.add(gardenSoilMesh);

    // Low retaining timber border for the garden bed
    const timberGeo = new THREE.BoxGeometry(gardenBedW + 0.2, 0.2, 0.12);
    const timberMesh = new THREE.Mesh(timberGeo, materials.cedarWood);
    timberMesh.position.set(gardenBedX, 0.1, lot.side === 'north' ? gardenBedZ + gardenBedD / 2 : gardenBedZ - gardenBedD / 2);
    timberMesh.receiveShadow = true;
    timberMesh.castShadow = true;
    group.add(timberMesh);
  });

  return group;
}
