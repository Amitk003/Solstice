struct Camera {
  invViewProj: mat4x4f,
  eye: vec3f,
  _pad0: f32,
  lightDir: vec3f,
  _pad1: f32,
  frame: u32,
  flags: u32,
  aperture: f32,
  focusDistance: f32,
  sunSize: f32,
  skyIntensity: f32,
  historyValid: u32,
  _pad5: f32,
  // View projection of the previous frame, used to build motion vectors.
  prevViewProj: mat4x4f,
}

struct Triangle {
  v0: vec3f,
  _pad0: f32,
  n0: vec3f,
  _pad1: f32,
  v1: vec3f,
  _pad2: f32,
  n1: vec3f,
  _pad3: f32,
  v2: vec3f,
  _pad4: f32,
  n2: vec3f,
  material: u32,
}

struct BvhNode {
  min: vec3f,
  _pad0: f32,
  max: vec3f,
  _pad1: f32,
  left: i32,
  right: i32,
  first: u32,
  count: u32,
}

// One instanced mesh transform. Keep MAX_INSTANCES in sync with
// src/scene/instances.ts.
const MAX_INSTANCES = 8u;
const KIND_CUTOUT = 5u;

struct Instance {
  inverse: mat4x4f,
  material: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
}

// Scene wide data for the two level BVH. The gem BLAS and the instance TLAS
// live inside the same node and triangle index buffers as the static BVH.
// Instances use a fixed uniform array because the trace shader already uses
// all eight storage buffers allowed by default.
struct SceneInfo {
  gemRoot: u32,
  tlasRoot: u32,
  instanceCount: u32,
  _pad0: u32,
  instances: array<Instance, MAX_INSTANCES>,
}

// Layout must match lightsStorageData in lights.ts. kind selects the
// shape: 0 is a sphere with radius, 1 is a horizontal rectangle that
// faces down with half extents halfWidth and halfDepth.
struct Light {
  position: vec3f,
  radius: f32,
  color: vec3f,
  kind: f32,
  halfWidth: f32,
  halfDepth: f32,
  _pad0: f32,
  _pad1: f32,
}

// Layout must match materialsStorageData in materials.ts. The last
// field holds detail strength as float bits in a u32, so the shader
// reads it with a bitcast.
struct Material {
  baseColor: vec3f,
  roughness: f32,
  absorption: vec3f,
  ior: f32,
  kind: u32,
  emission: f32,
  subsurface: f32,
  detail: u32,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read> triangles: array<Triangle>;
@group(0) @binding(2) var<storage, read> nodes: array<BvhNode>;
@group(0) @binding(3) var<storage, read> triIndices: array<u32>;
@group(0) @binding(4) var outputTexture: texture_storage_2d<rgba16float, write>;
@group(0) @binding(5) var<storage, read_write> accum: array<vec4f>;
@group(0) @binding(6) var<storage, read> lights: array<Light>;
@group(0) @binding(7) var<storage, read> materials: array<Material>;
// Normal.xyz plus hit distance for the primary ray. Used by the denoiser
// to keep edges sharp. Zero means the ray hit the sky.
@group(0) @binding(8) var<storage, read_write> gbuffer: array<vec4f>;
// Running mean of luminance and squared luminance per pixel. Gives the
// denoiser a variance estimate for each pixel.
@group(0) @binding(9) var<storage, read_write> moments: array<vec2f>;
// Gem BLAS root, TLAS root, and instance transforms.
@group(0) @binding(10) var<uniform> sceneInfo: SceneInfo;
// Previous frame UV for the primary hit. z is 1 when the reprojection is
// inside the previous image, otherwise 0. Sky pixels stay at 0.
@group(0) @binding(11) var motionTexture: texture_storage_2d<rgba16float, write>;
// Procedural HDR environment map. The sky color and the reflections of a
// miss both sample it, so windows and the sun show up in mirror and glass.
@group(0) @binding(12) var envMap: texture_2d<f32>;
@group(0) @binding(13) var envSampler: sampler;
// Procedural tangent space normal map. The shader builds planar world
// coordinates from the surface normal, so triangles do not need UVs.
@group(0) @binding(14) var normalMap: texture_2d<f32>;

// Direct sun color. It is separate from the camera uniforms so the
// environment map can stay in sync with the visible sun disk.
struct SunParams {
  color: vec3f,
  _pad0: f32,
}
@group(0) @binding(15) var<uniform> sunParams: SunParams;

// Alpha cutout lattice. The screen is one quad in the BVH, so the shader
// discards a hit when the world space pattern is transparent. Keeping
// the full quad in the BVH is conservative and cheap.
fn cutoutAlpha(pos: vec3f) -> f32 {
  let cell = abs(fract(vec2f(pos.x, pos.y) * 4.0) - 0.5);
  if (max(cell.x, cell.y) > 0.32) {
    return 0.0;
  }
  return 1.0;
}

fn isCutoutDiscarded(materialIndex: u32, pos: vec3f) -> bool {
  return materials[materialIndex].kind == KIND_CUTOUT && cutoutAlpha(pos) < 0.5;
}

fn intersectTriangle(origin: vec3f, dir: vec3f, tri: Triangle) -> vec3f {
  let edge1 = tri.v1 - tri.v0;
  let edge2 = tri.v2 - tri.v0;
  let h = cross(dir, edge2);
  let a = dot(edge1, h);
  if (abs(a) < 0.000001) {
    return vec3f(-1.0);
  }
  let f = 1.0 / a;
  let s = origin - tri.v0;
  let u = f * dot(s, h);
  if (u < 0.0 || u > 1.0) {
    return vec3f(-1.0);
  }
  let q = cross(s, edge1);
  let v = f * dot(dir, q);
  if (v < 0.0 || u + v > 1.0) {
    return vec3f(-1.0);
  }
  let t = f * dot(edge2, q);
  if (t <= 0.000001) {
    return vec3f(-1.0);
  }
  return vec3f(t, u, v);
}

fn intersectAabb(origin: vec3f, dir: vec3f, bmin: vec3f, bmax: vec3f) -> bool {
  let invDir = 1.0 / dir;
  let t0 = (bmin - origin) * invDir;
  let t1 = (bmax - origin) * invDir;
  let tminV = min(t0, t1);
  let tmaxV = max(t0, t1);
  let tmin = max(max(tminV.x, tminV.y), tminV.z);
  let tmax = min(min(tmaxV.x, tmaxV.y), tmaxV.z);
  return tmax >= max(tmin, 0.0);
}

fn isOccluded(origin: vec3f, dir: vec3f, maxT: f32) -> bool {
  var stack: array<u32, 64>;
  var sp = 1u;
  stack[0] = 0u;
  loop {
    if (sp == 0u) {
      break;
    }
    sp = sp - 1u;
    let ni = stack[sp];
    let node = nodes[ni];
    if (!intersectAabb(origin, dir, node.min, node.max)) {
      continue;
    }
    if (node.count > 0u) {
      var k = 0u;
      loop {
        if (k >= node.count) {
          break;
        }
        let ti = triIndices[node.first + k];
        let tri = triangles[ti];
        let shadowT = intersectTriangle(origin, dir, tri).x;
        if (shadowT > 0.0 && shadowT < maxT && !isCutoutDiscarded(tri.material, origin + dir * shadowT)) {
          return true;
        }
        k = k + 1u;
      }
    } else {
      if (node.right >= 0) {
        stack[sp] = u32(node.right);
        sp = sp + 1u;
      }
      if (node.left >= 0) {
        stack[sp] = u32(node.left);
        sp = sp + 1u;
      }
    }
  }
  return false;
}

struct Hit {
  found: bool,
  t: f32,
  normal: vec3f,
  tri: u32,
  uv: vec2f,
  material: u32,
}

fn traceClosest(origin: vec3f, dir: vec3f) -> Hit {
  var stack: array<u32, 64>;
  var sp = 1u;
  stack[0] = 0u;
  var result: Hit;
  result.found = false;
  result.t = 1000000.0;
  result.normal = vec3f(0.0, 0.0, 1.0);
  result.tri = 0u;
  result.uv = vec2f(0.0);
  result.material = 0u;
  loop {
    if (sp == 0u) {
      break;
    }
    sp = sp - 1u;
    let ni = stack[sp];
    let node = nodes[ni];
    if (!intersectAabb(origin, dir, node.min, node.max)) {
      continue;
    }
    if (node.count > 0u) {
      var k = 0u;
      loop {
        if (k >= node.count) {
          break;
        }
        let ti = triIndices[node.first + k];
        let tri = triangles[ti];
        let tuv = intersectTriangle(origin, dir, tri);
        if (tuv.x > 0.0 && tuv.x < result.t && !isCutoutDiscarded(tri.material, origin + dir * tuv.x)) {
          result.t = tuv.x;
          result.found = true;
          result.tri = ti;
          result.uv = tuv.yz;
          result.material = tri.material;
          let w = 1.0 - tuv.y - tuv.z;
          result.normal = normalize(tri.n0 * w + tri.n1 * tuv.y + tri.n2 * tuv.z);
          if (dot(result.normal, dir) > 0.0) {
            result.normal = -result.normal;
          }
        }
        k = k + 1u;
      }
    } else {
      if (node.right >= 0) {
        stack[sp] = u32(node.right);
        sp = sp + 1u;
      }
      if (node.left >= 0) {
        stack[sp] = u32(node.left);
        sp = sp + 1u;
      }
    }
  }
  return result;
}

struct BlasHit {
  found: bool,
  t: f32,
  normal: vec3f,
}

// Closest hit inside one mesh BLAS. All node and triangle indices are
// absolute, so the same shared buffers work for every mesh.
fn traceBlas(origin: vec3f, dir: vec3f, root: u32) -> BlasHit {
  var stack: array<u32, 64>;
  var sp = 1u;
  stack[0] = root;
  var result: BlasHit;
  result.found = false;
  result.t = 1000000.0;
  result.normal = vec3f(0.0, 0.0, 1.0);
  loop {
    if (sp == 0u) {
      break;
    }
    sp = sp - 1u;
    let ni = stack[sp];
    let node = nodes[ni];
    if (!intersectAabb(origin, dir, node.min, node.max)) {
      continue;
    }
    if (node.count > 0u) {
      var k = 0u;
      loop {
        if (k >= node.count) {
          break;
        }
        let ti = triIndices[node.first + k];
        let tri = triangles[ti];
        let tuv = intersectTriangle(origin, dir, tri);
        if (tuv.x > 0.0 && tuv.x < result.t) {
          result.t = tuv.x;
          result.found = true;
          let w = 1.0 - tuv.y - tuv.z;
          result.normal = normalize(tri.n0 * w + tri.n1 * tuv.y + tri.n2 * tuv.z);
        }
        k = k + 1u;
      }
    } else {
      if (node.right >= 0) {
        stack[sp] = u32(node.right);
        sp = sp + 1u;
      }
      if (node.left >= 0) {
        stack[sp] = u32(node.left);
        sp = sp + 1u;
      }
    }
  }
  return result;
}

struct InstanceHit {
  found: bool,
  t: f32,
  normal: vec3f,
  material: u32,
}

// Trace the instance TLAS. Each leaf stores one instance index. Rays are
// moved into mesh local space before the BLAS is traversed, and the hit
// normal is moved back to world space with the inverse transpose.
fn traceInstances(origin: vec3f, dir: vec3f) -> InstanceHit {
  var result: InstanceHit;
  result.found = false;
  result.t = 1000000.0;
  result.normal = vec3f(0.0, 0.0, 1.0);
  result.material = 0u;
  if (sceneInfo.instanceCount == 0u) {
    return result;
  }

  var stack: array<u32, 32>;
  var sp = 1u;
  stack[0] = sceneInfo.tlasRoot;
  loop {
    if (sp == 0u) {
      break;
    }
    sp = sp - 1u;
    let ni = stack[sp];
    let node = nodes[ni];
    if (!intersectAabb(origin, dir, node.min, node.max)) {
      continue;
    }
    if (node.count > 0u) {
      let inst = sceneInfo.instances[node.first];
      let localOrigin = (inst.inverse * vec4f(origin, 1.0)).xyz;
      let localDir = (inst.inverse * vec4f(dir, 0.0)).xyz;
      let hit = traceBlas(localOrigin, localDir, sceneInfo.gemRoot);
      if (hit.found && hit.t < result.t) {
        let basis = mat3x3f(inst.inverse[0].xyz, inst.inverse[1].xyz, inst.inverse[2].xyz);
        var worldNormal = normalize(transpose(basis) * hit.normal);
        if (dot(worldNormal, dir) > 0.0) {
          worldNormal = -worldNormal;
        }
        result.found = true;
        result.t = hit.t;
        result.normal = worldNormal;
        result.material = inst.material;
      }
    } else {
      if (node.right >= 0) {
        stack[sp] = u32(node.right);
        sp = sp + 1u;
      }
      if (node.left >= 0) {
        stack[sp] = u32(node.left);
        sp = sp + 1u;
      }
    }
  }
  return result;
}

fn isOccludedBlas(origin: vec3f, dir: vec3f, root: u32, maxT: f32) -> bool {
  var stack: array<u32, 64>;
  var sp = 1u;
  stack[0] = root;
  loop {
    if (sp == 0u) {
      break;
    }
    sp = sp - 1u;
    let ni = stack[sp];
    let node = nodes[ni];
    if (!intersectAabb(origin, dir, node.min, node.max)) {
      continue;
    }
    if (node.count > 0u) {
      var k = 0u;
      loop {
        if (k >= node.count) {
          break;
        }
        let ti = triIndices[node.first + k];
        let shadowT = intersectTriangle(origin, dir, triangles[ti]).x;
        if (shadowT > 0.0 && shadowT < maxT) {
          return true;
        }
        k = k + 1u;
      }
    } else {
      if (node.right >= 0) {
        stack[sp] = u32(node.right);
        sp = sp + 1u;
      }
      if (node.left >= 0) {
        stack[sp] = u32(node.left);
        sp = sp + 1u;
      }
    }
  }
  return false;
}

fn isOccludedInstances(origin: vec3f, dir: vec3f, maxT: f32) -> bool {
  if (sceneInfo.instanceCount == 0u) {
    return false;
  }

  var stack: array<u32, 32>;
  var sp = 1u;
  stack[0] = sceneInfo.tlasRoot;
  loop {
    if (sp == 0u) {
      break;
    }
    sp = sp - 1u;
    let ni = stack[sp];
    let node = nodes[ni];
    if (!intersectAabb(origin, dir, node.min, node.max)) {
      continue;
    }
    if (node.count > 0u) {
      let inst = sceneInfo.instances[node.first];
      let localOrigin = (inst.inverse * vec4f(origin, 1.0)).xyz;
      let localDir = (inst.inverse * vec4f(dir, 0.0)).xyz;
      if (isOccludedBlas(localOrigin, localDir, sceneInfo.gemRoot, maxT)) {
        return true;
      }
    } else {
      if (node.right >= 0) {
        stack[sp] = u32(node.right);
        sp = sp + 1u;
      }
      if (node.left >= 0) {
        stack[sp] = u32(node.left);
        sp = sp + 1u;
      }
    }
  }
  return false;
}

fn isOccludedScene(origin: vec3f, dir: vec3f, maxT: f32) -> bool {
  if (isOccluded(origin, dir, maxT)) {
    return true;
  }
  return isOccludedInstances(origin, dir, maxT);
}

// Closest hit over the static BVH and the instance TLAS.
fn traceScene(origin: vec3f, dir: vec3f) -> Hit {
  var result = traceClosest(origin, dir);
  let instHit = traceInstances(origin, dir);
  if (instHit.found && (!result.found || instHit.t < result.t)) {
    result.found = true;
    result.t = instHit.t;
    result.normal = instHit.normal;
    result.tri = 0u;
    result.uv = vec2f(0.0);
    result.material = instHit.material;
  }
  return result;
}

fn hash01(pixel: vec2u, salt: u32) -> f32 {
  var s = pixel.x * 1973u + pixel.y * 9277u + salt * 26699u + 1u;
  s = (s ^ (s >> 15u)) * 2246822519u;
  s = s ^ (s >> 13u);
  return f32(s) / 4294967295.0;
}

// HDR environment map lookup. It has a ground below the horizon, a sky
// gradient above, a bright sun disk at the sun direction, and window
// highlights. Used for ray misses, so it also lights the scene indirectly
// and appears in mirror and glass reflections.
fn skyColor(dir: vec3f) -> vec3f {
  let phi = atan2(dir.z, dir.x);
  let theta = asin(clamp(dir.y, -1.0, 1.0));
  let uv = vec2f(phi * 0.15915494 + 0.5, 0.5 - theta * 0.31830989);
  let env = textureSampleLevel(envMap, envSampler, uv, 0.0).rgb;
  return 1.5 * camera.skyIntensity * env;
}

// Material kinds must match MaterialKind in materials.ts.
const KIND_DIFFUSE = 0u;
const KIND_MIRROR = 1u;
const KIND_GLASS = 2u;
const KIND_EMISSIVE = 3u;
const KIND_SUBSURFACE = 4u;

fn isEmissive(index: u32) -> bool {
  return materials[index].kind == KIND_EMISSIVE;
}

fn emissiveColor(index: u32) -> vec3f {
  let m = materials[index];
  return m.baseColor * m.emission;
}

fn sampleAreaLight(
  light: Light,
  hitPos: vec3f,
  n: vec3f,
  u1: f32,
  u2: f32,
  albedo: vec3f,
  wrap: f32,
  translucency: f32,
) -> vec3f {
  var lampPoint: vec3f;
  var lightNormal: vec3f;
  var area: f32;
  if (light.kind > 0.5) {
    // Horizontal rectangle that faces down. u1 and u2 pick a uniform
    // point in the unit square.
    let right = vec3f(1.0, 0.0, 0.0);
    let fwd = vec3f(0.0, 0.0, 1.0);
    lampPoint = light.position + right * (u1 * 2.0 - 1.0) * light.halfWidth
      + fwd * (u2 * 2.0 - 1.0) * light.halfDepth;
    lightNormal = vec3f(0.0, -1.0, 0.0);
    area = 4.0 * light.halfWidth * light.halfDepth;
  } else {
    let z = 1.0 - 2.0 * u1;
    let r = sqrt(max(0.0, 1.0 - z * z));
    let phi = 6.2831853 * u2;
    let onSphere = vec3f(r * cos(phi), r * sin(phi), z);
    lampPoint = light.position + light.radius * onSphere;
    lightNormal = onSphere;
    area = 4.0 * 3.14159265 * light.radius * light.radius;
  }
  let toLamp = lampPoint - hitPos;
  let dist2 = dot(toLamp, toLamp);
  let dist = sqrt(dist2);
  let ln = toLamp / dist;
  let rawCos = dot(n, ln);
  // The wrapped cosine softens the terminator on subsurface surfaces.
  let cosS = max((rawCos + wrap) / (1.0 + wrap), 0.0);
  // Light that reaches the back of a thin surface. The normal shadow ray
  // would hit the object itself, so transmission skips the shadow test.
  let cosBack = max((-rawCos + wrap) / (1.0 + wrap), 0.0) * translucency;
  if (cosS <= 0.0 && cosBack <= 0.0) {
    return vec3f(0.0);
  }
  let cosL = max(dot(lightNormal, -ln), 0.0);
  if (cosL <= 0.0) {
    return vec3f(0.0);
  }
  var directScale = 1.0;
  if (isOccludedScene(hitPos, ln, dist - 0.01)) {
    directScale = 0.0;
  }
  let weight = area * cosL / dist2;
  return albedo / 3.14159265 * light.color * (cosS * directScale + cosBack) * weight;
}

// Draw a half vector from the GGX distribution around n. Roughness spreads
// it out. Low roughness clusters near n, high roughness spreads widely.
fn importanceSampleGGX(u1: f32, u2: f32, roughness: f32, n: vec3f) -> vec3f {
  let a = max(roughness * roughness, 0.0001);
  let phi = 6.2831853 * u1;
  let denom = 1.0 + (a * a - 1.0) * u2;
  let cosTheta = sqrt((1.0 - u2) / denom);
  let sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
  var helper = vec3f(0.0, 1.0, 0.0);
  if (abs(n.y) > 0.9) {
    helper = vec3f(1.0, 0.0, 0.0);
  }
  let tangent = normalize(cross(n, helper));
  let bitangent = normalize(cross(n, tangent));
  let h = tangent * (sinTheta * cos(phi)) + bitangent * (sinTheta * sin(phi)) + n * cosTheta;
  return normalize(h);
}

fn cosineHemisphere(n: vec3f, u1: f32, u2: f32) -> vec3f {
  var helper = vec3f(0.0, 1.0, 0.0);
  if (abs(n.y) > 0.9) {
    helper = vec3f(1.0, 0.0, 0.0);
  }
  let tangent = normalize(cross(n, helper));
  let bitangent = normalize(cross(n, tangent));
  let r = sqrt(u1);
  let phi = 6.2831853 * u2;
  let x = r * cos(phi);
  let y = r * sin(phi);
  let z = sqrt(max(0.0, 1.0 - u1));
  return normalize(tangent * x + bitangent * y + n * z);
}

// Procedural normal map detail. It samples a tangent space normal map
// with world space planar coordinates, so triangles do not need UVs.
// Strength comes from the material detail field, so 0 keeps the mesh
// normal untouched. The tangent frame is built from the normal itself.
fn planarUv(pos: vec3f, n: vec3f) -> vec2f {
  if (abs(n.y) >= abs(n.x) && abs(n.y) >= abs(n.z)) {
    return vec2f(pos.x, pos.z);
  }
  if (abs(n.x) >= abs(n.y) && abs(n.x) >= abs(n.z)) {
    return vec2f(pos.z, pos.y);
  }
  return vec2f(pos.x, pos.y);
}

fn applyDetail(n: vec3f, pos: vec3f, strength: f32) -> vec3f {
  if (strength <= 0.0) {
    return n;
  }
  var helper = vec3f(0.0, 1.0, 0.0);
  if (abs(n.y) > 0.9) {
    helper = vec3f(1.0, 0.0, 0.0);
  }
  let tangent = normalize(cross(n, helper));
  let bitangent = normalize(cross(n, tangent));
  let uv = fract(planarUv(pos, n) * 0.25);
  let mapN = textureSampleLevel(normalMap, envSampler, uv, 0.0).rgb * 2.0 - 1.0;
  let bend = (tangent * mapN.x + bitangent * mapN.y) * strength;
  return normalize(n + bend);
}

fn ambientOcclusion(pos: vec3f, n: vec3f) -> f32 {
  var helper = vec3f(0.0, 1.0, 0.0);
  if (abs(n.y) > 0.9) {
    helper = vec3f(1.0, 0.0, 0.0);
  }
  let tangent = normalize(cross(n, helper));
  let bitangent = normalize(cross(n, tangent));
  let origin = pos + n * 0.002;
  var blocked = 0.0;
  if (isOccludedScene(origin, normalize(n + tangent), 1000000.0)) {
    blocked = blocked + 1.0;
  }
  if (isOccludedScene(origin, normalize(n - tangent), 1000000.0)) {
    blocked = blocked + 1.0;
  }
  if (isOccludedScene(origin, normalize(n + bitangent), 1000000.0)) {
    blocked = blocked + 1.0;
  }
  if (isOccludedScene(origin, normalize(n - bitangent), 1000000.0)) {
    blocked = blocked + 1.0;
  }
  return 1.0 - (blocked / 4.0) * 0.7;
}

// Pick a direction inside a small cone around an axis. Used to give the sun
// an angular size so its shadows are soft. Zero angle returns the axis.
fn jitterDirection(axis: vec3f, angle: f32, u1: f32, u2: f32) -> vec3f {
  if (angle <= 0.0) {
    return axis;
  }
  var helper = vec3f(0.0, 1.0, 0.0);
  if (abs(axis.y) > 0.9) {
    helper = vec3f(1.0, 0.0, 0.0);
  }
  let tangent = normalize(cross(axis, helper));
  let bitangent = normalize(cross(axis, tangent));
  let r = angle * sqrt(u1);
  let phi = 6.2831853 * u2;
  return normalize(axis + tangent * (r * cos(phi)) + bitangent * (r * sin(phi)));
}

// Maximum number of bounces before the loop stops. Russian roulette ends
// most paths much sooner.
const MAX_BOUNCES = 5u;

// Follow one path from the camera into the scene. Gathers direct light from
// the sphere lights and the sun at every vertex it lands on, adds emission
// when it reaches a lamp, and continues through diffuse, mirror, glass, and
// subsurface surfaces with a running throughput. Russian roulette kills dim
// paths so a few bright ones carry the image.
fn tracePath(startOrigin: vec3f, startDir: vec3f, gid: vec2u) -> vec3f {
  var origin = startOrigin;
  var dir = startDir;
  var throughput = vec3f(1.0);
  var radiance = vec3f(0.0);
  var medium = vec3f(0.0);
  var inside = false;

  let sun = normalize(camera.lightDir);
  let bounceOn = (camera.flags & 1u) != 0u;

  for (var depth = 0u; depth < MAX_BOUNCES; depth = depth + 1u) {
    let hit = traceScene(origin, dir);
    if (!hit.found) {
      radiance = radiance + throughput * skyColor(dir) * exp(-medium * 40.0);
      break;
    }

    // Beer-Lambert absorption for the segment traveled inside a medium.
    if (inside) {
      throughput = throughput * exp(-medium * hit.t);
    }

    let mat = materials[hit.material];
    let surfPos = origin + dir * hit.t;
    let n = applyDetail(normalize(hit.normal), surfPos, bitcast<f32>(mat.detail));
    let hitPos = surfPos + n * 0.001;

    if (isEmissive(hit.material)) {
      radiance = radiance + throughput * emissiveColor(hit.material);
      break;
    }

    if (mat.kind == KIND_GLASS && bounceOn) {
      // Specular glass. Pick reflection or refraction with Schlick weight.
      let cosT = max(dot(-dir, n), 0.0);
      let f0 = pow((1.0 - mat.ior) / (1.0 + mat.ior), 2.0);
      let fres = f0 + (1.0 - f0) * pow(1.0 - cosT, 5.0);
      let eta = select(1.0 / mat.ior, mat.ior, inside);
      let tin = refract(dir, n, eta);
      let pick = hash01(gid, camera.frame * 256u + depth * 8u + 40u);
      if (pick < fres || dot(tin, tin) < 0.000001) {
        dir = reflect(dir, n);
      } else {
        dir = tin;
        inside = !inside;
        medium = mat.absorption;
      }
      // Roughness frosts the glass. The perfect direction is mixed
      // toward a random direction in the hemisphere around it, so a
      // sharp reflection turns into a soft blur as roughness grows.
      if (mat.roughness > 0.0) {
        let blurU1 = hash01(gid, camera.frame * 256u + depth * 8u + 48u);
        let blurU2 = hash01(gid, camera.frame * 256u + depth * 8u + 49u);
        let jitter = cosineHemisphere(dir, blurU1, blurU2);
        dir = normalize(mix(dir, jitter, clamp(mat.roughness, 0.0, 1.0)));
      }
      origin = hitPos + dir * 0.002;
      throughput = throughput * mat.baseColor;
      continue;
    }

    // Diffuse preview for glass when the bounce toggle is off. Falls through
    // to the direct lighting below.

    let sss = clamp(mat.subsurface, 0.0, 1.0);
    let wrap = sss * 0.5;
    // When the bounce loop is on, the random walk below carries the
    // transmitted light. Without bounces the direct backlight glow is
    // the only transmission in the preview.
    let translucency = select(sss * 0.4, 0.0, bounceOn);

    let su1 = hash01(gid, camera.frame * 256u + depth * 8u + 50u);
    let su2 = hash01(gid, camera.frame * 256u + depth * 8u + 51u);
    let sunDir = jitterDirection(sun, camera.sunSize, su1, su2);
    let sunRaw = dot(n, sunDir);
    var sunDirect = max((sunRaw + wrap) / (1.0 + wrap), 0.0);
    if (sunDirect > 0.0 && isOccludedScene(hitPos, sunDir, 1000000.0)) {
      sunDirect = 0.0;
    }
    let sunBack = max((-sunRaw + wrap) / (1.0 + wrap), 0.0) * translucency;
    let sunScale = 1.6 * 0.75;
    radiance =
      radiance + throughput * mat.baseColor * sunParams.color * (0.05 + 0.95 * sunDirect + sunBack) * sunScale;

    if (!bounceOn) {
      break;
    }

    let lightCount = arrayLength(&lights);
    for (var li = 0u; li < lightCount; li = li + 1u) {
      let lu1 = hash01(gid, camera.frame * 512u + depth * 16u + li * 2u + 1u);
      let lu2 = hash01(gid, camera.frame * 512u + depth * 16u + li * 2u + 2u);
      radiance = radiance + throughput * sampleAreaLight(lights[li], hitPos, n, lu1, lu2, mat.baseColor, wrap, translucency);
    }

    if (mat.kind == KIND_SUBSURFACE) {
      // Volume random walk. The path enters the wax, the interior ray
      // finds the far side through the BVH, the segment attenuates with
      // the absorption coefficient, and the path either exits with a
      // diffuse direction or scatters isotropically and walks again.
      // After at most four interior steps the path leaves through the
      // surface and continues with an attenuated throughput.
      var inDir = refract(dir, n, 1.0 / max(mat.ior, 0.001));
      if (dot(inDir, inDir) < 0.000001) {
        let entryU1 = hash01(gid, camera.frame * 256u + depth * 8u + 60u);
        let entryU2 = hash01(gid, camera.frame * 256u + depth * 8u + 61u);
        inDir = cosineHemisphere(-n, entryU1, entryU2);
      }
      var walkOrigin = hitPos - n * 0.002;
      var walkDir = inDir;
      var walkThroughput = vec3f(1.0);
      var stopPath = false;
      dir = inDir;
      origin = hitPos;
      for (var step = 0u; step < 4u; step = step + 1u) {
        let exitHit = traceScene(walkOrigin, walkDir);
        if (!exitHit.found) {
          let fallen = throughput * walkThroughput * exp(-mat.absorption * 0.8);
          radiance = radiance + fallen * skyColor(walkDir);
          stopPath = true;
          break;
        }
        let segment = exitHit.t;
        walkThroughput = walkThroughput * exp(-mat.absorption * segment);
        let exitN = normalize(exitHit.normal);
        let exitPos = walkOrigin + walkDir * segment + exitN * 0.001;
        let exitPick = hash01(gid, camera.frame * 256u + depth * 8u + 62u + step * 4u);
        if (exitPick < 0.6 || step == 3u) {
          let outU1 = hash01(gid, camera.frame * 256u + depth * 8u + 63u + step * 4u);
          let outU2 = hash01(gid, camera.frame * 256u + depth * 8u + 64u + step * 4u);
          dir = cosineHemisphere(exitN, outU1, outU2);
          origin = exitPos;
          throughput = throughput * walkThroughput;
          break;
        }
        let scatterU1 = hash01(gid, camera.frame * 256u + depth * 8u + 65u + step * 4u);
        let scatterU2 = hash01(gid, camera.frame * 256u + depth * 8u + 66u + step * 4u);
        let z = 1.0 - 2.0 * scatterU1;
        let r = sqrt(max(0.0, 1.0 - z * z));
        let phi = 6.2831853 * scatterU2;
        walkDir = normalize(vec3f(r * cos(phi), r * sin(phi), z));
        walkOrigin = exitPos - exitN * 0.002;
      }
      if (stopPath) {
        break;
      }
      continue;
    }

    if (mat.kind == KIND_MIRROR) {
      let u1 = hash01(gid, camera.frame * 256u + depth * 8u + 4u);
      let u2 = hash01(gid, camera.frame * 256u + depth * 8u + 5u);
      let h = importanceSampleGGX(u1, u2, mat.roughness, n);
      var rdir = reflect(dir, h);
      if (dot(rdir, n) <= 0.0) {
        rdir = reflect(dir, n);
      }
      let cosTheta = max(dot(-dir, n), 0.0);
      let f0v = mat.baseColor;
      let fres = f0v + (vec3f(1.0) - f0v) * pow(1.0 - cosTheta, 5.0);
      dir = rdir;
      origin = hitPos + n * 0.001;
      throughput = throughput * fres;
    } else {
      let u1 = hash01(gid, camera.frame * 256u + depth * 8u + 6u);
      let u2 = hash01(gid, camera.frame * 256u + depth * 8u + 7u);
      dir = cosineHemisphere(n, u1, u2);
      origin = hitPos + n * 0.001;
      throughput = throughput * mat.baseColor;
    }

    // Russian roulette. Kill dim paths, boost the survivors to stay unbiased.
    if (depth >= 2u) {
      let q = clamp(max(throughput.x, max(throughput.y, throughput.z)), 0.02, 1.0);
      let rr = hash01(gid, camera.frame * 256u + depth * 8u + 3u);
      if (rr > q) {
        break;
      }
      throughput = throughput / q;
    }
  }

  // Firefly clamp. One lucky sample can carry a huge spike that the
  // denoiser cannot clean. Real HDR peaks (the sun disk and lamp glow)
  // sit far below 64, so this only removes the spikes.
  return min(radiance, vec3f(64.0));
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = textureDimensions(outputTexture);
  if (gid.x >= dims.x || gid.y >= dims.y) {
    return;
  }

  let jx = hash01(gid.xy, camera.frame * 2u) - 0.5;
  let jy = hash01(gid.xy, camera.frame * 2u + 1u) - 0.5;
  let uv = (vec2f(f32(gid.x) + 0.5 + jx, f32(gid.y) + 0.5 + jy) / vec2f(dims)) * 2.0 - 1.0;
  let ndc = vec4f(uv.x, -uv.y, 1.0, 1.0);
  let world = camera.invViewProj * ndc;
  let pinholeDir = normalize(world.xyz / world.w - camera.eye);

  // Thin lens camera. Shift the ray origin across the aperture disk and aim
  // it at the point the center ray focused on. Zero aperture is a pinhole.
  let focusPoint = camera.eye + pinholeDir * camera.focusDistance;
  var rayOrigin = camera.eye;
  var dir = pinholeDir;
  if (camera.aperture > 0.0) {
    let centerW = camera.invViewProj * vec4f(0.0, 0.0, 1.0, 1.0);
    let center = centerW.xyz / centerW.w;
    let rightW = camera.invViewProj * vec4f(1.0, 0.0, 1.0, 1.0);
    let right = normalize(rightW.xyz / rightW.w - center);
    let upW = camera.invViewProj * vec4f(0.0, 1.0, 1.0, 1.0);
    let up = normalize(upW.xyz / upW.w - center);
    let a1 = hash01(gid.xy, camera.frame * 4u + 6u);
    let a2 = hash01(gid.xy, camera.frame * 4u + 7u);
    let ang = 6.2831853 * a1;
    let rad = camera.aperture * sqrt(a2);
    let offset = (right * cos(ang) + up * sin(ang)) * rad;
    rayOrigin = camera.eye + offset;
    dir = normalize(focusPoint - rayOrigin);
  }

  let primary = traceScene(rayOrigin, dir);
  let viewMode = (camera.flags >> 1u) & 7u;
  let idx = gid.y * dims.x + gid.x;

  // Adaptive skip. Once the running luminance variance is tiny the pixel
  // has converged, so the stored color is reused instead of tracing a
  // full multi bounce path. A small hash chance still refreshes the
  // sample, so a settled pixel can correct a small bias over time. The
  // primary trace above still runs, so the G-buffer and motion stay
  // current while the camera is still.
  var adaptiveSkip = false;
  if (viewMode == 0u && camera.frame > 32u) {
    let prevMoment = moments[idx];
    let variance = max(prevMoment.y - prevMoment.x * prevMoment.x, 0.0);
    let refresh = hash01(gid.xy, camera.frame * 29u + 77u) < 0.05;
    adaptiveSkip = !refresh && variance < 0.001;
  }

  var color = vec3f(0.02, 0.03, 0.06);
  if (adaptiveSkip) {
    color = accum[idx].rgb;
  } else if (viewMode == 1u) {
    if (primary.found) {
      color = normalize(primary.normal) * 0.5 + 0.5;
    } else {
      color = vec3f(0.0);
    }
  } else if (viewMode == 2u) {
    if (primary.found) {
      let depth = 1.0 / (1.0 + 0.15 * primary.t);
      color = vec3f(depth);
    } else {
      color = vec3f(0.0);
    }
  } else if (viewMode == 3u) {
    if (primary.found) {
      color = materials[primary.material].baseColor;
    } else {
      color = vec3f(0.0);
    }
  } else if (viewMode == 4u) {
    if (primary.found) {
      color = vec3f(materials[primary.material].roughness);
    } else {
      color = vec3f(0.0);
    }
  } else if (viewMode == 5u) {
    if (primary.found) {
      color = emissiveColor(primary.material);
    } else {
      color = vec3f(0.0);
    }
  } else {
    color = tracePath(rayOrigin, dir, gid.xy);
  }
  if (primary.found) {
    let primPos = rayOrigin + dir * primary.t;
    let primN = applyDetail(
      normalize(primary.normal),
      primPos,
      bitcast<f32>(materials[primary.material].detail),
    );
    gbuffer[idx] = vec4f(primN, primary.t);
  } else {
    gbuffer[idx] = vec4f(0.0);
  }

  let lum = dot(color, vec3f(0.2126, 0.7152, 0.0722));
  let sampleMoment = vec2f(lum, lum * lum);
  let n = f32(camera.frame + 1u);
  var blended = vec4f(color, 1.0);
  var blendedMoment = sampleMoment;
  if (adaptiveSkip) {
    blended = accum[idx];
    blendedMoment = moments[idx];
  } else if (camera.frame > 0u) {
    let prev = accum[idx];
    blended = (prev * (n - 1.0) + vec4f(color, 1.0)) / n;
    let prevMoment = moments[idx];
    blendedMoment = (prevMoment * (n - 1.0) + sampleMoment) / n;
  }
  accum[idx] = blended;
  moments[idx] = blendedMoment;
  textureStore(outputTexture, vec2i(gid.xy), blended);

  // Project the primary hit through the previous view projection. The
  // temporal pass uses this to pull last frame's filtered color into this
  // frame. Missing the scene leaves the vector invalid so the sky never
  // smears across a camera move.
  var motion = vec4f(0.0);
  if (primary.found) {
    let worldPos = rayOrigin + dir * primary.t;
    let prevClip = camera.prevViewProj * vec4f(worldPos, 1.0);
    if (prevClip.w > 0.0) {
      let prevNdc = prevClip.xy / prevClip.w;
      let prevUv = vec2f(prevNdc.x * 0.5 + 0.5, 0.5 - prevNdc.y * 0.5);
      if (all(prevUv >= vec2f(0.0)) && all(prevUv <= vec2f(1.0))) {
        motion = vec4f(prevUv, 1.0, 0.0);
      }
    }
  }
  textureStore(motionTexture, vec2i(gid.xy), motion);
}
