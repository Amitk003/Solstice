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

@group(0) @binding(0) var tex: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;

fn aces(x: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0), vec3f(1.0));
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let hdr = textureSample(tex, samp, in.uv).rgb;
  let mapped = aces(hdr * 1.2);
  let gamma = pow(mapped, vec3f(1.0 / 2.2));
  return vec4f(gamma, 1.0);
}
