# Sphere prop

The scene now has a sphere next to the cube. It rests on the floor and
uses a warm red tint.

## What changed

- A latitude and longitude sphere generator builds the mesh.
- Winding is fixed against the sphere center, not the scene origin.
- Triangle ranges now act as simple object ids: cube 0 to 11, floor 12
  to 13, sphere 14 and up.
- The sphere shades diffuse with bounce light like the floor.

## Why this helps

Curved geometry tests the BVH with hundreds of triangles instead of a
few.

## Smooth normals

Each triangle now stores a normal per vertex. The intersection test
returns barycentric weights. The kernel blends the three normals by
those weights. Flat parts keep face normals. The sphere uses true
round normals, so it shades smooth instead of faceted.

## Limits

- Object ids are hard coded ranges. A real material buffer comes later.
