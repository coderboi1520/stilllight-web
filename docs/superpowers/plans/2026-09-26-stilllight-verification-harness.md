# STILLLIGHT M1 Verification Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Do not use subagents for this task; the plan is intentionally sequenced for one efficient Luna Light session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a repository-owned Playwright verification harness that replaces the 73-minute exploratory runtime audit with deterministic, targeted commands and faithfully reproduces the current known failures without fixing production behavior.

**Architecture:** Use the existing `playwright-core`, Vite dev server, and debug APIs. A shared browser harness owns Chromium discovery, Vite lifecycle, isolated contexts/pages, CDP device-metric changes, browser-error collection, screenshot/artifact paths, and teardown. Small scenario modules export independently runnable checks; aggregate runners execute them sequentially with isolated browser state and summarize PASS/FAIL/SKIPPED.

**Tech Stack:** Node.js ESM, `playwright-core` 1.55+, Chromium/Chrome/Edge, Vite 7, TypeScript project under test, existing STILLLIGHT debug APIs.

**Spec:** `docs/superpowers/specs/2026-09-26-stilllight-verification-harness-design.md`

## Global Constraints

- Do not fix the four known production failures during this plan.
- Do not change gameplay rules, liquid math, authored timing/motion, renderer behavior, visuals, or `reference/original/`.
- Reuse `playwright-core`; add no browser automation dependency unless the existing environment is demonstrably insufficient.
- Routine verification must not require computer-use/CUA, manual clicking, web search, subagents, or ad-hoc interactive snippets.
- Browser lifecycle-sensitive scenarios must use isolated contexts/pages.
- Generated artifacts belong under `artifacts/verification/` and must be gitignored.
- Normal `verify:m1` is fail-fast: `verify:fast` -> `verify:runtime` -> `verify:visual`; later stages are SKIPPED after a failed prerequisite.
- Targeted runtime/visual commands remain runnable directly even while the current production build fails.
- Current known defects must be reported as failures, not converted into expected-pass/XFAIL results.
- Preserve the current passing unit/reference suites and existing `scripts/capture-parity.mjs` behavior.
- Prefer current verification output over duplicate full-suite reruns when the working tree has not changed.

## Review Focus

1. **Windows/local Chromium discovery:** missing `CHROMIUM_PATH` or a nonstandard browser install must produce a concise environment error, not silently switch to CUA. Task 1 exercises this through explicit resolver diagnostics.
2. **Vite/port lifecycle:** an unavailable port, failed server start, or externally supplied `STILLLIGHT_URL` must be distinguished from a scenario assertion failure; no unrelated process may be killed. Task 1 owns this.
3. **Browser errors and lifecycle contamination:** a page error/console error from one scenario must fail only that scenario and must not leak context/DPR/context-loss state into another. Tasks 2 and 3 exercise this with isolated contexts.
4. **Teardown after failure:** browser contexts, Chromium and an internally started Vite process must close in `finally` paths even when a scenario throws. Task 1 owns this behavior.
5. **Windows paths/command invocation:** spawning npm/Vite and writing artifacts must work from `D:\STILLLIGHT` without shell quoting assumptions. Task 1 owns platform-safe command selection/path handling.

---

## File Structure

### Create

- `scripts/verification/browser-harness.mjs` — shared server/browser/context/CDP/error/artifact infrastructure.
- `scripts/verification/result-utils.mjs` — small result, timing and summary helpers shared by runners/scenarios.
- `scripts/verification/verify-viewport-dpr.mjs` — viewport, DPR, hit-target and live-DPR regression.
- `scripts/verification/verify-context-restore.mjs` — WebGL context loss/restoration regression.
- `scripts/verification/verify-canvas-fallback.mjs` — explicit production Canvas fallback regression.
- `scripts/verification/verify-idle-raf.mjs` — preboot RAF instrumentation and settled-idle assertion.
- `scripts/verification/verify-parity-freeze.mjs` — deterministic state/framebuffer freeze regression.
- `scripts/verification/verify-pour-states.mjs` — deterministic two-unit transfer and stream-boundary checks.
- `scripts/verify-runtime.mjs` — aggregate runtime scenarios with isolated browser state and one summary.
- `scripts/verify-visual.mjs` — aggregate deterministic pour/stream checks.
- `scripts/verify-m1.mjs` — fail-fast top-level gate and PASS/FAIL/SKIPPED summary.

### Modify

- `package.json` — add targeted and aggregate verification scripts only; do not alter dependency versions.
- `.gitignore` — add `artifacts/verification/`.
- `README.md` — document the four verification entry points and `CHROMIUM_PATH`/`STILLLIGHT_URL` overrides concisely.

### Preserve

- `src/**`
- `tests/**` unless a small harness-only Node test is genuinely needed for pure helper logic
- `reference/original/**`
- `scripts/capture-parity.mjs`
- `CODEX_TASK.md` until the implementation task itself is completed

---

### Task 1: Shared deterministic browser harness

**Files:**
- Create: `scripts/verification/browser-harness.mjs`
- Create: `scripts/verification/result-utils.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Produces `resolveChromiumExecutable() -> string` with this order: `CHROMIUM_PATH`, an existing `playwright-core` executable path, then platform-appropriate installed Chrome/Edge/Chromium candidates. Throw a clear error listing attempted candidates when none exists.
- Produces `withVerificationHarness(options, fn)` that either connects to `STILLLIGHT_URL` or starts `npm run dev`, waits until the base URL responds, launches Chromium, provides scenario helpers, then tears down resources in `finally`.
- Produces `newIsolatedPage({width,height,dpr,initScripts?})` returning a fresh browser context/page plus captured `console`/`pageerror` diagnostics.
- Produces `setDeviceMetrics(page,{width,height,dpr})` using a Chromium CDP session for live DPR/viewport changes on the same page.
- Produces artifact helpers rooted at `artifacts/verification/<scenario>/`.
- Produces result helpers with shape `{name,status:'PASS'|'FAIL'|'SKIPPED',durationMs,details?,artifacts?}` and a concise summary printer.

- [ ] **Step 1: Add the artifact ignore rule**

Append exactly `artifacts/verification/` to `.gitignore` without changing existing rules.

- [ ] **Step 2: Implement pure result helpers**

Create result construction/summary helpers in `result-utils.mjs`. The summary must be deterministic and set no process exit code by itself.

- [ ] **Step 3: Implement cross-platform Chromium discovery**

In `browser-harness.mjs`, support `CHROMIUM_PATH` first. On Windows, check common Chrome and Edge install locations using environment variables rather than hardcoding one user profile. On Linux/macOS, check normal Chromium/Chrome locations. An unresolved browser must throw one concise error; do not invoke computer-use.

- [ ] **Step 4: Implement Vite lifecycle**

If `STILLLIGHT_URL` is set, use it and do not spawn Vite. Otherwise spawn the existing `npm run dev` command using platform-safe npm invocation, wait for `http://127.0.0.1:5179`, and retain ownership only of the process the harness started. A startup failure/port conflict must be reported as environment/setup failure; do not kill unrelated processes.

- [ ] **Step 5: Implement browser/context/CDP helpers and teardown**

Launch one Chromium process per aggregate run. Give each scenario a new isolated context/page. Capture page errors and error-level console messages. Implement CDP metrics override and artifact path helpers. Close context/browser/server in `finally` paths.

- [ ] **Step 6: Smoke-test harness loading without running product acceptance**

Run a direct Node import of both new modules and exercise result formatting plus Chromium path resolution. If Chromium is found, perform one short launch/close smoke check. Expected: modules import cleanly; no product source is modified.

- [ ] **Step 7: Commit Task 1**

```bash
git add .gitignore scripts/verification/browser-harness.mjs scripts/verification/result-utils.mjs
git commit -m "test: add reusable browser verification harness"
```

---

### Task 2: Browser platform/lifecycle scenarios

**Files:**
- Create: `scripts/verification/verify-viewport-dpr.mjs`
- Create: `scripts/verification/verify-context-restore.mjs`
- Create: `scripts/verification/verify-canvas-fallback.mjs`

**Interfaces:**
- Each module exports one async `run(harness)` function returning the standard scenario result.
- Each module can also run standalone using the shared harness so targeted reruns need no custom prompt or browser clicking.
- Scenario failures must save high-value screenshots/diagnostics and return FAIL; they must not be marked as known/expected passes.

- [ ] **Step 1: Implement viewport/DPR assertions**

Cover these exact states:

- 400x620, DPR 1
- 320x496, DPR 2
- 620x400 viewport with the aspect-constrained board
- a same-DPR live resize
- a live DPR 1 -> 2 transition on the same page

For each applicable state assert:

- `.board` and canvas CSS dimensions agree with the responsive layout
- canvas backing dimensions equal CSS dimensions times capped DPR
- `window.devicePixelRatio`/effective density match the requested case
- both `[data-glass]` hit targets remain inside the board and clicking/selecting the intended glass changes the exposed state correctly
- no uncaught page error occurs

For the live-DPR case, capture an artifact and a concise before/after dimension/error record. On the current candidate this scenario is expected to **FAIL because the defect exists**, but the script itself must treat that as an ordinary real failure, not an XFAIL.

- [ ] **Step 2: Run viewport/DPR standalone to prove defect capture**

Run the standalone scenario. Expected on the current baseline: nonzero/FAIL with the Pixi live-DPR failure identified; same-DPR cases should complete before that failure. Confirm the failure artifact is under `artifacts/verification/`.

- [ ] **Step 3: Implement WebGL context restoration**

Use `WEBGL_lose_context` when available. Capture candidate state and a rendered screenshot/signature, trigger loss then restoration, wait for both events, and assert:

- context loss event observed
- context restoration event observed
- `isContextLost()` is false after restore
- candidate gameplay state is unchanged
- visible rendering returns without synthetic gameplay input
- no unrelated browser error remains

If the extension is unavailable, report a clear environment SKIPPED/unsupported result rather than fabricating a pass.

- [ ] **Step 4: Run context restoration standalone**

Expected on the current baseline: PASS.

- [ ] **Step 5: Implement explicit Canvas fallback**

Use `context.addInitScript` before application initialization to make only WebGL/WebGL2 `getContext` unavailable while preserving 2D canvas. Navigate normally and assert `__STILLLIGHT_PIXI__.backend() === 'canvas'`. Drive selected, hint, invalid and deterministic mid-pour states through the existing debug API, assert nonempty state/frame data, capture one representative mid-pour screenshot, and fail on page errors.

- [ ] **Step 6: Run Canvas fallback standalone**

Expected on the current baseline: PASS, with one representative artifact.

- [ ] **Step 7: Commit Task 2**

```bash
git add scripts/verification/verify-viewport-dpr.mjs scripts/verification/verify-context-restore.mjs scripts/verification/verify-canvas-fallback.mjs
git commit -m "test: automate renderer lifecycle verification"
```

---

### Task 3: Scheduling and deterministic parity regressions

**Files:**
- Create: `scripts/verification/verify-idle-raf.mjs`
- Create: `scripts/verification/verify-parity-freeze.mjs`

**Interfaces:**
- Both export `run(harness)` and support standalone execution.
- Idle instrumentation is installed before app boot.
- Parity checks use the existing `__STILLLIGHT_PIXI__` deterministic API; they must not modify `src/main.ts` merely to make testing easier.

- [ ] **Step 1: Implement preboot RAF probe**

Inject a wrapper around page `requestAnimationFrame` before any application script. Expose count reset/read and a small bounded set of call stacks for diagnostics while delegating to the original RAF implementation.

- [ ] **Step 2: Implement idle RAF scenario**

Measure three phases:

1. settled idle after load
2. a real selection/animation interval, which must show RAF activity
3. settled idle after animation completion

The acceptance target is zero recurring page RAF requests during the one-second settled-idle windows. When nonzero, report count plus bounded stack attribution. Current baseline should **FAIL** and reproduce the roughly 75/sec Pixi ticker behavior found by Luna Max.

- [ ] **Step 3: Run idle RAF standalone**

Expected: FAIL for the current candidate, with no manual tracing required.

- [ ] **Step 4: Implement parity freeze scenario**

Enter parity through the existing debug API, create a deterministic pour frame at a fixed timestamp, then record:

- `state()`
- `lastFrame()` including timestamp
- candidate canvas screenshot hash and artifact

Wait about 900 ms without calling `step`, then record the same values and a second screenshot. Assert:

- state unchanged
- `lastFrame` unchanged
- deterministic timestamp unchanged
- screenshot remains visually stable (byte/hash equality is acceptable if deterministic in the environment; otherwise use a stable browser-side framebuffer/signature check and retain both screenshots)

Do not advance the deterministic clock merely to recover rendering. Current baseline should **FAIL** because the image clears while state remains frozen.

- [ ] **Step 5: Run parity freeze standalone**

Expected: FAIL for the current candidate and report the split clearly: state/time stable but rendered image unstable/blank.

- [ ] **Step 6: Commit Task 3**

```bash
git add scripts/verification/verify-idle-raf.mjs scripts/verification/verify-parity-freeze.mjs
git commit -m "test: automate scheduling and parity regressions"
```

---

### Task 4: Deterministic two-unit pour and stream boundaries

**Files:**
- Create: `scripts/verification/verify-pour-states.mjs`

**Interfaces:**
- Exports `run(harness)` and supports standalone execution.
- Uses Vite-served production modules in the browser; no new production debug setter is added.
- Builds a separate temporary verification model/renderer instance so the default app board is not mutated.

- [ ] **Step 1: Create a temporary production-module fixture in the browser**

From a page on the Vite origin, dynamically import `/src/core/model.ts` and `/src/render/StageRenderer.ts`. Create a temporary host, initialize a production `StageRenderer`, resize it to 400x620 at density 1, instantiate `StilllightModel`, set its public starting board to `[[2,0,3,3],[]]`, then call `startPour(T)` with a fixed `T`.

The fixture must be torn down and removed after the scenario.

- [ ] **Step 2: Assert two-unit transfer behavior**

Sample fixed progress points around 49%, 50% and completion. Assert:

- source lower layers remain represented during transfer
- target incoming layer exists during transfer
- top surfaces retain the required 45 samples when present
- transfer around 50% is consistent with the authored model
- after advancing completion/settle as required, final board is exactly `[[2,0],[3,3]]`

Capture a named 50% representative screenshot.

- [ ] **Step 3: Assert authored stream boundaries numerically**

At fixed progress values assert:

- 0.274 and 0.275: no stream
- 0.276: stream present with small positive alpha
- 0.50: stream alpha == 1 within floating-point tolerance
- 0.714: stream present with small positive alpha
- 0.715 and 0.716: no stream

The assertions derive from the independently pinned authored boundaries 27.5% and 71.5%, not from reading candidate constants back as the expected values.

- [ ] **Step 4: Run pour/stream scenario standalone**

Expected on the current baseline: PASS, with concise numeric output and high-value screenshots only.

- [ ] **Step 5: Commit Task 4**

```bash
git add scripts/verification/verify-pour-states.mjs
git commit -m "test: automate deterministic pour visual checks"
```

---

### Task 5: Aggregate commands, fail-fast M1 gate, and documentation

**Files:**
- Create: `scripts/verify-runtime.mjs`
- Create: `scripts/verify-visual.mjs`
- Create: `scripts/verify-m1.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- `verify-runtime.mjs` runs viewport/DPR, context restore, Canvas fallback, idle RAF and parity freeze under one harness lifecycle while giving each scenario an isolated context/page. It runs all runtime scenarios even when one fails, prints one table/summary, then exits nonzero if any required scenario failed.
- `verify-visual.mjs` runs deterministic pour/stream checks and exits nonzero on failure.
- `verify-m1.mjs` runs package scripts as subprocesses and prints PASS/FAIL/SKIPPED. It stops at the first failed stage in normal acceptance mode.

- [ ] **Step 1: Add targeted package scripts**

Add scripts equivalent to:

```text
verify:fast       -> npm run build && npm test && npm run test:reference
verify:viewport   -> standalone viewport/DPR scenario
verify:context    -> standalone context-restore scenario
verify:fallback   -> standalone Canvas-fallback scenario
verify:idle-raf   -> standalone idle-RAF scenario
verify:parity     -> standalone parity-freeze scenario
verify:pour       -> standalone pour/stream scenario
verify:runtime    -> node scripts/verify-runtime.mjs
verify:visual     -> node scripts/verify-visual.mjs
verify:m1         -> node scripts/verify-m1.mjs
```

Do not change existing dependency versions or existing script semantics.

- [ ] **Step 2: Implement runtime aggregator**

Create one shared harness lifecycle, run every runtime scenario in deterministic order with fresh isolated contexts, retain failure artifacts, summarize all statuses, and exit 1 if any required runtime scenario fails.

- [ ] **Step 3: Implement visual aggregator**

Run the deterministic two-unit/stream scenario and summarize status/artifacts.

- [ ] **Step 4: Implement fail-fast M1 runner**

Spawn `verify:fast`; on failure report `verify:runtime` and `verify:visual` as SKIPPED and exit nonzero. Only continue to runtime after fast PASS, and only continue to visual after runtime PASS. Preserve subprocess exit output sufficiently to identify the exact failed stage.

- [ ] **Step 5: Document commands and environment overrides**

Update `README.md` with a compact verification section describing:

- `npm run verify:fast`
- `npm run verify:runtime`
- `npm run verify:visual`
- `npm run verify:m1`
- targeted scenario commands
- optional `CHROMIUM_PATH`
- optional `STILLLIGHT_URL`
- artifact location
- routine verification should not require computer-use

- [ ] **Step 6: Verify current baseline behavior without fixing it**

Run, in this order:

1. `npm test` — expected PASS (existing unit coverage remains green).
2. `npm run test:reference` — expected PASS.
3. `npm run verify:visual` — expected PASS.
4. `npm run verify:runtime` — expected overall FAIL while context restoration and Canvas fallback PASS and the known live-DPR, idle-RAF and parity-freeze regressions FAIL.
5. `npm run verify:m1` — expected FAIL at `verify:fast` because the existing production TypeScript build errors remain; runtime and visual stages must be reported SKIPPED in this normal fail-fast command.

Do not treat these known failures as implementation failures of the harness if they are faithfully reproduced with the expected diagnostics.

- [ ] **Step 7: Check scope preservation**

Run `git diff`/`git status` and confirm no intentional changes under `src/`, `tests/` or `reference/original/`. Confirm generated artifacts are ignored.

- [ ] **Step 8: Commit Task 5**

```bash
git add package.json README.md scripts/verify-runtime.mjs scripts/verify-visual.mjs scripts/verify-m1.mjs
git commit -m "test: add fast M1 verification commands"
```

---

## Final Harness Acceptance

After all tasks are committed, collect evidence once for the unchanged HEAD:

- `npm test`: PASS
- `npm run test:reference`: PASS
- `npm run verify:visual`: PASS
- `npm run verify:runtime`: FAIL for the current known runtime defects with per-scenario diagnostics, while previously passing runtime scenarios remain PASS
- `npm run verify:m1`: FAIL fast at the current build defect and mark later stages SKIPPED
- `git status --short --branch`: clean except ignored runtime artifacts

Do **not** rerun all suites a second time solely for a generic verification skill if these results are fresh and no files changed after them.

Report:

1. exact files created/modified
2. commands and exit codes
3. PASS/FAIL/SKIPPED scenario summary
4. artifact paths
5. whether each of the four known defects is now reproducible automatically
6. confirmation that no production/gameplay fix was included
7. final commit SHAs

Then stop. The next separate plan/task will fix the four known defects against these regressions.
