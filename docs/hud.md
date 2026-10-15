# Status and quality toggle

The page now shows live render info and lets you lower the cost.

## What changed

- The status line shows sample count and fps.
- A checkbox toggles the indirect bounce.
- Turning it off uses a cheap direct plus sky fill path.
- A selector sets render scale to 50, 75, or 100 percent.
- Lower scale renders fewer pixels. The canvas still fills the window.
- Toggling either option resets accumulation so the image restarts clean.

## Why this helps

Weak GPUs can preview fast at low scale with the bounce off, then turn
both up for final quality. The sample count also shows when the image
has converged.
