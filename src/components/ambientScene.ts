// A fixed photographic star field, rendered in one native WebGL pass.
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
  float phase = individual * 62.83;
  float slow = 0.5 + 0.5 * sin(time * mix(1.0, 2.2, hash(id + 23.4)) + phase);
  float shimmer = noise(vec2(time * mix(2.4, 5.0, individual) + phase, seed + individual));
  float flicker = 0.12 + 0.95 * slow + 0.4 * shimmer;
  float anchor = step(0.95, strength);
  flicker = mix(flicker, 0.5 + 0.52 * slow + 0.12 * shimmer, anchor);
  float edge = 0.78 + 0.22 * hash(floor(local * 2.0) + seed);
  return exists * (core * edge + halo * anchor) * strength * flicker;
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
      ].map((name) => [name, gl!.getUniformLocation(program!, name)]),
    );
    return true;
  }

  function updateReading() {
    const opening = document.querySelector(".home-opening");
    reading = opening
      ? Math.max(
          0,
          Math.min(
            1,
            -opening.getBoundingClientRect().top / (opening.clientHeight * 0.6),
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
    updateReading();
    draw();
  }

  function draw() {
    if (lost || !program || disposed) return;
    elapsed = motion.matches ? 0 : (Date.now() - epoch) / 1000;
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
    const interval = 1000 / 30;
    if (now - lastFrame >= interval) {
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
