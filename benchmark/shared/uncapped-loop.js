// Shared benchmark-only scheduler. Both benchmark implementations use the exact
// same uncapped MessageChannel loop so scheduler behavior is not a comparison variable.
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
