struct Camera {
  invViewProj: mat4x4f,
  eye: vec3f,
  _pad: f32,
}

struct Triangle {
  v0: vec3f,
  _pad0: f32,
  v1: vec3f,
  _pad1: f32,
  v2: vec3f,
  _pad2: f32,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> triangle: Triangle;
@group(0) @binding(2) var outputTexture: texture_storage_2d<rgba8unorm, write>;

fn intersect(origin: vec3f, dir: vec3f) -> bool {
  let edge1 = triangle.v1 - triangle.v0;
  let edge2 = triangle.v2 - triangle.v0;
  let h = cross(dir, edge2);
  let a = dot(edge1, h);
  if (abs(a) < 0.000001) {
    return false;
  }
  let f = 1.0 / a;
  let s = origin - triangle.v0;
  let u = f * dot(s, h);
  if (u < 0.0 || u > 1.0) {
    return false;
  }
  let q = cross(s, edge1);
  let v = f * dot(dir, q);
  if (v < 0.0 || u + v > 1.0) {
    return false;
  }
  let t = f * dot(edge2, q);
  return t > 0.000001;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = textureDimensions(outputTexture);
  if (gid.x >= dims.x || gid.y >= dims.y) {
    return;
  }
  let uv = (vec2f(f32(gid.x) + 0.5, f32(gid.y) + 0.5) / vec2f(dims)) * 2.0 - 1.0;
  let ndc = vec4f(uv.x, -uv.y, 1.0, 1.0);
  let world = camera.invViewProj * ndc;
  let dir = normalize(world.xyz / world.w - camera.eye);
  let hit = intersect(camera.eye, dir);
  var color = vec3f(0.05, 0.08, 0.12);
  if (hit) {
    color = vec3f(0.3, 0.8, 0.5);
  }
  textureStore(outputTexture, vec2i(gid.xy), vec4f(color, 1.0));
}
