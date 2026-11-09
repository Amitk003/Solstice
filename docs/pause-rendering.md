# Pause rendering

The Pause button stops the render loop. The canvas keeps the last
frame, and the button becomes Resume.

## How it works

The existing context `stop` and `start` methods cancel and recreate
the animation frame loop. No shader or pipeline work happens while
paused.

## Behavior

While paused:

- The frame rate display stays at its last smoothed value.
- Camera controls do nothing because no new frame is rendered.
- Save PNG still captures the last temporal result.

## Limits

- The button does not dispose GPU resources. The app keeps the
  device and scene buffers alive.
