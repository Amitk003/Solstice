export interface TriangleData {
  v0: [number, number, number];
  v1: [number, number, number];
  v2: [number, number, number];
}

export const CUBE_TRI_COUNT = 12;
export const FLOOR_TRI_COUNT = 2;

export function makeTriangles(): TriangleData[] {
  return [...makeCubeTriangles(), ...makeFloorTriangles(), ...makeSphereTriangles()];
}

export function makeFloorTriangles(): TriangleData[] {
  const y = -1.5;
  const s = 8;
  return [
    { v0: [-s, y, -s], v1: [-s, y, s], v2: [s, y, -s] },
    { v0: [s, y, -s], v1: [-s, y, s], v2: [s, y, s] },
  ];
}

const CUBE_VERTICES: [number, number, number][] = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, 1],
  [-1, 1, 1],
];

// Each face is two triangles given by vertex indices.
const CUBE_FACES: [number, number, number, number][] = [
  [0, 1, 2, 3], // front
  [5, 4, 7, 6], // back
  [4, 0, 3, 7], // left
  [1, 5, 6, 2], // right
  [4, 5, 1, 0], // bottom
  [3, 2, 6, 7], // top
];

export function makeCubeTriangles(): TriangleData[] {
  const tris: TriangleData[] = [];
  for (const face of CUBE_FACES) {
    const [a, b, c, d] = face;
    const quadTris: TriangleData[] = [
      { v0: CUBE_VERTICES[a]!, v1: CUBE_VERTICES[b]!, v2: CUBE_VERTICES[c]! },
      { v0: CUBE_VERTICES[a]!, v1: CUBE_VERTICES[c]!, v2: CUBE_VERTICES[d]! },
    ];
    for (const t of quadTris) {
      tris.push(ensureOutward(t));
    }
  }
  return tris;
}

export function makeSphereTriangles(
  center: [number, number, number] = [2.1, -0.7, 0.4],
  radius = 0.8,
  latSegs = 20,
  lonSegs = 14,
): TriangleData[] {
  const point = (lat: number, lon: number): [number, number, number] => {
    const theta = (lat / latSegs) * Math.PI;
    const phi = (lon / lonSegs) * Math.PI * 2;
    const x = radius * Math.sin(theta) * Math.cos(phi) + center[0];
    const y = radius * Math.cos(theta) + center[1];
    const z = radius * Math.sin(theta) * Math.sin(phi) + center[2];
    return [x, y, z];
  };
  const tris: TriangleData[] = [];
  for (let lat = 0; lat < latSegs; lat++) {
    for (let lon = 0; lon < lonSegs; lon++) {
      const a = point(lat, lon);
      const b = point(lat + 1, lon);
      const c = point(lat, lon + 1);
      const d = point(lat + 1, lon + 1);
      tris.push(ensureOutward({ v0: a, v1: b, v2: d }, center));
      tris.push(ensureOutward({ v0: a, v1: d, v2: c }, center));
    }
  }
  return tris;
}

function ensureOutward(t: TriangleData, center: [number, number, number] = [0, 0, 0]): TriangleData {
  const [ax, ay, az] = t.v0;
  const [bx, by, bz] = t.v1;
  const [cx, cy, cz] = t.v2;
  const e1x = bx - ax;
  const e1y = by - ay;
  const e1z = bz - az;
  const e2x = cx - ax;
  const e2y = cy - ay;
  const e2z = cz - az;
  const nx = e1y * e2z - e1z * e2y;
  const ny = e1z * e2x - e1x * e2z;
  const nz = e1x * e2y - e1y * e2x;
  const cxv = (ax + bx + cx) / 3 - center[0];
  const cyv = (ay + by + cy) / 3 - center[1];
  const czv = (az + bz + cz) / 3 - center[2];
  const dotNc = nx * cxv + ny * cyv + nz * czv;
  if (dotNc < 0) {
    // Swap v1 and v2 to flip the normal.
    return { v0: t.v0, v1: t.v2, v2: t.v1 };
  }
  return t;
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

