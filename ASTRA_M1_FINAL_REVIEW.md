# STILLLIGHT — Astra Max M1 Final Review Packet

**STATUS: READY FOR ASTRA ARCHITECTURAL DECISION**

Repository: `coderboi1520/stilllight-web`  
Branch: `stage2-m1-runtime`  
Production baseline SHA: `2c453b40bfb479af014742f2e9967985cc5052c7`  
Final reviewed implementation SHA before this packet: `d6a967a958a297250d12b3e4c0b423253b35c759`  
Final production-code change SHA: `6c0a67df8a9037074084e018162d74150cde0eda`  

> This review packet is a documentation-only commit after the reviewed implementation. Astra should inspect the current branch HEAD and the actual diff from baseline, not rely on this summary alone. Sol intentionally does **not** certify M1 here.

---

## 1. Requested Astra decision

Please audit the actual source and baseline diff, compare it with your original M1 architecture, and return exactly one architectural/release assessment:

- **PASS**
- **CONDITIONAL PASS**
- **FAIL**

The only unresolved runtime result at this review stage is the synthetic same-size live DPR-only transition described below. If you consider it an M1 blocker, specify **exactly** what production behavior or implementation must change, and why. Do not request another broad verification cycle unless your required change makes one necessary.

---

## 2. Architecture being preserved

The intended architecture remains:

```text
Input
  -> gameplay/timeline
  -> authored motion/liquid math
  -> reusable frame data
  -> renderer
```

The reviewed implementation continues to preserve:

- renderer-independent authored TypeScript model/frame data
- retained PixiJS 8 WebGL renderer
- independent Canvas fallback
- deterministic authored liquid/motion/timing math
- demand-driven rendering through `FrameGate`, not a permanent application animation loop
- renderer responsibility limited to rasterizing authored frame data
- retained CPU-side mesh data reused across frames
- explicit renderer resource ownership/teardown
- parity/reference sources unchanged
- `reference/original/` untouched
- no generic physics replacement
- no framework/dependency migration
- no application recreation as the normal DPR/context solution

---

## 3. Concise fix-stage commit history

Significant fix-stage commits on `stage2-m1-runtime`:

- `344d8efd99f3c03eded366ad75aec1be3b257209` — build/type correctness for reusable `Float64Array` output plus initial Pixi typing correction
- `92c674e621426b7607c1c6bec5eff55503210ff2` — restore literal `renderer.events.setTargetElement(null)` runtime invariant with narrow TypeScript suppression
- `e22b11259d0bd2dcae7f70bda323839ed9976457` — initial retained-view retirement strategy for live DPR transitions
- `e12d3df956e33baf2ab55e84048f89b91827eb14` — disable Pixi renderer GC scheduling and detach renderer scheduler from `Ticker.system`
- `8fd607418024524ae23af9bf4f2a85aa33d55469` — Sol-owned lifecycle/resource rework after reviewing an unexpected Luna implementation; retain view graph across context restore and add explicit private mesh/texture teardown
- `1101bd22847e2932528ae1249e5007035f778c1c` — Sol review/adoption checkpoint used for consolidated runtime verification
- `6c0a67df8a9037074084e018162d74150cde0eda` — live-DPR event watcher plus corrected settled-idle RAF measurement boundary
- `d6a967a958a297250d12b3e4c0b423253b35c759` — documentation-only narrow-verification handoff update

An intermediate Luna-authored production commit (`7d15a4ba119ba9fde98901c1b5cb04e58195aae4`) was explicitly **not** accepted as authoritative by itself; Sol reviewed and reworked that implementation before runtime acceptance.

---

## 4. Production files changed from baseline

Complete production-source list in the baseline diff:

- `src/core/liquidMath.ts`
- `src/render/ViewportController.ts`
- `src/render/pixi/GlassView.ts`
- `src/render/pixi/LiquidView.ts`
- `src/render/pixi/PixiRenderer.ts`
- `src/render/pixi/StreamView.ts`
- `src/render/pixi/assets.ts`

Non-production verification/documentation changes include:

- `tests/renderer-structure.test.mjs`
- `scripts/verification/verify-idle-raf.mjs`
- `SOL_TASK.md`
- `SOL_CONTINUATION_POLICY.md`
- `LUNA_VERIFY_TASK.md`
- this review packet

No file under `reference/original/` is changed by the baseline diff.

---

## 5. Original problems, root causes, and exact fixes

### A. Build/type correctness

**Original failure 1:** reusable authored `Float64Array` frame storage failed TypeScript generic inference at `sampleSurface(...)`.

**Root cause:** TypeScript 5.9 inferred an unnecessarily narrow typed-array generic from the default parameter expression.

**Fix:** explicitly type the output parameter as `Float64Array` while retaining the same caller-provided reusable storage and authored math. No timing or liquid behavior changed.

**Original failure 2:** PixiJS 8.18 TypeScript declarations rejected `renderer.events.setTargetElement(null)` even though the runtime call is intentionally used to detach Pixi's DOM event source.

**Root cause:** declaration/runtime mismatch.

**Fix:** retain the exact runtime call `setTargetElement(null)` and apply only a narrow `@ts-expect-error` at that call site.

### B. Live DPR stale-resource / `getBuffer` crash

**Original behavior:** a live DPR transition could produce Pixi `MeshSimple`/`getBuffer` errors and a blank scene. A fresh page loaded directly at the new DPR did not have the same failure.

**Root cause:** DPR-sensitive views were being destructively replaced while Pixi still had retained render instructions/resource references from the outgoing view generation. Old mesh geometry could be destroyed before the replacement generation had completed a successful render.

**Fix:** on density change, create the new retained view generation but retire the outgoing `GlassView`/`StreamView` objects until after the first successful replacement render. Then explicitly destroy the retired generation's private textures and `MeshSimple` geometry/buffers. Shared `Texture.WHITE` and the reusable circle texture are not destroyed.

**Current runtime evidence:** the previous catastrophic `getBuffer`/blank-scene failure no longer reproduces. The remaining DPR failure is now only a backing-store update issue in the synthetic same-size DPR-only transition; there are no page errors.

### C. WebGL context restoration

**Original behavior:** context restoration could hit the same Pixi resource family and fail through the forced rebuild path.

**Root cause:** STILLLIGHT unnecessarily rebuilt its retained view graph on `webglcontextrestored`, while PixiJS 8.18 already invalidates context-owned GPU geometry/buffer/texture data during `contextChange` and lazily rehydrates those resources from retained CPU-side owners on subsequent rendering.

**Fix:** do not rebuild STILLLIGHT views on context restore. The application listener now only calls `onRestore()` to invalidate/redraw. The existing retained CPU geometry/textures remain authoritative through context restoration.

**Current runtime evidence:** PASS. Context loss/restoration completes, state/frame are preserved, context is usable afterward, and no `pageerror`/`console.error` is reported.

### D. Recurring idle RAF

**Original behavior:** Pixi kept a recurring RAF source alive while STILLLIGHT was logically idle despite `autoStart:false`, `sharedTicker:false`, `app.ticker.stop()`, and demand-driven `FrameGate` rendering.

**Root cause:** PixiJS 8.18 renderer `SchedulerSystem` independently registers work on `Ticker.system` for periodic renderer GC.

**Production fix:** disable renderer GC scheduling for this fixed retained scene, then destroy the renderer scheduler listener. Resource cleanup is therefore explicit in STILLLIGHT's retained-view teardown rather than delegated to Pixi's recurring scheduler.

**Verification-boundary correction:** Pixi requests one system RAF during `Application.init()` before STILLLIGHT can execute its post-init scheduler teardown. Removing the final scheduler listener cancels that pending request. The original idle harness counted all RAF requests from pre-load initialization and therefore treated this canceled startup request as settled-idle activity. The harness now waits until STILLLIGHT initialization is exposed, resets the probe, and measures the actual settled-idle invariant. It still fails on any RAF that survives initialization or recurs later.

**Current runtime evidence:** PASS — `idle-after-load=0`, `active=26`, `idle-after-animation=0`.

### E. Remaining live DPR-only backing-store result

After eliminating the stale-resource crash, the viewport harness still reports one failure:

```text
before:
  board:   320x496
  CSS:     320x496
  backing: 320x496
  DPR:     1

after synthetic same-size DPR override:
  board:   320x496
  CSS:     320x496
  backing: 320x496
  DPR:     2

expected backing after DPR=2:
  640x992
```

There are no page errors and no blank-scene/`getBuffer` failure.

`ViewportController` now observes:

- `ResizeObserver` changes
- `window.resize`
- a re-armed `matchMedia('(resolution: <current>dppx)')` change listener for DPR-only transitions

All of those signals feed the same existing `sync()` path and therefore the same `renderer.resize(width, height, density)` implementation. No polling or permanent RAF was introduced.

### What works now

The runtime evidence indicates that:

- fresh load at DPR 1 works
- fresh load at DPR 2 works
- normal responsive/same-DPR live resize works
- hit alignment/selection continues to work
- context loss/restoration works
- the prior live-DPR stale-resource crash/blank scene is eliminated
- there are no browser error events in the remaining DPR failure

### Exactly what remains failing/unverified

A **synthetic Chromium DevTools Protocol same-size DPR-only override** changes JavaScript-visible `devicePixelRatio` from 1 to 2 while board/CSS dimensions remain unchanged, but in that path the backing store remains 320x496 rather than becoming 640x992. The standards-based media-query watcher does not produce the required synchronization in this emulation path.

The current review stage does **not** contain successful runtime evidence proving that a real-world same-size DPR-only transition (for example a platform/browser display-density transition where no ordinary resize signal fires) always updates the backing store.

### Sol's risk assessment for Astra to judge

This residual failure is **plausibly specific to the synthetic CDP DPR-emulation path**, because production now listens to ordinary resize plus resolution media-query changes, while the harness mutates device metrics through browser automation without a CSS-size transition. However, it cannot be dismissed as conclusively harness-only: the acceptance invariant is that a genuine DPR-only change must eventually synchronize the renderer backing store, and that exact invariant has not been demonstrated green in the synthetic test.

Therefore Sol is recording this as an **open release/architecture decision**, not a PASS and not a hidden failure. Astra should decide whether M1 requires this synthetic case to be green or whether the present standards-based production behavior plus the elimination of the catastrophic resource failure is sufficient for M1.

If Astra treats it as a blocker, please specify the exact production guarantee/mechanism required (for example, which browser signal or lifecycle boundary must be covered) before another implementation cycle begins.

---

## 6. Architectural invariants preserved

Source-level pre-audit found no intentional violation of the approved architecture:

- authored model and timeline remain renderer-independent
- renderer consumes frame data; it does not own gameplay timing/math
- authored liquid/motion constants and sequencing are not rewritten
- reusable frame/surface storage remains reusable
- retained Pixi renderer remains retained
- Canvas fallback remains independent
- demand-driven `FrameGate` remains the application render scheduler
- no permanent STILLLIGHT RAF loop was introduced for DPR observation
- context restoration retains CPU-side renderer resources rather than recreating the entire app
- DPR view replacement is generation-based and old resources are destroyed only after replacement rendering
- private mesh geometry and generated textures have explicit teardown now that Pixi scheduled GC is disabled
- shared textures are not destroyed as private resources
- `reference/original/` is untouched
- no tests were weakened to hide production failures

---

## 7. Deviations / implementation choices Astra should review

1. **Pixi renderer GC scheduler is disabled.** This is intentional to preserve the demand-driven no-idle-RAF architecture. The corresponding burden is explicit STILLLIGHT teardown of private generated textures and mesh geometries.
2. **Context restore no longer forces a STILLLIGHT view rebuild.** This relies on PixiJS 8.18's own context-change invalidation/rehydration behavior for retained geometry, buffers, and texture sources.
3. **DPR changes still rebuild density-sensitive STILLLIGHT views.** Old generations are retired until after the replacement render instead of being destroyed immediately.
4. **DPR observation uses a re-armed resolution media query plus existing resize signals.** It adds no polling/RAF, but the synthetic CDP DPR-only case remains red.
5. **Idle RAF harness measurement begins after application initialization.** This is intended to measure the approved settled-idle invariant rather than count a Pixi startup request that is subsequently canceled. Production scheduler teardown itself was not relaxed for this result.

---

## 8. Verification evidence

### Build / unit / reference

From the consolidated Luna Max run at `1101bd22847e2932528ae1249e5007035f778c1c`:

- `npm run verify:fast` — **PASS**, exit 0
- production build — **PASS**
- unit/structural suite at that checkpoint — **27/27 PASS**
- golden/reference tests — **7/7 PASS**

From the latest narrow verification after the final DPR/idle changes:

- TypeScript — **PASS**
- renderer structural tests — **9/9 PASS**

### Idle RAF

Latest final-stage evidence:

- `verify:idle-raf` — **PASS**
- settled after load: **0 RAF requests**
- active animation: **26 RAF requests**
- settled after animation: **0 RAF requests**

### Context restore

Previous consolidated final-stage evidence (production context path unchanged afterward):

- `verify:context` — **PASS**, exit 0
- context loss/restoration completed
- state preserved
- frame preserved
- context usable after restoration
- no `pageerror`
- no `console.error`

### Live viewport / DPR

Latest final-stage evidence:

- `verify:viewport` — **FAIL** only on the synthetic same-size live DPR-only transition
- board/CSS remain 320x496
- DPR changes 1 -> 2
- backing remains 320x496 instead of expected 640x992
- no `pageerror`
- no `console.error`
- prior Pixi `getBuffer` / blank-scene crash does **not** reproduce

### Browser errors

Across the final evidence summarized for this review stage, no `pageerror` / `console.error` failure is present in the passing context/idle cases or the remaining DPR case.

---

## 9. Final `verify:m1` status

`npm run verify:m1` is **NOT GREEN / NOT CLAIMED AS PASS** for this final review stage.

In the earlier consolidated run it was correctly skipped because targeted prerequisites were not all green. After the final fixes, Sol and the user explicitly stopped the Sol↔Luna loop rather than continuing changes solely to make the synthetic viewport harness green. The remaining `verify:viewport` failure therefore still prevents a clean all-green `verify:m1` acceptance claim.

Astra must account for this explicitly in PASS / CONDITIONAL PASS / FAIL.

---

## 10. Parity/reference status

- Golden/reference tests: **7/7 PASS** in the consolidated run.
- `reference/original/` is unchanged in the final baseline diff.
- Earlier deterministic parity-freeze verification had passed before the final viewport/idle-only adjustments.
- The final adjustments do not change authored model/timeline/liquid behavior: production change is viewport event observation; the other change is verification measurement ordering.
- Parity was not rerun in another Luna loop after the final narrow evidence because the user explicitly stopped iterative verification at this stage.

No parity/reference behavior change is intentionally introduced by the final implementation.

---

## 11. Browser/environment-specific observations

- PixiJS version remains `8.18.0`.
- The residual viewport failure is exercised through Chromium DevTools Protocol `Emulation.setDeviceMetricsOverride` with CSS size held constant while `deviceScaleFactor` changes.
- JavaScript-visible DPR becomes 2 in that synthetic case, so the harness is not merely failing to set `devicePixelRatio`.
- The expected resolution-media-query synchronization is not observed sufficiently to update the backing store in that path.
- Fresh-page DPR behavior is distinct and passes; the old failure was specifically a live transition/lifecycle problem.
- Context restoration and idle scheduling evidence are green in the browser harness with no browser errors.

---

## 12. Unresolved limitations / assumptions

1. Synthetic same-size DPR-only transition remains red as described above.
2. It is unproven at this review stage whether the red result is purely a CDP emulation limitation or represents a real browser/platform same-size DPR-only edge case.
3. Because `verify:viewport` is red, no all-green final `verify:m1` result is claimed.
4. Renderer GC scheduling is intentionally disabled; correctness therefore depends on the explicit resource-destruction paths remaining complete for any future retained resource types.
5. Context restore intentionally relies on PixiJS 8.18 retained-source rehydration semantics; future Pixi upgrades should re-audit this assumption.

---

## 13. Concise diff-review summary

Against production baseline `2c453b40bfb479af014742f2e9967985cc5052c7`, the implementation changes are tightly concentrated in type correctness, viewport density synchronization, and Pixi retained-resource lifecycle/ownership.

No gameplay rules, authored animation timings, model transition logic, reference implementation, backend policy, or dependency versions were changed.

The main renderer lifecycle changes are:

- preserve the literal Pixi event-target detachment
- remove recurring Pixi renderer-scheduler RAF ownership
- retain the view graph across WebGL context restoration
- retire DPR view generations through replacement render rather than destroying immediately
- explicitly destroy private mesh geometry/buffers and generated textures
- observe DPR-only changes without introducing polling/RAF

The only verification change affecting acceptance semantics is the idle RAF probe reset after application initialization; this excludes a startup RAF request that is canceled during the existing production teardown, while continuing to fail any RAF activity during settled idle.

---

## 14. Areas Astra should inspect especially closely

Please inspect the actual source/diffs for:

1. `src/render/pixi/PixiRenderer.ts`
   - scheduler/GC shutdown ordering
   - retained-generation retirement timing
   - context-restoration behavior
   - `renderer.resize(..., density)` path
2. `src/render/pixi/GlassView.ts`
   - private generated texture ownership
   - interaction with `LiquidView.destroy()`
3. `src/render/pixi/LiquidView.ts`
   - `MeshSimple` geometry/buffer ownership and explicit teardown
4. `src/render/pixi/StreamView.ts`
   - private halo textures
   - curve/impact geometry teardown
   - shared circle texture ownership
5. `src/render/pixi/assets.ts`
   - DPR-sensitive texture baking and shared/private texture distinctions
6. `src/render/ViewportController.ts`
   - re-armed resolution media-query watcher
   - cleanup/listener lifecycle
   - whether this is sufficient for the intended real-browser DPR contract
7. `scripts/verification/verify-idle-raf.mjs`
   - whether the post-init reset accurately represents the intended settled-idle acceptance invariant
8. `tests/renderer-structure.test.mjs`
   - whether structural guards are meaningful and not overfitted
9. baseline diff `2c453b40...` -> current branch HEAD
   - any unintended lifecycle/performance/parity deviations not captured above

---

## 15. Explicit request to Astra Max

Astra Max: inspect the relevant actual source and diffs rather than trusting Sol's summary. Compare the implementation with your original architecture. Review correctness, parity, renderer lifecycle, resource ownership, performance architecture, and regression coverage. Identify any remaining architecture violation, unsafe resource ownership, weak evidence, or unjustified harness assumption.

In particular, decide whether the remaining synthetic same-size DPR-only backing-store failure is:

- non-blocking for M1,
- acceptable only under explicit conditions/follow-up, or
- an M1 blocker.

Return a final **PASS / CONDITIONAL PASS / FAIL** assessment.

If the DPR case is a blocker, specify exactly what production behavior must change and the narrow acceptance evidence required. Only then should Sol perform one final targeted implementation cycle.

Do not redesign merely for stylistic preference if the approved architecture is faithfully satisfied.
