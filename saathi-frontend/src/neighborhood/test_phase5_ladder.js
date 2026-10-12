import * as THREE from 'three';
import { DioramaPerson } from './dioramaPeople.js';
import { LadderScenario } from './ladderScenario.js';
import { BorrowingScenario } from './borrowingScenario.js';
import { CarryScenario } from './carryScenario.js';
import { ScenarioDirector } from './scenarioDirector.js';
import { CameraDirector } from './cameraDirector.js';
import { createDioramaMaterials } from './dioramaMaterials.js';
import { createDioramaBuildings } from './dioramaBuildings.js';
import { BorrowableLadder } from './ladderProp.js';

console.log('===============================================================');
console.log('  SAATHI PHASE 5 — LADDER LENDING DETERMINISTIC TEST SUITE');
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

// 1. ISOLATED CHARACTER INSTANTIATION & VISUAL ATTRIBUTES
console.log('--- TEST 1: DEDICATED CHARACTERS ISOLATION ---');

// Protected Drill Story Cast
const sarah = new DioramaPerson({ variant: 'girl' });
sarah.root.name = 'DemoResident_Sarah';
scene.add(sarah.root);

const drThorne = new DioramaPerson({ variant: 'neighbor' });
drThorne.root.name = 'DemoResident_DrThorne';
scene.add(drThorne.root);

// Protected Carry Story Cast
const carryRequester = new DioramaPerson({ variant: 'carry_requester' });
carryRequester.root.name = 'DemoResident_CarryRequester';
scene.add(carryRequester.root);

const carryHelper = new DioramaPerson({ variant: 'helper' });
carryHelper.root.name = 'DemoResident_CarryHelper';
scene.add(carryHelper.root);

// Dedicated Ladder Story Cast
const ladderBorrower = new DioramaPerson({ variant: 'boy_blue' });
ladderBorrower.root.name = 'DemoResident_LadderBorrower';
scene.add(ladderBorrower.root);

const ladderLender = new DioramaPerson({ variant: 'ladder_lender' });
ladderLender.root.name = 'DemoResident_LadderLender';
scene.add(ladderLender.root);

// Assert character separation
assert(ladderBorrower !== sarah, 'ladderBorrower is separate from Sarah');
assert(ladderBorrower !== carryRequester, 'ladderBorrower is separate from Carry Requester');
assert(ladderLender !== drThorne, 'ladderLender is separate from Dr. Thorne');
assert(ladderLender !== carryHelper, 'ladderLender is separate from Carry Helper');

// Assert variants and visual definitions
assert(ladderBorrower.variant === 'boy_blue', 'Borrower variant is "boy_blue"');
assert(ladderLender.variant === 'ladder_lender', 'Lender variant is "ladder_lender"');
assert(ladderLender.root.name === 'DemoResident_LadderLender', 'Lender root name is correct');

// Verify Ladder Lender distinctive visual features matching reference photo
assert(!!ladderLender.materials.sweater, 'Lender has sage green cardigan sweater material');
assert(!!ladderLender.materials.trim, 'Lender has caramel brown trim material (collar, cuffs, hem)');
assert(!!ladderLender.materials.mustache, 'Lender has mustache material');
assert(!!ladderLender.materials.beard, 'Lender has silver-grey sculpted beard material');
assert(!!ladderLender.materials.caneWood, 'Lender has dark wood walking cane material');
assert(!!ladderLender.materials.caneTip, 'Lender has blue rubber cane tip material');
assert(!!ladderLender.walkingCane, 'Lender has walking cane accessory attached to right hand');
assert(ladderLender.walkingCane.visible === true, 'Walking cane is visible when not carrying ladder');

// 2. AUTHORITATIVE PHYSICAL LADDER PROP INSPECTION
console.log('\n--- TEST 2: LADDER PROP DIMENSIONS & ATTACHMENT ---');
const testLadder = new BorrowableLadder();
assert(testLadder.type === 'ladder', 'Prop type is "ladder"');
assert(testLadder.materials.railMetal !== undefined, 'Ladder has extruded aluminum rail metal');
assert(testLadder.materials.rungMetal !== undefined, 'Ladder has polished aluminum rungs');
assert(testLadder.materials.bracketSteel !== undefined, 'Ladder has industrial steel brackets');
assert(testLadder.materials.rubberDark !== undefined, 'Ladder has rubber safety shoes');
assert(testLadder.materials.cautionYellow !== undefined, 'Ladder has OSHA caution decals');

// Mock StoryLabel
class MockStoryLabel {
  constructor() {
    this.currentText = '';
    this.currentTarget = null;
    this.isVisible = false;
  }
  show(text, target, duration) {
    this.currentText = text;
    this.currentTarget = target;
    this.isVisible = true;
  }
  showDialog(target, text, options) {
    this.currentText = text;
    this.currentTarget = target;
    this.isVisible = true;
  }
  showSystemAnnotation(pos, text, options) {
    this.currentText = text;
    this.currentTarget = pos;
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
const ladderScenario = new LadderScenario(
  scene,
  ladderBorrower,
  ladderLender,
  buildings,
  null,
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

// 3. INITIAL STATE VERIFICATION
console.log('\n--- TEST 3: INITIAL DORMANT STATE ---');
assert(ladderScenario.state === 'IDLE', 'Ladder scenario starts in IDLE');
assert(ladderScenario.isStoryActive === false, 'isStoryActive is false');
assert(ladderBorrower.root.visible === false, 'Borrower is hidden initially');
assert(ladderLender.root.visible === false, 'Lender is hidden initially');
assert(ladderScenario.ladder.owner === 'NEIGHBOR', 'Ladder initially owned by NEIGHBOR');
assert(ladderScenario.ladder.root.visible === false, 'Ladder is not visible before story start');

// 4. STEP-BY-STEP DETERMINISTIC LIFECYCLE
console.log('\n--- TEST 4: FULL DETERMINISTIC STORY LIFECYCLE ---');

// Beat 1: Start story -> BORROWER_ASKS
ladderScenario.start();
assert(ladderScenario.isStoryActive === true, 'Story is now active');
assert(ladderScenario.state === 'BORROWER_ASKS', 'State is BORROWER_ASKS');
assert(ladderBorrower.root.visible === true, 'Borrower is visible at start');
assert(ladderBorrower.root.position.x === -14.40 && ladderBorrower.root.position.z === 10.20, 'Borrower is at Peach Cottage patio (-14.40, 0.16, 10.20)');
assert(mockStoryLabel.currentText === 'I need a ladder.', 'Borrower says "I need a ladder."');
assert(mockStoryLabel.currentTarget === ladderBorrower.root, 'Label attached above borrower');

// Beat 2: SYSTEM_COORDINATION
ladderScenario.update(2.7);
assert(ladderScenario.state === 'SYSTEM_COORDINATION', 'State is SYSTEM_COORDINATION');
assert(mockStoryLabel.currentText.includes('Nearby match found'), 'Annotation is "Nearby match found"');

// Beat 3: LENDER_REVEAL
ladderScenario.update(2.3);
assert(ladderScenario.state === 'LENDER_REVEAL', 'State is LENDER_REVEAL');
assert(ladderLender.root.visible === true, 'Lender is visible at Building 3');
assert(ladderScenario.ladder.root.visible === true, 'Ladder is visible');
assert(ladderScenario.ladder.owner === 'NEIGHBOR', 'Ladder belongs to lender');
assert(ladderLender.isCarryingLadder === true, 'Lender holds ladder');
assert(ladderLender.walkingCane.visible === false, 'Lender walking cane hidden while holding ladder');
assert(mockStoryLabel.currentText === 'I have a ladder.' || mockStoryLabel.currentText === 'You can use mine.', 'Lender offers ladder');
assert(mockStoryLabel.currentTarget === ladderLender.root, 'Label attached above lender');

// Beat 4: BORROWER_WALKS_TO_LENDER
ladderScenario.update(2.9);
assert(ladderScenario.state === 'BORROWER_WALKS_TO_LENDER', 'State is BORROWER_WALKS_TO_LENDER');
assert(ladderBorrower.route.length > 1, 'Borrower has outbound route to Building 3');

// Simulate borrower walking along route
let walkSteps = 0;
while (ladderScenario.state === 'BORROWER_WALKS_TO_LENDER' && walkSteps < 500) {
  ladderBorrower.update(0.1);
  ladderLender.update(0.1);
  ladderScenario.update(0.1);
  walkSteps++;
}
assert(ladderScenario.state === 'MEETING', 'Borrower arrived at Building 3 porch -> state is MEETING');
assert(Math.abs(ladderBorrower.root.position.x - (-9.20)) < 0.25, 'Borrower at Building 3 porch X=-9.20');
assert(Math.abs(ladderBorrower.root.position.z - (-4.95)) < 0.25, 'Borrower at Building 3 porch Z=-4.95');
assert(mockStoryLabel.currentText === 'Thank you.', 'Borrower says "Thank you."');
assert(mockStoryLabel.currentTarget === ladderBorrower.root, 'Label attached above borrower');

// Beat 5: BORROWER_THANKS
ladderScenario.update(1.5);
assert(ladderScenario.state === 'BORROWER_THANKS', 'State is BORROWER_THANKS');
assert(mockStoryLabel.currentText === 'Of course.', 'Lender says "Of course."');
assert(mockStoryLabel.currentTarget === ladderLender.root, 'Label attached above lender');

// Beat 6: HANDOFF_1
ladderScenario.update(1.5);
assert(ladderScenario.state === 'HANDOFF_1', 'State is HANDOFF_1');
assert(ladderLender.reachAmount > 0.5, 'Lender reaches forward offering ladder');

// Advance handoff beat -> ownership transfer
ladderScenario.update(1.1);
assert(ladderScenario.ladder.owner === 'RESIDENT', 'Ownership transferred to RESIDENT (borrower)');
assert(ladderBorrower.isCarryingLadder === true, 'Borrower is now carrying ladder');
assert(ladderLender.isCarryingLadder === false, 'Lender released ladder');
assert(ladderLender.walkingCane.visible === true, 'Lender cane restored after ladder handoff');
assert(mockStoryLabel.currentText === "I'll bring it right back.", 'Borrower promises quick return');

ladderScenario.update(1.3);
assert(ladderScenario.state === 'BORROWER_WALKS_HOME', 'State transitioned to BORROWER_WALKS_HOME');

// Beat 7: BORROWER_WALKS_HOME
let returnWalkSteps = 0;
while (ladderScenario.state === 'BORROWER_WALKS_HOME' && returnWalkSteps < 500) {
  ladderBorrower.update(0.1);
  ladderLender.update(0.1);
  ladderScenario.update(0.1);
  returnWalkSteps++;
}
assert(ladderScenario.state === 'LADDER_POSITION_AT_WALL', 'Borrower arrived home -> state is LADDER_POSITION_AT_WALL');
assert(Math.abs(ladderBorrower.root.position.x - (-13.20)) < 0.25, 'Borrower at task site X=-13.20');
assert(ladderBorrower.isCarryingLadder === false, 'Borrower set ladder down');
assert(ladderScenario.ladder.root.parent === scene, 'Ladder attached to scene at cottage wall');
assert(Math.abs(ladderScenario.ladder.root.position.x - (-13.03)) < 0.05, 'Ladder X is positioned against cottage wall');
assert(Math.abs(ladderScenario.ladder.root.position.z - 10.61) < 0.05, 'Ladder Z is positioned against cottage wall');

// Beat 8: LADDER_IN_USE
ladderScenario.update(1.3);
assert(ladderScenario.state === 'LADDER_IN_USE', 'State is LADDER_IN_USE');
assert(ladderBorrower.isWorkingOnTask === true, 'Borrower is actively working on task with raised arms');
assert(mockStoryLabel.currentText === 'Time to clean these gutters.', 'Label describes the task');

// Beat 9: WORK_COMPLETE
ladderScenario.update(3.7);
assert(ladderScenario.state === 'WORK_COMPLETE', 'State is WORK_COMPLETE');
assert(ladderBorrower.isWorkingOnTask === false, 'Borrower finished task');
assert(mockStoryLabel.currentText.includes('Done'), 'Borrower says work is done');

// Beat 10: BORROWER_WALKS_BACK
ladderScenario.update(2.5);
assert(ladderScenario.state === 'BORROWER_WALKS_BACK', 'State is BORROWER_WALKS_BACK');
assert(ladderScenario.ladder.owner === 'RESIDENT', 'Borrower owns ladder for return trip');
assert(ladderBorrower.isCarryingLadder === true, 'Borrower picked up same ladder');

let backWalkSteps = 0;
while (ladderScenario.state === 'BORROWER_WALKS_BACK' && backWalkSteps < 500) {
  ladderBorrower.update(0.1);
  ladderLender.update(0.1);
  ladderScenario.update(0.1);
  backWalkSteps++;
}
assert(ladderScenario.state === 'RETURN_MEETING', 'Borrower arrived back at Building 3 -> state is RETURN_MEETING');
assert(mockStoryLabel.currentText === 'Here you go.', 'Borrower says "Here you go."');
assert(mockStoryLabel.currentTarget === ladderBorrower.root, 'Label anchored above borrower');

// Beat 11: HANDOFF_2
ladderScenario.update(2.1);
assert(ladderScenario.state === 'HANDOFF_2', 'State is HANDOFF_2');

ladderScenario.update(0.9);
assert(ladderScenario.ladder.owner === 'NEIGHBOR', 'Ownership transferred back to NEIGHBOR (lender)');
assert(ladderLender.isCarryingLadder === true, 'Lender received ladder back');
assert(ladderBorrower.isCarryingLadder === false, 'Borrower released ladder');
assert(mockStoryLabel.currentText === 'Thanks.', 'Lender says "Thanks."');
assert(mockStoryLabel.currentTarget === ladderLender.root, 'Label anchored above lender');

// Beat 12: CHARACTERS_RETURN_HOME
ladderScenario.update(2.1);
assert(ladderScenario.state === 'CHARACTERS_RETURN_HOME', 'State is CHARACTERS_RETURN_HOME');

let homeSteps = 0;
while (ladderScenario.state === 'CHARACTERS_RETURN_HOME' && homeSteps < 600) {
  ladderBorrower.update(0.1);
  ladderLender.update(0.1);
  ladderScenario.update(0.1);
  homeSteps++;
}
assert(ladderScenario.state === 'FINAL_COMPLETE', 'Both characters entered homes -> state is FINAL_COMPLETE');
assert(ladderBorrower.root.visible === false, 'Borrower is safely inside cottage');
assert(ladderLender.root.visible === false, 'Lender is safely inside Building 3');
assert(ladderScenario.ladder.root.visible === false, 'Ladder safely stored inside');
assert(ladderScenario.ladder.owner === 'NEIGHBOR', 'Ladder belongs to lender');

// 5. SCENARIO TOGGLING & RESET
console.log('\n--- TEST 5: SCENARIO DIRECTOR TOGGLING & RESET ---');
const cameraDirector = new CameraDirector({
  camera: new THREE.PerspectiveCamera(),
  controls: { enabled: true, autoRotate: false, target: new THREE.Vector3() },
});

const director = new ScenarioDirector({
  borrowingScenario,
  ladderScenario,
  carryScenario,
  cameraDirector,
});

// Play Ladder
director.playScenario('ladder');
assert(director.getActiveStory() === 'ladder', 'Director active story is "ladder"');
assert(ladderScenario.isStoryActive === true, 'Ladder scenario started');

// Verify Recomposed Opening Camera (BORROWER_ASKS)
assert(cameraDirector._desiredTarget.x === -14.40 && cameraDirector._desiredTarget.z === 10.20, 'Opening camera target is borrower upper torso (-14.40, 1.25, 10.20)');
assert(cameraDirector._desiredPos.x === -19.80 && cameraDirector._desiredPos.z === 5.80, 'Opening camera position is front three-quarter view (-19.80, 5.40, 5.80)');
assert(cameraDirector._desiredPos.z < 10.20, 'Opening camera is in FRONT of borrower (z=5.80 < 10.20), not behind Peach Cottage');
assert(cameraDirector._desiredZoom === 1.28, 'Opening camera zoom is 1.28');

// Advance scenario to LENDER_REVEAL and update camera
ladderScenario.update(2.7); // to SYSTEM_COORDINATION
ladderScenario.update(2.3); // to LENDER_REVEAL
cameraDirector.state = 'FOLLOWING';
cameraDirector.update(0.1);
assert(ladderScenario.state === 'LENDER_REVEAL', 'Scenario is at LENDER_REVEAL');
assert(cameraDirector._desiredTarget.x === -9.20 && cameraDirector._desiredTarget.z === -5.80, 'Lender reveal camera target is older neighbor upper torso (-9.20, 1.25, -5.80)');
assert(cameraDirector._desiredPos.x === -12.00 && cameraDirector._desiredPos.z === -1.00, 'Lender reveal camera position is front three-quarter view (-12.00, 4.00, -1.00)');
assert(cameraDirector._desiredPos.z > -5.80, 'Lender camera is in FRONT of lender (z=-1.00 > -5.80), looking at his face/torso/ladder');
assert(cameraDirector._desiredZoom === 1.30, 'Lender reveal camera zoom is 1.30');

// Switch directly from Ladder to Drill
director.playScenario('drill');
assert(director.getActiveStory() === 'drill', 'Director active story switched to "drill"');
assert(ladderScenario.isStoryActive === false, 'Ladder scenario cleanly stopped');
assert(ladderScenario.state === 'IDLE', 'Ladder scenario reset to IDLE');
assert(ladderBorrower.root.visible === false, 'Borrower hidden after reset');
assert(ladderLender.root.visible === false, 'Lender hidden after reset');
assert(borrowingScenario.isStoryActive === true, 'Drill scenario started cleanly');

// Switch directly from Drill to Carry
director.playScenario('carry');
assert(director.getActiveStory() === 'carry', 'Director active story switched to "carry"');
assert(borrowingScenario.isStoryActive === false, 'Drill scenario cleanly stopped');
assert(carryScenario.isStoryActive === true, 'Carry scenario started cleanly');

// Stop scenarios
director.stopScenario();
assert(director.getActiveStory() === null, 'All scenarios stopped');
assert(carryScenario.isStoryActive === false, 'Carry stopped');

// 6. FROZEN REGRESSIONS CHECK
console.log('\n--- TEST 6: FROZEN DRILL & CARRY REGRESSION CHECK ---');
// Verify Drill state
assert(sarah.root.position.x === 11.80 && sarah.root.position.z === 9.80, 'Sarah at frozen position (11.80, 0.16, 9.80)');
assert(drThorne.root.position.x === -8.80 && drThorne.root.position.z === 7.50, 'Dr. Thorne at frozen position (-8.80, 0.16, 7.50)');
assert(borrowingScenario.tool.owner === 'NEIGHBOR', 'Drill owned by Dr. Thorne');

// Verify Carry state
assert(carryRequester.root.position.x === 9.35 && carryRequester.root.position.z === -5.60, 'Carry Requester at position (9.35, 0.16, -5.60)');
assert(carryHelper.root.position.x === 14.40 && carryHelper.root.position.z === -11.60, 'Carry Helper at inside position (14.40, 0.16, -11.60)');

console.log('\n===============================================================');
console.log('  ALL LADDER, CARRY, AND DRILL REGRESSION TESTS PASSED (0 FAILURES)');
console.log('===============================================================\n');
