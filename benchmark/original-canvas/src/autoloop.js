const API_NAME = '__STILLLIGHT_ORIGINAL_CANVAS_BENCHMARK__';
const CYCLE_MS = 13250;
const SAMPLE_MS = 250;

const cycleNode = document.querySelector('[data-live="cycle"]');
const currentFpsNode = document.querySelector('[data-live="fps"]');
const minFpsNode = document.querySelector('[data-live="min-fps"]');
const avgFpsNode = document.querySelector('[data-live="avg-fps"]');
const maxFpsNode = document.querySelector('[data-live="max-fps"]');

let cycle = 0;
let cycleTimer = 0;
let sampleTimer = 0;
let minFps = Infinity;
let maxFps = 0;
let fpsSum = 0;
let fpsSamples = 0;

function sampleFps() {
  const fps = Number.parseFloat(currentFpsNode?.textContent || '');
  if (Number.isFinite(fps) && fps > 0) {
    minFps = Math.min(minFps, fps);
    maxFps = Math.max(maxFps, fps);
    fpsSum += fps;
    fpsSamples += 1;

    if (minFpsNode) minFpsNode.textContent = minFps.toFixed(1);
    if (avgFpsNode) avgFpsNode.textContent = (fpsSum / fpsSamples).toFixed(1);
    if (maxFpsNode) maxFpsNode.textContent = maxFps.toFixed(1);
  }
  sampleTimer = window.setTimeout(sampleFps, SAMPLE_MS);
}

function startNextCycle() {
  const api = window[API_NAME];
  if (!api) return;

  cycle += 1;
  if (cycleNode) cycleNode.textContent = String(cycle);

  // Restart immediately after the final authored settle window. This avoids the
  // old ~1.7 s idle tail and keeps the stress workload visually continuous.
  api.startBenchmark();
  cycleTimer = window.setTimeout(startNextCycle, CYCLE_MS);
}

function boot() {
  const api = window[API_NAME];
  if (!api) {
    requestAnimationFrame(boot);
    return;
  }

  api.setMode('10-glass');
  sampleTimer = window.setTimeout(sampleFps, SAMPLE_MS);
  startNextCycle();
}

window.addEventListener('pagehide', () => {
  clearTimeout(cycleTimer);
  clearTimeout(sampleTimer);
});

boot();
