# Adapter info

The HUD shows the WebGPU adapter name next to the frame stats.

## Why

The adapter tells you which GPU the renderer is using. It helps when
you compare frame rates across machines or report a problem. A slow
software renderer shows up here before you check the frame time.

## How it works

`initWebGpu` reads the adapter info after `requestAdapter` succeeds.
It joins the vendor, architecture, device, and description fields.
If all of them are empty, it falls back to `WebGPU adapter`.

## Limits

- The name is only a label. It does not change the renderer.
- Some browsers hide most fields for privacy. The fallback label is
  shown then.
