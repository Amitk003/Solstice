// Procedural HDR environment map for the sky.
//
// The scene has no image files, so the background is generated on the CPU
// as an equirectangular float image: a sky gradient, a ground, the sun
// disk at the same direction as the direct sun light, and two bright
// window discs. Values above 1.0 are kept so reflections pick up real
// highlights. The map is uploaded once to a rgba16float texture and
// sampled for every ray miss.

export const ENV_MAP_WIDTH = 1024;
export const ENV_MAP_HEIGHT = 512;

export const DEFAULT_SUN_DIRECTION: [number, number, number] = [0.4, 0.8, -0.4];

const WINDOWS: Array<{ direction: [number, number, number]; brightness: number }> = [
  { direction: [0.9, 0.35, 0.2], brightness: 7.0 },
  { direction: [-0.25, 0.45, -0.85], brightness: 5.0 },
];

function normalizeDirection(direction: [number, number, number]): [number, number, number] {
  const length = Math.hypot(direction[0], direction[1], direction[2]) || 1;
  return [direction[0] / length, direction[1] / length, direction[2] / length];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// A single equirectangular texel. dir is the unit direction for the
// texel. sun is the direction the bright disk is drawn at.
function envColor(
  dir: [number, number, number],
  sun: [number, number, number],
  out: [number, number, number],
): void {
  const horizon: [number, number, number] = [0.55, 0.7, 0.95];
  const zenith: [number, number, number] = [0.12, 0.22, 0.5];
  const ground: [number, number, number] = [0.16, 0.14, 0.12];
  const up = Math.min(1, Math.max(0, dir[1] ?? 0));
  for (let i = 0; i < 3; i++) {
    out[i] = (horizon[i] ?? 0) * (1 - up) + (zenith[i] ?? 0) * up;
  }
  const blend = smoothstep(-0.05, 0.05, dir[1] ?? 0);
  for (let i = 0; i < 3; i++) {
    out[i] = (ground[i] ?? 0) * (1 - blend) + (out[i] ?? 0) * blend;
  }

  const sun = normalizeDirection(sun);
  const sunDot = dir[0] * sun[0] + dir[1] * sun[1] + dir[2] * sun[2];
  // Soft glow around the sun plus a small bright disk.
  const glow = Math.pow(Math.max(0, sunDot), 8) * 0.6;
  const glowColor: [number, number, number] = [2.0, 1.6, 1.1];
  const disk = smoothstep(0.9992, 0.9997, sunDot) * 18.0;
  const diskColor: [number, number, number] = [1.0, 0.95, 0.85];
  for (let i = 0; i < 3; i++) {
    out[i] = (out[i] ?? 0) + (glowColor[i] ?? 0) * glow + (diskColor[i] ?? 0) * disk;
  }

  // Bright window discs. They are soft boxes: smooth edges, no hard rim.
  for (const window of WINDOWS) {
    const w = normalizeDirection(window.direction);
    const dot = (dir[0] ?? 0) * (w[0] ?? 0) + (dir[1] ?? 0) * (w[1] ?? 0) + (dir[2] ?? 0) * (w[2] ?? 0);
    const disc = smoothstep(0.996, 0.999, dot) * window.brightness;
    const tint: [number, number, number] = [1.0, 0.97, 0.9];
    for (let i = 0; i < 3; i++) {
      out[i] = (out[i] ?? 0) + (tint[i] ?? 0) * disc;
    }
  }
}

export function makeEnvMapData(sun: [number, number, number] = DEFAULT_SUN_DIRECTION): Float32Array {
  const data = new Float32Array(ENV_MAP_WIDTH * ENV_MAP_HEIGHT * 4);
  const color: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < ENV_MAP_HEIGHT; y++) {
    // Equirectangular row: v 0 at the zenith, 1 at the nadir. This matches
    // the shader, which maps a direction back with v = 0.5 - asin(y) / PI.
    const v = (y + 0.5) / ENV_MAP_HEIGHT;
    const theta = (0.5 - v) * Math.PI;
    for (let x = 0; x < ENV_MAP_WIDTH; x++) {
      const u = (x + 0.5) / ENV_MAP_WIDTH;
      const phi = (u - 0.5) * Math.PI * 2;
      const dir: [number, number, number] = [
        Math.cos(theta) * Math.cos(phi),
        Math.sin(theta),
        Math.cos(theta) * Math.sin(phi),
      ];
      envColor(dir, sun, color);
      const o = (y * ENV_MAP_WIDTH + x) * 4;
      data[o] = color[0] ?? 0;
      data[o + 1] = color[1] ?? 0;
      data[o + 2] = color[2] ?? 0;
      data[o + 3] = 1;
    }
  }
  return data;
}

// Encode one 32 bit float as 16 bit half float bits. The environment only
// holds finite non negative values, so subnormals and NaN are flushed to
// zero or infinity. Keeps the upload path free of a float32 texture.
export function floatToHalfBits(value: number): number {
  const buffer = new ArrayBuffer(4);
  const floats = new Float32Array(buffer);
  const words = new Uint32Array(buffer);
  floats[0] = value;
  const x = words[0] ?? 0;
  let bits = (x >> 16) & 0x8000;
  const exponent = (x >> 23) & 0xff;
  // Half normals start at 2^-14 (exponent 113). Values below that flush
  // to zero, which is fine for the environment palette.
  if (exponent < 113) {
    return bits;
  }
  if (exponent > 142) {
    bits |= 0x7c00;
    if (exponent === 255 && (x & 0x007fffff) !== 0) {
      bits |= 0x0200;
    }
    return bits;
  }
  bits |= ((exponent - 112) << 10) | ((x >> 13) & 0x03ff);
  return bits & 0xffff;
}

export function toHalfFloatData(floats: Float32Array): Uint16Array {
  const half = new Uint16Array(floats.length);
  for (let i = 0; i < floats.length; i++) {
    half[i] = floatToHalfBits(floats[i] ?? 0);
  }
  return half;
}
