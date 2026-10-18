// The material table. Triangles store an index into this list, and the
// shader reads the settings from a storage buffer. Adding a material means
// adding one entry here and pointing triangles at it.

import { LAMP_LIGHT } from './lights';

export enum MaterialKind {
  Diffuse = 0,
  Mirror = 1,
  Glass = 2,
  Emissive = 3,
}

export interface Material {
  kind: MaterialKind;
  baseColor: [number, number, number];
  roughness: number;
  ior: number;
  emission: number;
  absorption: [number, number, number];
}

export const MAT_FLOOR = 0;
export const MAT_MIRROR = 1;
export const MAT_GLASS = 2;
export const MAT_EMISSIVE = 3;

export const MATERIALS: Material[] = [
  {
    kind: MaterialKind.Diffuse,
    baseColor: [0.72, 0.7, 0.66],
    roughness: 0.9,
    ior: 1.0,
    emission: 0.0,
    absorption: [0.0, 0.0, 0.0],
  },
  {
    kind: MaterialKind.Mirror,
    baseColor: [0.95, 0.96, 1.0],
    roughness: 0.12,
    ior: 1.0,
    emission: 0.0,
    absorption: [0.0, 0.0, 0.0],
  },
  {
    kind: MaterialKind.Glass,
    baseColor: [1.0, 1.0, 1.0],
    roughness: 0.05,
    ior: 1.5,
    emission: 0.0,
    absorption: [0.5, 0.18, 0.15],
  },
  {
    kind: MaterialKind.Emissive,
    baseColor: LAMP_LIGHT.color,
    roughness: 1.0,
    ior: 1.0,
    emission: 1.0,
    absorption: [0.0, 0.0, 0.0],
  },
];

// Layout must match struct Material in bvh.wgsl. Twelve floats per material:
// baseColor vec3 + roughness, absorption vec3 + ior, kind u32 + emission +
// two pads. That is 48 bytes, a multiple of 16 for storage buffers.
export function materialsStorageData(materials: Material[]): Float32Array {
  const data = new Float32Array(materials.length * 12);
  const uints = new Uint32Array(data.buffer);
  let o = 0;
  for (const m of materials) {
    data[o + 0] = m.baseColor[0];
    data[o + 1] = m.baseColor[1];
    data[o + 2] = m.baseColor[2];
    data[o + 3] = m.roughness;
    data[o + 4] = m.absorption[0];
    data[o + 5] = m.absorption[1];
    data[o + 6] = m.absorption[2];
    data[o + 7] = m.ior;
    uints[o + 8] = m.kind;
    data[o + 9] = m.emission;
    data[o + 10] = 0;
    data[o + 11] = 0;
    o += 12;
  }
  return data;
}
