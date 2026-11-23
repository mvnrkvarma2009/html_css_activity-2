/**
 * ==========================================================================
 * IGNITE MUSIC — js/ascii-flame.js
 * Ascii Flame Simulation (Originkit Port to Vanilla JS)
 * ==========================================================================
 * Pure JavaScript procedural ASCII fire simulation with embers, sparks,
 * wind turbulence, and dynamic heat propagation.
 * ==========================================================================
 */

(function () {
  'use strict';

  const FONT_SIZE = 11;
  const FPS = 30;

  const CHARSETS = {
    classic: " .:-=+*#%@",
    dense: " `.^,:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
    blocks: " ░▒▓█",
    minimal: " .:*#",
  };

  const COLOR_PALETTE = [
    "#411205",
    "#7c2105",
    "#b93608",
    "#e85b0c",
    "#ff8b18",
    "#ffc247",
    "#fff1aa",
  ];

  const CONFIG = {
    intensity: 100,
    wind: 10,
    decay: 14,
    turbulence: 32,
    thickness: 2,
    embers: true,
    sparks: true,
    pulse: false,
    charset: 'classic',
    sparkColor: '#FF3030',
  };

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  function seedFuel(heat, columns, rows, config, elapsedSeconds) {
    const pulseMultiplier = config.pulse
      ? 0.88 + Math.sin(elapsedSeconds * 2.2) * 0.12
      : 1;
    const fuelRows = clamp(Math.round(config.thickness), 1, Math.max(1, rows - 1));
    const baseHeat = clamp(config.intensity / 100, 0.05, 1) * pulseMultiplier;

    for (let rowOffset = 0; rowOffset < fuelRows; rowOffset++) {
      const row = rows - 1 - rowOffset;
      const rowStrength = 1 - rowOffset / Math.max(fuelRows * 2, 1);

      for (let column = 0; column < columns; column++) {
        const index = row * columns + column;
        const flicker = 0.58 + Math.random() * 0.42;
        heat[index] = clamp(baseHeat * rowStrength * flicker, 0, 1);
      }
    }
  }

  function propagateFire(heat, nextHeat, columns, rows, config) {
    nextHeat.fill(0);
    const windOffset = config.wind / 50;
    const turbulence = config.turbulence / 100;
    const cooling = config.decay / 1000;

    for (let row = 0; row < rows - 1; row++) {
      for (let column = 0; column < columns; column++) {
        const randomDrift = (Math.random() - 0.5) * (1.5 + turbulence * 5);
        const sourceColumn = clamp(
          Math.round(column - windOffset + randomDrift),
          0,
          columns - 1
        );
        const rowBelow = (row + 1) * columns;
        const rowTwoBelow = Math.min(row + 2, rows - 1) * columns;
        const sideDirection = Math.random() < 0.5 ? -1 : 1;
        const side = rowBelow + clamp(sourceColumn + sideDirection, 0, columns - 1);
        const center = rowBelow + sourceColumn;
        const deep = rowTwoBelow + sourceColumn;

        let carriedHeat = heat[center] * 0.58 + heat[side] * 0.16 + heat[deep] * 0.26;
        const randomCooling = cooling * (0.2 + Math.random() * (1.3 + turbulence * 2));

        if (Math.random() < turbulence * 0.08) {
          carriedHeat *= 0.45 + Math.random() * 0.35;
        }

        nextHeat[row * columns + column] = clamp(carriedHeat - randomCooling, 0, 1);
      }
    }

    const fuelStart = Math.max(0, rows - Math.round(config.thickness));
    nextHeat.set(heat.subarray(fuelStart * columns), fuelStart * columns);
  }

  function updateParticles(particles, columns, rows, config) {
    const updated = particles
      .map((p) => ({
        ...p,
        x: p.x + p.velocityX + config.wind / 500,
        y: p.y + p.velocityY,
        velocityX: p.velocityX + (Math.random() - 0.5) * (config.turbulence / 300),
        heat: p.heat * (p.kind === "spark" ? 0.985 : 0.94),
        life: p.life - 1,
      }))
      .filter((p) => p.life > 0 && p.y >= 0 && p.x >= 0 && p.x < columns);

    const sourceCols = Array.from({ length: columns }, (_, i) => i);
    const spawn = (isSpark) => {
      const col = sourceCols[Math.floor(Math.random() * sourceCols.length)] ?? 0;
      const life = isSpark ? 20 + Math.random() * 24 : 22 + Math.random() * 28;
      updated.push({
        kind: isSpark ? "spark" : "ember",
        glyph: isSpark ? (Math.random() < 0.5 ? "'" : "|") : ".",
        x: col + (Math.random() - 0.5) * 2,
        y: rows - Math.max(2, config.thickness),
        velocityX: (Math.random() - 0.5) * (isSpark ? 0.45 : 0.16),
        velocityY: isSpark ? -(0.8 + Math.random() * 0.8) : -(0.16 + Math.random() * 0.24),
        heat: isSpark ? 1.2 : 0.76,
        life,
        maxLife: life,
      });
    };

    if (config.embers && Math.random() < 0.2 * 2.4) spawn(false);
    if (config.sparks && Math.random() < 0.07 * 2.4) spawn(true);

    return updated.slice(-Math.max(40, Math.round(columns * 1.5)));
  }

  function escapeHtml(char) {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    return char;
  }

  function renderFire(element, heat, particles, columns, rows, charsetName, palette, sparkColor) {
    const displayHeat = new Float32Array(heat);
    const particleGlyphs = new Map();
    const resolvedSpark = sparkColor || "#FF3030";

    for (const p of particles) {
      const col = clamp(Math.round(p.x), 0, columns - 1);
      const row = clamp(Math.round(p.y), 0, rows - 1);
      const fade = p.life / p.maxLife;
      const idx = row * columns + col;
      displayHeat[idx] = Math.max(displayHeat[idx], p.heat * fade);
      if (p.kind === "spark" || !particleGlyphs.has(idx)) {
        particleGlyphs.set(idx, {
          color: p.kind === "spark" ? resolvedSpark : palette[Math.max(0, palette.length - 3)],
          glyph: p.glyph,
        });
      }
    }

    const chars = CHARSETS[charsetName] || CHARSETS.classic;
    const lines = [];

    for (let row = 0; row < rows; row++) {
      let line = "";
      let activeColor = "";
      let run = "";

      const flushRun = () => {
        if (!run) return;
        line += activeColor ? `<span style="color:${activeColor}">${run}</span>` : run;
        run = "";
      };

      for (let col = 0; col < columns; col++) {
        const idx = row * columns + col;
        const val = displayHeat[idx];
        const pGlyph = particleGlyphs.get(idx);
        const charIdx = clamp(Math.floor(val * (chars.length - 1)), 0, chars.length - 1);
        const palIdx = clamp(Math.floor(Math.pow(val, 0.72) * (palette.length - 1)), 0, palette.length - 1);
        const color = pGlyph ? pGlyph.color : (val < 0.025 ? "" : palette[palIdx]);
        const char = pGlyph ? pGlyph.glyph : (val < 0.025 ? " " : chars[charIdx]);

        if (color !== activeColor) {
          flushRun();
          activeColor = color;
        }
        run += escapeHtml(char);
      }

      flushRun();
      lines.push(line);
    }

    element.innerHTML = lines.join("\n");
  }

  window.initAsciiFlame = function () {
    const container = document.getElementById('flame-container');
    const output = document.getElementById('ascii-flame-canvas');
    if (!container || !output) return;

    const canvasMeasure = document.createElement("canvas").getContext("2d");
    let columns = 1, rows = 1;
    let heat = new Float32Array(1);
    let nextHeat = new Float32Array(1);
    let particles = [];
    let prevTime = 0;
    let startTime = performance.now();
    let animId = 0;
    let isVisible = true;

    function handleResize() {
      const bounds = container.getBoundingClientRect();
      const w = Math.max(bounds.width, container.clientWidth) || 800;
      const h = Math.max(bounds.height, container.clientHeight) || 500;

      const fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      const lineH = FONT_SIZE * 1.05;
      if (canvasMeasure) {
        canvasMeasure.font = `${FONT_SIZE}px ${fontFamily}`;
      }
      const charW = canvasMeasure ? canvasMeasure.measureText("M").width : FONT_SIZE * 0.6;
      const nextCols = Math.max(1, Math.floor(w / charW));
      const nextRows = Math.max(1, Math.floor(h / lineH));

      if (nextCols === columns && nextRows === rows) return;
      columns = nextCols;
      rows = nextRows;

      heat = new Float32Array(columns * rows);
      nextHeat = new Float32Array(columns * rows);
      particles = [];

      for (let s = 0; s < Math.min(rows, 32); s++) {
        seedFuel(heat, columns, rows, CONFIG, s / FPS);
        propagateFire(heat, nextHeat, columns, rows, CONFIG);
        [heat, nextHeat] = [nextHeat, heat];
      }

      renderFire(output, heat, particles, columns, rows, CONFIG.charset, COLOR_PALETTE, CONFIG.sparkColor);
    }

    function draw(timestamp) {
      if (!isVisible) return;

      const interval = 1000 / FPS;
      const elapsed = timestamp - prevTime;

      if (elapsed >= interval || prevTime === 0) {
        const sec = (timestamp - startTime) / 1000;
        seedFuel(heat, columns, rows, CONFIG, sec);
        propagateFire(heat, nextHeat, columns, rows, CONFIG);
        [heat, nextHeat] = [nextHeat, heat];
        particles = updateParticles(particles, columns, rows, CONFIG);
        renderFire(output, heat, particles, columns, rows, CONFIG.charset, COLOR_PALETTE, CONFIG.sparkColor);
        prevTime = timestamp - (elapsed % interval);
      }

      animId = requestAnimationFrame(draw);
    }

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
          if (isVisible) {
            handleResize();
            prevTime = performance.now();
            animId = requestAnimationFrame(draw);
          } else {
            if (animId) cancelAnimationFrame(animId);
          }
        });
      }, { threshold: 0.05 });
      observer.observe(container);
    } else {
      handleResize();
      animId = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', handleResize, { passive: true });
    handleResize();
  };
})();
