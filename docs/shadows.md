# Floor and shadows

The scene now has a floor plane under the cube. Hit points cast a shadow
ray toward the light.

## What changed

- A large floor quad sits below the cube.
- Floor triangles face up so lighting works.
- A new occlusion test walks the BVH for shadow rays.
- Diffuse light is removed when the shadow ray hits anything.

## What you should see

- The cube sits above a lit floor.
- One side of the floor is darker where the cube blocks the light.
- Orbit still works. Shadows stay in place as you move.
