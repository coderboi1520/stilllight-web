// Shared benchmark-only scheduler. Both benchmark implementations use this exact
// scheduler so pacing is never a comparison variable.
// Target 0 = uncapped MessageChannel throughput; otherwise pace at the selected FPS.
const callbacks = new Map();
let nextId = 1;
let targetFps = 0;
let nextDeadline = 0;
const channel = new MessageChannel();

function frameBudgetMs() {
  return targetFps > 0 ? 1000 / targetFps : 0;
}

function scheduleId(id) {
  const entry = callbacks.get(id);
  if (!entry) return;
  if (entry.timer) clearTimeout(entry.timer);
  entry.generation += 1;
  const generation = entry.generation;

  if (targetFps <= 0) {
    channel.port2.postMessage({ id, generation });
    return;
  }

  const now = performance.now();
  const interval = frameBudgetMs();
  if (!nextDeadline || now > nextDeadline + interval) nextDeadline = now + interval;
  else nextDeadline += interval;
  const delay = Math.max(0, nextDeadline - now);
  entry.timer = setTimeout(() => {
    entry.timer = 0;
    channel.port2.postMessage({ id, generation });
  }, delay);
}

channel.port1.onmessage = (event) => {
  const { id, generation } = event.data || {};
  const entry = callbacks.get(id);
  if (!entry || entry.generation !== generation) return;
  callbacks.delete(id);
  entry.callback(performance.now());
};

window.requestAnimationFrame = (callback) => {
  const id = nextId++;
  callbacks.set(id, { callback, timer: 0, generation: 0 });
  scheduleId(id);
  return id;
};

window.cancelAnimationFrame = (id) => {
  const entry = callbacks.get(id);
  if (entry?.timer) clearTimeout(entry.timer);
  callbacks.delete(id);
};

function setTargetFps(value) {
  const parsed = Number(value);
  const next = [0, 60, 75, 90, 120].includes(parsed) ? parsed : 0;
  if (next === targetFps) return;
  targetFps = next;
  nextDeadline = 0;
  for (const id of callbacks.keys()) scheduleId(id);
  window.dispatchEvent(new CustomEvent('stilllight-benchmark-fps-target', {
    detail: { targetFps, frameBudgetMs: frameBudgetMs() },
  }));
}

window.__STILLLIGHT_BENCHMARK_SCHEDULER__ = {
  get mode() { return targetFps > 0 ? `target-${targetFps}-fps` : 'uncapped-message-channel'; },
  get targetFps() { return targetFps; },
  get frameBudgetMs() { return frameBudgetMs(); },
  displayVsyncLimited: false,
  setTargetFps,
};
