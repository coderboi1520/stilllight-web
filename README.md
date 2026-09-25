# STILLLIGHT Stage 2 — Milestone 1 Corrected Candidate

This package contains the Stage-2 Milestone-1 implementation with the C1–C7 correction pass applied. The untouched supplied Canvas reference remains under `reference/original/` and is not used as the production fallback.

## Run

Windows: `Start Web Preview.cmd`

Or:

```bash
npm install
npm run dev
```

Main candidate: http://127.0.0.1:5179/

Parity/debug harness: http://127.0.0.1:5179/debug.html

## Renderer policy

Production prefers PixiJS WebGL. If WebGL is unavailable or Pixi WebGL initialization fails, the app selects the explicit Canvas2D adapter in `src/render/CanvasRenderer.ts`, which consumes the same authored `RenderFrame` data.

Rendering remains demand-driven. The viewport controller owns responsive dimensions and capped DPR coordination, and deterministic parity mode owns candidate time while active.

## Checks

```bash
npm test
npm run test:reference
npm run build
npm run parity:capture
```

The parity harness source is under `src/debug/`, `debug.html`, and `scripts/capture-parity.mjs`.
