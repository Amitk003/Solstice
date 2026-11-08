// Edge aware a-trous filter. Runs three times with growing step sizes so
// the filter reaches far while still respecting edges. The G buffer and
// the luminance variance decide how much each neighbour is trusted.

struct Params {
  step: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
}

@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(2) var<storage, read> gbuffer: array<vec4f>;
@group(0) @binding(3) var<storage, read> moments: array<vec2f>;
@group(0) @binding(4) var<uniform> params: Params;

fn luminance(color: vec3f) -> f32 {
  return dot(color, vec3f(0.2126, 0.7152, 0.0722));
}

// Five tap B3 spline weights: 1 4 6 4 1.
fn kernelWeight(index: i32) -> f32 {
  var weights = array<f32, 5>(1.0, 4.0, 6.0, 4.0, 1.0);
  return weights[index + 2];
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = textureDimensions(inputTex);
  if (gid.x >= dims.x || gid.y >= dims.y) {
    return;
  }

  let coord = vec2i(gid.xy);
  let idx = gid.y * dims.x + gid.x;

  let center = textureLoad(inputTex, coord, 0);
  let centerLum = luminance(center.rgb);
  let centerGeo = gbuffer[idx];
  let centerNormal = centerGeo.xyz;
  let centerDepth = centerGeo.w;

  // Variance from the running luminance moments. More noise lets more
  // neighbours through.
  let variance = max(moments[idx].y - moments[idx].x * moments[idx].x, 0.0);
  let sigma = sqrt(variance);
  let lumScale = 4.0 * sigma + 0.02;

  let stepSize = i32(params.step);
  var sum = vec3f(0.0);
  var weightSum = 0.0;

  for (var oy = -2; oy <= 2; oy = oy + 1) {
    for (var ox = -2; ox <= 2; ox = ox + 1) {
      let sx = clamp(coord.x + ox * stepSize, 0, i32(dims.x) - 1);
      let sy = clamp(coord.y + oy * stepSize, 0, i32(dims.y) - 1);
      let sampleCoord = vec2i(sx, sy);
      let sampleIdx = u32(sy) * dims.x + u32(sx);
      let sampleColor = textureLoad(inputTex, sampleCoord, 0).rgb;
      let sampleGeo = gbuffer[sampleIdx];

      // Normal similarity. Do not cross between sky and geometry.
      var normalWeight = 1.0;
      if (centerDepth > 0.0 && sampleGeo.w > 0.0) {
        normalWeight = pow(max(dot(centerNormal, sampleGeo.xyz), 0.0), 16.0);
      } else if (centerDepth > 0.0 || sampleGeo.w > 0.0) {
        normalWeight = 0.0;
      }

      // Relative depth similarity.
      let depthDelta = abs(centerDepth - sampleGeo.w) / max(centerDepth, 0.05);
      let depthWeight = exp(-depthDelta * 12.0);

      // Luminance similarity, scaled by the pixel variance.
      let lumWeight = exp(-abs(centerLum - luminance(sampleColor)) / lumScale);

      let weight =
        normalWeight * depthWeight * lumWeight * kernelWeight(ox) * kernelWeight(oy);
      sum = sum + sampleColor * weight;
      weightSum = weightSum + weight;
    }
  }

  let filtered = sum / max(weightSum, 0.0001);
  textureStore(outputTex, coord, vec4f(filtered, 1.0));
}
