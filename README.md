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
- GPU-built BVH (morton codes + bitonic sort + level built tree) for fast tracing
- Edge aware a-trous denoiser guided by normals, depth, and variance, with a strength slider
- Temporal reprojection with motion vectors, history clamping, and disocclusion tests, plus a blend slider
- Procedural HDR environment map for the sky, indirect light, and reflections
- Materials: Lambert, Cook-Torrance (GGX), metal, roughness, dielectrics,
  and subsurface scattering
- One click PNG export of the tone mapped frame
- Pause and resume button for the render loop
- Exposure, saturation, and contrast sliders for the display pass, with no sample reset
- Tone mapper choice: ACES, Reinhard, or linear
- Frosted glass that blurs with its roughness value
- Debug views for normals, depth, albedo, roughness, and emission
- Auto orbit toggle for hands-free camera drift
- Reset view button for the default camera framing
- Camera preset buttons for saved views
- Camera pan with the arrow keys or WASD
- Mouse wheel zoom for the orbit camera
- Camera field of view slider
- HUD readout with frame time, resolution, memory estimate, and adapter
- Dynamic resolution that steps down when the frame rate drops
- Focus offset slider to place the depth of field plane
- Sun angle, height, warmth, and intensity sliders for daylight
- Key light slider that scales the panel light and its glow
- Fill light slider that scales the cool side light and its glow
- Vignette toggle for the display pass
- Responsive control panel that wraps on small screens
- Memory estimate in the HUD for the main frame resources
- Firefly clamp that stops single sample spikes
- Adaptive sampling that skips the path trace once a pixel converges
- Rectangular panel light for softer key shadows
- Procedural tangent space normal map for flat surfaces, no assets needed
- Normal map scale and strength sliders for world space tiling
- Alpha cutout lattice with shadows through the holes
- Two-level acceleration: per-mesh BLAS and a top-level TLAS for instances

## Tech stack

- TypeScript
- WebGPU
- WGSL shaders
- Vite (dev server and build)
- Rust and WASM (optional, for CPU-side helpers)

## Getting started

Prerequisites: Node.js 20 or newer, a browser with WebGPU enabled, and
a secure context such as localhost or HTTPS.

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
