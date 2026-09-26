const API_NAME = '__STILLLIGHT_ORIGINAL_CANVAS_BENCHMARK__';
const CYCLE_MS = 13250;

const cycleNode = document.querySelector('[data-live="cycle"]');
let cycle = 0;
let cycleTimer = 0;

function startNextCycle() {
  const api = window[API_NAME];
  if (!api) return;

  cycle += 1;
  if (cycleNode) cycleNode.textContent = String(cycle);
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
  startNextCycle();
}

window.addEventListener('pagehide', () => clearTimeout(cycleTimer));
boot();
