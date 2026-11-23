/**
 * ==========================================================================
 * PARADOX ARENA — js/scramble.js
 * Scramble Text Effect (Originkit Port to Vanilla JS)
 * ==========================================================================
 * Implements glitch character reveal with cubic-bezier easing, wave cursors,
 * viewport-triggered entrance scramble, and interactive mouse-hover diffusion.
 * ==========================================================================
 */

(function () {
  'use strict';

  const GLITCH_CHARS_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const GLITCH_CHARS_LOWER = "abcdefghijklmnopqrstuvwxyz";
  const WAVE_CURSOR_CHARS = "░▒▓█";

  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
    const sampleY = (t) => ((ay * t + by) * t + cy) * t;
    const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      let t = x;
      for (let i = 0; i < 8; i++) {
        const dx = sampleX(t) - x;
        const d = sampleDX(t);
        if (Math.abs(dx) < 1e-6) break;
        if (d === 0) break;
        t -= dx / d;
      }
      return sampleY(Math.max(0, Math.min(1, t)));
    };
  }

  function makeEaseFn(ease) {
    if (Array.isArray(ease) && ease.length === 4) {
      return cubicBezier(ease[0], ease[1], ease[2], ease[3]);
    }
    switch (ease) {
      case "linear":
        return (t) => t;
      case "easeIn":
        return (t) => t * t;
      case "easeOut":
        return (t) => 1 - (1 - t) * (1 - t);
      case "easeInOut":
        return (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
      default:
        return cubicBezier(0.25, 1, 0.5, 1);
    }
  }

  function rndGlitch(char) {
    if (char >= 'A' && char <= 'Z') {
      return GLITCH_CHARS_UPPER[Math.floor(Math.random() * GLITCH_CHARS_UPPER.length)];
    }
    return GLITCH_CHARS_LOWER[Math.floor(Math.random() * GLITCH_CHARS_LOWER.length)];
  }

  function rndCursor() {
    return WAVE_CURSOR_CHARS[Math.floor(Math.random() * WAVE_CURSOR_CHARS.length)];
  }

  class ScrambleTextController {
    constructor(element) {
      this.el = element;
      this.originalText = element.getAttribute('data-text') || element.textContent.trim() || "Nagendra Varma";
      this.chars = [];
      this.isAnimating = false;
      this.hasRevealed = false;
      this.easeFn = makeEaseFn([0.25, 1, 0.5, 1]);
      this.rafId = null;

      this.setupDOM();
      this.attachEvents();
    }

    setupDOM() {
      this.el.innerHTML = '';
      this.chars = [];

      for (let i = 0; i < this.originalText.length; i++) {
        const ch = this.originalText[i];
        const span = document.createElement('span');
        span.className = 'scramble-char';
        span.setAttribute('data-target', ch);

        if (ch === ' ') {
          span.innerHTML = '&nbsp;';
          span.style.minWidth = '0.4em';
        } else {
          span.textContent = ch;
        }

        this.el.appendChild(span);
        this.chars.push({
          el: span,
          target: ch,
          isSpace: ch === ' ',
          current: ch,
        });
      }
    }

    playEnter(duration = 1000) {
      if (this.isAnimating) cancelAnimationFrame(this.rafId);
      this.isAnimating = true;

      const startTime = performance.now();
      const n = this.chars.length;

      const frame = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const eased = this.easeFn(progress);
        const frontier = Math.floor(eased * n);

        for (let i = 0; i < n; i++) {
          const item = this.chars[i];
          if (item.isSpace) continue;

          if (i < frontier) {
            // Locked
            item.el.textContent = item.target;
            item.el.classList.remove('scramble-char--glitch', 'scramble-char--flicker');
          } else if (i === frontier) {
            // Wavefront cursor
            item.el.textContent = rndCursor();
            item.el.classList.add('scramble-char--glitch');
          } else {
            // Active scrambling
            item.el.textContent = rndGlitch(item.target);
            item.el.classList.add('scramble-char--glitch');
          }
        }

        if (progress < 1) {
          this.rafId = requestAnimationFrame(frame);
        } else {
          // Final settle
          for (let i = 0; i < n; i++) {
            const item = this.chars[i];
            if (!item.isSpace) {
              item.el.textContent = item.target;
              item.el.classList.remove('scramble-char--glitch', 'scramble-char--flicker');
            }
          }
          this.isAnimating = false;
          this.hasRevealed = true;
        }
      };

      this.rafId = requestAnimationFrame(frame);
    }

    playWave(originIndex = 0, duration = 800) {
      if (this.isAnimating) return;
      this.isAnimating = true;

      const startTime = performance.now();
      const n = this.chars.length;

      const frame = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);

        for (let i = 0; i < n; i++) {
          const item = this.chars[i];
          if (item.isSpace) continue;

          const dist = Math.abs(i - originIndex);
          const charStart = (dist / n) * 0.4;
          const charEnd = charStart + 0.5;

          if (progress >= charStart && progress < charEnd) {
            const subProgress = (progress - charStart) / 0.5;
            if (subProgress < 0.4) {
              item.el.textContent = rndCursor();
              item.el.classList.add('scramble-char--glitch');
            } else {
              item.el.textContent = rndGlitch(item.target);
              item.el.classList.add('scramble-char--glitch');
            }
          } else if (progress >= charEnd) {
            item.el.textContent = item.target;
            item.el.classList.remove('scramble-char--glitch');
          }
        }

        if (progress < 1) {
          this.rafId = requestAnimationFrame(frame);
        } else {
          for (let i = 0; i < n; i++) {
            const item = this.chars[i];
            if (!item.isSpace) {
              item.el.textContent = item.target;
              item.el.classList.remove('scramble-char--glitch');
            }
          }
          this.isAnimating = false;
        }
      };

      this.rafId = requestAnimationFrame(frame);
    }

    attachEvents() {
      // Intersection Observer for viewport entry
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !this.hasRevealed) {
              this.playEnter(1100);
            }
          });
        }, { threshold: 0.2 });
        observer.observe(this.el);
      } else {
        setTimeout(() => this.playEnter(1000), 500);
      }

      // Mouse hover diffusion wave
      this.el.addEventListener('mousemove', (e) => {
        if (this.isAnimating) return;
        const rect = this.el.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, relX / rect.width));
        const index = Math.floor(ratio * this.chars.length);
        this.playWave(index, 700);
      });

      // Click trigger
      this.el.addEventListener('click', () => {
        this.playEnter(900);
      });
    }
  }

  window.initScrambleText = function () {
    const target = document.getElementById('nagendra-scramble');
    if (target) {
      new ScrambleTextController(target);
    }
  };
})();
