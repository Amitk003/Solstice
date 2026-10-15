import traceSource from '../shaders/bvh.wgsl?raw';
import blitSource from '../shaders/blit.wgsl?raw';
import { createCamera, cameraUniformData, orbitCamera } from '../camera/camera';
import { makeTriangles, trianglesStorageData } from '../scene/triangles';
import { buildBvh, nodesToBuffer } from '../bvh/bvh';

export interface RenderStats {
  samples: number;
  fps: number;
}

export interface RenderContext {
  start: () => void;
  stop: () => void;
  getStats: () => RenderStats;
  setBounceEnabled: (enabled: boolean) => void;
}

export async function initWebGpu(canvas: HTMLCanvasElement): Promise<RenderContext> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser.');
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('No suitable GPU adapter found.');
  }

  const device = await adapter.requestDevice();
  const canvasContext = canvas.getContext('webgpu');
  if (!canvasContext) {
    throw new Error('Failed to get WebGPU canvas context.');
  }
  const gpuCanvasContext = canvasContext;

  const format = navigator.gpu.getPreferredCanvasFormat();
  gpuCanvasContext.configure({ device, format, alphaMode: 'opaque' });

  const shaderModuleTrace = device.createShaderModule({ code: traceSource });
  const shaderModuleBlit = device.createShaderModule({ code: blitSource });

  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shaderModuleTrace, entryPoint: 'main' },
  });

  const camera = createCamera();

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) {
      return;
    }
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    orbitCamera(camera, dx * 0.005, dy * 0.005);
    frameCount = 0;
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
    canvas.style.cursor = 'grab';
  });
  const uniformBuffer = device.createBuffer({
    size: 112,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  let frameCount = 0;
  let bounceEnabled = true;
  let fps = 0;
  let lastTime = 0;

  const tris = makeTriangles();
  const triData = trianglesStorageData(tris);
  const trianglesBuffer = device.createBuffer({
    size: triData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(trianglesBuffer, 0, triData);

  const bvh = buildBvh(tris);
  const nodesBuffer = nodesToBuffer(bvh.nodes);
  const bvhNodesBuffer = device.createBuffer({
    size: nodesBuffer.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(bvhNodesBuffer, 0, nodesBuffer);

  const triIndicesBuffer = device.createBuffer({
    size: bvh.triangleIndices.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(triIndicesBuffer, 0, bvh.triangleIndices);

  const renderPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: shaderModuleBlit, entryPoint: 'vs' },
    fragment: {
      module: shaderModuleBlit,
      entryPoint: 'fs',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
  });

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  let outputTexture: GPUTexture | null = null;
  let accumBuffer: GPUBuffer | null = null;
  let computeBindGroup: GPUBindGroup | null = null;
  let renderBindGroup: GPUBindGroup | null = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    frameCount = 0;
    recreateTexture();
  }

  function recreateTexture() {
    if (outputTexture) {
      outputTexture.destroy();
    }
    if (accumBuffer) {
      accumBuffer.destroy();
    }

    outputTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: 'rgba16float',
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST,
    });

    accumBuffer = device.createBuffer({
      size: canvas.width * canvas.height * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    computeBindGroup = device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: trianglesBuffer } },
        { binding: 2, resource: { buffer: bvhNodesBuffer } },
        { binding: 3, resource: { buffer: triIndicesBuffer } },
        { binding: 4, resource: outputTexture.createView() },
        { binding: 5, resource: { buffer: accumBuffer } },
      ],
    });

    renderBindGroup = device.createBindGroup({
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: outputTexture.createView() },
        { binding: 1, resource: sampler },
      ],
    });
  }

  resize();
  window.addEventListener('resize', resize);

  let running = false;
  let raf = 0;

  function frame() {
    if (!running || !outputTexture || !accumBuffer || !computeBindGroup || !renderBindGroup) {
      return;
    }

    const encoder = device.createCommandEncoder();

    const now = performance.now();
    if (lastTime > 0) {
      const dt = now - lastTime;
      if (dt > 0) {
        const instant = 1000 / dt;
        fps = fps === 0 ? instant : fps * 0.9 + instant * 0.1;
      }
    }
    lastTime = now;

    const aspect = canvas.width / canvas.height;
    const flags = bounceEnabled ? 1 : 0;
    const uniformData = cameraUniformData(camera, aspect, frameCount, flags);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const computePass = encoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    const groupsX = Math.ceil(canvas.width / 8);
    const groupsY = Math.ceil(canvas.height / 8);
    computePass.dispatchWorkgroups(groupsX, groupsY);
    computePass.end();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: gpuCanvasContext.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(renderPipeline);
    pass.setBindGroup(0, renderBindGroup);
    pass.draw(3);
    pass.end();

    device.queue.submit([encoder.finish()]);
    frameCount = Math.min(frameCount + 1, 1024);
    raf = requestAnimationFrame(frame);
  }

  return {
    start: () => {
      if (running) {
        return;
      }
      running = true;
      raf = requestAnimationFrame(frame);
    },
    stop: () => {
      running = false;
      if (raf) {
        cancelAnimationFrame(raf);
      }
    },
    getStats: () => ({ samples: frameCount, fps }),
    setBounceEnabled: (enabled: boolean) => {
      bounceEnabled = enabled;
      frameCount = 0;
    },
  };
}
