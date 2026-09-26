# STILLLIGHT — Astra Max STATIC REVIEW ONLY Override

**STATUS: ACTIVE OVERRIDE**  
**APPLIES TO:** `ASTRA_SOL_HIGH_CAPABILITY_REVIEW.md`  
**REVIEWER:** Astra Max in Codex  
**MODE:** STATIC SOURCE / GIT HISTORY REVIEW ONLY

---

## 1. Purpose

This file overrides any wording in `ASTRA_SOL_HIGH_CAPABILITY_REVIEW.md` that could be interpreted as permission to execute, test, verify, benchmark, launch, build, or reproduce anything.

The sole purpose of the Astra Max session is to answer:

> **Did Sol High Web implement Astra Max's prepared STILLLIGHT architecture/job approximately as Astra Max itself would have?**

This is a **code-review capability benchmark**, not another runtime-verification session.

All runtime/test evidence already collected by Luna and earlier verification work is to be treated as supplied evidence. Astra may reason about that evidence, but Astra must **not recreate it**.

---

## 2. Absolute prohibition on execution

Astra Max must NOT run or launch any of the following, directly or indirectly:

- `npm install`
- `npm ci`
- `npm test`
- `npm run build`
- `npm run verify:*`
- `tsc`
- Vite
- Playwright
- Chromium / Chrome / browser automation
- any local server
- any runtime harness
- any screenshot capture
- any visual/browser inspection session
- any performance benchmark
- any RAF measurement
- any DPR emulation
- any WebGL context-loss/restoration experiment
- any Canvas fallback runtime experiment
- any parity capture
- any generated test fixture
- any ad-hoc Node script used to execute project behavior
- any shell command whose purpose is to execute or verify the application

Do not run the existing verification harness even if it looks convenient.

Do not rerun a single targeted check "just to confirm" something.

Do not install dependencies.

Do not launch subagents to execute tests on Astra's behalf.

Do not ask Luna, Sol, another model, browser tool, or external tool to perform new verification during this review.

---

## 3. What Astra IS allowed to do

Astra may only inspect/read static material needed for the architectural comparison, including:

- repository source files
- tests as source code
- verification scripts as source code
- Git commit history
- diffs / patches
- task / handoff Markdown files
- `reference/original/` source files
- existing recorded verification reports already present in the repository/context

Reading test or harness code is allowed because the purpose is to understand what it asserts and how Sol structured the implementation.

Executing those tests or harnesses is forbidden.

Use source inspection and engineering reasoning only.

---

## 4. Evidence policy

Treat existing runtime results as historical evidence, not tasks to reproduce.

Known evidence includes the already-reported passes/failures in `ASTRA_SOL_HIGH_CAPABILITY_REVIEW.md`, including:

- build / TypeScript results already obtained by Luna
- unit/reference results already obtained
- context-restoration result already obtained
- idle-RAF result already obtained
- Canvas fallback / parity / visual results already obtained
- the remaining same-CSS-size live-DPR failure already obtained

Astra may judge whether the source code plausibly explains those results and whether Sol's design is architecturally sound.

Astra must not spend tokens independently re-proving the runtime evidence.

If static inspection cannot establish a runtime fact, say:

> `Not determinable from static review; use existing Luna evidence.`

Do not execute anything to close that gap.

---

## 5. Review target

Production implementation checkpoint under review:

`d6a967a958a297250d12b3e4c0b423253b35c759`

Later commits that only add Astra review instructions are metadata and should not be treated as Sol production work.

Primary comparison question:

> If Astra Max had personally implemented the C1–C7 job it designed, would the resulting architecture, ownership boundaries, lifecycle strategy, parity preservation, resource model, and performance intent be materially similar to Sol High Web's implementation?

Do not require identical syntax, filenames, or coding style.

---

## 6. Keep the review bounded

Prioritize reading the files that directly answer the capability benchmark.

Do not perform a giant repository archaeology exercise unless a specific architectural question requires it.

Suggested static-review order:

1. Read `ASTRA_SOL_HIGH_CAPABILITY_REVIEW.md`.
2. Inspect the implementation diff/history relevant to C1–C7.
3. Read the current authored core / render boundaries.
4. Read the Pixi lifecycle/resource/scheduling implementation.
5. Read viewport/DPR handling.
6. Read explicit Canvas fallback and parity/debug-clock implementation.
7. Read the focused regression tests/harness source only as necessary to understand coverage.
8. Compare these choices against Astra's original architecture and C1–C7 intent.
9. Produce the requested capability verdict and score.
10. STOP.

Do not spend the session replaying work already performed by Luna.

---

## 7. Residual DPR issue

The remaining same-size DPR-only failure is already known evidence.

Assess it from static code plus the supplied runtime result.

Classify it as one of:

- fundamental architecture problem
- bounded implementation defect inside an otherwise-correct architecture
- likely harness/environment-specific limitation

If its exact runtime cause cannot be established statically, say so.

Do **not** run the viewport harness to investigate.

The purpose is to judge Sol High's implementation capability, not to force this check green during Astra's session.

---

## 8. Required output

Follow the output format in `ASTRA_SOL_HIGH_CAPABILITY_REVIEW.md`:

- executive YES / MOSTLY YES / NO verdict
- capability scores
- C1–C7 assessment
- what Sol did the way Astra would have
- material things Astra would have done differently
- residual DPR assessment
- separate M1 product status
- final benchmark conclusion

Base the verdict on **static source/diff/history inspection + already-supplied evidence only**.

---

## 9. Final hard rule

**READ CODE. DO NOT RUN CODE.**

No testing.
No verification execution.
No build.
No browser.
No runtime harness.
No benchmarking.
No project modifications.
No commits.
No new verification handoffs.

Stop immediately after producing the static review report.