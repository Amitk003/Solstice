# Browser support

Solstice needs WebGPU. If the browser cannot provide it, the app
shows a message instead of a blank canvas.

## Requirements

- A browser with WebGPU enabled. Current Chromium browsers and
  Safari with WebGPU are the main targets.
- A secure context. HTTPS or localhost counts as secure. Opening the
  files from a plain HTTP address on a local network address does
  not.
- Hardware acceleration for WebGPU. A browser can expose the WebGPU
  API but still fail to create a GPU adapter.

## What happens when it is missing

The status line explains the problem in plain language:

- WebGPU is missing.
- The page is not in a secure context.
- The browser has only a partial WebGPU implementation.

No renderer is created in those cases.

## Limits

- The check cannot fix a missing GPU or disabled hardware
  acceleration. It only reports the problem.
- Safari and Firefox WebGPU support changes over time. The message
  may still appear in older versions.
