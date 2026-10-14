@group(0) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = textureDimensions(outputTexture);
  if (gid.x >= dims.x || gid.y >= dims.y) {
    return;
  }
  let uv = vec2f(f32(gid.x) / f32(dims.x), f32(gid.y) / f32(dims.y));
  let color = vec4f(uv.x, uv.y, 0.25, 1.0);
  textureStore(outputTexture, vec2i(gid.xy), color);
}
