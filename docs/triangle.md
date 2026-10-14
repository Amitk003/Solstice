# Triangle intersection

Each pixel casts a ray from the camera. The compute shader tests that ray
against a single triangle using the Moeller-Trumbore algorithm.

## Why start with one triangle

It proves the end to end path:
- camera to ray
- ray to geometry
- hit result to pixel color

Once this is stable, the same idea scales to a BVH and many triangles.

## Next steps

- Add more primitives.
- Store them in buffers.
- Replace linear testing with a BVH traversal.
