import { initWebGpu } from './webgpu/context';
import { webGpuSupportMessage } from './webgpu/support';

async function main(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
  const status = document.querySelector<HTMLDivElement>('#status');
  if (!canvas || !status) {
    throw new Error('Required DOM elements were not found.');
  }

  try {
    const supportMessage = webGpuSupportMessage();
    if (supportMessage) {
      status.textContent = supportMessage;
      return;
    }

    const context = await initWebGpu(canvas);
    context.start();

    const toggle = document.querySelector<HTMLInputElement>('#bounceToggle');
    if (toggle) {
      toggle.addEventListener('change', () => {
        context.setBounceEnabled(toggle.checked);
      });
    }

    const denoiseToggle = document.querySelector<HTMLInputElement>('#denoiseToggle');
    if (denoiseToggle) {
      denoiseToggle.addEventListener('change', () => {
        context.setDenoiseEnabled(denoiseToggle.checked);
      });
    }

    const autoOrbitToggle = document.querySelector<HTMLInputElement>('#autoOrbitToggle');
    if (autoOrbitToggle) {
      autoOrbitToggle.addEventListener('change', () => {
        context.setAutoOrbit(autoOrbitToggle.checked);
      });
    }

    const resSelect = document.querySelector<HTMLSelectElement>('#resSelect');
    if (resSelect) {
      resSelect.addEventListener('change', () => {
        context.setResolutionScale(resSelect.value === 'auto' ? -1 : Number(resSelect.value));
      });
    }

    const apertureRange = document.querySelector<HTMLInputElement>('#apertureRange');
    if (apertureRange) {
      apertureRange.addEventListener('input', () => {
        context.setAperture(Number(apertureRange.value));
      });
    }

    const focusRange = document.querySelector<HTMLInputElement>('#focusRange');
    if (focusRange) {
      focusRange.addEventListener('input', () => {
        context.setFocusOffset(Number(focusRange.value));
      });
    }

    const sunRange = document.querySelector<HTMLInputElement>('#sunRange');
    if (sunRange) {
      sunRange.addEventListener('input', () => {
        context.setSunSize(Number(sunRange.value));
      });
    }

    const sunAngleRange = document.querySelector<HTMLInputElement>('#sunAngleRange');
    if (sunAngleRange) {
      sunAngleRange.addEventListener('input', () => {
        context.setSunAngle(Number(sunAngleRange.value));
      });
    }

    const sunHeightRange = document.querySelector<HTMLInputElement>('#sunHeightRange');
    if (sunHeightRange) {
      sunHeightRange.addEventListener('input', () => {
        context.setSunElevation(Number(sunHeightRange.value));
      });
    }

    const keyLightRange = document.querySelector<HTMLInputElement>('#keyLightRange');
    if (keyLightRange) {
      keyLightRange.addEventListener('input', () => {
        context.setKeyLightIntensity(Number(keyLightRange.value));
      });
    }

    const fillLightRange = document.querySelector<HTMLInputElement>('#fillLightRange');
    if (fillLightRange) {
      fillLightRange.addEventListener('input', () => {
        context.setFillLightIntensity(Number(fillLightRange.value));
      });
    }

    const skyRange = document.querySelector<HTMLInputElement>('#skyRange');
    if (skyRange) {
      skyRange.addEventListener('input', () => {
        context.setSkyIntensity(Number(skyRange.value));
      });
    }

    const exposureRange = document.querySelector<HTMLInputElement>('#exposureRange');
    if (exposureRange) {
      exposureRange.addEventListener('input', () => {
        context.setExposure(Number(exposureRange.value));
      });
    }

    const toneSelect = document.querySelector<HTMLSelectElement>('#toneSelect');
    if (toneSelect) {
      toneSelect.addEventListener('change', () => {
        context.setToneMode(Number(toneSelect.value));
      });
    }

    const vignetteToggle = document.querySelector<HTMLInputElement>('#vignetteToggle');
    if (vignetteToggle) {
      vignetteToggle.addEventListener('change', () => {
        context.setVignette(vignetteToggle.checked);
      });
    }

    const presetButtons = document.querySelectorAll<HTMLButtonElement>('.presetButton');
    presetButtons.forEach((button) => {
      button.addEventListener('click', () => {
        context.setCameraPreset(Number(button.dataset.preset ?? '0'));
      });
    });

    const saveButton = document.querySelector<HTMLButtonElement>('#saveButton');
    if (saveButton) {
      saveButton.addEventListener('click', async () => {
        saveButton.disabled = true;
        try {
          const blob = await context.captureImage();
          if (!blob) {
            return;
          }
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `solstice-${Date.now()}.png`;
          link.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } finally {
          saveButton.disabled = false;
        }
      });
    }

    const modeNames = ['shaded', 'normal', 'depth', 'albedo', 'roughness', 'emission'];
    let viewMode = 0;
    window.addEventListener('keydown', (event) => {
      if (event.key === '1' || event.key === '2' || event.key === '3' || event.key === '4' || event.key === '5' || event.key === '6') {
        viewMode = Number(event.key) - 1;
        context.setViewMode(viewMode);
      }
    });

    window.setInterval(() => {
      const stats = context.getStats();
      const mode = modeNames[viewMode] ?? 'shaded';
      status.textContent = `Solstice | ${mode} | samples ${stats.samples} | ${stats.fps.toFixed(0)} fps | ${stats.ms.toFixed(1)} ms | ${stats.width}x${stats.height} | ~${stats.gpuMemoryMB.toFixed(0)} MB | bvh ${stats.bvh} | drag to orbit, wheel to zoom`;
    }, 500);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    status.textContent = `WebGPU error: ${message}`;
    console.error(error);
  }
}

void main();
