struct Camera {
  invViewProj: mat4x4f,
  eye: vec3f,
  _pad: f32,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;

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
  let color = dir * 0.5 + 0.5;
  textureStore(outputTexture, vec2i(gid.xy), vec4f(color, 1.0));
}
