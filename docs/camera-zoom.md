# Camera zoom

The mouse wheel moves the camera closer or farther from the orbit
target. The status line says `drag to orbit, wheel to zoom`.

## How it works

Each wheel tick changes the orbit radius by a small fraction of the
current radius. Up moves in, down moves out. The radius is clamped
between 2.5 and 8, so the camera cannot enter the scene or drift too
far away.

## Behavior

Zooming is a camera move. The trace accumulation starts a new
average, but the temporal history survives, so the zoom stays calm.

## Limits

- The wheel only zooms. There is no pinch gesture.
- The zoom is radial. It does not change the field of view.
