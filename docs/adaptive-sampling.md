# Adaptive sampling

Every pixel used to trace a full path on every frame, even when the
pixel stopped changing. This branch skips the path trace once a pixel
has converged.

## How it decides

The trace pass already keeps a running mean of luminance and squared
luminance per pixel. The difference between the two is the sample
variance. After 32 frames in shaded mode, pixels with a variance below
0.001 reuse their stored color instead of tracing a new path.

The primary ray still runs, so the G-buffer and the motion vector stay
current. Only the expensive multi bounce path is skipped.

## Refresh chance

A settled pixel does not freeze forever. A five percent hash chance
still traces a fresh path, so a small bias can correct itself over
time. Noisy pixels never reach the threshold and are traced every
frame.

## When it turns off

The skip never applies in the normal or depth debug modes. A camera
move resets the sample count, so no pixel skips while the camera is
moving.

## What you should see

Holding the camera still, the frame time should fall as more pixels
settle. Bright or noisy areas stay sharp, because their variance stays
high.

## Limits

- The HUD sample count is still the frame count, not the number of
  traced paths. Skipped pixels count as settled, not as new samples.
- The denoiser and temporal passes still run on every pixel, so the
  cost saving is mostly in the path trace.
- The threshold is fixed. A future branch could scale it with the
  pixel brightness or the denoiser variance.
