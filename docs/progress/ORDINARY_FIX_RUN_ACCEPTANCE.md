# Ordinary Fix Run — 2026-10-04

Delivered scope: PF01 keyboard focus, PF02 removal of rejected liquid symbols/legend, PF03 concurrent ordinary pours, and necessary regressions. Automated qualification only; owner gameplay/appearance acceptance is pending.

Source: clean local and live GitHub main `a01d7d8b9248fb0c9f71df886ccd32a59c8d1ca9`, origin `https://github.com/coderboi1520/stilllight-web.git`. Implementation result: `393f9b3b5f80ccc3f894577ca318c44611a7f6f5`, on `codex/ordinary-fix-run`. Delivery also includes the following documentation commit containing this record; final main identity is read back locally and from `git ls-remote origin refs/heads/main` after normal push. No history rewrite, dependency changes, or original-reference edits.

Preview: [built local Web preview](http://127.0.0.1:5180/). Served from `D:\STILLLIGHT\dist` with `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5180 --strictPort`. This is a local preview, not a public deployment.

Changes:

- Invisible glass hit areas keep their size and native button semantics. Keyboard focus follows the existing vessel number; other controls retain focus outlines.
- Canvas/Pixi layer symbols, symbol graphics/contexts/constants/imports, legend markup/styles and obsolete assertion are removed. Color-name accessibility labels, vessel numbers, palette, glass materials and artwork remain.
- Accepted pours own independent flight identities, source/target locks, interpolation, response and streams. The six-vessel core accepts three disjoint pours without a global two-pour cap. Each lock lasts through authored flight and surface recovery. Uninvolved vessels remain usable.
- Logical commit/history remains in acceptance order; Undo waits for flights/recovery and reverses acceptance order with stationary 520 ms presentation. Hint retains a safe busy policy; Restart clears every active flight/recovery/correction/cap effect.
- Cap transitions are restricted to the completing pair. Presented contact feedback deduplicates each flight; distinct concurrent contacts bypass the former shared time throttle while respecting Haptics Off. Final solved feedback still waits until all presentation activity finishes.
- The dated director-plan addendum cancels Lightwork, holds other new mechanics/modes and limits this run to PF01–PF03. No subsequent stage is launched.

Changed paths: `index.html`; `src/styles.css`, `src/main.ts`; `src/core/{ordinaryCommission,modelBase,model,RenderFrame}.ts`; `src/debug/snapshot.ts`; `src/platform/{haptics,presentedFeedback}.ts`; `src/render/CanvasRenderer.ts`, `src/render/pixi/{GlassView,PixiRenderer}.ts`; `tests/{ordinary-concurrency,completed-cap,haptics,milestone1-regressions,stage3-1-continuity,stage3-1-stream,stage3-1-undo}.test.mts`; `scripts/verification/verify-ordinary-fixes.mjs`; the director-plan addendum and this record.

Actual verification:

| Command | Result |
| --- | --- |
| `node --experimental-strip-types --test tests/ordinary-concurrency.test.mts` | Seven focused tests pass; overlapping quantities/streams, exclusive reuse, invalid-feedback continuity, reverse finish/Undo order, cap/reset ownership, identity-scoped feedback and Reduced Motion parity. |
| `npm test` | 118/118 pass, including tiny-layer stationary Undo, cap removal/re-entry, deterministic sampling and idle shutdown. |
| `npm run build` | PASS: TypeScript and Vite production build. |
| `npm run test:reference` | 7/7 pass; original reference remains unchanged. |
| `git diff --check` / staged check | PASS. |
| `npm run verify:runtime` with `STILLLIGHT_URL=http://127.0.0.1:5179` | Final serial run: 5/5 PASS (DPR/resize, context restore, Canvas fallback, idle RAF, parity freeze). |
| `node scripts/verification/verify-ordinary-fixes.mjs` with `STILLLIGHT_URL=http://127.0.0.1:5180` | Built-preview WebGL and Canvas PASS: keyboard/semantic controls, no legend, two live streams, one contact per flight, two exact Undo operations, mid-flight Restart, silent manual sampling, 400×889/450×1000 bounds, idle RAF=0. |

The original five concurrency tests failed on the baseline global lock before implementation. The browser focus check reproduced the oversized outline before correction. The strengthened live contact check and haptics unit regression failed before the throttle fix; the free-pair departure continuity test failed before the per-vessel velocity fix. Both are now green. One intermediate parallel browser run failed PARITY_FREEZE with stable data but different pixels; the unchanged pixel-equality assertion passed in isolation and in final serial runtime verification. No check was weakened.

Author self-review only, as explicitly requested. Review covered independent display/stream/surface/cap ownership, acceptance-order history, exclusive recovery locks, reset cleanup, feedback and retained renderer resources. No outstanding review findings or deferred minors. Rulings: owner Worktree OFF/no reviewers overrides skill defaults (cost: no independent reviewer); latest owner scope supersedes historical Lightwork commands (cost: held work stays undelivered); recovery locks supersede historical tests that reused a settling pair (cost: that pair waits 440 ms after the flight); presenter-deduplicated contacts bypass time throttling (cost: device feel requires owner playtest).

Local evidence: `D:\STILLLIGHT\artifacts\verification\ordinary-fixes\` contains logs, execution ledger and reviewed keyboard/two-stream screenshots; runtime artifacts remain in their established verification directories. Evidence files and `dist` are ignored local artifacts.

Unchanged package SHA256: `package.json` = `C65571C198BA609DE8EE1D96D11EA9913C15B3B9ADCACAFD952866910756F1B3`; `package-lock.json` = `5139FC39A7D59BDEF6D742609F55271D3390F2AE79E008FCA09B8E4D540286B5`.

Build SHA256: `dist/index.html` = `F52FB84C9103CCC1DA8F27A9DE95888FA54032A680FD63C3E85B6354C24F8D9F`; `dist/assets/index-BLicGlJn.js` = `623334F8786C9FBDFDAF144F90B3001D2C48F2E227496618D46006742F57A848`.

NOT RUN: owner gameplay/appearance acceptance; physical Redmi/Android or actuator-feel tests; broad campaign/full visual qualification. Three simultaneous pours are exercised in deterministic core tests; critical browser smoke exercises two actual rendered streams in both backends. Shared concurrent receivers remain intentionally locked. P1.3, P2, campaign, audio expansion and Android packaging are outside this run.

Owner playtest checklist:

1. Use Tab/Enter and keys 1–6; confirm focus is useful and the oversized outline and liquid symbols/legend are gone.
2. From Restart, pour vessel 1→2, then immediately 3→6. Confirm both pours overlap, mouths/contact remain connected, and unrelated input works.
3. Try busy-vessel reuse, then Undo after settling twice; confirm exact initial restoration and familiar stationary Undo.
4. Restart during overlapping motion; try Reduced Motion and Haptics Off; inspect cap/completion behavior and overall feel.

Next action: owner playtest only. Do not automatically launch another stage.
