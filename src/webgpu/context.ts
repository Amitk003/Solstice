import traceSource from '../shaders/bvh.wgsl?raw';
import blitSource from '../shaders/blit.wgsl?raw';
import denoiseSource from '../shaders/denoise.wgsl?raw';
import temporalSource from '../shaders/temporal.wgsl?raw';
import { createCamera, cameraUniformData, orbitCamera } from '../camera/camera';
import { makeTriangles, makeGemMesh, trianglesStorageData } from '../scene/triangles';
import { defaultLights, lightsStorageData } from '../scene/lights';
import { MATERIALS, materialsStorageData } from '../scene/materials';
import { ENV_MAP_WIDTH, ENV_MAP_HEIGHT, makeEnvMapData, toHalfFloatData } from '../scene/envMap';
import { makeGemInstances, instanceWorldBounds, sceneInfoUniformData } from '../scene/instances';
import { buildBvh, nodesToBuffer } from '../bvh/bvh';
import {
  buildGpuBvh,
  triangleSceneBounds,
  bvhNodeCount,
  bvhPaddedCount,
} from '../bvh/gpuBuild';
import { buildInstanceTlas } from '../bvh/tlas';

export interface RenderStats {
  samples: number;
  fps: number;
  bvh: string;
}

export interface RenderContext {
  start: () => void;
  stop: () => void;
  getStats: () => RenderStats;
  captureImage: () => Promise<Blob | null>;
  setBounceEnabled: (enabled: boolean) => void;
  setResolutionScale: (scale: number) => void;
  setViewMode: (mode: number) => void;
  setAperture: (value: number) => void;
  setSunSize: (value: number) => void;
  setSkyIntensity: (value: number) => void;
  setDenoiseEnabled: (enabled: boolean) => void;
  setExposure: (value: number) => void;
  setToneMode: (mode: number) => void;
}

async function encodePng(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Blob | null> {
  const target = document.createElement('canvas');
  target.width = width;
  target.height = height;
  const context = target.getContext('2d');
  if (!context) {
    return null;
  }
  context.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
  return new Promise((resolve) => {
    target.toBlob((blob) => resolve(blob), 'image/png');
  });
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
  const shaderModuleDenoise = device.createShaderModule({ code: denoiseSource });
  const shaderModuleTemporal = device.createShaderModule({ code: temporalSource });

  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shaderModuleTrace, entryPoint: 'main' },
  });

  const denoisePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shaderModuleDenoise, entryPoint: 'main' },
  });

  const temporalPipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shaderModuleTemporal, entryPoint: 'main' },
  });

  // One small uniform buffer per a-trous pass so each pass can use its own
  // step size without rewriting a shared buffer mid frame.
  function makeStepBuffer(step: number): GPUBuffer {
    const buffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, new Uint32Array([step, 0, 0, 0]));
    return buffer;
  }
  const stepBuffer1 = makeStepBuffer(1);
  const stepBuffer2 = makeStepBuffer(2);
  const stepBuffer4 = makeStepBuffer(4);

  // One flag: whether the previous frame is safe to reuse. The temporal pass
  // ignores history on the first frame and after a resize or look change.
  const temporalParamsBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // The environment map is static, so it is created once and never resized.
  const envSampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'clamp-to-edge',
  });
  const envTexture = device.createTexture({
    size: [ENV_MAP_WIDTH, ENV_MAP_HEIGHT],
    format: 'rgba16float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture(
    { texture: envTexture, origin: [0, 0, 0] },
    toHalfFloatData(makeEnvMapData()),
    { bytesPerRow: ENV_MAP_WIDTH * 8, rowsPerImage: ENV_MAP_HEIGHT },
    [ENV_MAP_WIDTH, ENV_MAP_HEIGHT, 1],
  );

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
    size: 192,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  let frameCount = 0;
  let bounceEnabled = true;
  let denoiseEnabled = true;
  let resScale = 1;
  let viewMode = 0;
  let fps = 0;
  let lastTime = 0;
  // The trace accumulation resets on a camera move, but the temporal history
  // survives so the reprojected image stays clean. This flag is cleared after
  // a resize or a lighting change, where the old image is no longer valid.
  let historyValid = false;
  let temporalParity = 0;
  let displayedParity = 0;

  // Static scene plus a unit gem mesh that the instance TLAS reuses. All
  // meshes share one triangle buffer, one node buffer, and one index buffer
  // to stay inside the storage buffer limit.
  const tris = makeTriangles();
  const gemTris = makeGemMesh();
  const allTris = [...tris, ...gemTris];
  const triData = trianglesStorageData(allTris);
  const trianglesBuffer = device.createBuffer({
    size: triData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(trianglesBuffer, 0, triData);

  const staticPadded = bvhPaddedCount(tris.length);
  const staticNodes = bvhNodeCount(tris.length);
  const gemPadded = bvhPaddedCount(gemTris.length);
  const gemNodes = bvhNodeCount(gemTris.length);
  const gemBounds = triangleSceneBounds(gemTris);
  const instances = makeGemInstances();
  const tlasNodeBase = staticNodes + gemNodes;
  const tlasNodeCount = instances.length > 0 ? instances.length * 2 - 1 : 1;
  const totalNodes = staticNodes + gemNodes + tlasNodeCount;

  const bvhNodesBuffer = device.createBuffer({
    size: totalNodes * 48,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const triIndicesBuffer = device.createBuffer({
    size: (staticPadded + gemPadded) * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  let bvhSource = 'gpu';
  try {
    await buildGpuBvh(device, {
      trianglesBuffer,
      nodesBuffer: bvhNodesBuffer,
      triIndicesBuffer,
      triangleBase: 0,
      triangleCount: tris.length,
      nodeBase: 0,
      triIndicesBase: 0,
      bounds: triangleSceneBounds(tris),
    });
  } catch (error) {
    console.warn('GPU BVH build failed. Falling back to the CPU build.', error);
    bvhSource = 'cpu';
    const bvh = buildBvh(tris);
    if (bvh.nodes.length > staticNodes) {
      console.warn('CPU BVH is larger than the reserved static node range.');
    }
    device.queue.writeBuffer(bvhNodesBuffer, 0, nodesToBuffer(bvh.nodes));
    device.queue.writeBuffer(triIndicesBuffer, 0, bvh.triangleIndices);
  }

  let instancesEnabled = true;
  try {
    await buildGpuBvh(device, {
      trianglesBuffer,
      nodesBuffer: bvhNodesBuffer,
      triIndicesBuffer,
      triangleBase: tris.length,
      triangleCount: gemTris.length,
      nodeBase: staticNodes,
      triIndicesBase: staticPadded,
      bounds: gemBounds,
    });
  } catch (error) {
    console.warn('GPU gem BLAS build failed. Instanced gems are disabled.', error);
    instancesEnabled = false;
  }

  const activeInstances = instancesEnabled ? instances : [];
  const tlas = buildInstanceTlas(
    activeInstances.map((instance) => instanceWorldBounds(instance, gemBounds)),
    tlasNodeBase,
  );
  device.queue.writeBuffer(bvhNodesBuffer, tlasNodeBase * 48, nodesToBuffer(tlas.nodes));

  const sceneInfoData = sceneInfoUniformData(staticNodes, tlas.root, activeInstances);
  const sceneInfoBuffer = device.createBuffer({
    size: sceneInfoData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(sceneInfoBuffer, 0, sceneInfoData);

  const lightData = lightsStorageData(defaultLights());
  const lightsBuffer = device.createBuffer({
    size: lightData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(lightsBuffer, 0, lightData);

  const materialData = materialsStorageData(MATERIALS);
  const materialsBuffer = device.createBuffer({
    size: materialData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(materialsBuffer, 0, materialData);

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

  // Display settings for the tone mapper. They only change the tone map,
  // never the traced radiance, so they need no sample reset.
  const displayParamsBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  let exposureValue = 1.2;
  let toneMode = 0;
  const writeDisplayParams = (): void => {
    const data = new Float32Array(4);
    data[0] = exposureValue;
    new Uint32Array(data.buffer)[1] = toneMode;
    device.queue.writeBuffer(displayParamsBuffer, 0, data);
  };
  writeDisplayParams();

  let outputTexture: GPUTexture | null = null;
  let motionTexture: GPUTexture | null = null;
  let temporalA: GPUTexture | null = null;
  let temporalB: GPUTexture | null = null;
  let accumBuffer: GPUBuffer | null = null;
  let gbufferBuffer: GPUBuffer | null = null;
  let gbufferHistoryBuffer: GPUBuffer | null = null;
  let momentsBuffer: GPUBuffer | null = null;
  let filteredA: GPUTexture | null = null;
  let filteredB: GPUTexture | null = null;
  let denoiseBindGroups: GPUBindGroup[] | null = null;
  let computeBindGroup: GPUBindGroup | null = null;
  let temporalBindGroups: GPUBindGroup[][] | null = null;
  let renderBindGroupA: GPUBindGroup | null = null;
  let renderBindGroupB: GPUBindGroup | null = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr * resScale));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr * resScale));
    frameCount = 0;
    historyValid = false;
    temporalParity = 0;
    displayedParity = 0;
    recreateTexture();
  }

  function recreateTexture() {
    if (outputTexture) {
      outputTexture.destroy();
    }
    if (motionTexture) {
      motionTexture.destroy();
    }
    if (temporalA) {
      temporalA.destroy();
    }
    if (temporalB) {
      temporalB.destroy();
    }
    if (accumBuffer) {
      accumBuffer.destroy();
    }
    if (gbufferBuffer) {
      gbufferBuffer.destroy();
    }
    if (gbufferHistoryBuffer) {
      gbufferHistoryBuffer.destroy();
    }
    if (momentsBuffer) {
      momentsBuffer.destroy();
    }
    if (filteredA) {
      filteredA.destroy();
    }
    if (filteredB) {
      filteredB.destroy();
    }

    const size: [number, number] = [canvas.width, canvas.height];
    const colorUsage =
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST;

    outputTexture = device.createTexture({
      size,
      format: 'rgba16float',
      usage: colorUsage,
    });
    motionTexture = device.createTexture({
      size,
      format: 'rgba16float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });
    temporalA = device.createTexture({
      size,
      format: 'rgba16float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });
    temporalB = device.createTexture({
      size,
      format: 'rgba16float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });

    const pixelCount = canvas.width * canvas.height;
    accumBuffer = device.createBuffer({
      size: pixelCount * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    gbufferBuffer = device.createBuffer({
      size: pixelCount * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    gbufferHistoryBuffer = device.createBuffer({
      size: pixelCount * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    momentsBuffer = device.createBuffer({
      size: pixelCount * 8,
      usage: GPUBufferUsage.STORAGE,
    });

    const filterUsage = GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING;
    filteredA = device.createTexture({
      size,
      format: 'rgba16float',
      usage: filterUsage,
    });
    filteredB = device.createTexture({
      size,
      format: 'rgba16float',
      usage: filterUsage,
    });

    const gbuf = gbufferBuffer;
    const gbufHistory = gbufferHistoryBuffer;
    const mob = momentsBuffer;
    const filterA = filteredA;
    const filterB = filteredB;
    const motion = motionTexture;
    const tempA = temporalA;
    const tempB = temporalB;

    computeBindGroup = device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: trianglesBuffer } },
        { binding: 2, resource: { buffer: bvhNodesBuffer } },
        { binding: 3, resource: { buffer: triIndicesBuffer } },
        { binding: 4, resource: outputTexture.createView() },
        { binding: 5, resource: { buffer: accumBuffer } },
        { binding: 6, resource: { buffer: lightsBuffer } },
        { binding: 7, resource: { buffer: materialsBuffer } },
        { binding: 8, resource: { buffer: gbuf } },
        { binding: 9, resource: { buffer: mob } },
        { binding: 10, resource: { buffer: sceneInfoBuffer } },
        { binding: 11, resource: motion.createView() },
        { binding: 12, resource: envTexture.createView() },
        { binding: 13, resource: envSampler },
      ],
    });

    const denoiseLayout = denoisePipeline.getBindGroupLayout(0);
    const makeDenoiseBindGroup = (input: GPUTexture, output: GPUTexture, params: GPUBuffer) =>
      device.createBindGroup({
        layout: denoiseLayout,
        entries: [
          { binding: 0, resource: input.createView() },
          { binding: 1, resource: output.createView() },
          { binding: 2, resource: { buffer: gbuf } },
          { binding: 3, resource: { buffer: mob } },
          { binding: 4, resource: { buffer: params } },
        ],
      });
    denoiseBindGroups = [
      makeDenoiseBindGroup(outputTexture, filterA, stepBuffer1),
      makeDenoiseBindGroup(filterA, filterB, stepBuffer2),
      makeDenoiseBindGroup(filterB, filterA, stepBuffer4),
    ];

    // The temporal pass reads the current frame (raw or filtered) and the
    // previous temporal result, then writes the other temporal texture. Two
    // bind groups per input mode handle the ping pong without rebuilding
    // bind groups every frame.
    const temporalLayout = temporalPipeline.getBindGroupLayout(0);
    const makeTemporalBindGroup = (
      input: GPUTexture,
      history: GPUTexture,
      out: GPUTexture,
    ): GPUBindGroup =>
      device.createBindGroup({
        layout: temporalLayout,
        entries: [
          { binding: 0, resource: input.createView() },
          { binding: 1, resource: history.createView() },
          { binding: 2, resource: motion.createView() },
          { binding: 3, resource: { buffer: gbuf } },
          { binding: 4, resource: { buffer: gbufHistory } },
          { binding: 5, resource: out.createView() },
          { binding: 6, resource: { buffer: temporalParamsBuffer } },
        ],
      });
    temporalBindGroups = [
      [
        makeTemporalBindGroup(outputTexture, tempB, tempA),
        makeTemporalBindGroup(outputTexture, tempA, tempB),
      ],
      [
        makeTemporalBindGroup(filterA, tempB, tempA),
        makeTemporalBindGroup(filterA, tempA, tempB),
      ],
    ];

    const renderLayout = renderPipeline.getBindGroupLayout(0);
    renderBindGroupA = device.createBindGroup({
      layout: renderLayout,
      entries: [
        { binding: 0, resource: tempA.createView() },
        { binding: 1, resource: sampler },
        { binding: 2, resource: { buffer: displayParamsBuffer } },
      ],
    });
    renderBindGroupB = device.createBindGroup({
      layout: renderLayout,
      entries: [
        { binding: 0, resource: tempB.createView() },
        { binding: 1, resource: sampler },
        { binding: 2, resource: { buffer: displayParamsBuffer } },
      ],
    });
  }

  function activeRenderBindGroup(): GPUBindGroup | null {
    return displayedParity === 0 ? renderBindGroupA : renderBindGroupB;
  }

  // Draw the tonemapped frame into an offscreen texture, copy it to a
  // buffer, then build a PNG from the pixels. This avoids depending on
  // canvas readback, which can return an empty image for WebGPU canvases.
  async function captureImage(): Promise<Blob | null> {
    const activeBindGroup = activeRenderBindGroup();
    if (!outputTexture || !activeBindGroup) {
      return null;
    }
    const width = canvas.width;
    const height = canvas.height;
    const bytesPerRow = Math.ceil((width * 4) / 256) * 256;

    const captureTexture = device.createTexture({
      size: [width, height],
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
    const readBuffer = device.createBuffer({
      size: bytesPerRow * height,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: captureTexture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(renderPipeline);
    pass.setBindGroup(0, activeBindGroup);
    pass.draw(3);
    pass.end();

    encoder.copyTextureToBuffer(
      { texture: captureTexture },
      { buffer: readBuffer, bytesPerRow, rowsPerImage: height },
      [width, height],
    );
    device.queue.submit([encoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const mapped = new Uint8Array(readBuffer.getMappedRange());
    const pixels = new Uint8ClampedArray(width * height * 4);
    const swapRedBlue = format === 'bgra8unorm';
    for (let y = 0; y < height; y++) {
      const source = y * bytesPerRow;
      const destination = y * width * 4;
      for (let x = 0; x < width; x++) {
        const s = source + x * 4;
        const d = destination + x * 4;
        const red = mapped[s] ?? 0;
        const green = mapped[s + 1] ?? 0;
        const blue = mapped[s + 2] ?? 0;
        const alpha = mapped[s + 3] ?? 0;
        if (swapRedBlue) {
          pixels[d] = blue;
          pixels[d + 1] = green;
          pixels[d + 2] = red;
          pixels[d + 3] = alpha;
        } else {
          pixels[d] = red;
          pixels[d + 1] = green;
          pixels[d + 2] = blue;
          pixels[d + 3] = alpha;
        }
      }
    }
    readBuffer.unmap();
    readBuffer.destroy();
    captureTexture.destroy();

    return encodePng(pixels, width, height);
  }

  resize();
  window.addEventListener('resize', resize);

  let running = false;
  let raf = 0;

  function frame() {
    if (
      !running ||
      !outputTexture ||
      !motionTexture ||
      !accumBuffer ||
      !gbufferBuffer ||
      !gbufferHistoryBuffer ||
      !computeBindGroup ||
      !temporalBindGroups
    ) {
      return;
    }
    const gbuf = gbufferBuffer;
    const gbufHistory = gbufferHistoryBuffer;
    const parity = temporalParity;
    const modeIndex = denoiseEnabled ? 1 : 0;
    const temporalGroup = temporalBindGroups[modeIndex]?.[parity];
    displayedParity = parity;
    const activeBindGroup = activeRenderBindGroup();
    if (!activeBindGroup || !temporalGroup) {
      return;
    }

    const useHistory = historyValid;
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
    const flags = (bounceEnabled ? 1 : 0) | (viewMode << 1);
    const uniformData = cameraUniformData(camera, aspect, frameCount, flags, useHistory);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
    device.queue.writeBuffer(
      temporalParamsBuffer,
      0,
      new Uint32Array([useHistory ? 1 : 0, 0, 0, 0]),
    );

    const computePass = encoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    const groupsX = Math.ceil(canvas.width / 8);
    const groupsY = Math.ceil(canvas.height / 8);
    computePass.dispatchWorkgroups(groupsX, groupsY);
    computePass.end();

    // Three a-trous passes with step sizes 1, 2, and 4. Each pass gets its
    // own compute pass so the next one sees the previous result.
    if (denoiseEnabled && denoiseBindGroups) {
      for (const bindGroup of denoiseBindGroups) {
        const denoisePass = encoder.beginComputePass();
        denoisePass.setPipeline(denoisePipeline);
        denoisePass.setBindGroup(0, bindGroup);
        denoisePass.dispatchWorkgroups(groupsX, groupsY);
        denoisePass.end();
      }
    }

    // Blend the filtered frame with the reprojected previous frame. Raw mode
    // skips the a-trous chain but still gets the temporal history.
    const temporalPass = encoder.beginComputePass();
    temporalPass.setPipeline(temporalPipeline);
    temporalPass.setBindGroup(0, temporalGroup);
    temporalPass.dispatchWorkgroups(groupsX, groupsY);
    temporalPass.end();

    encoder.copyBufferToBuffer(gbuf, 0, gbufHistory, 0, canvas.width * canvas.height * 16);

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
    pass.setBindGroup(0, activeBindGroup);
    pass.draw(3);
    pass.end();

    device.queue.submit([encoder.finish()]);
    historyValid = true;
    temporalParity = parity ^ 1;
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
    getStats: () => ({ samples: frameCount, fps, bvh: bvhSource }),
    captureImage,
    setBounceEnabled: (enabled: boolean) => {
      bounceEnabled = enabled;
      frameCount = 0;
      historyValid = false;
    },
    setDenoiseEnabled: (enabled: boolean) => {
      denoiseEnabled = enabled;
      historyValid = false;
    },
    setResolutionScale: (scale: number) => {
      const clamped = Math.max(0.25, Math.min(1, scale));
      if (clamped !== resScale) {
        resScale = clamped;
        resize();
      }
    },
    setViewMode: (mode: number) => {
      const clamped = Math.max(0, Math.min(2, Math.floor(mode)));
      if (clamped !== viewMode) {
        viewMode = clamped;
        frameCount = 0;
        historyValid = false;
      }
    },
    setAperture: (value: number) => {
      camera.aperture = Math.max(0, value);
      frameCount = 0;
      historyValid = false;
    },
    setSunSize: (value: number) => {
      camera.sunSize = Math.max(0, value);
      frameCount = 0;
      historyValid = false;
    },
    setSkyIntensity: (value: number) => {
      camera.skyIntensity = Math.max(0, value);
      frameCount = 0;
      historyValid = false;
    },
    setExposure: (value: number) => {
      exposureValue = Math.max(0.1, Math.min(4, value));
      writeDisplayParams();
    },
    setToneMode: (mode: number) => {
      toneMode = Math.max(0, Math.min(2, Math.floor(mode)));
      writeDisplayParams();
    },
  };
}
