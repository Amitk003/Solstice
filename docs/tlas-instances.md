# Instanced meshes and the TLAS

The scene now uses a two level acceleration structure. The bottom level is
a BLAS for one mesh. The top level is a TLAS over instances.

## What a BLAS and a TLAS are

A BLAS (bottom level acceleration structure) bounds the triangles of one
mesh in the mesh local space. A TLAS (top level acceleration structure)
bounds the world space boxes of every instance and points at a BLAS.

This lets one mesh appear many times with different transforms without
copying its triangles or rebuilding its tree.

## The gem BLAS

`makeGemMesh` in `src/scene/triangles.ts` returns the unit gem centred at
the origin. The GPU builder from the previous feature builds one tree for
it. The gem has 20 triangles, so the padded leaf count is 32 and the tree
has 63 nodes.

## The instance TLAS

`src/scene/instances.ts` defines five gem instances. Each one has a
position, a uniform scale, and a material index. `src/bvh/tlas.ts` builds
a small binary tree over their world space boxes. Every leaf stores one
instance index.

## One set of buffers

The trace shader already uses all eight storage buffers that WebGPU allows
by default. To stay inside that limit, all meshes share the same three
scene buffers:

- `triangles` holds the static scene triangles, then the local gem
  triangles.
- `nodes` holds the static BVH nodes, then the gem BLAS nodes, then the
  TLAS nodes.
- `triIndices` holds the static triangle indices, then the gem triangle
  indices.

The builder takes base offsets and writes absolute child and triangle
indices. The trace shader receives the gem root and the TLAS root from a
small uniform buffer.

## Ray traversal

For the closest hit, the shader traces the static BVH and the TLAS and
keeps the nearer result. A TLAS leaf gives an instance. The ray origin and
direction are moved into the gem local space with the inverse matrix, the
gem BLAS is traced there, and the hit normal is moved back to world space
with the inverse transpose. The ray parameter stays the same because the
transform is a uniform scale plus a translation.

Shadow rays do the same. `isOccludedScene` tests the static BVH and then
the instances, so the gems cast shadows on the floor, the cube, and each
other.

## Where instances live

Instance transforms are packed into the `SceneInfo` uniform buffer because
a uniform buffer does not count against the storage buffer limit. The
array has a fixed size of eight slots. `MAX_INSTANCES` in `bvh.wgsl` must
match `MAX_INSTANCES` in `src/scene/instances.ts`.

## Fallback

If the gem BLAS build fails, the renderer logs a warning and sets the
instance count to zero. The static scene still renders. The static BVH
keeps its own CPU fallback.

## Limits

- Instances share one mesh. A second mesh would need another BLAS range
  and another root offset.
- The transform is uniform scale plus translation. Rotation would need the
  world box to be built from all eight transformed corners.
- The TLAS is built on the CPU once at startup.
