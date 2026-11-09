# Alpha blend

The scene has a small transparent foil behind the cutout screen.
Light crosses it with attenuation, so the scene behind stays
visible.

## How it works

The `Blend` material uses `subsurface` as opacity. The foil uses
0.45. When a path hits it, the shader does not add direct light.
Instead it multiplies throughput by the base color and by
`1 - opacity`, then continues. The scene behind is then traced
normally.

Shadow rays skip the foil, so it does not block direct sunlight.

## Scene

`makeBlendTriangles` adds the foil at the back right. The cutout
lattice sits in front of it, so the holes show the dimmed foil
instead of only the sky.

## Limits

- The foil is one fixed plane and one fixed opacity.
- It does not reflect or refract the way glass does.
- The denoiser sees the foil hit in the primary G-buffer. That is
  correct for the surface you are looking at, even though the path
  continues behind it.
