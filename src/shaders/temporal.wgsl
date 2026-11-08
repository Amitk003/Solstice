// Temporal reprojection after the a-trous chain. The trace pass writes a
// previous frame UV for every primary hit, and this pass blends the current
// frame with the color that hit had in the previous image. History is only
// reused when the surface normal and hit distance still agree.
struct Params {
  historyValid: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
}

@group(0) @binding(0) var currentTex: texture_2d<f32>;
@group(0) @binding(1) var historyTex: texture_2d<f32>;
@group(0) @binding(2) var motionTex: texture_2d<f32>;
@group(0) @binding(3) var<storage, read> currentGbuffer: array<vec4f>;
@group(0) @binding(4) var<storage, read> historyGbuffer: array<vec4f>;
@group(0) @binding(5) var outTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(6) var<uniform> params: Params;

// A low weight keeps roughly the last ten frames, which is enough to smooth
// the one sample per frame input the denoiser sees while the camera moves.
const BLEND_WEIGHT = 0.1;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = textureDimensions(currentTex);
  if (gid.x >= dims.x || gid.y >= dims.y) {
    return;
  }

  let coord = vec2i(gid.xy);
  let idx = gid.y * dims.x + gid.x;
  let current = textureLoad(currentTex, coord, 0);
  var result = current;

  if (params.historyValid != 0u) {
    let motion = textureLoad(motionTex, coord, 0);
    if (motion.z > 0.5) {
      let prevCoord = vec2i(motion.xy * vec2f(f32(dims.x), f32(dims.y)));
      if (
        prevCoord.x >= 0 &&
        prevCoord.y >= 0 &&
        prevCoord.x < i32(dims.x) &&
        prevCoord.y < i32(dims.y)
      ) {
        let prevIdx = u32(prevCoord.y) * dims.x + u32(prevCoord.x);
        let currGeo = currentGbuffer[idx];
        let histGeo = historyGbuffer[prevIdx];
        if (currGeo.w > 0.0 && histGeo.w > 0.0) {
          let normalOk = dot(normalize(currGeo.xyz), normalize(histGeo.xyz)) > 0.9;
          let depthDelta = abs(currGeo.w - histGeo.w) / max(currGeo.w, 0.05);
          let depthOk = depthDelta < 0.2;
          if (normalOk && depthOk) {
            // Clamp the reprojected color to the current 3x3 neighborhood so a
            // moving edge cannot drag an old highlight across the screen.
            var lo = current.rgb;
            var hi = current.rgb;
            for (var oy = -1; oy <= 1; oy = oy + 1) {
              for (var ox = -1; ox <= 1; ox = ox + 1) {
                let sx = clamp(coord.x + ox, 0, i32(dims.x) - 1);
                let sy = clamp(coord.y + oy, 0, i32(dims.y) - 1);
                let neighbor = textureLoad(currentTex, vec2i(sx, sy), 0).rgb;
                lo = min(lo, neighbor);
                hi = max(hi, neighbor);
              }
            }
            let history = textureLoad(historyTex, prevCoord, 0);
            let clamped = clamp(history.rgb, lo, hi);
            result = vec4f(mix(clamped, current.rgb, BLEND_WEIGHT), 1.0);
          }
        }
      }
    }
  }

  textureStore(outTex, coord, result);
}
