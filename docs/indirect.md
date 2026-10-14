# Indirect light and contact shading

Direct sun plus shadow is not enough. Corners and contact areas need
soft fill light that respects nearby geometry.

## What changed

- The sky color is shared between miss rays and fill light.
- Each hit point samples four fixed hemisphere directions.
- Blocked samples darken the ambient and sky fill.
- This is stable across frames because the sample set is fixed.

## What you should see

- The floor area under the cube is darker near contact.
- Shadowed areas still get a small sky tint.
- Orbit stays smooth. No flicker.
