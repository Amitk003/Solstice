import { mat4, vec3 } from 'wgpu-matrix';

export interface Camera {
  eye: Float32Array;
  target: Float32Array;
  up: Float32Array;
  fovYRadians: number;
  near: number;
  far: number;
  aspect: number;
  invViewProj: Float32Array;
}

export function createCamera(): Camera {
  const camera: Camera = {
    eye: vec3.create(0, 0, 4),
    target: vec3.create(0, 0, 0),
    up: vec3.create(0, 1, 0),
    fovYRadians: Math.PI / 4,
    near: 0.1,
    far: 100,
    aspect: 1,
    invViewProj: mat4.create(),
  };
  updateCamera(camera, 1);
  return camera;
}

export function updateCamera(camera: Camera, aspect: number): void {
  camera.aspect = aspect;
  const view = mat4.lookAt(camera.eye, camera.target, camera.up);
  const proj = mat4.perspective(camera.fovYRadians, aspect, camera.near, camera.far);
  const viewProj = mat4.multiply(proj, view);
  mat4.inverse(viewProj, camera.invViewProj);
}

export function cameraUniformData(camera: Camera, aspect: number): Float32Array {
  updateCamera(camera, aspect);
  const data = new Float32Array(20); // 16 (mat4) + 4 (eye + pad)
  data.set(camera.invViewProj, 0);
  data[16] = camera.eye[0] ?? 0;
  data[17] = camera.eye[1] ?? 0;
  data[18] = camera.eye[2] ?? 0;
  data[19] = 0; // padding
  return data;
}
