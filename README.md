# Solstice

Real-time path tracing in your browser.

Solstice is a physically based path tracer that runs entirely in the browser.
It uses WebGPU compute shaders, GPU-built bounding volume hierarchies,
SVGF denoising, and modern PBR materials. No plugins. No installs. Just open
the page and look around.

## Why it feels different

- Light is simulated, not faked. Reflections, refraction, and soft shadows
  come from tracing actual rays.
- It runs on your GPU inside the browser.
- The image gets cleaner the longer you look, then stays stable as you move.

## What is inside

- WebGPU compute pipelines for ray generation, tracing, shading, and display
- GPU-built BVH (morton codes + radix sort + linear BVH) for fast tracing
- SVGF denoiser for noisy low-sample frames
- Materials: Lambert, Cook-Torrance (GGX), metal, roughness, dielectrics,
  and subsurface scattering
- Two-level acceleration: per-mesh BLAS and a top-level TLAS for instances

## Tech stack

- TypeScript
- WebGPU
- WGSL shaders
- Vite (dev server and build)
- Rust and WASM (optional, for CPU-side helpers)

## Getting started

Prerequisites: Node.js 20 or newer, a browser with WebGPU enabled.

```bash
npm install
npm run dev
```

Then open the local URL printed in the terminal.

## Project layout

```text
docs/        Documentation in plain English
public/      Static assets
src/         Application source
src/shaders/ WGSL shader files
```

## How it works (short version)

1. The scene is uploaded to the GPU as buffers.
2. A compute pass builds a BVH from the geometry.
3. A path tracing kernel shoots rays per pixel and writes radiance plus
   G-buffer data.
4. A denoiser cleans the image using temporal and spatial passes.
5. The result is tone mapped and shown on the canvas.

## Status

Active development. See the docs folder for details and progress notes.

## License

Released under the MIT license. See LICENSE for the full text.
