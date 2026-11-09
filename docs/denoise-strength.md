# Denoise strength

The Denoise strength slider controls how much of the a-trous filter
reaches the screen. It ranges from 0 to 1 and defaults to 1.

## How it works

At 1, the output is the filtered image. At 0, the output is the
input image, but the filter still runs. Between those values, the
shader mixes the input and filtered colors.

## Behavior

Changing the strength drops temporal history for one frame, because
the filtered image changes. The Denoise checkbox still turns the
passes off entirely.

## Limits

- The option only scales the filter output. It does not change the
  a-trous step sizes or the edge weights.
