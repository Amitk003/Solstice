# Sun intensity

The Sun light slider scales the direct sun. It ranges from 0 to 4
and defaults to 1.

## How it works

The direct sun shader multiplies its color by the intensity from
the sun uniform buffer. The sun angle, height, warmth, and size do
not change. The environment map sun disk keeps its own brightness.

## Behavior

Changing the intensity resets the samples and temporal history,
because the direct shading changes.

## Limits

- Only direct sun shading scales. Sky light and the environment
  map disk do not.
- The Sun warmth slider still controls the color.
