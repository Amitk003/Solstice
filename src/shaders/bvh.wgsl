struct Camera {
  invViewProj: mat4x4f,
  eye: vec3f,
  _pad0: f32,
  lightDir: vec3f,
  _pad1: f32,
}

struct Triangle {
  v0: vec3f,
  _pad0: f32,
  v1: vec3f,
  _pad1: f32,
  v2: vec3f,
  _pad2: f32,
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

fn intersectTriangle(origin: vec3f, dir: vec3f, tri: Triangle) -> f32 {
  let edge1 = tri.v1 - tri.v0;
  let edge2 = tri.v2 - tri.v0;
  let h = cross(dir, edge2);
  let a = dot(edge1, h);
  if (abs(a) < 0.000001) {
    return -1.0;
  }
  let f = 1.0 / a;
  let s = origin - tri.v0;
  let u = f * dot(s, h);
  if (u < 0.0 || u > 1.0) {
    return -1.0;
  }
  let q = cross(s, edge1);
  let v = f * dot(dir, q);
  if (v < 0.0 || u + v > 1.0) {
    return -1.0;
  }
  let t = f * dot(edge2, q);
  if (t <= 0.000001) {
    return -1.0;
  }
  return t;
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
        if (intersectTriangle(origin, dir, triangles[ti]) > 0.0) {
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

  var stack: array<u32, 64>;
  var sp = 0u;
  stack[0] = 0u;
  sp = 1u;
  var hit = false;
  var closestT = 1000000.0;
  var hitNormal = vec3f(0.0, 0.0, 1.0);

  loop {
    if (sp == 0u) {
      break;
    }
    sp = sp - 1u;
    let ni = stack[sp];
    let node = nodes[ni];

    if (!intersectAabb(camera.eye, dir, node.min, node.max)) {
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
        let t = intersectTriangle(camera.eye, dir, tri);
        if (t > 0.0 && t < closestT) {
          closestT = t;
          hit = true;
          hitNormal = normalize(cross(tri.v1 - tri.v0, tri.v2 - tri.v0));
          if (dot(hitNormal, dir) > 0.0) {
            hitNormal = -hitNormal;
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

  var color = vec3f(0.02, 0.03, 0.06);
  if (hit) {
    let n = normalize(hitNormal);
    let l = normalize(camera.lightDir);
    let hitPos = camera.eye + dir * closestT + n * 0.001;
    var diffuse = max(dot(n, l), 0.0);
    if (diffuse > 0.0 && isOccluded(hitPos, l)) {
      diffuse = 0.0;
    }
    let ambient = 0.15;
    let faceTint = 0.6 + 0.4 * abs(n);
    color = faceTint * (ambient + (1.0 - ambient) * diffuse) + vec3f(0.05);
  } else {
    // simple sky gradient
    let t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    color = mix(vec3f(0.6, 0.7, 0.9), vec3f(0.1, 0.2, 0.4), t);
  }
  textureStore(outputTexture, vec2i(gid.xy), vec4f(color, 1.0));
}
