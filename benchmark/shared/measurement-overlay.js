const WARMUP_MS = 2000;
const SAMPLE_MS = 250;

const scheduler = window.__STILLLIGHT_BENCHMARK_SCHEDULER__;
const fpsNode = document.querySelector('[data-live="fps"]');
const elapsedNode = document.querySelector('[data-live="elapsed"]');
const phaseNode = document.querySelector('[data-measure="phase"]');
const fpsLabelNode = document.querySelector('[data-measure="fps-label"]');
const schedulerNode = document.querySelector('[data-scheduler-label]');
const targetSelect = document.querySelector('[data-fps-target]');
const budgetNode = document.querySelector('[data-measure="frame-budget"]');
const missedNode = document.querySelector('[data-measure="missed-frames"]');
const minNode = document.querySelector('[data-measure="min-fps"]');
const avgNode = document.querySelector('[data-measure="avg-fps"]');
const maxNode = document.querySelector('[data-measure="max-fps"]');
const lowNode = document.querySelector('[data-measure="one-low"]');
const p95Node = document.querySelector('[data-measure="p95-ms"]');
const p99Node = document.querySelector('[data-measure="p99-ms"]');

const fpsSamples = [];
const frameSamples = [];
let targetChangedAt = performance.now();

function percentile(sorted, q) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * q) - 1))];
}

function resetMeasuredStats() {
  fpsSamples.length = 0;
  frameSamples.length = 0;
  targetChangedAt = performance.now();
  for (const node of [minNode, avgNode, maxNode, lowNode, p95Node, p99Node, missedNode]) {
    if (node) node.textContent = '—';
  }
  if (phaseNode) phaseNode.textContent = 'Warmup';
}

function refreshTargetUi() {
  const target = scheduler?.targetFps || 0;
  const budget = scheduler?.frameBudgetMs || 0;
  if (schedulerNode) schedulerNode.textContent = target ? `${target} FPS` : 'Uncapped';
  if (fpsLabelNode) fpsLabelNode.textContent = target ? 'Actual FPS' : 'CPU Throughput';
  if (budgetNode) budgetNode.textContent = budget ? `${budget.toFixed(2)} ms` : '—';
  if (targetSelect) targetSelect.value = String(target);
}

function updateMeasuredStats() {
  const elapsedSeconds = Number.parseFloat(elapsedNode?.textContent || '0');
  const elapsedMs = Number.isFinite(elapsedSeconds) ? elapsedSeconds * 1000 : 0;
  const sinceTargetChange = performance.now() - targetChangedAt;

  // Every benchmark cycle has its own warmup, and changing target starts a fresh one.
  if (elapsedMs < WARMUP_MS || sinceTargetChange < WARMUP_MS) {
    if (phaseNode) phaseNode.textContent = 'Warmup';
    return;
  }

  if (phaseNode) phaseNode.textContent = 'Measure';
  const fps = Number.parseFloat(fpsNode?.textContent || '');
  if (!Number.isFinite(fps) || fps <= 0) return;

  const frameMs = 1000 / fps;
  fpsSamples.push(fps);
  frameSamples.push(frameMs);

  // Bound memory for tabs intentionally left running indefinitely.
  if (fpsSamples.length > 4096) {
    fpsSamples.splice(0, 1024);
    frameSamples.splice(0, 1024);
  }

  let min = Infinity;
  let max = 0;
  let sum = 0;
  for (const value of fpsSamples) {
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  }

  const avg = sum / fpsSamples.length;
  const sortedFrames = [...frameSamples].sort((a, b) => a - b);
  const slowCount = Math.max(1, Math.ceil(sortedFrames.length * 0.01));
  let slowSum = 0;
  for (let i = sortedFrames.length - slowCount; i < sortedFrames.length; i++) slowSum += sortedFrames[i];
  const oneLow = 1000 / (slowSum / slowCount);
  const p95 = percentile(sortedFrames, 0.95);
  const p99 = percentile(sortedFrames, 0.99);
  const budget = scheduler?.frameBudgetMs || 0;
  const missed = budget > 0
    ? frameSamples.filter((value) => value > budget).length / frameSamples.length * 100
    : null;

  if (minNode) minNode.textContent = min.toFixed(1);
  if (avgNode) avgNode.textContent = avg.toFixed(1);
  if (maxNode) maxNode.textContent = max.toFixed(1);
  if (lowNode) lowNode.textContent = oneLow.toFixed(1);
  if (p95Node) p95Node.textContent = `${p95.toFixed(3)} ms`;
  if (p99Node) p99Node.textContent = `${p99.toFixed(3)} ms`;
  if (missedNode) missedNode.textContent = missed === null ? '—' : `${missed.toFixed(1)}%`;
}

if (targetSelect && scheduler?.setTargetFps) {
  targetSelect.addEventListener('change', () => {
    scheduler.setTargetFps(Number(targetSelect.value));
    resetMeasuredStats();
    refreshTargetUi();
  });
}

window.addEventListener('stilllight-benchmark-fps-target', () => {
  resetMeasuredStats();
  refreshTargetUi();
});

refreshTargetUi();
window.setInterval(updateMeasuredStats, SAMPLE_MS);
