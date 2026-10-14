# HDR and tone mapping

The trace pass now writes linear HDR color. The display pass maps it to
the screen.

## What changed

- The output texture uses a 16 bit float format.
- The trace kernel outputs linear HDR radiance above 1.
- The blit shader applies ACES tone mapping and gamma.

## Why this matters

Real lights are brighter than 1. HDR keeps that range until display.
Later bounces and emissive materials need this path.
