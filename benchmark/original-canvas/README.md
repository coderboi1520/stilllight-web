# Original Canvas 10-Glass Loop Benchmark

## Run
Double-click `Start Web Preview.cmd` in this folder.

It starts a local Python HTTP server and opens the benchmark automatically in your default browser. No build step is required.

## Behavior
There is one benchmark workload: **10 Glass Stress**.

The benchmark starts automatically on page load and repeats forever until the browser tab is closed. There are no start/stop/restart controls.

Each deterministic cycle lasts about 15 seconds and exercises:

- selection and hint feedback
- invalid-pour feedback
- repeated legal transfers across five compatible glass pairs
- deliberate 2-pour and 3-pour overlap
- moving liquid surfaces and waves
- pour streams and receiver impact/slosh
- source recovery and settling

No randomness is used.

## Stats
The live overlay continuously shows mode, cycle, elapsed time, FPS, frame time, active glasses, and active pours.

Each completed cycle emits:

`STILLLIGHT_BENCHMARK_RESULT { ...JSON... }`

The loop controller also emits cumulative results as:

`STILLLIGHT_BENCHMARK_CUMULATIVE { ...JSON... }`

The page keeps the latest completed-cycle result plus cumulative cross-cycle stats visible below the benchmark.

This benchmark intentionally retains the original Canvas 2D immediate-mode rendering and authored liquid/animation mathematics so the same scripted workload can later be compared against the retained Pixi architecture.
