import * as THREE from 'three';
import { HouseholdBox } from './boxProp.js';
import { StoryLabel } from './storyLabel.js';

/**
 * carryScenario.js — SAATHI Help Carry Something Cinematic Story
 *
 * Core Value Proposition:
 * A resident needs help moving a heavy household box. A nearby neighbor responds,
 * coordinates, works together to carry the single physical box to the porch, and returns home.
 *
 * Core Choreography:
 * NEED HUMAN HELP -> FIND NEARBY PERSON -> COORDINATE -> WORK TOGETHER -> COMPLETE
 *
 * Canonical Rules:
 * - Exactly TWO active participants: Requester (House A) and Helper (House B).
 * - No house interiors: all action takes place outdoors.
 * - Neither actor leaves the neighborhood map.
 * - Exactly ONE physical box prop throughout the scenario.
 * - Symmetrical, collision-free two-person carrying posture.
 * - Deterministic camera choreography via CameraDirector.
 */

export class CarryScenario {
  /**
   * @param {THREE.Scene} scene
   * @param {DioramaPerson} requester - Resident needing help at House A
   * @param {DioramaPerson} helper - Nearby neighbor responding at House B
   * @param {THREE.Group} buildings
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Camera} camera
   * @param {HTMLElement} container
   * @param {StoryLabel} storyLabel
   */
  constructor(scene, requester, helper, buildings, renderer, camera, container, storyLabel = null) {
    this.scene     = scene;
    this.requester = requester; // House A (Quad 1 Foreground Cat Building)
    this.helper    = helper;    // House B (Quad 4 Rooftop Garden Building)
    this.buildings = buildings;
    this.renderer  = renderer  || null;
    this.camera    = camera    || null;
    this.container = container || null;

    // World-anchored HTML dialog label
    this.storyLabel = storyLabel || (this.container && this.camera ? new StoryLabel(this.container, this.camera) : null);
    this._ownsStoryLabel = !storyLabel;

    // Exactly ONE physical household box prop
    this.box = new HouseholdBox();
    this.scene.add(this.box.root);

    // Canonical Coordinates
    // House A (Requester): Quad4_CornerExhaustBuilding at (9.0, 0, -9.0)
    // House B (Helper):    Quad4_RooftopGardenBuilding at (14.4, 0, -12.8)
    this.posRequesterStart   = new THREE.Vector3( 9.35, 0.16, -5.60); // Outside House A, driveway/path beside box
    this.posBoxStart         = new THREE.Vector3( 9.75, 0.37, -5.60); // Stationary at House A driveway/front path
    this.posMeeting          = new THREE.Vector3(10.15, 0.16, -5.60); // Beside box opposite Requester
    this.posSystemAnnotation = new THREE.Vector3( 9.75, 0.16, -5.60); // Path coordinate for quiet platform coordination annotation

    // Three Distinct Spatial Points for Requester House (House A):
    // Point A. Exterior carry approach (clearance from front wall -6.70)
    this.posRequesterExteriorApproach = new THREE.Vector3( 9.75, 0.16, -6.15);
    // Point B. Doorway / threshold (centered on door opening at x=9.75)
    this.posRequesterDoorwayThreshold = new THREE.Vector3( 9.75, 0.16, -6.70);
    // Point C. Interior box destination (fully inside requester's house on floor)
    this.posRequesterInteriorBoxDest  = new THREE.Vector3( 9.75, 0.37, -7.50);

    // Helper House (House B) Key Points:
    // Helper starts INSIDE his own house!
    this.posHelperInside            = new THREE.Vector3(14.40, 0.16, -11.60); // Inside House B, facing south
    this.posHelperDoorwayThreshold  = new THREE.Vector3(14.40, 0.16, -10.45); // Doorway threshold
    this.posHelperExteriorThreshold = new THREE.Vector3(14.40, 0.16,  -9.80); // Exterior garden path threshold
    this.posHelperStart             = this.posHelperInside;

    // Verified Walkable Neighborhood Routes

    // 1. Helper steps out of House B doorway to exterior garden path
    this.routeHelperExitHome = [
      new THREE.Vector3(14.40, 0.16, -11.60), // Inside House B
      new THREE.Vector3(14.40, 0.16, -10.45), // Doorway threshold
      new THREE.Vector3(14.40, 0.16,  -9.80), // Exterior garden path
    ];

    // 2. Helper walks from House B garden path to Requester at House A
    this.routeHelperToRequester = [
      new THREE.Vector3(14.40, 0.16,  -9.80), // House B exterior threshold
      new THREE.Vector3(14.40, 0.16,  -7.00), // Front stone path
      new THREE.Vector3(14.40, 0.16,  -6.00), // Garden gate opening in fence
      new THREE.Vector3(14.40, 0.16,  -5.00), // North-East sidewalk
      new THREE.Vector3(10.15, 0.16,  -5.00), // Sidewalk west to House A driveway
      new THREE.Vector3(10.15, 0.16,  -5.60), // Turn into driveway beside Box opposite Requester
    ];

    // 3. Requester returns inside her house after thank-you
    this.routeRequesterEnterHome = [
      new THREE.Vector3( 9.40, 0.16, -6.15), // Exterior porch
      new THREE.Vector3( 9.75, 0.16, -6.50), // Front of doorway opening
      new THREE.Vector3( 9.75, 0.16, -7.20), // Inside House A
    ];

    // 4. Helper returns from House A to House B exterior threshold
    this.routeHelperReturnHome = [
      new THREE.Vector3(10.10, 0.16, -6.15), // Exterior porch
      new THREE.Vector3(10.15, 0.16, -5.00), // Walk out of driveway onto sidewalk
      new THREE.Vector3(14.40, 0.16, -5.00), // Sidewalk east to House B garden gate
      new THREE.Vector3(14.40, 0.16, -6.00), // Pass through garden gate
      new THREE.Vector3(14.40, 0.16, -7.00), // Walk up front stone path
      new THREE.Vector3(14.40, 0.16, -9.80), // House B exterior garden path threshold
    ];

    // 5. Helper steps through doorway into House B
    this.routeHelperEnterHome = [
      new THREE.Vector3(14.40, 0.16,  -9.80), // Garden path threshold
      new THREE.Vector3(14.40, 0.16, -10.45), // Doorway threshold
      new THREE.Vector3(14.40, 0.16, -11.60), // Inside House B
    ];

    // State Management
    this.isStoryActive = false;
    this.isPaused = false;
    this.state = 'INITIAL_IDLE';
    this.stateTimer = 0.0;
    this.carryProgress = 0.0;
    this.onBeat = null;

    this._initScene();
  }

  _notifyBeat(text) {
    if (typeof this.onBeat === 'function') {
      this.onBeat(text);
    }
  }

  _initScene() {
    // 1. Requester is outside House A, standing by the box
    if (this.requester) {
      this.requester.walkSpeed = 1.1;
      this.requester.root.position.copy(this.posRequesterStart);
      this.requester.root.rotation.y = Math.PI * 0.5; // Facing east toward box
      this.requester.state = 'IDLE';
      this.requester.route = [];
      this.requester.routeIndex = 0;
      this.requester.setCarryingBox(false);
      this.requester.root.visible = true;
    }

    // 2. Helper starts INSIDE House B
    if (this.helper) {
      this.helper.walkSpeed = 1.85;
      this.helper.root.position.copy(this.posHelperStart);
      this.helper.root.rotation.y = 0; // Facing south toward doorway
      this.helper.state = 'IDLE';
      this.helper.route = [];
      this.helper.routeIndex = 0;
      this.helper.setCarryingBox(false);
      this.helper.root.visible = true;
    }

    // 3. Exactly ONE box stationary on driveway
    if (this.box) {
      this.box.setPosition(this.posBoxStart.x, this.posBoxStart.y, this.posBoxStart.z);
      this.box.setRotationY(0);
      this.box.root.visible = true;
    }

    this.isStoryActive = false;
    this.isPaused = false;
    this.state = 'INITIAL_IDLE';
    this.stateTimer = 0.0;
    this.carryProgress = 0.0;
  }

  /**
   * Starts the "Help carry something" story.
   */
  start() {
    this.reset();
    this.isStoryActive = true;
    this.state = 'REQUESTER_ASKS';
    this.stateTimer = 0.0;

    // Requester looks at the heavy box
    if (this.requester) {
      this.requester.turnTo(Math.PI * 0.15);
      this.requester.root.visible = true;
    }
    if (this.helper) {
      this.helper.root.visible = true;
    }
    if (this.box) {
      this.box.root.visible = true;
    }

    // Canonical Dialogue Beat 1: Requester asks
    if (this.storyLabel && this.requester) {
      this.storyLabel.show('I could use a hand with this.', this.requester, 2.15);
    }
    this._notifyBeat('Ask — I could use a hand with this.');
  }

  /**
   * Resets story to exact initial state.
   */
  reset() {
    this.isStoryActive = false;
    this.isPaused = false;
    this.state = 'INITIAL_IDLE';
    this.stateTimer = 0.0;
    this.carryProgress = 0.0;

    if (this.storyLabel) {
      this.storyLabel.clear();
    }

    if (this.requester) {
      this.requester.root.position.copy(this.posRequesterStart);
      this.requester.root.rotation.y = Math.PI * 0.5;
      this.requester.state = 'IDLE';
      this.requester.route = [];
      this.requester.routeIndex = 0;
      this.requester.setCarryingBox(false);
      this.requester.walkWeight = 0;
      this.requester.root.visible = true;
    }

    if (this.helper) {
      this.helper.root.position.copy(this.posHelperStart);
      this.helper.root.rotation.y = 0;
      this.helper.state = 'IDLE';
      this.helper.route = [];
      this.helper.routeIndex = 0;
      this.helper.setCarryingBox(false);
      this.helper.walkWeight = 0;
      this.helper.root.visible = true;
    }

    if (this.box) {
      this.box.setPosition(this.posBoxStart.x, this.posBoxStart.y, this.posBoxStart.z);
      this.box.setRotationY(0);
      this.box.root.visible = true;
    }

    this._notifyBeat('');
  }

  /**
   * Hides the helper and box when another scenario (e.g. drill) takes over.
   */
  setInactive() {
    this.reset();
    if (this.box) this.box.root.visible = false;
    if (this.helper) this.helper.root.visible = false;
  }

  /**
   * Restores establishing visibility.
   */
  setActive() {
    if (this.box) this.box.root.visible = true;
    if (this.helper) this.helper.root.visible = true;
    if (this.requester) this.requester.root.visible = true;
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  update(delta) {
    if (!this.isStoryActive || this.isPaused || delta <= 0) return;

    this.stateTimer += delta;

    switch (this.state) {
      // -----------------------------------------------------------------------
      // BEAT 1: REQUESTER EXPRESSES NEED
      // -----------------------------------------------------------------------
      case 'REQUESTER_ASKS':
        if (this.stateTimer >= 2.8) {
          this.state = 'SYSTEM_COORDINATION';
          this.stateTimer = 0.0;

          // Beat 2: Quiet editorial system annotation
          if (this.storyLabel) {
            this.storyLabel.show('Nearby help found', this.posSystemAnnotation, 1.8, { isSystem: true });
          }
          this._notifyBeat('Find — Nearby help found');
        }
        break;

      // -----------------------------------------------------------------------
      // BEAT 2: SAATHI COORDINATION
      // -----------------------------------------------------------------------
      case 'SYSTEM_COORDINATION':
        if (this.stateTimer >= 2.2) {
          this.state = 'HELPER_REVEAL';
          this.stateTimer = 0.0;

          // Beat 3: Reveal Helper at House B
          if (this.storyLabel && this.helper) {
            this.storyLabel.show('I can help.', this.helper, 2.15);
          }
          this._notifyBeat('Coordinate — I can help.');
        }
        break;

      // -----------------------------------------------------------------------
      // BEAT 3: REVEAL THE HELPER INSIDE HOUSE B -> HE EXITS HIS HOUSE
      // -----------------------------------------------------------------------
      case 'HELPER_REVEAL':
        if (this.stateTimer >= 2.2) {
          this.state = 'HELPER_EXITING_HOME';
          this.stateTimer = 0.0;

          if (this.storyLabel) {
            this.storyLabel.hide();
          }

          // Helper visibly steps out through the doorway of House B
          if (this.helper) {
            this.helper.walkSpeed = 1.45;
            this.helper.setRoute(this.routeHelperExitHome, false);
          }
          this._notifyBeat('Coordinate — Neighbor stepping outside to help');
        }
        break;

      // -----------------------------------------------------------------------
      // BEAT 3B: HELPER EXITS HOME TO GARDEN PATH
      // -----------------------------------------------------------------------
      case 'HELPER_EXITING_HOME':
        if (this.helper && this.helper.state === 'IDLE') {
          this.state = 'HELPER_TRAVELS_TO_REQUESTER';
          this.stateTimer = 0.0;

          // Helper continues down front path, gate, and sidewalk to House A
          if (this.helper) {
            this.helper.walkSpeed = 1.85;
            this.helper.setRoute(this.routeHelperToRequester, false);
          }
          this._notifyBeat('Coordinate — Neighbor walking over to lend a hand');
        }
        break;

      // -----------------------------------------------------------------------
      // BEAT 4: HELPER WALKS TO REQUESTER ALONG SIDEWALK
      // -----------------------------------------------------------------------
      case 'HELPER_TRAVELS_TO_REQUESTER':
      case 'HELPER_WALKS_TO_REQUESTER':
        if (this.helper && this.helper.state === 'IDLE') {
          // Helper has arrived at meeting point beside the box!
          this.state = 'MEETING';
          this.stateTimer = 0.0;

          // Align actors facing each other across the box
          this.helper.turnTo(-Math.PI * 0.5); // Facing west toward box/requester
          this.requester.turnTo(Math.PI * 0.5); // Facing east toward box/helper

          // Canonical Dialogue Beat 4: Requester says "Thanks for coming."
          if (this.storyLabel && this.requester) {
            this.storyLabel.show('Thanks for coming.', this.requester, 2.15);
          }
          this._notifyBeat('Coordinate — Thanks for coming.');
        }
        break;

      // -----------------------------------------------------------------------
      // BEAT 5: MEETING AT DRIVEWAY BESIDE BOX
      // -----------------------------------------------------------------------
      case 'MEETING':
        if (this.stateTimer >= 2.4) {
          this.state = 'PRE_CARRY_READY';
          this.stateTimer = 0.0;

          // Canonical Dialogue Beat 5: Requester says "Ready?"
          if (this.storyLabel && this.requester) {
            this.storyLabel.show('Ready?', this.requester, 2.15);
          }
          this._notifyBeat('Coordinate — Ready?');
        }
        break;

      // -----------------------------------------------------------------------
      // BEAT 6: PRE-CARRY COORDINATION — "Ready?"
      // -----------------------------------------------------------------------
      case 'PRE_CARRY_READY':
        if (this.stateTimer >= 2.0) {
          this.state = 'PRE_CARRY_LETS_DO_IT';
          this.stateTimer = 0.0;

          // Canonical Dialogue Beat 6: Helper says "Let's do it."
          if (this.storyLabel && this.helper) {
            this.storyLabel.show("Let's do it.", this.helper, 2.15);
          }
          this._notifyBeat("Coordinate — Let's do it.");
        }
        break;

      // -----------------------------------------------------------------------
      // BEAT 7: PRE-CARRY COORDINATION — "Let's do it."
      // -----------------------------------------------------------------------
      case 'PRE_CARRY_LETS_DO_IT':
        if (this.stateTimer >= 2.0) {
          this.state = 'CARRY_LIFT';
          this.stateTimer = 0.0;

          if (this.storyLabel) {
            this.storyLabel.hide();
          }

          // Both adopt two-handed box carrying pose
          if (this.requester) this.requester.setCarryingBox(true);
          if (this.helper) this.helper.setCarryingBox(true);

          // Face forward along carrying path (North toward doorway, -Z direction)
          if (this.requester) this.requester.turnTo(Math.PI);
          if (this.helper) this.helper.turnTo(Math.PI);

          this._notifyBeat('Work together — Lifting household box together');
        }
        break;

      // -----------------------------------------------------------------------
      // CARRY LIFT: Smooth vertical lift off ground
      // -----------------------------------------------------------------------
      case 'CARRY_LIFT': {
        const liftDuration = 0.70;
        const progress = Math.min(1.0, this.stateTimer / liftDuration);
        const curY = THREE.MathUtils.lerp(this.box.groundY, this.box.carryY, progress);
        this.box.setPosition(this.posBoxStart.x, curY, this.posBoxStart.z);

        if (progress >= 1.0) {
          this.state = 'CARRY_TO_DOOR';
          this.stateTimer = 0.0;
          this.carryProgress = 0.0;
          this._notifyBeat('Work together — Carrying box toward requester house');
        }
        break;
      }

      // -----------------------------------------------------------------------
      // CARRY TO DOOR: Outdoor carry from driveway to exterior doorway approach
      // -----------------------------------------------------------------------
      case 'CARRY_TO_DOOR': {
        const carryDuration = 2.4;
        this.carryProgress = Math.min(1.0, this.stateTimer / carryDuration);
        const t = this.carryProgress;
        const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        const startZ = this.posBoxStart.z; // -5.60
        const endZ = this.posRequesterExteriorApproach.z; // -6.15
        const curZ = THREE.MathUtils.lerp(startZ, endZ, easeT);

        const curReqX = THREE.MathUtils.lerp(this.posRequesterStart.x, 9.42, easeT);
        const curHelpX = THREE.MathUtils.lerp(this.posMeeting.x, 10.08, easeT);

        if (this.requester) {
          this.requester.root.position.set(curReqX, 0.16, curZ);
          this.requester.walkWeight = Math.sin(easeT * Math.PI) * 0.9;
          this.requester.walkCycle = (this.requester.walkCycle + delta * 3.8) % (Math.PI * 2);
          this.requester.root.rotation.y = Math.PI;
        }

        if (this.helper) {
          this.helper.root.position.set(curHelpX, 0.16, curZ);
          this.helper.walkWeight = Math.sin(easeT * Math.PI) * 0.9;
          this.helper.walkCycle = (this.helper.walkCycle + delta * 3.8) % (Math.PI * 2);
          this.helper.root.rotation.y = Math.PI;
        }

        const boxBob = Math.sin(this.requester.walkCycle * 2) * 0.015;
        this.box.setPosition(9.75, this.box.carryY + boxBob, curZ);

        if (this.carryProgress >= 1.0) {
          this.state = 'ENTER_REQUESTER_HOME';
          this.stateTimer = 0.0;
          this.carryProgress = 0.0;
          this._notifyBeat('Work together — Carrying box inside through doorway');
        }
        break;
      }

      // -----------------------------------------------------------------------
      // ENTER REQUESTER HOME: Carry box together THROUGH doorway into interior
      // -----------------------------------------------------------------------
      case 'ENTER_REQUESTER_HOME': {
        const enterDuration = 2.6;
        this.carryProgress = Math.min(1.0, this.stateTimer / enterDuration);
        const t = this.carryProgress;
        const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        const startZ = this.posRequesterExteriorApproach.z; // -6.15
        const endZ = this.posRequesterInteriorBoxDest.z; // -7.50
        const curZ = THREE.MathUtils.lerp(startZ, endZ, easeT);

        if (this.requester) {
          this.requester.root.position.set(9.42, 0.16, curZ);
          this.requester.walkWeight = 0.85;
          this.requester.walkCycle = (this.requester.walkCycle + delta * 3.8) % (Math.PI * 2);
          this.requester.root.rotation.y = Math.PI;
        }

        if (this.helper) {
          this.helper.root.position.set(10.08, 0.16, curZ);
          this.helper.walkWeight = 0.85;
          this.helper.walkCycle = (this.helper.walkCycle + delta * 3.8) % (Math.PI * 2);
          this.helper.root.rotation.y = Math.PI;
        }

        const boxBob = Math.sin(this.requester.walkCycle * 2) * 0.015;
        this.box.setPosition(9.75, this.box.carryY + boxBob, curZ);

        if (this.carryProgress >= 1.0) {
          this.state = 'PLACE_BOX_INSIDE';
          this.stateTimer = 0.0;

          if (this.requester) this.requester.walkWeight = 0;
          if (this.helper) this.helper.walkWeight = 0;
        }
        break;
      }

      // -----------------------------------------------------------------------
      // PLACE BOX INSIDE: Lower box smoothly onto interior floor
      // -----------------------------------------------------------------------
      case 'PLACE_BOX_INSIDE': {
        const placeDuration = 0.70;
        const progress = Math.min(1.0, this.stateTimer / placeDuration);
        const curY = THREE.MathUtils.lerp(this.box.carryY, this.box.groundY, progress);
        this.box.setPosition(this.posRequesterInteriorBoxDest.x, curY, this.posRequesterInteriorBoxDest.z);

        if (progress >= 1.0) {
          this.state = 'EXIT_REQUESTER_HOME';
          this.stateTimer = 0.0;
          this.carryProgress = 0.0;

          // Both release the box
          if (this.requester) {
            this.requester.setCarryingBox(false);
            this.requester.turnTo(0); // Turn south toward doorway
          }
          if (this.helper) {
            this.helper.setCarryingBox(false);
            this.helper.turnTo(0); // Turn south toward doorway
          }

          this._notifyBeat('Work together — Box delivered inside; both returning outside');
        }
        break;
      }

      // -----------------------------------------------------------------------
      // EXIT REQUESTER HOME: Both walk back OUT through doorway onto porch
      // -----------------------------------------------------------------------
      case 'EXIT_REQUESTER_HOME': {
        const exitDuration = 2.4;
        this.carryProgress = Math.min(1.0, this.stateTimer / exitDuration);
        const t = this.carryProgress;
        const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        const startZ = this.posRequesterInteriorBoxDest.z; // -7.50
        const endZ = this.posRequesterExteriorApproach.z; // -6.15
        const curZ = THREE.MathUtils.lerp(startZ, endZ, easeT);

        // Both walk forward toward the doorway and emerge onto the porch
        if (this.requester) {
          this.requester.root.position.set(9.40, 0.16, curZ);
          this.requester.walkWeight = Math.sin(easeT * Math.PI) * 0.85;
          this.requester.walkCycle = (this.requester.walkCycle + delta * 3.8) % (Math.PI * 2);
          this.requester.root.rotation.y = 0;
        }

        if (this.helper) {
          this.helper.root.position.set(10.10, 0.16, curZ);
          this.helper.walkWeight = Math.sin(easeT * Math.PI) * 0.85;
          this.helper.walkCycle = (this.helper.walkCycle + delta * 3.8) % (Math.PI * 2);
          this.helper.root.rotation.y = 0;
        }

        if (this.carryProgress >= 1.0) {
          this.state = 'THANK_YOU_THAT_IS_IT';
          this.stateTimer = 0.0;

          if (this.requester) {
            this.requester.walkWeight = 0;
            this.requester.turnTo(Math.PI * 0.5); // Face helper
          }
          if (this.helper) {
            this.helper.walkWeight = 0;
            this.helper.turnTo(-Math.PI * 0.5); // Face requester
          }

          // Canonical Dialogue Beat 8: Requester says "That's it."
          if (this.storyLabel && this.requester) {
            this.storyLabel.show("That's it.", this.requester, 2.0);
          }
          this._notifyBeat("Complete — That's it.");
        }
        break;
      }

      // -----------------------------------------------------------------------
      // BEAT 8: OUTSIDE THANK YOU — "That's it."
      // -----------------------------------------------------------------------
      case 'THANK_YOU_THAT_IS_IT':
      case 'CARRY_DONE':
        if (this.stateTimer >= 2.0) {
          this.state = 'THANK_YOU_GRATITUDE';
          this.stateTimer = 0.0;

          // Canonical Dialogue Beat 8B: Requester says "Thank you."
          if (this.storyLabel && this.requester) {
            this.storyLabel.show('Thank you.', this.requester, 2.0);
          }
          this._notifyBeat('Complete — Thank you.');
        }
        break;

      // -----------------------------------------------------------------------
      // BEAT 8B: OUTSIDE THANK YOU — "Thank you."
      // -----------------------------------------------------------------------
      case 'THANK_YOU_GRATITUDE':
        if (this.stateTimer >= 2.0) {
          this.state = 'THANK_YOU_RESPONSE';
          this.stateTimer = 0.0;

          // Canonical Dialogue Beat 9: Helper says "Happy to help."
          if (this.storyLabel && this.helper) {
            this.storyLabel.show('Happy to help.', this.helper, 2.15);
          }
          this._notifyBeat('Complete — Happy to help.');
        }
        break;

      // -----------------------------------------------------------------------
      // BEAT 9: HELPER RESPONSE — "Happy to help."
      // -----------------------------------------------------------------------
      case 'THANK_YOU_RESPONSE':
      case 'HELPER_HAPPY_TO_HELP':
        if (this.stateTimer >= 2.2) {
          this.state = 'REQUESTER_RETURNS_HOME';
          this.stateTimer = 0.0;

          if (this.storyLabel) {
            this.storyLabel.hide();
          }

          // Requester turns toward her doorway opening (North, Math.PI)
          if (this.requester) {
            this.requester.walkSpeed = 1.15;
            this.requester.setRoute(this.routeRequesterEnterHome, false);
          }
          this._notifyBeat('Complete — Requester returning inside');
        }
        break;

      // -----------------------------------------------------------------------
      // BEAT 10: REQUESTER RETURNS INSIDE HER HOUSE
      // -----------------------------------------------------------------------
      case 'REQUESTER_RETURNS_HOME':
      case 'REQUESTER_ENTERING_HOME':
        if (this.requester) {
          if (this.requester.root.position.z <= -6.70) {
            this.requester.root.visible = false;
          }
          if (this.requester.state === 'IDLE' || this.stateTimer >= 1.6) {
            this.requester.root.visible = false;
            this.requester.state = 'IDLE';
            this.requester.walkWeight = 0;

            // Now Helper walks back to his own house
            this.state = 'HELPER_RETURNS_HOME';
            this.stateTimer = 0.0;

            if (this.helper) {
              this.helper.walkSpeed = 1.75;
              this.helper.setRoute(this.routeHelperReturnHome, false);
            }
            this._notifyBeat('Complete — Neighbor walking back home');
          }
        }
        break;

      // -----------------------------------------------------------------------
      // BEAT 11: HELPER WALKS BACK TO HOUSE B ALONG SIDEWALK
      // -----------------------------------------------------------------------
      case 'HELPER_RETURNS_HOME':
        if (this.helper && this.helper.state === 'IDLE') {
          this.state = 'HELPER_AT_DOOR';
          this.stateTimer = 0.0;

          // Helper faces doorway (North, Math.PI)
          this.helper.turnTo(Math.PI);
        }
        break;

      // -----------------------------------------------------------------------
      // BEAT 12: HELPER AT DOOR -> STEPS THROUGH DOORWAY INTO HIS HOUSE
      // -----------------------------------------------------------------------
      case 'HELPER_AT_DOOR':
        if (this.stateTimer >= 0.35) {
          this.state = 'HELPER_ENTERING_HOME';
          this.stateTimer = 0.0;

          if (this.helper) {
            this.helper.walkSpeed = 1.15;
            this.helper.setRoute(this.routeHelperEnterHome, false);
          }
        }
        break;

      // -----------------------------------------------------------------------
      // BEAT 13: HELPER ENTERS HOME & OCCLUDES / BECOMES HIDDEN
      // -----------------------------------------------------------------------
      case 'HELPER_ENTERING_HOME':
        if (this.helper) {
          if (this.helper.root.position.z <= -10.50) {
            this.helper.root.visible = false;
          }
          if (this.helper.state === 'IDLE' || this.stateTimer >= 1.6) {
            this.helper.root.visible = false;
            this.helper.state = 'IDLE';
            this.helper.walkWeight = 0;

            this.state = 'FINAL_COMPLETE';
            this.stateTimer = 0.0;
            this.isStoryActive = false;

            if (this.storyLabel) {
              this.storyLabel.clear();
            }

            this._notifyBeat('Complete — Coordinated task finished.');
          }
        }
        break;

      case 'FINAL_COMPLETE':
        // Both characters remain safely inside their homes (root.visible = false)
        // Box remains inside requester's house on the interior floor (posRequesterInteriorBoxDest)
        break;
    }
  }

  dispose() {
    if (this._ownsStoryLabel && this.storyLabel && this.storyLabel.dispose) {
      this.storyLabel.dispose();
    }
    if (this.box) {
      this.scene.remove(this.box.root);
      this.box.dispose();
    }
  }
}
