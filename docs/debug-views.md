# Debug views

Number keys switch what the canvas shows. This helps check geometry
without lighting in the way.

## Keys

- 1: shaded image (default)
- 2: world normals as color
- 3: depth as gray (near is bright)

## What changed

- The quality flags now carry a view mode in bits 1 and 2.
- The trace kernel outputs normal or depth color for those modes.
- Switching modes resets accumulation.
- The status line names the active mode.

## Notes

- Debug colors still pass through tone mapping, so they look a little
  shifted. Shape and edges are what matter here.
- Missed rays stay black in debug modes.
