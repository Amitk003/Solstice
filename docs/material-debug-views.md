# Material debug views

Keys 5 and 6 show two material properties without lighting.

## Views

- Key 5: roughness as gray. Darker means a sharper mirror. Lighter
  means a rougher surface.
- Key 6: emission as color. Only lamps glow. Other materials are
  black.

## Why

Roughness is hard to read in the shaded image, especially after the
soft panel light. This view checks mirror, glass, wax, and gem
values at a glance. The emission view checks that the lamp and fill
materials still carry the right color and strength.

## Limits

- These are display debug views. They do not change the shaded path.
- Sky stays black in both modes.
