import { mat4, vec3 } from 'wgpu-matrix';

export interface Camera {
  eye: Float32Array;
  target: Float32Array;
  up: Float32Array;
  lightDir: Float32Array;
  fovYRadians: number;
  near: number;
  far: number;
  aspect: number;
  viewProj: Float32Array;
  prevViewProj: Float32Array;
  invViewProj: Float32Array;
  radius: number;
  azimuth: number;
  elevation: number;
  aperture: number;
  focusDistance: number;
  focusOffset: number;
  sunSize: number;
  skyIntensity: number;
}

export function createCamera(): Camera {
  const camera: Camera = {
    eye: vec3.create(0, 0, 4),
    target: vec3.create(0, 0, 0),
    up: vec3.create(0, 1, 0),
    lightDir: vec3.create(0.4, 0.8, -0.4),
    fovYRadians: Math.PI / 4,
    near: 0.1,
    far: 100,
    aspect: 1,
    viewProj: mat4.create(),
    prevViewProj: mat4.create(),
    invViewProj: mat4.create(),
    radius: 4,
    azimuth: 0.6,
    elevation: 0.5,
    aperture: 0.04,
    focusDistance: 4,
    focusOffset: 0,
    sunSize: 0.05,
    skyIntensity: 1,
  };
  updateCamera(camera, 1);
  camera.prevViewProj.set(camera.viewProj);
  return camera;
}

export function updateCamera(camera: Camera, aspect: number): void {
  camera.aspect = aspect;
  const cosElev = Math.cos(camera.elevation);
  const tx = camera.target[0] ?? 0;
  const ty = camera.target[1] ?? 0;
  const tz = camera.target[2] ?? 0;
  camera.eye[0] = tx + camera.radius * cosElev * Math.sin(camera.azimuth);
  camera.eye[1] = ty + camera.radius * Math.sin(camera.elevation);
  camera.eye[2] = tz + camera.radius * cosElev * Math.cos(camera.azimuth);

  const view = mat4.lookAt(camera.eye, camera.target, camera.up);
  const proj = mat4.perspective(camera.fovYRadians, aspect, camera.near, camera.far);
  const viewProj = mat4.multiply(proj, view);
  camera.viewProj.set(viewProj);
  mat4.inverse(viewProj, camera.invViewProj);

  // Focus on the orbit target plus the user offset, so the panel can
  // pull the sharp plane in front of or behind the target.
  const fx = camera.eye[0] - tx;
  const fy = camera.eye[1] - ty;
  const fz = camera.eye[2] - tz;
  camera.focusDistance = Math.max(0.2, Math.sqrt(fx * fx + fy * fy + fz * fz) + camera.focusOffset);
}

export function orbitCamera(camera: Camera, deltaAzimuth: number, deltaElevation: number): void {
  camera.azimuth += deltaAzimuth;
  camera.elevation = Math.max(-1.4, Math.min(1.4, camera.elevation + deltaElevation));
}

// Move the eye closer or farther from the orbit target. The context
// sends a radius proportional step, so small wheel ticks feel even.
export function zoomCamera(camera: Camera, deltaRadius: number): void {
  camera.radius = Math.max(2.5, Math.min(8, camera.radius + deltaRadius));
}

// Move the orbit target sideways in the screen plane. Positive dx steps
// right, positive dy steps up. The step shrinks with the orbit radius so
// panning feels the same at any zoom.
export function panCamera(camera: Camera, dx: number, dy: number): void {
  const ex = camera.eye[0] ?? 0;
  const ey = camera.eye[1] ?? 0;
  const ez = camera.eye[2] ?? 0;
  const tx = camera.target[0] ?? 0;
  const ty = camera.target[1] ?? 0;
  const tz = camera.target[2] ?? 0;
  const fwd = vec3.create(tx - ex, ty - ey, tz - ez);
  const fwdLen = Math.hypot(fwd[0] ?? 0, fwd[1] ?? 0, fwd[2] ?? 0) || 1;
  fwd[0] = (fwd[0] ?? 0) / fwdLen;
  fwd[1] = (fwd[1] ?? 0) / fwdLen;
  fwd[2] = (fwd[2] ?? 0) / fwdLen;
  const right = vec3.normalize(vec3.cross(fwd, camera.up));
  const upv = vec3.cross(right, fwd);
  const step = camera.radius * 0.08;
  camera.target[0] = tx + (right[0] ?? 0) * dx * step + (upv[0] ?? 0) * dy * step;
  camera.target[1] = ty + (right[1] ?? 0) * dx * step + (upv[1] ?? 0) * dy * step;
  camera.target[2] = tz + (right[2] ?? 0) * dx * step + (upv[2] ?? 0) * dy * step;
}

export function cameraUniformData(
  camera: Camera,
  aspect: number,
  frame: number,
  flags: number,
  historyValid: boolean,
): Float32Array {
  // Keep the view projection from the frame that just finished so the trace
  // shader can reproject this frame's hits into the previous image.
  camera.prevViewProj.set(camera.viewProj);
  updateCamera(camera, aspect);
  const light = vec3.normalize(camera.lightDir);
  // mat4 + eye + pad + light + pad + frame + flags + aperture + focus +
  // sun size + sky + history flag + pad + previous view projection.
  const data = new Float32Array(48);
  data.set(camera.invViewProj, 0);
  data[16] = camera.eye[0] ?? 0;
  data[17] = camera.eye[1] ?? 0;
  data[18] = camera.eye[2] ?? 0;
  data[19] = 0; // padding
  data[20] = light[0] ?? 0;
  data[21] = light[1] ?? 0;
  data[22] = light[2] ?? 0;
  data[23] = 0; // padding
  new Uint32Array(data.buffer)[24] = frame;
  new Uint32Array(data.buffer)[25] = flags;
  data[26] = camera.aperture;
  data[27] = camera.focusDistance;
  data[28] = camera.sunSize;
  data[29] = camera.skyIntensity;
  new Uint32Array(data.buffer)[30] = historyValid ? 1 : 0;
  data[31] = 0;
  data.set(camera.prevViewProj, 32);
  return data;
}
