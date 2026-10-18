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
  invViewProj: Float32Array;
  radius: number;
  azimuth: number;
  elevation: number;
  aperture: number;
  focusDistance: number;
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
    invViewProj: mat4.create(),
    radius: 4,
    azimuth: 0.6,
    elevation: 0.5,
    aperture: 0.04,
    focusDistance: 4,
  };
  updateCamera(camera, 1);
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
  mat4.inverse(viewProj, camera.invViewProj);

  // Focus on the orbit target so the center of the scene stays sharp.
  const fx = camera.eye[0] - tx;
  const fy = camera.eye[1] - ty;
  const fz = camera.eye[2] - tz;
  camera.focusDistance = Math.sqrt(fx * fx + fy * fy + fz * fz);
}

export function orbitCamera(camera: Camera, deltaAzimuth: number, deltaElevation: number): void {
  camera.azimuth += deltaAzimuth;
  camera.elevation = Math.max(-1.4, Math.min(1.4, camera.elevation + deltaElevation));
}

export function cameraUniformData(
  camera: Camera,
  aspect: number,
  frame: number,
  flags: number,
): Float32Array {
  updateCamera(camera, aspect);
  const light = vec3.normalize(camera.lightDir);
  const data = new Float32Array(28); // mat4 + eye + pad + light + pad + frame + flags + aperture + focus
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
  return data;
}
