import * as THREE from 'three';
import { DioramaPerson } from './dioramaPeople.js';
import { CarryScenario } from './carryScenario.js';
import { BorrowingScenario } from './borrowingScenario.js';
import { ScenarioDirector } from './scenarioDirector.js';
import { createDioramaMaterials } from './dioramaMaterials.js';
import { createDioramaBuildings } from './dioramaBuildings.js';

console.log('===============================================================');
console.log('  SAATHI PHASE 4 — HELP CARRY SOMETHING DETERMINISTIC TEST SUITE');
console.log('===============================================================\n');

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ASSERTION FAILED:', message);
    process.exit(1);
  } else {
    console.log('✅ ' + message);
  }
}

const scene = new THREE.Scene();
const mats = createDioramaMaterials();
const buildings = createDioramaBuildings(mats);
scene.add(buildings);

// 1. ISOLATED CHARACTER INSTANTIATION TEST
console.log('--- TEST 1: NEW CHARACTERS ISOLATION ---');
// Existing Frozen Drill Story Cast
const sarah = new DioramaPerson({ variant: 'girl' });
sarah.root.name = 'DemoResident_Sarah';
scene.add(sarah.root);

const drThorne = new DioramaPerson({ variant: 'neighbor' });
drThorne.root.name = 'DemoResident_DrThorne';
scene.add(drThorne.root);

// Two Completely New Carry Story Characters
const carryRequester = new DioramaPerson({ variant: 'carry_requester' });
carryRequester.root.name = 'DemoResident_CarryRequester';
scene.add(carryRequester.root);

const carryHelper = new DioramaPerson({ variant: 'helper' });
carryHelper.root.name = 'DemoResident_CarryHelper';
scene.add(carryHelper.root);

assert(carryRequester !== sarah, 'carryRequester is a separate instance from Sarah');
assert(carryHelper !== drThorne, 'carryHelper is a separate instance from Dr. Thorne');
assert(carryRequester.variant === 'carry_requester', 'carryRequester variant is "carry_requester" (Reference Image 1)');
assert(carryHelper.variant === 'helper', 'carryHelper variant is "helper" (Reference Image 2)');
assert(carryRequester.root.name === 'DemoResident_CarryRequester', 'Requester root name is DemoResident_CarryRequester');
assert(carryHelper.root.name === 'DemoResident_CarryHelper', 'Helper root name is DemoResident_CarryHelper');

// Mock StoryLabel
class MockStoryLabel {
  constructor() {
    this.currentText = '';
    this.currentTarget = null;
    this.isVisible = false;
  }
  show(text, target) {
    this.currentText = text;
    this.currentTarget = target;
    this.isVisible = true;
  }
  hide() {
    this.isVisible = false;
  }
  clear() {
    this.currentText = '';
    this.currentTarget = null;
    this.isVisible = false;
  }
  update() {}
  dispose() {}
}

const mockStoryLabel = new MockStoryLabel();

// Instantiate Scenarios
const carryScenario = new CarryScenario(
  scene,
  carryRequester,
  carryHelper,
  buildings,
  null,
  null,
  null,
  mockStoryLabel
);

const borrowingScenario = new BorrowingScenario(
  scene,
  sarah,
  drThorne,
  buildings,
  null,
  null,
  null,
  mockStoryLabel
);

const director = new ScenarioDirector({
  borrowingScenario,
  carryScenario,
  onBeat: () => {}
});

// 2. INITIAL HOUSES & POSITIONS TEST
console.log('\n--- TEST 2: HOUSE COORDINATES & INITIAL POSITIONS ---');
// Requester at Quad4_CornerExhaustBuilding (9.35, 0.16, -5.60) outside
assert(carryRequester.root.position.distanceTo(new THREE.Vector3(9.35, 0.16, -5.60)) < 0.01,
  'Requester starts outside House A (Quad4_CornerExhaustBuilding) driveway: (9.35, 0.16, -5.60)');

// Helper starts INSIDE Quad4_RooftopGardenBuilding (14.40, 0.16, -11.60)
assert(carryHelper.root.position.distanceTo(new THREE.Vector3(14.40, 0.16, -11.60)) < 0.01,
  'Helper starts INSIDE House B (Quad4_RooftopGardenBuilding): (14.40, 0.16, -11.60)');
assert(carryHelper.root.visible === true, 'Helper root is visible inside house');

// Box at House A driveway (9.75, 0.37, -5.60)
assert(carryScenario.box.root.position.distanceTo(new THREE.Vector3(9.75, 0.37, -5.60)) < 0.01,
  'Box starts outside at House A driveway: (9.75, 0.37, -5.60)');

// Single Box Verification
const boxes = scene.children.filter(c => c.name === 'HouseholdBox_SingleInstance');
assert(boxes.length === 1, `Exactly ONE physical box instance in scene (count: ${boxes.length})`);

// Sarah and Dr. Thorne unchanged
assert(sarah.root.position.distanceTo(new THREE.Vector3(11.80, 0.16, 9.80)) < 0.01,
  'Sarah starts at frozen House A doorway: (11.80, 0.16, 9.80)');
assert(drThorne.root.position.distanceTo(new THREE.Vector3(-8.80, 0.16, 7.50)) < 0.01,
  'Dr. Thorne starts at frozen House B inside: (-8.80, 0.16, 7.50)');

// 3. FULL CARRY STORY EXECUTION
console.log('\n--- TEST 3: CARRY STORY CHOREOGRAPHY & EXACT DIALOGUE ---');
director.playScenario('carry');
assert(carryScenario.isStoryActive, 'Carry story is active');
assert(carryScenario.state === 'REQUESTER_ASKS', 'State is REQUESTER_ASKS');
assert(mockStoryLabel.currentText === 'I could use a hand with this.', `Beat 1: "${mockStoryLabel.currentText}"`);
assert(mockStoryLabel.currentTarget === carryRequester, 'Label anchored to NEW carryRequester');
assert(sarah.state === 'IDLE', 'Sarah does NOT move during carry story');
assert(drThorne.state === 'IDLE', 'Dr. Thorne does NOT move during carry story');

// Beat 2: System Coordination
carryScenario.update(2.9);
assert(carryScenario.state === 'SYSTEM_COORDINATION', 'State is SYSTEM_COORDINATION');
assert(mockStoryLabel.currentText === 'Nearby help found', `Beat 2: "${mockStoryLabel.currentText}"`);

// Beat 3: Helper Reveal (inside House B)
carryScenario.update(2.3);
assert(carryScenario.state === 'HELPER_REVEAL', 'State is HELPER_REVEAL');
assert(mockStoryLabel.currentText === 'I can help.', `Beat 3: "${mockStoryLabel.currentText}"`);
assert(mockStoryLabel.currentTarget === carryHelper, 'Label anchored to NEW carryHelper');

// Beat 3B: Helper exits his own house
carryScenario.update(2.3);
assert(carryScenario.state === 'HELPER_EXITING_HOME', 'State is HELPER_EXITING_HOME');
assert(carryHelper.state === 'WALKING', 'Helper begins walking out of his house');

let frames = 0;
while (carryScenario.state === 'HELPER_EXITING_HOME' && frames < 200) {
  carryHelper.update(0.05);
  carryScenario.update(0.05);
  frames++;
}

// Helper crosses doorway and reaches exterior garden path
assert(carryScenario.state === 'HELPER_TRAVELS_TO_REQUESTER', 'State is HELPER_TRAVELS_TO_REQUESTER');
assert(carryHelper.root.position.z >= -9.85, 'Helper emerged outside onto garden path (z >= -9.85)');

// Beat 4: Helper walks to Requester along sidewalk
frames = 0;
while (carryScenario.state === 'HELPER_TRAVELS_TO_REQUESTER' && frames < 500) {
  carryHelper.update(0.05);
  carryScenario.update(0.05);
  // Verify map boundary
  assert(Math.abs(carryHelper.root.position.x) <= 19.0, 'Helper within map X boundary');
  assert(Math.abs(carryHelper.root.position.z) <= 19.0, 'Helper within map Z boundary');
  frames++;
}

// Meet at box
assert(carryScenario.state === 'MEETING', 'State is MEETING');
assert(carryHelper.root.position.distanceTo(new THREE.Vector3(10.15, 0.16, -5.60)) < 0.15,
  'Helper arrived at box meeting point: (10.15, 0.16, -5.60)');
assert(carryRequester.root.position.distanceTo(new THREE.Vector3(9.35, 0.16, -5.60)) < 0.15,
  'Requester remained at box: (9.35, 0.16, -5.60)');
assert(mockStoryLabel.currentText === 'Thanks for coming.', `Beat 4: "${mockStoryLabel.currentText}"`);
assert(mockStoryLabel.currentTarget === carryRequester, 'Label anchored to Requester');

// Pre-carry coordination
carryScenario.update(2.5);
assert(carryScenario.state === 'PRE_CARRY_READY', 'State is PRE_CARRY_READY');
assert(mockStoryLabel.currentText === 'Ready?', `Beat 5: "${mockStoryLabel.currentText}"`);
assert(mockStoryLabel.currentTarget === carryRequester, 'Label anchored to Requester');

carryScenario.update(2.1);
assert(carryScenario.state === 'PRE_CARRY_LETS_DO_IT', 'State is PRE_CARRY_LETS_DO_IT');
assert(mockStoryLabel.currentText === "Let's do it.", `Beat 6: "${mockStoryLabel.currentText}"`);
assert(mockStoryLabel.currentTarget === carryHelper, 'Label anchored to Helper');

// Lifting
carryScenario.update(2.1);
assert(carryScenario.state === 'CARRY_LIFT', 'State is CARRY_LIFT');
assert(carryRequester.isCarryingBox, 'Requester in two-handed box carry pose');
assert(carryHelper.isCarryingBox, 'Helper in two-handed box carry pose');

// Carry together to doorway
carryScenario.update(0.75);
assert(carryScenario.state === 'CARRY_TO_DOOR', 'State is CARRY_TO_DOOR');

frames = 0;
while (carryScenario.state === 'CARRY_TO_DOOR' && frames < 200) {
  carryRequester.update(0.05);
  carryHelper.update(0.05);
  carryScenario.update(0.05);
  frames++;
}

// Enter requester home through doorway
assert(carryScenario.state === 'ENTER_REQUESTER_HOME', 'State is ENTER_REQUESTER_HOME');

frames = 0;
while (carryScenario.state === 'ENTER_REQUESTER_HOME' && frames < 200) {
  carryRequester.update(0.05);
  carryHelper.update(0.05);
  carryScenario.update(0.05);
  frames++;
}

// Place box inside
assert(carryScenario.state === 'PLACE_BOX_INSIDE', 'State is PLACE_BOX_INSIDE');
assert(carryScenario.box.root.position.z <= -7.40, 'Box is inside requester house (z <= -7.40, front wall is -6.70)');

carryScenario.update(0.75);

// Both characters walk back outside through doorway
assert(carryScenario.state === 'EXIT_REQUESTER_HOME', 'State is EXIT_REQUESTER_HOME');
assert(carryScenario.box.root.position.distanceTo(new THREE.Vector3(9.75, 0.37, -7.50)) < 0.05,
  'Point C: Box placed at INTERIOR destination on floor (9.75, 0.37, -7.50), cleanly inside front wall (-6.70)');
assert(!carryRequester.isCarryingBox, 'Requester released box');
assert(!carryHelper.isCarryingBox, 'Helper released box');

frames = 0;
while (carryScenario.state === 'EXIT_REQUESTER_HOME' && frames < 200) {
  carryRequester.update(0.05);
  carryHelper.update(0.05);
  carryScenario.update(0.05);
  frames++;
}

// Both are now back OUTSIDE on porch for thank-you
assert(carryScenario.state === 'THANK_YOU_THAT_IS_IT', 'State is THANK_YOU_THAT_IS_IT');
assert(carryRequester.root.position.z >= -6.40, 'Requester is outside on porch for thank-you (z >= -6.40)');
assert(carryHelper.root.position.z >= -6.40, 'Helper is outside on porch for thank-you (z >= -6.40)');
assert(carryScenario.box.root.position.z <= -7.40, 'Box remains inside requester house during thank-you');
assert(mockStoryLabel.currentText === "That's it.", `Beat 8: "${mockStoryLabel.currentText}"`);
assert(mockStoryLabel.currentTarget === carryRequester, 'Label anchored to Requester');

// Thank you Beat 8B: "Thank you."
carryScenario.update(2.1);
assert(carryScenario.state === 'THANK_YOU_GRATITUDE', 'State is THANK_YOU_GRATITUDE');
assert(mockStoryLabel.currentText === 'Thank you.', `Beat 8B: "${mockStoryLabel.currentText}"`);
assert(mockStoryLabel.currentTarget === carryRequester, 'Label anchored to Requester');

// Thank you Beat 9: "Happy to help."
carryScenario.update(2.1);
assert(carryScenario.state === 'THANK_YOU_RESPONSE', 'State is THANK_YOU_RESPONSE');
assert(mockStoryLabel.currentText === 'Happy to help.', `Beat 9: "${mockStoryLabel.currentText}"`);
assert(mockStoryLabel.currentTarget === carryHelper, 'Label anchored to Helper');

// Requester returns inside her house
carryScenario.update(2.3);
assert(carryScenario.state === 'REQUESTER_RETURNS_HOME', 'State is REQUESTER_RETURNS_HOME');

frames = 0;
while (carryScenario.state === 'REQUESTER_RETURNS_HOME' && frames < 200) {
  carryRequester.update(0.05);
  carryScenario.update(0.05);
  frames++;
}

assert(!carryRequester.root.visible, 'Requester entered doorway opening of House A and is occluded / hidden inside');

// Helper departs and returns to his own house
assert(carryScenario.state === 'HELPER_RETURNS_HOME', 'State is HELPER_RETURNS_HOME');
assert(carryHelper.state === 'WALKING', 'Helper begins walk back home along sidewalk');

frames = 0;
while (carryScenario.state === 'HELPER_RETURNS_HOME' && frames < 500) {
  carryHelper.update(0.05);
  carryScenario.update(0.05);
  frames++;
}

// Helper reached House B garden threshold
assert(carryScenario.state === 'HELPER_AT_DOOR', 'State is HELPER_AT_DOOR');
assert(carryHelper.root.position.distanceTo(new THREE.Vector3(14.40, 0.16, -9.80)) < 0.15,
  'Helper reached House B garden path threshold: (14.40, 0.16, -9.80)');

// Helper enters doorway of House B
carryScenario.update(0.4);
assert(carryScenario.state === 'HELPER_ENTERING_HOME', 'State is HELPER_ENTERING_HOME');

frames = 0;
while (carryScenario.state !== 'FINAL_COMPLETE' && frames < 200) {
  carryHelper.update(0.05);
  carryScenario.update(0.05);
  frames++;
}

assert(carryScenario.state === 'FINAL_COMPLETE', 'State is FINAL_COMPLETE');
assert(!carryRequester.root.visible, 'Requester is inside House A (not visible outside)');
assert(!carryHelper.root.visible, 'Helper entered doorway of House B and is inside (not visible outside)');
assert(carryScenario.box.root.position.distanceTo(new THREE.Vector3(9.75, 0.37, -7.50)) < 0.15,
  'Box is resting at Point C INTERIOR floor: (9.75, 0.37, -7.50)');

// 4. CANCELLATION & SCENARIO TOGGLE TEST
console.log('\n--- TEST 4: CANCELLATION & MUTUAL EXCLUSION ---');
director.playScenario('carry');
assert(carryScenario.isStoryActive, 'Carry active on replay');
carryScenario.update(1.0);

// Stop scenario cleanly
director.stopScenario();
assert(!carryScenario.isStoryActive, 'Carry stopped cleanly');
assert(carryScenario.state === 'INITIAL_IDLE', 'Carry reset to INITIAL_IDLE');
assert(carryRequester.root.position.distanceTo(new THREE.Vector3(9.35, 0.16, -5.60)) < 0.01,
  'Requester reset to start: (9.35, 0.16, -5.60)');
assert(carryHelper.root.position.distanceTo(new THREE.Vector3(14.40, 0.16, -11.60)) < 0.01,
  'Helper reset to INSIDE House B: (14.40, 0.16, -11.60)');
assert(carryScenario.box.root.position.distanceTo(new THREE.Vector3(9.75, 0.37, -5.60)) < 0.01,
  'Box reset to driveway: (9.75, 0.37, -5.60)');

// 5. DRILL REGRESSION VERIFICATION
console.log('\n--- TEST 5: DRILL STORY REGRESSION CHECK ---');
director.playScenario('drill');
assert(borrowingScenario.isStoryActive, 'Drill story started cleanly');
assert(sarah.root.position.distanceTo(new THREE.Vector3(11.80, 0.16, 9.80)) < 0.01,
  'Sarah is at frozen home inside start position: (11.80, 0.16, 9.80)');
assert(drThorne.root.position.distanceTo(new THREE.Vector3(-8.80, 0.16, 7.50)) < 0.01,
  'Dr. Thorne is at frozen inside start position: (-8.80, 0.16, 7.50)');
assert(borrowingScenario.tool !== null, 'Drill prop exists');
assert(borrowingScenario.tool.owner === 'NEIGHBOR', 'Drill initially owned by Dr. Thorne');

// Switch from Drill to Carry
director.playScenario('carry');
assert(carryScenario.isStoryActive, 'Switched to Carry scenario');
assert(!borrowingScenario.isStoryActive, 'Drill scenario stopped and reset');
assert(sarah.root.position.distanceTo(new THREE.Vector3(11.80, 0.16, 9.80)) < 0.01,
  'Sarah reset to home inside position: (11.80, 0.16, 9.80)');
assert(drThorne.root.position.distanceTo(new THREE.Vector3(-8.80, 0.16, 7.50)) < 0.01,
  'Dr. Thorne reset to neighbor inside position: (-8.80, 0.16, 7.50)');

director.stopScenario();

console.log('\n===============================================================');
console.log('  ALL DETERMINISTIC TESTS PASSED PERFECTLY (0 FAILURES)');
console.log('===============================================================');
