# Overview

Solstice is a real-time path tracer that runs in the browser using WebGPU.
It is written in TypeScript and WGSL. The goal is a clean and correct
codebase that shows how a modern renderer is built from scratch.

## What a path tracer does

A path tracer simulates light by sending rays from the camera into the
scene. Each ray bounces and gathers color. With enough samples the image
looks real. With one sample it looks noisy. We use a denoiser to make
one sample look good.

## Main parts

- WebGPU device and canvas setup
- BVH acceleration for fast ray queries
- Path tracing compute kernel
- Materials and lighting
- SVGF denoiser
- Display and tone mapping

## Where things live

- src/ : application code
- src/webgpu/ : WebGPU bootstrap and helpers
- src/shaders/ : WGSL shader files
- docs/ : documentation
- public/ : static files
