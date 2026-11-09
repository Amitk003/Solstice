# Vignette toggle

The display pass can darken the image edges. The effect is off by
default.

## How it works

The blit shader measures the distance from the screen center. Past
35 percent of the half diagonal, the tone-mapped color falls to zero
at 75 percent. The checkbox sets the vignette strength to 1 when on
and 0 when off.

## Why

The falloff draws attention to the center and hides some harsh edge
noise. It is a display effect only. The traced radiance, samples, and
exported HDR data do not change.

## Panel

- Unchecked: no vignette. This is the default.
- Checked: edges darken smoothly toward black.

## Limits

- The shape is fixed. There is no strength or shape slider.
- The saved PNG uses the same vignette as the screen.
