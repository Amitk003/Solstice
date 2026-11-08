// GPU BVH build. Four compute entry points run in order:
// 1. morton: one 30 bit Morton code per triangle, padded to a power of two.
// 2. bitonicStep: one compare and exchange step of a bitonic sort.
// 3. leafFill: one leaf node per sorted triangle.
// 4. internalLevel: one level of parent nodes, bottom up.
//
// The tree uses heap layout over the padded leaf count. Internal nodes are
// 0 .. paddedCount - 2 and leaves are paddedCount - 1 .. 2 * paddedCount - 2.
// Node 0 is always the root. Children of internal node i are 2i+1 and 2i+2.

struct BuildParams {
  sceneMin: vec3f,
  _pad0: f32,
  sceneMax: vec3f,
  _pad1: f32,
  triangleCount: u32,
  paddedCount: u32,
  levelStart: u32,
  levelCount: u32,
  sortK: u32,
  sortJ: u32,
  _pad2: u32,
  _pad3: u32,
}

struct Triangle {
  v0: vec3f,
  _pad0: f32,
  n0: vec3f,
  _pad1: f32,
  v1: vec3f,
  _pad2: f32,
  n1: vec3f,
  _pad3: f32,
  v2: vec3f,
  _pad4: f32,
  n2: vec3f,
  material: u32,
}

// Same layout as BvhNode in bvh.wgsl and nodesToBuffer in bvh.ts.
struct BvhNode {
  min: vec3f,
  _pad0: f32,
  max: vec3f,
  _pad1: f32,
  left: i32,
  right: i32,
  first: u32,
  count: u32,
}

@group(0) @binding(0) var<uniform> params: BuildParams;
@group(0) @binding(1) var<storage, read> triangles: array<Triangle>;
@group(0) @binding(2) var<storage, read_write> keys: array<u32>;
@group(0) @binding(3) var<storage, read_write> values: array<u32>;
@group(0) @binding(4) var<storage, read_write> nodes: array<BvhNode>;

// Spread the low 10 bits of v so there are two zero bits between each.
fn expandBits(v: u32) -> u32 {
  var x = v & 1023u;
  x = (x | (x << 16u)) & 0x030000ffu;
  x = (x | (x << 8u)) & 0x0300f00fu;
  x = (x | (x << 4u)) & 0x030c30c3u;
  x = (x | (x << 2u)) & 0x09249249u;
  return x;
}

@compute @workgroup_size(64, 1, 1)
fn morton(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.paddedCount) {
    return;
  }
  let triangleIndex = min(i, params.triangleCount - 1u);
  let tri = triangles[triangleIndex];
  let center = (tri.v0 + tri.v1 + tri.v2) / 3.0;
  let extent = max(params.sceneMax - params.sceneMin, vec3f(0.00001));
  let normalized = clamp((center - params.sceneMin) / extent, vec3f(0.0), vec3f(1.0));
  let quantized = vec3u(
    u32(normalized.x * 1023.0),
    u32(normalized.y * 1023.0),
    u32(normalized.z * 1023.0),
  );
  var code = expandBits(quantized.x) | (expandBits(quantized.y) << 1u) | (expandBits(quantized.z) << 2u);
  // Padding copies the last triangle. A max code pushes it to the end.
  if (i >= params.triangleCount) {
    code = 0xffffffffu;
  }
  keys[i] = code;
  values[i] = triangleIndex;
}

@compute @workgroup_size(64, 1, 1)
fn bitonicStep(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.paddedCount) {
    return;
  }
  let partner = i ^ params.sortJ;
  if (partner <= i) {
    return;
  }
  let ascending = (i & params.sortK) == 0u;
  let a = keys[i];
  let b = keys[partner];
  var shouldSwap = false;
  if (ascending) {
    shouldSwap = a > b;
  } else {
    shouldSwap = a < b;
  }
  if (shouldSwap) {
    keys[i] = b;
    keys[partner] = a;
    let valueA = values[i];
    let valueB = values[partner];
    values[i] = valueB;
    values[partner] = valueA;
  }
}

@compute @workgroup_size(64, 1, 1)
fn leafFill(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.paddedCount) {
    return;
  }
  let tri = triangles[values[i]];
  var node: BvhNode;
  node.min = min(tri.v0, min(tri.v1, tri.v2));
  node.max = max(tri.v0, max(tri.v1, tri.v2));
  node.left = -1;
  node.right = -1;
  node.first = i;
  node.count = 1u;
  nodes[params.paddedCount - 1u + i] = node;
}

@compute @workgroup_size(64, 1, 1)
fn internalLevel(@builtin(global_invocation_id) gid: vec3u) {
  let offset = gid.x;
  if (offset >= params.levelCount) {
    return;
  }
  let index = params.levelStart + offset;
  let leftIndex = index * 2u + 1u;
  let rightIndex = index * 2u + 2u;
  let leftNode = nodes[leftIndex];
  let rightNode = nodes[rightIndex];
  var node: BvhNode;
  node.min = min(leftNode.min, rightNode.min);
  node.max = max(leftNode.max, rightNode.max);
  node.left = i32(leftIndex);
  node.right = i32(rightIndex);
  node.first = 0u;
  node.count = 0u;
  nodes[index] = node;
}
