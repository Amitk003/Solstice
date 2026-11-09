# Reset view

The Reset view button returns the camera to the default framing.

## What it resets

- Orbit target back to the scene center.
- Radius back to 4.
- Azimuth back to 0.6 and elevation back to 0.5.
- Field of view back to 45 degrees.
- Focus offset back to 0.

## Behavior

Reset view is a camera move. The trace accumulation restarts, but
the temporal history survives. The lights, sun, exposure, and other
settings do not change.

## Limits

- It does not reset the aperture, auto orbit, or saved presets.
