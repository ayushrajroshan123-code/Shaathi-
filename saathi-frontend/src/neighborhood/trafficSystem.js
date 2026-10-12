import * as THREE from 'three';
import { ROAD_LAYOUT } from './dioramaRoads.js';

export const CONFIG = {
  // Timings in seconds
  timings: {
    nsGreen: 8, nsYellow: 2, allRed1: 1,
    ewGreen: 8, ewYellow: 2, allRed2: 1
  },
  // Speeds in units per second
  speeds: {
    CompactCar_White: 5.0,
    DeliveryVan_YellowStripe: 3.5,
    Scooter_WithRider: 4.5,
    PinkDeliveryTruck_Parked: 3.8
  },
  // Distances
  brakingDistance: 5.0,
  stopThreshold: 1.0,
  minCarGap: 4.5,
  gapSlowdownThreshold: 8.0,
  // Max time step for physics
  maxDelta: 0.05,
  // Stopping bounds
  stopping: {
    zebraCrossingClearance: 0.5,
    vehicleFrontOffset: 1.2
  },
  // Vehicle lifecycle
  trafficLifecycle: {
    dissolveStart: 12.0,
    dissolveEnd: 18.0,
    exitMargin: 1.0,
    respawnDelay: 2.0,
    entryOffset: 2.0
  }
};

export class TrafficLightController {
  constructor() {
    this.state = {
      time: 0,
      phase: 0 // 0: NS Green, 1: NS Yellow, 2: All Red 1, 3: EW Green, 4: EW Yellow, 5: All Red 2
    };
    this.phases = [
      { duration: CONFIG.timings.nsGreen, ns: 'green', ew: 'red' },
      { duration: CONFIG.timings.nsYellow, ns: 'yellow', ew: 'red' },
      { duration: CONFIG.timings.allRed1, ns: 'red', ew: 'red' },
      { duration: CONFIG.timings.ewGreen, ns: 'red', ew: 'green' },
      { duration: CONFIG.timings.ewYellow, ns: 'red', ew: 'yellow' },
      { duration: CONFIG.timings.allRed2, ns: 'red', ew: 'red' }
    ];
  }

  update(delta) {
    this.state.time += delta;
    const currentPhase = this.phases[this.state.phase];
    
    if (this.state.time >= currentPhase.duration) {
      this.state.time -= currentPhase.duration;
      this.state.phase = (this.state.phase + 1) % this.phases.length;
    }
  }

  getState(direction) {
    const currentPhase = this.phases[this.state.phase];
    return direction === 'north-south' ? currentPhase.ns : currentPhase.ew;
  }

  isWalkAllowed(crossingDirection) {
    // crossingDirection is the road the pedestrian is crossing
    return this.getState(crossingDirection) === 'red';
  }
}

export class TrafficSystem {
  constructor(scene) {
    this.scene = scene;
    this.controller = new TrafficLightController();
    this.cars = [];
    this.lamps = {};
    
    // Use actual road geometry from dioramaRoads.js
    this.lanes = {
      'westbound': { dir: 'east-west', vec: new THREE.Vector3(-1, 0, 0), z: -ROAD_LAYOUT.laneCenterOffset },
      'eastbound': { dir: 'east-west', vec: new THREE.Vector3(1, 0, 0), z: ROAD_LAYOUT.laneCenterOffset },
      'northbound': { dir: 'north-south', vec: new THREE.Vector3(0, 0, -1), x: ROAD_LAYOUT.laneCenterOffset },
      'southbound': { dir: 'north-south', vec: new THREE.Vector3(0, 0, 1), x: -ROAD_LAYOUT.laneCenterOffset }
    };
    this.pedestrians = [];

    this.initLights();
    this.initCars();
  }

  registerPedestrian(person) {
    if (person && !this.pedestrians.includes(person)) {
      this.pedestrians.push(person);
    }
  }

  isPedestrianOnCrosswalk(laneId) {
    if (!this.pedestrians || this.pedestrians.length === 0) return false;
    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      if (!p.root || !p.root.visible) continue;
      const pos = p.root.position;
      const carriesLadder = !!p.isCarryingLadder;
      // Extra bounding clearance for ladder (length 1.62m -> +/-0.81m in travel direction)
      const ladderClearance = carriesLadder ? 0.95 : 0.40;

      // Westbound lane (Z ~ -1.65, moving toward -X along East-West road)
      // Crosswalk 1 is at X = -4.80. Roadway Z in [-3.30, 0.00]
      if (laneId === 'westbound') {
        if (pos.x >= -4.80 - 1.80 - ladderClearance && pos.x <= -4.80 + 1.80 + ladderClearance) {
          if (pos.z >= -3.60 - ladderClearance && pos.z <= 0.60 + ladderClearance) {
            return true;
          }
        }
      }

      // Eastbound lane (Z ~ +1.65, moving toward +X along East-West road)
      // Crosswalk 1 is at X = -4.80. Roadway Z in [0.00, 3.30]
      if (laneId === 'eastbound') {
        if (pos.x >= -4.80 - 1.80 - ladderClearance && pos.x <= -4.80 + 1.80 + ladderClearance) {
          if (pos.z >= -0.60 - ladderClearance && pos.z <= 3.60 + ladderClearance) {
            return true;
          }
        }
      }

      // Southbound lane (X ~ -1.65, moving toward +Z along North-South road)
      // Crosswalk 2 is at Z = -4.80. Roadway X in [-3.30, 0.00]
      if (laneId === 'southbound') {
        if (pos.z >= -4.80 - 1.80 - ladderClearance && pos.z <= -4.80 + 1.80 + ladderClearance) {
          if (pos.x >= -3.60 - ladderClearance && pos.x <= 0.60 + ladderClearance) {
            return true;
          }
        }
        // Also Crosswalk 3 (North-South road at Z ~ 3.45 to 4.80 for girl Martha)
        if (pos.z >= 1.80 - ladderClearance && pos.z <= 5.20 + ladderClearance) {
          if (pos.x >= -3.60 - ladderClearance && pos.x <= 0.60 + ladderClearance) {
            return true;
          }
        }
      }
    }
    return false;
  }

  initLights() {
    this.scene.traverse((child) => {
      if (child.name && child.name.startsWith('TrafficLamp_')) {
        const globe = child.getObjectByName('LampGlobe');
        if (globe) {
          this.lamps[child.name] = globe;
        }
      }
    });
  }

  initCars() {
    let dVehicles = null;
    this.scene.traverse((c) => {
      if (c.name === 'DioramaVehicles') {
        dVehicles = c;
      }
    });
    
    if (!dVehicles) {
      this.scene.children.forEach(c => {
        if (c.getObjectByName('CompactCar_White')) {
          dVehicles = c;
        }
      });
    }

    if (!dVehicles) return;

    const assignments = [
      { name: 'CompactCar_White', lane: 'westbound', speed: CONFIG.speeds.CompactCar_White, initialOffset: 8 },
      { name: 'Scooter_WithRider', lane: 'westbound', speed: CONFIG.speeds.Scooter_WithRider, initialOffset: 16 },
      { name: 'DeliveryVan_YellowStripe', lane: 'eastbound', speed: CONFIG.speeds.DeliveryVan_YellowStripe, initialOffset: -8 },
      { name: 'PinkDeliveryTruck_Parked', lane: 'southbound', speed: CONFIG.speeds.PinkDeliveryTruck_Parked, initialOffset: 8.5 }
    ];

    assignments.forEach(assign => {
      const car = dVehicles.getObjectByName(assign.name);
      if (car) {
        const lane = this.lanes[assign.lane];
        if (assign.lane === 'westbound') {
          car.position.set(assign.initialOffset, car.position.y, lane.z);
          car.rotation.y = -Math.PI / 2; // Face -X
        } else if (assign.lane === 'eastbound') {
          car.position.set(assign.initialOffset, car.position.y, lane.z);
          car.rotation.y = Math.PI / 2; // Face +X
        } else if (assign.lane === 'northbound') {
          car.position.set(lane.x, car.position.y, assign.initialOffset);
          car.rotation.y = Math.PI; // Face -Z
        } else if (assign.lane === 'southbound') {
          car.position.set(lane.x, car.position.y, assign.initialOffset);
          car.rotation.y = 0; // Face +Z
        }

        // Clone materials for opacity handling so it doesn't affect parked cars/others
        car.traverse((child) => {
          if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
              child.material = child.material.map(m => {
                const cloned = m.clone();
                cloned.transparent = true;
                return cloned;
              });
            } else {
              child.material = child.material.clone();
              child.material.transparent = true;
            }
          }
        });

        this.cars.push({
          mesh: car,
          laneId: assign.lane,
          laneData: lane,
          baseSpeed: assign.speed,
          currentSpeed: assign.speed,
          state: 'ACTIVE',
          hiddenTimer: 0
        });
      }
    });
  }

  update(delta) {
    this.controller.update(delta);
    this.updateLights();
    this.updateCars(delta);
  }

  updateLights() {
    const nsState = this.controller.getState('north-south');
    const ewState = this.controller.getState('east-west');

    const colors = {
      'green': new THREE.Color(0x22ff22),
      'yellow': new THREE.Color(0xffcc00),
      'red': new THREE.Color(0xff2222)
    };

    const applyLight = (lampName, state) => {
      const lamp = this.lamps[lampName];
      if (lamp && lamp.material) {
        lamp.material.color.copy(colors[state]);
        // Update emissive for visible glow effect
        if (!lamp.material.emissive) lamp.material.emissive = new THREE.Color();
        lamp.material.emissive.copy(colors[state]);
        lamp.material.emissiveIntensity = 2.0;
        lamp.material.needsUpdate = true;
      }
    };

    applyLight('TrafficLamp_NW', nsState);
    applyLight('TrafficLamp_SE', nsState);
    applyLight('TrafficLamp_NE', ewState);
    applyLight('TrafficLamp_SW', ewState);
  }

  updateCars(delta) {
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const lane = car.laneData;
      const pos = car.mesh.position;

      if (car.state === 'HIDDEN') {
        car.hiddenTimer += delta;
        if (car.hiddenTimer > CONFIG.trafficLifecycle.respawnDelay) {
          // Calculate entry position
          const spawnOffset = ROAD_LAYOUT.boundary + CONFIG.trafficLifecycle.entryOffset;
          const entryX = lane.vec.x > 0 ? -spawnOffset : (lane.vec.x < 0 ? spawnOffset : (lane.x !== undefined ? lane.x : pos.x));
          const entryZ = lane.vec.z > 0 ? -spawnOffset : (lane.vec.z < 0 ? spawnOffset : (lane.z !== undefined ? lane.z : pos.z));
          
          let canEnter = true;
          for (let j = 0; j < this.cars.length; j++) {
            if (i === j) continue;
            const other = this.cars[j];
            if (other.state === 'ACTIVE' && other.laneId === car.laneId) {
              const dx = other.mesh.position.x - entryX;
              const dz = other.mesh.position.z - entryZ;
              const dist = Math.sqrt(dx*dx + dz*dz);
              if (dist < CONFIG.minCarGap) {
                canEnter = false;
                break;
              }
            }
          }
          
          if (canEnter) {
            pos.set(entryX, pos.y, entryZ);
            car.state = 'ACTIVE';
            car.mesh.visible = true;
            car.currentSpeed = car.baseSpeed;
            // Restore opacity completely
            car.mesh.traverse((child) => {
              if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach(m => { m.opacity = 1.0; });
                } else {
                  child.material.opacity = 1.0;
                }
              }
            });
          }
        }
        continue;
      }

      // ACTIVE state
      const state = this.controller.getState(lane.dir);
      let targetSpeed = car.baseSpeed;
      let distToStop = 9999;
      
      const stopMagnitude = ROAD_LAYOUT.crosswalkCenter + ROAD_LAYOUT.zebraCrossingHalfWidth + CONFIG.stopping.zebraCrossingClearance + CONFIG.stopping.vehicleFrontOffset;
      
      if (lane.dir === 'east-west') {
        if (lane.vec.x > 0 && pos.x < -stopMagnitude) distToStop = -stopMagnitude - pos.x;
        else if (lane.vec.x < 0 && pos.x > stopMagnitude) distToStop = pos.x - stopMagnitude;
      } else {
        if (lane.vec.z > 0 && pos.z < -stopMagnitude) distToStop = -stopMagnitude - pos.z;
        else if (lane.vec.z < 0 && pos.z > stopMagnitude) distToStop = pos.z - stopMagnitude;
      }

      const pedestrianYield = this.isPedestrianOnCrosswalk(car.laneId);

      if (distToStop > 0 && distToStop < 14) {
        if (state === 'red' || (state === 'yellow' && distToStop > 3) || pedestrianYield) {
          if (distToStop < CONFIG.stopThreshold || (pedestrianYield && distToStop < 5.5)) {
            targetSpeed = 0;
          } else {
            targetSpeed = car.baseSpeed * (distToStop / CONFIG.brakingDistance);
          }
        }
      }

      // 2. Direct pedestrian collision prevention & courteous corridor yield:
      // Active story pedestrians crossing any roadway corridor must have absolute priority.
      if (this.pedestrians && this.pedestrians.length > 0) {
        for (let pIdx = 0; pIdx < this.pedestrians.length; pIdx++) {
          const p = this.pedestrians[pIdx];
          if (!p.root || !p.root.visible) continue;
          const pedPos = p.root.position;

          // Longitudinal distance along vehicle travel vector
          const longDist = (pedPos.x - pos.x) * lane.vec.x + (pedPos.z - pos.z) * lane.vec.z;
          // Lateral distance from vehicle path centerline
          const latDist = Math.abs((pedPos.x - pos.x) * lane.vec.z - (pedPos.z - pos.z) * lane.vec.x);

          // Corridor width: road lane width is ~3.3m; 2.5m lateral margin protects crossing pedestrians
          const carriesItem = !!p.isCarryingLadder || !!p.isCarryingItem;
          const latSafetyRadius = carriesItem ? 2.85 : 2.50;

          if (latDist <= latSafetyRadius) {
            // Pedestrian is in or crossing through this vehicle's travel lane
            if (longDist > -0.8 && longDist < 12.0) {
              if (longDist <= 5.5) {
                // Immediate yield stop maintaining generous 4.0m+ buffer after deceleration
                targetSpeed = 0;
              } else {
                // Smooth progressive deceleration as car approaches pedestrian
                const decelFraction = Math.max(0, (longDist - 5.2) / 6.5);
                targetSpeed = Math.min(targetSpeed, car.baseSpeed * decelFraction);
              }
            }
          }
        }
      }

      let distToCarAhead = 9999;
      for (let j = 0; j < this.cars.length; j++) {
        if (i === j) continue;
        const other = this.cars[j];
        if (other.state === 'ACTIVE' && other.laneId === car.laneId) {
          let d = 9999;
          if (lane.vec.x > 0 && other.mesh.position.x > pos.x) d = other.mesh.position.x - pos.x;
          if (lane.vec.x < 0 && other.mesh.position.x < pos.x) d = pos.x - other.mesh.position.x;
          if (lane.vec.z > 0 && other.mesh.position.z > pos.z) d = other.mesh.position.z - pos.z;
          if (lane.vec.z < 0 && other.mesh.position.z < pos.z) d = pos.z - other.mesh.position.z;
          
          if (d > 0 && d < distToCarAhead) {
            distToCarAhead = d;
          }
        }
      }

      if (distToCarAhead < CONFIG.minCarGap) {
        targetSpeed = 0;
      } else if (distToCarAhead < CONFIG.gapSlowdownThreshold) {
        targetSpeed = Math.min(targetSpeed, car.baseSpeed * 0.5);
      }

      car.currentSpeed += (targetSpeed - car.currentSpeed) * 5.0 * delta;
      if (car.currentSpeed < 0.1 && targetSpeed === 0) car.currentSpeed = 0;

      car.mesh.position.addScaledVector(lane.vec, car.currentSpeed * delta);

      // Distance from center to calculate exit opacity
      let distFromCenter = 0;
      if (lane.vec.x !== 0) distFromCenter = Math.abs(pos.x);
      if (lane.vec.z !== 0) distFromCenter = Math.abs(pos.z);
      
      let opacity = 1.0;
      // Only dissolve if moving AWAY from center (after crossing it)
      const isExiting = (lane.vec.x > 0 && pos.x > 0) || (lane.vec.x < 0 && pos.x < 0) ||
                        (lane.vec.z > 0 && pos.z > 0) || (lane.vec.z < 0 && pos.z < 0);
                        
      if (isExiting && distFromCenter > CONFIG.trafficLifecycle.dissolveStart) {
        const dissolveRange = CONFIG.trafficLifecycle.dissolveEnd - CONFIG.trafficLifecycle.dissolveStart;
        const progress = (distFromCenter - CONFIG.trafficLifecycle.dissolveStart) / dissolveRange;
        opacity = 1.0 - THREE.MathUtils.clamp(progress, 0, 1);
      }
      
      car.mesh.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => { m.opacity = opacity; });
          } else {
            child.material.opacity = opacity;
          }
        }
      });

      // Check for exit boundary
      let hasExited = false;
      const exitPos = ROAD_LAYOUT.boundary + CONFIG.trafficLifecycle.exitMargin;
      if (lane.vec.x > 0 && pos.x > exitPos) hasExited = true;
      if (lane.vec.x < 0 && pos.x < -exitPos) hasExited = true;
      if (lane.vec.z > 0 && pos.z > exitPos) hasExited = true;
      if (lane.vec.z < 0 && pos.z < -exitPos) hasExited = true;
      
      if (hasExited) {
        car.state = 'HIDDEN';
        car.mesh.visible = false;
        car.hiddenTimer = 0;
      }
    }
  }

  dispose() {
    this.cars.forEach(car => {
      car.mesh.traverse(child => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    });
    this.cars = [];
    this.lamps = {};
  }
}
