# Fill light intensity

The scene has two area lights: a warm rectangular key panel and a
cooler spherical fill. The Fill light slider scales the fill light.

## How it works

The slider scales the fill light color from 0 to 3. The default 1
restores the color from `FILL_LIGHT`. That state is stored next to
the key light scale, so moving the sliders in either order keeps the
other light unchanged.

The visible fill sphere follows the same color. That color is
written to the light buffer and to the matching material slot, so the
glow and the emitted light always agree.

## Why

The fill adds a cool side light. Turning it down makes the key light
and the sun carry the scene. Turning it up lifts the shadows with a
cool tint.

## Limits

- Only the fill sphere changes. The key panel, sun, and sky keep
  their own colors.
- The fill size and position do not change. Only the color scales.
