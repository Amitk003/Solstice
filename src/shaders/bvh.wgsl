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
  _pad3: f32,
  _pad4: f32,
  _pad5: f32,
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

// Layout must match lightsStorageData in lights.ts.
struct Light {
  position: vec3f,
  radius: f32,
  color: vec3f,
  _pad0: f32,
}

// Layout must match materialsStorageData in materials.ts.
struct Material {
  baseColor: vec3f,
  roughness: f32,
  absorption: vec3f,
  ior: f32,
  kind: u32,
  emission: f32,
  _pad0: u32,
  _pad1: u32,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read> triangles: array<Triangle>;
@group(0) @binding(2) var<storage, read> nodes: array<BvhNode>;
@group(0) @binding(3) var<storage, read> triIndices: array<u32>;
@group(0) @binding(4) var outputTexture: texture_storage_2d<rgba16float, write>;
@group(0) @binding(5) var<storage, read_write> accum: array<vec4f>;
@group(0) @binding(6) var<storage, read> lights: array<Light>;
@group(0) @binding(7) var<storage, read> materials: array<Material>;

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
        if (tuv.x > 0.0 && tuv.x < result.t) {
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

fn hash01(pixel: vec2u, salt: u32) -> f32 {
  var s = pixel.x * 1973u + pixel.y * 9277u + salt * 26699u + 1u;
  s = (s ^ (s >> 15u)) * 2246822519u;
  s = s ^ (s >> 13u);
  return f32(s) / 4294967295.0;
}

fn skyColor(dir: vec3f) -> vec3f {
  let t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  return 1.5 * mix(vec3f(0.6, 0.7, 0.9), vec3f(0.1, 0.2, 0.4), t);
}

// Material kinds must match MaterialKind in materials.ts.
const KIND_DIFFUSE = 0u;
const KIND_MIRROR = 1u;
const KIND_GLASS = 2u;
const KIND_EMISSIVE = 3u;

fn isEmissive(index: u32) -> bool {
  return materials[index].kind == KIND_EMISSIVE;
}

fn emissiveColor(index: u32) -> vec3f {
  let m = materials[index];
  return m.baseColor * m.emission;
}

fn sampleSphereLight(light: Light, hitPos: vec3f, n: vec3f, u1: f32, u2: f32, albedo: vec3f) -> vec3f {
  let z = 1.0 - 2.0 * u1;
  let r = sqrt(max(0.0, 1.0 - z * z));
  let phi = 6.2831853 * u2;
  let onSphere = vec3f(r * cos(phi), r * sin(phi), z);
  let lampPoint = light.position + light.radius * onSphere;
  let toLamp = lampPoint - hitPos;
  let dist2 = dot(toLamp, toLamp);
  let dist = sqrt(dist2);
  let ln = toLamp / dist;
  let cosS = max(dot(n, ln), 0.0);
  if (cosS <= 0.0) {
    return vec3f(0.0);
  }
  let cosL = max(dot(onSphere, -ln), 0.0);
  if (cosL <= 0.0) {
    return vec3f(0.0);
  }
  if (isOccluded(hitPos, ln, dist - 0.01)) {
    return vec3f(0.0);
  }
  let area = 4.0 * 3.14159265 * light.radius * light.radius;
  return albedo / 3.14159265 * light.color * cosS * (area * cosL / dist2);
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

fn ambientOcclusion(pos: vec3f, n: vec3f) -> f32 {
  var helper = vec3f(0.0, 1.0, 0.0);
  if (abs(n.y) > 0.9) {
    helper = vec3f(1.0, 0.0, 0.0);
  }
  let tangent = normalize(cross(n, helper));
  let bitangent = normalize(cross(n, tangent));
  let origin = pos + n * 0.002;
  var blocked = 0.0;
  if (isOccluded(origin, normalize(n + tangent), 1000000.0)) {
    blocked = blocked + 1.0;
  }
  if (isOccluded(origin, normalize(n - tangent), 1000000.0)) {
    blocked = blocked + 1.0;
  }
  if (isOccluded(origin, normalize(n + bitangent), 1000000.0)) {
    blocked = blocked + 1.0;
  }
  if (isOccluded(origin, normalize(n - bitangent), 1000000.0)) {
    blocked = blocked + 1.0;
  }
  return 1.0 - (blocked / 4.0) * 0.7;
}

// Maximum number of bounces before the loop stops. Russian roulette ends
// most paths much sooner.
const MAX_BOUNCES = 5u;

// Follow one path from the camera into the scene. Gathers direct light from
// the sphere lights and the sun at every vertex it lands on, adds emission
// when it reaches a lamp, and continues through diffuse, mirror, and glass
// surfaces with a running throughput. Russian roulette kills dim paths so a
// few bright ones carry the image.
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
    let hit = traceClosest(origin, dir);
    if (!hit.found) {
      radiance = radiance + throughput * skyColor(dir) * exp(-medium * 40.0);
      break;
    }

    // Beer-Lambert absorption for the segment traveled inside a medium.
    if (inside) {
      throughput = throughput * exp(-medium * hit.t);
    }

    let n = normalize(hit.normal);
    let hitPos = origin + dir * hit.t + n * 0.001;
    let mat = materials[hit.material];

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
      origin = hitPos + dir * 0.002;
      throughput = throughput * mat.baseColor;
      continue;
    }

    // Diffuse preview for glass when the bounce toggle is off. Falls through
    // to the direct lighting below.

    var diffuse = max(dot(n, sun), 0.0);
    if (diffuse > 0.0 && isOccluded(hitPos, sun, 1000000.0)) {
      diffuse = 0.0;
    }
    radiance = radiance + throughput * mat.baseColor * (0.05 + 0.95 * diffuse) * 1.6 * 0.75;

    if (!bounceOn) {
      break;
    }

    let lightCount = arrayLength(&lights);
    for (var li = 0u; li < lightCount; li = li + 1u) {
      let lu1 = hash01(gid, camera.frame * 512u + depth * 16u + li * 2u + 1u);
      let lu2 = hash01(gid, camera.frame * 512u + depth * 16u + li * 2u + 2u);
      radiance = radiance + throughput * sampleSphereLight(lights[li], hitPos, n, lu1, lu2, mat.baseColor);
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

  return radiance;
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

  let primary = traceClosest(rayOrigin, dir);
  let viewMode = (camera.flags >> 1u) & 3u;

  var color = vec3f(0.02, 0.03, 0.06);
  if (viewMode == 1u) {
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
  } else {
    color = tracePath(rayOrigin, dir, gid.xy);
  }
  let idx = gid.y * dims.x + gid.x;
  let n = f32(camera.frame + 1u);
  var blended = vec4f(color, 1.0);
  if (camera.frame > 0u) {
    let prev = accum[idx];
    blended = (prev * (n - 1.0) + vec4f(color, 1.0)) / n;
  }
  accum[idx] = blended;
  textureStore(outputTexture, vec2i(gid.xy), blended);
}
