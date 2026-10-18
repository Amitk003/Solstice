# Glossy reflection

Mirror surfaces used to reflect like a perfect mirror. Now the reflection
leans on the roughness field from the material table. Low roughness gives
a sharp mirror. Higher roughness gives a soft, brushed look.

## How it works

- Each mirror hit draws a half vector from the GGX distribution. That is
  the standard microfacet distribution used by most renderers.
- The reflection direction is the view direction mirrored about that half
  vector.
- Roughness controls how tightly the half vectors cluster around the
  surface normal. Small values cluster tightly, so the reflection stays
  sharp. Large values spread out, so it blurs.
- Fresnel is Schlick's approximation, with the material base color as the
  reflectance at normal incidence.
- One sample is taken per frame. The frames blend, so a soft reflection
  resolves over time as you hold still.

## What you should see

- The cube still reflects the floor and the lamp, but the edges soften a
  little instead of staying mirror sharp.
- The reflection holds still once it converges.

## Limits

- Only mirror surfaces use the rough lobe. Glass reflections stay sharp.
- The sample weight uses Fresnel alone. It does not divide by the GGX
  probability yet, so a very rough surface would be too bright. For the
  current low roughness this is close enough.
- Roughness does not yet affect diffuse surfaces.
