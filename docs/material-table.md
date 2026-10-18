# Material table

Materials used to be baked into the shader. The base colors, the glass
index, and the absorption tint were all hard coded numbers. Now they live
in one table on the CPU and travel to the shader in a storage buffer.

## Adding a material

Add one entry to `MATERIALS` in `src/scene/materials.ts` and point some
triangles at its index. That is the whole job.

## Fields

- kind: diffuse, mirror, glass, or emissive.
- baseColor: the surface color. Also the reflection tint for mirrors.
- roughness: kept for later. Not used by the shading yet.
- ior: index of refraction for glass.
- emission: how strongly an emissive surface glows.
- absorption: how fast light dims while traveling through glass.

## Layout

Each material is 48 bytes:

- baseColor: 3 floats
- roughness: 1 float
- absorption: 3 floats
- ior: 1 float
- kind: 1 unsigned int
- emission: 1 float
- two pads

The pads keep the 48 byte stride aligned to 16 bytes, which the storage
buffer rules want.

## What changed

- Triangles now store an index into the material table.
- The CPU packs the table into a storage buffer.
- The kernel bind group has a new binding (7) for the material buffer.
- The shader reads `materials[primary.material]` and switches on kind.
- The emissive color comes from the material, which reads its color from
  the same lamp definition the light buffer uses. One source of truth.

## What you should see

- The floor is a flat warm gray instead of the old normal based tint.
- The mirror cube reflects with its own base color as the tint.
- Glass uses the table index and absorption.
- The lamp still glows the same warm white.

## Limits

- Roughness is stored but unused. Real glossy reflection comes later.
- Only the fields above are honored. Metallic workflow and textures come
  later.
