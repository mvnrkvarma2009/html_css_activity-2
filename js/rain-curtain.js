/**
 * ==========================================================================
 * AETHER CHRONO-X — js/rain-curtain.js
 * ArgentCloudburst Digital Rain Curtain (Originkit Port)
 * ==========================================================================
 * Ethereal silver-and-lavender rain curtain background with pointer parting,
 * wind lean, and click lightning taps.
 * Palette: Obsidian (#07070F), Silver (#FFFFFF), Lavender Mist (#EEE4F8).
 * ==========================================================================
 */

(function () {
  'use strict';

  const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const FRAG = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uSpx;
uniform vec4 uPlace;
uniform float uPxCss;
uniform float uGrainPx;
uniform float uTime;
uniform float uFallT;
uniform vec2 uMouse;
uniform float uHover;
uniform float uLean;
uniform float uPour;
uniform vec4 uTaps[4];
uniform vec3 uBg;
uniform vec3 uBase;
uniform vec3 uAccent;
uniform float uSc;
uniform float uDensity;
uniform float uBandY;
uniform float uPitch;
uniform float uLineW;
uniform float uCell;
uniform float uDashMin;
uniform float uDashMax;
uniform float uFall;
uniform float uJit;
uniform float uTwRate;
uniform float uTwMin;
uniform float uBandW;
uniform float uBandGlow;
uniform float uFringe;
uniform float uEndCenter;
uniform float uEndSide;
uniform float uEndJit;
uniform float uEdge;
uniform float uGlow;
uniform vec3 uTip;
uniform vec3 uCyan;
uniform float uCyanShare;
uniform vec3 uHazeC;
uniform float uHazeDepth;
uniform vec3 uRimC;
uniform float uRimY;
uniform float uRimCurve;
uniform float uRimAmt;
uniform float uSeed;
uniform float uGrain;
uniform float uVig;
uniform float uHoverAmt;
uniform float uTapMode;
out vec4 outColor;

// Tilt perspective: the eye sits this many composition heights in front of the curtain.
const float PERSP = 2.2;
const float REF_HALF_W = 0.75;
// The original re-rolled each dash's twinkle uTwRate times a second; it now eases
// between levels at a sixth of that, so 48 reads as a soft glimmer rather than static.
const float TW_SCALE = 0.1667;
// Width, in probability, of a dash's fade as the envelope thins under it. The
// original switched it with step(), so a falling dash vanished at a hard line.
const float FADE = 0.06;
// Downpour, per unit of uPour: extra dash probability, stretch, brightness, bar flare.
const float POUR_DENS = 0.22;
const float POUR_STRETCH = 0.6;
const float POUR_BRIGHT = 0.45;
const float POUR_BAND = 0.9;
// Hover: radius of the parted pocket, in composition heights.
const float PART_R = 0.14;
// Tap splash: lifetime (s, TAP_LIFE on the CPU), how far the ring travels, how hard it shoves.
const float RIP_LIFE = 1.6;
const float RIP_REACH = 0.85;
const float RIP_PUSH = 0.012;
// Tap lightning: half-width of the struck strands, how fast the charge runs down
// (composition heights/s), how fast it dies, and its flicker (rad/s, ~9 Hz).
const float BOLT_W = 0.03;
const float BOLT_RUN = 5.0;
const float BOLT_DECAY = 6.0;
const float BOLT_FLICK = 55.0;

uint hu(uint x) {
    x ^= x >> 16u; x *= 0x7feb352du;
    x ^= x >> 15u; x *= 0x846ca68bu;
    x ^= x >> 16u;
    return x;
}
// One mixing round over odd-multiplier-spread inputs (the original ran three).
float hf(float a, float b, float c) {
    uint h = uint(int(a)) * 0x8da6b343u ^ uint(int(b)) * 0xd8163841u ^ uint(int(c)) * 0xcb1ab31fu ^ uint(uSeed) * 0x9e3779b9u;
    return float(hu(h)) * (1.0 / 4294967295.0);
}

// Frame (buffer px, GL y up) → world. Inverts the offset, then Tilt, then Angle.
vec2 worldOf(vec2 frag, out bool ok) {
    vec2 p = vec2(frag.x - uCenter.x, uCenter.y - frag.y);
    float D = PERSP * uSpx;
    float den = D * uPlace.z + p.y * uPlace.w;
    ok = den > 1e-3 * D;
    float v = p.y * D / max(den, 1e-3 * D);
    float u = p.x * (D - v * uPlace.w) / D;
    vec2 q = vec2(u * uPlace.x + v * uPlace.y, -u * uPlace.y + v * uPlace.x);
    return q / uSpx;
}

// Share of a pixel footprint [f - a/2, f + a/2] that falls inside [s0, s1].
float cover(float f, float a, float s0, float s1) {
    return clamp((min(f + 0.5 * a, s1) - max(f - 0.5 * a, s0)) / a, 0.0, 1.0);
}

void main() {
    bool ok;
    vec2 w = worldOf(gl_FragCoord.xy, ok);
    // World size of one buffer pixel, perspective included; taken before any branch.
    float pw = max(max(length(dFdx(w)), length(dFdy(w))), 1e-6);
    vec2 fuv = gl_FragCoord.xy / max(uRes, vec2(1.0));
    // The top lip stays on the frame, so a tall frame's sky fills with fringe rain.
    float fy = 1.0 - fuv.y;
    float env = 0.0;
    float band = 0.0;
    vec3 col = uBg;

    if (ok) {
        float y = w.y + 0.5;
        float xn = clamp(w.x / REF_HALF_W, -1.0, 1.0);
        float bY = uBandY;
        float sc = max(uSc, 0.05);

        // Pointer: the rain parts around it like a hand held in the curtain. Lanes
        // bend aside (sampled toward the pointer, kept monotonic so none fold), the
        // core is sheltered, and drops light up on the rim where they bend.
        bool mok;
        vec2 dm = w - worldOf(uMouse, mok);
        float hk = mok ? uHover * uHoverAmt : 0.0;
        float g = exp(-dot(dm, dm) / (PART_R * PART_R));
        float part = dm.x * g * min(0.45 * hk, 0.9);
        float shelter = g * g * min(hk, 1.0);
        float near = hk * 4.0 * g * (1.0 - g);

        // Taps: each sends a splash ring out from where it landed, shoving the lanes
        // aside as it passes and lighting the drops on its front.
        float push = 0.0;
        float splash = 0.0;
        if (uTapMode < 0.5) {
            for (int i = 0; i < 4; i++) {
                vec4 T = uTaps[i];
                if (T.w <= 0.0) continue;
                bool tok;
                vec2 dv = w - worldOf(T.xy, tok);
                if (!tok) continue;
                float r = length(dv);
                float life = clamp(T.z / RIP_LIFE, 0.0, 1.0);
                float k = 1.0 - life;
                float R = RIP_REACH * (1.0 - k * k * k);
                float wd = 0.03 + 0.08 * life;
                float z = (r - R) / wd;
                float ring = exp(-z * z) * k * k;
                push += dv.x / max(r, 1e-3) * ring * min(T.w, 1.0);
                splash += T.w * (ring + exp(-r * r * 300.0) * exp(-T.z * 6.0));
            }
        }

        // Wind leans the lanes about the bar, so the curtain swings from it.
        float sx = w.x - part - push * RIP_PUSH - uLean * (y - bY);
        float P = sc * uPitch;
        float lane = floor(sx / P);
        float cx = (lane + 0.5 + (hf(lane, 3.0, 7.0) - 0.5) * 0.3) * P;
        float d = abs(sx - cx) * inversesqrt(1.0 + uLean * uLean);
        float hw = max(0.6 * pw * uPxCss, P * uLineW * 0.5);
        float shape = exp(-(d * d) / (hw * hw)) + uGlow * 0.5 * exp(-d / max(P * 0.4, 1e-6));

        // Brightness envelope, fixed to the composition; past its sides it carries on flat.
        float laneX = clamp(cx / (2.0 * REF_HALF_W) + 0.5, 0.0, 1.0);
        float xl = laneX * 2.0 - 1.0;
        float endY = mix(uEndSide, uEndCenter, 1.0 - xl * xl) + (hf(lane, 11.0, 5.0) - 0.5) * 2.0 * uEndJit;
        endY = max(endY, bY + 0.05);
        float top = smoothstep(0.01, 0.06, fy);
        float up = top * mix(uFringe, 1.0, smoothstep(bY - 0.12, bY, y));
        float t = clamp((y - bY) / (endY - bY), 0.0, 1.0);
        float down = pow(1.0 - t, 1.4);
        env = y < bY ? up : down;
        band = exp(-pow((y - bY) / max(uBandW, 1e-3), 2.0));
        float sideF = mix(uEdge, 1.0, 1.0 - pow(abs(xl), 4.0));

        // Lightning: each tap strikes the strands nearest it. The charge runs from
        // the bar to just past the hem in about 0.17 s, flickers twice as it dies,
        // and the bar and the whole curtain flash with it, most near the strike.
        float strike = 0.0;
        float flash = 0.0;
        if (uTapMode > 0.5) {
            for (int i = 0; i < 4; i++) {
                vec4 T = uTaps[i];
                if (T.w <= 0.0) continue;
                bool tok;
                vec2 tw = worldOf(T.xy, tok);
                if (!tok) continue;
                float a = T.z;
                float fl = exp(-a * BOLT_DECAY) * (0.6 + 0.4 * cos(a * BOLT_FLICK));
                float lx = (cx - tw.x) / BOLT_W;
                // Not every strand in reach takes the charge, so the strike reads ragged.
                float takes = step(hf(lane, 71.0, float(i) + floor(T.x)), 0.75);
                float front = bY - 0.06 + a * BOLT_RUN;
                float mask = (1.0 - smoothstep(front - 0.04, front, y)) * smoothstep(bY - 0.08, bY - 0.03, y) * (1.0 - smoothstep(endY, endY + 0.08, y));
                strike = max(strike, exp(-lx * lx) * takes * mask * fl * min(T.w, 1.5));
                flash += T.w * fl * (0.35 + exp(-abs(w.x - tw.x) * 5.0));
            }
        }


        // Long dashes falling down each lane at a slow per-lane speed.
        float cellH = max(uCell * sc * mix(0.75, 1.3, hf(lane, 19.0, 4.0)), 1e-5);
        float v = uFall * (1.0 + (hf(lane, 13.0, 1.0) * 2.0 - 1.0) * uJit);
        float yy = y - uFallT * v + hf(lane, 17.0, 9.0) * 10.0;
        float cy = yy / cellH;
        float cl = floor(cy);
        float fr = cy - cl;
        float dens = 0.4 + uDensity;
        float pOn = clamp((0.12 + 0.88 * pow(env, 0.55)) * dens + near * 0.3 + splash * 0.35 - shelter * 0.3 + uPour * POUR_DENS, 0.0, 0.98);
        float on = smoothstep(-FADE, FADE, pOn - hf(lane, cl, 21.0));
        float len = min(1.0, mix(uDashMin, uDashMax, hf(lane, cl, 23.0)) * mix(0.45, 1.0, env) * (1.0 + uPour * POUR_STRETCH));
        float st = hf(lane, cl, 29.0) * max(1.0 - len, 0.0);
        float lit = on * cover(fr, pw / cellH, st, st + len);

        // Fine sparkle in the fringe above the band.
        float cellS = max(cellH * 0.22, 1e-5);
        float cs = (y - uFallT * v * 0.6 + hf(lane, 53.0, 3.0) * 10.0) / cellS;
        float cf = floor(cs);
        float spk = step(hf(lane, cf, 57.0), 0.55 * dens) * cover(cs - cf, pw / cellS, 0.05, 0.95);
        float headMix = 1.0 - smoothstep(bY - 0.09, bY - 0.02, y);
        lit = mix(lit, max(lit * 0.5, spk), headMix);

        // Twinkle: smooth value noise in time per dash, not a re-roll every step.
        float ft = uTime * uTwRate * TW_SCALE + hf(lane, cl, 33.0) * 8.0;
        float fi = floor(ft);
        float ff = ft - fi;
        ff = ff * ff * (3.0 - 2.0 * ff);
        float tw = mix(uTwMin, 1.0, mix(hf(lane, cl, fi + 31.0), hf(lane, cl, fi + 32.0), ff));

        float cb = mix(0.5, 1.0, hf(lane, cl, 43.0));
        float lb = mix(0.6, 1.0, hf(lane, 37.0, 2.0));
        float bright = lit * shape * lb * cb * tw * (0.2 + env) * (1.0 + band * 0.8) * sideF * (1.0 + near * 0.9 + splash * 1.6 + flash * 1.2) * (1.0 - 0.75 * shelter) * (1.0 + uPour * POUR_BRIGHT);

        vec3 dc = mix(uTip, uBase, smoothstep(0.08, 0.55, env));
        dc = mix(dc, uAccent, clamp(band * 0.95 + smoothstep(0.75, 1.0, env) * 0.25, 0.0, 1.0));
        float cyan = step(hf(lane, cl, 41.0), uCyanShare) * (1.0 - band);
        dc = mix(dc, uCyan, cyan * 0.55);

        // Background haze, grey rim shelf at the sides, band glow.
        float hz = smoothstep(0.0, 0.08, fy) * (y < bY ? 1.0 : 1.0 - smoothstep(bY, max(uHazeDepth, bY + 0.01), y));
        col = mix(uBg, uHazeC, hz * 0.9 * mix(0.75, 1.0, 1.0 - xn * xn));
        float rimY = uRimY + uRimCurve * xn * xn;
        float rim = exp(-pow((y - rimY) / 0.04, 2.0)) * mix(0.3, 1.0, xn * xn);
        col += uRimC * rim * uRimAmt;
        col += uAccent * band * uBandGlow * 0.35 * sideF * (1.0 + uPour * POUR_BAND);
        col += dc * bright;
        col += uAccent * (hk * g * 0.035 + splash * 0.05 + flash * 0.03) * (0.3 + env);
        col += uAccent * band * uBandGlow * flash * 0.8;
        col += mix(uTip, uAccent, 0.3) * shape * strike * 1.4;
    }

    // Vignette and grain stay on the frame. Grain cells are whole buffer px, ~1 CSS px.
    float vd = length((fuv - 0.5) * 2.0) / 1.4142;
    col *= 1.0 - uVig * smoothstep(0.35, 1.0, vd);
    vec2 gp = floor(gl_FragCoord.xy / uGrainPx);
    float g = hf(gp.x, gp.y, floor(uTime * 24.0) + 51.0) - 0.5;
    col += g * uGrain * 0.12 * (0.4 + 0.6 * clamp(env + band, 0.0, 1.0));

    outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  const PROP_UNIFORMS = [
    "uRes", "uCenter", "uSpx", "uPlace", "uPxCss", "uGrainPx", "uBg", "uBase", "uAccent", "uSc",
    "uDensity", "uBandY", "uPitch", "uLineW", "uCell", "uDashMin", "uDashMax", "uFall", "uJit",
    "uTwRate", "uTwMin", "uBandW", "uBandGlow", "uFringe", "uEndCenter", "uEndSide", "uEndJit",
    "uEdge", "uGlow", "uTip", "uCyan", "uCyanShare", "uHazeC", "uHazeDepth", "uRimC", "uRimY",
    "uRimCurve", "uRimAmt", "uSeed", "uGrain", "uVig", "uHoverAmt", "uTapMode"
  ];

  const FRAME_UNIFORMS = ["uTime", "uFallT", "uMouse", "uHover", "uLean", "uPour", "uTaps"];

  function parseHex(hex) {
    const s = hex.replace('#', '');
    const r = parseInt(s.substring(0, 2), 16) / 255;
    const g = parseInt(s.substring(2, 4), 16) / 255;
    const b = parseInt(s.substring(4, 6), 16) / 255;
    return [r, g, b];
  }

  function buildGL(gl) {
    const sh = (type, src) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error("Rain shader:", gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    };

    const vs = sh(gl.VERTEX_SHADER, VERT);
    const fs = sh(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return null;

    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("Rain link:", gl.getProgramInfoLog(prog));
      return null;
    }

    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const u = {};
    for (const n of PROP_UNIFORMS) u[n] = gl.getUniformLocation(prog, n);
    for (const n of FRAME_UNIFORMS) u[n] = gl.getUniformLocation(prog, n);

    return { gl, prog, u };
  }

  window.initRainCurtain = function () {
    const container = document.getElementById('rain-canvas-container');
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'rain-canvas';
    container.appendChild(canvas);

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });

    if (!gl) return;
    const G = buildGL(gl);
    if (!G) return;

    // Palette: Ethereal Obsidian & Lavender Mist
    const cBg = parseHex("#07070F");
    const cBase = parseHex("#FFFFFF");
    const cAccent = parseHex("#EEE4F8"); // Ethereal Lavender light bar
    const cTip = parseHex("#FFFFFF");
    const cCyan = parseHex("#DDD6FE");   // Soft violet/lavender tint
    const cHaze = parseHex("#030308");
    const cRim = parseHex("#2E1065");

    let W = 0, H = 0;
    let running = false;
    let isVisible = true;
    let rafId = 0;

    let clock = 0;
    let fallT = 0;
    let lastTime = performance.now();

    let tu = 0.5, tv = 0.5;
    let mx = 0.5, my = 0.5;
    let hov = 0;
    let pu = 0.5, pv = 0.5;
    let gust = 0, lean = 0, leanV = 0, pour = 0;

    const TAP_SLOTS = 4;
    const taps = new Float32Array(TAP_SLOTS * 4);

    function triggerTap(x, y) {
      taps[0] = x;
      taps[1] = y;
      taps[2] = 0;
      taps[3] = 1.0;
    }

    function applyProps() {
      const u = G.u;
      const g = G.gl;

      const bw = canvas.width;
      const bh = canvas.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const S = Math.min(bh, bw / (1200 / 800));

      g.uniform2f(u.uRes, bw, bh);
      g.uniform2f(u.uCenter, bw * 0.5, bh * 0.5);
      g.uniform1f(u.uSpx, S);
      g.uniform4f(u.uPlace, 1, 0, 1, 0); // angle 0, tilt 0
      g.uniform1f(u.uPxCss, dpr);
      g.uniform1f(u.uGrainPx, dpr);

      // Colors
      g.uniform3f(u.uBg, cBg[0], cBg[1], cBg[2]);
      g.uniform3f(u.uBase, cBase[0], cBase[1], cBase[2]);
      g.uniform3f(u.uAccent, cAccent[0], cAccent[1], cAccent[2]);
      g.uniform3f(u.uSc, 0.1, 0.1, 0.1);
      g.uniform3f(u.uTip, cTip[0], cTip[1], cTip[2]);
      g.uniform3f(u.uCyan, cCyan[0], cCyan[1], cCyan[2]);
      g.uniform3f(u.uHazeC, cHaze[0], cHaze[1], cHaze[2]);
      g.uniform3f(u.uRimC, cRim[0], cRim[1], cRim[2]);

      // Curtain parameters
      g.uniform1f(u.uDensity, 0.85);
      g.uniform1f(u.uBandY, 0.04);       // Light bar at the very top horizon
      g.uniform1f(u.uPitch, 1 / 100);
      g.uniform1f(u.uLineW, 0.23);
      g.uniform1f(u.uCell, 0.175);
      g.uniform1f(u.uDashMin, 0.25);
      g.uniform1f(u.uDashMax, 1.0);
      g.uniform1f(u.uFall, 0.45);
      g.uniform1f(u.uJit, 0.25);
      g.uniform1f(u.uTwRate, 48.0);
      g.uniform1f(u.uTwMin, 0.55);
      g.uniform1f(u.uBandW, 0.28);
      g.uniform1f(u.uBandGlow, 0.45);
      g.uniform1f(u.uFringe, 0.35);
      g.uniform1f(u.uEndCenter, 0.88);
      g.uniform1f(u.uEndSide, 0.72);
      g.uniform1f(u.uEndJit, 0.08);
      g.uniform1f(u.uEdge, 0.60);
      g.uniform1f(u.uGlow, 0.30);
      g.uniform1f(u.uCyanShare, 0.22);
      g.uniform1f(u.uHazeDepth, 0.60);
      g.uniform1f(u.uRimY, 0.18);
      g.uniform1f(u.uRimCurve, 0.02);
      g.uniform1f(u.uRimAmt, 0.45);
      g.uniform1f(u.uSeed, 7.0);
      g.uniform1f(u.uGrain, 0.0);
      g.uniform1f(u.uVig, 0.08);
      g.uniform1f(u.uHoverAmt, 1.0);
      g.uniform1f(u.uTapMode, 1.0); // Lightning mode
    }

    function resize() {
      const rect = container.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const bw = Math.round(W * dpr);
      const bh = Math.round(H * dpr);

      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
        gl.viewport(0, 0, bw, bh);
        applyProps();
      }
    }

    function step(now) {
      if (!isVisible) {
        running = false;
        return;
      }

      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      clock += dt * 0.8;
      fallT += dt * 0.7;

      mx += (tu - mx) * Math.min(1, dt * 6);
      my += (tv - my) * Math.min(1, dt * 6);

      // Wind sway dynamics
      const springK = 35.0;
      const damp = 5.0;
      const acc = -springK * lean - damp * leanV + gust * 14.0;
      leanV += acc * dt;
      lean += leanV * dt;
      gust *= Math.max(0, 1 - dt * 4);

      // Taps decay
      for (let i = 0; i < TAP_SLOTS; i++) {
        if (taps[i * 4 + 3] > 0) {
          taps[i * 4 + 2] += dt;
          if (taps[i * 4 + 2] > 1.2) taps[i * 4 + 3] = 0;
        }
      }

      const u = G.u;
      gl.uniform1f(u.uTime, clock);
      gl.uniform1f(u.uFallT, fallT);
      gl.uniform2f(u.uMouse, mx, my);
      gl.uniform1f(u.uHover, hov);
      gl.uniform1f(u.uLean, lean);
      gl.uniform1f(u.uPour, pour);
      gl.uniform4fv(u.uTaps, taps);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      rafId = requestAnimationFrame(step);
    }

    function start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      rafId = requestAnimationFrame(step);
    }

    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    }

    window.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      if (e.clientY <= rect.bottom && e.clientY >= rect.top) {
        tu = (e.clientX - rect.left) / rect.width;
        tv = (e.clientY - rect.top) / rect.height;
        hov = 1.0;
        const du = tu - pu;
        gust += du * 0.2;
        pu = tu;
        pv = tv;
      } else {
        hov = Math.max(0, hov - 0.05);
      }
    }, { passive: true });

    container.addEventListener('click', (e) => {
      const rect = container.getBoundingClientRect();
      const u = (e.clientX - rect.left) / rect.width;
      const v = (e.clientY - rect.top) / rect.height;
      triggerTap(u, v);
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
          if (isVisible) {
            resize();
            start();
          } else {
            stop();
          }
        });
      }, { threshold: 0.05 });
      observer.observe(container);
    } else {
      start();
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();
  };
})();
