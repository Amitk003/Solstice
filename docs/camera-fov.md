# Camera field of view

The FOV slider changes the vertical field of view from 20 to 110
degrees. The default 45 degrees matches the previous camera.

## How it works

The camera perspective matrix is rebuilt from the slider value every
frame. A smaller value makes a tighter view. A larger value widens
the view and makes the scene look smaller.

## Behavior

Changing the FOV is a camera move. The trace accumulation restarts,
but the temporal history survives because the previous view
projection is still available for reprojection.

## Limits

- The value is vertical. Horizontal coverage follows the aspect
  ratio.
- The slider does not change the orbit radius. Use the mouse wheel
  for distance.
