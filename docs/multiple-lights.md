# Multiple lights

The scene had one lamp. Now there are two: a warm key light above and a
cool fill light off to the side. This shows why the light buffer is worth
having. Nothing in the shading loop names a specific light.

## What changed

- The light list holds two sphere lights, a warm one and a cool one.
- Each light gets its own emissive sphere in the mesh, built from the
  same definition, so the visible glow always matches the light.
- Each emissive sphere has its own material, so the glow color comes from
  the material table just like any other surface.
- Direct lighting loops over every light and sums the samples. Add a
  third light and it just works.

## How the sampling works

For each light, the shader draws one point on the sphere and computes the
same exact single-sample estimate as before: albedo over pi, times light
color, times the surface cosine, times sphere area times the light
cosine over distance squared. A distance limited shadow ray rejects
occluded samples. Each light uses its own random values so the samples do
not line up.

## What you should see

- A warm glow from the upper right and a cool glow from the left.
- Two bright spots in the cube mirror and through the glass.
- The floor picks up both tints and converges as you hold still.

## Limits

- The light count is fixed at build time. There is no dynamic add or
  remove yet, though the buffer and the shader loop would allow it.
- The sun is still separate, in the camera uniforms.
