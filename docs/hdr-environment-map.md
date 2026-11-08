# HDR environment map

The background is now a small HDR image instead of an analytic sky and
glow. The image is generated in code, so no image file is needed.

## How it is built

`src/scene/envMap.ts` paints a 1024 by 512 equirectangular float image:

- A ground below the horizon and a sky gradient above it.
- A bright sun disk at the same direction as the direct sun light, so
  the background lines up with the sun and its shadow.
- Two soft window discs. They give the mirror and glass something
  bright to reflect besides the sun.

Values above 1.0 are kept, up to about 18 in the sun disk. The CPU
converts the float data to half float bits and uploads it once to a
rgba16float texture. The map is static, so it is never resized.

## How it is used

The trace shader looks up the map by ray direction for every miss
(`src/shaders/bvh.wgsl`, `skyColor`). That means the background, the
indirect sky light, and mirror and glass reflections all share the
same environment. The Sky slider still scales the whole map.

Direct diffuse light still comes from the sphere lamps and the sun
shadow ray. The map is background and indirect light, not a second
set of direct lamps.

## Limits

- No image-based direct lighting for diffuse surfaces yet.
- The map is procedural. There is no file loader for real photos.
- The sun in the map is a visual disk. Shadows come from the sun ray.
- Window discs are round, not rectangular room windows.
