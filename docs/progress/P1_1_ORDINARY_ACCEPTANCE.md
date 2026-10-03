# P0 + P1.1 ordinary commission acceptance

Delivered scope: one playable ordinary commission. Stop before P1.2 Lightwork, Home/campaign expansion, commerce, and full board save/resume.

## Identity and recovery

- Starting clean local main and freshly fetched GitHub main: `bd1857f4b8f70cb7731b013829d5a80d0df73e1f`.
- Scoped branch: `codex/p1-1-ordinary`; local non-destructive rollback tag: `rollback/p0-p1-1-bd1857f`.
- P0 checkpoint saved and read back before implementation. No baseline test campaign.
- Helper branch based on the same SHA: `codex/p1-1-haptics`; reviewed commit `909665c778172d012e3d4aad8870eb0d44f5668e`, incorporated as `99e5bbf12eccacf237d2cdd3ac638db0320afae9`. Four scoped files only; no dependency changes.
- Delivery commit identity and push result are recorded in the integrator's external checkpoint after normal fast-forward integration.

## Delivered behavior

Six vessels, capacity four, all four current colors, maximal matching-top-run pours. A verified 13-move solution includes multi-unit transfers and completion in four distinct vessels. Model, reusable frame, retained renderer views/order, history, surface continuity, contacts, corrections, cap ownership and idle detection work together at every index. The old two-glass fixture remains available in the development oracle harness.

Portrait controls provide Hint, exact Undo, Restart, Haptics and Reduced Motion. Every button is at least 48×48 CSS px at 400×889 and 450×1000; the status line fits both. Vessel hits share core coordinates, with visible numbers, color symbols/name legend, accessible top-to-bottom layer descriptions, native keyboard activation, focus indication and pressed states. Number keys select vessels; H/U/R and Ctrl/Cmd+Z activate utilities. Hint highlights a useful legal current-board pair without changing layers/history; it is a local legal-move aid, not a solution oracle. Undo availability follows the existing home-pose acceptance guard.

Normal pours remain 1040 ms with .30–.69 transfer and .275–.715 stream windows. Refined Undo remains stationary, 520 ms total, volume restored by 420 ms, with no travel/tilt/stream. Existing pumpkin cap entry/contact/rebound, exact seating, removal and re-entry are preserved per vessel. Reduced Motion provides stationary transfer, quiet surfaces and seated caps with identical logical quantities/history and normal transaction durations.

Haptics preserve eight legacy semantic intents through a thin optional browser backend and an injectable backend contract. Selection/rejection/UI feedback uses accepted actions. Pour contact requires an actually presented contact window and is deduplicated by flight; skipped contact frames stay silent. Cap contact comes from the presented lifecycle; commission success waits for final settling. Manual/debug sampling is silent. Haptics and Reduced Motion have independent persistent preferences and tolerate unavailable storage. No Sound/audio/settings subsystem or board-resume store was introduced.

The approved artwork is copied unchanged from root `moonlit-studio.png` to `public/assets/moonlit-studio.png`. SHA-256 of both: `db85586fa404107b6d9f94cba3dce59749471804f113638fbd7f7eb4edbeb2c6`. It is registered consistently inside the retained Pixi scene, Canvas fallback and surrounding atelier. Production keeps an opaque WebGL surface: a transparent composition attempt cleared paused presentations on repeated rendering/resize; the registered scene fixed the reproduced failure without recurring RAF work or a replacement clock.

## Verification of the integrated code

| Command/check | Result |
|---|---|
| `npm test` | 110/110 PASS, including original reference byte-integrity, affected six-vessel/Undo/cap/Reduced Motion/contact tests, and helper tests |
| `npm run build` | PASS; TypeScript + Vite production build |
| `npm run test:reference` | 7/7 PASS; untouched independent original |
| `npm run verify:runtime` | 5/5 PASS: viewport/DPR, context restoration, explicit Canvas fallback, idle RAF, manual-frame parity freeze |
| `node scripts/verification/verify-ordinary.mjs` | PASS in WebGL and forced Canvas; both required portrait sizes; real pointer and keyboard input; Hint non-mutation, rejection, rapid input, exact Undo, mid-flight Restart, preference reload, full 13-move solution, per-vessel cap re-entry, manual silence and idle |
| `node scripts/verification/verify-ordinary.mjs --feedback` | PASS in both backends: contact exactly once; deliberately skipped contact frame silent |
| Existing `verify-pour-states.mjs` through the repository browser harness | PASS: two-unit transfer and authored stream boundaries |
| Existing `capture-parity.mjs` through the repository browser harness, using detected Chromium | 10/10 original/candidate exposed-state comparisons PASS; frame captures retained |
| `STILLLIGHT_URL=http://127.0.0.1:5180 node scripts/verification/verify-production.mjs` (set the environment variable in the host shell) | PASS in built WebGL and forced Canvas: startup, input during delayed asset initialization, Hint non-mutation, real pointer pour, exact Undo, preference reload, no browser errors; reproduced the entry-module dynamic-import deadlock before its fix |
| `git diff --check` | PASS |

Full ordinary run observed 13 pour-contact signals, four distinct vessel-completion signals and one final commission-completion signal in each backend. Undo followed by the final pour demonstrated cap removal/re-entry and exact solved-state recovery. Both backends reached zero recurring RAF requests after settling. Visual inspection covered portrait, departure/contact/transfer/return, live stationary Undo, multi-unit pours and completed caps. Initial portrait status clipping and paused-render failure were fixed and affected checks rerun. Final review was performed by the integrator; no extra helper/reviewer was launched.

Local evidence: `artifacts/verification/p1-1-{tests,build,runtime,ordinary,feedback,oracle-visual}.log`, `artifacts/verification/ordinary/`, and `artifacts/verification/parity-screenshots/` (ignored artifacts retained locally).

NOT RUN: physical vibration/touch, Redmi/Android qualification or native packaging, actual screen-reader session, human fresh-player/director acceptance, broad browser/device matrix. Desktop Chromium input and portrait viewports are not physical-device evidence. No new audio behavior is claimed. Full session resume remains P1.3.

## Changed files

- Entry and controls: `index.html`, `src/main.ts`, `src/styles.css`.
- Core/frame/commission: `src/core/modelBase.ts`, `src/core/RenderFrame.ts`, `src/core/ordinaryCommission.ts`; the integrated `src/core/model.ts` surface-ownership extension remains in use.
- Shared scene and rendering: `src/render/StageRenderer.ts`, `src/render/ViewportController.ts`, `src/render/sceneBackdrop.ts`, `src/render/CanvasRenderer.ts`, `src/render/pixi/PixiRenderer.ts`, `src/render/pixi/GlassView.ts`, `public/assets/moonlit-studio.png`.
- Platform: `src/platform/haptics.ts`, `src/platform/hapticsPreference.ts`, `src/platform/motionPreference.ts`, `src/platform/presentedFeedback.ts`.
- Debug snapshots: `src/debug/snapshot.ts`.
- Verification: `tests/ordinary-board.test.mts`, `tests/presented-feedback.test.mts`, `tests/haptics.test.mts`, `tests/haptics-preference.test.mts`, affected Canvas test doubles in `tests/milestone1-regressions.test.mts` and `tests/stage3-1-stream.test.mts`, useful-Hint fixture in `tests/stage3-1-undo.test.mts`, `scripts/verification/verify-ordinary.mjs`, `scripts/verification/verify-parity-freeze.mjs`.
- Production verification: `scripts/verification/verify-production.mjs`. Production startup runs inside async bootstrap so shared renderer chunks can finish loading; premature input is ignored until initialization completes.
- This acceptance record. Independent `reference/original`, authored liquid/geometry/timing constants, package manifests and lockfile are unchanged.

## Preview and next command

In `D:\STILLLIGHT`, run `npm run dev`, then open `http://127.0.0.1:5179/`. Use `/debug.html` for the independent two-glass reference comparison; `/?fixture=reference` is development-only.

NEXT_COMMAND: `AUTHORIZE P1.2 — Lightwork destination on current GitHub main, preserving P1.1 ordinary play and presentation.` Do not execute automatically.
