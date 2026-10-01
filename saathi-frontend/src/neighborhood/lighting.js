import * as THREE from 'three';

/**
 * Creates the soft cinematic daylight lighting setup:
 * - Directional sunlight (late-morning warmth with expansive soft PCF shadows, zero edge clipping)
 * - Hemisphere light (sky blue-grey above, warm ground bounce below)
 * - Secondary soft fill light (eliminates harsh occluded blacks)
 * - Subtle downward warm point lights at foreground street lamps
 * - Atmospheric depth fog (soft natural aerial perspective matching the horizon)
 */

export function setupLighting(scene) {
  const lightsGroup = new THREE.Group();
  lightsGroup.name = 'LightingGroup';

  // 1. Natural Sky Hemisphere Light (Sky diffuse + warm ground bounce)
  const hemiLight = new THREE.HemisphereLight(0xe5edf5, 0xded5c6, 1.15);
  hemiLight.position.set(0, 60, 0);
  lightsGroup.add(hemiLight);

  // 2. Primary Directional Sunlight (Late-morning angle, warm architectural daylight)
  const sunLight = new THREE.DirectionalLight(0xfffbf2, 2.35);
  sunLight.position.set(48, 56, 38);
  sunLight.target.position.set(0, 0, 0);
  lightsGroup.add(sunLight.target);

  // High-fidelity architectural shadow mapping
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 200;

  // Frustum bounds covering the entire neighborhood display plinth
  const d = 65;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;

  // Tuned bias for crisp contact shadows with soft penumbra
  sunLight.shadow.bias = -0.00015;
  sunLight.shadow.normalBias = 0.02;
  sunLight.shadow.radius = 2.2;

  lightsGroup.add(sunLight);

  // 3. Secondary Soft Fill Light (Simulates sky dome diffuse scatter)
  const fillLight = new THREE.DirectionalLight(0xd4e2ee, 0.45);
  fillLight.position.set(-42, 32, -36);
  fillLight.castShadow = false;
  lightsGroup.add(fillLight);

  // 4. Subtle Downward Warm Accent Point Lights under key foreground street lamps
  const lampLight1 = new THREE.PointLight(0xffeed6, 0.5, 9, 1.8);
  lampLight1.position.set(-12, 4.25, -4.5);
  lightsGroup.add(lampLight1);

  const lampLight2 = new THREE.PointLight(0xffeed6, 0.5, 9, 1.8);
  lampLight2.position.set(-16, 4.25, 4.5);
  lightsGroup.add(lampLight2);

  scene.add(lightsGroup);

  // 5. Atmospheric Aerial Perspective Fog
  const fogColor = new THREE.Color(0xe5ebf1);
  scene.background = fogColor;
  scene.fog = new THREE.Fog(fogColor, 65, 175);

  return {
    group: lightsGroup,
    sunLight,
    hemiLight,
    fillLight,
    lampLight1,
    lampLight2,
  };
}
