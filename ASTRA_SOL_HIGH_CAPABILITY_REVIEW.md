# STILLLIGHT — Astra Max Review of Sol High Web Capability

**STATUS: FINAL REVIEW TASK**  
**REVIEWER: Astra Max in Codex**  
**SUBJECT: Sol High Web implementation capability**  
**MODE: REVIEW / AUDIT ONLY — DO NOT MODIFY SOURCE**

---

## 1. Purpose

This is **not** another open-ended bug-fixing cycle.

The purpose of this review is to answer one specific benchmark question:

> **Was Sol High on Web capable of taking Astra Max's prepared STILLLIGHT architecture / implementation job and executing it approximately as Astra Max itself would have, while preserving the original authored behavior and the intended production architecture?**

Evaluate Sol High as an implementation engineer working from Astra's architecture and audit findings.

Do **not** judge Sol merely by whether every final runtime assertion is green. Separate:

1. **engineering / architecture capability**, and
2. **current product acceptance status**.

A narrow residual runtime defect may affect release status without necessarily proving that Sol failed the architecture task.

Likewise, passing tests alone does not prove architectural fidelity.

Your job is to inspect the actual implementation and make the comparison yourself.

---

## 2. Original Astra Max role and intent

Astra Max's original Stage-1 role was architecture selection and reverse-engineering, not implementation.

The supplied two-glass Canvas implementation was the behavioral and visual source of truth. Architecture could change; authored behavior could not.

The selected direction was the refined PixiJS Plan B:

```text
Input
  -> gameplay / authored timeline
  -> original authored motion + liquid mathematics
  -> reusable renderer-independent frame/state
  -> retained PixiJS 8 WebGL renderer
```

with an independent Canvas reference/fallback path.

The important intent was:

- preserve the original authored liquid/gameplay math rather than replace it with generic physics
- preserve deterministic authored timing and motion
- keep simulation authority outside Pixi
- use retained GPU resources / meshes / strips rather than per-frame scene reconstruction
- reduce hot-path allocation where practical
- preserve the untouched original Canvas implementation as an independent oracle
- use explicit Canvas fallback when qualified GPU rendering is unavailable
- keep rendering demand-driven rather than installing an always-running game/render loop
- support responsive viewport / capped DPR correctly
- survive WebGL context restoration without advancing gameplay state
- keep deterministic parity/debug time isolated from production scheduling
- maximize future visual ceiling only **after** parity is accepted

The original benchmark was intentionally difficult: fidelity first, then performance / maintainability / future visual capability.

---

## 3. Original authored invariants that matter to this review

Do not reward an implementation that is cleaner but changes the authored game feel.

Inspect whether the current implementation preserves the important original distinctions, including where relevant:

- logical board: `400 x 620`
- original glass silhouette / curved clipping behavior
- separate upright and moving-liquid rendering logic
- canonical liquid-area model rather than simple proportional height
- 21-iteration liquid level solve
- original 45-sample moving surface / wave representation
- source/receiver authored slosh and tilt
- temporary incoming liquid layers
- original board-commit and settling semantics
- authored stream geometry / timing
- deterministic timeline behavior independent of display refresh
- original interaction semantics for selection, hint, invalid move, pour and settle
- moving source must not retain source-hint emphasis

Known timing/parity values established during the original work included:

- selection: 300 ms
- invalid: 420 ms
- hint: 680 ms
- pour: 1040 ms
- settle: 440 ms
- transfer window: approximately 30%–69% of pour
- stream window: approximately 27.5%–71.5% of pour

Do not retune these simply because another motion would look more physical.

---

## 4. Astra's authoritative correction assignment that Sol High received

Astra's audit filtered the remaining implementation work into C1–C7:

1. **C1 — Responsive / DPR / hit-target coordination**
2. **C2 — Full idle RAF shutdown**
3. **C3 — CPU frame storage reuse**
4. **C4 — Moving-source hint emphasis**
5. **C5 — WebGL context restoration invalidation**
6. **C6 — Explicit Canvas fallback**
7. **C7 — Parity clock isolation + stronger regressions**

The assignment explicitly said:

- no architecture redesign
- no renderer restart
- no generic physics replacement
- no spring simulation
- no per-frame renderer reconstruction
- no always-running loop
- keep the golden Canvas reference untouched and independent
- implement the smallest sound fixes

Established Astra findings that Sol was not supposed to reinvent included:

- golden reference integrity intact
- 40,000 independent liquid-level cases matched
- 10,426 replayed frames / 1,318,934 field comparisons found only one substantive authored-model discrepancy: moving-source hint emphasis
- poses, dynamic tilt, source/receiver slosh, absolute wave phase, temporary incoming layers, board-commit timing and frame-observed settling already matched
- normal WebGL appearance was close enough for the parity baseline
- small Canvas/WebGL edge/stroke/halo differences were non-blocking
- retained GPU architecture was substantive

Judge Sol primarily on whether it executed this prepared job faithfully and competently.

---

## 5. Current repository / review target

Repository:

`coderboi1520/stilllight-web`

Branch:

`stage2-m1-runtime`

The implementation under review culminated at:

`d6a967a958a297250d12b3e4c0b423253b35c759`

Any later commit that only adds this review document is **review metadata**, not part of Sol's production implementation. Use `d6a967a...` as the implementation checkpoint unless the branch history clearly shows a later production-code change that the user explicitly asks you to include.

Inspect the actual repository, source, tests, verification harness, and relevant Git history. Do not rely only on handoff summaries.

Important implementation areas include at minimum:

- `src/core/`
- `src/render/`
- `src/render/pixi/`
- `src/render/CanvasRenderer.ts` or equivalent explicit Canvas adapter
- viewport / lifecycle / scheduling code
- parity/debug clock code
- regression tests
- verification harness scripts
- `reference/original/`

Compare current source against the intended architecture as a whole, not only the last small diff.

---

## 6. Important engineering history to consider

During the final lifecycle work, Luna produced an intermediate implementation that Sol High **did not blindly accept**.

Sol reviewed and rejected parts of it, specifically concluding that:

- rebuilding the whole Pixi view graph on WebGL context restoration was unnecessary because Pixi can recreate GPU state from retained CPU-side resources
- resource teardown needed explicit ownership because renderer GC scheduling was being disabled
- the density-keyed stream texture lease system introduced by the intermediate implementation was unnecessary

Sol's adopted design instead retained the existing view graph across context restoration, rebuilt density-sensitive retained views only for live DPR changes, retired old DPR generations only after a successful replacement render, and explicitly destroyed private generated textures / private MeshSimple geometry where ownership required it.

Sol also traced Pixi's idle RAF activity to renderer `SchedulerSystem` registration with `Ticker.system`, and kept `FrameGate` as production animation owner.

Treat this history as evidence of engineering judgment only if the current source actually supports the claimed design.

---

## 7. Existing verification evidence

Use existing evidence; do not automatically launch another giant verification campaign.

### Established passes

At the Sol-owned implementation checkpoints, the following have passed:

- TypeScript production compilation
- Vite production build
- unit / structural tests
- original-reference tests
- Canvas fallback verification
- two-unit pour / stream-boundary verification
- deterministic parity-freeze verification
- WebGL context restoration verification
- idle RAF verification in the latest narrow run:
  - settled after load: `0`
  - active animation: `26`
  - settled after animation: `0`

The latest narrow run also reported:

- `npx tsc -p tsconfig.json --noEmit` — PASS
- renderer structural tests — 9/9 PASS
- no reported browser page errors in the targeted checks

### Remaining known runtime failure

The latest `verify:viewport` still failed a **same-CSS-size, live DPR-only transition**:

```text
before:
board   320x496
CSS     320x496
backing 320x496
DPR     1

after:
board   320x496
CSS     320x496
backing 320x496
DPR     2
```

Expected backing resolution for the accepted DPR=2 transition would be consistent with the capped DPR policy, rather than remaining at the DPR=1 backing dimensions.

Important context:

- the earlier catastrophic Pixi `getBuffer` / blank-scene failure no longer reproduced in the later verification
- context restoration is passing
- idle recurring RAF is passing
- this remaining DPR case did not report a page error
- final `verify:m1` was not run because the harness intentionally gates it on the targeted viewport test

Do not hide this failure. Assess its significance.

---

## 8. What to inspect

### A. Architectural fidelity

Determine whether the current implementation materially follows the architecture Astra would have wanted:

- authored core remains renderer-independent
- Pixi rasterizes rather than owns simulation
- retained GPU resource strategy is real
- Canvas fallback/reference separation is sound
- no replacement physics/easing was introduced
- no always-running render loop was introduced
- original behavior remains the parity source of truth

### B. Sol's implementation quality

Review:

- correctness
- simplicity versus over-engineering
- ownership/lifetime design
- allocation discipline
- resource destruction
- context lifecycle
- DPR lifecycle
- idle scheduling
- deterministic parity isolation
- regression-test quality
- maintainability / AI-modifiability

### C. C1–C7 execution

For each C1–C7, classify:

- **Implemented correctly**
- **Implemented with a minor deviation**
- **Incomplete / still failing**
- **Architecturally wrong**

Explain briefly using actual source evidence.

### D. Compare against Astra's own likely implementation

This is the central benchmark.

Ask yourself:

> If Astra Max had been given its own architecture/audit and told to implement the job, would the resulting design likely be materially the same as what Sol High produced?

Do not require identical filenames, syntax, or personal coding style.

Focus on:

- same ownership boundaries
- same preservation of authored math/timing
- same lifecycle model
- same retained-resource strategy
- same performance principles
- same fallback/parity intent
- same correctness trade-offs

Explicitly list any places where you believe **Astra would have implemented the solution differently in a materially important way**.

### E. Residual DPR issue

Give the same-size DPR-only failure an explicit severity:

- **BLOCKER** — architecture/job is not acceptably complete
- **REAL BUT NARROW DEFECT** — Sol's architecture execution is still strong, but product needs one bounded fix
- **HARNESS / ENVIRONMENT-SPECIFIC OR NON-BLOCKING** — evidence does not justify blocking the architecture capability verdict

Explain why.

If it is a real defect, distinguish whether it reflects:

- a fundamental architecture failure
- a local implementation bug inside an otherwise-correct architecture
- a harness/emulation mismatch

Do **not** create an endless fix loop. If one correction is genuinely required, define the smallest bounded correction once.

---

## 9. Required final output

Return a concise but technically rigorous report with these sections.

### 1. Executive verdict

Answer immediately:

> **Could Sol High Web execute Astra Max's prepared STILLLIGHT job approximately as Astra Max itself would have?**

Use one of:

- **YES**
- **MOSTLY YES**
- **NO**

Then give 2–5 sentences of justification.

### 2. Capability score

Score Sol High Web from 0–100 on:

| Dimension | Score |
|---|---:|
| Architecture fidelity | /100 |
| Preservation of authored behavior | /100 |
| Renderer/resource engineering | /100 |
| Performance engineering | /100 |
| Debugging / root-cause reasoning | /100 |
| Regression / verification discipline | /100 |
| Maintainability | /100 |
| **Overall ability to execute Astra's prepared job** | **/100** |

Do not inflate scores because the user wants a positive answer.

### 3. C1–C7 assessment

One compact table with status and the most important evidence for each item.

### 4. What Sol did the way Astra would have

List the important architectural / engineering decisions that materially match what you would have done.

### 5. What Astra would have done differently

Only material differences. Do not nitpick style.

### 6. Remaining DPR issue

State severity, likely category, and whether it changes the Sol-capability verdict.

### 7. Product M1 status

Separate from the capability score, give one of:

- **PASS**
- **CONDITIONAL PASS**
- **FAIL**

This status may differ from the Sol capability verdict.

### 8. Final benchmark conclusion

End with exactly this structure:

```text
SOL HIGH WEB CAPABILITY: YES / MOSTLY YES / NO
OVERALL SCORE: __/100
WOULD ASTRA MAX HAVE BUILT IT MATERIALLY THE SAME WAY: YES / MOSTLY / NO
M1 PRODUCT STATUS: PASS / CONDITIONAL PASS / FAIL
MAIN DIFFERENCE FROM ASTRA'S OWN LIKELY IMPLEMENTATION: ...
REMAINING REQUIRED WORK, IF ANY: ...
```

---

## 10. Hard rules

- **Do not modify source code.**
- **Do not commit fixes.**
- **Do not redesign the game.**
- **Do not start Stage 3 visual enhancement.**
- **Do not turn this into another Sol/Luna verification loop.**
- **Do not demand identical implementation style when architecture and behavior are equivalent.**
- **Do not treat one narrow residual runtime defect as automatic proof that Sol failed the architecture benchmark.**
- **Do not ignore genuine architectural violations just because most tests pass.**
- Inspect actual source and history before reaching the verdict.
- Existing runtime evidence is evidence, not a substitute for source review.
- The benchmark is whether Sol High Web successfully executed Astra Max's prepared engineering job at approximately Astra-level architectural quality.

Stop after the review report.