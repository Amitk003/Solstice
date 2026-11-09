# Contrast control

The Contrast slider scales the tone mapped color around mid gray.
It ranges from 0.5 to 1.5 and defaults to 1.

## How it works

After tone mapping and saturation, the shader scales the color
around 0.18:

```text
mapped = (mapped - 0.18) * contrast + 0.18
```

Values below 1 make the image flatter. Values above 1 make the
shadows darker and the highlights stronger.

## Behavior

The slider only touches the display pass. It does not change the
traced radiance, the samples, or the temporal history. The saved PNG
export uses the same value as the screen.

## Limits

- One contrast value for all channels. There is no per channel
  color balance.
- Temperature is a separate display slider. See
  `docs/display-temperature.md`.
