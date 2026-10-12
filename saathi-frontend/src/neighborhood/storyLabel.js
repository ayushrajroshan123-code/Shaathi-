import * as THREE from 'three';

/**
 * StoryLabel — World-anchored HTML dialog annotation for 3D diorama actors.
 *
 * Requirements:
 * - Projects the speaking character's 3D world position to 2D viewport coordinates every frame.
 * - Floats 0.5–0.8m above character's head (~2.15m world Y offset).
 * - Restrained editorial styling: dark translucent surface, subtle border, subtle shadow,
 *   small rounded corners, crisp typography, subtle downward pointer notch.
 * - Single source of truth: only one active label at any time.
 * - Zero memory allocations in update loop (preallocated Vector3).
 */
export class StoryLabel {
  /**
   * @param {HTMLElement} container - The viewport mount container
   * @param {THREE.Camera} camera - The active Three.js camera
   */
  constructor(container, camera) {
    this.container = container;
    this.camera = camera;

    this.target = null;
    this.heightOffset = 2.15; // meters above actor root position (~0.65m above head)
    this.isVisible = false;
    this._fadeTimeout = null;

    // Preallocated scratch vectors for zero-allocation projection
    this._worldPos = new THREE.Vector3();
    this._projPos = new THREE.Vector3();
    this._lastScreenX = null;
    this._lastScreenY = null;

    this.el = null;
    this.textEl = null;
    this.notchEl = null;

    this._buildDOM();
  }

  _buildDOM() {
    if (!this.container) return;

    const el = document.createElement('div');
    el.className = 'saathi-world-story-label';
    el.style.cssText = [
      'position: absolute',
      'top: 0',
      'left: 0',
      'pointer-events: none',
      'user-select: none',
      'z-index: 45',
      'display: none',
      'opacity: 0',
      'transform: translate(-50%, -100%) translate3d(0, 0, 0)',
      'transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      'will-change: transform, opacity',
    ].join(';');

    const card = document.createElement('div');
    card.className = 'saathi-world-story-label-card';
    card.style.cssText = [
      'background: rgba(15, 23, 42, 0.90)',
      'backdrop-filter: blur(12px)',
      '-webkit-backdrop-filter: blur(12px)',
      'border: 1px solid rgba(255, 255, 255, 0.15)',
      'border-radius: 8px',
      'padding: 7px 15px',
      'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.26), 0 1px 3px rgba(0, 0, 0, 0.12)',
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'white-space: nowrap',
      'position: relative',
    ].join(';');

    const text = document.createElement('span');
    text.className = 'saathi-world-story-label-text';
    text.style.cssText = [
      'font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
      'font-size: 13px',
      'font-weight: 500',
      'color: #F8FAFC',
      'letter-spacing: -0.01em',
      'line-height: 1.35',
    ].join(';');

    // Restrained downward notch pointing toward the actor
    const notch = document.createElement('div');
    notch.className = 'saathi-world-story-label-notch';
    notch.style.cssText = [
      'position: absolute',
      'bottom: -4px',
      'left: 50%',
      'transform: translateX(-50%) rotate(45deg)',
      'width: 8px',
      'height: 8px',
      'background: rgba(15, 23, 42, 0.90)',
      'border-right: 1px solid rgba(255, 255, 255, 0.15)',
      'border-bottom: 1px solid rgba(255, 255, 255, 0.15)',
    ].join(';');

    card.appendChild(text);
    card.appendChild(notch);
    el.appendChild(card);

    this.container.style.position = 'relative';
    this.container.appendChild(el);

    this.el = el;
    this.textEl = text;
    this.notchEl = notch;
  }

  /**
   * Shows a story beat dialog above the given target actor or position.
   * @param {string} text - Beat dialogue string
   * @param {THREE.Object3D | { root: THREE.Object3D } | THREE.Vector3} target - Actor or 3D coordinate
   * @param {number} [heightOffset=2.15] - Height offset in meters
   * @param {boolean | { isSystem?: boolean }} [options=false] - Display options (e.g. isSystem: true hides speech notch)
   */
  show(text, target, heightOffset = 2.15, options = false) {
    if (!this.el || !text) return;
    if (this._fadeTimeout) {
      clearTimeout(this._fadeTimeout);
      this._fadeTimeout = null;
    }

    const isSystem = typeof options === 'boolean' ? options : !!(options && options.isSystem);

    this.target = target || null;
    this.heightOffset = heightOffset;
    this.textEl.textContent = text;

    if (this.notchEl) {
      this.notchEl.style.display = isSystem ? 'none' : 'block';
    }

    // Reset previous screen tracking so new target immediately positions
    this._lastScreenX = null;
    this._lastScreenY = null;

    // Immediately project to current position before rendering visible
    this.update();

    this.el.style.display = 'block';
    // Smooth fade in without bouncing or position jumping
    requestAnimationFrame(() => {
      if (this.el && this.isVisible) {
        this.el.style.opacity = '1';
      }
    });
    this.isVisible = true;
  }

  /**
   * Convenience alias for showing dialogue above a character target.
   * Supports both (target, text, options) and (text, target, options).
   */
  showDialog(targetOrText, textOrTarget, options = {}) {
    const text = typeof targetOrText === 'string' ? targetOrText : textOrTarget;
    const target = typeof targetOrText === 'string' ? textOrTarget : targetOrText;
    return this.show(text, target, 2.15, options);
  }

  /**
   * Convenience alias for showing a system annotation without speech notch.
   * Supports both (pos, text, options) and (text, pos, options).
   */
  showSystemAnnotation(posOrText, textOrPos, options = {}) {
    const text = typeof posOrText === 'string' ? posOrText : textOrPos;
    const pos = typeof posOrText === 'string' ? textOrPos : posOrText;
    return this.show(text, pos, 2.15, { isSystem: true, ...(options || {}) });
  }

  /**
   * Updates dialogue text without re-animating if already visible.
   * @param {string} text
   */
  setText(text) {
    if (this.textEl && text) {
      this.textEl.textContent = text;
    }
  }

  /**
   * Fades out and hides the label.
   */
  hide() {
    if (!this.el || !this.isVisible) return;
    this.el.style.opacity = '0';
    this.isVisible = false;
    this._fadeTimeout = setTimeout(() => {
      if (this.el && !this.isVisible) {
        this.el.style.display = 'none';
        this.target = null;
        this._lastScreenX = null;
        this._lastScreenY = null;
      }
      this._fadeTimeout = null;
    }, 240);
  }

  /**
   * Immediate hide without fade.
   */
  clear() {
    if (this._fadeTimeout) {
      clearTimeout(this._fadeTimeout);
      this._fadeTimeout = null;
    }
    this.isVisible = false;
    this.target = null;
    this._lastScreenX = null;
    this._lastScreenY = null;
    if (this.el) {
      this.el.style.opacity = '0';
      this.el.style.display = 'none';
    }
  }

  /**
   * Frame-by-frame projection update called in the render loop.
   */
  update() {
    if (!this.el || !this.target || !this.camera || !this.container) return;

    // 1. Resolve target 3D world position
    if (this.target.root && this.target.root.isObject3D) {
      if (!this.target.root.visible) {
        this.el.style.opacity = '0';
        return;
      }
      this.target.root.getWorldPosition(this._worldPos);
    } else if (this.target.isObject3D) {
      if (!this.target.visible) {
        this.el.style.opacity = '0';
        return;
      }
      this.target.getWorldPosition(this._worldPos);
    } else if (this.target.isVector3) {
      this._worldPos.copy(this.target);
    } else {
      return;
    }

    // Apply vertical offset above character's head
    this._worldPos.y += this.heightOffset;

    // 2. Project world position into camera normalized device coordinates (NDC)
    this._projPos.copy(this._worldPos).project(this.camera);

    // 3. Frustum and behind-camera visibility culling
    if (this._projPos.z > 1.0 || Math.abs(this._projPos.x) > 1.25 || Math.abs(this._projPos.y) > 1.25) {
      this.el.style.opacity = '0';
      return;
    }

    // 4. Convert NDC [-1, 1] to screen pixel coordinates [0, width], [0, height]
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    const rawX = (this._projPos.x * 0.5 + 0.5) * w;
    const rawY = (-this._projPos.y * 0.5 + 0.5) * h;

    // Subpixel micro-jitter deadband:
    // If movement delta is beneath 0.25px (float projection noise when stationary), keep current coordinate
    if (this._lastScreenX !== null && this._lastScreenY !== null) {
      const dx = Math.abs(rawX - this._lastScreenX);
      const dy = Math.abs(rawY - this._lastScreenY);
      if (dx < 0.25 && dy < 0.25) {
        return;
      }
    }

    this._lastScreenX = rawX;
    this._lastScreenY = rawY;

    // 5. Hardware-accelerated subpixel positioning (zero CSS transform transition lag)
    this.el.style.transform = `translate(-50%, -100%) translate3d(${rawX.toFixed(1)}px, ${rawY.toFixed(1)}px, 0)`;
    if (this.isVisible && this.el.style.opacity === '0') {
      this.el.style.opacity = '1';
    }
  }

  dispose() {
    if (this._fadeTimeout) clearTimeout(this._fadeTimeout);
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
    this.el = null;
    this.textEl = null;
    this.notchEl = null;
    this.target = null;
  }
}
