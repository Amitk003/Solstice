import { initWebGpu } from './webgpu/context';

async function main(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
  const status = document.querySelector<HTMLDivElement>('#status');
  if (!canvas || !status) {
    throw new Error('Required DOM elements were not found.');
  }

  try {
    const context = await initWebGpu(canvas);
    context.start();

    const toggle = document.querySelector<HTMLInputElement>('#bounceToggle');
    if (toggle) {
      toggle.addEventListener('change', () => {
        context.setBounceEnabled(toggle.checked);
      });
    }

    const resSelect = document.querySelector<HTMLSelectElement>('#resSelect');
    if (resSelect) {
      resSelect.addEventListener('change', () => {
        context.setResolutionScale(Number(resSelect.value));
      });
    }

    window.setInterval(() => {
      const stats = context.getStats();
      status.textContent = `Solstice | samples ${stats.samples} | ${stats.fps.toFixed(0)} fps | drag to orbit`;
    }, 500);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    status.textContent = `WebGPU error: ${message}`;
    console.error(error);
  }
}

void main();
