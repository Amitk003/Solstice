# Alpha cutout

Alpha cutout makes a full sheet of triangles read as a lattice. The
shader discards hits where a world space pattern is transparent, so
light and camera rays pass through the holes.

## How it works

The static BVH still contains one full screen quad. During closest
hit traversal and shadow ray traversal, the shader tests the material
kind and the world position. If the material is `Cutout` and the
pattern is transparent, the hit is ignored.

The pattern uses quarter unit world space cells in the x and y axes.
A hit is opaque only in the center square of each cell. The screen
becomes a grid with open spaces between the bars.

## Scene

`makeScreenTriangles` adds one vertical quad behind the scene. It
uses the new `MAT_SCREEN` material, so the visible bars are gray and
shade like diffuse surfaces. The holes show whatever sits behind
them.

## Material changes

`MaterialKind.Cutout` is the new kind value. It follows the same
diffuse shading path as the floor. No new storage buffer is needed.

## Limits

- This is a procedural cutout, not a sampled alpha texture. There is
  no texture file and no UV unwrap.
- For a transparent blend, see `docs/alpha-blend.md`.
- Only the static screen uses the cutout material. Instanced meshes
  do not alpha test.
- The BVH still spans the full quad. Transparent areas cost a little
  traversal before they are discarded.
- The pattern is fixed. There is no per-material tiling or threshold
  control yet.
