import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * ladderProp.js
 * High-precision 3D Borrowable Ladder for the SAATHI neighborhood diorama.
 *
 * Geometric Architecture:
 * - Local Origin (0, 0, 0) is precisely at the grip point of the right (inner) side rail.
 * - Long rails extend forward/backward along local Z (-height/2 to +height/2).
 * - Rungs extend outward along local -X (0 to -width).
 * - Rail thickness is in local Y (-depth/2 to +depth/2).
 * - Sturdy extruded aluminum side rails, 6 cylindrical rungs with ribbed rubber treads,
 *   industrial steel joint brackets, non-slip rubber safety shoes, and OSHA caution decals.
 */

export class BorrowableLadder {
  constructor() {
    this.type = 'ladder';
    this.owner = 'NEIGHBOR'; // 'NEIGHBOR' | 'RESIDENT' | 'HOUSE'
    this.root = new THREE.Group();
    this.root.name = 'BorrowableLadder';

    this.materials = {
      railMetal: new THREE.MeshStandardMaterial({
        color: 0xdfe2e8, // High-visibility anodized silver aluminum
        roughness: 0.24,
        metalness: 0.78,
      }),
      rungMetal: new THREE.MeshStandardMaterial({
        color: 0xc8ceda, // Polished aluminum rungs
        roughness: 0.20,
        metalness: 0.82,
      }),
      bracketSteel: new THREE.MeshStandardMaterial({
        color: 0x484c56, // Industrial dark steel brackets
        roughness: 0.35,
        metalness: 0.85,
      }),
      rubberDark: new THREE.MeshStandardMaterial({
        color: 0x18181c, // High-friction charcoal rubber feet & caps
        roughness: 0.85,
        metalness: 0.05,
      }),
      cautionYellow: new THREE.MeshStandardMaterial({
        color: 0xf5a623, // Safety caution hazard decal strip
        roughness: 0.38,
        metalness: 0.12,
      }),
    };

    this.createLadderGeometry();
  }

  createLadderGeometry() {
    const m = this.materials;
    const ladderGroup = new THREE.Group();
    ladderGroup.name = 'LadderModel';

    // Proportional dimensions for a domestic cottage/roof utility ladder
    const height = 1.62; // Total length along rails (Z axis)
    const width = 0.34;  // Rung width between rails (X axis)
    const depth = 0.065; // Rail profile thickness (Y axis)
    const railWidth = 0.042; // Rail width in X

    // 1. Two Sturdy Beveled Side Rails
    // Inner Rail (held by hand) at X = 0
    // Outer Rail (facing away from character body) at X = -width
    [0, -width].forEach((rx, index) => {
      const railGeo = new RoundedBoxGeometry(railWidth, depth, height, 2, 0.010);
      const rail = new THREE.Mesh(railGeo, m.railMetal);
      rail.position.set(rx, 0, 0);
      rail.castShadow = true;
      rail.receiveShadow = true;
      ladderGroup.add(rail);

      // Top Safety Rubber Bumper Cap (+Z end)
      const topCapGeo = new RoundedBoxGeometry(railWidth + 0.008, depth + 0.008, 0.050, 2, 0.008);
      const topCap = new THREE.Mesh(topCapGeo, m.rubberDark);
      topCap.position.set(rx, 0, height / 2 + 0.018);
      topCap.castShadow = true;
      ladderGroup.add(topCap);

      // Bottom Pivoting Rubber Non-Slip Shoe (-Z end)
      const footGeo = new RoundedBoxGeometry(railWidth + 0.012, depth + 0.025, 0.065, 2, 0.008);
      const foot = new THREE.Mesh(footGeo, m.rubberDark);
      foot.position.set(rx, 0.006, -height / 2 - 0.020);
      foot.castShadow = true;
      foot.receiveShadow = true;
      ladderGroup.add(foot);

      // OSHA Safety Caution Decals on upper rail sides
      const cautionGeo = new THREE.BoxGeometry(railWidth + 0.002, depth + 0.002, 0.090);
      const caution = new THREE.Mesh(cautionGeo, m.cautionYellow);
      caution.position.set(rx, 0, height * 0.28);
      ladderGroup.add(caution);
    });

    // 2. Six Evenly Spaced Non-Slip Cylindrical Rungs with Reinforcement Brackets
    const numRungs = 6;
    const rungSpan = height * 0.74; // Rungs distributed along Z
    const rungInnerWidth = width - railWidth;
    const rungCenterX = -width / 2;

    for (let i = 0; i < numRungs; i++) {
      const rz = -rungSpan / 2 + i * (rungSpan / (numRungs - 1));

      // Cylindrical Rung Beam along X
      const rungGeo = new THREE.CylinderGeometry(0.014, 0.014, rungInnerWidth, 12);
      rungGeo.rotateZ(Math.PI / 2);
      const rung = new THREE.Mesh(rungGeo, m.rungMetal);
      rung.position.set(rungCenterX, 0, rz);
      rung.castShadow = true;
      ladderGroup.add(rung);

      // Dual Non-Slip Ribbed Grips on each rung
      [-rungInnerWidth * 0.24, rungInnerWidth * 0.24].forEach((gx) => {
        const gripGeo = new THREE.TorusGeometry(0.016, 0.003, 6, 12);
        const grip = new THREE.Mesh(gripGeo, m.rubberDark);
        grip.rotateY(Math.PI / 2);
        grip.position.set(rungCenterX + gx, 0, rz);
        ladderGroup.add(grip);
      });

      // Steel Joint Brackets connecting rungs to side rails
      [0, -width].forEach((bx) => {
        const bracketGeo = new THREE.BoxGeometry(0.016, depth * 0.85, 0.032);
        const bracket = new THREE.Mesh(bracketGeo, m.bracketSteel);
        bracket.position.set(bx, 0, rz);
        bracket.castShadow = true;
        ladderGroup.add(bracket);
      });
    }

    // 3. Central Hinge Spreader & Metal Lock Bracket
    const lockBarGeo = new THREE.BoxGeometry(width + 0.01, 0.024, 0.024);
    const lockBar = new THREE.Mesh(lockBarGeo, m.bracketSteel);
    lockBar.position.set(rungCenterX, -depth / 2 - 0.006, 0);
    lockBar.castShadow = true;
    ladderGroup.add(lockBar);

    this.root.add(ladderGroup);
  }

  /**
   * Re-parents the ladder to a target group (resident hand, scene, or house).
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
    Object.values(this.materials).forEach((mat) => {
      if (mat && mat.dispose) mat.dispose();
    });
    this.root.traverse((obj) => {
      if (obj.geometry && obj.geometry.dispose) {
        obj.geometry.dispose();
      }
    });
  }
}
