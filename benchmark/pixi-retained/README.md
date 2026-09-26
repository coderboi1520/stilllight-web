# Retained Pixi 10-Glass Benchmark

Double-click `Start Web Preview.cmd`.

This benchmark mirrors the original Canvas stress benchmark: 10 glasses, the same deterministic event schedule, 2–3 overlapping pours, hint and invalid feedback, the same uncapped MessageChannel scheduler, the same 13.25 s continuous loop cadence, and the same Min / Avg / Max FPS HUD.

The renderer uses the updated retained Pixi/WebGL architecture: one Pixi application, retained `GlassView` instances, retained `StreamView` instances, shared production liquid/model math, manual rendering, disabled Pixi ticker/GC scheduler, and no visible logging panel.

Close the browser tab to stop it.
