# Camera controls

The canvas now supports click and drag to orbit the camera around the scene
target.

## How it works

- Pointer down starts dragging.
- Pointer move changes azimuth and elevation.
- Pointer up stops dragging.
- Arrow keys and WASD pan the orbit target. See
  `docs/camera-pan.md`.

The panel also has four preset buttons that jump to saved views. See
`docs/camera-presets.md`.

## Notes

The camera still updates its matrices every frame. The user interaction only
changes the orbit angles.
