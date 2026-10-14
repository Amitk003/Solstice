# Shading basics

Hit points now use their triangle normal for simple diffuse shading.

## What changed

- The camera uniform carries a light direction.
- The kernel computes a triangle normal.
- Missed rays show a simple sky gradient.

## Why this step helps

It turns pure intersection tests into readable images. Lighting also gives
quick visual feedback before real materials are added.
