# STILLLIGHT — Active Codex Task

## Status

**ACTIVE — implement the permanent M1 verification harness.**

This is the only implementation task for this session.

## Authoritative documents

Read these completely before changing code:

1. `docs/superpowers/specs/2026-09-26-stilllight-verification-harness-design.md`
2. `docs/superpowers/plans/2026-09-26-stilllight-verification-harness.md`

The spec is authoritative. The implementation plan defines the task sequence.

## Branch and workspace

Repository: `D:\STILLLIGHT`

Required branch: `stage2-m1-runtime`

Before implementation:

1. `git fetch origin`
2. verify the working tree is clean
3. `git switch stage2-m1-runtime`
4. `git pull --ff-only origin stage2-m1-runtime`
5. confirm the plan and spec above are present

Do not work on `main`.

`D:\STILLLIGHT` on `stage2-m1-runtime` is the designated persistent working workspace. Do not create an additional worktree unless an environment-mandated workflow absolutely requires one.

## Execution method

Execute the approved plan **inline in this Luna Light session**, task by task.

- No implementer subagents.
- No reviewer subagents.
- Do not pause between plan tasks for user confirmation.
- Keep progress concise and continue through all five tasks unless a true blocker occurs.
- If an environment-mandated skill activates, satisfy only the minimum necessary requirements and do not broaden scope.
- The plan references `superpowers:executing-plans`; if used, apply it inline and preserve this task's efficiency rules. Do not let generic workflow machinery trigger unrelated research or duplicate expensive verification.

## Execution efficiency policy

Default tools:

- shell / PowerShell
- Node/npm
- existing `playwright-core`
- Vite
- direct deterministic Playwright/CDP scripts
- Git

Do **not** voluntarily use:

- computer-use / CUA
- manual browser clicking
- web search
- subagents
- broad Pixi/framework research
- ad-hoc interactive runtime snippets when the instrumentation belongs in a reusable script
- repeated full-suite verification when fresh results for the unchanged tree already exist

Browser execution performed by the repository-owned Playwright scripts is allowed and required.

Reuse existing `node_modules` if dependencies are already usable. If dependencies are unavailable, install once from the existing lockfile without adding/upgrading packages. Do not change dependency versions.

## Hard scope boundaries

This stage builds **verification infrastructure only**.

Do not fix or mask the four known production failures:

1. production TypeScript/build errors
2. live size/DPR transition can blank the Pixi scene
3. Pixi continues recurring RAF requests while idle
4. deterministic parity state can stay frozen while the WebGL image clears

Do not change production behavior merely to make the harness pass.

Do not intentionally modify:

- gameplay rules
- liquid math
- authored timings
- authored motion
- production rendering behavior
- visual styling
- `reference/original/**`

Do not convert known defects into XFAIL/expected-pass semantics. The harness must report them as genuine failures until a later fix stage.

## Required implementation outcome

Implement the approved plan so the repository owns these entry points:

- `npm run verify:fast`
- `npm run verify:runtime`
- `npm run verify:visual`
- `npm run verify:m1`

And targeted automated coverage for:

- viewport / same-DPR resize / live-DPR transition / hit alignment
- WebGL context loss and restoration
- explicit Canvas fallback
- idle RAF shutdown
- deterministic parity freeze rendering stability
- deterministic two-unit pour
- stream fade boundaries

Runtime lifecycle-sensitive scenarios must be isolated from one another.

Generated diagnostics/screenshots belong under `artifacts/verification/` and must be gitignored.

## Current expected results

The harness itself is successful even though the candidate is not yet fully passing.

Expected current baseline behavior after harness construction:

- existing unit suite: PASS
- reference suite: PASS
- context restoration scenario: PASS
- Canvas fallback scenario: PASS
- deterministic two-unit pour / stream-boundary scenario: PASS
- production build gate: FAIL on the already-known TypeScript errors
- live DPR regression: FAIL if run directly
- idle RAF regression: FAIL if run directly
- parity-freeze framebuffer regression: FAIL if run directly
- `verify:m1`: fail-fast at `verify:fast` while the production build remains broken

Do not repair those failures in this task.

## Verification discipline

Run the exact checks required by each plan task and inspect their output.

For known failing regressions, success means the automation deterministically reproduces and explains the existing failure without manual browser exploration.

Avoid duplicate reruns. If a command result is fresh for the current unchanged tree, reuse it unless the plan specifically requires a new targeted run after files changed.

At the end, perform one concise whole-branch sanity review against the spec and plan. Do not launch a second exploratory audit.

## Git / commits

Follow the plan's task-level commit boundaries.

Do not rewrite history, force-push, rebase, or modify `main`.

The user has explicitly authorized normal commits and a normal push of the completed implementation to `origin/stage2-m1-runtime`.

Before pushing, require:

- working tree contains only intentional plan changes
- production `src/**` behavior was not modified
- `reference/original/**` is unchanged
- generated artifacts are not tracked

Then push normally:

`git push origin stage2-m1-runtime`

Do not modify this `CODEX_TASK.md` to mark completion; ChatGPT will update the handoff after reviewing your result.

## Final report

Return a concise factual report containing:

1. task commits created
2. exact files created/modified
3. `verify:fast` result
4. each targeted runtime scenario result
5. `verify:runtime` result
6. `verify:visual` result
7. `verify:m1` result and where it stopped
8. confirmation that each of the four known failures is still unfixed and faithfully exposed
9. artifact paths produced
10. final branch HEAD and `origin/stage2-m1-runtime` SHA
11. `git status --short --branch`
12. any blocker or deviation from the approved plan

## Stop condition

When the verification harness implementation, targeted checks, commits, and authorized push are complete, **STOP**.

Do not begin fixing the four production defects. That is the next separate stage.
