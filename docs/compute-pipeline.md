# Compute pipeline

This project uses a compute-first rendering path.

## Steps per frame

1. Run a compute kernel that writes to a storage texture.
2. Run a render pass that samples that texture onto the canvas.

## Why this split

- Compute passes can do heavy math without render limits.
- Render passes handle hardware raster and display.

## Current example

The first kernel writes a simple color gradient.
Later kernels will trace rays, write radiance, and fill G-buffers.

## Resize

Textures are rebuilt on resize so their size always matches the canvas.
Bind groups are rebuilt with the new texture.
