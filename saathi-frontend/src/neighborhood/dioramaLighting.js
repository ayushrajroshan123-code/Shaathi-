import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * dioramaLighting.js
 * Stage 2A Three-Light Studio Setup + Gentle Room Environment:
 * - Hemisphere: Sky #ffffff, Ground #ffe8c7 (intensity ~1.55) for creamy bounce
 * - Main Sun: Warm white #fff3dc (intensity ~2.3) casting soft, light architectural shadows
 * - Fill Light: Cool white #dfeaff (intensity ~0.55) preventing dark/grey shadow sides
 * - RoomEnvironment via PMREMGenerator for subtle, soft PBR response
 * - Pure white studio background (#ffffff) with zero atmospheric fog
 */

export function setupDioramaLighting(scene, renderer) {
  scene.fog = null; // Miniature remains crisp with zero atmospheric haze

  // 2. Ambient Hemisphere Light (Sky: pure white, Ground: fresh meadow bounce)
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdce8b5, 1.05);
  scene.add(hemiLight);

  // 3. Key Sunlight (Directional Light casting broad, soft architectural PCF shadows)
  const dirLight = new THREE.DirectionalLight(0xfff6e8, 2.15);
  dirLight.position.set(34, 48, 26);
  dirLight.castShadow = true;

  // Optimized shadow camera covering the 38m x 38m platform (2048x2048 balances sharp architectural penumbra and low VRAM)
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 10;
  dirLight.shadow.camera.far = 130;

  const d = 28;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.bias = -0.0002;
  dirLight.shadow.radius = 2.2; // Soft architectural penumbra

  scene.add(dirLight);

  // 4. Secondary Cool Fill Light (Prevents shadow sides from becoming dull grey or black)
  const fillLight = new THREE.DirectionalLight(0xc6dcf8, 0.45);
  fillLight.position.set(-30, 36, -30);
  fillLight.castShadow = false; // Pure fill, no conflicting shadows
  scene.add(fillLight);

  // 5. Gentle Environment Lighting for subtle PBR response (controlled intensity avoids wash)
  let pmremGenerator = null;
  let envMap = null;
  if (renderer) {
    pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    envMap = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    scene.environment = envMap;
    if ('environmentIntensity' in scene) {
      scene.environmentIntensity = 0.15;
    }
    roomEnv.dispose();
  }

  return {
    hemiLight,
    dirLight,
    fillLight,
    dispose() {
      if (pmremGenerator) pmremGenerator.dispose();
      if (envMap) envMap.dispose();
    },
  };
}
