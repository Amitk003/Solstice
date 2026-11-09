# Sun warmth

The Sun warmth slider changes the color of the direct sun. It moves
from cool daylight at 0 to warm late daylight at 1. The default 0.5
is near neutral warm.

## How it works

The slider interpolates between a cool sun tint and a warm sun tint.
The direct sun shader reads the color from a small uniform buffer.
The environment map is regenerated with the same tint, so the sun
disk, glow, reflections, and sky light all follow the slider.

## Behavior

Changing the warmth resets the samples and temporal history. The
environment map regeneration is batched like the sun angle and height
changes.

## Limits

- The slider only tints the sun. The key and fill lamps keep their
  own colors.
- The Sun light slider controls how strong the sun is. See
  `docs/sun-intensity.md`.
- The windows in the environment map stay the same color.
