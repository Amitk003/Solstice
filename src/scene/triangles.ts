export enum TriMaterial {
  Diffuse = 0,
  Mirror = 1,
  Glass = 2,
  Emissive = 3,
}

export interface TriangleData {
  v0: [number, number, number];
  v1: [number, number, number];
  v2: [number, number, number];
  n0: [number, number, number];
  n1: [number, number, number];
  n2: [number, number, number];
  m: number;
}

function faceNormal(
  v0: [number, number, number],
  v1: [number, number, number],
  v2: [number, number, number],
): [number, number, number] {
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

function withFaceNormals(
  v0: [number, number, number],
  v1: [number, number, number],
  v2: [number, number, number],
  m: number = TriMaterial.Diffuse,
): TriangleData {
  const n = faceNormal(v0, v1, v2);
  return { v0, v1, v2, n0: n, n1: n, n2: n, m };
}

export const CUBE_TRI_COUNT = 12;
export const FLOOR_TRI_COUNT = 2;

export function makeTriangles(): TriangleData[] {
  return [
    ...makeCubeTriangles(),
    ...makeFloorTriangles(),
    ...makeSphereTriangles(),
    ...makeSphereTriangles([0.4, 2.3, 1.6], 0.22, 10, 8, TriMaterial.Emissive),
  ];
}

export function makeFloorTriangles(): TriangleData[] {
  const y = -1.5;
  const s = 8;
  return [
    withFaceNormals([-s, y, -s], [-s, y, s], [s, y, -s]),
    withFaceNormals([s, y, -s], [-s, y, s], [s, y, s]),
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
      withFaceNormals(CUBE_VERTICES[a]!, CUBE_VERTICES[b]!, CUBE_VERTICES[c]!, TriMaterial.Mirror),
      withFaceNormals(CUBE_VERTICES[a]!, CUBE_VERTICES[c]!, CUBE_VERTICES[d]!, TriMaterial.Mirror),
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
  material: number = TriMaterial.Glass,
): TriangleData[] {
  const point = (lat: number, lon: number): [number, number, number] => {
    const theta = (lat / latSegs) * Math.PI;
    const phi = (lon / lonSegs) * Math.PI * 2;
    const x = radius * Math.sin(theta) * Math.cos(phi) + center[0];
    const y = radius * Math.cos(theta) + center[1];
    const z = radius * Math.sin(theta) * Math.sin(phi) + center[2];
    return [x, y, z];
  };
  const smooth = (p: [number, number, number]): [number, number, number] => {
    const nx = (p[0] - center[0]) / radius;
    const ny = (p[1] - center[1]) / radius;
    const nz = (p[2] - center[2]) / radius;
    return [nx, ny, nz];
  };
  const tris: TriangleData[] = [];
  for (let lat = 0; lat < latSegs; lat++) {
    for (let lon = 0; lon < lonSegs; lon++) {
      const a = point(lat, lon);
      const b = point(lat + 1, lon);
      const c = point(lat, lon + 1);
      const d = point(lat + 1, lon + 1);
      const t0: TriangleData = {
        v0: a,
        v1: b,
        v2: d,
        n0: smooth(a),
        n1: smooth(b),
        n2: smooth(d),
        m: material,
      };
      const t1: TriangleData = {
        v0: a,
        v1: d,
        v2: c,
        n0: smooth(a),
        n1: smooth(d),
        n2: smooth(c),
        m: material,
      };
      tris.push(ensureOutward(t0, center));
      tris.push(ensureOutward(t1, center));
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
    // Swap v1 and v2 to flip the winding. Normals follow the swap.
    return { v0: t.v0, v1: t.v2, v2: t.v1, n0: t.n0, n1: t.n2, n2: t.n1, m: t.m };
  }
  return t;
}

export function trianglesStorageData(tris: TriangleData[]): Float32Array {
  const floats = tris.length * 24;
  const data = new Float32Array(floats);
  const uints = new Uint32Array(data.buffer);
  let o = 0;
  for (const t of tris) {
    data[o + 0] = t.v0[0];
    data[o + 1] = t.v0[1];
    data[o + 2] = t.v0[2];
    data[o + 3] = 0;
    data[o + 4] = t.n0[0];
    data[o + 5] = t.n0[1];
    data[o + 6] = t.n0[2];
    data[o + 7] = 0;
    data[o + 8] = t.v1[0];
    data[o + 9] = t.v1[1];
    data[o + 10] = t.v1[2];
    data[o + 11] = 0;
    data[o + 12] = t.n1[0];
    data[o + 13] = t.n1[1];
    data[o + 14] = t.n1[2];
    data[o + 15] = 0;
    data[o + 16] = t.v2[0];
    data[o + 17] = t.v2[1];
    data[o + 18] = t.v2[2];
    data[o + 19] = 0;
    data[o + 20] = t.n2[0];
    data[o + 21] = t.n2[1];
    data[o + 22] = t.n2[2];
    data[o + 23] = 0;
    uints[o + 23] = t.m;
    o += 24;
  }
  return data;
}

