import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * dioramaPlatform.js
 * Collectible architectural diorama base platform:
 * - Rounded outer corner plinth (radius 0.25m, 4 segments)
 * - Tonal separation between off-white top rim and satin side plinth
 * - 4 raised quadrant lawn pads with vivid cheerful grass and sunny meadow patches
 * - Studio shadow-catcher floor below the platform
 */

export function createDioramaPlatform(materials) {
  const group = new THREE.Group();
  group.name = 'DioramaPlatform';

  const PLATFORM_SIZE = 38.0; // 38m x 38m square
  const HALF_SIZE = PLATFORM_SIZE / 2;
  const BASE_HEIGHT = 2.4;
  const ROAD_HALF_WIDTH = 3.3; // 6.6m total road width

  // 1. Collectible Rounded Base Slab (warm off-white satin side plinth)
  const baseGeo = new RoundedBoxGeometry(PLATFORM_SIZE, BASE_HEIGHT, PLATFORM_SIZE, 3, 0.25);
  const baseMesh = new THREE.Mesh(baseGeo, materials.platformSide);
  baseMesh.position.y = -BASE_HEIGHT / 2;
  baseMesh.receiveShadow = true;
  baseMesh.castShadow = true;
  group.add(baseMesh);

  // 2. Beveled Top Rim Trim (framing the physical miniature diorama)
  const rimThickness = 0.28;
  const rimHeight = 0.14;

  const rimGeos = [
    // North edge (Z = -HALF_SIZE)
    { w: PLATFORM_SIZE + 0.2, d: rimThickness, x: 0, z: -HALF_SIZE },
    // South edge (Z = +HALF_SIZE)
    { w: PLATFORM_SIZE + 0.2, d: rimThickness, x: 0, z: HALF_SIZE },
    // West edge (X = -HALF_SIZE)
    { w: rimThickness, d: PLATFORM_SIZE + 0.2, x: -HALF_SIZE, z: 0 },
    // East edge (X = +HALF_SIZE)
    { w: rimThickness, d: PLATFORM_SIZE + 0.2, x: HALF_SIZE, z: 0 },
  ];

  rimGeos.forEach((r) => {
    const geo = new RoundedBoxGeometry(r.w, rimHeight, r.d, 2, 0.04);
    const m = new THREE.Mesh(geo, materials.platformBevel);
    m.position.set(r.x, rimHeight / 2, r.z);
    m.receiveShadow = true;
    group.add(m);
  });

  // 3. Ground Sub-base for Roadways (Asphalt foundation at y = 0.0)
  const roadBaseGeo = new THREE.PlaneGeometry(PLATFORM_SIZE, PLATFORM_SIZE);
  const roadBaseMesh = new THREE.Mesh(roadBaseGeo, materials.asphalt);
  roadBaseMesh.rotation.x = -Math.PI / 2;
  roadBaseMesh.position.y = 0.005;
  roadBaseMesh.receiveShadow = true;
  group.add(roadBaseMesh);

  // 4. Four Raised Quadrant Lawn Pads (y = 0.14)
  const quadWidth = HALF_SIZE - ROAD_HALF_WIDTH - 0.2;
  const quadDepth = HALF_SIZE - ROAD_HALF_WIDTH - 0.2;
  const quadHeight = 0.14;

  const quadrants = [
    // Quadrant 1: South (Foreground - Cat Building)
    { name: 'QuadSouth', x: (HALF_SIZE + ROAD_HALF_WIDTH) / 2, z: (HALF_SIZE + ROAD_HALF_WIDTH) / 2 },
    // Quadrant 2: West (Left - 3-Story Corner + Green Awning)
    { name: 'QuadWest', x: -(HALF_SIZE + ROAD_HALF_WIDTH) / 2, z: (HALF_SIZE + ROAD_HALF_WIDTH) / 2 },
    // Quadrant 3: North (Rear - Steep Gable Market)
    { name: 'QuadNorth', x: -(HALF_SIZE + ROAD_HALF_WIDTH) / 2, z: -(HALF_SIZE + ROAD_HALF_WIDTH) / 2 },
    // Quadrant 4: East (Right - Orange Awning + Rooftop Garden)
    { name: 'QuadEast', x: (HALF_SIZE + ROAD_HALF_WIDTH) / 2, z: -(HALF_SIZE + ROAD_HALF_WIDTH) / 2 },
  ];

  quadrants.forEach((q) => {
    const qGroup = new THREE.Group();
    qGroup.name = q.name;
    qGroup.position.set(q.x, 0, q.z);

    // Green grass lawn top (cheerful spring green)
    const lawnGeo = new RoundedBoxGeometry(quadWidth, quadHeight, quadDepth, 2, 0.06);
    const lawnMesh = new THREE.Mesh(lawnGeo, materials.grassLawn);
    lawnMesh.position.y = quadHeight / 2;
    lawnMesh.receiveShadow = true;
    lawnMesh.castShadow = false;
    qGroup.add(lawnMesh);

    // Subtle sunlit lighter green meadow patch for visual warmth
    const patchGeo = new RoundedBoxGeometry(quadWidth * 0.45, 0.02, quadDepth * 0.45, 2, 0.04);
    const patch = new THREE.Mesh(patchGeo, materials.grassLightPatch);
    patch.position.set(quadWidth * 0.18, quadHeight + 0.01, quadDepth * 0.18);
    patch.receiveShadow = true;
    qGroup.add(patch);

    // Chamfered retaining edge below lawn
    const borderGeo = new THREE.BoxGeometry(quadWidth + 0.08, quadHeight - 0.02, quadDepth + 0.08);
    const borderMesh = new THREE.Mesh(borderGeo, materials.grassBorder);
    borderMesh.position.y = (quadHeight - 0.02) / 2;
    borderMesh.receiveShadow = true;
    qGroup.add(borderMesh);

    group.add(qGroup);
  });

  // 5. Environmental Floor Treatment (Soft architectural floor illumination)
  const floorCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (floorCanvas) {
    floorCanvas.width = 256;
    floorCanvas.height = 256;
    const ctx = floorCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.35, 'rgba(248, 250, 252, 0.70)');
    grad.addColorStop(0.65, 'rgba(240, 244, 248, 0.40)');
    grad.addColorStop(0.85, 'rgba(235, 240, 245, 0.15)');
    grad.addColorStop(1, 'rgba(235, 240, 245, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    const floorGeo = new THREE.PlaneGeometry(95, 95);
    const floorMat = new THREE.MeshBasicMaterial({
      map: floorTexture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const envFloorMesh = new THREE.Mesh(floorGeo, floorMat);
    envFloorMesh.rotation.x = -Math.PI / 2;
    envFloorMesh.position.y = -BASE_HEIGHT - 0.015;
    group.add(envFloorMesh);
  }

  // 6. Studio Shadow Floor Plane (Extending beneath the diorama)
  const shadowGeo = new THREE.PlaneGeometry(95, 95);
  const shadowMesh = new THREE.Mesh(shadowGeo, materials.shadowPlane);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = -BASE_HEIGHT - 0.01;
  shadowMesh.receiveShadow = true;
  group.add(shadowMesh);

  return group;
}
