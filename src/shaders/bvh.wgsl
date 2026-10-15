struct Camera {
  invViewProj: mat4x4f,
  eye: vec3f,
  _pad0: f32,
  lightDir: vec3f,
  _pad1: f32,
  frame: u32,
  flags: u32,
  _pad3: u32,
  _pad4: u32,
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
  _pad5: f32,
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

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read> triangles: array<Triangle>;
@group(0) @binding(2) var<storage, read> nodes: array<BvhNode>;
@group(0) @binding(3) var<storage, read> triIndices: array<u32>;
@group(0) @binding(4) var outputTexture: texture_storage_2d<rgba16float, write>;
@group(0) @binding(5) var<storage, read_write> accum: array<vec4f>;

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

fn isOccluded(origin: vec3f, dir: vec3f) -> bool {
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
        if (intersectTriangle(origin, dir, triangles[ti]).x > 0.0) {
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
  if (isOccluded(origin, normalize(n + tangent))) {
    blocked = blocked + 1.0;
  }
  if (isOccluded(origin, normalize(n - tangent))) {
    blocked = blocked + 1.0;
  }
  if (isOccluded(origin, normalize(n + bitangent))) {
    blocked = blocked + 1.0;
  }
  if (isOccluded(origin, normalize(n - bitangent))) {
    blocked = blocked + 1.0;
  }
  return 1.0 - (blocked / 4.0) * 0.7;
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
  let dir = normalize(world.xyz / world.w - camera.eye);

  let primary = traceClosest(camera.eye, dir);

  var color = vec3f(0.02, 0.03, 0.06);
  if (primary.found) {
    let n = normalize(primary.normal);
    let l = normalize(camera.lightDir);
    let closestT = primary.t;
    let hitPos = camera.eye + dir * closestT + n * 0.001;
    var diffuse = max(dot(n, l), 0.0);
    if (diffuse > 0.0 && isOccluded(hitPos, l)) {
      diffuse = 0.0;
    }
    // Cube is tris 0 to 11, floor is 12 to 13, sphere is 14 and up.
    var albedo = 0.6 + 0.4 * abs(n);
    if (primary.tri >= 14u) {
      albedo = albedo * vec3f(1.15, 0.45, 0.35);
    }
    if ((camera.flags & 1u) != 0u) {
      let u1 = hash01(gid.xy, camera.frame * 4u + 2u);
      let u2 = hash01(gid.xy, camera.frame * 4u + 3u);
      let bounceDir = cosineHemisphere(n, u1, u2);
      let bounceOrigin = hitPos + n * 0.001;
      let bounce = traceClosest(bounceOrigin, bounceDir);
      var indirect = skyColor(bounceDir) * 0.25;
      if (bounce.found) {
        let bn = normalize(bounce.normal);
        var bouncediff = max(dot(bn, l), 0.0);
        let bouncePos = bounceOrigin + bounceDir * bounce.t + bn * 0.001;
        if (bouncediff > 0.0 && isOccluded(bouncePos, l)) {
          bouncediff = 0.0;
        }
        indirect = (vec3f(0.55) * bouncediff + skyColor(bn) * 0.15) * 0.6;
      }
      color = 1.6 * albedo * (0.05 + 0.95 * diffuse) * 0.75 + indirect * albedo + vec3f(0.02);
      if (primary.tri < 12u) {
        let rdir = reflect(dir, n);
        let rorigin = hitPos + n * 0.001;
        let rhit = traceClosest(rorigin, rdir);
        var refl = skyColor(rdir);
        if (rhit.found) {
          let rn = normalize(rhit.normal);
          var rdiff = max(dot(rn, l), 0.0);
          let rpos = rorigin + rdir * rhit.t + rn * 0.001;
          if (rdiff > 0.0 && isOccluded(rpos, l)) {
            rdiff = 0.0;
          }
          refl = vec3f(0.6) * rdiff + skyColor(rn) * 0.2;
        }
        let cosTheta = max(dot(-dir, n), 0.0);
        let fresnel = 0.3 + 0.7 * pow(1.0 - cosTheta, 5.0);
        color = mix(color, refl * vec3f(0.9, 0.95, 1.0) + color * 0.15, fresnel);
      }
    } else {
      let skyFill = skyColor(n) * 0.12;
      color = 1.6 * albedo * (0.05 + 0.95 * diffuse) * 0.75 + skyFill * albedo + vec3f(0.02);
    }
  } else {
    color = skyColor(dir);
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
