# Image export

The render can be saved as a PNG file. Press the Save PNG button in the
panel and the browser downloads the current frame.

## How it works

- The display pass already tone maps the HDR image and draws it to the
  canvas. The same pass draws into an offscreen texture instead.
- That texture is copied into a GPU buffer and read back to the CPU.
- The bytes are turned into image pixels and encoded as a PNG.
- The PNG is downloaded with a timestamp name, for example
  `solstice-1700000000000.png`.

## Why not read the canvas directly

A WebGPU canvas does not always return its pixels through `toDataURL` or
`toBlob`. Some browsers hand back an empty or black image. Drawing into
our own texture and reading that buffer works the same way everywhere.

## Notes

- The capture uses the current render scale, so a 50 percent scale saves
  a smaller image.
- The capture is taken from the current accumulation, not a new render.
  Wait for the sample count to settle if you want the cleanest frame.
- The button is disabled while a capture is in flight so two captures
  cannot overlap.
- Row padding is handled. GPU copies need rows aligned to 256 bytes, so
  the readback strips the padding before building the image.
- The canvas format can be BGRA or RGBA. The code swaps red and blue when
  the format is BGRA.

## Limits

- Only PNG is supported. No JPEG or EXR.
- The image is 8 bits per channel after tone mapping. The HDR buffer is
  not saved.
- Very large windows take a moment to read back and encode.
