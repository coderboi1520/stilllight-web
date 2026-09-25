# STILLLIGHT — Sol High Web M1 Final Fix Task

**STATUS: ACTIVE**  
**PRIMARY ENGINEER: Sol High on Web**  
**TOP-LEVEL ARCHITECTURE AUTHORITY / FINAL REVIEWER: Astra Max**  
**LOCAL RUNTIME VERIFIER ONLY: Luna Codex**

---

## 1. Authoritative checkpoint

Repository: `coderboi1520/stilllight-web`  
Working branch: `stage2-m1-runtime`  
Production/harness checkpoint before this task: `2c453b40bfb479af014742f2e9967985cc5052c7`

The commit that adds this `SOL_TASK.md` is task metadata only. Treat `2c453b40...` as the code/harness baseline for this fix stage.

Do **not** work on `main`.

Before changing code:

1. Read this file completely.
2. Inspect the current `stage2-m1-runtime` branch.
3. Read the relevant existing source and verification harness.
4. Read these approved harness documents for context:
   - `docs/superpowers/specs/2026-09-26-stilllight-verification-harness-design.md`
   - `docs/superpowers/plans/2026-09-26-stilllight-verification-harness.md`
5. Preserve the existing Astra-authored renderer/model architecture. Do not redesign the system merely because another implementation would be easier.

---

## 2. Model responsibility hierarchy

### Astra Max — architecture authority + final certification gate

Astra Max originally defined the high-level architecture and will receive the finished build for final review.

Astra is responsible for judging whether its architecture was implemented faithfully and whether M1 is genuinely complete.

Do not spend Astra on routine implementation or runtime execution.

### Sol High Web — PRIMARY ENGINEER

You own this stage end-to-end:

- diagnose failures
- design fixes
- edit production code
- review your own diffs
- preserve architectural invariants
- perform all verification available from the Web/GitHub environment
- interpret any runtime evidence returned by Luna
- decide the next implementation step
- prepare the final Astra review packet

You are not merely a planner for Luna. You are the builder and primary verifier.

### Luna Codex — runtime evidence instrument only

Luna is **not** a builder for this stage.

Use Luna only for evidence that Sol High Web genuinely cannot obtain, such as:

- actual local `npm` / TypeScript execution
- Playwright / Chromium runtime behavior
- live DPR changes
- WebGL context loss/restoration
- RAF/ticker measurements
- local Windows/browser behavior

If Luna is needed, first complete your source-level diagnosis and either implement the intended fix or specify precisely what evidence is needed.

Then create or update a narrow `LUNA_VERIFY_TASK.md` containing the exact command(s), expected observations, artifacts, and stop condition.

Luna must not redesign, broadly debug, or modify production source unless a later task explicitly authorizes it.

After Luna reports, control returns to Sol. Sol interprets the evidence and makes the engineering decision.

---

## 3. Architecture that must remain intact

The approved architecture is conceptually:

```text
Input
  -> gameplay/timeline
  -> authored motion/liquid math
  -> reusable frame data
  -> renderer
```

Current M1 uses:

- renderer-independent authored TypeScript model
- retained PixiJS 8 WebGL renderer
- independent Canvas reference/fallback
- deterministic authored timing/math
- demand-driven production rendering rather than a permanent animation loop

Important invariants:

- renderer rasterizes frame data; it must not become the simulation authority
- authored liquid geometry, motion and timing remain authoritative
- Canvas fallback consumes the same authored frame data
- `reference/original/` remains untouched
- no generic physics replacement
- no behavior-changing timing rewrite
- no dependency/framework migration
- no test weakening to manufacture a green result
- keep CPU/GPU reuse/performance intent where applicable
- parity mode remains deterministic and isolated

Prefer the smallest semantically correct fix.

---

## 4. Current verified state

The permanent M1 verification harness is implemented through baseline commit `2c453b40...`.

Harness commits immediately preceding this task:

- `8eb123a` — reusable browser verification harness
- `0850ca3` — renderer lifecycle verification
- `4280b66` — scheduling and parity regressions
- `a7f963f` — deterministic pour visual checks
- `2c453b4` — fast M1 verification commands

Latest observed results:

### Existing passes

- `npm test` — PASS, 26 tests
- `npm run test:reference` — PASS, 7 tests
- `npm run verify:visual` — PASS
- Canvas fallback scenario — PASS
- two-unit pour / stream-boundary scenario — PASS
- parity-freeze scenario — PASS in the new deterministic harness

### Existing failures / actionable problems

#### A. Production build — FAIL

Two known TypeScript errors:

1. `src/core/model.ts` around line 93  
   `Float64Array<ArrayBufferLike>` type mismatch.

2. `src/render/pixi/PixiRenderer.ts` around line 26  
   `null` is passed where Pixi typing expects an `HTMLElement`.

#### B. Live DPR / resize — FAIL

The automated runtime harness reproduced the Pixi `MeshSimple` / `getBuffer` failure and blank-scene behavior during a live size/DPR change.

Fresh load at the target DPR had previously worked; the failure concerns the live lifecycle.

#### C. Context restoration — currently FAIL in the new harness

The context-restoration scenario captured a Pixi `getBuffer` page error.

Treat this as potentially related to the same retained WebGL resource lifecycle problem as live DPR until source inspection proves otherwise.

Do not assume context restoration is an independent bug merely because it is a separate scenario.

#### D. Idle RAF — FAIL

Recurring Pixi RAF/ticker activity remains while the scene should be idle, despite the intended demand-driven architecture.

### Parity freeze — currently PASS

The permanent test now checks deterministic state/frame stability and before/after canvas image stability.

Do **not** create a production parity fix solely because an earlier exploratory run once observed a cleared framebuffer.

Keep the regression guard. Reopen parity only if fresh evidence reproduces a real production failure.

---

## 5. Primary objective

Finish M1 by resolving the actual production failures while preserving Astra Max's architecture.

The intended engineering order is:

1. production build errors
2. live DPR + context resource lifecycle
3. idle RAF
4. Sol pre-audit
5. one final broad runtime acceptance
6. Astra Max final architecture review

Do not repeatedly run the full M1 suite during development.

---

## 6. Work package A — production build

Inspect the actual types and ownership around the two TypeScript errors.

Fix both with the smallest semantically correct changes.

Requirements:

- do not weaken compiler/type safety merely to silence errors
- do not use broad `any` casts unless technically unavoidable and justified
- do not change authored liquid behavior or timing
- do not change reference behavior
- preserve reusable storage intent in `model.ts`
- preserve the intended Pixi input/event policy

After editing:

1. inspect the exact diff
2. reason through behavior impact
3. perform any Web/static checks available to you

If actual execution of the build gate is unavailable from Web, create/update `LUNA_VERIFY_TASK.md` with a narrow request to run:

```bash
npm run verify:fast
```

Luna should return exact output only; it should not fix failures.

Do not move to broad runtime work until the build fix is source-reviewed and, where possible, verified.

---

## 7. Work package B — live DPR + context restoration

Treat these together first because both currently surface Pixi/WebGL retained-resource failures.

Inspect at minimum:

- `src/render/StageRenderer.ts`
- `src/render/pixi/PixiRenderer.ts`
- `src/render/ViewportController.ts`
- retained glass/liquid/stream view ownership
- `MeshSimple` / geometry / buffer lifetime
- density-change rebuild behavior
- renderer resize behavior
- WebGL context-loss/restoration handling
- any renderer-event target manipulation
- any resource reuse across renderer/context generations

Find the root cause rather than patching the harness symptom.

Questions the fix should answer explicitly:

1. Which resource becomes invalid or detached during live DPR/resize?
2. Why does a fresh load at the new DPR avoid the failure?
3. Does the context-restoration error share the same ownership/lifetime problem?
4. Which objects must be rebuilt, rebound, or preserved when density/context generation changes?
5. Can the fix preserve retained rendering and reuse without stale GPU-resource ownership?

Constraints:

- preserve renderer-independent authored frame data
- preserve Canvas fallback
- preserve DPR cap behavior
- preserve demand-driven rendering
- avoid brute-force full application destruction/recreation unless source reasoning shows it is the correct robust lifecycle and it still satisfies Astra's architecture/performance goals
- do not move simulation logic into Pixi

After implementation, self-review the diff.

If local browser evidence is needed, create/update `LUNA_VERIFY_TASK.md` requesting **only** the targeted live-DPR and context-restoration scenarios. Do not ask Luna to run `verify:m1` at this stage.

Luna should return:

- exact PASS/FAIL
- page errors
- relevant metrics
- generated artifact paths
- no source edits

Use that evidence to continue the Sol diagnosis/fix loop.

---

## 8. Work package C — idle RAF

Find the real owner of recurring idle animation callbacks.

Current architecture already intends:

- `autoStart: false`
- `sharedTicker: false`
- stopped Pixi ticker
- `FrameGate` demand-driven scheduling

Inspect whether Pixi Application, ticker, renderer events, resize machinery, interaction/events, or another retained subsystem is still registering/scheduling RAF callbacks.

The fix must:

- eliminate recurring idle Pixi RAF work
- preserve active animation rendering
- preserve input responsiveness
- preserve context restoration
- preserve live resize behavior
- preserve parity-mode determinism
- preserve FrameGate's role as the production animation gate

Do not merely hide the test's counter.

After source-level diagnosis and implementation, self-review.

If browser timing evidence is required, create/update `LUNA_VERIFY_TASK.md` requesting only the targeted idle-RAF scenario and exact measurements.

---

## 9. Verification discipline

Use the permanent harness as a regression instrument, not as an excuse for repeated broad reruns.

Preferred loop:

```text
Sol source diagnosis
  -> Sol implements minimal fix
  -> Sol diff/static review
  -> targeted Luna verification only if Web cannot execute the needed evidence
  -> Luna returns raw evidence
  -> Sol interprets
  -> repeat only for the failing area
```

Only after all targeted failures are resolved should a final broad run be requested.

The final broad runtime acceptance is:

```bash
npm run verify:m1
```

Run/request this **once at final acceptance**, unless it exposes a new failure that genuinely requires another final run after correction.

Do not repeatedly rerun already-passing scenarios after unrelated fixes.

Do not modify tests merely to match broken production behavior.

---

## 10. Sol final pre-audit

Before declaring implementation ready for Astra, inspect the complete fix-stage diff from baseline `2c453b40...` to the final production commit.

Confirm explicitly:

- authored model semantics are preserved
- timing constants and transitions are preserved
- renderer remains a rasterization layer
- Canvas fallback still uses common frame data
- live DPR/resize lifecycle is deterministic
- WebGL resource ownership is coherent across resize/density/context generations
- context restoration is sound
- there is no permanent idle ticker/RAF owner
- reusable CPU/GPU structures remain where intended
- parity mode remains isolated and deterministic
- `reference/original/` is untouched
- harness assertions were not weakened to make failures disappear
- no unnecessary dependencies were added
- no broad architectural drift occurred

Keep a compact running engineering ledger during the task:

| Issue | Root cause | Production change | Evidence | Status |
|---|---|---|---|---|

This ledger will become part of the Astra handoff.

---

## 11. Git discipline

Work only on `stage2-m1-runtime`.

Before each write, use the current branch state rather than stale SHAs.

Prefer coherent commits by fix area rather than one giant commit or dozens of trivial commits.

Recommended commit boundaries, if the actual solution naturally supports them:

1. build/type correctness
2. Pixi lifecycle / DPR / context
3. idle RAF
4. final review/handoff documentation

Do not rewrite or force-push history.

Do not merge to `main` during this task.

At the end, push/ensure all authorized commits are present on `origin/stage2-m1-runtime` and record the final SHA.

---

## 12. Final Astra Max review packet — mandatory

Passing tests is **not** the end of this task.

After implementation and runtime acceptance are complete, create:

`ASTRA_M1_FINAL_REVIEW.md`

This is the handoff back to Astra Max so it can audit whether its own architecture was implemented faithfully.

The packet must include:

1. repository, branch, and final commit SHA
2. production baseline SHA `2c453b40bfb479af014742f2e9967985cc5052c7`
3. concise fix-stage commit history
4. complete list of production files changed
5. each original problem
6. root cause of each problem
7. exact fix for each problem
8. architectural invariants preserved
9. any deviation from Astra's original architecture/plan and the reason
10. unit-test result
11. golden/reference-test result
12. targeted runtime results
13. final `verify:m1` result
14. parity status and whether parity/reference behavior changed
15. browser/environment-specific observations
16. unresolved limitations or unverified assumptions
17. concise diff-review summary
18. areas Astra should inspect especially closely

End that document with an explicit request for Astra Max to:

- inspect the relevant actual source and diffs, not merely trust Sol's summary
- compare the result with Astra's original architecture
- review correctness, parity, renderer lifecycle, resource ownership, performance architecture, and regression coverage
- identify any remaining architecture violations or weak evidence
- give a final **PASS / CONDITIONAL PASS / FAIL** M1 assessment
- avoid redesigning merely for stylistic preference if the approved architecture is faithfully satisfied

Sol must **not** certify Astra's final review on Astra's behalf.

---

## 13. Efficiency rules

- Use GitHub/source inspection before asking for runtime work.
- Do not redo settled architectural research.
- Do not use Luna for routine implementation.
- Do not ask Luna to broadly investigate if a targeted question is available.
- Do not ask Astra to run routine tests.
- Do not rerun the entire suite after every edit.
- Do not perform broad web research unless source/API behavior cannot be resolved from the existing repository and authoritative library documentation is genuinely necessary.
- Prefer minimal attributable changes.
- Preserve already-passing behavior.
- If a production change causes an unrelated regression, diagnose it before stacking further changes.

Evidence hierarchy:

```text
Sol source/static reasoning first
  -> targeted Luna local/runtime evidence only when genuinely required
  -> Sol interprets and completes implementation
  -> one final runtime acceptance
  -> Astra Max final architectural certification
```

---

## 14. STOP / handoff conditions

### If you need Luna runtime evidence

Create/update `LUNA_VERIFY_TASK.md` with the narrow request, commit/push it, then STOP and tell the user exactly what Luna must run.

Do not continue guessing about runtime behavior while waiting for evidence.

### If all production work is complete

Ensure:

- targeted evidence is complete
- final acceptance evidence is complete
- `ASTRA_M1_FINAL_REVIEW.md` exists and is current
- branch is pushed
- final SHA is recorded

Then STOP and give the user a concise completion report plus the exact short prompt to give Astra Max.

### If a genuine architectural uncertainty appears

Do not improvise a redesign. Document the uncertainty precisely and STOP for Astra Max architectural review.

---

## 15. Start now

Begin by inspecting the current authoritative branch and the relevant production/harness files.

First establish a source-level diagnosis for the two build errors and the likely relationship (or non-relationship) between live DPR and context restoration.

Then make the smallest justified production change following the work order above.
