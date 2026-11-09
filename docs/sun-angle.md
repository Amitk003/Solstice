# Sun angle, height, and warmth

The sun used to point one fixed way. Three sliders now move the
daylight around the sky and tint it: a Sun angle slider for the
azimuth, a Sun height slider for the elevation, and a Sun warmth
slider for the color.

## How it works

The Sun angle slider sets the azimuth from -180 to 180 degrees. The
Sun height slider sets the elevation from 2 to 89 degrees. Both move
the same two things at once:

- The direct sun light direction in the camera uniforms, so the
  shadows and the shading follow the slider.
- The sun disk in the environment map. The map is regenerated on the
  CPU and uploaded again, so the bright disk lines up with the shadow
  ray.

## Performance

Regenerating the 1024 by 512 map takes a few milliseconds. Rapid
slider moves are batched into one upload per short window, so the
panel does not stall while dragging.

## Why

Moving the sun changes the mood without touching the scene: long
shadows in the evening, a backlit glow at noon, or a glancing light
across the floor and the wax sphere.

## Limits

- Very low elevations (2 degrees) give long glancing light. Very
  high ones (89 degrees) give flat noon light.
- The warmth slider tints the sun and the environment sun disk. See
  `docs/sun-warmth.md`.
- The windows in the environment map do not move with the sun.
- Moving the sun resets the samples and the temporal history.
