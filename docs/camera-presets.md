# Camera presets

The panel has four buttons that jump the camera to saved views.

## Presets

- Home: the default view (radius 4, azimuth 0.6, elevation 0.5).
- Front: head on (azimuth 0, elevation 0.2).
- Top: from high above (radius 5.5, elevation 1.35).
- Low: from far and slightly below (radius 6, elevation -0.35).

## How they behave

A preset is a camera move. The trace accumulation starts a new
average, but the temporal history survives, so the jump stays clean.
Drag and orbit work the same before and after a preset.

## Limits

- Presets only set orbit angles. There is no saved target point or
  zoom lock yet.
- The four angles are fixed in the context. There is no UI editor for
  them.
