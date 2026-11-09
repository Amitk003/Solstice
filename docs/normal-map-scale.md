# Normal map scale

The Map scale slider controls how large the procedural normal map
features are in world space. It defaults to 0.25, which repeats the
map every four world units.

## How it works

The slider scales the planar world coordinates before they sample
the normal map. Smaller values make larger features. Larger values
make smaller features. The normal map strength stays the same.

## Behavior

Changing the scale resets the samples and the temporal history,
because the shading changes.

## Limits

- The slider ranges from 0.05 to 1. Values above 1 are clamped.
- The map has no UV unwrap, so this controls world space tiling.
