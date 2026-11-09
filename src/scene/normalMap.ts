// Procedural tangent space normal map for surface detail.
//
// The map is generated on the CPU as a small RGB texture. A height
// function is sampled on a grid, and the gradient becomes a normal
// around the flat surface normal. The trace shader builds a tangent
// frame from the surface normal and samples this map by world space
// planar coordinates, so no UVs or texture files are needed.

export const NORMAL_MAP_WIDTH = 256;
export const NORMAL_MAP_HEIGHT = 256;

function heightAt(x: number, y: number): number {
  const u = (x / NORMAL_MAP_WIDTH) * Math.PI * 2;
  const v = (y / NORMAL_MAP_HEIGHT) * Math.PI * 2;
  return (
    Math.sin(u * 3 + Math.sin(v * 2)) * 0.45 +
    Math.sin(v * 5 + Math.sin(u * 3)) * 0.3 +
    Math.sin((u + v) * 8) * 0.15 +
    Math.sin((u - v) * 13) * 0.1
  );
}

export function normalMapData(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(NORMAL_MAP_WIDTH * NORMAL_MAP_HEIGHT * 4);
  const strength = 0.65;
  for (let y = 0; y < NORMAL_MAP_HEIGHT; y++) {
    for (let x = 0; x < NORMAL_MAP_WIDTH; x++) {
      const hx = heightAt(x + 1, y) - heightAt(x - 1, y);
      const hy = heightAt(x, y + 1) - heightAt(x, y - 1);
      let nx = -hx * strength;
      let ny = -hy * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const o = (y * NORMAL_MAP_WIDTH + x) * 4;
      data[o] = Math.round((nx * 0.5 + 0.5) * 255);
      data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[o + 3] = 255;
    }
  }
  return data;
}
