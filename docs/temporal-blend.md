# Temporal blend

The Temporal blend slider controls how much of the current frame
replaces the reprojected history. It ranges from 0.01 to 1 and
defaults to 0.1.

## How it works

The temporal shader blends the reprojected history and the current
frame by this value. Low values keep more history, so the image stays
calmer while the camera moves. High values trust the current frame
more, so the image responds faster but can look noisier.

## Behavior

Changing the slider restarts the sample count and temporal history,
because the blending rule changes.

## Limits

- The slider does not change the motion vectors or the
  disocclusion test.
- Very high values can cause flicker in noisy areas.
