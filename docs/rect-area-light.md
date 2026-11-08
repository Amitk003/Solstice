# Rectangular area light

The warm key lamp was a small sphere. Its light came from a point
sampled on the sphere surface, so shadows had a round, small blur.
The key lamp is now a horizontal rectangle that faces down.

## Shape

The light has a kind, a center position, and half extents. The panel
is 1.8 units wide and 1.1 units deep. A visible emissive quad in the
scene matches those bounds, so the mesh and the light never drift
apart.

The cool fill lamp is still a sphere. It samples points on a sphere
surface with the same area light estimator.

## Sampling

For each light the shader draws one point on the shape and computes
the same single-sample estimate for both shapes:

```text
contribution = albedo / pi * color * cosSurface * area * cosLight / dist^2
```

A shadow ray rejects occluded samples. The larger area of the panel
makes the key shadow softer and more even across the cube and floor.
That is why the panel color is lower than the old sphere lamp.

## Layout

Each light in the storage buffer is 48 bytes: position, radius,
color, kind, half extents, and padding. The kind field selects the
shape. The sphere radius is only used for sphere lights.

## Limits

- Rectangles are horizontal and face down. There is no tilt or
  rotation yet.
- The visible panel is one flat quad. It has no thickness or housing.
- Each light still uses one sample per bounce. Very large panels can
  be noisier, and the denoiser covers that.
