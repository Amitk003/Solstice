# Firefly clamp

With one sample per pixel, a lucky path can return a huge spike. Those
spikes are bright single pixels that stay visible for many frames,
even after accumulation and denoising. They are called fireflies.

## The fix

The path tracer clamps its final radiance to 64 in every channel:

```text
return min(radiance, 64)
```

Real HDR content stays well below that. The sun disk, the lamp panel,
and the environment map peak below 30. The clamp only cuts spikes
that are far above anything a legitimate surface returns.

## Why not lower

A lower clamp, such as 10, would clip the sun disk and the lamp
glow. The ACES tone mapper already rolls those highlights off. The
clamp is only there to stop outliers that the denoiser cannot handle.

## Limits

- The clamp slightly biases the result. Spikes above 64 lose their
  true energy.
- A spike below 64 still passes. The accumulation and the denoiser
  handle those.
