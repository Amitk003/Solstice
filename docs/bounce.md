# One stochastic bounce

Each hit point now shoots one random bounce per frame and gathers light
from where it lands. Frames blend into the running average.

## What changed

- The closest hit test is shared between primary and bounce rays.
- A cosine weighted sampler picks a hemisphere direction per pixel.
- The random input changes per frame, so noise converges over time.
- Bounce hits reuse direct sun plus shadow. Misses use sky color.
- The old fixed occlusion helper is still present but no longer used.

Note: this one bounce step was later replaced by the full path loop in
docs/path-tracing.md.

## What you should see

- Hold still and the image starts grainy, then settles.
- Corners and floor contact look softer than hard shadow alone.
- Dragging restarts from frame 0, so motion looks grainy for a moment.
