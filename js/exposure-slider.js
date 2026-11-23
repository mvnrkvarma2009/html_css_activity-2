/**
 * ==========================================================================
 * WINDOWS MUSIC WORKSPACE — js/exposure-slider.js
 * Exposure Slider Component (SmoothUI Port with Spring Physics & SVG Ring)
 * ==========================================================================
 * Features:
 * - Draggable ticker with spring-physics snap behavior
 * - Animated notch marks with proximity-based height and opacity
 * - Circular SVG progress ring showing volume values
 * - Edge fade gradient for depth effect
 * - Configurable min/max range and step size
 * - onChange callback for real audio volume tracking
 * - Respects prefers-reduced-motion accessibility preferences
 * ==========================================================================
 */

(function () {
  'use strict';

  class ExposureSlider {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this.container) return;

      this.min = options.min !== undefined ? options.min : 0;
      this.max = options.max !== undefined ? options.max : 100;
      this.step = options.step !== undefined ? options.step : 1;
      this.value = options.defaultValue !== undefined ? options.defaultValue : 80;
      this.unit = options.unit || '%';
      this.onChange = options.onChange || null;
      this.pixelsPerUnit = options.pixelsPerUnit || 5.5; // spacing between integer steps
      this.notchInterval = options.notchInterval || 2; // notch every 2 units
      this.majorInterval = options.majorInterval || 20; // major notch every 20 units

      // Spring physics state
      this.targetValue = this.value;
      this.currentOffset = -this.valueToOffset(this.value);
      this.velocity = 0;
      this.isDragging = false;
      this.pointerStartX = 0;
      this.dragStartOffset = 0;
      this.lastPointerX = 0;
      this.lastPointerTime = 0;
      this.rafId = null;

      // Reduced motion check
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
        this.prefersReducedMotion = e.matches;
      });

      this.initDOM();
      this.attachEvents();
      this.update(true);
    }

    valueToOffset(val) {
      return (val - this.min) * this.pixelsPerUnit;
    }

    offsetToValue(offset) {
      const raw = this.min + (-offset / this.pixelsPerUnit);
      const clamped = Math.max(this.min, Math.min(this.max, raw));
      return Math.round(clamped / this.step) * this.step;
    }

    initDOM() {
      this.container.classList.add('exposure-slider-root');
      this.container.setAttribute('role', 'slider');
      this.container.setAttribute('tabindex', '0');
      this.container.setAttribute('aria-valuemin', this.min);
      this.container.setAttribute('aria-valuemax', this.max);
      this.container.setAttribute('aria-valuenow', this.value);
      this.container.setAttribute('aria-label', 'Volume Exposure Slider');

      // SVG Ring Radius & Circumference
      const r = 20;
      this.circumference = 2 * Math.PI * r;

      this.container.innerHTML = `
        <div class="exposure-ring-box">
          <svg class="exposure-ring-svg" viewBox="0 0 50 50">
            <circle class="exposure-ring-bg" cx="25" cy="25" r="${r}" />
            <circle class="exposure-ring-fill" cx="25" cy="25" r="${r}" 
              stroke-dasharray="${this.circumference}" 
              stroke-dashoffset="${this.circumference}" />
          </svg>
          <div class="exposure-ring-center">
            <span class="exposure-val-text">${this.value}${this.unit}</span>
          </div>
        </div>

        <div class="exposure-ticker-viewport">
          <div class="exposure-reticle" aria-hidden="true"></div>
          <div class="exposure-fade-left" aria-hidden="true"></div>
          <div class="exposure-fade-right" aria-hidden="true"></div>
          <div class="exposure-ticker-track"></div>
        </div>
      `;

      this.ringFill = this.container.querySelector('.exposure-ring-fill');
      this.valText = this.container.querySelector('.exposure-val-text');
      this.trackEl = this.container.querySelector('.exposure-ticker-track');
      this.viewportEl = this.container.querySelector('.exposure-ticker-viewport');

      // Render notch marks
      this.notches = [];
      const totalUnits = this.max - this.min;

      for (let u = this.min; u <= this.max; u += this.notchInterval) {
        const isMajor = u % this.majorInterval === 0 || u === this.min || u === this.max;
        const notchEl = document.createElement('div');
        notchEl.className = `exposure-notch ${isMajor ? 'exposure-notch--major' : ''}`;
        
        const xPos = (u - this.min) * this.pixelsPerUnit;
        notchEl.style.left = `${xPos}px`;

        if (isMajor) {
          const label = document.createElement('span');
          label.className = 'exposure-notch-label';
          label.textContent = u;
          notchEl.appendChild(label);
        }

        this.trackEl.appendChild(notchEl);
        this.notches.push({ el: notchEl, value: u, x: xPos, isMajor });
      }

      // Track total width
      const totalWidth = totalUnits * this.pixelsPerUnit;
      this.trackEl.style.width = `${totalWidth}px`;
    }

    toggleMute(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (this.value > 0) {
        this.lastUnmutedValue = this.value;
        this.setValue(0);
      } else {
        this.setValue(this.lastUnmutedValue || 80);
      }
    }

    attachEvents() {
      const vp = this.viewportEl;
      const ringBox = this.container.querySelector('.exposure-ring-box');

      // Click circular ring to toggle mute/unmute
      if (ringBox) {
        ringBox.style.cursor = 'pointer';
        ringBox.setAttribute('title', 'Click to Mute / Unmute');
        ringBox.addEventListener('click', (e) => this.toggleMute(e));
        ringBox.addEventListener('pointerdown', (e) => e.stopPropagation());
      }

      // Pointer down for click & drag
      vp.addEventListener('pointerdown', (e) => {
        this.isDragging = true;
        this.hasMoved = false;
        this.pointerStartX = e.clientX;
        this.dragStartValue = this.value;
        this.dragStartOffset = this.currentOffset;
        this.lastPointerX = e.clientX;
        this.lastPointerTime = performance.now();
        this.velocity = 0;

        vp.setPointerCapture(e.pointerId);
        this.container.classList.add('is-dragging');
        if (this.rafId) cancelAnimationFrame(this.rafId);
      });

      vp.addEventListener('pointermove', (e) => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.pointerStartX;
        if (Math.abs(dx) > 3) {
          this.hasMoved = true;
        }

        // Natural slider physics: dragging right (dx > 0) increases volume!
        // Track offset is negative of value offset, so moving to higher value shifts offset left (-dx)
        let nextOffset = this.dragStartOffset - dx;

        // Soft elastic limits
        const minOffset = -this.valueToOffset(this.max);
        const maxOffset = -this.valueToOffset(this.min);

        if (nextOffset > maxOffset) {
          nextOffset = maxOffset + (nextOffset - maxOffset) * 0.28;
        } else if (nextOffset < minOffset) {
          nextOffset = minOffset + (nextOffset - minOffset) * 0.28;
        }

        const now = performance.now();
        const dt = Math.max(1, now - this.lastPointerTime);
        this.velocity = -(e.clientX - this.lastPointerX) / dt;
        this.lastPointerX = e.clientX;
        this.lastPointerTime = now;

        this.currentOffset = nextOffset;
        this.setValueFromOffset(nextOffset);
        this.renderNotches();
      });

      const onPointerEnd = (e) => {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.container.classList.remove('is-dragging');
        try { vp.releasePointerCapture(e.pointerId); } catch (err) {}

        // If it was just a quick click without dragging, jump directly to clicked ratio
        if (!this.hasMoved) {
          const rect = vp.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, clickX / rect.width));
          const clickVal = Math.round(this.min + ratio * (this.max - this.min));
          this.setValue(clickVal);
          return;
        }

        if (this.prefersReducedMotion) {
          // Instant snap
          this.value = this.offsetToValue(this.currentOffset);
          this.currentOffset = -this.valueToOffset(this.value);
          this.update(true);
        } else {
          // Momentum and Spring Snap
          this.startSpringSnap();
        }
      };

      vp.addEventListener('pointerup', onPointerEnd);
      vp.addEventListener('pointercancel', onPointerEnd);

      // Wheel / Trackpad horizontal & vertical scroll
      vp.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        // Natural wheel: scrolling up / right increases volume
        const stepChange = (delta > 0 ? -1 : 1) * this.step * 2;
        this.setValue(this.value + stepChange);
      }, { passive: false });

      // Keyboard Accessibility
      this.container.addEventListener('keydown', (e) => {
        let delta = 0;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = this.step;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -this.step;
        else if (e.key === 'PageUp') delta = this.step * 10;
        else if (e.key === 'PageDown') delta = -this.step * 10;
        else if (e.key === 'Home') { this.setValue(this.min); return; }
        else if (e.key === 'End') { this.setValue(this.max); return; }

        if (delta !== 0) {
          e.preventDefault();
          this.setValue(this.value + delta);
        }
      });
    }

    startSpringSnap() {
      // Projected target based on momentum
      const projectedOffset = this.currentOffset + this.velocity * 120;
      this.targetValue = this.offsetToValue(projectedOffset);
      const targetOffset = -this.valueToOffset(this.targetValue);

      const k = 0.16; // spring stiffness
      const damping = 0.78; // friction

      const loop = () => {
        const force = -k * (this.currentOffset - targetOffset);
        this.velocity = (this.velocity + force) * damping;
        this.currentOffset += this.velocity;

        this.setValueFromOffset(this.currentOffset);
        this.renderNotches();

        if (Math.abs(this.currentOffset - targetOffset) < 0.25 && Math.abs(this.velocity) < 0.05) {
          this.currentOffset = targetOffset;
          this.value = this.targetValue;
          this.update(true);
        } else {
          this.rafId = requestAnimationFrame(loop);
        }
      };

      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame(loop);
    }

    setValueFromOffset(offset) {
      const newVal = this.offsetToValue(offset);
      if (newVal !== this.value) {
        this.value = newVal;
        this.update(false);
      }
    }

    setValue(newVal) {
      newVal = Math.max(this.min, Math.min(this.max, Math.round(newVal / this.step) * this.step));
      if (newVal === this.value && !this.isDragging) return;

      this.value = newVal;
      const targetOffset = -this.valueToOffset(this.value);

      // Immediate synchronous update for text, SVG ring, and onChange listeners
      if (this.valText) {
        this.valText.textContent = `${this.value}${this.unit}`;
      }
      if (this.ringFill) {
        const pct = (this.value - this.min) / (this.max - this.min);
        const offset = this.circumference * (1 - pct);
        this.ringFill.style.strokeDashoffset = offset;
      }
      if (typeof this.onChange === 'function') {
        this.onChange(this.value);
      }

      if (this.prefersReducedMotion) {
        this.currentOffset = targetOffset;
        this.update(true);
      } else {
        this.targetValue = this.value;
        this.startSpringSnap();
      }
    }

    update(updateOffset = true) {
      if (updateOffset) {
        this.currentOffset = -this.valueToOffset(this.value);
      }

      this.container.setAttribute('aria-valuenow', this.value);

      // Update Text
      if (this.valText) {
        this.valText.textContent = `${this.value}${this.unit}`;
      }

      // Update Circular SVG Ring
      if (this.ringFill) {
        const pct = (this.value - this.min) / (this.max - this.min);
        const offset = this.circumference * (1 - pct);
        this.ringFill.style.strokeDashoffset = offset;
      }

      this.renderNotches();

      // Trigger onChange
      if (typeof this.onChange === 'function') {
        this.onChange(this.value);
      }
    }

    renderNotches() {
      if (!this.trackEl) return;
      this.trackEl.style.transform = `translateX(${this.currentOffset}px)`;

      // Proximity range in pixels
      const proximityRange = 65;

      this.notches.forEach((notch) => {
        const screenX = notch.x + this.currentOffset; // 0 is reticle center
        const dist = Math.abs(screenX);

        if (dist > 120) {
          // Off screen
          notch.el.style.opacity = '0.15';
          notch.el.style.transform = 'scaleY(0.7)';
          notch.el.classList.remove('active');
          return;
        }

        const norm = Math.max(0, 1 - dist / proximityRange);
        const curved = Math.pow(norm, 1.4); // smooth curve

        const minH = notch.isMajor ? 14 : 7;
        const maxH = notch.isMajor ? 26 : 16;
        const h = minH + (maxH - minH) * curved;

        const opacity = 0.25 + 0.75 * curved;

        notch.el.style.height = `${h}px`;
        notch.el.style.opacity = opacity.toFixed(2);
        notch.el.style.transform = `scaleY(${1 + curved * 0.15})`;

        if (dist < 4) {
          notch.el.classList.add('active');
        } else {
          notch.el.classList.remove('active');
        }
      });
    }
  }

  window.ExposureSlider = ExposureSlider;
})();
