// Single shared benchmark workload definition.
// Both original Canvas and retained Pixi benchmarks import this file so only
// the workload is shared; each benchmark keeps its own architecture/render path.
export const TEN_GLASS_WORKLOAD = Object.freeze({
  durationMs: 15000,
  events: Object.freeze([
    { at: 500, type: 'selection', index: 8 },
    { at: 500, type: 'hint', source: 8, target: 9 },
    { at: 1000, type: 'invalid', source: 6, target: 9 },
    { at: 1500, type: 'pours', pairs: [[0, 1], [2, 3]] },
    { at: 1850, type: 'pours', pairs: [[4, 5]] },
    { at: 2300, type: 'hint', source: 6, target: 7 },
    { at: 2550, type: 'invalid', source: 8, target: 7 },
    { at: 3100, type: 'pours', pairs: [[6, 7], [8, 9]] },
    { at: 3450, type: 'hint', source: 0, target: 1 },
    { at: 4300, type: 'pours', pairs: [[1, 0], [3, 2], [5, 4]] },
    { at: 5050, type: 'invalid', source: 7, target: 9 },
    { at: 5650, type: 'pours', pairs: [[7, 6], [9, 8]] },
    { at: 6900, type: 'pours', pairs: [[0, 1], [2, 3]] },
    { at: 7250, type: 'pours', pairs: [[4, 5]] },
    { at: 7700, type: 'hint', source: 6, target: 7 },
    { at: 8350, type: 'pours', pairs: [[6, 7], [8, 9]] },
    { at: 9550, type: 'pours', pairs: [[1, 0], [3, 2], [5, 4]] },
    { at: 10150, type: 'hint', source: 8, target: 9 },
    { at: 10850, type: 'pours', pairs: [[7, 6], [9, 8]] },
    { at: 11200, type: 'invalid', source: 0, target: 4 },
    { at: 11750, type: 'pours', pairs: [[0, 1], [2, 3], [4, 5]] },
  ]),
});

export const BENCHMARK_SCRIPTS = Object.freeze({
  '10-glass': TEN_GLASS_WORKLOAD,
});
