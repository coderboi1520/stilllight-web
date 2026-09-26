# Codex Site update — mirror benchmark FPS target control

Update the existing deployed **Pixi retained benchmark Site** to match the current repository benchmark UI/behavior.

## Source of truth

Use the current files on `stage2-m1-runtime`:

- `benchmark/pixi-retained/index.html`
- `benchmark/pixi-retained/main.js`
- `benchmark/pixi-retained/styles.css`
- `benchmark/shared/uncapped-loop.js`
- `benchmark/shared/measurement-overlay.js`
- `benchmark/shared/workload.js`

Do not redesign or retune the benchmark.

## Required Site behavior

The deployed Site must expose the same FPS-target dropdown as local:

- Uncapped (default)
- 60 FPS
- 75 FPS
- 90 FPS
- 120 FPS

The Site must use the exact shared scheduler behavior from `benchmark/shared/uncapped-loop.js` rather than implementing a second independent limiter.

When the target changes:

- benchmark animation continues without manual restart;
- scheduler immediately adopts the new target;
- measured stats reset;
- the 2-second warmup runs again before new measurements are accumulated;
- HUD switches between `CPU Throughput` for Uncapped and `Actual FPS` for capped targets;
- HUD shows target frame budget and budget-miss percentage;
- Min / Avg / Max / 1% Low / P95 / P99 continue to work.

## Packaging constraint

The previous Site packaging problem must not return.

The deployed Site must be fully self-contained. It must not depend at runtime on repository-relative paths outside its packaged Site root such as `../shared/` or `../../src/`.

Bundle/copy the current benchmark and shared scheduler/measurement/workload into the Site build using the existing successful Site staging approach. Prefer bundling over manually reimplementing logic.

## Preserve exactly

Do not change:

- ten-glass workload
- event timing
- 2/3 simultaneous-pour schedule
- hint/invalid schedule
- Pixi retained architecture
- `StilllightModel` behavior
- `GlassView` / `StreamView`
- liquid math
- benchmark cycle timing
- rendering quality

This task is only to mirror the new FPS-target scheduler/UI into the already-working Site deployment.

## Verification scope

Use the existing Site workflow. Confirm locally from the staged Site build that:

1. Site renders the Pixi scene;
2. dropdown is visible/clickable;
3. Uncapped runs as before;
4. 60/75/90/120 selections update scheduler label and frame budget;
5. stats reset and warm up again after changing target;
6. no missing-module/404 errors are introduced.

Then redeploy the existing Site and return its updated URL.

Keep this narrow; do not re-debug unrelated architecture or benchmark code.
