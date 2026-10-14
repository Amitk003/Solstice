# Shading basics

Hit points use their triangle normal for simple diffuse shading.

## What changed

- The camera uniform carries a light direction.
- The kernel computes a triangle normal.
- The triangle test returns a hit distance.
- The BVH walk keeps the closest hit, not the first hit.
- Each face gets a small tint from its normal so faces look different.
- Missed rays show a simple sky gradient.

## Why this step helps

Closest hit tracking keeps the front face correct when you orbit the cube.
It turns pure intersection tests into readable images. Lighting also gives
quick visual feedback before real materials are added.
