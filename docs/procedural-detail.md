# Procedural detail normals

Large flat surfaces used to shade with one constant normal. That made
the floor look smooth like glass. The shading normal is now bent by a
procedural tangent space normal map, so a flat surface gets visible
texture without any texture file.

## How it works

Each material has a `detail` strength. The shader builds a tangent
frame from the surface normal, samples the normal map with world
space planar coordinates, and bends the normal in the tangent plane:

```text
n = normalize(n + (tangent * mapN.x + bitangent * mapN.y) * detail)
```

The floor uses a strength of 0.35. Every other material uses 0, so
their normals stay exactly as authored.

The same bend is applied in the path trace and in the G-buffer write,
so the denoiser edge guide sees the same normal as the shading.

## Material field

`detail` lives in the last slot of the 48 byte material layout. The
CPU writes it as float bits, the shader reads it with a bitcast.
Raising the floor strength makes the normal map stronger. Setting it
to 0 restores the flat normal.

## Limits

- The map is procedural and world projected. There is no authored
  texture and no UV unwrap. See `docs/normal-map.md`.
- Mirrors and glass use 0 detail, because a bent normal would break
  their reflections.
