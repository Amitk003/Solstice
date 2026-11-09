# Auto orbit

The camera can rotate on its own. The panel has an Auto orbit
checkbox, off by default.

## How it works

When enabled, the camera azimuth increases by 0.003 radians per
frame. At 60 frames per second, a full turn takes about 35 seconds.

Auto orbit pauses while you drag. Drag still orbits, and the auto
rotation continues after you release the pointer.

## Behavior

Auto orbit is a camera move. The trace accumulation restarts, but
the temporal history survives. The image stays calm while the camera
drifts.

## Limits

- Only the azimuth moves. Elevation and zoom stay where you left
  them.
- The checkbox does not change saved camera presets.
