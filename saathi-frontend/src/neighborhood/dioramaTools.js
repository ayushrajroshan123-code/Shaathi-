import * as THREE from 'three';

/**
 * dioramaTools.js
 * Procedural borrowable tools for the SAATHI neighborhood diorama.
 * Reconstructed using clean Three.js primitives and standard materials:
 * - Visually recognizable from isometric diorama camera (scaled 1.55x for readability)
 * - Lightweight, reusable hierarchy
 * - Hand attachment support (leftHandGroup / rightHandGroup)
 * - State and ownership tracking ('NEIGHBOR' | 'GIRL')
 */

export class BorrowableTool {
  constructor(type = 'drill') {
    this.type = type;
    this.owner = 'NEIGHBOR'; // 'NEIGHBOR' or 'GIRL'
    this.root = new THREE.Group();
    this.root.name = 'BorrowableTool_' + type;

    this.materials = {
      bodyTeal: new THREE.MeshStandardMaterial({
        color: 0x18a394, // SAATHI energetic teal
        roughness: 0.35,
        metalness: 0.05,
      }),
      rubberDark: new THREE.MeshStandardMaterial({
        color: 0x222225,
        roughness: 0.7,
        metalness: 0.0,
      }),
      metalSilver: new THREE.MeshStandardMaterial({
        color: 0xd8d8de,
        roughness: 0.25,
        metalness: 0.85,
      }),
      chuckDark: new THREE.MeshStandardMaterial({
        color: 0x38383c,
        roughness: 0.45,
        metalness: 0.6,
      }),
      triggerRed: new THREE.MeshStandardMaterial({
        color: 0xe63946,
        roughness: 0.4,
      }),
      accentYellow: new THREE.MeshStandardMaterial({
        color: 0xf4a261,
        roughness: 0.4,
      }),
    };

    if (type === 'drill') {
      this.createDrillGeometry();
    }
  }

  createDrillGeometry() {
    const m = this.materials;
    const drillGroup = new THREE.Group();
    drillGroup.name = 'DrillModel';

    // 1. Main Motor Body (horizontal rounded cylinder)
    const bodyGeo = new THREE.CylinderGeometry(0.045, 0.048, 0.16, 14);
    bodyGeo.rotateZ(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, m.bodyTeal);
    body.position.set(0, 0.08, 0);
    body.castShadow = true;
    drillGroup.add(body);

    // Rear motor cap / vent
    const rearCapGeo = new THREE.SphereGeometry(0.046, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    rearCapGeo.rotateZ(-Math.PI / 2);
    const rearCap = new THREE.Mesh(rearCapGeo, m.rubberDark);
    rearCap.position.set(-0.08, 0.08, 0);
    rearCap.castShadow = true;
    drillGroup.add(rearCap);

    // 2. Front Chuck Collar (dark metallic)
    const chuckCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.042, 0.04, 12),
      m.chuckDark
    );
    chuckCollar.rotation.z = Math.PI / 2;
    chuckCollar.position.set(0.09, 0.08, 0);
    chuckCollar.castShadow = true;
    drillGroup.add(chuckCollar);

    // Front Chuck Tip
    const chuckTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.034, 0.045, 12),
      m.metalSilver
    );
    chuckTip.rotation.z = Math.PI / 2;
    chuckTip.position.set(0.125, 0.08, 0);
    chuckTip.castShadow = true;
    drillGroup.add(chuckTip);

    // 3. Drill Bit (shiny projecting steel spiral bit)
    const bit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, 0.08, 8),
      m.metalSilver
    );
    bit.rotation.z = Math.PI / 2;
    bit.position.set(0.185, 0.08, 0);
    bit.castShadow = true;
    drillGroup.add(bit);

    // 4. Ergonomic Handle (vertical grip)
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.026, 0.11, 10),
      m.rubberDark
    );
    handle.rotation.z = 0.12; // Slight ergonomic tilt
    handle.position.set(-0.015, 0.01, 0);
    handle.castShadow = true;
    drillGroup.add(handle);

    // Red trigger on inner grip
    const trigger = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.024, 0.018),
      m.triggerRed
    );
    trigger.position.set(0.012, 0.045, 0);
    drillGroup.add(trigger);

    // 5. Battery Base (rectangular flat battery pack)
    const battery = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.032, 0.065),
      m.rubberDark
    );
    battery.position.set(-0.01, -0.055, 0);
    battery.castShadow = true;
    battery.receiveShadow = true;
    drillGroup.add(battery);

    // Accent power indicator strip on battery
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.008, 0.068),
      m.accentYellow
    );
    strip.position.set(0.01, -0.052, 0);
    drillGroup.add(strip);

    // Scale drill to ~1.72x previous scale (1.55x) for high visibility in diorama camera (Section 10)
    drillGroup.scale.set(1.55, 1.55, 1.55);

    this.root.add(drillGroup);
  }

  /**
   * Re-parents the tool to a new parent group (e.g. resident's rightHandGroup or scene).
   * @param {THREE.Object3D} newParent
   * @param {THREE.Vector3} [localPos]
   * @param {THREE.Euler} [localRot]
   */
  attachTo(newParent, localPos = null, localRot = null) {
    if (!newParent) return;
    newParent.add(this.root);
    if (localPos) {
      this.root.position.copy(localPos);
    } else {
      this.root.position.set(0, 0, 0);
    }
    if (localRot) {
      this.root.rotation.copy(localRot);
    } else {
      this.root.rotation.set(0, 0, 0);
    }
  }

  dispose() {
    Object.values(this.materials).forEach((mat) => mat.dispose());
  }
}

export { BorrowableLadder } from './ladderProp.js';

