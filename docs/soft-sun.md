# Soft sun

The sun used to be a single direction, so its shadows were perfectly
sharp. Now the sun has an angular size. Each shading point samples a
direction inside a small cone around the sun, so the shadow edge softens
like a real sun.

## What changed

- The camera carries a sun angular size, in radians.
- A new helper draws a direction inside a cone around the sun axis.
- The sun shadow test uses that jittered direction, so different frames
  sample different points on the sun disk. Frames blend into a soft edge.
- A slider in the panel sets the size from 0 to 0.3 radians.

## How to use it

- Size 0 is a point sun with hard shadows.
- Small values give a soft edge, like a slightly hazy day.
- Large values give very soft shadows. They resolve over time as frames
  blend, so hold still.

## What you should see

- The cube shadow on the floor gains a soft edge.
- The effect is subtle at the default and strong near the top of the
  slider.
- Everything else stays the same.

## Limits

- The sun is still just a direction with a cone, not a real disk with
  falloff. Radiance is constant across the cone.
- There is no multiple importance sampling for the sun, so very wide
  suns can look slightly noisy.
