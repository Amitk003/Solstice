# Mirror reflection on the cube

The cube now reflects its surroundings. The floor stays diffuse.

## What changed

- The hit record carries the triangle index.
- Indices below 12 belong to the cube. The rest belong to the floor.
- Cube pixels trace a mirror ray and shade what it hits.
- A fresnel blend keeps facing angles diffuse and turns grazing angles
  into strong reflections.
- Reflection only runs when the bounce toggle is on.

## What you should see

- The cube shows the floor and sky in its faces.
- Edges at grazing angles look more mirror like.
- Turning the toggle off removes both bounce and reflection.
