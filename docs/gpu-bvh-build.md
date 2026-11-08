# GPU BVH build

The bounding volume hierarchy used to be built on the CPU and uploaded.
It is now built on the GPU with compute shaders. The CPU build stays as
a fallback.

## The four shader steps

Every step is a compute entry point in `src/shaders/bvh_build.wgsl`.

1. Morton. For each triangle, take its centre, normalize it inside the
   scene bounds, quantize each axis to 10 bits, and interleave the three
   values into one 30 bit code. Triangles that are close in space get
   close codes.

2. Bitonic sort. Sort the Morton codes and their triangle indices
   together. One dispatch does one compare and exchange step. A power of
   two size keeps the network simple.

3. Leaf fill. For each sorted slot, read the triangle index, compute the
   triangle box, and write one leaf node.

4. Internal levels. Walk up one level at a time. Each parent takes the
   union of its two children. Children are always deeper in the buffer,
   so a level only reads finished nodes.

## Tree layout

The padded leaf count is a power of two. That allows a simple heap
layout:

- Internal nodes are indices 0 to paddedCount minus 2.
- Leaves are indices paddedCount minus 1 to two times paddedCount minus 2.
- Children of internal node i are 2i plus 1 and 2i plus 2.
- Node 0 is always the root.

Triangle indices are padded by repeating the last triangle. The extra
leaves test a real triangle again, which is harmless for a closest hit
test.

## Sorting both keys and values

Bitonic sort swaps keys and values together. Only the thread with the
smaller index of a pair writes, so there is no race. Each step runs in
its own compute pass so the next step sees the result.

## Why bitonic and not radix

Radix sort is faster for large counts but needs histograms, prefix
sums, and several buffers. The scene is under a few thousand triangles
and the build runs once at start. A simple bitonic network is enough and
much easier to read.

## Fallback

If the GPU build reports a validation error, the code logs a warning and
runs the old CPU build instead. The status line shows `bvh gpu` or
`bvh cpu` so you can tell which path ran without opening the console.

## Limits

- The build runs once at startup. There is no refit or rebuild for a
  moving scene yet.
- There is no binned SAH split. Morton order gives good locality, not an
  optimal tree.
- Bitonic sort is O(n log squared n). Fine for this scene, too slow for
  millions of triangles.
- The tree is a perfect binary tree over padded leaves, so its depth is
  log2 of the padded count.
