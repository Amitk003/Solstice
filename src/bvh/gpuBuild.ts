import buildSource from '../shaders/bvh_build.wgsl?raw';
import type { TriangleData } from '../scene/triangles';

export interface SceneBounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface GpuBvhResult {
  nodesBuffer: GPUBuffer;
  triIndicesBuffer: GPUBuffer;
  nodeCount: number;
  paddedCount: number;
}

export function triangleSceneBounds(tris: TriangleData[]): SceneBounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const tri of tris) {
    const vertices = [tri.v0, tri.v1, tri.v2];
    for (const vertex of vertices) {
      for (let axis = 0; axis < 3; axis++) {
        const value = vertex[axis]!;
        if (value < min[axis]!) {
          min[axis] = value;
        }
        if (value > max[axis]!) {
          max[axis] = value;
        }
      }
    }
  }
  return { min, max };
}

function nextPowerOfTwo(value: number): number {
  let result = 1;
  while (result < value) {
    result *= 2;
  }
  return result;
}

const PARAMS_BYTES = 64;

export async function buildGpuBvh(
  device: GPUDevice,
  trianglesBuffer: GPUBuffer,
  triangleCount: number,
  bounds: SceneBounds,
): Promise<GpuBvhResult> {
  if (triangleCount === 0) {
    throw new Error('Cannot build a BVH with no triangles.');
  }

  const paddedCount = nextPowerOfTwo(triangleCount);
  const nodeCount = paddedCount * 2 - 1;

  device.pushErrorScope('validation');
  let result: GpuBvhResult;

  try {
    const shaderModule = device.createShaderModule({ code: buildSource });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' },
        },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });
    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    function makePipeline(entryPoint: string): GPUComputePipeline {
      return device.createComputePipeline({
        layout: pipelineLayout,
        compute: { module: shaderModule, entryPoint },
      });
    }
    const mortonPipeline = makePipeline('morton');
    const bitonicPipeline = makePipeline('bitonicStep');
    const leafPipeline = makePipeline('leafFill');
    const internalPipeline = makePipeline('internalLevel');

    const keysBuffer = device.createBuffer({
      size: paddedCount * 4,
      usage: GPUBufferUsage.STORAGE,
    });
    const triIndicesBuffer = device.createBuffer({
      size: paddedCount * 4,
      usage: GPUBufferUsage.STORAGE,
    });
    const nodesBuffer = device.createBuffer({
      size: nodeCount * 48,
      usage: GPUBufferUsage.STORAGE,
    });

    function writeParams(fields: {
      levelStart?: number;
      levelCount?: number;
      sortK?: number;
      sortJ?: number;
    }): GPUBuffer {
      const buffer = device.createBuffer({
        size: PARAMS_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const data = new ArrayBuffer(PARAMS_BYTES);
      const floats = new Float32Array(data);
      const uints = new Uint32Array(data);
      floats[0] = bounds.min[0];
      floats[1] = bounds.min[1];
      floats[2] = bounds.min[2];
      floats[3] = 0;
      floats[4] = bounds.max[0];
      floats[5] = bounds.max[1];
      floats[6] = bounds.max[2];
      floats[7] = 0;
      uints[8] = triangleCount;
      uints[9] = paddedCount;
      uints[10] = fields.levelStart ?? 0;
      uints[11] = fields.levelCount ?? 0;
      uints[12] = fields.sortK ?? 0;
      uints[13] = fields.sortJ ?? 0;
      uints[14] = 0;
      uints[15] = 0;
      device.queue.writeBuffer(buffer, 0, data);
      return buffer;
    }

    function makeBindGroup(paramsBuffer: GPUBuffer): GPUBindGroup {
      return device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: paramsBuffer } },
          { binding: 1, resource: { buffer: trianglesBuffer } },
          { binding: 2, resource: { buffer: keysBuffer } },
          { binding: 3, resource: { buffer: triIndicesBuffer } },
          { binding: 4, resource: { buffer: nodesBuffer } },
        ],
      });
    }

    const encoder = device.createCommandEncoder();

    function run(
      pipeline: GPUComputePipeline,
      paramsBuffer: GPUBuffer,
      elementCount: number,
    ): void {
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, makeBindGroup(paramsBuffer));
      pass.dispatchWorkgroups(Math.max(1, Math.ceil(elementCount / 64)));
      pass.end();
    }

    // Morton codes for every padded slot.
    run(mortonPipeline, writeParams({}), paddedCount);

    // Bitonic sort of keys and values together.
    for (let k = 2; k <= paddedCount; k *= 2) {
      for (let j = k >> 1; j > 0; j >>= 1) {
        run(bitonicPipeline, writeParams({ sortK: k, sortJ: j }), paddedCount);
      }
    }

    // One leaf per sorted slot.
    run(leafPipeline, writeParams({}), paddedCount);

    // Parent nodes bottom up. Children are always at a deeper level.
    const levels = Math.log2(paddedCount);
    for (let depth = levels - 1; depth >= 0; depth--) {
      const levelStart = (1 << depth) - 1;
      const levelCount = 1 << depth;
      run(internalPipeline, writeParams({ levelStart, levelCount }), levelCount);
    }

    device.queue.submit([encoder.finish()]);
    result = { nodesBuffer, triIndicesBuffer, nodeCount, paddedCount };
  } catch (error) {
    await device.popErrorScope();
    throw error;
  }

  await device.queue.onSubmittedWorkDone();
  const deviceError = await device.popErrorScope();
  if (deviceError) {
    throw new Error(`GPU BVH build failed: ${deviceError.message}`);
  }
  return result;
}
