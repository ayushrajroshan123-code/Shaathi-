import * as THREE from 'three';
import { BorrowableTool } from './dioramaTools.js';
import { StoryLabel } from './storyLabel.js';

/**
 * borrowingScenario.js — SAATHI Borrow a Drill Cinematic Story
 *
 * Core Value Proposition: The person who NEEDS the item travels to the person who HAS the item.
 * Sarah (borrower) travels across the neighborhood to Dr. Thorne (lender at House B), receives
 * the drill, brings it home to use, then returns it to Dr. Thorne.
 *
 * Deterministic Story Sequence:
 * 1. ASK: Sarah is at House A. Realizes she needs a drill.
 *    Sarah says: "I need a drill." (Label above Sarah)
 * 2. COORDINATION: Platform annotation: "Nearby match found" (quiet world annotation).
 *    Sarah exits House A, walks down her garden path, and heads toward Dr. Thorne.
 * 3. FIND: Dr. Thorne is revealed at House B holding the drill.
 *    Dr. Thorne says: "I have a drill." (Label above Dr. Thorne)
 * 4. COORDINATE: Sarah walks across the neighborhood and arrives at Dr. Thorne's porch.
 *    Dr. Thorne says: "I can lend you mine." (Label above Dr. Thorne)
 * 5. HANDOFF: Drill physically transfers Dr. Thorne → Sarah.
 *    Sarah says: "Thank you." (Label above Sarah)
 * 6. Sarah carries the drill back home to House A. Dr. Thorne remains at House B.
 * 7. USING: Sarah uses the drill at her front patio ("Working on it." → "Done.").
 * 8. RETURN: Sarah finishes work, says "I'll return this.", and walks back to Dr. Thorne.
 * 9. SECOND HANDOFF: Sarah returns the drill ("Here it is." → Dr. Thorne: "Thanks.").
 * 10. COMPLETE: Sarah returns home. Dr. Thorne stores the drill. Both enter homes. Story complete.
 */

export class BorrowingScenario {
  constructor(scene, resident, neighbor, buildings, renderer, camera, container, storyLabel = null) {
    this.scene     = scene;
    this.resident  = resident;  // Sarah (Borrower, Lot 1 Cat Building)
    this.neighbor  = neighbor;  // Dr. Thorne (Lender, Lot 2 Corner Building)
    this.buildings = buildings;
    this.renderer  = renderer  || null;
    this.camera    = camera    || null;
    this.container = container || null;

    // World-anchored HTML dialog label
    this.storyLabel = storyLabel || (this.container && this.camera ? new StoryLabel(this.container, this.camera) : null);
    this._ownsStoryLabel = !storyLabel;

    // Doors
    this.homeDoor     = buildings.getObjectByName('Door_Quad1_CatBuilding')     || null;
    this.neighborDoor = buildings.getObjectByName('Door_Quad2_CornerBuilding') || null;

    // Exactly ONE physical drill prop instance
    this.tool = new BorrowableTool('drill');
    this.tool.owner = 'NEIGHBOR';
    this.tool.root.visible = false;

    // Hand grip offsets
    this.toolGripLocalPos = new THREE.Vector3(0.015, -0.04, 0.04);
    this.toolGripLocalRot = new THREE.Euler(0, -Math.PI / 2, -0.22);

    // Waypoint Positions
    this.posHomeInside       = new THREE.Vector3(11.80, 0.16,  9.80); // Inside House A doorway entrance
    this.posHomePatio        = new THREE.Vector3(11.80, 0.16,  8.65); // Front doorway patio / work area
    this.posGardenPath       = new THREE.Vector3(11.80, 0.16,  6.70); // Stone garden path
    this.posNeighborInside   = new THREE.Vector3(-8.80, 0.16,  7.50); // Inside House B
    this.posNeighborOutside  = new THREE.Vector3(-8.80, 0.16,  5.95); // House B front porch (Dr. Thorne)
    this.posSarahAtNeighbor  = new THREE.Vector3(-8.80, 0.16,  5.25); // House B porch meeting point (Sarah)
    this.posSystemAnnotation = new THREE.Vector3(11.80, 0.16,  6.20); // Path coordinate for quiet platform coordination annotation

    // Verified Collision-Free Routes

    // 1. Sarah travels from House A to Dr. Thorne at House B
    this.routeSarahToNeighbor = [
      new THREE.Vector3(11.80, 0.16,  6.70), // Garden path
      new THREE.Vector3(11.80, 0.16,  6.00), // Pass through fence gate opening
      new THREE.Vector3(11.80, 0.16,  5.20), // Outside fence gate
      new THREE.Vector3(11.80, 0.16,  3.45), // House A sidewalk entrance
      new THREE.Vector3(3.60,  0.16,  3.45), // East crosswalk entrance (cars yield!)
      new THREE.Vector3(-3.60, 0.16,  3.45), // West crosswalk exit
      new THREE.Vector3(-8.80, 0.16,  3.45), // House B sidewalk
      new THREE.Vector3(-8.80, 0.16,  5.25), // Reach Dr. Thorne on porch
    ];

    // 2. Dr. Thorne steps out to his porch with the drill (he stays at House B!)
    this.routeNeighborStepOut = [
      new THREE.Vector3(-8.80, 0.16, 7.50), // Inside House B
      new THREE.Vector3(-8.80, 0.16, 5.95), // Porch threshold
    ];

    // 3. Sarah returns home carrying the borrowed drill
    this.routeSarahHomeWithDrill = [
      new THREE.Vector3(-8.80, 0.16, 5.25), // Start from House B porch
      new THREE.Vector3(-8.80, 0.16, 3.45), // Step down to sidewalk
      new THREE.Vector3(-3.60, 0.16, 3.45), // West crosswalk entrance
      new THREE.Vector3(3.60,  0.16, 3.45), // East crosswalk exit (cars yield!)
      new THREE.Vector3(11.80, 0.16, 3.45), // House A sidewalk
      new THREE.Vector3(11.80, 0.16, 5.20), // Approach gate from outside
      new THREE.Vector3(11.80, 0.16, 6.00), // Pass through gate
      new THREE.Vector3(11.80, 0.16, 6.70), // Garden path
      new THREE.Vector3(11.80, 0.16, 8.65), // House A patio / work area
    ];

    // 4. Sarah walks back to Dr. Thorne to return the borrowed drill
    this.routeSarahReturnToNeighbor = [
      new THREE.Vector3(11.80, 0.16, 8.65), // House A patio
      new THREE.Vector3(11.80, 0.16, 6.70), // Garden path
      new THREE.Vector3(11.80, 0.16, 6.00), // Through gate
      new THREE.Vector3(11.80, 0.16, 5.20), // Outside gate
      new THREE.Vector3(11.80, 0.16, 3.45), // House A sidewalk
      new THREE.Vector3(3.60,  0.16, 3.45), // East crosswalk entrance
      new THREE.Vector3(-3.60, 0.16, 3.45), // West crosswalk exit
      new THREE.Vector3(-8.80, 0.16, 3.45), // House B sidewalk
      new THREE.Vector3(-8.80, 0.16, 5.25), // Arrive at House B porch
    ];

    // 5. Sarah's final walk home after returning the drill
    this.routeSarahFinalHome = [
      new THREE.Vector3(-8.80, 0.16,  5.25), // House B porch
      new THREE.Vector3(-8.80, 0.16,  3.45), // House B sidewalk
      new THREE.Vector3(-3.60, 0.16,  3.45), // West crosswalk entrance
      new THREE.Vector3(3.60,  0.16,  3.45), // East crosswalk exit
      new THREE.Vector3(11.80, 0.16,  3.45), // House A sidewalk
      new THREE.Vector3(11.80, 0.16,  5.20), // Outside gate
      new THREE.Vector3(11.80, 0.16,  6.00), // Through gate
      new THREE.Vector3(11.80, 0.16,  6.70), // Garden path
      new THREE.Vector3(11.80, 0.16,  8.65), // Patio threshold
      new THREE.Vector3(11.80, 0.16,  9.80), // Inside House A
    ];

    // 6. Dr. Thorne enters House B after receiving drill back
    this.routeNeighborEnterHome = [
      new THREE.Vector3(-8.80, 0.16, 5.95), // Porch threshold
      new THREE.Vector3(-8.80, 0.16, 7.50), // Inside House B
    ];

    // Handoff interpolation vectors
    this.handoffStartPos   = new THREE.Vector3();
    this.handoffStartQuat  = new THREE.Quaternion();
    this.handoffTargetPos  = new THREE.Vector3();
    this.handoffTargetQuat = new THREE.Quaternion();
    this.handoffProgress   = 0.0;
    this.handoffDuration   = 0.50;

    // State Management
    this.isStoryActive = false;
    this.isPaused = false;
    this.state = 'INITIAL_IDLE';
    this.stateTimer = 0.0;
    this.onBeat = null;

    // Internal transition flags
    this.homeDoorClosingTriggered = false;
    this.neighborDoorClosingTriggered = false;

    this._initCharacters();
  }

  _notifyBeat(text) {
    if (typeof this.onBeat === 'function') {
      this.onBeat(text);
    }
  }

  _initCharacters() {
    this.resident.walkSpeed = 1.85;
    this.resident.root.position.copy(this.posHomeInside);
    this.resident.root.rotation.y = Math.PI; // Face doorway (-Z)
    this.resident.state = 'IDLE';
    this.resident.route = [];
    this.resident.routeIndex = 0;
    this.resident.setCarryingItem(false);
    this.resident.reachForHandoff(0);
    this.resident.isWorkingOnTask = false;
    this.resident.root.visible = false;

    this.neighbor.walkSpeed = 1.70;
    this.neighbor.root.position.copy(this.posNeighborInside);
    this.neighbor.root.rotation.y = 0;
    this.neighbor.state = 'IDLE';
    this.neighbor.route = [];
    this.neighbor.routeIndex = 0;
    this.neighbor.setCarryingItem(false);
    this.neighbor.reachForHandoff(0);
    this.neighbor.root.visible = false;

    // Drill starts owned by Dr. Thorne, hidden inside House B
    this.tool.attachTo(this.neighbor.rightHandGroup, this.toolGripLocalPos, this.toolGripLocalRot);
    this.tool.owner = 'NEIGHBOR';
    this.tool.root.visible = false;

    if (this.homeDoor && this.homeDoor.close) {
      this.homeDoor.close();
      this.homeDoor.openProgress = 0.0;
    }
    if (this.neighborDoor && this.neighborDoor.close) {
      this.neighborDoor.close();
      this.neighborDoor.openProgress = 0.0;
    }
  }

  start() {
    if (this.isStoryActive && this.state !== 'INITIAL_IDLE' && this.state !== 'FINAL_COMPLETE') {
      return;
    }
    this.reset();
    this.isStoryActive = true;
    this.isPaused = false;
    this.state = 'ASKING_OPEN_DOOR';
    this.stateTimer = 0.0;

    if (this.homeDoor) this.homeDoor.open();
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
    if (!this.isStoryActive && this.state === 'INITIAL_IDLE') {
      this.start();
    }
  }

  reset() {
    this.isStoryActive = false;
    this.isPaused = false;
    this.state = 'INITIAL_IDLE';
    this.stateTimer = 0.0;
    this.handoffProgress = 0.0;
    this.homeDoorClosingTriggered = false;
    this.neighborDoorClosingTriggered = false;

    if (this.storyLabel) {
      this.storyLabel.hide();
    }

    this._initCharacters();
  }

  update(delta) {
    if (!this.isStoryActive || this.isPaused || !delta || delta <= 0) return;
    this.stateTimer += delta;

    // Physical door animations
    if (this.homeDoor && typeof this.homeDoor.update === 'function') {
      this.homeDoor.update(delta);
    }
    if (this.neighborDoor && typeof this.neighborDoor.update === 'function') {
      this.neighborDoor.update(delta);
    }

    switch (this.state) {
      /* =====================================================================
         1. ASK: Sarah is at House A, says "I need a drill.", pauses, then exits
         ===================================================================== */
      case 'ASKING_OPEN_DOOR':
        if ((!this.homeDoor || this.homeDoor.openProgress >= 0.70 || this.homeDoor.doorState === 'OPEN') && this.stateTimer >= 0.20) {
          this.resident.root.visible = true;
          this.resident.turnTo(Math.PI); // Face doorway (-Z) toward garden path
          this.state = 'SARAH_NEEDS_DRILL';
          this.stateTimer = 0;
          if (this.storyLabel) {
            this.storyLabel.show('I need a drill.', this.resident);
          }
          this._notifyBeat('I need a drill.');
        }
        break;

      case 'SARAH_NEEDS_DRILL':
        // Natural pause for the viewer to understand Sarah's need before she walks
        if (this.stateTimer >= 2.0) {
          this.state = 'SARAH_STEP_OUT';
          this.stateTimer = 0;
          if (this.storyLabel) {
            this.storyLabel.show('Nearby match found', this.posSystemAnnotation, 2.15, { isSystem: true });
          }
          this._notifyBeat('Nearby match found');
          // Sarah moves toward entrance, exits house, and walks down garden path
          this.resident.setRoute([this.posHomeInside.clone(), this.posHomePatio.clone(), this.posGardenPath.clone()], false);
        }
        break;

      case 'SARAH_STEP_OUT':
        // When Sarah has stepped out through the doorway and reached the garden path
        if (this.resident.state === 'IDLE' && this.resident.root.position.distanceTo(this.posGardenPath) < 0.20) {
          if (this.homeDoor) this.homeDoor.close();
          this.resident.setRoute(this.routeSarahToNeighbor, false);
          this.state = 'SARAH_WALKING_TO_NEIGHBOR';
          this.stateTimer = 0;
        }
        break;

      /* =====================================================================
         2. TRAVEL & FIND: Sarah walks toward House B; Dr. Thorne is revealed
         ===================================================================== */
      case 'SARAH_WALKING_TO_NEIGHBOR':
        // Fade label after 2.2s so viewer watches Sarah walk through gate and sidewalk
        if (this.stateTimer >= 2.2 && this.storyLabel && this.storyLabel.isVisible) {
          this.storyLabel.hide();
        }

        // When Sarah approaches the crosswalk, reveal Dr. Thorne at House B
        if (this.stateTimer >= 2.8) {
          if (this.neighborDoor) this.neighborDoor.open();
          this.state = 'REVEAL_NEIGHBOR_OPEN_DOOR';
          this.stateTimer = 0;
        }
        break;

      case 'REVEAL_NEIGHBOR_OPEN_DOOR':
        if ((!this.neighborDoor || this.neighborDoor.openProgress >= 0.85 || this.neighborDoor.doorState === 'OPEN') && this.stateTimer >= 0.25) {
          this.neighbor.root.visible = true;
          this.tool.attachTo(this.neighbor.rightHandGroup, this.toolGripLocalPos, this.toolGripLocalRot);
          this.tool.owner = 'NEIGHBOR';
          this.tool.root.visible = true;
          this.neighbor.setCarryingItem(true);
          this.neighbor.setRoute(this.routeNeighborStepOut, false);
          this.state = 'REVEAL_NEIGHBOR_STEP_OUT';
          this.stateTimer = 0;
        }
        break;

      case 'REVEAL_NEIGHBOR_STEP_OUT':
        if (this.neighbor.state === 'IDLE' && this.neighbor.root.position.distanceTo(this.posNeighborOutside) < 0.15) {
          if (this.neighborDoor) this.neighborDoor.close();
          this.neighbor.turnTo(Math.PI); // Face -Z toward approaching Sarah
          this.state = 'REVEAL_NEIGHBOR';
          this.stateTimer = 0;
          if (this.storyLabel) {
            this.storyLabel.show('I have a drill.', this.neighbor);
          }
          this._notifyBeat('I have a drill.');
        }
        break;

      case 'REVEAL_NEIGHBOR':
        // Hide neighbor label after 2.0s
        if (this.stateTimer >= 2.0 && this.storyLabel && this.storyLabel.isVisible) {
          this.storyLabel.hide();
        }

        // Check if Sarah has arrived at House B porch
        if (this.resident.state === 'IDLE' && this.resident.root.position.distanceTo(this.posSarahAtNeighbor) < 0.15) {
          this.resident.turnTo(0);        // Face +Z toward Dr. Thorne
          this.neighbor.turnTo(Math.PI);  // Face -Z toward Sarah
          this.state = 'HANDOFF';
          this.stateTimer = 0;
        }
        break;

      /* =====================================================================
         3. FIRST HANDOFF: Visual centerpiece at House B porch
         ===================================================================== */
      case 'HANDOFF':
        if (this.stateTimer >= 0.25) {
          this.neighbor.reachForHandoff(1.0);
          this.resident.reachForHandoff(1.0);
          if (this.storyLabel) {
            this.storyLabel.show('I can lend you mine.', this.neighbor);
          }
          this._notifyBeat('I can lend you mine.');
          this.state = 'TRANSFER_DRILL';
          this.stateTimer = 0;
          this.handoffProgress = 0;

          // Prop transfer interpolation between hands
          this.neighbor.rightHandGroup.getWorldPosition(this.handoffStartPos);
          this.neighbor.rightHandGroup.getWorldQuaternion(this.handoffStartQuat);
          this.tool.attachTo(this.scene, this.handoffStartPos, new THREE.Euler().setFromQuaternion(this.handoffStartQuat));
        }
        break;

      case 'TRANSFER_DRILL':
        this.handoffProgress = Math.min(1.0, this.handoffProgress + delta / this.handoffDuration);

        this.resident.rightHandGroup.getWorldPosition(this.handoffTargetPos);
        this.resident.rightHandGroup.getWorldQuaternion(this.handoffTargetQuat);

        const t = this.handoffProgress < 0.5
          ? 4 * this.handoffProgress * this.handoffProgress * this.handoffProgress
          : 1 - Math.pow(-2 * this.handoffProgress + 2, 3) / 2;

        this.tool.root.position.lerpVectors(this.handoffStartPos, this.handoffTargetPos, t);
        this.tool.root.quaternion.slerpQuaternions(this.handoffStartQuat, this.handoffTargetQuat, t);

        if (this.handoffProgress >= 1.0) {
          // Drill now firmly gripped by Sarah
          this.tool.attachTo(this.resident.rightHandGroup, this.toolGripLocalPos, this.toolGripLocalRot);
          this.tool.owner = 'GIRL';
          this.resident.setCarryingItem(true);
          this.neighbor.setCarryingItem(false);
          this.resident.reachForHandoff(0);
          this.neighbor.reachForHandoff(0);

          if (this.storyLabel) {
            this.storyLabel.show('Thank you.', this.resident);
          }
          this._notifyBeat('Thank you.');
          this.state = 'SHOW_THANK_YOU';
          this.stateTimer = 0;
        }
        break;

      case 'SHOW_THANK_YOU':
        if (this.stateTimer >= 1.8) {
          if (this.storyLabel) this.storyLabel.hide();
          this.state = 'SARAH_WALK_HOME_WITH_DRILL';
          this.stateTimer = 0;
          // Sarah turns around and walks home with the drill
          this.resident.setRoute(this.routeSarahHomeWithDrill, false);
        }
        break;

      /* =====================================================================
         4. USING: Sarah carries drill home and uses it at House A patio
         ===================================================================== */
      case 'SARAH_WALK_HOME_WITH_DRILL':
        if (this.resident.state === 'IDLE' && this.resident.root.position.distanceTo(this.posHomePatio) < 0.15) {
          this.resident.turnTo(0); // Face +Z into workshop wall/bench
          this.state = 'USING';
          this.stateTimer = 0;
          this.resident.isWorkingOnTask = true;
          this.resident.reachForHandoff(0.7);

          if (this.storyLabel) {
            this.storyLabel.show('Working on it.', this.resident);
          }
          this._notifyBeat('Working on it.');
        }
        break;

      case 'USING':
        // Restrained drilling motion: arm maintains working posture with subtle vibration
        if (this.resident.rightHandGroup) {
          const vibe = Math.sin(this.stateTimer * 28.0) * 0.003;
          this.tool.root.position.y = this.toolGripLocalPos.y + vibe;
        }

        if (this.stateTimer >= 3.0) {
          this.resident.isWorkingOnTask = false;
          this.resident.reachForHandoff(0);
          this.resident.setCarryingItem(true);
          this.tool.root.position.copy(this.toolGripLocalPos);

          if (this.storyLabel) {
            this.storyLabel.show('Done.', this.resident);
          }
          this._notifyBeat('Done.');
          this.state = 'WORK_DONE';
          this.stateTimer = 0;
        }
        break;

      case 'WORK_DONE':
        if (this.stateTimer >= 1.5) {
          this.state = 'RETURN_REQUEST';
          this.stateTimer = 0;
          if (this.storyLabel) {
            this.storyLabel.show("I'll return this.", this.resident);
          }
          this._notifyBeat("I'll return this.");
        }
        break;

      /* =====================================================================
         5. RETURN: Sarah walks back to Dr. Thorne to return the drill
         ===================================================================== */
      case 'RETURN_REQUEST':
        if (this.stateTimer >= 1.5) {
          if (this.storyLabel) this.storyLabel.hide();
          this.state = 'SARAH_WALK_TO_RETURN';
          this.stateTimer = 0;
          this.resident.setRoute(this.routeSarahReturnToNeighbor, false);
        }
        break;

      case 'SARAH_WALK_TO_RETURN':
        if (this.resident.state === 'IDLE' && this.resident.root.position.distanceTo(this.posSarahAtNeighbor) < 0.15) {
          this.resident.turnTo(0);        // Face +Z toward Dr. Thorne
          this.neighbor.turnTo(Math.PI);  // Face -Z toward Sarah
          this.state = 'RETURN_HANDOFF';
          this.stateTimer = 0;
        }
        break;

      /* =====================================================================
         6. SECOND HANDOFF: Sarah hands drill back to Dr. Thorne
         ===================================================================== */
      case 'RETURN_HANDOFF':
        if (this.stateTimer >= 0.25) {
          this.resident.reachForHandoff(1.0);
          this.neighbor.reachForHandoff(1.0);
          if (this.storyLabel) {
            this.storyLabel.show('Here it is.', this.resident);
          }
          this._notifyBeat('Here it is.');
          this.state = 'RETURN_TRANSFER';
          this.stateTimer = 0;
          this.handoffProgress = 0;

          this.resident.rightHandGroup.getWorldPosition(this.handoffStartPos);
          this.resident.rightHandGroup.getWorldQuaternion(this.handoffStartQuat);
          this.tool.attachTo(this.scene, this.handoffStartPos, new THREE.Euler().setFromQuaternion(this.handoffStartQuat));
        }
        break;

      case 'RETURN_TRANSFER':
        this.handoffProgress = Math.min(1.0, this.handoffProgress + delta / this.handoffDuration);

        this.neighbor.rightHandGroup.getWorldPosition(this.handoffTargetPos);
        this.neighbor.rightHandGroup.getWorldQuaternion(this.handoffTargetQuat);

        const rT = this.handoffProgress < 0.5
          ? 4 * this.handoffProgress * this.handoffProgress * this.handoffProgress
          : 1 - Math.pow(-2 * this.handoffProgress + 2, 3) / 2;

        this.tool.root.position.lerpVectors(this.handoffStartPos, this.handoffTargetPos, rT);
        this.tool.root.quaternion.slerpQuaternions(this.handoffStartQuat, this.handoffTargetQuat, rT);

        if (this.handoffProgress >= 1.0) {
          // Drill returned to Dr. Thorne
          this.tool.attachTo(this.neighbor.rightHandGroup, this.toolGripLocalPos, this.toolGripLocalRot);
          this.tool.owner = 'NEIGHBOR';
          this.neighbor.setCarryingItem(true);
          this.resident.setCarryingItem(false);
          this.neighbor.reachForHandoff(0);
          this.resident.reachForHandoff(0);

          if (this.storyLabel) {
            this.storyLabel.show('Thanks.', this.neighbor);
          }
          this._notifyBeat('Thanks.');
          this.state = 'SHOW_THANKS';
          this.stateTimer = 0;
        }
        break;

      case 'SHOW_THANKS':
        if (this.stateTimer >= 1.8) {
          if (this.storyLabel) this.storyLabel.hide();
          this.state = 'CHARACTERS_RETURN_HOME';
          this.stateTimer = 0;

          // Sarah walks home to House A
          this.resident.setRoute(this.routeSarahFinalHome, false);
          // Dr. Thorne steps inside House B
          this.neighbor.setRoute(this.routeNeighborEnterHome, false);
          this.homeDoorClosingTriggered = false;
          this.neighborDoorClosingTriggered = false;
        }
        break;

      /* =====================================================================
         7. COMPLETE: Sarah enters House A; Dr. Thorne enters House B
         ===================================================================== */
      case 'CHARACTERS_RETURN_HOME':
        // Dr. Thorne inside House B
        if (this.neighbor.state === 'IDLE' && this.neighbor.root.position.distanceTo(this.posNeighborInside) < 0.25) {
          this.neighbor.root.visible = false;
          this.tool.root.visible = false;
          this.neighbor.setCarryingItem(false);
          this.tool.owner = 'HOUSE_B_STORAGE';
          if (!this.neighborDoorClosingTriggered && this.neighborDoor) {
            this.neighborDoorClosingTriggered = true;
            this.neighborDoor.close();
          }
        }

        // Sarah approaches House A door
        if (this.resident.root.position.z >= 7.80 && this.homeDoor && this.homeDoor.doorState !== 'OPEN' && this.homeDoor.doorState !== 'OPENING') {
          this.homeDoor.open();
        }

        // Sarah inside House A
        if (this.resident.state === 'IDLE' && this.resident.root.position.distanceTo(this.posHomeInside) < 0.25) {
          this.resident.root.visible = false;
          if (!this.homeDoorClosingTriggered && this.homeDoor) {
            this.homeDoorClosingTriggered = true;
            this.homeDoor.close();
          }
        }

        // When both actors are safely inside their homes
        if (!this.resident.root.visible && !this.neighbor.root.visible) {
          this.state = 'FINAL_COMPLETE';
          this.isStoryActive = false;
          this.stateTimer = 0;
          this._notifyBeat('Complete — Shared.');
        }
        break;

      case 'FINAL_COMPLETE':
        // Quiescent complete state
        break;
    }
  }

  postUpdate(delta) {
    if (!delta || delta <= 0) return;

    // Physical door animations
    if (this.homeDoor && typeof this.homeDoor.update === 'function') {
      this.homeDoor.update(delta);
    }
    if (this.neighborDoor && typeof this.neighborDoor.update === 'function') {
      this.neighborDoor.update(delta);
    }
  }

  dispose() {
    if (this._ownsStoryLabel && this.storyLabel) {
      this.storyLabel.dispose();
      this.storyLabel = null;
    }
    if (this.tool) {
      this.tool.dispose();
    }
  }
}
