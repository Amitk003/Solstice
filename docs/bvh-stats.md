# BVH stats

The HUD shows the BVH node count, the triangle count, and the
padded triangle index count.

## Readout

```text
nodes 4095 tris 1300 pad 2048 | bvh gpu
```

The exact numbers depend on the current scene. The static scene has
about 1,300 triangles, and the padded count is the next power of two
used by the GPU build.

## Why

The counts make it easy to tell whether a scene change or a new
mesh added work to the acceleration structure. They also help when
you compare frame times after changing resolution.

## Limits

- The counts are fixed for the scene. They do not change with the
  camera or resolution.
- The node count includes the static BVH, the gem BLAS, and the
  instance TLAS.
