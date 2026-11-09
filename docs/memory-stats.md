# Memory stats

The status line shows an estimate of GPU memory for the main frame
resources. It updates when the canvas is resized.

## How the estimate is calculated

Six `rgba16float` textures use 48 bytes per pixel, and the
accumulation, G-buffer, history, and moments buffers use 56 bytes per
pixel. That is 104 bytes per pixel. The 1024 by 512 environment map
adds 4 MB. The result is shown as a rounded megabyte value.

## What you should see

At 1920 by 1080, the estimate is about 210 MB. Lowering the scale in
the panel drops the number because the per pixel resources shrink.

## Limits

- This is an estimate, not a driver reported allocation size. It does
  not include static scene buffers, small uniform buffers, canvas
  swaps, or driver overhead.
- It only changes on resize. Other settings do not add or remove these
  resources.
