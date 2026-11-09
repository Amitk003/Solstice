struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VsOut {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var u = array<vec2f, 3>(vec2f(0.0, 1.0), vec2f(2.0, 1.0), vec2f(0.0, -1.0));

  var out: VsOut;
  out.pos = vec4f(p[vi], 0.0, 1.0);
  out.uv = u[vi];
  return out;
}

// Display settings, padded to 32 bytes for the uniform buffer. mode
// selects the tone mapper: 0 is ACES, 1 is Reinhard, 2 is linear.
// vignette is the strength of the edge darkening, 0 is off.
// saturation scales color around luminance, 1 is full color.
// contrast scales the tone mapped color around mid gray, 1 is none.
// temperature tints the final color, 0 is cool and 1 is warm.
struct Params {
  exposure: f32,
  mode: u32,
  vignette: f32,
  saturation: f32,
  contrast: f32,
  temperature: f32,
  _pad1: f32,
  _pad2: f32,
}

@group(0) @binding(0) var tex: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var<uniform> params: Params;

fn aces(x: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0), vec3f(1.0));
}

fn reinhard(x: vec3f) -> vec3f {
  return clamp(x / (vec3f(1.0) + x), vec3f(0.0), vec3f(1.0));
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let hdr = textureSample(tex, samp, in.uv).rgb;
  let scaled = hdr * params.exposure;
  var mapped: vec3f;
  if (params.mode == 1u) {
    mapped = reinhard(scaled);
  } else if (params.mode == 2u) {
    mapped = clamp(scaled, vec3f(0.0), vec3f(1.0));
  } else {
    mapped = aces(scaled);
  }
  let luminance = dot(mapped, vec3f(0.2126, 0.7152, 0.0722));
  mapped = mix(vec3f(luminance), mapped, clamp(params.saturation, 0.0, 2.0));
  let mid = vec3f(0.18);
  mapped = (mapped - mid) * clamp(params.contrast, 0.5, 1.5) + mid;
  let cool = vec3f(0.85, 0.92, 1.0);
  let warm = vec3f(1.05, 0.9, 0.7);
  mapped = mapped * mix(cool, warm, clamp(params.temperature, 0.0, 1.0));
  let dist = distance(in.uv, vec2f(0.5, 0.5));
  let vig = 1.0 - smoothstep(0.35, 0.75, dist);
  mapped = mapped * mix(1.0, vig, clamp(params.vignette, 0.0, 1.0));
  let gamma = pow(mapped, vec3f(1.0 / 2.2));
  return vec4f(gamma, 1.0);
}
