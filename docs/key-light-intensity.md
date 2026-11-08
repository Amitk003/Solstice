# Key light intensity

The panel light has a Key light slider that scales its color. It is
the warm rectangle above the scene.

## How it works

- The slider scales the light color from 0 to 3. The default 1
  restores the color from `LAMP_LIGHT`.
- The visible panel glow follows the same color, so a brighter panel
  really is brighter.
- Moving the slider resets the samples and the temporal history,
  because the lighting changes.

## Use it with

- The sun sliders, to balance the panel against the daylight.
- The exposure slider, to compare a brighter room with a brighter
  photo at the same output.

## Limits

- Only the key panel changes. The cool fill lamp and the sun keep
  their own colors.
- The panel size and shape do not change. Only the color scales.
