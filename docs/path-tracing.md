# Path tracing loop

Earlier the renderer did one bounce and used a few shortcuts. Now it
follows a full path: a ray keeps bouncing through the scene, collecting
light at each stop, until it hits a lamp or runs out of energy.

## The loop

For each pixel the kernel:

1. Finds the closest hit along the current ray.
2. If the ray missed, adds the sky color and stops.
3. If it hit a lamp, adds the lamp color and stops.
4. Otherwise adds the direct light at this point, then picks a new
   direction to continue, and repeats.

A throughput value carries the amount of light still worth collecting.
It starts at one and shrinks with every bounce.

## Direct light at each vertex

Every surface stop adds the light it can see directly: the sun with a
shadow ray, and each sphere light with one sampled point and a distance
limited shadow ray. This is next event estimation, done at every bounce.

## Surface types

- Diffuse: picks a cosine weighted direction and multiplies throughput
  by the base color. This is what gives color bleeding, since a red or
  gold surface tints the light that leaves it.
- Mirror: picks a GGX direction for roughness and multiplies throughput
  by the fresnel term.
- Glass: picks reflection or refraction with Schlick probability, then
  tracks whether the ray is inside the glass so it can apply absorption
  over the travel distance.

## Russian roulette

After two bounces the loop starts killing dim paths. It takes the
largest channel of the throughput, and with that probability either ends
the path or divides the throughput by the same probability. Killing dim
paths early keeps the frame fast, and the divide keeps the result
correct. The maximum depth is five bounces.

## What you should see

- Light bleeds between surfaces now. The gold gem tints the floor, and
  the cube picks up color from what it faces.
- The mirror and the glass are deeper, because light keeps bouncing
  instead of stopping after one hop.
- Sharpness builds up over time as the samples blend.

## Limits

- The sun is still a single direction with no size, so its shadow stays
  crisp. A real sun with soft shadow comes later.
- No multiple importance sampling between the light samples and the
  material bounce, so very rough surfaces can look a touch noisy.
- The maximum depth is fixed at five.
