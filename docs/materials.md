# Materials and emissive lamp

Triangles now carry a material id. The shader picks shading by id
instead of by triangle number ranges.

## Ids

- 0: diffuse (floor)
- 1: mirror (cube)
- 2: glass (sphere)
- 3: emissive (lamp)

## What changed

- The triangle buffer stores one id per triangle.
- The hit record carries the id to the shading code.
- A small bright sphere floats above the scene as a lamp.
- Primary, bounce, reflection, and refraction rays all show the lamp
  as bright emissive color.
- The lamp also blocks shadow rays like any solid object.

## What you should see

- A glowing ball above the scene.
- Its bright spot in the cube mirror and through the glass sphere.
- Bounce light near the lamp picks up brightness over time.

## Limits

- The lamp is emissive only. It does not yet cast sampled light.
  Real area light sampling comes later.
