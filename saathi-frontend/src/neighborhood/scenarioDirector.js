/**
 * scenarioDirector.js
 *
 * Minimal ScenarioDirector orchestrating landing-page 3D stories for SAATHI.
 *
 * Responsibilities:
 * - Owns which story is currently active ('drill' | 'carry' | 'ladder' | null).
 * - Ensures exactly ONE scenario runs at a time.
 * - Safely stops and resets scenarios when switching, guaranteeing actors/props are cleaned up.
 * - Emits quiet story beat captions to React outside the 3D canvas.
 */
export class ScenarioDirector {
  constructor(options = {}) {
    this.borrowingScenario = options.borrowingScenario || null;
    this.ladderScenario = options.ladderScenario || null;
    this.carryScenario = options.carryScenario || null;
    this.cameraDirector = options.cameraDirector || null;
    this.onBeat = options.onBeat || null; // Callback: (beatText) => void
    this.onStoryChange = options.onStoryChange || null; // Callback: (activeStoryId) => void

    this.activeScenarioId = null;
    this.activeScenario = null;
    this.currentBeat = '';

    // Bind beat listeners from individual scenario state machines
    if (this.borrowingScenario) {
      this.borrowingScenario.onBeat = (beatText) => {
        if (this.activeScenarioId === 'drill') {
          this._emitBeat(beatText);
        }
      };
    }

    if (this.ladderScenario) {
      this.ladderScenario.onBeat = (beatText) => {
        if (this.activeScenarioId === 'ladder') {
          this._emitBeat(beatText);
        }
      };
    }

    if (this.carryScenario) {
      this.carryScenario.onBeat = (beatText) => {
        if (this.activeScenarioId === 'carry') {
          this._emitBeat(beatText);
        }
      };
    }
  }

  /**
   * Returns current active story id ('drill' | 'carry' | 'ladder' | null).
   */
  getActiveStory() {
    return this.activeScenarioId;
  }

  /**
   * Toggles a story:
   * - If the clicked story is already active, cancels it and returns to IDLE (null).
   * - If another story is clicked or currently IDLE, activates the new story.
   *
   * @param {'drill' | 'carry' | 'ladder'} id
   * @returns {'drill' | 'carry' | 'ladder' | null}
   */
  toggleScenario(id) {
    if (this.activeScenarioId === id) {
      this.stopScenario(true);
      return null;
    }
    return this.playScenario(id);
  }

  /**
   * Selects and plays a story.
   * If another story is running, it is safely stopped and reset first.
   *
   * @param {'drill' | 'carry' | 'ladder'} id
   * @returns {'drill' | 'carry' | 'ladder'}
   */
  playScenario(id) {
    if (this.activeScenarioId === id && this.activeScenario && this.activeScenario.isStoryActive) {
      return this.activeScenarioId;
    }

    // Safely stop and reset any currently running scenario (without emitting null yet)
    this.stopScenario(false);

    this.activeScenarioId = id;
    console.log(`[ScenarioDirector] Starting story: ${id}`);

    if (id === 'drill') {
      if (this.carryScenario) {
        this.carryScenario.setInactive();
      }
      if (this.borrowingScenario) {
        this.activeScenario = this.borrowingScenario;
        this.borrowingScenario.start();
        if (this.cameraDirector) {
          this.cameraDirector.startDrillStory(this.borrowingScenario);
        }
      }
    } else if (id === 'ladder') {
      if (this.carryScenario) {
        this.carryScenario.setInactive();
      }
      if (this.ladderScenario) {
        this.activeScenario = this.ladderScenario;
        this.ladderScenario.start();
        if (this.cameraDirector) {
          this.cameraDirector.startLadderStory(this.ladderScenario);
        }
      }
    } else if (id === 'carry') {
      if (this.carryScenario) {
        this.carryScenario.setActive();
        this.activeScenario = this.carryScenario;
        this.carryScenario.start();
        if (this.cameraDirector) {
          this.cameraDirector.startCarryStory(this.carryScenario);
        }
      }
    }

    this._emitStoryChange(this.activeScenarioId);
    return this.activeScenarioId;
  }

  /**
   * Safely stops and resets the active scenario and cleans up all actors/props.
   *
   * @param {boolean} emitChange - Whether to notify onStoryChange(null)
   */
  stopScenario(emitChange = true) {
    if (this.cameraDirector) {
      this.cameraDirector.stopStoryCamera();
    }

    if (this.activeScenario) {
      if (typeof this.activeScenario.reset === 'function') {
        this.activeScenario.reset();
      }
      this.activeScenario = null;
    }

    // Guarantee all scenarios are cleanly reset
    if (this.borrowingScenario && typeof this.borrowingScenario.reset === 'function') {
      this.borrowingScenario.reset();
    }
    if (this.ladderScenario && typeof this.ladderScenario.reset === 'function') {
      this.ladderScenario.reset();
    }
    if (this.carryScenario && typeof this.carryScenario.reset === 'function') {
      this.carryScenario.reset();
      this.carryScenario.setActive();
    }

    this.activeScenarioId = null;
    this._emitBeat('');
    if (emitChange) {
      this._emitStoryChange(null);
    }
    return null;
  }

  pause() {
    if (this.activeScenario && typeof this.activeScenario.pause === 'function') {
      this.activeScenario.pause();
    }
  }

  resume() {
    if (this.activeScenario && typeof this.activeScenario.resume === 'function') {
      this.activeScenario.resume();
    }
  }

  update(delta) {
    if (this.activeScenario && typeof this.activeScenario.update === 'function') {
      this.activeScenario.update(delta);
    }
  }

  postUpdate(delta) {
    if (this.activeScenario && typeof this.activeScenario.postUpdate === 'function') {
      this.activeScenario.postUpdate(delta);
    }
  }

  _emitBeat(text) {
    if (this.currentBeat === text && text !== '') return;
    this.currentBeat = text;
    if (typeof this.onBeat === 'function') {
      this.onBeat(text);
    }
  }

  _emitStoryChange(storyId) {
    if (typeof this.onStoryChange === 'function') {
      this.onStoryChange(storyId);
    }
  }

  dispose() {
    this.stopScenario(false);
    if (this.cameraDirector) {
      this.cameraDirector.dispose();
      this.cameraDirector = null;
    }
    this.borrowingScenario = null;
    this.ladderScenario = null;
    this.carryScenario = null;
    this.onBeat = null;
    this.onStoryChange = null;
  }
}
