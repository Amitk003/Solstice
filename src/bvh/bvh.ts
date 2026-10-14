import type { TriangleData } from '../scene/triangles';

export interface BvhNodeData {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  left: number;
  right: number;
  first: number;
  count: number;
}

interface TriangleBounds {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
}

function triangleBounds(t: TriangleData): TriangleBounds {
  const min = [
    Math.min(t.v0[0], t.v1[0], t.v2[0]),
    Math.min(t.v0[1], t.v1[1], t.v2[1]),
    Math.min(t.v0[2], t.v1[2], t.v2[2]),
  ] as [number, number, number];
  const max = [
    Math.max(t.v0[0], t.v1[0], t.v2[0]),
    Math.max(t.v0[1], t.v1[1], t.v2[1]),
    Math.max(t.v0[2], t.v1[2], t.v2[2]),
  ] as [number, number, number];
  const center = [
    (min[0] + max[0]) * 0.5,
    (min[1] + max[1]) * 0.5,
    (min[2] + max[2]) * 0.5,
  ] as [number, number, number];
  return { min, max, center };
}

export interface BuiltBvh {
  nodes: BvhNodeData[];
  triangleIndices: Uint32Array;
}

export function buildBvh(tris: TriangleData[]): BuiltBvh {
  const bounds = tris.map(triangleBounds);

  function nodeBounds(indices: number[]): {
    min: [number, number, number];
    max: [number, number, number];
  } {
    const min = [Infinity, Infinity, Infinity] as [number, number, number];
    const max = [-Infinity, -Infinity, -Infinity] as [number, number, number];
    for (const i of indices) {
      for (let c = 0; c < 3; c++) {
        min[c] = Math.min(min[c], bounds[i].min[c]);
        max[c] = Math.max(max[c], bounds[i].max[c]);
      }
    }
    return { min, max };
  }

  const triangleIndices: number[] = [];
  const nodes: BvhNodeData[] = [];

  const leafThreshold = 4;
  const maxDepth = 16;

  function build(indices: number[], depth: number): number {
    const nodeIndex = nodes.length;
    nodes.push({
      minX: 0,
      minY: 0,
      minZ: 0,
      maxX: 0,
      maxY: 0,
      maxZ: 0,
      left: -1,
      right: -1,
      first: 0,
      count: 0,
    });

    const { min, max } = nodeBounds(indices);
    const node = nodes[nodeIndex];
    node.minX = min[0];
    node.minY = min[1];
    node.minZ = min[2];
    node.maxX = max[0];
    node.maxY = max[1];
    node.maxZ = max[2];

    if (indices.length <= leafThreshold || depth >= maxDepth) {
      node.first = triangleIndices.length;
      node.count = indices.length;
      for (const i of indices) {
        triangleIndices.push(i);
      }
      return nodeIndex;
    }

    const axis = depth % 3;
    const sorted = [...indices].sort((a, b) => bounds[a].center[axis] - bounds[b].center[axis]);

    // Guard against a bad split.
    const firstCenter = bounds[sorted[0]].center[axis];
    const lastCenter = bounds[sorted[sorted.length - 1]].center[axis];
    if (firstCenter === lastCenter) {
      node.first = triangleIndices.length;
      node.count = sorted.length;
      for (const i of sorted) {
        triangleIndices.push(i);
      }
      return nodeIndex;
    }

    const mid = Math.floor(sorted.length / 2);
    const left = sorted.slice(0, mid);
    const right = sorted.slice(mid);

    if (left.length === 0 || right.length === 0) {
      node.first = triangleIndices.length;
      node.count = sorted.length;
      for (const i of sorted) {
        triangleIndices.push(i);
      }
      return nodeIndex;
    }

    node.left = build(left, depth + 1);
    node.right = build(right, depth + 1);
    node.count = 0;
    return nodeIndex;
  }

  if (tris.length > 0) {
    build(
      tris.map((_, i) => i),
      0,
    );
  }

  return { nodes, triangleIndices: Uint32Array.from(triangleIndices) };
}

export function nodesToBuffer(nodes: BvhNodeData[]): ArrayBuffer {
  const buffer = new ArrayBuffer(nodes.length * 48);
  const floats = new Float32Array(buffer);
  const ints = new Int32Array(buffer);
  const uints = new Uint32Array(buffer);

  nodes.forEach((node, i) => {
    const base = i * 12; // 12 floats per node
    floats[base + 0] = node.minX;
    floats[base + 1] = node.minY;
    floats[base + 2] = node.minZ;
    floats[base + 3] = 0; // padding
    floats[base + 4] = node.maxX;
    floats[base + 5] = node.maxY;
    floats[base + 6] = node.maxZ;
    floats[base + 7] = 0; // padding
    const intBase = i * 12 + 8; // after 8 floats
    ints[intBase + 0] = node.left;
    ints[intBase + 1] = node.right;
    const uintBase = i * 12 + 10; // after 10 floats (8 + 2 ints)
    uints[uintBase + 0] = node.first;
    uints[uintBase + 1] = node.count;
  });

  return buffer;
}
```<|end|><|start|>write to=assistant<|channel|>analysis<|message|>Wait Uint32Array indexing: buffer byte offset. `new Uint32Array(buffer)` spans whole buffer, index is uint32 element. Node spacing 48 bytes = 12 uint32s. intBase = i*12+8 = node offset 32 bytes + 8 floats? Let's recalc: 8 floats = 32 bytes = 8 uint32 slots. Then left/right = slots 8,9. first/count = slots 10,11. So uints[base+10], uints[base+11]. That matches. But ints view starts at slot0 too aligned. Fine. Since the Int32 and Uint32 both alias same buffer, writing through separate typed arrays okay.

Potential issue typed arrays alignment: Int32Array(buffer) starts at 0, fine.

Now commit.<|end|><|start|> assistant to=shell<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="command">
cd "C:\Users\amitk\Documents\Projects\something"; git add src/bvh/bvh.ts; git commit -m "build a simple cpu side bvh"