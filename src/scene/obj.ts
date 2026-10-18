// Minimal Wavefront OBJ loader. It reads vertices (v), optional normals
// (vn), and faces (f). Faces with more than three corners are fan
// triangulated. Faces are assumed to be wound counter clockwise as seen
// from outside, which is the usual OBJ convention.

import { faceNormal, type Vec3 } from './geometry';
import type { TriangleData } from './triangles';

interface Corner {
  p: number;
  n: number;
}

interface ParsedObj {
  positions: Vec3[];
  normals: Vec3[];
  faces: Corner[][];
}

export interface MeshPlacement {
  scale: number;
  offset: Vec3;
}

function resolveIndex(token: string | undefined, count: number): number {
  const raw = Number(token);
  if (!Number.isFinite(raw) || raw === 0) {
    return -1;
  }
  // Negative indices count back from the end, as the OBJ format allows.
  return raw > 0 ? raw - 1 : count + raw;
}

function parseCorner(token: string, positionCount: number, normalCount: number): Corner {
  const bits = token.split('/');
  const p = resolveIndex(bits[0], positionCount);
  const n = bits.length >= 3 ? resolveIndex(bits[2], normalCount) : -1;
  return { p, n };
}

export function parseObj(text: string): ParsedObj {
  const positions: Vec3[] = [];
  const normals: Vec3[] = [];
  const faces: Corner[][] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }
    const parts = line.split(/\s+/);
    const tag = parts[0];
    if (tag === 'v') {
      positions.push([Number(parts[1]), Number(parts[2]), Number(parts[3])]);
    } else if (tag === 'vn') {
      normals.push([Number(parts[1]), Number(parts[2]), Number(parts[3])]);
    } else if (tag === 'f') {
      const corners: Corner[] = [];
      for (let i = 1; i < parts.length; i++) {
        corners.push(parseCorner(parts[i]!, positions.length, normals.length));
      }
      if (corners.length >= 3) {
        faces.push(corners);
      }
    }
  }

  return { positions, normals, faces };
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

// Turn an OBJ string into triangles for the renderer. Uses normals from the
// file when present. Otherwise it makes flat face normals, or smooth
// averaged normals when smooth is true.
export function objToTriangles(
  text: string,
  material: number,
  placement: MeshPlacement,
  smooth = false,
): TriangleData[] {
  const obj = parseObj(text);
  const { scale, offset } = placement;
  const place = (p: Vec3): Vec3 => [
    p[0] * scale + offset[0],
    p[1] * scale + offset[1],
    p[2] * scale + offset[2],
  ];

  const useFileNormals = obj.faces.every((face) =>
    face.every((c) => obj.normals[c.n] !== undefined),
  );

  let smoothNormals: Vec3[] | null = null;
  if (!useFileNormals && smooth) {
    const acc: number[][] = obj.positions.map(() => [0, 0, 0]);
    const add = (index: number, f: Vec3): void => {
      const a = acc[index]!;
      a[0] = (a[0] ?? 0) + f[0];
      a[1] = (a[1] ?? 0) + f[1];
      a[2] = (a[2] ?? 0) + f[2];
    };
    for (const face of obj.faces) {
      for (let i = 1; i + 1 < face.length; i++) {
        const c0 = face[0]!;
        const c1 = face[i]!;
        const c2 = face[i + 1]!;
        const f = faceNormal(
          place(obj.positions[c0.p]!),
          place(obj.positions[c1.p]!),
          place(obj.positions[c2.p]!),
        );
        add(c0.p, f);
        add(c1.p, f);
        add(c2.p, f);
      }
    }
    smoothNormals = acc.map((a) => normalize([a[0] ?? 0, a[1] ?? 0, a[2] ?? 0]));
  }

  const tris: TriangleData[] = [];
  for (const face of obj.faces) {
    for (let i = 1; i + 1 < face.length; i++) {
      const c0 = face[0]!;
      const c1 = face[i]!;
      const c2 = face[i + 1]!;
      const v0 = place(obj.positions[c0.p]!);
      const v1 = place(obj.positions[c1.p]!);
      const v2 = place(obj.positions[c2.p]!);

      let n0: Vec3;
      let n1: Vec3;
      let n2: Vec3;
      if (useFileNormals) {
        n0 = obj.normals[c0.n]!;
        n1 = obj.normals[c1.n]!;
        n2 = obj.normals[c2.n]!;
      } else if (smoothNormals) {
        n0 = smoothNormals[c0.p]!;
        n1 = smoothNormals[c1.p]!;
        n2 = smoothNormals[c2.p]!;
      } else {
        const f = faceNormal(v0, v1, v2);
        n0 = f;
        n1 = f;
        n2 = f;
      }

      tris.push({ v0, v1, v2, n0, n1, n2, m: material });
    }
  }
  return tris;
}
