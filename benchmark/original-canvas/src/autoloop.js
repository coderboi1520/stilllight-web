const API_NAME = '__STILLLIGHT_ORIGINAL_CANVAS_BENCHMARK__';

const cycleNode = document.querySelector('[data-live="cycle"]');
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
  const totalRAFCallbacks = completed.reduce((sum, result) => sum + (result.totalRAFCallbacks || 0), 0);
  const totalScriptedPours = completed.reduce((sum, result) => sum + (result.totalScriptedPours || 0), 0);
  const totalHintEvents = completed.reduce((sum, result) => sum + (result.totalHintEvents || 0), 0);
  const totalInvalidEvents = completed.reduce((sum, result) => sum + (result.totalInvalidEvents || 0), 0);
  const avgFpsValues = completed.map((result) => result.averageFPS).filter(numeric);
  const onePercentLowValues = completed.map((result) => result.onePercentLowFPS).filter(numeric);
  const p95FrameValues = completed.map((result) => result.p95FrameTimeMs).filter(numeric);
  const p99FrameValues = completed.map((result) => result.p99FrameTimeMs).filter(numeric);
  const worstFrameValues = completed.map((result) => result.worstFrameTimeMs).filter(numeric);
  const renderCpuValues = completed.map((result) => result.averageRenderCpuTimeMs).filter(numeric);
  const updateCpuValues = completed.map((result) => result.averageUpdateSimulationCpuTimeMs).filter(numeric);

  return {
    mode: '10-glass',
    completedCycles: completed.length,
    totalMeasuredDurationMs: round(totalDurationMs),
    effectiveRenderedFPS: totalDurationMs > 0 ? round(renderedFrameCount / (totalDurationMs / 1000)) : 'unavailable',
    meanCycleAverageFPS: round(average(avgFpsValues)),
    meanCycle1PercentLowFPS: round(average(onePercentLowValues)),
    meanP95FrameTimeMs: round(average(p95FrameValues)),
    meanP99FrameTimeMs: round(average(p99FrameValues)),
    worstObservedFrameTimeMs: worstFrameValues.length ? round(Math.max(...worstFrameValues)) : 'unavailable',
    meanRenderCpuTimeMs: round(average(renderCpuValues)),
    meanUpdateSimulationCpuTimeMs: round(average(updateCpuValues)),
    renderedFrameCount,
    totalRAFCallbacks,
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

function renderCompletedCycle(result) {
  completed.push(result);
  const cumulative = cumulativeSummary();
  summary.hidden = false;
  summary.textContent = JSON.stringify({
    latestCycle: result,
    cumulative,
  }, null, 2);
  console.log(`STILLLIGHT_BENCHMARK_CUMULATIVE ${JSON.stringify(cumulative)}`);
}

function startNextCycle() {
  const api = window[API_NAME];
  if (!api) return;
  cycle += 1;
  if (cycleNode) cycleNode.textContent = String(cycle);
  api.startBenchmark();
}

window.addEventListener('stilllight-benchmark-complete', (event) => {
  renderCompletedCycle(event.detail);
  // Restart after the current benchmark frame fully unwinds. There is no user
  // confirmation and no stop state; closing the tab ends the benchmark.
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
