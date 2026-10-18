# Shared light buffer

The lamp used to be defined twice: once in the scene code for the mesh,
and once again in the shader as constants. If the two ever drifted, the
glow and the light would not line up. Now there is one definition and
one buffer.

## What changed

- A new file `src/scene/lights.ts` holds the lamp position, radius, and
  color.
- The lamp sphere geometry is built from that same definition.
- The CPU packs the lights into a storage buffer.
- The shader reads the lamp from that buffer instead of constants.
- The kernel bind group has a new binding (6) for the light buffer.

## Layout

Each light is 32 bytes:

- position: 3 floats
- radius: 1 float
- color: 3 floats
- pad: 1 float

The padding keeps the color aligned to 16 bytes, which is what the
storage buffer rules want.

## Why it matters

- One source of truth. Change the light in one place and the mesh and
  the lighting both follow.
- It opens the door to more lights without hard coded constants.

## Limits

- The sun (directional light) still lives in the camera uniforms. Moving
  it into the light buffer comes later if we want one light list.
