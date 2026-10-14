# Jitter and accumulation

Each frame now uses a slightly shifted ray per pixel. Frames are blended
into a running average.

## What changed

- The camera uniform carries a frame index.
- A hash gives each pixel a small offset per frame.
- A storage buffer holds the running average per pixel.
- Moving the camera or resizing resets the sample count.
- The count caps at 1024 to avoid float error.

## Why this matters

Jitter plus averaging smooths edges without blur. Later random bounces
will reuse this path to converge to a clean image.

## Limits

- The buffer uses 16 bytes per pixel. Very large canvas sizes use more
  memory. The cap keeps typical sizes safe.
