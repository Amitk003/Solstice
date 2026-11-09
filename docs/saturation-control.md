# Saturation control

The Saturation slider scales color around luminance in the display
pass. It ranges from 0 to 2 and defaults to 1.

## How it works

After tone mapping, the shader blends each color toward its
luminance by the saturation value:

```text
mapped = mix(vec3(luminance), mapped, saturation)
```

Zero gives grayscale. One keeps the colors. Values above one make
the colors more vivid.

## Behavior

The slider only touches the display pass. It does not change the
traced radiance, the samples, or the temporal history. The saved PNG
export uses the same value as the screen.

## Limits

- The control is one number for all channels. There is no per
  channel color balance.
- Contrast is a separate display slider. See
  `docs/contrast-control.md`.
