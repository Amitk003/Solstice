# Exposure control

The display pass scales the HDR image before tone mapping. The scale was
fixed at 1.2. Now it is a uniform value that the panel can change.

## How it works

The blit shader reads an `exposure` value from a small uniform buffer
and applies it before the ACES curve:

```text
mapped = aces(hdr * exposure)
```

The slider in the panel ranges from 0.1 to 4.0 and defaults to 1.2, so
the look matches the older fixed value.

## What it changes

Exposure only touches the tone map. It does not change the traced
radiance, the accumulated samples, or the denoiser. Moving the slider
does not reset the sample count, and the saved PNG export uses the same
exposure as the screen.

## What you should see

- Lower exposure darkens the image without losing highlight detail.
- Higher exposure lifts shadows and blows small highlights to white
  through ACES.

## Limits

- One exposure value for the whole image. There is no per channel
  balance or white point control.
- The tone mapper is a choice of ACES, Reinhard, or linear. See
  `docs/tonemapper-choice.md`.
