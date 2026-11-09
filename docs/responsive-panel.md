# Responsive panel

The control panel used to grow in one long line. On a small screen it
ran off the edge. It now wraps controls into rows.

## How it works

The panel is a flex container with wrapping enabled. Controls move to
the next row when they run out of horizontal space. The status line
also wraps instead of overflowing.

## On small screens

At widths of 640 pixels or less:

- The panel and status shrink to use the screen edge.
- Both use 12 pixel text.
- Sliders do not grow wider than 35 percent of the viewport.

The panel scrolls inside its own box if there are too many rows for
the available height.

## Limits

- The control set and order are unchanged. This is layout only.
- The status line can take two lines on narrow screens.
