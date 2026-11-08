# Subsurface scattering

Subsurface scattering makes a surface look like wax or skin. Light enters
the surface, spreads a little, and leaves from a wider area. The light
also passes through thin parts, so backlit areas glow.

This build has two layers: a wrapped direct term, and a volumetric
random walk that carries the transmitted light.

## Part one: wrapped diffuse light

A normal diffuse surface uses `dot(n, light)`. The term drops to zero at
the terminator, so the shadow edge is hard. A subsurface surface uses a
wrapped cosine:

```text
wrapped = max((dot(n, light) + wrap) / (1 + wrap), 0)
```

`wrap` comes from the material `subsurface` value. With a wrap around 0.5
the light spills past the terminator and the object looks soft and waxy.

## Part two: the volume random walk

After the direct light, the path does not bounce off the wax. It walks
through it:

- The path refracts into the material with the index of refraction.
- An interior ray finds the far side through the BVH.
- The segment attenuates with Beer-Lambert, `exp(-absorption * distance)`.
  The wax absorption is warm, so red light survives the trip and blue
  light dies quickly.
- At the far side the path either exits with a cosine hemisphere
  direction (60 percent chance) or scatters isotropically and walks
  again. After four interior steps the walk always exits.

The exit point becomes the new path vertex, so the transmitted light
gathers direct light and sky light like any other bounce. Thin parts of
the object transmit more, because the path crosses less wax.

When the bounce toggle is off, the preview uses a simple backlight glow
instead of the walk. That keeps the single bounce preview readable.

## Material fields

`Material` in `src/scene/materials.ts` has a `subsurface` value from 0 to
1. Existing materials use 0. The `MAT_WAX` material uses 1.

- `subsurface` drives the wrap for wrapped light.
- `ior` refracts the path into the wax.
- `absorption` attenuates each interior segment. Red is lowest, blue is
  highest, so the glow is warm.

The values are packed into the material storage buffer at float slot 10
and the absorption slots. The struct in `src/shaders/bvh.wgsl` reads the
same layout.

## The wax sphere

`makeTriangles` adds one sphere with `MAT_WAX` at `[-0.6, -1.1, 1.5]` with
radius 0.4. It rests on the floor in front of the cube. It uses a warm
cream base colour.

## Limits

- The walk is Monte Carlo, so a single frame is noisy. The accumulation
  and the denoiser average it over time.
- The walk does not model a scattering albedo inside the medium. The
  attenuation is absorption only.
- The exit test is a fixed 60 percent per step. A full model would use
  the distance to the surface and the scattering coefficient.
- Open or thin geometry can let the interior ray escape. The code then
  falls back to a sky sample with a fixed attenuation distance.
- The bounce after the walk can be noisy on the first frames. That is
  expected when few samples have accumulated.
