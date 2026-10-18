# Sky model

The background used to be a two color vertical gradient. It is now a
small environment: a ground below the horizon, a sky gradient above, and
a soft glow around the sun direction.

## What changed

- Below the horizon the sky fades to a dark ground color.
- Above the horizon it goes from a warm horizon to a deeper zenith.
- A soft glow sits around the sun direction, so the background lines up
  with the light.
- The sky is used for ray misses, so it also lights the scene indirectly.
- A slider in the panel scales the whole sky, from 0 to 2.

## What you should see

- A horizon behind the scene instead of a plain gradient.
- A brighter patch of sky toward the sun.
- Turning the Sky slider down darkens the background and the sky fill.
  Turning it up lifts both.

## Limits

- The sky is a simple analytic color. No texture or HDR environment map
  yet.
- The sun glow is a visual and indirect term, not a second light. Direct
  sun light still comes from the sun shadow ray.
