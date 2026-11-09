# Display temperature

The Temperature slider tints the final image from cool to warm. It
ranges from 0 to 1 and defaults to 0.5.

## How it works

After tone mapping, saturation, and contrast, the display shader
multiplies the color by an interpolated tint:

- 0: cool, near blue.
- 0.5: near neutral warm.
- 1: warm, near orange.

## Behavior

This is a display grade only. It does not change the traced
radiance, the samples, or the temporal history. The saved PNG
export uses the same value as the screen.

## Limits

- The tint is one value for the whole image. There is no per
  channel color balance.
