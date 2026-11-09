# Dynamic resolution

The Scale control has an Auto option. It picks a render resolution
that keeps the frame rate near 60.

## How it works

Auto starts at 100 percent. If the smoothed frame rate stays below
42, it steps down to 75 percent, then to 50 percent. If the frame
rate stays above 58, it steps back up. It only changes at most once
every 1.5 seconds, so the image does not jump between sizes.

## Behavior

A size change recreates the frame textures and buffers, so it
restarts the sample count and drops temporal history for one frame.
That is the cost of matching the frame rate. The HUD resolution and
memory estimate update with the new size.

## Limits

- Only three steps exist: 50, 75, and 100 percent.
- The frame rate is smoothed, so scene changes take a moment to
  trigger a step.
