# Depth of field

The camera now has a lens. Points at the focus distance stay sharp, and
points behind or in front of it blur. This is the classic thin lens model.

## What changed

- The camera carries an aperture (lens radius) and a focus distance.
- The focus distance is the distance from the eye to the orbit target, so
  the middle of the scene stays sharp as you orbit.
- Ray generation picks a random point on the aperture disk each frame and
  aims the ray at the point the center ray focused on.
- The camera basis for the disk comes from the inverse view projection,
  so no extra matrices are needed.
- A slider in the panel sets the aperture from 0 to 0.2.

## How to use it

- Aperture 0 is a pinhole. Everything is sharp.
- Small values give a soft background blur.
- Larger values give a strong blur. It resolves over time as frames
  blend, so hold still for a second.

## What you should see

- The cube and sphere stay sharp. The floor and sky soften with distance.
- The effect converges because the aperture sample is random per frame.

## Limits

- Focus is fixed to the orbit target. Manual focus and a focus pick from
  the center pixel come later.
- The aperture disk is sampled without importance sampling. That is fine
  for a lens this small.
