import * as THREE from 'three';

/**
 * CameraDirector
 *
 * Cinematic multi-shot camera orchestrator for the SAATHI 3D landing-page diorama.
 *
 * Core Architectural Principles:
 * 1. Intentional Story Corridor:
 *    - Views actors from the OPEN / STORY-FACING side, not behind rear building walls.
 *    - House A (Sarah): North facade, teal door, stone garden path, and fence gate viewed
 *      from the North-West open street intersection (zero building occlusion).
 *    - House B (Dr. Thorne & Handoff): Two-actor interaction viewed from the West/North-West,
 *      framing both Sarah and Dr. Thorne in three-quarter profile with the drill clearly
 *      visible between their hands.
 *    - Street Walk: Follows Sarah along the open sidewalk and crosswalk with cinematic look-ahead.
 * 2. Visual Authority Preservation:
 *    - The original establishing view (22.0, 17.0, 24.0) looking at (0.0, 1.4, 0.8) is strictly preserved.
 *    - OrbitControls are cleanly disabled during cinematic stories and restored upon return.
 * 3. Film-Style Composition:
 *    - Frames actors in the upper/middle viewport, leaving quiet negative space in the lower
 *      viewport for restrained cinematic captions without obscuring character bodies.
 */

export const CAMERA_STATES = {
  ESTABLISHING: 'ESTABLISHING',
  REFRAMING:    'REFRAMING',
  FOLLOWING:    'FOLLOWING',
  HANDOFF:      'HANDOFF',
  RETURNING:    'RETURNING',
};

// Hand-off states in borrowingScenario that require the two-actor interaction shot
const DRILL_HANDOFF_STATES = new Set([
  'SARAH_APPROACHING_NEIGHBOR',
  'HANDOFF',
  'TRANSFER_DRILL',
  'SHOW_THANK_YOU',
  'RETURN_HANDOFF',
  'RETURN_TRANSFER',
  'SHOW_THANKS',
  'SHOW_HAPPY_TO_HELP',
]);

// States that take place at House B (Dr. Thorne steps out and confirms drill)
const DRILL_HOUSE_B_STATES = new Set([
  'REVEAL_NEIGHBOR_OPEN_DOOR',
  'REVEAL_NEIGHBOR_STEP_OUT',
  'REVEAL_NEIGHBOR',
]);

// States that take place directly at House A (exit, garden ask, home drilling work)
const DRILL_GARDEN_STATES = new Set([
  'ASKING_OPEN_DOOR',
  'SARAH_NEEDS_DRILL',
  'SARAH_STEP_OUT',
  'ASKING_STEP_OUT',
  'ASKING',
  'USING',
  'WORK_DONE',
  'RETURN_REQUEST',
]);

export class CameraDirector {
  constructor(options = {}) {
    this.camera = options.camera;
    this.controls = options.controls;

    // Establishing camera composition (Visual Authority Viewpoint - strictly preserved)
    this.defaultCameraPos = options.defaultCameraPos
      ? options.defaultCameraPos.clone()
      : new THREE.Vector3(22.0, 17.0, 24.0);

    this.defaultCameraTarget = options.defaultCameraTarget
      ? options.defaultCameraTarget.clone()
      : new THREE.Vector3(0.0, 1.4, 0.8);

    this.defaultZoom = 1.0;

    // Shot 1: House A Front Garden & Entrance Shot
    // Target: Center of stone path between House A front door (Z=9.3) and garden gate (Z=6.0)
    // Camera: Viewed from open street intersection (NW: x=-2.2, y=9.20, z=-5.0)
    // Result: Sarah leaves door, walks down path towards camera with House A in background.
    // Lowered elevation (~22.9°) reveals full body, face, and front garden without top-down flattening.
    this.shotGardenTarget = new THREE.Vector3(11.80, 1.40, 7.00);
    this.shotGardenPos    = new THREE.Vector3(-2.20, 9.20, -5.00);
    this.shotGardenZoom   = 1.15;

    // Shot 2: House B Handoff & Interaction Shot
    // Target: Midpoint between Sarah (Z=5.35) and Dr. Thorne (Z=5.95) at X=-8.80
    // Camera: Viewed from West/NW (x=-18.80, y=6.05, z=-1.35)
    // Result: Both actors in 3/4 profile, drill held in open space between them, fully lit and visible.
    // Lowered elevation (~21.5°) brings camera to shoulder/chest level while preserving architectural context.
    this.shotHandoffTarget = new THREE.Vector3(-8.80, 1.25, 5.65);
    this.shotHandoffPos    = new THREE.Vector3(-18.80, 6.05, -1.35);
    this.shotHandoffZoom   = 1.28;

    // Shot 3: Street Walk Follow Shot
    // Lowered Y offset from Sarah's position looking across the open street from the North-West
    this.streetFollowOffset = new THREE.Vector3(-10.0, 8.5, -14.0);
    this.streetFollowZoom   = 1.08;

    // Current State
    this.state = CAMERA_STATES.ESTABLISHING;

    // Follow Configuration
    this.followSubject = null;
    this.neighborSubject = null;
    this.activeScenario = null;
    this.storyId = null;

    // Cinematic Damping and Lag
    this.lagFactor = 2.8;         // Smooth exponential damping speed (frame-rate independent)
    this.deadZoneRadius = 0.15;   // Micro-deadzone to eliminate small idle jitter

    // Look-ahead tracking
    this.lookAheadDistance = 1.20; // meters ahead in movement direction
    this._lastSubjectPos = new THREE.Vector3();
    this._hasLastSubjectPos = false;
    this._moveDir = new THREE.Vector3();
    this._smoothMoveDir = new THREE.Vector3();
    this._zeroVec = new THREE.Vector3(0, 0, 0);
    this._tempDeltaMove = new THREE.Vector3();

    // Transition Animation State (REFRAMING / RETURNING)
    this.transitionStartTime = 0;
    this.transitionDuration = 1000; // ms
    this.transitionStartPos = new THREE.Vector3();
    this.transitionStartTarget = new THREE.Vector3();
    this.transitionStartZoom = 1.0;
    this.transitionTargetPos = new THREE.Vector3();
    this.transitionTargetTarget = new THREE.Vector3();
    this.transitionTargetZoom = 1.0;

    // Desired state vectors for continuous frame-by-frame lerping
    this._posA = new THREE.Vector3();
    this._posB = new THREE.Vector3();
    this._midpoint = new THREE.Vector3();
    this._desiredTarget = new THREE.Vector3().copy(this.defaultCameraTarget);
    this._desiredPos = new THREE.Vector3().copy(this.defaultCameraPos);
    this._desiredZoom = 1.0;

    // Reduced motion accessibility
    this.reducedMotion = typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Starts cinematic camera for the drill borrowing story.
   *
   * @param {Object} scenario - BorrowingScenario instance
   */
  startDrillStory(scenario) {
    if (!scenario) return;

    this.storyId = 'drill';
    this.activeScenario = scenario;
    this.followSubject = scenario.resident || null;
    this.neighborSubject = scenario.neighbor || null;

    // Temporarily disable OrbitControls so user input cannot fight camera
    if (this.controls) {
      this.controls.enabled = false;
      this.controls.autoRotate = false;
    }

    // Determine initial target & position:
    // Frame House A front entrance & garden path from the North-West open corridor
    this._desiredTarget.copy(this.shotGardenTarget);
    this._desiredPos.copy(this.shotGardenPos);
    this._desiredZoom = this.shotGardenZoom;

    // Initialize motion tracking from her starting doorway
    this._getTargetWorldPosition(this.followSubject, this._posA);
    if (this._posA.lengthSq() > 0) {
      this._lastSubjectPos.copy(this._posA);
    } else {
      this._lastSubjectPos.set(11.80, 0.16, 8.65);
    }
    this._hasLastSubjectPos = true;
    this._smoothMoveDir.set(0, 0, -1); // Heading north toward gate

    if (this.reducedMotion) {
      this.camera.position.copy(this._desiredPos);
      this.controls.target.copy(this._desiredTarget);
      this.camera.zoom = this._desiredZoom;
      this.camera.updateProjectionMatrix();
      this.state = CAMERA_STATES.FOLLOWING;
      return;
    }

    // Begin gentle cinematic reframe toward House A front garden (1100ms)
    this.state = CAMERA_STATES.REFRAMING;
    this.transitionStartTime = performance.now();
    this.transitionDuration = 1100;
    this.transitionStartPos.copy(this.camera.position);
    this.transitionStartTarget.copy(this.controls.target);
    this.transitionStartZoom = this.camera.zoom;

    this.transitionTargetPos.copy(this._desiredPos);
    this.transitionTargetTarget.copy(this._desiredTarget);
    this.transitionTargetZoom = this._desiredZoom;
  }

  /**
   * Starts cinematic camera for the carry story.
   *
   * @param {Object} scenario - CarryScenario instance
   */
  startCarryStory(scenario) {
    if (!scenario) return;

    this.storyId = 'carry';
    this.activeScenario = scenario;
    this.followSubject = scenario.requester || null;
    this.neighborSubject = scenario.helper || null;

    if (this.controls) {
      this.controls.enabled = false;
      this.controls.autoRotate = false;
    }

    // Shot 1: Requester + Box at House A (Quad 4 Building 4A) driveway/front path
    this._desiredTarget.set(9.75, 1.25, -5.60);
    this._desiredPos.set(17.25, 8.45, 3.40);
    this._desiredZoom = 1.25;

    this._getTargetWorldPosition(this.followSubject, this._posA);
    if (this._posA.lengthSq() > 0) {
      this._lastSubjectPos.copy(this._posA);
    } else {
      this._lastSubjectPos.set(9.35, 0.16, -5.60);
    }
    this._hasLastSubjectPos = true;
    this._smoothMoveDir.set(0, 0, 0);

    if (this.reducedMotion) {
      this.camera.position.copy(this._desiredPos);
      this.controls.target.copy(this._desiredTarget);
      this.camera.zoom = this._desiredZoom;
      this.camera.updateProjectionMatrix();
      this.state = CAMERA_STATES.FOLLOWING;
      return;
    }

    this.state = CAMERA_STATES.REFRAMING;
    this.transitionStartTime = performance.now();
    this.transitionDuration = 1100;
    this.transitionStartPos.copy(this.camera.position);
    this.transitionStartTarget.copy(this.controls.target);
    this.transitionStartZoom = this.camera.zoom;

    this.transitionTargetPos.copy(this._desiredPos);
    this.transitionTargetTarget.copy(this._desiredTarget);
    this.transitionTargetZoom = this._desiredZoom;
  }

  /**
   * Starts cinematic camera for the ladder story.
   *
   * @param {Object} scenario - LadderScenario instance
   */
  startLadderStory(scenario) {
    if (!scenario) return;

    this.storyId = 'ladder';
    this.activeScenario = scenario;
    this.followSubject = scenario.borrower || scenario.resident || null;
    this.neighborSubject = scenario.lender || scenario.neighbor || null;

    if (this.controls) {
      this.controls.enabled = false;
      this.controls.autoRotate = false;
    }

    // Shot 1: Borrower at Peach Cottage (House 2B) patio (front three-quarter view with front yard & entrance)
    this._desiredTarget.set(-14.40, 1.25, 10.20);
    this._desiredPos.set(-19.80, 5.40, 5.80);
    this._desiredZoom = 1.28;

    this._getTargetWorldPosition(this.followSubject, this._posA);
    if (this._posA.lengthSq() > 0) {
      this._lastSubjectPos.copy(this._posA);
    } else {
      this._lastSubjectPos.set(-14.40, 0.16, 10.20);
    }
    this._hasLastSubjectPos = true;
    this._smoothMoveDir.set(0, 0, 0);

    if (this.reducedMotion) {
      this.camera.position.copy(this._desiredPos);
      this.controls.target.copy(this._desiredTarget);
      this.camera.zoom = this._desiredZoom;
      this.camera.updateProjectionMatrix();
      this.state = CAMERA_STATES.FOLLOWING;
      return;
    }

    this.state = CAMERA_STATES.REFRAMING;
    this.transitionStartTime = performance.now();
    this.transitionDuration = 1100;
    this.transitionStartPos.copy(this.camera.position);
    this.transitionStartTarget.copy(this.controls.target);
    this.transitionStartZoom = this.camera.zoom;

    this.transitionTargetPos.copy(this._desiredPos);
    this.transitionTargetTarget.copy(this._desiredTarget);
    this.transitionTargetZoom = this._desiredZoom;
  }

  /**
   * Smoothly returns camera to normal establishing composition.
   *
   * @param {number} duration - ms duration of transition (default 950ms)
   */
  returnToEstablishing(duration = 950) {
    if (this.state === CAMERA_STATES.ESTABLISHING) return;

    this.storyId = null;
    this.followSubject = null;
    this.neighborSubject = null;
    this.activeScenario = null;
    this._hasLastSubjectPos = false;
    this._smoothMoveDir.set(0, 0, 0);

    if (this.reducedMotion) {
      this.camera.position.copy(this.defaultCameraPos);
      this.controls.target.copy(this.defaultCameraTarget);
      this.camera.zoom = this.defaultZoom;
      this.camera.updateProjectionMatrix();
      this.state = CAMERA_STATES.ESTABLISHING;
      if (this.controls) this.controls.enabled = true;
      return;
    }

    this.state = CAMERA_STATES.RETURNING;
    this.transitionStartTime = performance.now();
    this.transitionDuration = duration;
    this.transitionStartPos.copy(this.camera.position);
    this.transitionStartTarget.copy(this.controls.target);
    this.transitionStartZoom = this.camera.zoom;

    this.transitionTargetPos.copy(this.defaultCameraPos);
    this.transitionTargetTarget.copy(this.defaultCameraTarget);
    this.transitionTargetZoom = this.defaultZoom;
  }

  /**
   * Immediately stops story camera follow (on cancel or switch) and glides back to establishing.
   */
  stopStoryCamera() {
    this.returnToEstablishing(900);
  }

  /**
   * Updates camera composition every frame inside the main RAF loop.
   *
   * @param {number} delta - Delta time in seconds
   */
  update(delta) {
    if (!this.camera || !this.controls) return;

    // Check if the active scenario finished its lifecycle
    if (this.activeScenario && this.activeScenario.state === 'FINAL_COMPLETE' &&
        this.state !== CAMERA_STATES.RETURNING && this.state !== CAMERA_STATES.ESTABLISHING) {
      this.returnToEstablishing(1100);
    }

    switch (this.state) {
      case CAMERA_STATES.REFRAMING:
        this._updateReframing();
        break;

      case CAMERA_STATES.FOLLOWING:
      case CAMERA_STATES.HANDOFF:
        this._updateFollowOrHandoff(delta);
        break;

      case CAMERA_STATES.RETURNING:
        this._updateReturning();
        break;

      case CAMERA_STATES.ESTABLISHING:
      default:
        // Idle establishing view: OrbitControls has full control if enabled
        break;
    }
  }

  /**
   * Updates the gentle reframe from establishing composition to story subject.
   */
  _updateReframing() {
    const elapsed = performance.now() - this.transitionStartTime;
    const progress = Math.min(1.0, elapsed / this.transitionDuration);

    // Smooth cubic ease-in-out curve
    const t = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    this.camera.position.lerpVectors(this.transitionStartPos, this.transitionTargetPos, t);
    this.controls.target.lerpVectors(this.transitionStartTarget, this.transitionTargetTarget, t);
    this.camera.lookAt(this.controls.target);
    this.camera.zoom = THREE.MathUtils.lerp(this.transitionStartZoom, this.transitionTargetZoom, t);
    this.camera.updateProjectionMatrix();

    if (progress >= 1.0) {
      this.camera.position.copy(this.transitionTargetPos);
      this.controls.target.copy(this.transitionTargetTarget);
      this.camera.lookAt(this.controls.target);
      this.camera.zoom = this.transitionTargetZoom;
      this.camera.updateProjectionMatrix();
      this.state = CAMERA_STATES.FOLLOWING;
    }
  }

  /**
   * Continuous multi-shot cinematic follow:
   * Dynamically evaluates story beat and actor position to pick the optimal viewing corridor.
   */
  _updateFollowOrHandoff(delta) {
    if (!this.activeScenario) return;

    if (this.storyId === 'carry') {
      this._updateCarryStoryCamera(delta);
      return;
    }

    if (this.storyId === 'ladder') {
      this._updateLadderStoryCamera(delta);
      return;
    }

    const scenarioState = this.activeScenario.state;

    // Active moving subject across the neighborhood is Sarah (the borrower who travels)
    const activeSubject = this.followSubject;
    this._getTargetWorldPosition(activeSubject, this._posA);

    // 1. Determine which intentional shot should frame this beat:
    const isHandoff = DRILL_HANDOFF_STATES.has(scenarioState);
    const isHouseB = DRILL_HOUSE_B_STATES.has(scenarioState);
    const isAtGardenHouseA = DRILL_GARDEN_STATES.has(scenarioState) ||
      (this._posA.x > 9.5 && this._posA.z > 5.5);

    if (scenarioState === 'FINAL_COMPLETE' || scenarioState === 'CHARACTERS_RETURN_HOME') {
      if (this.state !== CAMERA_STATES.RETURNING && this.state !== CAMERA_STATES.ESTABLISHING) {
        this.returnToEstablishing(1200);
      }
      return;
    }

    if (isHandoff) {
      // --- SHOT 2: HANDOFF & TWO-ACTOR INTERACTION ---
      this.state = CAMERA_STATES.HANDOFF;

      // Two-actor midpoint framing (lowered elevation ~21.5° shoulder/chest level)
      if (this.followSubject && this.neighborSubject) {
        this._getTargetWorldPosition(this.followSubject, this._posA);
        this._getTargetWorldPosition(this.neighborSubject, this._posB);
        this._midpoint.addVectors(this._posA, this._posB).multiplyScalar(0.5);
        this._desiredTarget.set(this._midpoint.x, this._midpoint.y + 1.25, this._midpoint.z);
        this._desiredPos.set(this._midpoint.x - 10.0, this._midpoint.y + 6.05, this._midpoint.z - 7.0);
      } else {
        this._desiredTarget.copy(this.shotHandoffTarget);
        this._desiredPos.copy(this.shotHandoffPos);
      }
      this._desiredZoom = this.shotHandoffZoom;

    } else if (isHouseB) {
      // --- SHOT 2b: HOUSE B REVEAL & FIND (Dr. Thorne prepares tool) ---
      this.state = CAMERA_STATES.FOLLOWING;
      this._desiredTarget.copy(this.shotHandoffTarget);
      this._desiredPos.copy(this.shotHandoffPos);
      this._desiredZoom = this.shotHandoffZoom;

    } else if (isAtGardenHouseA) {
      // --- SHOT 1: HOUSE A FRONT GARDEN & ENTRANCE ---
      this.state = CAMERA_STATES.FOLLOWING;
      this._desiredTarget.copy(this.shotGardenTarget);
      this._desiredPos.copy(this.shotGardenPos);
      this._desiredZoom = this.shotGardenZoom;

    } else {
      // --- SHOT 3: STREET WALK (Sidewalk & Crosswalk follow) ---
      this.state = CAMERA_STATES.FOLLOWING;

      if (this._posA.lengthSq() > 0) {
        // Calculate movement direction for look-ahead
        if (this._hasLastSubjectPos && delta > 0) {
          this._tempDeltaMove.subVectors(this._posA, this._lastSubjectPos);
          this._tempDeltaMove.y = 0;
          const distSq = this._tempDeltaMove.lengthSq();

          if (distSq > 0.00005) {
            this._moveDir.copy(this._tempDeltaMove).normalize();
            this._smoothMoveDir.lerp(this._moveDir, Math.min(1.0, 3.8 * delta));
          } else {
            this._smoothMoveDir.lerp(this._zeroVec, Math.min(1.0, 2.4 * delta));
          }
        }
        this._lastSubjectPos.copy(this._posA);
        this._hasLastSubjectPos = true;

        const lookAheadX = this._smoothMoveDir.x * this.lookAheadDistance;
        const lookAheadZ = this._smoothMoveDir.z * this.lookAheadDistance;

        // Street look-ahead target with slight road bias to keep street context open
        const targetX = this._posA.x + lookAheadX - 0.40;
        const targetY = this._posA.y + 1.25;
        const targetZ = this._posA.z + lookAheadZ - 0.60;

        // Apply dead-zone to eliminate micro-footstep jitter
        const dx = targetX - this.controls.target.x;
        const dz = targetZ - this.controls.target.z;
        const distSq = dx * dx + dz * dz;

        if (distSq > this.deadZoneRadius * this.deadZoneRadius) {
          this._desiredTarget.set(targetX, targetY, targetZ);
        } else {
          this._desiredTarget.y = targetY;
        }

        this._desiredPos.copy(this._desiredTarget).add(this.streetFollowOffset);
        this._desiredZoom = this.streetFollowZoom;
      }
    }

    // 2. Smooth cinematic exponential damping toward desired framing
    const t = 1.0 - Math.exp(-this.lagFactor * delta);
    this.controls.target.lerp(this._desiredTarget, t);
    this.camera.position.lerp(this._desiredPos, t);
    this.camera.lookAt(this.controls.target);
    this.camera.zoom = THREE.MathUtils.lerp(this.camera.zoom, this._desiredZoom, t);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Smooth return to normal landing-page establishing composition.
   */
  _updateReturning() {
    const elapsed = performance.now() - this.transitionStartTime;
    const progress = Math.min(1.0, elapsed / this.transitionDuration);

    // Quintic ease-in-out curve for gentle landing
    const t = progress < 0.5
      ? 16 * Math.pow(progress, 5)
      : 1 - Math.pow(-2 * progress + 2, 5) / 2;

    this.camera.position.lerpVectors(this.transitionStartPos, this.transitionTargetPos, t);
    this.controls.target.lerpVectors(this.transitionStartTarget, this.transitionTargetTarget, t);
    this.camera.lookAt(this.controls.target);
    this.camera.zoom = THREE.MathUtils.lerp(this.transitionStartZoom, this.transitionTargetZoom, t);
    this.camera.updateProjectionMatrix();

    if (progress >= 1.0) {
      this.camera.position.copy(this.defaultCameraPos);
      this.controls.target.copy(this.defaultCameraTarget);
      this.camera.lookAt(this.defaultCameraTarget);
      this.camera.zoom = this.defaultZoom;
      this.camera.updateProjectionMatrix();

      this.state = CAMERA_STATES.ESTABLISHING;

      // Restore user OrbitControls
      if (this.controls) {
        this.controls.enabled = true;
        this.controls.update();
      }
    }
  }

  /**
   * Dedicated cinematic framing orchestrator for the carry story.
   */
  _updateCarryStoryCamera(delta) {
    const scenario = this.activeScenario;
    if (!scenario) return;
    const scenarioState = scenario.state;

    if (scenarioState === 'FINAL_COMPLETE') {
      if (this.state !== CAMERA_STATES.RETURNING && this.state !== CAMERA_STATES.ESTABLISHING) {
        this.returnToEstablishing(1200);
      }
      return;
    }

    switch (scenarioState) {
      case 'REQUESTER_ASKS':
      case 'SYSTEM_COORDINATION':
        // Shot A: Requester + Box at House A front walkway
        this._desiredTarget.set(9.75, 1.25, -5.60);
        this._desiredPos.set(17.25, 8.45, 3.40);
        this._desiredZoom = 1.25;
        break;

      case 'HELPER_REVEAL':
      case 'HELPER_EXITING_HOME':
        // Shot B: Reveal Helper at House B entrance & doorway
        this._desiredTarget.set(14.40, 1.30, -10.20);
        this._desiredPos.set(21.90, 8.50, -1.20);
        this._desiredZoom = 1.25;
        break;

      case 'HELPER_TRAVELS_TO_REQUESTER':
      case 'HELPER_WALKS_TO_REQUESTER':
        // Shot C: Follow Helper walking along the sidewalk to House A
        if (scenario.helper) {
          this._getTargetWorldPosition(scenario.helper, this._posB);
          if (this._posB.lengthSq() > 0) {
            this._desiredTarget.set(this._posB.x, this._posB.y + 1.25, this._posB.z);
            this._desiredPos.set(this._posB.x + 7.50, this._posB.y + 7.20, this._posB.z + 9.00);
            this._desiredZoom = 1.20;
          }
        }
        break;

      case 'MEETING':
      case 'PRE_CARRY_READY':
      case 'PRE_CARRY_LETS_DO_IT':
        // Shot D: Meeting at driveway beside box (two-actor framing)
        this._desiredTarget.set(9.75, 1.25, -5.60);
        this._desiredPos.set(17.25, 8.45, 3.40);
        this._desiredZoom = 1.30;
        break;

      case 'CARRY_LIFT':
      case 'CARRY_TO_DOOR':
      case 'CARRYING_BOX': {
        // Shot E: Smooth carry follow shot keeping both actors + box centered moving to doorway
        const curZ = scenario.box ? scenario.box.root.position.z : -5.80;
        this._desiredTarget.set(9.75, 1.25, curZ);
        this._desiredPos.set(17.25, 8.45, curZ + 9.00);
        this._desiredZoom = 1.30;
        break;
      }

      case 'ENTER_REQUESTER_HOME':
      case 'PLACE_BOX_INSIDE':
        // Shot F: Frame the House A doorway and interior delivery clearly from ground-level angle
        this._desiredTarget.set(9.75, 1.25, -6.80);
        this._desiredPos.set(16.50, 7.20, 1.20);
        this._desiredZoom = 1.35;
        break;

      case 'EXIT_REQUESTER_HOME':
      case 'THANK_YOU_THAT_IS_IT':
      case 'THANK_YOU_GRATITUDE':
      case 'THANK_YOU_RESPONSE':
      case 'CARRY_DONE':
      case 'HELPER_HAPPY_TO_HELP':
        // Shot G & H: Frame both actors outside in front of House A porch during exit and thank-you
        this._desiredTarget.set(9.75, 1.25, -6.15);
        this._desiredPos.set(17.25, 8.45, 2.85);
        this._desiredZoom = 1.30;
        break;

      case 'REQUESTER_RETURNS_HOME':
      case 'REQUESTER_AT_DOOR':
      case 'REQUESTER_ENTERING_HOME':
        // Shot I: Frame Requester walking up to doorway and entering
        this._desiredTarget.set(9.75, 1.25, -6.50);
        this._desiredPos.set(17.25, 8.45, 2.70);
        this._desiredZoom = 1.28;
        break;

      case 'HELPER_RETURNS_HOME':
      case 'HELPER_AT_DOOR':
      case 'HELPER_ENTERING_HOME':
        // Shot J: Follow Helper walking back along the sidewalk and returning to his doorway
        if (scenario.helper) {
          this._getTargetWorldPosition(scenario.helper, this._posB);
          if (this._posB.lengthSq() > 0) {
            if (this._posB.z <= -9.50) {
              // Frame House B doorway as helper arrives and enters
              this._desiredTarget.set(14.40, 1.30, -10.50);
              this._desiredPos.set(21.90, 8.50, -1.50);
              this._desiredZoom = 1.25;
            } else {
              this._desiredTarget.set(this._posB.x, this._posB.y + 1.25, this._posB.z);
              this._desiredPos.set(this._posB.x + 7.50, this._posB.y + 7.20, this._posB.z + 9.00);
              this._desiredZoom = 1.18;
            }
          }
        }
        break;

      default:
        break;
    }

    const t = 1.0 - Math.exp(-this.lagFactor * delta);
    this.controls.target.lerp(this._desiredTarget, t);
    this.camera.position.lerp(this._desiredPos, t);
    this.camera.lookAt(this.controls.target);
    this.camera.zoom = THREE.MathUtils.lerp(this.camera.zoom, this._desiredZoom, t);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Safely extracts world position from an actor object.
   */
  _getTargetWorldPosition(actor, outVec) {
    if (!actor) {
      outVec.set(0, 0, 0);
      return;
    }
    if (actor.root && typeof actor.root.getWorldPosition === 'function') {
      actor.root.getWorldPosition(outVec);
      return;
    }
    if (actor.position) {
      outVec.copy(actor.position);
      return;
    }
    outVec.set(0, 0, 0);
  }

  /**
   * Dedicated camera director update for Ladder Lending Story.
   *
   * @param {number} delta - Seconds since last frame
   */
  _updateLadderStoryCamera(delta) {
    const scenario = this.activeScenario;
    if (!scenario) return;

    const state = scenario.state;

    if (state === 'FINAL_COMPLETE') {
      if (this.state !== CAMERA_STATES.RETURNING && this.state !== CAMERA_STATES.ESTABLISHING) {
        this.returnToEstablishing(1200);
      }
      return;
    }

    switch (state) {
      case 'BORROWER_ASKS':
        // Shot 1: Borrower at Peach Cottage patio (front three-quarter view with front yard & entrance)
        this._desiredTarget.set(-14.40, 1.25, 10.20);
        this._desiredPos.set(-19.80, 5.40, 5.80);
        this._desiredZoom = 1.28;
        break;

      case 'SYSTEM_COORDINATION':
        // Shot 2: Neighborhood corridor context between Peach Cottage and Building 3
        this._desiredTarget.set(-11.80, 1.30, 2.00);
        this._desiredPos.set(-21.50, 10.50, 6.00);
        this._desiredZoom = 1.15;
        break;

      case 'LENDER_REVEAL':
        // Shot 3: Older neighbor at Building 3 porch (front three-quarter view showing face, cardigan, and ladder)
        this._desiredTarget.set(-9.20, 1.25, -5.80);
        this._desiredPos.set(-12.00, 4.00, -1.00);
        this._desiredZoom = 1.30;
        break;

      case 'BORROWER_WALKS_TO_LENDER':
        // Shot 4: Follow borrower walking across sidewalk and Crosswalk 1
        if (scenario.borrower) {
          this._getTargetWorldPosition(scenario.borrower, this._posA);
          if (this._posA.lengthSq() > 0) {
            this._desiredTarget.set(this._posA.x, this._posA.y + 1.25, this._posA.z);
            this._desiredPos.set(this._posA.x - 7.50, this._posA.y + 7.20, this._posA.z + 7.00);
            this._desiredZoom = 1.18;
          }
        }
        break;

      case 'MEETING':
      case 'BORROWER_THANKS':
      case 'HANDOFF_1':
        // Shot 5: Two-actor framing at Building 3 porch showing borrower, lender, and full ladder
        this._desiredTarget.set(-9.20, 1.20, -5.40);
        this._desiredPos.set(-17.20, 6.20, 0.80);
        this._desiredZoom = 1.28;
        break;

      case 'BORROWER_WALKS_HOME':
        // Shot 6: Follow borrower carrying ladder back across Crosswalk 1
        if (scenario.borrower) {
          this._getTargetWorldPosition(scenario.borrower, this._posA);
          if (this._posA.lengthSq() > 0) {
            this._desiredTarget.set(this._posA.x, this._posA.y + 1.25, this._posA.z);
            this._desiredPos.set(this._posA.x - 7.80, this._posA.y + 7.20, this._posA.z + 7.20);
            this._desiredZoom = 1.18;
          }
        }
        break;

      case 'LADDER_POSITION_AT_WALL':
      case 'LADDER_IN_USE':
      case 'WORK_COMPLETE':
        // Shot 7: Task site at Peach Cottage wall (leaning ladder, borrower working, cottage eaves)
        this._desiredTarget.set(-13.10, 1.35, 10.45);
        this._desiredPos.set(-19.80, 6.80, 16.50);
        this._desiredZoom = 1.28;
        break;

      case 'BORROWER_WALKS_BACK':
        // Shot 8: Follow borrower carrying ladder back to lender
        if (scenario.borrower) {
          this._getTargetWorldPosition(scenario.borrower, this._posA);
          if (this._posA.lengthSq() > 0) {
            this._desiredTarget.set(this._posA.x, this._posA.y + 1.25, this._posA.z);
            this._desiredPos.set(this._posA.x - 7.50, this._posA.y + 7.20, this._posA.z + 7.00);
            this._desiredZoom = 1.18;
          }
        }
        break;

      case 'RETURN_MEETING':
      case 'HANDOFF_2':
        // Shot 9: Return handoff at Building 3 porch
        this._desiredTarget.set(-9.20, 1.20, -5.40);
        this._desiredPos.set(-17.20, 6.20, 0.80);
        this._desiredZoom = 1.28;
        break;

      case 'CHARACTERS_RETURN_HOME':
        // Shot 10: Wider perspective as both characters walk inside their respective homes
        this._desiredTarget.set(-11.80, 1.30, 2.00);
        this._desiredPos.set(-23.00, 11.50, 7.50);
        this._desiredZoom = 1.12;
        break;

      default:
        break;
    }

    const t = 1.0 - Math.exp(-this.lagFactor * delta);
    this.controls.target.lerp(this._desiredTarget, t);
    this.camera.position.lerp(this._desiredPos, t);
    this.camera.lookAt(this.controls.target);
    this.camera.zoom = THREE.MathUtils.lerp(this.camera.zoom, this._desiredZoom, t);
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.returnToEstablishing(0);
    this.followSubject = null;
    this.neighborSubject = null;
    this.activeScenario = null;
    this.camera = null;
    this.controls = null;
  }
}
