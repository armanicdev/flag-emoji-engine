/**
 * WebGL mesh + fragment lighting for the physicsWave variant.
 * Hoist (material nx=0): zero displacement; amplitude grows strongly toward the fly.
 * Texture is sampled at rest material UV (print locked to fabric); normals from ∂disp/∂(nx,ny).
 * Falls back to a 2D multi-frequency warp when WebGL is unavailable.
 */

/** Shared in VS + FS — must stay character-identical for matching motion and lighting. */
const DISP_GLSL = `
float waveEnv(float nx) {
  float ramp = smoothstep(0.0, 0.22, nx);
  float flyBoost = pow(max(nx, 0.0001), 0.62);
  return ramp * flyBoost;
}
vec2 dispVec(float nx, float ny, float t, float amp, float freq, float ripple) {
  float env = waveEnv(nx);
  float k = freq * 6.28318530718;
  float sync = step(0.5, u_gifSync);
  float rp = mix(ripple, max(1.0, float(int(floor(ripple + 0.5)))), sync);
  float m07 = mix(0.7, 1.0, sync);
  float m114 = mix(1.14, 1.0, sync);
  float m086 = mix(0.86, 1.0, sync);
  float m09 = mix(0.9, 1.0, sync);
  float m112 = mix(1.12, 1.0, sync);
  float m078 = mix(0.78, 1.0, sync);
  float m105 = mix(1.05, 1.0, sync);
  float m093 = mix(0.93, 1.0, sync);
  float m102 = mix(1.02, 1.0, sync);
  float m088 = mix(0.88, 1.0, sync);
  float w1 = sin(nx * k + t);
  float w2 = sin(nx * k * 2.18 + t * rp + ny * 4.85);
  float w3 = sin(ny * 11.0 + t * m07) * 0.16 * smoothstep(0.05, 1.0, nx);
  float w4 = sin(nx * k * 3.38 + ny * 7.5 + t * m114) * 0.15 * env;
  float w5 = sin(nx * k * 0.9 + ny * 2.35 + t * m086) * 0.16 * env;
  float vMask = smoothstep(0.05, 0.95, ny);
  float vWave = sin(ny * 5.65 + t * m09) * 0.21;
  vWave += sin(ny * 10.4 + t * m112 + nx * 2.55) * 0.15;
  vWave += sin(ny * 15.2 + nx * 4.1 + t * m078) * 0.11;
  vWave *= env * vMask;
  float dy = amp * env * (w1 * 0.36 + w2 * 0.26 + w3 + w4 + w5) + amp * vWave;
  float dx = amp * 0.068 * env * sin(ny * 8.2 + t * m105);
  dx += amp * 0.038 * env * sin(nx * k * 1.42 + t * m093);
  dx += amp * env * vMask * (0.1 * cos(ny * 6.35 + t * m102) + 0.07 * sin(ny * 4.15 + nx * 1.9 + t * m088));
  return vec2(dx, dy);
}
`;

const VS = `
precision highp float;
attribute vec2 a_uv;
uniform vec4 u_flag;
uniform vec2 u_canvas;
uniform float u_amp;
uniform float u_freq;
uniform float u_time;
uniform float u_ripple;
uniform float u_gifSync;
varying vec2 v_texst;
varying vec2 v_uv;

${DISP_GLSL}

void main() {
  float nx = a_uv.x;
  float ny = a_uv.y;
  float t = u_time;
  vec2 d = dispVec(nx, ny, t, u_amp, u_freq, u_ripple);
  float px = u_flag.x + nx * u_flag.z + d.x;
  float py = u_flag.y + ny * u_flag.w + d.y;
  float ndcX = (px / u_canvas.x) * 2.0 - 1.0;
  float ndcY = 1.0 - (py / u_canvas.y) * 2.0;
  gl_Position = vec4(ndcX, ndcY, 0.0, 1.0);
  v_uv = vec2(nx, ny);
  float restPx = u_flag.x + nx * u_flag.z;
  float restPy = u_flag.y + ny * u_flag.w;
  v_texst = vec2(restPx / u_canvas.x, restPy / u_canvas.y);
}
`;

const FS = `
precision highp float;
varying vec2 v_texst;
varying vec2 v_uv;
uniform vec4 u_flag;
uniform vec2 u_canvas;
uniform float u_amp;
uniform float u_freq;
uniform float u_time;
uniform float u_ripple;
uniform float u_gifSync;
uniform sampler2D u_tex;
uniform vec3 u_light;
uniform float u_amb;
uniform float u_diffk;
uniform float u_speck;
uniform float u_specPow;
uniform float u_zfac;

${DISP_GLSL}

void main() {
  vec4 base = texture2D(u_tex, v_texst);
  if (base.a < 0.015) discard;

  float e = 0.0026;
  vec2 d0 = dispVec(v_uv.x, v_uv.y, u_time, u_amp, u_freq, u_ripple);
  vec2 dxp = dispVec(v_uv.x + e, v_uv.y, u_time, u_amp, u_freq, u_ripple);
  vec2 dyp = dispVec(v_uv.x, v_uv.y + e, u_time, u_amp, u_freq, u_ripple);
  float ddx = (dxp.x - d0.x) / e;
  float dydnx = (dxp.y - d0.y) / e;
  float ddxny = (dyp.x - d0.x) / e;
  float dydny = (dyp.y - d0.y) / e;
  vec3 Tu = vec3(u_flag.z + ddx, dydnx, dydnx * u_zfac);
  vec3 Tv = vec3(ddxny, u_flag.w + dydny, dydny * u_zfac);
  vec3 N = normalize(cross(Tu, Tv));
  if (N.z < 0.0) {
    N = -N;
  }
  vec3 L = normalize(u_light);
  vec3 V = vec3(0.0, 0.0, 1.0);
  float wrap = 0.44;
  float diff = max((dot(N, L) + wrap) / (1.0 + wrap), 0.0);
  vec3 Hv = normalize(L + V);
  float sp = pow(max(dot(N, Hv), 0.0), u_specPow);
  float ndotv = max(dot(N, V), 0.0);
  float fres = pow(1.0 - ndotv, 2.35);
  float tone = u_amb + u_diffk * diff;
  tone = clamp(tone, 0.62, 1.32);
  vec3 sunCol = vec3(1.0, 0.98, 0.93);
  vec3 col = base.rgb * tone;
  col += sunCol * (u_speck * sp * 1.25);
  col += sunCol * (fres * 0.2);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), base.a);
}
`;

const FS_FLAT = `
precision highp float;
varying vec2 v_texst;
uniform sampler2D u_tex;
uniform vec3 u_light;
uniform float u_amb;
uniform float u_diffk;

void main() {
  vec4 base = texture2D(u_tex, v_texst);
  if (base.a < 0.015) discard;
  float shade = u_amb + u_diffk * 0.55;
  gl_FragColor = vec4(clamp(base.rgb * shade, 0.0, 1.0), base.a);
}
`;

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function linkProgram(gl, vs, fs) {
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

function loseWebglContext(gl) {
  const lose = gl.getExtension('WEBGL_lose_context');
  if (lose) lose.loseContext();
}

function buildGridMesh(gl, cols, rows) {
  const verts = [];
  const indices = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      verts.push(i / cols, j / rows);
    }
  }
  const stride = cols + 1;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride + 1;
      const d = a + stride;
      indices.push(a, b, c, a, c, d);
    }
  }
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  return { vbo, ibo, indexCount: indices.length };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{ render: Function, dispose: Function, webgl: boolean }}
 */
export function createPhysicsFlagRenderer(canvas) {
  const gl =
    canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true }) ||
    canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });

  if (!gl) {
    return {
      webgl: false,
      render(opts) {
        renderPhysicsFlagCpu(canvas, opts);
      },
      dispose() { }
    };
  }

  const vs = compileShader(gl, gl.VERTEX_SHADER, VS);
  let fs = compileShader(gl, gl.FRAGMENT_SHADER, FS);
  if (!fs) {
    fs = compileShader(gl, gl.FRAGMENT_SHADER, FS_FLAT);
  }
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    loseWebglContext(gl);
    return {
      webgl: false,
      render(opts) {
        renderPhysicsFlagCpu(canvas, opts);
      },
      dispose() { }
    };
  }

  const program = linkProgram(gl, vs, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!program) {
    loseWebglContext(gl);
    return {
      webgl: false,
      render(opts) {
        renderPhysicsFlagCpu(canvas, opts);
      },
      dispose() { }
    };
  }

  const mesh = buildGridMesh(gl, 72, 48);
  const tex = gl.createTexture();
  const loc = {
    a_uv: gl.getAttribLocation(program, 'a_uv'),
    u_flag: gl.getUniformLocation(program, 'u_flag'),
    u_canvas: gl.getUniformLocation(program, 'u_canvas'),
    u_amp: gl.getUniformLocation(program, 'u_amp'),
    u_freq: gl.getUniformLocation(program, 'u_freq'),
    u_time: gl.getUniformLocation(program, 'u_time'),
    u_ripple: gl.getUniformLocation(program, 'u_ripple'),
    u_gifSync: gl.getUniformLocation(program, 'u_gifSync'),
    u_zfac: gl.getUniformLocation(program, 'u_zfac'),
    u_tex: gl.getUniformLocation(program, 'u_tex'),
    u_light: gl.getUniformLocation(program, 'u_light'),
    u_amb: gl.getUniformLocation(program, 'u_amb'),
    u_diffk: gl.getUniformLocation(program, 'u_diffk'),
    u_speck: gl.getUniformLocation(program, 'u_speck'),
    u_specPow: gl.getUniformLocation(program, 'u_specPow')
  };

  function dispose() {
    gl.deleteProgram(program);
    gl.deleteBuffer(mesh.vbo);
    gl.deleteBuffer(mesh.ibo);
    gl.deleteTexture(tex);
  }

  function render(opts) {
    const {
      srcCanvas,
      flagX,
      flagY,
      flagW,
      flagH,
      canvasW,
      canvasH,
      preset,
      time,
      waveAmplitude,
      gifSync = false
    } = opts;

    gl.viewport(0, 0, canvasW, canvasH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.enableVertexAttribArray(loc.a_uv);
    gl.vertexAttribPointer(loc.a_uv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);

    gl.uniform4f(loc.u_flag, flagX, flagY, flagW, flagH);
    gl.uniform2f(loc.u_canvas, canvasW, canvasH);
    gl.uniform1f(loc.u_amp, waveAmplitude);
    gl.uniform1f(loc.u_freq, preset.waveFrequency);
    gl.uniform1f(loc.u_time, time);
    gl.uniform1f(loc.u_ripple, preset.secondaryRipple);
    if (loc.u_gifSync != null) {
      gl.uniform1f(loc.u_gifSync, gifSync ? 1.0 : 0.0);
    }
    if (loc.u_zfac != null) {
      gl.uniform1f(loc.u_zfac, 1.08);
    }

    gl.uniform3f(loc.u_light, 0.4, -0.58, 0.71);
    const li = preset.lightIntensity / 100;
    gl.uniform1f(loc.u_amb, 0.5 + li * 0.08);
    gl.uniform1f(loc.u_diffk, 0.22 + li * 0.38);
    if (loc.u_speck) {
      const sp = Math.max(0, preset.specularSharpness) / 100;
      gl.uniform1f(loc.u_speck, 0.22 + sp * 0.85);
      gl.uniform1f(loc.u_specPow, 5.5 + sp * 42);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc.u_tex, 0);

    gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.disableVertexAttribArray(loc.a_uv);
  }

  return { webgl: true, render, dispose };
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function sampleBilinear(data, w, h, sx, sy) {
  if (sx < 0 || sy < 0 || sx >= w - 1 || sy >= h - 1) return [0, 0, 0, 0];
  const x0 = sx | 0;
  const y0 = sy | 0;
  const fx = sx - x0;
  const fy = sy - y0;
  const i00 = (y0 * w + x0) << 2;
  const i10 = i00 + 4;
  const i01 = i00 + (w << 2);
  const i11 = i01 + 4;
  const ix = 1 - fx;
  const iy = 1 - fy;
  const r =
    data[i00] * ix * iy +
    data[i10] * fx * iy +
    data[i01] * ix * fy +
    data[i11] * fx * fy;
  const g =
    data[i00 + 1] * ix * iy +
    data[i10 + 1] * fx * iy +
    data[i01 + 1] * ix * fy +
    data[i11 + 1] * fx * fy;
  const b =
    data[i00 + 2] * ix * iy +
    data[i10 + 2] * fx * iy +
    data[i01 + 2] * ix * fy +
    data[i11 + 2] * fx * fy;
  const a =
    data[i00 + 3] * ix * iy +
    data[i10 + 3] * fx * iy +
    data[i01 + 3] * ix * fy +
    data[i11 + 3] * fx * fy;
  return [r, g, b, a];
}

function waveEnvCpu(nx) {
  const ramp = smoothstep(0, 0.22, nx);
  const flyBoost = Math.pow(Math.max(nx, 0.0001), 0.62);
  return ramp * flyBoost;
}

function dispVecCpu(nx, ny, t, amp, freq, ripple, gifSync) {
  const env = waveEnvCpu(nx);
  const k = freq * Math.PI * 2;
  const sync = !!gifSync;
  const rp = sync ? Math.max(1, Math.round(ripple)) : ripple;
  const m = (a) => (sync ? 1 : a);
  const w1 = Math.sin(nx * k + t);
  const w2 = Math.sin(nx * k * 2.18 + t * rp + ny * 4.85);
  const w3 = Math.sin(ny * 11 + t * m(0.7)) * 0.16 * smoothstep(0.05, 1, nx);
  const w4 = Math.sin(nx * k * 3.38 + ny * 7.5 + t * m(1.14)) * 0.15 * env;
  const w5 = Math.sin(nx * k * 0.9 + ny * 2.35 + t * m(0.86)) * 0.16 * env;
  const vMask = smoothstep(0.05, 0.95, ny);
  let vWave =
    Math.sin(ny * 5.65 + t * m(0.9)) * 0.21 +
    Math.sin(ny * 10.4 + t * m(1.12) + nx * 2.55) * 0.15 +
    Math.sin(ny * 15.2 + nx * 4.1 + t * m(0.78)) * 0.11;
  vWave *= env * vMask;
  const dy = amp * env * (w1 * 0.36 + w2 * 0.26 + w3 + w4 + w5) + amp * vWave;
  let dx = amp * 0.068 * env * Math.sin(ny * 8.2 + t * m(1.05));
  dx += amp * 0.038 * env * Math.sin(nx * k * 1.42 + t * m(0.93));
  dx +=
    amp *
    env *
    vMask *
    (0.1 * Math.cos(ny * 6.35 + t * m(1.02)) + 0.07 * Math.sin(ny * 4.15 + nx * 1.9 + t * m(0.88)));
  return { dx, dy };
}

/**
 * Degraded CPU path: same displacement model as WebGL; approximate inverse map + slope shading.
 */
export function renderPhysicsFlagCpu(outCanvas, opts) {
  const {
    srcCanvas,
    flagX,
    flagY,
    flagW,
    flagH,
    canvasW,
    canvasH,
    preset,
    time,
    waveAmplitude,
    gifSync = false
  } = opts;

  const wCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  wCtx.clearRect(0, 0, canvasW, canvasH);

  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  const srcFull = srcCtx.getImageData(0, 0, canvasW, canvasH);
  const sdat = srcFull.data;

  const out = wCtx.createImageData(canvasW, canvasH);
  const o = out.data;

  const ripple = preset.secondaryRipple;
  const freq = preset.waveFrequency;
  const margin = Math.ceil(waveAmplitude + 8);
  const x0 = Math.max(0, (flagX | 0) - margin);
  const y0 = Math.max(0, (flagY | 0) - margin);
  const x1 = Math.min(canvasW, Math.ceil(flagX + flagW + margin));
  const y1 = Math.min(canvasH, Math.ceil(flagY + flagH + margin));
  const invW = 1 / flagW;
  const invH = 1 / flagH;
  const li = preset.lightIntensity / 100;
  const e = 0.003;

  for (let y = y0; y < y1; y++) {
    const row = (y * canvasW) << 2;
    for (let x = x0; x < x1; x++) {
      const nx = (x - flagX) * invW;
      const ny = (y - flagY) * invH;
      const destIdx = row + (x << 2);

      if (nx < -0.02 || nx > 1.02 || ny < -0.02 || ny > 1.02) {
        o[destIdx + 3] = 0;
        continue;
      }

      const d0 = dispVecCpu(nx, ny, time, waveAmplitude, freq, ripple, gifSync);
      const sx = x - d0.dx;
      const sy = y - d0.dy;
      const [r, g, b, a] = sampleBilinear(sdat, canvasW, canvasH, sx, sy);
      if (a < 8) {
        o[destIdx + 3] = 0;
        continue;
      }

      const dpx = dispVecCpu(Math.min(1, nx + e), ny, time, waveAmplitude, freq, ripple, gifSync);
      const dpy = dispVecCpu(nx, Math.min(1, ny + e), time, waveAmplitude, freq, ripple, gifSync);
      const ddx = (dpx.dx - d0.dx) / e;
      const dydnx = (dpx.dy - d0.dy) / e;
      const ddxny = (dpy.dx - d0.dx) / e;
      const dydny = (dpy.dy - d0.dy) / e;
      const zf = 1.08;
      const tux = flagW + ddx;
      const tuy = dydnx;
      const tuz = dydnx * zf;
      const tvx = ddxny;
      const tvy = flagH + dydny;
      const tvz = dydny * zf;
      let nnx = tuy * tvz - tuz * tvy;
      let nny = tuz * tvx - tux * tvz;
      let nnz = tux * tvy - tuy * tvx;
      if (nnz < 0) {
        nnx = -nnx;
        nny = -nny;
        nnz = -nnz;
      }
      const nlen = Math.hypot(nnx, nny, nnz) || 1;
      const lmag = Math.hypot(0.4, 0.58, 0.71);
      const lx = 0.4 / lmag;
      const ly = -0.58 / lmag;
      const lz = 0.71 / lmag;
      const wrap = 0.44;
      const rawD = (nnx * lx + nny * ly + nnz * lz) / nlen;
      const diff = Math.max((rawD + wrap) / (1 + wrap), 0);
      const u_amb = 0.5 + li * 0.08;
      const u_diffk = 0.22 + li * 0.38;
      let tone = u_amb + u_diffk * diff;
      tone = Math.min(1.32, Math.max(0.62, tone));
      const hx = lx;
      const hy = ly;
      const hz = lz + 1;
      const hm = Math.hypot(hx, hy, hz) || 1;
      const ndh = (nnx * hx + nny * hy + nnz * hz) / (nlen * hm);
      const u_speck = 0.22 + (Math.max(0, preset.specularSharpness) / 100) * 0.85;
      const ndotv = Math.max(nnz / nlen, 0);
      const specExp = 5.5 + (Math.max(0, preset.specularSharpness) / 100) * 42;
      const sp = Math.pow(Math.max(0, ndh), specExp);
      const fres = Math.pow(1 - ndotv, 2.35);
      const rf = (r / 255) * tone + u_speck * sp * 1.25 + fres * 0.2;
      const gf = (g / 255) * tone + u_speck * sp * 1.22 + fres * 0.19;
      const bf = (b / 255) * tone + u_speck * sp * 1.18 + fres * 0.18;
      o[destIdx] = Math.min(255, rf * 255);
      o[destIdx + 1] = Math.min(255, gf * 255);
      o[destIdx + 2] = Math.min(255, bf * 255);
      o[destIdx + 3] = a;
    }
  }

  wCtx.putImageData(out, 0, 0);
}
