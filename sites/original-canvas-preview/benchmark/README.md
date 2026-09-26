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

## Uncapped scheduler
The benchmark replaces display-synchronized `requestAnimationFrame` scheduling inside this isolated benchmark copy with a `MessageChannel` task scheduler.

That means the reported FPS is **render-loop throughput**, not monitor presentation FPS. It can exceed the monitor refresh rate. Use the exact same scheduler later in the retained-Pixi comparison benchmark for a fair architecture comparison.

The untouched golden reference remains unchanged and still uses native browser RAF.

## FPS stats
The live overlay shows current FPS continuously and, after each completed cycle, keeps these cycle results visible:

- **Minimum FPS** — derived from the worst positive frame interval in the cycle
- **Average FPS** — total rendered iterations divided by measured cycle duration
- **Maximum FPS** — derived from the best positive frame interval in the cycle

The full result also includes 1% low FPS, average/p95/p99/worst frame time, update CPU time, render CPU time, active-glass/pour peaks, heap data where available, and long-task data where supported.

Each completed cycle emits:

`STILLLIGHT_BENCHMARK_RESULT { ...JSON... }`

The loop controller also emits cumulative results as:

`STILLLIGHT_BENCHMARK_CUMULATIVE { ...JSON... }`

Cumulative output includes the minimum FPS observed across completed cycles, average FPS across cycles, and maximum FPS observed across completed cycles.

This benchmark intentionally retains the original Canvas 2D immediate-mode rendering and authored liquid/animation mathematics so the same scripted workload can later be compared against the retained Pixi architecture.
