# Glass sphere

The sphere is now glass. It refracts the scene behind it and reflects
at grazing angles.

## What changed

- Sphere hits take a dielectric path instead of the diffuse path.
- Entry refraction uses an index of 1.5. The ray is traced to the far
  wall, then refracted out again.
- Total internal reflection falls back to the reflection color.
- Fresnel blends refraction and reflection.
- A faint absorption tint grows with glass thickness.

## What you should see

- The floor and cube bend through the sphere.
- Edges of the sphere turn mirror like.
- With the bounce toggle off, the sphere shows a plain diffuse preview.

## Limits

- One glass object with a fixed index. A real material buffer with
  per-object settings comes later.
