# OBJ mesh loading

The scene is no longer only procedural shapes. It can load a Wavefront
OBJ file and drop the mesh into the triangle list like any other
geometry.

## What was added

- `src/scene/obj.ts` parses OBJ text into triangles.
- `src/scene/geometry.ts` holds the shared face normal helper.
- `src/scene/assets/icosahedron.obj` is a small mesh used as a demo.
- The asset is imported in raw text form at build time, the same way the
  shaders are. No network fetch, no async loading.

## What the loader supports

- `v` vertex lines and `vn` normal lines.
- `f` face lines with three or more corners. Faces with more than three
  corners are fan triangulated.
- Face tokens in all the usual forms: `1`, `1/2`, `1//3`, `1/2/3`.
- Negative indices, which count back from the end.

## Normals

The loader picks normals in this order:

1. Normals from the file, when every corner has one.
2. Flat face normals, when the file has none. This is the default.
3. Smooth averaged normals, when the file has none and smooth is asked
   for. This is off by default, because flat facets often look better on
   a low poly mesh.

## Faces and winding

Faces are assumed to be wound counter clockwise as seen from outside.
That is the usual OBJ convention. The demo icosahedron follows it.

## What you should see

- A faceted gold gem resting on the floor to the left of the cube.
- Its facets catch both lamps and show in the mirror.

## Limits

- No texture coordinates are read yet.
- No material groups, so a whole file takes one material.
- No streaming. Meshes are baked in at build time.
