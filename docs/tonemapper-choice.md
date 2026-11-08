# Tone mapper choice

The display pass maps HDR color to screen color with one fixed ACES
curve. Now the panel can switch between three curves.

## Curves

- ACES (default). A filmic curve that rolls highlights off slowly.
  This is the look the renderer always had.
- Reinhard. A simpler curve that compresses the whole range. It is
  flatter in the shadows than ACES.
- Linear. The HDR value clipped to 1.0, with no compression. Small
  values stay exact, but highlights burn out hard.

All three share the exposure slider and the gamma step, and all three
apply to the saved PNG export as well.

## Why

The HDR environment map and the wax glow put real highlights above
1.0. ACES hides some of them. Linear shows exactly where the image
blows out, which is how you tune the exposure and the light colors.

## Limits

- The choice only touches the display pass. The traced HDR radiance
  and the accumulated samples never change.
- Switching the curve does not reset the sample count.
