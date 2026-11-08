// Light definitions shared between the scene geometry and the shader.
// The CPU packs them into a storage buffer the trace kernel reads.
//
// A light is either a sphere (kind 0) or a horizontal rectangle
// (kind 1). Rectangles are centered at the position and face down.

export interface AreaLight {
  kind: 'sphere' | 'rect';
  position: [number, number, number];
  radius: number;
  color: [number, number, number];
  halfWidth: number;
  halfDepth: number;
}

// The warm key lamp above the scene. It is a horizontal rectangle that
// faces down. Its geometry is generated from these values so the mesh
// and the light never drift apart. The color is lower than the old
// sphere lamp because the panel is larger.
export const LAMP_LIGHT: AreaLight = {
  kind: 'rect',
  position: [0.4, 2.3, 1.6],
  radius: 0,
  color: [1.35, 1.25, 1.1],
  halfWidth: 0.9,
  halfDepth: 0.55,
};

// A cooler fill lamp on the other side. Two lights make the shading read
// as room light instead of a single source.
export const FILL_LIGHT: AreaLight = {
  kind: 'sphere',
  position: [-2.2, 1.2, -1.0],
  radius: 0.18,
  color: [1.4, 1.8, 3.0],
  halfWidth: 0,
  halfDepth: 0,
};

export function defaultLights(): AreaLight[] {
  return [LAMP_LIGHT, FILL_LIGHT];
}

// Layout must match struct Light in bvh.wgsl: position vec3f + radius f32,
// then color vec3f + kind f32, then halfWidth f32 + halfDepth f32, then two
// pads. That is 12 floats, 48 bytes, per light.
export function lightsStorageData(lights: AreaLight[]): Float32Array {
  const data = new Float32Array(lights.length * 12);
  let o = 0;
  for (const light of lights) {
    data[o + 0] = light.position[0];
    data[o + 1] = light.position[1];
    data[o + 2] = light.position[2];
    data[o + 3] = light.radius;
    data[o + 4] = light.color[0];
    data[o + 5] = light.color[1];
    data[o + 6] = light.color[2];
    data[o + 7] = light.kind === 'rect' ? 1 : 0;
    data[o + 8] = light.halfWidth;
    data[o + 9] = light.halfDepth;
    data[o + 10] = 0;
    data[o + 11] = 0;
    o += 12;
  }
  return data;
}
