// Benchmark-only scheduler: make requestAnimationFrame callbacks run as fast as
// the browser event loop can process them instead of synchronizing to display
// refresh. This is intentionally isolated to benchmark/original-canvas so the
// untouched golden reference keeps native RAF behavior.
//
// "FPS" in this benchmark therefore means render-loop throughput, not monitor
// presentation FPS. The same scheduler must be used by the retained-Pixi
// comparison benchmark for an apples-to-apples architecture test.

const callbacks = new Map();
let nextId = 1;
const channel = new MessageChannel();

channel.port1.onmessage = (event) => {
  const id = event.data;
  const callback = callbacks.get(id);
  if (!callback) return;
  callbacks.delete(id);
  callback(performance.now());
};

window.requestAnimationFrame = (callback) => {
  const id = nextId++;
  callbacks.set(id, callback);
  channel.port2.postMessage(id);
  return id;
};

window.cancelAnimationFrame = (id) => {
  callbacks.delete(id);
};

window.__STILLLIGHT_BENCHMARK_SCHEDULER__ = Object.freeze({
  mode: 'uncapped-message-channel',
  displayVsyncLimited: false,
});
