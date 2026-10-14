export interface TriangleData {
  v0: [number, number, number];
  v1: [number, number, number];
  v2: [number, number, number];
}

export function makeTriangles(): TriangleData[] {
  return [
    // Square (two triangles) in z = 0
    { v0: [-1, -1, 0], v1: [1, -1, 0], v2: [-1, 1, 0] },
    { v0: [1, -1, 0], v1: [1, 1, 0], v2: [-1, 1, 0] },
    // Small triangle behind, shifted right
    { v0: [0.2, 0.2, -0.6], v1: [0.9, 0.2, -0.6], v2: [0.55, 0.85, -0.6] },
  ];
}

export function trianglesStorageData(tris: TriangleData[]): Float32Array {
  const floats = tris.length * 12;
  const data = new Float32Array(floats);
  let o = 0;
  for (const t of tris) {
    data[o + 0] = t.v0[0];
    data[o + 1] = t.v0[1];
    data[o + 2] = t.v0[2];
    data[o + 3] = 0;
    data[o + 4] = t.v1[0];
    data[o + 5] = t.v1[1];
    data[o + 6] = t.v1[2];
    data[o + 7] = 0;
    data[o + 8] = t.v2[0];
    data[o + 9] = t.v2[1];
    data[o + 10] = t.v2[2];
    data[o + 11] = 0;
    o += 12;
  }
  return data;
}
