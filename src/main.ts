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

    const apertureRange = document.querySelector<HTMLInputElement>('#apertureRange');
    if (apertureRange) {
      apertureRange.addEventListener('input', () => {
        context.setAperture(Number(apertureRange.value));
      });
    }

    const sunRange = document.querySelector<HTMLInputElement>('#sunRange');
    if (sunRange) {
      sunRange.addEventListener('input', () => {
        context.setSunSize(Number(sunRange.value));
      });
    }

    const skyRange = document.querySelector<HTMLInputElement>('#skyRange');
    if (skyRange) {
      skyRange.addEventListener('input', () => {
        context.setSkyIntensity(Number(skyRange.value));
      });
    }

    const modeNames = ['shaded', 'normal', 'depth'];
    let viewMode = 0;
    window.addEventListener('keydown', (event) => {
      if (event.key === '1' || event.key === '2' || event.key === '3') {
        viewMode = Number(event.key) - 1;
        context.setViewMode(viewMode);
      }
    });

    window.setInterval(() => {
      const stats = context.getStats();
      const mode = modeNames[viewMode] ?? 'shaded';
      status.textContent = `Solstice | ${mode} | samples ${stats.samples} | ${stats.fps.toFixed(0)} fps | drag to orbit`;
    }, 500);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    status.textContent = `WebGPU error: ${message}`;
    console.error(error);
  }
}

void main();
