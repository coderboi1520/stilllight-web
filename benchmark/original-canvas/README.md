# Original Canvas Benchmark

## Open / run
Serve `benchmark/original-canvas/` with any static HTTP server and open `index.html` in a modern browser. No build step is required.

## Modes
- **2 Glass Baseline** — the original two-glass Canvas rendering and authored animation behavior.
- **10 Glass Stress** — exactly ten glasses using the same authored Canvas glass, liquid, moving-liquid, pour, stream, impact, and settling mathematics with benchmark-only concurrent scheduling.

## Start
Choose a mode, then press **Start Benchmark**. **Restart** resets the selected mode without producing benchmark results.

## Results
The live overlay shows Mode, Elapsed, FPS, Frame ms, Active glasses, and Active pours. When a run completes, the final JSON appears below the viewport and one machine-readable console entry is emitted as `STILLLIGHT_BENCHMARK_RESULT { ...JSON... }`.

## Deterministic workload
The 10-glass workload runs for approximately 15 seconds: selection and hint feedback, invalid-pour feedback, repeated legal transfers across five independent compatible glass pairs, deliberate 2-pour and 3-pour overlap, hint/invalid feedback during other active animations, then a final settle-only period. No randomness is used.
