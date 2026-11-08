# Camera pan

Arrow keys and WASD move the orbit target sideways. Drag still orbits
around that target, so you can recenter on a detail and turn around
it.

## How it works

Each pan key moves the target one step along the screen right or
screen up axis, projected to world space from the camera position.
The step is eight percent of the orbit radius, so panning feels the
same at any zoom. The camera eye follows the target and the focus
plane stays on it.

Like a drag, a pan resets the trace accumulation but keeps the
temporal history, because the view changes smoothly.

## Controls

- Arrow keys or WASD: pan left, right, up, and down.
- Drag: orbit around the target.
- Number keys: switch view mode.

## Limits

- The target can drift as far as you push it. There is no clamp yet.
- Sliders and selects keep their own arrow keys. Panning only works
  when the panel controls are not focused.
