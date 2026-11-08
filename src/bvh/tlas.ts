import type { BvhNodeData } from './bvh';
import type { Aabb } from '../scene/instances';

export interface InstanceTlas {
  // Nodes are stored in depth first order. Left and right hold absolute
  // indices in the shared node buffer, so nodeBase must be passed in.
  nodes: BvhNodeData[];
  root: number;
}

function emptyNode(): BvhNodeData {
  return {
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
  };
}

// Build a top level acceleration structure over instance bounding boxes.
// There are few instances, so a simple median split is plenty. Every leaf
// holds one instance and stores its index in first.
export function buildInstanceTlas(boxes: Aabb[], nodeBase: number): InstanceTlas {
  if (boxes.length === 0) {
    return { nodes: [emptyNode()], root: nodeBase };
  }

  const nodes: BvhNodeData[] = [];

  function boundsOf(indices: number[]): Aabb {
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const i of indices) {
      const box = boxes[i]!;
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis]!, box.min[axis]!);
        max[axis] = Math.max(max[axis]!, box.max[axis]!);
      }
    }
    return { min, max };
  }

  function build(indices: number[]): number {
    const localIndex = nodes.length;
    nodes.push(emptyNode());

    const bounds = boundsOf(indices);
    const node = nodes[localIndex]!;
    node.minX = bounds.min[0];
    node.minY = bounds.min[1];
    node.minZ = bounds.min[2];
    node.maxX = bounds.max[0];
    node.maxY = bounds.max[1];
    node.maxZ = bounds.max[2];

    if (indices.length === 1) {
      node.first = indices[0]!;
      node.count = 1;
      return nodeBase + localIndex;
    }

    // Split along the axis with the widest spread of box centers.
    const centers = indices.map((i) => {
      const box = boxes[i]!;
      return [
        (box.min[0] + box.max[0]) * 0.5,
        (box.min[1] + box.max[1]) * 0.5,
        (box.min[2] + box.max[2]) * 0.5,
      ] as [number, number, number];
    });
    let axis = 0;
    let widest = -Infinity;
    for (let a = 0; a < 3; a++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const c of centers) {
        lo = Math.min(lo, c[a]!);
        hi = Math.max(hi, c[a]!);
      }
      if (hi - lo > widest) {
        widest = hi - lo;
        axis = a;
      }
    }

    const order = indices
      .map((value, position) => ({ value, center: centers[position]![axis]! }))
      .sort((a, b) => a.center - b.center)
      .map((entry) => entry.value);
    const mid = Math.floor(order.length / 2);

    const left = build(order.slice(0, mid));
    const right = build(order.slice(mid));
    node.left = left;
    node.right = right;
    node.count = 0;
    return nodeBase + localIndex;
  }

  const root = build(boxes.map((_, i) => i));
  return { nodes, root };
}
