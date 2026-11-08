# HUD profiling

The status line now shows more than samples and frames per second.
It shows the frame time in milliseconds and the render resolution.

## Readout

```text
Solstice | shaded | samples 256 | 60 fps | 16.7 ms | 1920x1080 | bvh gpu | drag to orbit
```

The frame time is the smoothed inverse of the measured frames per
second. The resolution is the drawing buffer size after the scale
multiplier and the device pixel ratio.

## Helpful links

- High milliseconds with a low sample count means the trace is
  expensive.
- A falling sample count after a resize is the accumulation restart.
- Lowering the scale in the panel drops both milliseconds and
  resolution.

## Limits

- The time is CPU side. It covers the frame loop and the submit, not
  the GPU time of each pass.
- GPU timestamps per pass are not wired up yet.
