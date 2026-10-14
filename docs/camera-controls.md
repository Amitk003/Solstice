# Camera controls

The canvas now supports click and drag to orbit the camera around the scene
target.

## How it works

- Pointer down starts dragging.
- Pointer move changes azimuth and elevation.
- Pointer up stops dragging.

## Notes

The camera still updates its matrices every frame. The user interaction only
changes the orbit angles.
