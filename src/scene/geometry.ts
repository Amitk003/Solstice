// Small geometry helpers shared by the procedural scene and the mesh loader.

export type Vec3 = [number, number, number];

// Right handed normal of a triangle, normalized. Falls back to +Z if the
// triangle is degenerate.
export function faceNormal(v0: Vec3, v1: Vec3, v2: Vec3): Vec3 {
  const e1x = v1[0] - v0[0];
  const e1y = v1[1] - v0[1];
  const e1z = v1[2] - v0[2];
  const e2x = v2[0] - v0[0];
  const e2y = v2[1] - v0[1];
  const e2z = v2[2] - v0[2];
  const nx = e1y * e2z - e1z * e2y;
  const ny = e1z * e2x - e1x * e2z;
  const nz = e1x * e2y - e1y * e2x;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return [nx / len, ny / len, nz / len];
}
