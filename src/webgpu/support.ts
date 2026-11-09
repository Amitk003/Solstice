// WebGPU availability checks. This keeps unsupported browsers from a
// blank canvas and a generic JavaScript error.

export function webGpuSupportMessage(): string | null {
  if (typeof window === 'undefined') {
    return 'Solstice needs a browser window.';
  }
  if (!('gpu' in navigator) || !navigator.gpu) {
    return 'WebGPU is not available in this browser. Use a current Chromium browser or Safari with WebGPU enabled.';
  }
  if (!window.isSecureContext) {
    return 'Solstice needs a secure context. Open it over HTTPS or localhost.';
  }
  if (typeof navigator.gpu.requestAdapter !== 'function') {
    return 'This browser exposes a partial WebGPU API and cannot create an adapter.';
  }
  return null;
}
