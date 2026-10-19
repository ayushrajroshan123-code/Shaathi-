import * as THREE from 'three';
import { TrafficSystem } from './trafficSystem';
import { DioramaPerson } from './dioramaPeople';
import { BorrowingScenario } from './borrowingScenario';
import { LadderScenario } from './ladderScenario';
import { CarryScenario } from './carryScenario';
import { ScenarioDirector } from './scenarioDirector';
import { CameraDirector } from './cameraDirector';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createDioramaMaterials } from './dioramaMaterials';
import { createDioramaPlatform } from './dioramaPlatform';
import { createDioramaRoads } from './dioramaRoads';
import { createDioramaBuildings } from './dioramaBuildings';
import { createDioramaVehicles } from './dioramaVehicles';
import { createDioramaProps } from './dioramaProps';
import { setupDioramaLighting } from './dioramaLighting';
import { StoryLabel } from './storyLabel';

/**
 * NeighborhoodScene
 * Reconstructed reference-driven 3D miniature neighborhood environment:
 * - True Orthographic Isometric camera framing the diorama platform
 * - Smooth OrbitControls with constrained damping, zoom, and orientation
 * - Soft PCF shadow map and ACES Filmic tone mapping
 * - Animated Reset Camera transition returning to the visual authority viewpoint
 * - High-efficiency lifecycle and complete memory disposal
 */

export class NeighborhoodScene {
  constructor(container) {
    this.container = container;
    this.animationFrameId = null;
    this.isDisposed = false;

    // Balanced Visual Authority Viewpoint:
    // Captures the complete neighborhood context (houses, roads, moving pink van, trees)
    // while perfectly framing the central crosswalks and active character interactions.
    this.defaultCameraPos = new THREE.Vector3(22.0, 17.0, 24.0);
    this.defaultCameraTarget = new THREE.Vector3(0.0, 1.4, 0.8);
    this.frustumSize = 22.0;

    // Reset Camera Animation State
    this.isResettingCamera = false;
    this.resetStartTime = 0;
    this.resetDuration = 850; // ms
    this.resetStartPos = new THREE.Vector3();
    this.resetStartTarget = new THREE.Vector3();
    this.resetStartZoom = 1.0;

    // Focus Camera Animation State
    this.isFocusingCamera = false;
    this.focusStartTime = 0;
    this.focusDuration = 750; // ms
    this.focusStartPos = new THREE.Vector3();
    this.focusStartTarget = new THREE.Vector3();
    this.focusStartZoom = 1.0;
    this.focusTargetPos = new THREE.Vector3();
    this.focusTargetLookAt = new THREE.Vector3();
    this.focusTargetZoom = 1.35;

    // Mode State (0.0 = Normal, 1.0 = Emergency)
    this.mode = 'normal';
    this.modeProgress = 0.0;
    this.isTransitioningMode = false;
    this.modeTransitionStartTime = 0;
    this.modeTransitionDuration = 1500; // ~1.5s
    this.startModeProgress = 0.0;
    this.targetModeProgress = 0.0;

    // Palette targets (Section 17 Normal & Section 22 Emergency)
    this.skyColorNormal = new THREE.Color(0xF0F4F8);
    this.skyColorEmergency = new THREE.Color(0xD8C8BD);
    this.sunColorNormal = new THREE.Color(0xFFE8B8);
    this.sunColorEmergency = new THREE.Color(0xE8D2B5);
    this.groundColorNormal = new THREE.Color(0xFBF1DC);
    this.groundColorEmergency = new THREE.Color(0xE5DED1);
    this.grassColorNormal = new THREE.Color(0x8CCB7E);
    this.grassColorEmergency = new THREE.Color(0x71936E);
    this.treesColorNormal = new THREE.Color(0x6FAF68);
    this.treesColorEmergency = new THREE.Color(0x637B66);
    this.roadColorNormal = new THREE.Color(0xD9D0C2);
    this.roadColorEmergency = new THREE.Color(0xC8C2B9);

    // Callbacks & Overlay coordination
    this.onCameraUpdate = null;
    this.onSelectLot = null;
    this.isAutoTouring = false;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / height;

    // Responsive frustum adaptation: wider on mobile portrait to fit entire diorama
    const effectiveFrustum = aspect < 1.0 ? Math.max(this.frustumSize, 58.0 / aspect) : this.frustumSize;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = this.skyColorNormal.clone();

    // 2. True Orthographic Isometric Camera
    this.camera = new THREE.OrthographicCamera(
      (-effectiveFrustum * aspect) / 2,
      (effectiveFrustum * aspect) / 2,
      effectiveFrustum / 2,
      -effectiveFrustum / 2,
      0.1,
      350
    );
    this.camera.position.copy(this.defaultCameraPos);
    this.camera.lookAt(this.defaultCameraTarget);

    // 3. Renderer with Studio Tone Mapping and Soft Shadows
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;

    this.container.appendChild(this.renderer.domElement);

    if (typeof window !== 'undefined') {
      window.__THREE_RENDERER__ = this.renderer;
    }

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.copy(this.defaultCameraTarget);
    this.controls.autoRotate = false; // Strictly disabled: camera remains stable

    // Zoom limits (OrthographicCamera uses zoom scale)
    this.controls.minZoom = 0.5;
    this.controls.maxZoom = 3.5;

    // Polar angle limits (strictly above ground, prevents inverted viewing)
    this.controls.minPolarAngle = Math.PI / 8; // ~22.5°
    this.controls.maxPolarAngle = Math.PI / 2.15; // ~83.7°

    // Panning & Touch settings
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    // Allow normal document scrolling when pointer is over the 3D canvas,
    // while preserving pinch-to-zoom (trackpad pinch emits wheel with ctrlKey: true)
    // and Ctrl+wheel zooming. Drag continues to orbit normally.
    this.onCanvasWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) {
        // Standard mouse wheel or 2-finger scroll without Ctrl modifier:
        // Stop OrbitControls from capturing and calling preventDefault(),
        // allowing the event to bubble to the window for natural document scrolling.
        e.stopImmediatePropagation();
      }
    };
    this.renderer.domElement.addEventListener('wheel', this.onCanvasWheel, { capture: true, passive: true });

    // 5. Materials Library
    this.materials = createDioramaMaterials();

    // 6. Studio Lighting + RoomEnvironment
    this.lighting = setupDioramaLighting(this.scene, this.renderer);

    // 7. Reconstructed Diorama Geometry Hierarchy
    this.platform = createDioramaPlatform(this.materials);
    this.scene.add(this.platform);

    this.roads = createDioramaRoads(this.materials);
    this.scene.add(this.roads);

    this.buildings = createDioramaBuildings(this.materials);
    this.scene.add(this.buildings);

    this.vehicles = createDioramaVehicles(this.materials);
    this.scene.add(this.vehicles);

    this.props = createDioramaProps(this.materials);
    this.scene.add(this.props);

    this.trafficSystem = new TrafficSystem(this.scene);
    
    // Animated Residents: Female Resident + Second Neighbor Resident
    this.demoResident = new DioramaPerson({ variant: 'girl' });
    this.demoResident.root.name = 'DemoResident_Girl';
    this.scene.add(this.demoResident.root);

    this.demoNeighbor = new DioramaPerson({ variant: 'neighbor' });
    this.demoNeighbor.root.name = 'DemoResident_Neighbor';
    this.scene.add(this.demoNeighbor.root);

    // Dedicated Characters for Ladder Story:
    // Borrower (Peach Cottage, boy_blue) and Older Neighbor Lender (Building 3, ladder_lender from reference)
    this.ladderBorrower = new DioramaPerson({ variant: 'boy_blue' });
    this.ladderBorrower.root.name = 'DemoResident_LadderBorrower';
    this.scene.add(this.ladderBorrower.root);
    this.ladderBoy = this.ladderBorrower;

    this.ladderLender = new DioramaPerson({ variant: 'ladder_lender' });
    this.ladderLender.root.name = 'DemoResident_LadderLender';
    this.scene.add(this.ladderLender.root);
    this.ladderNeighbor = this.ladderLender;

    // Helper resident for Carry Scenario (Streetwear Overalls & Bucket Hat Figurine from reference)
    this.carryHelper = new DioramaPerson({ variant: 'helper' });
    this.carryHelper.root.name = 'DemoResident_CarryHelper';
    this.scene.add(this.carryHelper.root);

    // Requester resident for Carry Scenario (Streetwear Cap, Bangs & Pink Bomber Figurine from Reference Image 1)
    this.carryRequester = new DioramaPerson({ variant: 'carry_requester' });
    this.carryRequester.root.name = 'DemoResident_CarryRequester';
    this.scene.add(this.carryRequester.root);

    // StoryLabel: World-anchored HTML dialogue annotation over 3D actors
    this.storyLabel = new StoryLabel(this.container, this.camera);

    // SAATHI Phase 3: Resident Neighbor Borrowing Interaction (drill scenario)
    this.borrowingScenario = new BorrowingScenario(
      this.scene,
      this.demoResident,
      this.demoNeighbor,
      this.buildings,
      this.renderer,
      this.camera,
      this.container,
      this.storyLabel
    );

    // SAATHI Ladder Borrowing Interaction (full lifecycle)
    this.ladderScenario = new LadderScenario(
      this.scene,
      this.ladderBorrower,
      this.ladderLender,
      this.buildings,
      this.trafficSystem,
      this.renderer,
      this.camera,
      this.container,
      this.storyLabel
    );

    // SAATHI Phase 4: Help carry something (two completely new characters: carryRequester + carryHelper)
    this.carryScenario = new CarryScenario(
      this.scene,
      this.carryRequester,
      this.carryHelper,
      this.buildings,
      this.renderer,
      this.camera,
      this.container,
      this.storyLabel
    );

    // CameraDirector: Central orchestrator of cinematic compositions and follow camera
    this.cameraDirector = new CameraDirector({
      camera: this.camera,
      controls: this.controls,
      defaultCameraPos: this.defaultCameraPos,
      defaultCameraTarget: this.defaultCameraTarget,
    });

    // ScenarioDirector: Single orchestrator of landing-page stories
    this.onBeat = null;
    this.onStoryChange = null;
    this.scenarioDirector = new ScenarioDirector({
      borrowingScenario: this.borrowingScenario,
      ladderScenario: this.ladderScenario,
      carryScenario: this.carryScenario,
      cameraDirector: this.cameraDirector,
      onBeat: (text) => {
        if (typeof this.onBeat === 'function') {
          this.onBeat(text);
        }
      },
      onStoryChange: (storyId) => {
        if (typeof this.onStoryChange === 'function') {
          this.onStoryChange(storyId);
        }
      }
    });

    // Register pedestrians with traffic system for zero-collision crosswalk safety
    if (this.trafficSystem) {
      this.trafficSystem.registerPedestrian(this.demoResident);
      this.trafficSystem.registerPedestrian(this.demoNeighbor);
      this.trafficSystem.registerPedestrian(this.ladderBoy);
      this.trafficSystem.registerPedestrian(this.ladderNeighbor);
      this.trafficSystem.registerPedestrian(this.carryRequester);
      this.trafficSystem.registerPedestrian(this.carryHelper);
    }

    this.lastFrameTime = performance.now();

    // 7B. Lot Highlight & Selection Indicators on Platform
    this.lotHighlightIndicators = {};
    const indicatorLotPositions = {
      1: { x: 11.8, z: 11.6, r: 3.5 },
      2: { x: -8.8, z: 8.8, r: 3.4 },
      3: { x: -14.4, z: 13.0, r: 3.2 },
      4: { x: -9.2, z: -9.2, r: 4.0 },
      5: { x: 9.0, z: -9.0, r: 3.5 },
      6: { x: 14.4, z: -12.8, r: 3.5 },
    };

    const indicatorsGroup = new THREE.Group();
    indicatorsGroup.name = 'LotHighlightIndicators';

    Object.entries(indicatorLotPositions).forEach(([lotIdStr, pos]) => {
      const id = parseInt(lotIdStr, 10);
      
      // 1. Selection indicator: high contrast double ring (crisp dark + teal)
      const selGroup = new THREE.Group();
      selGroup.position.set(pos.x, 0.08, pos.z);
      selGroup.rotation.x = -Math.PI / 2;
      selGroup.visible = false;

      const outerRingGeo = new THREE.RingGeometry(pos.r - 0.12, pos.r + 0.18, 36);
      const outerRingMat = new THREE.MeshBasicMaterial({ color: 0x1A201E, side: THREE.DoubleSide });
      const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
      selGroup.add(outerRing);

      const innerRingGeo = new THREE.RingGeometry(pos.r - 0.38, pos.r - 0.15, 36);
      const innerRingMat = new THREE.MeshBasicMaterial({ color: 0x2F8F8A, side: THREE.DoubleSide });
      const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
      selGroup.add(innerRing);

      // 2. Pulse filter indicator
      const pulseGeo = new THREE.RingGeometry(pos.r - 0.22, pos.r + 0.08, 36);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: 0x2F8F8A,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      });
      const pulseRing = new THREE.Mesh(pulseGeo, pulseMat);
      pulseRing.position.set(pos.x, 0.06, pos.z);
      pulseRing.rotation.x = -Math.PI / 2;
      pulseRing.visible = false;

      indicatorsGroup.add(selGroup);
      indicatorsGroup.add(pulseRing);

      this.lotHighlightIndicators[id] = {
        selectionRing: selGroup,
        pulseRing: pulseRing,
      };
    });
    this.scene.add(indicatorsGroup);

    // 8. Event Listeners & 3D Raycasting for Lot Click vs Empty Scene Click
    const LOT_NAME_MAP = {
      Quad1_ForegroundCatBuilding: 1,
      Quad2_Corner3StoryBuilding: 2,
      Quad2_GabledPeachCottage: 3,
      Quad3_RearAnchorMarketBuilding: 4,
      Quad4_CornerExhaustBuilding: 5,
      Quad4_RooftopGardenBuilding: 6,
    };
    this.raycaster = new THREE.Raycaster();
    this.pointerDownPos = { x: 0, y: 0 };

    this.onPointerDown = (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    this.onPointerUp = (e) => {
      if (this.isDisposed) return;
      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (dist > 6) return; // User was orbiting/dragging, not clicking stationary

      if (!this.renderer || !this.renderer.domElement) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      this.raycaster.setFromCamera(mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.buildings ? this.buildings.children : [], true);

      if (intersects.length > 0) {
        let obj = intersects[0].object;
        let foundLotId = null;
        while (obj && obj !== this.scene) {
          if (obj.userData && obj.userData.lotId) {
            foundLotId = obj.userData.lotId;
            break;
          }
          if (obj.name && LOT_NAME_MAP[obj.name]) {
            foundLotId = LOT_NAME_MAP[obj.name];
            break;
          }
          obj = obj.parent;
        }
        if (foundLotId) {
          if (typeof this.onSelectLot === 'function') {
            this.onSelectLot(foundLotId);
          }
          return;
        }
      }

      // If user clicked empty diorama platform or background canvas
      if (typeof this.onSelectEmptyScene === 'function') {
        this.onSelectEmptyScene();
      }
    };

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);

    this.onWindowResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.onWindowResize);

    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.onWindowResize());
      this.resizeObserver.observe(this.container);
    }

    // 9. Start Render Loop
    this.animate = this.animate.bind(this);
    this.animate();

    if (typeof window !== 'undefined') {
      window.__NEIGHBORHOOD_SCENE__ = this;
    }
  }

  onWindowResize() {
    if (this.isDisposed || !this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    const aspect = width / height;

    // Responsive frustum adaptation: wider on mobile portrait to fit entire diorama
    const effectiveFrustum = aspect < 1.0 ? Math.max(this.frustumSize, 58.0 / aspect) : this.frustumSize;

    this.camera.left = (-effectiveFrustum * aspect) / 2;
    this.camera.right = (effectiveFrustum * aspect) / 2;
    this.camera.top = effectiveFrustum / 2;
    this.camera.bottom = -effectiveFrustum / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  }

  resetCamera(duration = 900) {
    this.isFocusingCamera = false;
    this.isAutoTouring = false;
    if (this.controls) {
      this.controls.autoRotate = false;
    }
    if (this.cameraDirector) {
      this.cameraDirector.returnToEstablishing(duration);
    }
  }

  focusOnLot(lotId) {
    const lotPositions = {
      1: { x: 11.8, y: 2.5, z: 11.6 },
      2: { x: -8.8, y: 3.5, z: 8.8 },
      3: { x: -14.4, y: 2.8, z: 13.0 },
      4: { x: -9.2, y: 4.5, z: -9.2 },
      5: { x: 9.0, y: 3.5, z: -9.0 },
      6: { x: 14.4, y: 3.0, z: -12.8 },
    };
    const target = lotPositions[lotId];
    if (!target) return;

    this.isAutoTouring = false;
    if (this.controls) {
      this.controls.autoRotate = false;
    }
    this.isFocusingCamera = true;
    this.focusStartTime = performance.now();
    this.focusStartPos.copy(this.camera.position);
    this.focusStartTarget.copy(this.controls.target);
    this.focusStartZoom = this.camera.zoom;

    this.focusTargetLookAt.set(target.x, target.y, target.z);
    // Maintain cinematic 45° elevation diagonal viewpoint offset
    this.focusTargetPos.set(target.x + 32, target.y + 30, target.z + 32);
    this.focusTargetZoom = 1.35;
  }

  setLotHighlights(highlightedLotIds = [], selectedLotId = null) {
    if (!this.lotHighlightIndicators) return;
    const highlightArr = Array.isArray(highlightedLotIds) ? highlightedLotIds : [];
    Object.entries(this.lotHighlightIndicators).forEach(([lotIdStr, indicator]) => {
      const id = parseInt(lotIdStr, 10);
      const isSelected = selectedLotId === id;
      const isHighlighted = highlightArr.includes(id);

      if (indicator.selectionRing) {
        indicator.selectionRing.visible = isSelected;
      }
      if (indicator.pulseRing) {
        indicator.pulseRing.visible = isHighlighted && !isSelected;
      }
    });
  }

  setMode(mode, duration = 1500) {
    if (mode === this.mode && !this.isTransitioningMode) return;
    this.mode = mode;
    this.targetModeProgress = mode === 'emergency' ? 1.0 : 0.0;
    this.startModeProgress = this.modeProgress;
    this.modeTransitionStartTime = performance.now();
    this.modeTransitionDuration = duration;
    this.isTransitioningMode = true;
    if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
  }

  applyModeProgress(p) {
    if (!this.scene) return;

    // 1. Scene Background (Sky)
    if (this.scene.background && this.scene.background.isColor) {
      this.scene.background.lerpColors(this.skyColorNormal, this.skyColorEmergency, p);
    }

    // 2. Sun / Key Light
    if (this.lighting && this.lighting.dirLight) {
      this.lighting.dirLight.color.lerpColors(this.sunColorNormal, this.sunColorEmergency, p);
      // Key light intensity: 100% -> 68%
      this.lighting.dirLight.intensity = THREE.MathUtils.lerp(2.15, 2.15 * 0.68, p);
    }

    // 3. Ambient Hemisphere Light
    if (this.lighting && this.lighting.hemiLight) {
      this.lighting.hemiLight.color.lerpColors(this.skyColorNormal, this.skyColorEmergency, p);
      this.lighting.hemiLight.groundColor.lerpColors(this.groundColorNormal, this.groundColorEmergency, p);
      // Ambient intensity: 100% -> 78%
      this.lighting.hemiLight.intensity = THREE.MathUtils.lerp(1.05, 1.05 * 0.78, p);
    }

    // 4. Materials Palette
    if (this.materials) {
      if (this.materials.grassLawn) {
        this.materials.grassLawn.color.lerpColors(this.grassColorNormal, this.grassColorEmergency, p);
      }
      if (this.materials.treeFoliageMid) {
        this.materials.treeFoliageMid.color.lerpColors(this.treesColorNormal, this.treesColorEmergency, p);
      }
      if (this.materials.asphalt) {
        this.materials.asphalt.color.lerpColors(this.roadColorNormal, this.roadColorEmergency, p);
      }
      if (this.materials.platformBase) {
        this.materials.platformBase.color.lerpColors(this.groundColorNormal, this.groundColorEmergency, p);
      }
    }

    // 5. Tone mapping exposure: 1.02 -> 0.81 (80% environment brightness)
    if (this.renderer) {
      this.renderer.toneMappingExposure = THREE.MathUtils.lerp(1.02, 0.81, p);
    }
  }

  getScreenCoordinates(x, y, z) {
    if (!this.camera || !this.renderer || !this.container) return null;
    const vector = new THREE.Vector3(x, y, z);
    vector.project(this.camera);

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    const screenX = (vector.x * 0.5 + 0.5) * width;
    const screenY = (-(vector.y * 0.5) + 0.5) * height;

    return {
      x: Math.round(screenX),
      y: Math.round(screenY),
      visible: vector.z < 1.0,
    };
  }

  toggleAutoTour() {
    this.isAutoTouring = !this.isAutoTouring;
    if (this.controls) {
      this.controls.autoRotate = this.isAutoTouring;
      this.controls.autoRotateSpeed = 0.8;
    }
    return this.isAutoTouring;
  }

  getActiveStory() {
    return this.scenarioDirector ? this.scenarioDirector.getActiveStory() : null;
  }

  toggleScenario(id) {
    if (!this.scenarioDirector) return null;
    return this.scenarioDirector.toggleScenario(id);
  }

  playScenario(id) {
    if (this.scenarioDirector) {
      this.isFocusingCamera = false;
      this.isAutoTouring = false;
      this.scenarioDirector.playScenario(id);
    }
  }

  stopScenario() {
    if (this.scenarioDirector) {
      this.scenarioDirector.stopScenario();
    }
  }

  startStory() {
    // In Phase 1, stories do not auto-play on scroll.
    // They play on explicit user selection via playScenario(id).
  }

  pauseStory() {
    if (this.scenarioDirector) {
      this.scenarioDirector.pause();
    }
  }

  resumeStory() {
    if (this.scenarioDirector) {
      this.scenarioDirector.resume();
    }
  }

  resetStory() {
    if (this.scenarioDirector) {
      this.scenarioDirector.stopScenario();
    }
  }

  animate() {
    if (this.isDisposed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const rawDelta = this.lastFrameTime ? (now - this.lastFrameTime) / 1000 : 0.016;
    this.lastFrameTime = now;
    const delta = Math.min(rawDelta, 0.05);

    if (this.trafficSystem) this.trafficSystem.update(delta);
    if (this.scenarioDirector) this.scenarioDirector.update(delta);
    if (this.demoResident) this.demoResident.update(delta);
    if (this.demoNeighbor) this.demoNeighbor.update(delta);
    if (this.ladderBoy) this.ladderBoy.update(delta);
    if (this.ladderNeighbor) this.ladderNeighbor.update(delta);
    if (this.carryRequester) this.carryRequester.update(delta);
    if (this.carryHelper) this.carryHelper.update(delta);
    if (this.scenarioDirector) this.scenarioDirector.postUpdate(delta);

    // Update CameraDirector (cinematic follow, reframe, handoff, and return)
    if (this.cameraDirector) {
      this.cameraDirector.update(delta);
    }

    // Update world-anchored story dialogue label projection
    if (this.storyLabel) {
      this.storyLabel.update();
    }

    // Smooth Focus Camera Interpolation
    if (this.isFocusingCamera) {
      const now = performance.now();
      const elapsed = now - this.focusStartTime;
      const progress = Math.min(1, elapsed / this.focusDuration);
      const t = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.camera.position.lerpVectors(this.focusStartPos, this.focusTargetPos, t);
      this.controls.target.lerpVectors(this.focusStartTarget, this.focusTargetLookAt, t);
      this.camera.zoom = THREE.MathUtils.lerp(this.focusStartZoom, this.focusTargetZoom, t);
      this.camera.updateProjectionMatrix();

      if (progress >= 1) {
        this.isFocusingCamera = false;
      }
    }

    // Smooth Operational Mode Transition Interpolation (~1.5s)
    if (this.isTransitioningMode) {
      const now = performance.now();
      const elapsed = now - this.modeTransitionStartTime;
      const progress = Math.min(1, elapsed / this.modeTransitionDuration);
      const t = 0.5 - 0.5 * Math.cos(progress * Math.PI); // smooth sinusoidal ease
      this.modeProgress = THREE.MathUtils.lerp(this.startModeProgress, this.targetModeProgress, t);

      this.applyModeProgress(this.modeProgress);
      if (this.renderer) this.renderer.shadowMap.needsUpdate = true;

      if (progress >= 1) {
        this.isTransitioningMode = false;
        this.modeProgress = this.targetModeProgress;
        this.applyModeProgress(this.modeProgress);
        if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
      }
    }

    // OrbitControls update only runs in idle ESTABLISHING mode so it never fights CameraDirector
    if (!this.cameraDirector || this.cameraDirector.state === 'ESTABLISHING') {
      if (this.controls) {
        this.controls.update();
      }
    }

    this.renderer.render(this.scene, this.camera);

    if (this.onCameraUpdate) {
      this.onCameraUpdate();
    }
  }

  dispose() {
    this.isDisposed = true;
    if (this.storyLabel) this.storyLabel.dispose();
    if (this.cameraDirector) this.cameraDirector.dispose();
    if (this.scenarioDirector) this.scenarioDirector.dispose();
    if (this.trafficSystem) this.trafficSystem.dispose();
    if (this.borrowingScenario) this.borrowingScenario.dispose();
    if (this.ladderScenario) this.ladderScenario.dispose();
    if (this.carryScenario) this.carryScenario.dispose();
    if (this.demoResident && this.demoResident.dispose) this.demoResident.dispose();
    if (this.demoNeighbor && this.demoNeighbor.dispose) this.demoNeighbor.dispose();
    if (this.ladderBoy && this.ladderBoy.dispose) this.ladderBoy.dispose();
    if (this.ladderNeighbor && this.ladderNeighbor.dispose) this.ladderNeighbor.dispose();
    if (this.carryHelper && this.carryHelper.dispose) this.carryHelper.dispose();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener('resize', this.onWindowResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.controls) {
      this.controls.dispose();
    }

    if (this.onCanvasWheel && this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('wheel', this.onCanvasWheel, { capture: true });
    }

    if (this.onPointerDown && this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    }

    if (this.onPointerUp && this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    }

    if (this.lighting && this.lighting.dispose) {
      this.lighting.dispose();
    }

    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}
