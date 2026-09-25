# STILLLIGHT M1 Verification Harness — Design Specification

## Status

Approved in chat at the design level on 2026-09-26. This document is the written specification for the permanent M1 verification subsystem. No production implementation is included in this commit.

## Objective

Replace the slow, exploratory, browser-heavy runtime-verification process with a deterministic repository-owned verification harness that Codex can execute with minimal reasoning, minimal computer-use, and minimal repeated setup.

The target workflow is a small set of npm commands that reproduce the same acceptance checks Luna Max performed manually, isolate browser lifecycle-sensitive scenarios, emit concise PASS/FAIL output, retain useful failure artifacts, and support targeted reruns after fixes.

## Current Context

The repository already contains:

- `playwright-core`
- Vite dev-server scripts
- unit and reference test suites
- `scripts/capture-parity.mjs`, which already launches Chromium headlessly, captures browser errors, drives deterministic states, takes screenshots, and writes a report

The current M1 candidate has four known unresolved failures that this harness must encode without fixing during the harness-construction stage:

1. Production build TypeScript errors.
2. Live size/DPR transition can blank the Pixi WebGL scene.
3. Pixi continues roughly 75 RAF requests/sec while idle.
4. Deterministic parity state stays frozen but the WebGL image can clear.

## Scope

### In scope

Create a reusable verification subsystem with:

- a shared Playwright/Chromium harness
- isolated browser scenarios for lifecycle-sensitive runtime checks
- deterministic fixtures for representative gameplay/visual states
- fail-fast build/test gates
- targeted runtime verification commands
- a full M1 verification command
- concise machine-readable and human-readable results
- screenshots or diagnostics only when useful, especially on failure
- no new browser dependency unless the existing environment proves insufficient

### Out of scope

This stage must not:

- fix the four known failures
- change gameplay rules, liquid math, timing, authored motion, renderer behavior, or visuals
- refactor unrelated source code
- alter the golden reference implementation
- introduce a second browser automation stack when `playwright-core` is sufficient
- certify physical mobile/WebView performance
- rely on interactive computer-use for routine verification

## Architecture

Use a shared harness plus isolated scenario modules.

Recommended structure:

```text
scripts/
  verify-m1.mjs
  verification/
    browser-harness.mjs
    verify-viewport-dpr.mjs
    verify-context-restore.mjs
    verify-idle-raf.mjs
    verify-canvas-fallback.mjs
    verify-parity-freeze.mjs
    verify-pour-states.mjs
```

The exact filenames may be adjusted to match the existing repository style, but the separation of responsibilities must remain.

### Shared browser harness

`browser-harness.mjs` owns common infrastructure:

- locating Chromium from the existing supported environment/configuration
- launching and closing Chromium
- starting or connecting to the Vite server as needed
- creating isolated browser contexts/pages
- collecting console errors and page errors
- deterministic viewport/device-scale configuration
- shared timeout/error formatting
- artifact paths
- clean resource teardown

Scenario modules must not duplicate this bootstrap logic unless isolation requires it.

### Scenario modules

Each runtime scenario must have one clear responsibility and be executable independently for targeted reruns.

Browser-state-sensitive checks must use isolated contexts/pages so that context loss, DPR changes, fallback shims, or parity clock ownership cannot contaminate other scenarios.

## Verification Commands

Add package scripts with these conceptual responsibilities:

### `verify:fast`

Fail-fast deterministic package gate:

1. production build
2. unit tests
3. reference tests

If the build fails during a normal acceptance run, `verify:m1` must stop before expensive browser checks. For a diagnostic mode, runtime scenarios may be invoked explicitly despite a build failure.

### `verify:runtime`

Run repository-owned automated runtime checks:

- viewport/DPR transitions and hit alignment
- WebGL context loss/restoration
- idle RAF behavior
- explicit Canvas fallback
- parity freeze stability

### `verify:visual`

Run deterministic representative visual/gameplay checks:

- two-unit pour fixture
- stream fade boundaries
- any required named screenshots or numeric assertions

This command must prefer assertions over manual screenshot review. Screenshots should be retained where they provide diagnostic or parity value.

### `verify:m1`

Full normal M1 acceptance:

```text
verify:fast
  -> if PASS: verify:runtime
  -> if PASS: verify:visual
  -> summary
```

Output must clearly identify which scenario failed and where its artifacts/logs are located.

## Runtime Scenario Requirements

### Viewport / DPR

Automate representative cases including:

- 400x620 at DPR 1
- 320x496 at DPR 2
- representative landscape constraint
- same-DPR live resize
- live DPR transition

Assert, where applicable:

- CSS canvas dimensions
- backing-store dimensions
- expected DPR
- nonblank rendered output
- hit-target alignment with glass positions
- usable input after resize
- no uncaught browser/page errors

The current live-DPR failure should be reproducible and reported clearly until fixed.

### Context restoration

Use `WEBGL_lose_context` where available and assert:

- context-lost event occurs
- context-restored event occurs
- context is usable after restore
- application state is preserved as required
- visible rendering returns without unrelated user interaction

### Idle RAF

Install callback instrumentation before application boot where possible.

Measure:

- idle after load/settle
- activity during a real animation
- idle after the animation settles

Report counts and, on failure, useful stack attribution when practical.

The check must distinguish application-demand RAF work from recurring Pixi/system ticker activity rather than relying on visual observation.

### Canvas fallback

Force the supported explicit fallback path before renderer initialization.

Assert:

- Canvas backend is selected
- representative mid-pour state renders
- source/receiver liquids, stream, surface and impact are represented
- selected, hint and invalid emphasis states render
- no unexpected browser errors occur

Do not use an incomplete implicit Pixi Canvas fallback as acceptance evidence.

### Parity freeze

At a deterministic timestamp:

- capture model/state identifiers
- capture `lastFrame`/timestamp
- establish visible nonblank framebuffer state
- wait without advancing the deterministic clock
- assert model/state/timestamp remain unchanged
- assert the rendered image remains present/stable without calling `step`

This must reproduce the current frozen-frame clearing defect until fixed.

### Deterministic pour / stream checks

Create or reuse a deterministic two-unit transfer fixture.

Assert:

- lower source layers remain represented during transfer
- incoming receiver layers are represented
- final board state is correct
- surface sampling remains present where required
- stream visibility/alpha behavior matches authored boundaries around 27.5% and 71.5%

Prefer numeric assertions first, with named captures only at high-value boundary states.

## Existing Test Reuse

Do not recreate browser coverage for conditions already fully covered by existing unit tests when browser execution adds no value.

In particular, retain existing CPU storage-reuse and detached-snapshot unit coverage if it is already sufficient. The full verification command may invoke those unit tests through the normal test suite rather than duplicating their logic in browser scripts.

## Result and Artifact Policy

Verification output must be concise and self-diagnosing.

A failure should report information similar to:

```text
DPR_LIVE_CHANGE: FAIL
before: css=400x620 backing=400x620 dpr=1
after:  css=320x496 backing=640x992 dpr=2
page error: MeshSimple._render ... getBuffer
artifact: artifacts/verification/dpr-live-change-fail.png
```

Generated runtime artifacts must live in a gitignored location and must not modify the golden reference tree.

A top-level summary should expose PASS / FAIL / SKIPPED per scenario and use a nonzero exit code when required acceptance checks fail.

## Execution Efficiency Policy

Routine verification must default to:

- shell / PowerShell
- npm
- existing `playwright-core`
- direct deterministic scripts

Do not voluntarily use for routine runs:

- computer-use/CUA
- manual browser clicking
- web search
- subagents
- broad framework/source research
- interactive ad-hoc runtime snippets when the same instrumentation belongs in a reusable helper

Computer-use is reserved for cases where the automated harness itself cannot reproduce or diagnose a required condition.

Do not rerun fresh suites solely because a generic verification workflow asks for confirmation if valid results were just produced for the current unchanged working tree. Verification-before-completion principles should be satisfied by the repository-owned verification command and preserved output.

If an environment-mandated skill activates, satisfy its minimum requirements without broadening scope or repeating already-current evidence unnecessarily.

## Error Handling

The harness must:

- close browser resources on both success and failure
- surface server/browser startup failures distinctly from scenario assertion failures
- avoid hiding page/console errors
- avoid continuing dependent scenarios after an invalid prerequisite
- make targeted scenario commands runnable independently
- avoid destructive cleanup of user source files

When Chromium is unavailable or incompatible, report the environment requirement clearly instead of silently switching to computer-use.

## Parallelism

Initial implementation should prioritize deterministic correctness over maximum concurrency.

After stable isolation is demonstrated, independent runtime scenarios may be parallelized using separate browser contexts/processes where GPU/timing interference will not invalidate results.

Do not parallelize timing-sensitive scenarios merely to reduce wall-clock time if concurrency changes their measurement validity.

## Testing the Harness

Harness construction is successful when:

1. Existing unit/reference behavior is preserved.
2. The harness can run targeted scenarios without manual browser interaction.
3. The four currently known unresolved failures are reproduced as deterministic failures or fail-fast build output rather than being accidentally hidden.
4. Previously passing scenarios remain passing.
5. Runtime scenarios do not contaminate one another.
6. Failure reports identify the scenario, observed values/error, and useful artifact location.
7. No gameplay/rendering implementation is changed merely to make the harness pass.

## Acceptance Criteria for This Stage

The harness stage is complete only when all of the following are true:

- `verify:fast`, `verify:runtime`, `verify:visual`, and `verify:m1` exist with documented behavior.
- Browser lifecycle-sensitive checks are isolated.
- viewport/DPR, context restoration, idle RAF, Canvas fallback, parity freeze, two-unit pour, and stream fade coverage can be invoked without computer-use.
- Known current failures are reported faithfully.
- generated verification artifacts are gitignored.
- no production/gameplay fixes are bundled into this stage.
- exact changed files and command results are reported.

## Follow-up Stage

After this harness specification is implemented and verified, a separate task will fix the four known failures against these regressions. The fixes and their targeted reruns must remain a separate implementation stage so the new tests prove the defects existed before the fixes.
