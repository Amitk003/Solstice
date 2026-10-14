# Camera and ray generation

The camera is built on the CPU and uploaded as a uniform buffer each frame.

## What the buffer holds

- An inverse view-projection matrix
- The camera eye position

## Ray generation kernel

For each pixel the kernel:
1. Builds a normalized device coordinate from the pixel center.
2. Multiplies by the inverse view-projection matrix.
3. Computes the world-space ray direction from the camera eye.

The result is written to a storage texture for display. Later it will feed
the full path tracer.
