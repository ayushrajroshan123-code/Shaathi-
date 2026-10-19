import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * boxProp.js
 * Exactly ONE physical heavy household moving box prop for the SAATHI diorama.
 *
 * Requirements:
 * - Medium-large standard moving/storage cardboard box (~0.58m W x 0.42m H x 0.46m D)
 * - Realistic craft cardboard materials, sealing tape along flaps, side carry grip recesses
 * - Sits flush on sidewalk / porch ground (y = 0.16m + height/2 = 0.37m)
 * - Lifts smoothly during two-person carry (y = 0.54m)
 * - Exactly ONE instance instantiated in the carry scenario
 */
export class HouseholdBox {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'HouseholdBox_SingleInstance';

    this.width = 0.56;
    this.height = 0.42;
    this.depth = 0.46;

    this.groundY = 0.16 + this.height / 2; // 0.37m
    this.carryY  = 0.54;

    this.materials = {
      cardboard: new THREE.MeshStandardMaterial({
        color: 0xc89e6e, // Warm natural kraft brown cardboard
        roughness: 0.82,
        metalness: 0.0,
      }),
      cardboardDark: new THREE.MeshStandardMaterial({
        color: 0xb58957, // Slightly deeper kraft tone
        roughness: 0.88,
        metalness: 0.0,
      }),
      tape: new THREE.MeshStandardMaterial({
        color: 0x825936, // Reinforced brown packaging tape
        roughness: 0.40,
        metalness: 0.02,
      }),
      handleRecess: new THREE.MeshStandardMaterial({
        color: 0x423223, // Dark recessed hand grip slot
        roughness: 0.90,
      }),
      labelWhite: new THREE.MeshStandardMaterial({
        color: 0xf5f3ee, // White address / shipping label sticker
        roughness: 0.60,
      }),
      iconStamp: new THREE.MeshStandardMaterial({
        color: 0x3d3025, // Black printed "Fragile / Up This Way" stencil
        roughness: 0.85,
      }),
    };

    this.createGeometry();
  }

  createGeometry() {
    const m = this.materials;
    const w = this.width;
    const h = this.height;
    const d = this.depth;

    // 1. Main Cardboard Body with rounded edges
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 2, 0.018),
      m.cardboard
    );
    body.castShadow = true;
    body.receiveShadow = true;
    this.root.add(body);

    // 2. Brown Packing Tape running across top seam and folding down sides
    const topTape = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.006, d + 0.008),
      m.tape
    );
    topTape.position.set(0, h / 2 + 0.002, 0);
    topTape.castShadow = true;
    this.root.add(topTape);

    // Side tape vertical fold down front and back
    [-1, 1].forEach((dirZ) => {
      const flapTape = new THREE.Mesh(
        new THREE.BoxGeometry(0.065, 0.12, 0.006),
        m.tape
      );
      flapTape.position.set(0, h / 2 - 0.058, dirZ * (d / 2 + 0.002));
      flapTape.castShadow = true;
      this.root.add(flapTape);
    });

    // 3. Side Carry Grip Recesses (left and right where hands grip)
    [-1, 1].forEach((dirX) => {
      const handleGrip = new THREE.Mesh(
        new RoundedBoxGeometry(0.006, 0.045, 0.11, 2, 0.012),
        m.handleRecess
      );
      handleGrip.position.set(dirX * (w / 2 + 0.002), 0.04, 0);
      handleGrip.castShadow = true;
      this.root.add(handleGrip);
    });

    // 4. White Shipping / Content Label on front face
    const label = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.10, 0.004),
      m.labelWhite
    );
    label.position.set(w / 4, 0.05, d / 2 + 0.002);
    label.castShadow = true;
    this.root.add(label);

    // 5. Stylized "This Way Up" Arrow Stencils on front face
    [-0.024, 0.024].forEach((ax) => {
      const arrowShaft = new THREE.Mesh(
        new THREE.BoxGeometry(0.008, 0.038, 0.004),
        m.iconStamp
      );
      arrowShaft.position.set(-w / 4 + ax, 0.035, d / 2 + 0.002);
      this.root.add(arrowShaft);

      const arrowHead = new THREE.Mesh(
        new THREE.ConeGeometry(0.015, 0.022, 3),
        m.iconStamp
      );
      arrowHead.position.set(-w / 4 + ax, 0.065, d / 2 + 0.002);
      this.root.add(arrowHead);
    });

    // Default resting position
    this.root.position.set(11.80, this.groundY, 6.80);
  }

  setPosition(x, y, z) {
    this.root.position.set(x, y, z);
  }

  setRotationY(angle) {
    this.root.rotation.y = angle;
  }

  dispose() {
    Object.values(this.materials).forEach((mat) => {
      if (mat && mat.dispose) mat.dispose();
    });
  }
}
