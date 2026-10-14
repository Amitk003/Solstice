# Multiple triangles

The kernel now loops over a storage buffer of triangles.

## Why a loop

Before a BVH is ready, a simple loop proves that:
- storage buffers can feed many primitives
- per-pixel intersection logic scales past one triangle
- count uniforms control how much work is done

## Next steps

- Split vertex data into a proper mesh buffer
- Sort triangles with a BVH
- Replace the loop with traversal
