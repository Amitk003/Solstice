# Subsurface scattering

Subsurface scattering makes a surface look like wax or skin. Light enters
the surface, spreads a little, and leaves from a wider area. The light
also passes through thin parts, so backlit areas glow.

This build uses a shading approximation. It is not a full volumetric
random walk yet. The approximation has two parts.

## Part one: wrapped diffuse light

A normal diffuse surface uses `dot(n, light)`. The term drops to zero at
the terminator, so the shadow edge is hard. A subsurface surface uses a
wrapped cosine:

```text
wrapped = max((dot(n, light) + wrap) / (1 + wrap), 0)
```

`wrap` comes from the material `subsurface` value. With a wrap around 0.5
the light spills past the terminator and the object looks soft and waxy.

## Part two: backlight transmission

When the light is behind the surface, the normal shadow ray hits the
object itself and the surface goes dark. The approximation adds a second
term for light that passes through:

```text
back = max((-dot(n, light) + wrap) / (1 + wrap), 0) * translucency
```

The transmission term skips the shadow ray, because that ray would always
hit the object. It is scaled by `translucency`, which also comes from the
material `subsurface` value. The result is a warm glow on the far side of
the object.

## Material fields

`Material` in `src/scene/materials.ts` has a `subsurface` value from 0 to
1. Existing materials use 0. The new `MAT_WAX` material uses 1.

The values are packed into the material storage buffer at float slot 10.
The struct in `src/shaders/bvh.wgsl` reads the same slot.

## The wax sphere

`makeTriangles` adds one sphere with `MAT_WAX` at `[-0.6, -1.1, 1.5]` with
radius 0.4. It rests on the floor in front of the cube. It uses a warm
cream base colour.

## Limits

- This is a surface approximation, not a volumetric random walk. It does
  not model a scattering distance inside the object.
- The transmission term ignores occlusion by other objects. It assumes
  the light reaches the back of the surface.
- Thick and thin parts of an object do not look different yet. A real
  random walk would use the distance traveled inside the medium.
- The bounce after a subsurface hit is a normal cosine hemisphere bounce.
