import * as THREE from 'three';
import { BorrowableLadder } from './ladderProp.js';
import { StoryLabel } from './storyLabel.js';

/**
 * ladderScenario.js — SAATHI Borrow a Ladder Cinematic Story
 *
 * Core Value Proposition:
 * A neighbor needs a ladder to clean their cottage eaves/gutters.
 * SAATHI matches them with a nearby older neighbor who owns one.
 * The borrower travels to the older neighbor, physically receives the ladder,
 * carries that SAME ladder home, sets it against the cottage wall, completes the task,
 * carries the SAME ladder back, returns it with gratitude, and both neighbors return home.
 *
 * Story Narrative Flow:
 * REQUEST ("I need a ladder.")
 *   ↓
 * NEARBY MATCH ("Nearby match found")
 *   ↓
 * LENDER FOUND ("I have a ladder.")
 *   ↓
 * BORROWER TRAVELS TO LENDER
 *   ↓
 * LENDER OFFERS LADDER ("I can lend you mine.")
 *   ↓
 * BORROWER THANKS LENDER ("Thank you." → "I'll return it.")
 *   ↓
 * PHYSICAL LADDER HANDOFF #1 (Lender → Borrower)
 *   ↓
 * BORROWER TAKES LADDER HOME (Visibly carried across Crosswalk 1)
 *   ↓
 * SETS LADDER AGAINST COTTAGE WALL
 *   ↓
 * USES LADDER ("Cleaning the cottage gutters!")
 *   ↓
 * WORK COMPLETE ("Done." → "I'll return this.")
 *   ↓
 * BORROWER RETURNS TO LENDER (Carries same ladder back)
 *   ↓
 * SECOND PHYSICAL HANDOFF #2 (Borrower → Lender, "Here it is." → "Thanks.")
 *   ↓
 * BOTH NEIGHBORS RETURN HOME (Inside their respective houses)
 *   ↓
 * FINAL ESTABLISHING VIEW
 */

export class LadderScenario {
  /**
   * @param {THREE.Scene} scene
   * @param {DioramaPerson} borrower - Resident at Peach Cottage (House 2B)
   * @param {DioramaPerson} lender - Older neighbor at Building 3 (Market Building)
   * @param {THREE.Group} buildings
   * @param {TrafficSystem} [trafficSystem]
   * @param {THREE.WebGLRenderer} [renderer]
   * @param {THREE.Camera} [camera]
   * @param {HTMLElement} [container]
   * @param {StoryLabel} [storyLabel]
   */
  constructor(
    scene,
    borrower,
    lender,
    buildings,
    trafficSystem = null,
    renderer = null,
    camera = null,
    container = null,
    storyLabel = null
  ) {
    this.scene = scene;
    this.borrower = borrower; // House 2B: Peach Cottage (-14.40, 0.16, 13.00)
    this.lender = lender;     // Quad 3: Rear Anchor Market Building (-9.20, 0.16, -9.20)
    this.resident = this.borrower; // Compatibility alias
    this.neighbor = this.lender;   // Compatibility alias
    this.buildings = buildings;
    this.trafficSystem = trafficSystem;
    this.renderer = renderer;
    this.camera = camera;
    this.container = container;

    // World-anchored HTML dialog label
    this.storyLabel = storyLabel || (this.container && this.camera ? new StoryLabel(this.container, this.camera) : null);
    this._ownsStoryLabel = !storyLabel;

    // Exactly ONE authoritative physical ladder prop
    this.ladder = new BorrowableLadder();
    this.ladder.owner = 'NEIGHBOR';
    this.ladder.root.visible = false;
    this.scene.add(this.ladder.root);

    // Carry and Placement Transforms
    // Under-arm/hip carry transform: firmly gripped by right hand on inner rail
    this.ladderCarryLocalPos = new THREE.Vector3(-0.055, -0.041, 0.001);
    this.ladderCarryLocalRot = new THREE.Euler(1.311, -0.009, 0.220);

    // Freestanding / leaning in-use transform at Peach Cottage:
    // Grounded at Y = 0.16m, leaning at 76.4° against cottage rear wall at Z = 10.80m
    this.ladderUseWorldPos = new THREE.Vector3(-13.03, 0.948, 10.61);
    this.ladderUseWorldRot = new THREE.Euler(-1.334, 0, 0);

    // Temporary handoff calculations
    this.tempHandPos = new THREE.Vector3();
    this.tempHandQuat = new THREE.Quaternion();
    this.tempOffset = new THREE.Vector3();

    // Canonical Waypoint Positions
    // Peach Cottage (House 2B, Borrower):
    this.posBorrowerInside     = new THREE.Vector3(-14.40, 0.16, 11.80); // Inside cottage doorway
    this.posBorrowerPatio      = new THREE.Vector3(-14.40, 0.16, 10.20); // Front garden patio
    this.posBorrowerGardenPath = new THREE.Vector3(-14.40, 0.16,  7.50); // Inside garden path
    this.posBorrowerGate       = new THREE.Vector3(-14.40, 0.16,  6.00); // Gate 2 opening
    this.posBorrowerSidewalk   = new THREE.Vector3(-14.40, 0.16,  4.40); // Sidewalk outside Gate 2
    this.posBorrowerTaskSite   = new THREE.Vector3(-13.20, 0.16, 10.22); // Task site facing ladder

    // Building 3 (Older Neighbor, Lender):
    this.posLenderInside       = new THREE.Vector3( -9.20, 0.16, -8.20); // Inside Building 3
    this.posLenderDoorway      = new THREE.Vector3( -9.20, 0.16, -6.60); // Doorway threshold
    this.posLenderPorch        = new THREE.Vector3( -9.20, 0.16, -5.80); // Front porch meeting point
    this.posBorrowerAtPorch    = new THREE.Vector3( -9.20, 0.16, -4.95); // Meeting point facing lender
    this.posSystemAnnotation   = new THREE.Vector3(-11.80, 0.16,  3.00); // World annotation coordinate

    // Verified Collision-Free Walkable Neighborhood Routes

    // 1. Borrower travels from Peach Cottage to Lender at Building 3
    this.routeBorrowerToLender = [
      new THREE.Vector3(-14.40, 0.16, 10.20), // Garden patio
      new THREE.Vector3(-14.40, 0.16,  7.50), // Garden path
      new THREE.Vector3(-14.40, 0.16,  6.00), // Gate 2 opening
      new THREE.Vector3(-14.40, 0.16,  4.40), // SW sidewalk
      new THREE.Vector3( -4.80, 0.16,  4.40), // South side of Crosswalk 1
      new THREE.Vector3( -4.80, 0.16, -4.40), // North side of Crosswalk 1 (traffic yields)
      new THREE.Vector3( -9.20, 0.16, -4.40), // NW sidewalk outside Building 3
      new THREE.Vector3( -9.20, 0.16, -4.95), // Arrive on Building 3 porch facing Lender
    ];

    // 2. Lender steps out onto Building 3 porch holding ladder
    this.routeLenderStepOut = [
      new THREE.Vector3(-9.20, 0.16, -8.20), // Inside home
      new THREE.Vector3(-9.20, 0.16, -6.60), // Doorway threshold
      new THREE.Vector3(-9.20, 0.16, -5.80), // Porch meeting spot
    ];

    // 3. Borrower carries ladder home to Peach Cottage task site
    this.routeBorrowerHomeWithLadder = [
      new THREE.Vector3( -9.20, 0.16, -4.95), // Building 3 porch
      new THREE.Vector3( -9.20, 0.16, -4.40), // NW sidewalk
      new THREE.Vector3( -4.80, 0.16, -4.40), // North side of Crosswalk 1
      new THREE.Vector3( -4.80, 0.16,  4.40), // South side of Crosswalk 1
      new THREE.Vector3(-14.40, 0.16,  4.40), // SW sidewalk
      new THREE.Vector3(-14.40, 0.16,  6.00), // Gate 2 entrance
      new THREE.Vector3(-14.40, 0.16,  7.50), // Garden path
      new THREE.Vector3(-13.20, 0.16, 10.22), // Task site in front of ladder placement
    ];

    // 4. Borrower carries ladder back to Building 3 to return it
    this.routeBorrowerReturnToLender = [
      new THREE.Vector3(-13.20, 0.16, 10.22), // Task site
      new THREE.Vector3(-14.40, 0.16,  7.50), // Garden path
      new THREE.Vector3(-14.40, 0.16,  6.00), // Gate 2
      new THREE.Vector3(-14.40, 0.16,  4.40), // SW sidewalk
      new THREE.Vector3( -4.80, 0.16,  4.40), // South Crosswalk 1
      new THREE.Vector3( -4.80, 0.16, -4.40), // North Crosswalk 1
      new THREE.Vector3( -9.20, 0.16, -4.40), // NW sidewalk
      new THREE.Vector3( -9.20, 0.16, -4.95), // Building 3 porch
    ];

    // 5. Lender walks back inside Building 3
    this.routeLenderReturnInside = [
      new THREE.Vector3(-9.20, 0.16, -5.80), // Porch
      new THREE.Vector3(-9.20, 0.16, -6.60), // Doorway threshold
      new THREE.Vector3(-9.20, 0.16, -8.20), // Inside home
    ];

    // 6. Borrower walks back inside Peach Cottage
    this.routeBorrowerReturnInside = [
      new THREE.Vector3( -9.20, 0.16, -4.95), // Building 3 porch
      new THREE.Vector3( -9.20, 0.16, -4.40), // NW sidewalk
      new THREE.Vector3( -4.80, 0.16, -4.40), // North crosswalk
      new THREE.Vector3( -4.80, 0.16,  4.40), // South crosswalk
      new THREE.Vector3(-14.40, 0.16,  4.40), // SW sidewalk
      new THREE.Vector3(-14.40, 0.16,  6.00), // Gate 2
      new THREE.Vector3(-14.40, 0.16,  7.50), // Garden path
      new THREE.Vector3(-14.40, 0.16, 10.20), // Patio
      new THREE.Vector3(-14.40, 0.16, 11.80), // Inside cottage
    ];

    // State Machine
    this.state = 'IDLE';
    this.stateTimer = 0;
    this.isStoryActive = false;
    this.isPaused = false;
    this.onBeat = null; // Callback: (beatText) => void

    console.log('[LadderScenario] Initialized');
    this.reset();
  }

  /**
   * Resets all characters, ladder, and labels to pristine initial state.
   */
  reset() {
    this.state = 'IDLE';
    this.stateTimer = 0;
    this.isStoryActive = false;
    this.isPaused = false;

    if (this.storyLabel) {
      this.storyLabel.hide();
    }

    // Reset Borrower (House 2B)
    if (this.borrower) {
      this.borrower.setRoute([this.posBorrowerInside]);
      this.borrower.root.position.copy(this.posBorrowerInside);
      this.borrower.root.rotation.set(0, 0, 0); // Facing south toward garden
      this.borrower.targetRotationY = 0;
      this.borrower.state = 'IDLE';
      this.borrower.setCarryingLadder(false);
      this.borrower.setWorkingOnTask(false);
      this.borrower.reachAmount = 0.0;
      this.borrower.root.visible = false;
    }

    // Reset Lender (Older Neighbor, Building 3)
    if (this.lender) {
      this.lender.setRoute([this.posLenderInside]);
      this.lender.root.position.copy(this.posLenderInside);
      this.lender.root.rotation.set(0, 0, 0); // Facing south toward street
      this.lender.targetRotationY = 0;
      this.lender.state = 'IDLE';
      this.lender.setCarryingLadder(false);
      this.lender.setWorkingOnTask(false);
      this.lender.reachAmount = 0.0;
      this.lender.root.visible = false;
      if (this.lender.walkingCane) {
        this.lender.walkingCane.visible = true;
      }
    }

    // Reset Ladder
    if (this.ladder) {
      this.ladder.owner = 'NEIGHBOR';
      this.ladder.root.visible = false;
      if (this.lender && this.lender.rightHandGroup) {
        this.ladder.attachTo(this.lender.rightHandGroup, this.ladderCarryLocalPos, this.ladderCarryLocalRot);
      } else {
        this.ladder.attachTo(this.scene, this.posLenderPorch);
      }
    }

    this._subLine1Shown = false;
    this._handoff1Done = false;
    this._handoff2Done = false;
  }

  /**
   * Starts the ladder borrowing cinematic story from the beginning.
   */
  start() {
    this.reset();
    this.isStoryActive = true;
    this._setState('BORROWER_ASKS');
  }

  cancel() {
    this.reset();
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  _setState(newState) {
    this.state = newState;
    this.stateTimer = 0;
    this._subLine1Shown = false;

    switch (newState) {
      case 'BORROWER_ASKS': {
        console.log('[LadderScenario] State: BORROWER_ASKS');
        // Borrower appears on patio of Peach Cottage
        this.borrower.root.visible = true;
        this.borrower.root.position.copy(this.posBorrowerPatio);
        this.borrower.root.rotation.set(0, 0, 0); // Facing south
        this.borrower.targetRotationY = 0;
        this.borrower.state = 'IDLE';
        this.borrower.setCarryingLadder(false);

        // Lender begins inside Building 3
        this.lender.root.visible = false;
        this.lender.root.position.copy(this.posLenderInside);
        this.ladder.owner = 'NEIGHBOR';
        this.ladder.root.visible = false;

        this._emitBeat('Ask — A resident needs a ladder.');
        if (this.storyLabel) {
          this.storyLabel.showDialog(this.borrower.root, 'I need a ladder.');
        }
        break;
      }

      case 'SYSTEM_COORDINATION': {
        this._emitBeat('Coordinate — SAATHI identifies a nearby match.');
        if (this.storyLabel) {
          this.storyLabel.showSystemAnnotation(this.posSystemAnnotation, 'Nearby match found.');
        }
        break;
      }

      case 'LENDER_REVEAL': {
        // Older neighbor appears at Building 3, holding ladder
        this.lender.root.visible = true;
        this.lender.root.position.copy(this.posLenderInside);
        this.ladder.root.visible = true;
        this.ladder.attachTo(this.lender.rightHandGroup, this.ladderCarryLocalPos, this.ladderCarryLocalRot);
        this.lender.setCarryingLadder(true);
        if (this.lender.walkingCane) {
          this.lender.walkingCane.visible = false;
        }

        // Lender steps out to porch
        this.lender.setRoute(this.routeLenderStepOut);
        this.lender.targetRotationY = 0; // Face south

        this._emitBeat('Match — An older neighbor has one.');
        if (this.storyLabel) {
          this.storyLabel.showDialog(this.lender.root, 'I have a ladder.');
        }
        break;
      }

      case 'BORROWER_WALKS_TO_LENDER': {
        this._emitBeat('Travel — Borrower travels to lender.');
        if (this.storyLabel) {
          this.storyLabel.hide();
        }
        this.borrower.setRoute(this.routeBorrowerToLender);
        break;
      }

      case 'MEETING': {
        // Both characters face each other at Building 3 porch
        this.borrower.root.position.copy(this.posBorrowerAtPorch);
        this.borrower.root.rotation.set(0, Math.PI, 0); // Face north towards lender
        this.borrower.targetRotationY = Math.PI;
        this.borrower.state = 'IDLE';

        this.lender.root.position.copy(this.posLenderPorch);
        this.lender.root.rotation.set(0, 0, 0); // Face south towards borrower
        this.lender.targetRotationY = 0;
        this.lender.state = 'IDLE';

        this._emitBeat('Offer — Lender offers to lend the ladder.');
        if (this.storyLabel) {
          this.storyLabel.showDialog(this.borrower.root, 'Thank you.');
        }
        break;
      }

      case 'BORROWER_THANKS': {
        this._emitBeat('Gratitude — Borrower thanks the lender.');
        if (this.storyLabel) {
          this.storyLabel.showDialog(this.lender.root, 'Of course.');
        }
        break;
      }

      case 'HANDOFF_1': {
        this._emitBeat('Handoff — Physical ladder transfers to borrower.');
        // Lender reaches forward offering ladder
        this.lender.reachAmount = 1.0;
        this._handoff1Done = false;
        break;
      }

      case 'BORROWER_WALKS_HOME': {
        this._emitBeat('Carry — Borrower carries ladder home.');
        if (this.storyLabel) {
          this.storyLabel.hide();
        }
        this.borrower.setRoute(this.routeBorrowerHomeWithLadder);
        break;
      }

      case 'LADDER_POSITION_AT_WALL': {
        this._emitBeat('Setup — Positioning ladder against cottage wall.');
        // Re-parent ladder to scene leaning against Peach Cottage rear wall
        this.borrower.setCarryingLadder(false);
        this.borrower.root.position.copy(this.posBorrowerTaskSite);
        this.borrower.root.rotation.set(0, Math.PI, 0); // Face north toward wall
        this.borrower.targetRotationY = Math.PI;
        this.borrower.state = 'IDLE';

        this.ladder.attachTo(this.scene, this.ladderUseWorldPos, this.ladderUseWorldRot);
        this.ladder.root.visible = true;
        break;
      }

      case 'LADDER_IN_USE': {
        this._emitBeat('Work — Cleaning the cottage gutters.');
        this.borrower.setWorkingOnTask(true);
        if (this.storyLabel) {
          this.storyLabel.showDialog(this.borrower.root, 'Time to clean these gutters.');
        }
        break;
      }

      case 'WORK_COMPLETE': {
        this._emitBeat('Complete — Task finished, preparing return.');
        this.borrower.setWorkingOnTask(false);
        if (this.storyLabel) {
          this.storyLabel.showDialog(this.borrower.root, 'Done.');
        }
        break;
      }

      case 'BORROWER_WALKS_BACK': {
        this._emitBeat('Return — Borrower carries ladder back to lender.');
        if (this.storyLabel) {
          this.storyLabel.hide();
        }
        // Pick up the SAME ladder back into under-arm carry pose
        this.ladder.attachTo(this.borrower.rightHandGroup, this.ladderCarryLocalPos, this.ladderCarryLocalRot);
        this.borrower.setCarryingLadder(true);
        this.borrower.setRoute(this.routeBorrowerReturnToLender);
        break;
      }

      case 'RETURN_MEETING': {
        // Both characters face each other at Building 3 porch
        this.borrower.root.position.copy(this.posBorrowerAtPorch);
        this.borrower.root.rotation.set(0, Math.PI, 0);
        this.borrower.targetRotationY = Math.PI;
        this.borrower.state = 'IDLE';

        this.lender.root.position.copy(this.posLenderPorch);
        this.lender.root.rotation.set(0, 0, 0);
        this.lender.targetRotationY = 0;
        this.lender.state = 'IDLE';

        this._emitBeat('Return — Ladder returned to owner.');
        if (this.storyLabel) {
          this.storyLabel.showDialog(this.borrower.root, 'Here you go.');
        }
        break;
      }

      case 'HANDOFF_2': {
        this._emitBeat('Handoff — Lender receives ladder back.');
        this.borrower.reachAmount = 1.0;
        this._handoff2Done = false;
        break;
      }

      case 'CHARACTERS_RETURN_HOME': {
        this._emitBeat('Return Home — Neighbors return to their homes.');
        if (this.storyLabel) {
          this.storyLabel.hide();
        }

        // Lender returns inside Building 3 carrying ladder
        this.lender.setRoute(this.routeLenderReturnInside);

        // Borrower returns inside Peach Cottage
        this.borrower.setRoute(this.routeBorrowerReturnInside);
        break;
      }

      case 'FINAL_COMPLETE': {
        this._emitBeat('');
        this.isStoryActive = false;
        if (this.storyLabel) {
          this.storyLabel.clear();
        }
        if (this.cameraDirector) {
          this.cameraDirector.returnToEstablishing();
        }
        // Both characters remain inside their homes
        this.borrower.root.visible = false;
        this.lender.root.visible = false;
        this.ladder.root.visible = false;
        break;
      }

      default:
        break;
    }
  }

  update(delta) {
    if (!this.isStoryActive || this.isPaused || !delta) return;

    this.stateTimer += delta;

    switch (this.state) {
      case 'BORROWER_ASKS':
        if (this.stateTimer >= 2.6) {
          this._setState('SYSTEM_COORDINATION');
        }
        break;

      case 'SYSTEM_COORDINATION':
        if (this.stateTimer >= 2.2) {
          this._setState('LENDER_REVEAL');
        }
        break;

      case 'LENDER_REVEAL':
        if (this.stateTimer >= 1.4 && !this._subLine1Shown) {
          this._subLine1Shown = true;
          if (this.storyLabel) {
            this.storyLabel.showDialog(this.lender.root, 'You can use mine.');
          }
        }
        if (this.stateTimer >= 2.8) {
          this._setState('BORROWER_WALKS_TO_LENDER');
        }
        break;

      case 'BORROWER_WALKS_TO_LENDER':
        // Wait until borrower walks across neighborhood to Building 3 porch
        if (this.borrower.state === 'IDLE' && this.borrower.root.position.distanceTo(this.posBorrowerAtPorch) < 0.25) {
          this._setState('MEETING');
        }
        break;

      case 'MEETING':
        if (this.stateTimer >= 1.4) {
          this._setState('BORROWER_THANKS');
        }
        break;

      case 'BORROWER_THANKS':
        if (this.stateTimer >= 1.4) {
          this._setState('HANDOFF_1');
        }
        break;

      case 'HANDOFF_1':
        if (this.stateTimer >= 1.0 && !this._handoff1Done) {
          this._handoff1Done = true;
          // Ownership changes from Lender to Borrower
          this.ladder.owner = 'RESIDENT';
          this.ladder.attachTo(this.borrower.rightHandGroup, this.ladderCarryLocalPos, this.ladderCarryLocalRot);
          this.borrower.setCarryingLadder(true);

          this.lender.setCarryingLadder(false);
          this.lender.reachAmount = 0.0;
          if (this.lender.walkingCane) {
            this.lender.walkingCane.visible = true;
          }

          if (this.storyLabel) {
            this.storyLabel.showDialog(this.borrower.root, "I'll bring it right back.");
          }
        }
        if (this.stateTimer >= 2.3) {
          this._setState('BORROWER_WALKS_HOME');
        }
        break;

      case 'BORROWER_WALKS_HOME':
        // Wait until borrower carries ladder back to Peach Cottage task site
        if (this.borrower.state === 'IDLE' && this.borrower.root.position.distanceTo(this.posBorrowerTaskSite) < 0.25) {
          this._setState('LADDER_POSITION_AT_WALL');
        }
        break;

      case 'LADDER_POSITION_AT_WALL':
        if (this.stateTimer >= 1.2) {
          this._setState('LADDER_IN_USE');
        }
        break;

      case 'LADDER_IN_USE':
        if (this.stateTimer >= 1.8 && !this._subLine1Shown) {
          this._subLine1Shown = true;
          if (this.storyLabel) {
            this.storyLabel.hide();
          }
        }
        if (this.stateTimer >= 3.6) {
          this._setState('WORK_COMPLETE');
        }
        break;

      case 'WORK_COMPLETE':
        if (this.stateTimer >= 1.1 && !this._subLine1Shown) {
          this._subLine1Shown = true;
          if (this.storyLabel) {
            this.storyLabel.showDialog(this.borrower.root, "I'll return the ladder.");
          }
        }
        if (this.stateTimer >= 2.4) {
          this._setState('BORROWER_WALKS_BACK');
        }
        break;

      case 'BORROWER_WALKS_BACK':
        // Wait until borrower returns to Building 3 porch
        if (this.borrower.state === 'IDLE' && this.borrower.root.position.distanceTo(this.posBorrowerAtPorch) < 0.25) {
          this._setState('RETURN_MEETING');
        }
        break;

      case 'RETURN_MEETING':
        if (this.stateTimer >= 2.0) {
          this._setState('HANDOFF_2');
        }
        break;

      case 'HANDOFF_2':
        if (this.stateTimer >= 0.8 && !this._handoff2Done) {
          this._handoff2Done = true;
          // Ownership returns from Borrower to Lender
          this.ladder.owner = 'NEIGHBOR';
          this.ladder.attachTo(this.lender.rightHandGroup, this.ladderCarryLocalPos, this.ladderCarryLocalRot);
          this.lender.setCarryingLadder(true);
          if (this.lender.walkingCane) {
            this.lender.walkingCane.visible = false;
          }

          this.borrower.setCarryingLadder(false);
          this.borrower.reachAmount = 0.0;

          if (this.storyLabel) {
            this.storyLabel.showDialog(this.lender.root, 'Thanks.');
          }
        }
        if (this.stateTimer >= 2.0) {
          this._setState('CHARACTERS_RETURN_HOME');
        }
        break;

      case 'CHARACTERS_RETURN_HOME': {
        // Check if lender has arrived inside Building 3
        if (this.lender.state === 'IDLE' && this.lender.root.position.distanceTo(this.posLenderInside) < 0.3) {
          this.lender.root.visible = false;
          this.ladder.root.visible = false;
        }

        // Check if borrower has arrived inside Peach Cottage
        if (this.borrower.state === 'IDLE' && this.borrower.root.position.distanceTo(this.posBorrowerInside) < 0.3) {
          this.borrower.root.visible = false;
        }

        // When both have returned inside
        if (!this.lender.root.visible && !this.borrower.root.visible) {
          this._setState('FINAL_COMPLETE');
        }
        break;
      }

      case 'FINAL_COMPLETE':
        break;

      default:
        break;
    }
  }

  postUpdate(delta) {}

  _emitBeat(text) {
    if (typeof this.onBeat === 'function') {
      this.onBeat(text);
    }
  }

  dispose() {
    this.reset();
    if (this._ownsStoryLabel && this.storyLabel) {
      this.storyLabel.dispose();
      this.storyLabel = null;
    }
    if (this.ladder) {
      this.ladder.dispose();
      this.ladder = null;
    }
  }
}
