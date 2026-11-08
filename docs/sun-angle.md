# Sun angle

The sun used to point one fixed way. A Sun angle slider now rotates
the daylight around the vertical axis.

## How it works

The slider sets the azimuth from -180 to 180 degrees, with the
elevation fixed at 55 degrees. It moves two things at once:

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

- The elevation is fixed at 55 degrees. Only the azimuth moves.
- The windows in the environment map do not move with the sun.
- Moving the sun resets the samples and the temporal history.
