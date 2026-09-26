const API_NAME = '__STILLLIGHT_ORIGINAL_CANVAS_BENCHMARK__';

const cycleNode = document.querySelector('[data-live="cycle"]');
const minFpsNode = document.querySelector('[data-live="min-fps"]');
const avgFpsNode = document.querySelector('[data-live="avg-fps"]');
const maxFpsNode = document.querySelector('[data-live="max-fps"]');
const summary = document.querySelector('.summary');

let cycle = 0;
const completed = [];

const numeric = (value) => typeof value === 'number' && Number.isFinite(value);
const average = (values) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null;
const round = (value) => numeric(value) ? Number(value.toFixed(3)) : 'unavailable';

function cumulativeSummary() {
  const totalDurationMs = completed.reduce((sum, result) => sum + (numeric(result.totalDurationMs) ? result.totalDurationMs : 0), 0);
  const renderedFrameCount = completed.reduce((sum, result) => sum + (result.renderedFrameCount || 0), 0);
  const totalFrameCallbacks = completed.reduce((sum, result) => sum + (result.totalFrameCallbacks || result.totalRAFCallbacks || 0), 0);
  const totalScriptedPours = completed.reduce((sum, result) => sum + (result.totalScriptedPours || 0), 0);
  const totalHintEvents = completed.reduce((sum, result) => sum + (result.totalHintEvents || 0), 0);
  const totalInvalidEvents = completed.reduce((sum, result) => sum + (result.totalInvalidEvents || 0), 0);
  const minimumValues = completed.map((result) => result.minimumFPS).filter(numeric);
  const averageValues = completed.map((result) => result.averageFPS).filter(numeric);
  const maximumValues = completed.map((result) => result.maximumFPS).filter(numeric);
  const onePercentLowValues = completed.map((result) => result.onePercentLowFPS).filter(numeric);
  const p95FrameValues = completed.map((result) => result.p95FrameTimeMs).filter(numeric);
  const p99FrameValues = completed.map((result) => result.p99FrameTimeMs).filter(numeric);
  const worstFrameValues = completed.map((result) => result.worstFrameTimeMs).filter(numeric);
  const renderCpuValues = completed.map((result) => result.averageRenderCpuTimeMs).filter(numeric);
  const updateCpuValues = completed.map((result) => result.averageUpdateSimulationCpuTimeMs).filter(numeric);

  return {
    mode: '10-glass',
    scheduler: 'uncapped-message-channel',
    fpsMeaning: 'render-loop-throughput',
    completedCycles: completed.length,
    totalMeasuredDurationMs: round(totalDurationMs),
    minimumFPSObserved: minimumValues.length ? round(Math.min(...minimumValues)) : 'unavailable',
    averageFPSAcrossCycles: round(average(averageValues)),
    maximumFPSObserved: maximumValues.length ? round(Math.max(...maximumValues)) : 'unavailable',
    effectiveRenderedFPS: totalDurationMs > 0 ? round(renderedFrameCount / (totalDurationMs / 1000)) : 'unavailable',
    meanCycle1PercentLowFPS: round(average(onePercentLowValues)),
    meanP95FrameTimeMs: round(average(p95FrameValues)),
    meanP99FrameTimeMs: round(average(p99FrameValues)),
    worstObservedFrameTimeMs: worstFrameValues.length ? round(Math.max(...worstFrameValues)) : 'unavailable',
    meanRenderCpuTimeMs: round(average(renderCpuValues)),
    meanUpdateSimulationCpuTimeMs: round(average(updateCpuValues)),
    renderedFrameCount,
    totalFrameCallbacks,
    totalScriptedPours,
    totalHintEvents,
    totalInvalidEvents,
    peakSimultaneousActivePours: completed.length
      ? Math.max(...completed.map((result) => result.peakSimultaneousActivePours || 0))
      : 0,
    peakSimultaneouslyAnimatedGlasses: completed.length
      ? Math.max(...completed.map((result) => result.peakSimultaneouslyAnimatedGlasses || 0))
      : 0,
  };
}

function renderSummary() {
  if (!completed.length) {
    summary.hidden = false;
    summary.textContent = 'Waiting for first completed cycle…';
    return;
  }
  summary.hidden = false;
  summary.textContent = JSON.stringify({
    latestCycle: completed.at(-1),
    cumulative: cumulativeSummary(),
  }, null, 2);
}

function renderCompletedCycle(result) {
  completed.push(result);
  if (minFpsNode) minFpsNode.textContent = numeric(result.minimumFPS) ? result.minimumFPS.toFixed(1) : '—';
  if (avgFpsNode) avgFpsNode.textContent = numeric(result.averageFPS) ? result.averageFPS.toFixed(1) : '—';
  if (maxFpsNode) maxFpsNode.textContent = numeric(result.maximumFPS) ? result.maximumFPS.toFixed(1) : '—';
  renderSummary();
  console.log(`STILLLIGHT_BENCHMARK_CUMULATIVE ${JSON.stringify(cumulativeSummary())}`);
}

function startNextCycle() {
  const api = window[API_NAME];
  if (!api) return;
  cycle += 1;
  if (cycleNode) cycleNode.textContent = String(cycle);
  api.startBenchmark();
  // main.js clears the per-run summary when it starts. Restore the latest
  // cumulative report immediately so completed-cycle stats stay visible.
  renderSummary();
}

window.addEventListener('stilllight-benchmark-complete', (event) => {
  renderCompletedCycle(event.detail);
  // Restart after the completed benchmark frame fully unwinds. There is no user
  // confirmation or stop state; closing the tab ends the benchmark.
  queueMicrotask(startNextCycle);
});

function boot() {
  const api = window[API_NAME];
  if (!api) {
    requestAnimationFrame(boot);
    return;
  }
  api.setMode('10-glass');
  startNextCycle();
}

boot();
