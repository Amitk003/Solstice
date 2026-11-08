# Denoiser

A path tracer is noisy when it has only a few samples per pixel. The
renderer already averages frames over time. This branch adds an edge
aware filter on top, so the early frames look clean too.

## What the trace pass stores

For every pixel the trace pass keeps:

- The normal and hit distance of the primary ray. A miss stores zero.
- A running mean of luminance.
- A running mean of squared luminance.

The two luminance values give a variance estimate per pixel. More noise
means a larger variance, and the filter then trusts its neighbours more.

## The filter

The filter is an a-trous wavelet filter. It runs three times with step
sizes 1, 2, and 4. Each run looks at a 5 by 5 neighbourhood spaced by
the step size, using the 1 4 6 4 1 spline weights.

A neighbour is trusted based on three things:

- Normal similarity. The dot product of the two normals, raised to a
  power. Sky and geometry are never mixed.
- Relative depth. Surfaces far apart in depth get a small weight.
- Luminance similarity. The allowed difference is scaled by the pixel
  variance, so noisy pixels smooth more and clean pixels smooth less.

The three runs ping pong between two textures. The last run writes the
texture the display samples.

## Why there is no reprojection

SVGF normally projects the previous frame through motion vectors so the
history follows moving pixels. Here the camera resets the sample count
when it moves, so the history is only valid while the camera is still.
That makes the running average the temporal part, with no motion
vectors and no history clamping needed.

## Toggle

The panel has a Denoise checkbox. Turn it off to see the raw
accumulated image. Turn it on to compare. The setting does not reset
the accumulated samples.

## Limits

- No motion vectors or history reprojection.
- No albedo or specular demodulation. The filter works on full radiance.
- One thread per pixel with 25 taps per pass. Very high resolutions can
  cost a few milliseconds. Turn the toggle off if you need the speed.
- The edge guide uses normal, depth, and luminance variance only.
- The filter can soften very small bright details, such as thin
  highlights on the gem, if the variance is high.
