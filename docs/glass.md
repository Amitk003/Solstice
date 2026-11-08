# Glass sphere

The sphere is now glass. It refracts the scene behind it and reflects
at grazing angles. Its roughness is 0.3, so it is slightly frosted.

## What changed

- Sphere hits take a dielectric path instead of the diffuse path.
- Entry refraction uses an index of 1.5. The ray is traced to the far
  wall, then refracted out again.
- Total internal reflection falls back to the reflection color.
- Fresnel blends refraction and reflection.
- A faint absorption tint grows with glass thickness.
- Roughness blurs the reflection and the refraction. The perfect
  direction is mixed toward a random direction in the hemisphere
  around it, so higher roughness means a softer, milkier blur.

## What you should see

- The floor and cube bend through the sphere, a little blurred.
- Edges of the sphere turn mirror like.
- With the bounce toggle off, the sphere shows a plain diffuse preview.

## Limits

- The blur mixes toward a cosine hemisphere. It is not a true GGX
  transmission lobe.
- One glass object with a fixed index. A real material buffer with
  per-object settings comes later.
