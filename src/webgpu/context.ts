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
  const context = canvas.getContext('webgpu');
  if (!context) {
    throw new Error('Failed to get WebGPU canvas context.');
  }
  const canvasContext = context;

  const format = navigator.gpu.getPreferredCanvasFormat();
  canvasContext.configure({ device, format, alphaMode: 'opaque' });

  let running = false;
  let raf = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  }

  resize();
  window.addEventListener('resize', resize);

  function frame() {
    if (!running) {
      return;
    }

    const view = canvasContext.getCurrentTexture().createView();
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: { r: 0.05, g: 0.07, b: 0.1, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
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
