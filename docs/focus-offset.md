# Focus offset

The depth of field used to focus exactly on the orbit target. A new
Focus slider moves that sharp plane in front of or behind the target.

## How it works

The camera focus distance is the distance to the target plus the
slider offset, clamped so it never goes below 0.2 units. The shader
thin lens model is unchanged, so the blur grows with the aperture
exactly as before.

## Panel

- Focus from -2 to 4, step 0.05, default 0.
- Negative values focus in front of the target.
- Positive values focus behind it.

## Why

With the aperture open, you can blur the cube and keep the gems
sharp, or the other way around. Combined with panning, the focus
plane can sit on any depth in the scene.

## Limits

- The slider does nothing when the aperture is at zero (pinhole).
- The offset is one value along the view direction. It cannot focus
  on different depths at once.
