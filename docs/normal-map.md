# Normal map

The floor now uses a real tangent space normal map instead of an
analytic sine ripple. The map is generated in code, so no texture
file is needed.

## How it is built

`src/scene/normalMap.ts` creates a 256 by 256 `rgba8unorm` image.
It evaluates a procedural height function on the CPU and turns its
gradient into a normal around the flat surface direction.

## How it is used

The trace shader binds the map as a sampled texture. For every hit
with a material detail value, it builds a tangent frame from the
surface normal, builds planar world coordinates from the dominant
normal axis, samples the map, and bends the normal in the tangent
plane.

The same bend is applied in the path trace and the G-buffer write,
so shading and denoiser edges agree.

## Material changes

The existing `detail` field is now the normal map strength. The
floor uses 0.35. Other materials use 0, so their normals stay as
authored.

The Map scale slider controls how large the features are. See
`docs/normal-map-scale.md`.

## Limits

- The map has no UV unwrap. World space planar coordinates are
  used, which is best for large flat surfaces.
- The map is procedural. There is no file loader for authored
  textures.
- The pattern repeats every four world units at the default scale.
  The Map scale slider changes that tiling.
