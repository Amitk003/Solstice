export function triangleUniformData(): Float32Array {
  // Three vertices of a triangle in the XY plane.
  const data = new Float32Array(12);
  data[0] = -1;
  data[1] = -1;
  data[2] = 0;
  data[3] = 0; // padding
  data[4] = 1;
  data[5] = -1;
  data[6] = 0;
  data[7] = 0; // padding
  data[8] = 0;
  data[9] = 1;
  data[10] = 0;
  data[11] = 0; // padding
  return data;
}
