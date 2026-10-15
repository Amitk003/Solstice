# Status and quality toggle

The page now shows live render info and lets you turn the bounce off.

## What changed

- The status line shows sample count and fps.
- A checkbox toggles the indirect bounce.
- Turning it off uses a cheap direct plus sky fill path.
- Toggling resets accumulation so the image restarts clean.

## Why this helps

Weak GPUs can preview fast with the bounce off, then turn it on for
final quality. The sample count also shows when the image has converged.
