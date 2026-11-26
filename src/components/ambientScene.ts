// A photographic star field, meteors, and satellite passes in one WebGL pass.
const vertexSource = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

// Pixel-sized stars are composed independently of the drawing-buffer resolution.
const fragmentSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 resolution;
uniform vec2 viewport;
uniform float time;
uniform float reading;
uniform float clearWidth;
uniform float readingCenter;
uniform vec3 paper;
uniform vec3 ink;
uniform vec4 meteor;
uniform vec4 meteorTrail;
uniform vec4 meteorTiming;
uniform vec4 satellite;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), f.x),
             mix(hash(cell + vec2(0.0, 1.0)), hash(cell + 1.0), f.x), f.y);
}
// Independent random brightness targets, interpolated without a repeating pulse.
float twinkle(float clock, vec2 id) {
  float sampleId = floor(clock);
  float blend = fract(clock);
  return mix(hash(id + vec2(sampleId, 83.1)),
             hash(id + vec2(sampleId + 1.0, 83.1)), blend);
}
float stars(vec2 pixel, float spacing, float seed, float radius, float strength, vec2 velocity) {
  vec2 offset = vec2(seed * 73.7, seed * 29.3);
  vec2 shifted = pixel + offset + velocity * time;
  vec2 cell = floor(shifted / spacing);
  vec2 id = cell + seed;
  float individual = hash(id + 7.2);
  vec2 center = (vec2(hash(id), hash(id + 17.6)) * 0.76 + 0.12) * spacing;
  // Slightly different depths drift at different speeds, without zooming at the reader.
  vec2 local = mod(shifted, spacing) - center;
  vec2 world = (cell * spacing + center - offset) / 1000.0;
  float arc = world.y - world.x * 0.46 - 0.16 * sin(world.x * 2.0);
  float band = exp(-pow((arc - 0.28) * 2.8, 2.0));
  float density = 0.19 + 0.28 * band + 0.18 * noise(world * 3.2 + 41.0);
  float exists = step(hash(id + 43.8), density);
  float size = radius * mix(0.7, 1.25, individual);
  float footprint = viewport.x / resolution.x;
  float spread = size * size + footprint * footprint * 0.18;
  float core = exp(-dot(local, local) / spread) * size * size / spread;
  float halo = exp(-dot(local, local) / (spread * 9.0)) * 0.045;
  float temperament = hash(id + 23.4);
  float clock = time * mix(1.3, 3.1, temperament) + individual * 62.83;
  float wander = twinkle(clock, id);
  float rapid = twinkle(clock * 3.7 + 19.3, id + 51.7);
  // Rare high samples make brief glints; most rapid variation stays subtle.
  float glint = smoothstep(0.78, 0.98, rapid);
  float variation = (wander - 0.5) * 1.1 + (rapid - 0.5) * 0.24 + glint * 0.65;
  float anchor = step(0.95, strength);
  // Some stars remain almost steady, and the brightest anchors fluctuate less.
  float activity = mix(0.1, 1.0, smoothstep(0.18, 0.42, temperament));
  float flicker = 0.78 + variation * activity * mix(1.0, 0.55, anchor);
  float edge = 0.78 + 0.22 * hash(floor(local * 2.0) + seed);
  return exists * (core * edge + halo * anchor) * strength * flicker;
}
float passingSatellite(vec2 pixel) {
  if (satellite.w <= 0.0) return 0.0;
  vec2 delta = pixel - satellite.xy;
  float distance = dot(delta, delta);
  if (distance > 36.0) return 0.0;
  float footprint = viewport.x / resolution.x;
  float spread = satellite.z * satellite.z + footprint * footprint * 0.28;
  float core = exp(-distance / spread) * satellite.z * satellite.z / spread;
  float halo = exp(-distance / (spread * 5.0)) * 0.028;
  return (core + halo) * satellite.w;
}
float meteorBurn(float progress) {
  float ignition = smoothstep(0.0, 0.075, progress);
  float burnout = 1.0 - smoothstep(0.84, 1.0, progress);
  float flutter = 0.84 + 0.16 * noise(vec2(progress * 27.0, meteorTiming.z));
  float flare = exp(-pow((progress - meteorTiming.w) / 0.055, 2.0));
  float flareStrength = mix(0.18, 0.65, smoothstep(0.85, 1.3, meteorTrail.w));
  return ignition * burnout * flutter *
    (0.64 + 0.36 * sin(progress * 3.14159) + flare * flareStrength);
}
vec3 shootingStar(vec2 pixel) {
  if (meteor.z <= 0.0) return vec3(0.0);
  vec2 delta = pixel - meteor.xy;
  float along = dot(delta, meteorTrail.xy);
  float across = dot(delta, vec2(-meteorTrail.y, meteorTrail.x));
  float progress = clamp(meteor.w / meteorTiming.x, 0.0, 1.0);
  float headDistance = meteor.z * progress;
  // Only the narrow, already traversed section needs the luminous-wake math.
  if (abs(across) > 7.0 || along < -4.0 || along > headDistance + 4.0)
    return vec3(0.0);

  // Light belongs to its emission position, so the wake stays behind at burnout.
  float emittedAt = clamp(along / meteor.z, 0.0, 1.0);
  float age = meteor.w - emittedAt * meteorTiming.x;
  if (age > meteorTiming.y) return vec3(0.0);
  float freshness = exp(-max(age, 0.0) / (meteorTiming.y * 0.28));
  float decay = freshness * (1.0 - smoothstep(meteorTiming.y * 0.6, meteorTiming.y, age));
  float texture = 0.86 + 0.14 * noise(vec2(along * 0.045, meteorTiming.z + 17.0));
  float width = meteorTrail.z * mix(0.35, 1.0, freshness) * texture;
  float footprint = viewport.x / resolution.x;
  float spread = width * width + footprint * footprint * 0.18;
  float core = exp(-across * across / spread) * width * width / spread;
  float glow = exp(-across * across / (spread * 7.0)) * 0.045;
  float deposited = step(0.0, age) * step(0.0, along) * step(along, meteor.z);
  float wake = (core + glow) * decay * meteorBurn(emittedAt) * deposited;

  vec2 tip = delta - meteorTrail.xy * headDistance;
  float headSpread = meteorTrail.z * meteorTrail.z + footprint * footprint * 0.18;
  float head = exp(-dot(tip, tip) / (headSpread * 2.0)) * meteorBurn(progress);
  // The newest light is ivory; older light acquires a little of the site's warmth.
  vec3 wakeTint = mix(ink, ink * vec3(1.0, 0.9, 0.78),
    smoothstep(0.015, meteorTiming.y * 0.7, age) * 0.65);
  return ((wakeTint - paper) * wake + (ink - paper) * head * 0.75) * meteorTrail.w;
}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  vec2 pixel = uv * viewport;
  // Keep every animated layer outside the measured reading column, including grain.
  float distance = abs(uv.x - readingCenter);
  // Let stars and grain dissolve across a broad margin, without a visible edge.
  float feather = 320.0 / viewport.x;
  float margin = smoothstep(clearWidth * 0.5, clearWidth * 0.5 + feather, distance);
  float visibility = mix(1.0, margin, reading);
  if (visibility <= 0.0) {
    gl_FragColor = vec4(paper, 1.0);
    return;
  }

  // Four exposures: distant dust, small stars, drifting foreground, rare anchors.
  float light = stars(pixel, 23.0, 3.1, 0.5, 0.22, vec2(0.24, -0.07));
  light += stars(pixel, 55.0, 9.7, 0.78, 0.62, vec2(0.65, -0.18));
  light += stars(pixel, 117.0, 21.4, 1.0, 0.92, vec2(1.55, -0.38));
  light += stars(pixel, 279.0, 37.9, 1.25, 1.2, vec2(0.38, -0.1));
  light += passingSatellite(pixel);

  // The grain has a stable structure and a visible, softly changing emulsion.
  vec2 grainPixel = floor(pixel * 1.15);
  float fixedGrain = hash(grainPixel);
  float frame = time * 12.0;
  float grainA = hash(grainPixel + floor(frame) * vec2(17.0, 37.0));
  float grainB = hash(grainPixel + (floor(frame) + 1.0) * vec2(17.0, 37.0));
  float movingGrain = mix(grainA, grainB, smoothstep(0.0, 1.0, fract(frame)));
  // Center the grain on the page color so the clear column has no darker seam.
  float grain = (fixedGrain - 0.5) * 0.024 + (movingGrain - 0.5) * 0.022;

  vec3 color = paper + (ink - paper) * (grain + light) * visibility;
  color += shootingStar(pixel) * visibility;
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}

`;

export function startAmbientScene(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) return;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let uniforms: Record<string, WebGLUniformLocation | null> = {};
  let frame = 0;
  let lastFrame = 0;
  // Keep the exposure clock continuous across full page navigations.
  let epoch = Date.now();
  try {
    const saved = Number(sessionStorage.getItem("ambient-sky-epoch"));
    if (saved > 0 && saved <= epoch) epoch = saved;
    else sessionStorage.setItem("ambient-sky-epoch", String(epoch));
  } catch {
    /* Storage is optional; rendering still works. */
  }
  let elapsed = 0;
  let reading = 0;
  let clearWidth = 0;
  let readingCenter = 0.5;
  let lost = false;
  let disposed = false;
  let meteorCycle = -1;
  let meteorActive = false;
  let meteorEvent = {
    start: 0,
    duration: 1,
    x: 0,
    y: 0,
    dx: 1,
    dy: 0,
    travel: 0,
    wake: 0.2,
    width: 1,
    brightness: 1,
    seed: 0,
    flare: 0.5,
  };
  let satelliteCycle = -1;
  let satelliteEvent = {
    start: 0,
    duration: 1,
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    size: 0.8,
    brightness: 0.5,
  };

  function meteorRandom(cycle: number, seed: number) {
    const value = Math.sin(cycle * 127.1 + seed * 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function updateSatellite() {
    // Use a separate seed sequence, sharing the sky clock across navigation.
    const random = (cycle: number, seed: number) =>
      meteorRandom(cycle + 719, seed + 37);
    let cycle = Math.max(0, satelliteCycle);
    let start =
      satelliteCycle < 0 ? 15 + random(cycle, 4) * 15 : satelliteEvent.start;
    let duration =
      satelliteCycle < 0 ? 55 + random(cycle, 5) * 30 : satelliteEvent.duration;
    // A lone pass lasts about a minute, followed by a longer, irregular quiet gap.
    while (elapsed >= start + duration) {
      cycle += 1;
      start += duration + 70 + random(cycle, 4) * 90;
      duration = 55 + random(cycle, 5) * 30;
    }
    if (cycle !== satelliteCycle) {
      satelliteCycle = cycle;
      const fromLeft = random(cycle, 2) > 0.5;
      const y = 0.2 + random(cycle, 6) * 0.62;
      satelliteEvent = {
        start,
        duration,
        x: fromLeft ? -0.04 : 1.04,
        y,
        dx: fromLeft ? 1.08 : -1.08,
        dy: 0.2 + random(cycle, 7) * 0.62 - y,
        size: 0.7 + random(cycle, 9) * 0.22,
        brightness: 0.32 + random(cycle, 10) * 0.28,
      };
    }
    const age = elapsed - satelliteEvent.start;
    if (motion.matches || age < 0 || age >= satelliteEvent.duration) {
      gl!.uniform4f(uniforms.satellite, 0, 0, 1, 0);
      return;
    }
    const progress = age / satelliteEvent.duration;
    const smooth = (value: number) => {
      const t = Math.max(0, Math.min(1, value));
      return t * t * (3 - 2 * t);
    };
    // Keep the light steady throughout the crossing, with gentle entry and exit.
    const visibility =
      smooth(age / 3) * smooth((satelliteEvent.duration - age) / 5);
    gl!.uniform4f(
      uniforms.satellite,
      (satelliteEvent.x + satelliteEvent.dx * progress) * canvas.clientWidth,
      (satelliteEvent.y + satelliteEvent.dy * progress) * canvas.clientHeight,
      satelliteEvent.size,
      satelliteEvent.brightness * visibility,
    );
  }

  function updateMeteor() {
    let cycle = Math.max(0, meteorCycle);
    let start =
      meteorCycle < 0 ? 20 + meteorRandom(cycle, 4) * 40 : meteorEvent.start;
    let duration =
      meteorCycle < 0
        ? 0.45 + meteorRandom(cycle, 5) * 0.2
        : meteorEvent.duration;
    let wake =
      meteorCycle < 0 ? 0.18 + meteorRandom(cycle, 8) * 0.12 : meteorEvent.wake;
    // Leave 20–60 seconds of quiet after the last wake has fully disappeared.
    // Catch up to the continuous sky clock when navigating or returning to a tab.
    while (elapsed >= start + duration + wake) {
      cycle += 1;
      start += duration + wake + 20 + meteorRandom(cycle, 4) * 40;
      duration = 0.45 + meteorRandom(cycle, 5) * 0.2;
      wake = 0.18 + meteorRandom(cycle, 8) * 0.12;
    }
    if (cycle !== meteorCycle) {
      meteorCycle = cycle;
      // Reproduce each event across navigation, with a different path and gap.
      const random = (seed: number) => meteorRandom(cycle, seed);
      const angle = 0.28 + random(1) * 0.42;
      const dx = Math.cos(angle) * (random(2) > 0.3 ? 1 : -1);
      const dy = -Math.sin(angle);
      const travel =
        Math.min(
          (canvas.clientWidth * 0.88) / Math.abs(dx),
          (canvas.clientHeight * 0.72) / Math.abs(dy),
          1100,
        ) *
        (0.8 + random(3) * 0.2);
      meteorEvent = {
        start,
        duration,
        // Leave room for the entire flight within every viewport size.
        x:
          0.06 +
          Math.max(0, -dx * travel) / canvas.clientWidth +
          random(6) * (0.88 - Math.abs(dx * travel) / canvas.clientWidth),
        y:
          0.12 +
          Math.abs(dy * travel) / canvas.clientHeight +
          random(7) * (0.8 - Math.abs(dy * travel) / canvas.clientHeight),
        dx,
        dy,
        travel,
        wake,
        width: 0.48 + random(9) * 0.28,
        brightness: 0.55 + random(10) * 0.4 + (random(11) > 0.85 ? 0.35 : 0),
        seed: random(12) * 64,
        flare: 0.38 + random(13) * 0.4,
      };
    }

    const age = elapsed - meteorEvent.start;
    meteorActive =
      !motion.matches &&
      age >= 0 &&
      age < meteorEvent.duration + meteorEvent.wake;
    if (!meteorActive) {
      gl!.uniform4f(uniforms.meteor, 0, 0, 0, 0);
      return;
    }
    gl!.uniform4f(
      uniforms.meteor,
      meteorEvent.x * canvas.clientWidth,
      meteorEvent.y * canvas.clientHeight,
      meteorEvent.travel,
      age,
    );
    gl!.uniform4f(
      uniforms.meteorTrail,
      meteorEvent.dx,
      meteorEvent.dy,
      meteorEvent.width,
      meteorEvent.brightness,
    );
    gl!.uniform4f(
      uniforms.meteorTiming,
      meteorEvent.duration,
      meteorEvent.wake,
      meteorEvent.seed,
      meteorEvent.flare,
    );
  }

  function shader(type: number, source: string) {
    const item = gl!.createShader(type);
    if (!item) return null;
    gl!.shaderSource(item, source);
    gl!.compileShader(item);
    if (!gl!.getShaderParameter(item, gl!.COMPILE_STATUS)) {
      gl!.deleteShader(item);
      return null;
    }
    return item;
  }

  function initialize() {
    const vertex = shader(gl!.VERTEX_SHADER, vertexSource);
    const fragment = shader(gl!.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) {
      if (vertex) gl!.deleteShader(vertex);
      if (fragment) gl!.deleteShader(fragment);
      return false;
    }
    program = gl!.createProgram();
    if (!program) return false;
    gl!.attachShader(program, vertex);
    gl!.attachShader(program, fragment);
    gl!.linkProgram(program);
    gl!.deleteShader(vertex);
    gl!.deleteShader(fragment);
    if (!gl!.getProgramParameter(program, gl!.LINK_STATUS)) return false;
    gl!.useProgram(program);
    buffer = gl!.createBuffer();
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
    gl!.bufferData(
      gl!.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl!.STATIC_DRAW,
    );
    const position = gl!.getAttribLocation(program, "position");
    gl!.enableVertexAttribArray(position);
    gl!.vertexAttribPointer(position, 2, gl!.FLOAT, false, 0, 0);
    uniforms = Object.fromEntries(
      [
        "resolution",
        "viewport",
        "time",
        "reading",
        "clearWidth",
        "readingCenter",
        "paper",
        "ink",
        "meteor",
        "meteorTrail",
        "meteorTiming",
        "satellite",
      ].map((name) => [name, gl!.getUniformLocation(program!, name)]),
    );
    return true;
  }

  function updateReading() {
    const opening = document.querySelector(".home-opening");
    // Short pages can opt out of the cleared column and keep the whole sky.
    reading = document.querySelector("[data-open-sky]")
      ? 0
      : opening
        ? Math.max(
            0,
            Math.min(
              1,
              -opening.getBoundingClientRect().top /
                (opening.clientHeight * 0.6),
            ),
          )
        : 1;
    const article = document.querySelector(
      ".article-page--reading, .article-page, .home-notes, .article-index",
    );
    const width =
      article?.getBoundingClientRect().width ?? Math.min(800, innerWidth - 56);
    const clearance = article?.matches(".article-page--reading") ? 400 : 240;
    clearWidth = Math.min(1, (width + clearance) / canvas.clientWidth);
    const bounds = article?.getBoundingClientRect();
    readingCenter = bounds
      ? (bounds.left + bounds.width / 2) / canvas.clientWidth
      : 0.5;
  }

  function updatePalette() {
    if (!program || lost) return;
    // Share the exact page background and text colors with the star field.
    const style = getComputedStyle(document.body);
    const rgb = (value: string) =>
      (value.match(/[\d.]+/g) ?? [])
        .slice(0, 3)
        .map(Number)
        .map((v) => v / 255);
    gl!.uniform3fv(uniforms.paper, rgb(style.backgroundColor));
    gl!.uniform3fv(uniforms.ink, rgb(style.color));
    draw();
  }

  function resize() {
    if (lost || !program) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const scale = Math.min(
      devicePixelRatio || 1,
      1.5,
      Math.sqrt(2400000 / Math.max(width * height, 1)),
    );
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl!.uniform2f(uniforms.viewport, width, height);
    meteorCycle = -1;
    updateReading();
    draw();
  }

  function draw() {
    if (lost || !program || disposed) return;
    elapsed = motion.matches ? 0 : (Date.now() - epoch) / 1000;
    updateMeteor();
    updateSatellite();
    gl!.uniform1f(uniforms.time, elapsed);
    gl!.uniform1f(uniforms.reading, reading);
    gl!.uniform1f(uniforms.clearWidth, clearWidth);
    gl!.uniform1f(uniforms.readingCenter, readingCenter);
    gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    canvas.dataset.ready = "";
  }

  function tick(now: number) {
    frame = 0;
    if (document.hidden || motion.matches || lost || disposed) return;
    const interval = 1000 / (meteorActive ? 60 : 30);
    if (now - lastFrame >= interval - 1) {
      lastFrame = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }

  function resume() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = performance.now();
    draw();
    if (!document.hidden && !motion.matches && !lost && !disposed)
      frame = requestAnimationFrame(tick);
  }
  function scroll() {
    updateReading();
    if (motion.matches) draw();
  }
  function contextLost(event: Event) {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    delete canvas.dataset.ready;
  }
  function contextRestored() {
    lost = false;
    if (initialize()) {
      resize();
      updatePalette();
      resume();
    }
  }
  if (!initialize()) return;
  resize();
  updatePalette();
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", scroll, { passive: true });
  document.addEventListener("visibilitychange", resume);
  motion.addEventListener("change", resume);
  canvas.addEventListener("webglcontextlost", contextLost);
  canvas.addEventListener("webglcontextrestored", contextRestored);
  resume();
  window.addEventListener("pagehide", (event) => {
    cancelAnimationFrame(frame);
    if (event.persisted) return;
    disposed = true;
    window.removeEventListener("resize", resize);
    window.removeEventListener("scroll", scroll);
    document.removeEventListener("visibilitychange", resume);
    motion.removeEventListener("change", resume);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  });
  window.addEventListener("pageshow", resume);
}
