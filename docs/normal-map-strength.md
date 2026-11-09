# Normal map strength

The Map strength slider controls how much the normal map bends the
floor normal. The default 0.35 matches the floor material value.

## How it works

The slider writes the `detail` field of the floor material. The
shader uses that value as the strength in the tangent plane bend.
Zero restores the flat floor normal. The map tiling does not change;
use the Map scale slider for that.

## Behavior

Changing the strength resets the samples and temporal history,
because the shading changes.

## Limits

- The slider only affects the floor material. Other materials have
  their own fixed detail values.
- Higher values can look noisy at grazing angles.
