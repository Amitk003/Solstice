# Temporal reprojection

The renderer already averages samples while the camera is still. When
the camera moves, the trace pass starts a new average, so every frame
is a single noisy sample again. This branch adds a temporal pass that
reuses the previous filtered frame, so the image stays calm while the
camera moves.

## Motion vectors

The trace pass knows the primary ray and where it hit. It takes that
world point and projects it through the view projection of the previous
frame. The result is a UV coordinate in the previous image. The trace
writes that UV to a small texture for every pixel.

A miss writes zero, so the sky never pulls old colors across the screen.
The motion is only stored when the projected point lands inside the
previous image.

## The temporal pass

The pass runs after the a-trous chain. For each pixel it:

1. Reads the previous UV for that pixel.
2. Loads the previous filtered color from that UV.
3. Compares the current normal and hit distance with the values stored
   in the previous frame's G-buffer.
4. Blends the previous color with the current color at a weight of 0.1
   when the surface still matches.

A low blend weight keeps about ten frames of history. Edges get a
stricter test: the normals must point the same way and the hit distance
must not jump by more than twenty percent.

## History clamping

Before the blend, the previous color is clamped to the smallest and
largest color in the current 3 by 3 neighbourhood. This stops an old
bright highlight from smearing along a moving edge.

## What resets history

The history is dropped when the old frame no longer describes the new
image:

- A resize or resolution change.
- A view mode change.
- A change to bounces, aperture, sun size, or sky brightness.
- Turning the denoiser on or off.

A camera move does not drop the history. That is the whole point: the
motion vectors carry the old image into the new view. Pixels that were
hidden or that now show a different surface fail the normal and depth
test and fall back to the current frame.

## Ping pong

Two half float textures hold the result. Each frame reads one and
writes the other, then the display samples the one that was just
written. The previous G-buffer is kept in a second storage buffer and
refreshed with a buffer copy after the temporal pass.

## Limits

- The motion test compares hit distance along the primary ray, not a
  reconstructed world position, so a very fast camera move can reject
  history that would still be valid.
- The sky does not use history. It is procedural and smooth, so a
  single sample is already clean.
- The blend weight is fixed. A future branch could adapt it to the
  per pixel variance.
- Thin geometry and fast motion can still show a short trail. The
  normal and depth test plus the colour clamp keep it small.
