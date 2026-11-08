import { MAT_GEM } from './materials';

// The trace shader reads instances from a uniform buffer with a fixed slot
// count, because the shader is already at the WebGPU limit for storage
// buffers. Keep this value in sync with MAX_INSTANCES in bvh.wgsl.
export const MAX_INSTANCES = 8;

export interface Aabb {
  min: [number, number, number];
  max: [number, number, number];
}

export interface GemInstance {
  position: [number, number, number];
  scale: number;
  material: number;
}

// A row of small gems behind the cube. They all share one BLAS, so the only
// per instance data is a transform and a material index.
export function makeGemInstances(): GemInstance[] {
  const xs = [-2.6, -1.3, 0, 1.3, 2.6];
  return xs.map((x) => ({
    position: [x, -1.287, -2],
    scale: 0.25,
    material: MAT_GEM,
  }));
}

export function instanceWorldBounds(instance: GemInstance, local: Aabb): Aabb {
  const s = instance.scale;
  const [px, py, pz] = instance.position;
  return {
    min: [local.min[0] * s + px, local.min[1] * s + py, local.min[2] * s + pz],
    max: [local.max[0] * s + px, local.max[1] * s + py, local.max[2] * s + pz],
  };
}

// Header: gemRoot, tlasRoot, instanceCount, pad. Followed by fixed slots of
// inverse world to local matrix, material, and three pads. Each slot is 80
// bytes, a multiple of 16 so it is valid in the uniform address space.
export function sceneInfoUniformData(
  gemRoot: number,
  tlasRoot: number,
  instances: GemInstance[],
): ArrayBuffer {
  const buffer = new ArrayBuffer(16 + MAX_INSTANCES * 80);
  const floats = new Float32Array(buffer);
  const uints = new Uint32Array(buffer);

  uints[0] = gemRoot;
  uints[1] = tlasRoot;
  uints[2] = instances.length;
  uints[3] = 0;

  for (let i = 0; i < instances.length; i++) {
    const instance = instances[i]!;
    const base = 4 + i * 20; // 20 u32/floats per slot
    const inv = 1 / instance.scale;
    const [px, py, pz] = instance.position;

    floats[base + 0] = inv;
    floats[base + 1] = 0;
    floats[base + 2] = 0;
    floats[base + 3] = 0;
    floats[base + 4] = 0;
    floats[base + 5] = inv;
    floats[base + 6] = 0;
    floats[base + 7] = 0;
    floats[base + 8] = 0;
    floats[base + 9] = 0;
    floats[base + 10] = inv;
    floats[base + 11] = 0;
    floats[base + 12] = -px * inv;
    floats[base + 13] = -py * inv;
    floats[base + 14] = -pz * inv;
    floats[base + 15] = 1;

    uints[base + 16] = instance.material;
    uints[base + 17] = 0;
    uints[base + 18] = 0;
    uints[base + 19] = 0;
  }

  return buffer;
}
