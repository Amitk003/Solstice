// Light definitions shared between the scene geometry and the shader.
// The CPU packs them into a storage buffer the trace kernel reads.

export interface SphereLight {
  position: [number, number, number];
  radius: number;
  color: [number, number, number];
}

// The warm key lamp above the scene. Its geometry is generated from these
// values so the mesh and the light never drift apart.
export const LAMP_LIGHT: SphereLight = {
  position: [0.4, 2.3, 1.6],
  radius: 0.22,
  color: [4.0, 3.7, 3.2],
};

// A cooler fill lamp on the other side. Two lights make the shading read
// as room light instead of a single source.
export const FILL_LIGHT: SphereLight = {
  position: [-2.2, 1.2, -1.0],
  radius: 0.18,
  color: [1.4, 1.8, 3.0],
};

export function defaultLights(): SphereLight[] {
  return [LAMP_LIGHT, FILL_LIGHT];
}

// Layout must match struct Light in bvh.wgsl: position vec3f + radius f32,
// then color vec3f + pad f32. That is 8 floats, 32 bytes, per light.
export function lightsStorageData(lights: SphereLight[]): Float32Array {
  const data = new Float32Array(lights.length * 8);
  let o = 0;
  for (const light of lights) {
    data[o + 0] = light.position[0];
    data[o + 1] = light.position[1];
    data[o + 2] = light.position[2];
    data[o + 3] = light.radius;
    data[o + 4] = light.color[0];
    data[o + 5] = light.color[1];
    data[o + 6] = light.color[2];
    data[o + 7] = 0;
    o += 8;
  }
  return data;
}
