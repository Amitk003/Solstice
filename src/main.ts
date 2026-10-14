import { initWebGpu } from './webgpu/context';

async function main(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
  const status = document.querySelector<HTMLDivElement>('#status');
  if (!canvas || !status) {
    throw new Error('Required DOM elements were not found.');
  }

  try {
    const context = await initWebGpu(canvas);
    status.textContent = 'WebGPU ready. Rendering...';
    context.start();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    status.textContent = `WebGPU error: ${message}`;
    console.error(error);
  }
}

void main();
