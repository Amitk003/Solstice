import gradientSource from '../shaders/gradient.wgsl?raw';
import blitSource from '../shaders/blit.wgsl?raw';

export interface RenderContext {
  start: () => void;
  stop: () => void;
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

  const shaderModuleGradient = device.createShaderModule({ code: gradientSource });
  const shaderModuleBlit = device.createShaderModule({ code: blitSource });

  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shaderModuleGradient, entryPoint: 'main' },
  });

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
  let computeBindGroup: GPUBindGroup | null = null;
  let renderBindGroup: GPUBindGroup | null = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    recreateTexture();
  }

  function recreateTexture() {
    if (outputTexture) {
      outputTexture.destroy();
    }

    outputTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST,
    });

    computeBindGroup = device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: outputTexture.createView() }],
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
    if (!running || !outputTexture || !computeBindGroup || !renderBindGroup) {
      return;
    }

    const encoder = device.createCommandEncoder();

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
  };
}
