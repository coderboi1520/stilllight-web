# STILLLIGHT — Consolidated Luna A+B+C Verification Task

**STATUS: ACTIVE**  
**ROLE: LOCAL RUNTIME VERIFIER ONLY**

Repository: `coderboi1520/stilllight-web`  
Branch: `stage2-m1-runtime`

Production fix commits to verify:

- `344d8efd99f3c03eded366ad75aec1be3b257209` — initial build/type correctness
- `92c674e621426b7607c1c6bec5eff55503210ff2` — restore literal Pixi event-detach invariant
- `e22b11259d0bd2dcae7f70bda323839ed9976457` — live DPR/context retained-resource lifecycle handoff
- `e12d3df956e33baf2ab55e84048f89b91827eb14` — remove recurring Pixi renderer scheduler RAF
- `7d15a4ba119ba9fde98901c1b5cb04e58195aae4` — explicitly release retired view textures while preserving density-shared stream assets

`SOL_CONTINUATION_POLICY.md` requires this to be one consolidated evidence pass after Work Packages A, B and C. Luna is an evidence instrument only.

## Scope

Do **not** edit production source, tests, harness code, dependencies, configuration, or documentation. Do **not** redesign or broadly debug. Return raw evidence for Sol to interpret.

The source-level diagnoses being verified are:

1. Build/type correctness: the authored reusable `Float64Array` storage contract compiles, and the intentional Pixi `setTargetElement(null)` runtime call remains literal with a narrow TypeScript suppression.
2. Live DPR/context lifecycle: density/context rebuilds previously destroyed old retained Pixi view roots before Pixi's retained render instructions had crossed to the replacement scene generation. Old views are now retired through the first replacement render and destroyed afterward. Each glass view destroys its private generated texture sources; stream halo/cap textures use density-keyed leases so old sources are released only after their last view is retired. Shared `Texture.WHITE` and the reusable circle texture remain shared.
3. Idle RAF: Pixi 8.18's renderer `SchedulerSystem` registers on `Ticker.system` for periodic renderer GC even when the application ticker and EventTicker are stopped. This fixed retained scene now disables renderer GC scheduling and destroys that scheduler listener, leaving `FrameGate` as the production animation gate.

## Sol source review and deferred evidence

Sol reviewed the complete B/C ownership path and the exact source diffs. The focused structural regression test failed against the prior view-root teardown, then passed after explicit texture ownership was added: `node --test tests/renderer-structure.test.mjs` — 7/7 PASS. `git diff --check` reported no whitespace errors; PowerShell/Git emitted only the expected LF-to-CRLF normalization warnings.

The following evidence remains queued for this single Luna pass:

| Pending evidence | Why needed | Blocking before handoff? |
|---|---|---|
| `npm run verify:fast` | Build, unit, and reference gates for all A/B/C source changes, including the structural ownership guard | No |
| `npm run verify:viewport` | Observe live DPR and same-page resize behavior after view-generation retirement | No |
| `npm run verify:context` | Observe WebGL context restoration and frame/state recovery | No |
| `npm run verify:idle-raf` | Measure settled idle and active animation RAF requests after scheduler removal | No |
| `npm run verify:m1` | Final broad acceptance after all targeted prerequisites pass | Run once only if the first four checks pass |

## Required steps

1. Fast-forward the local checkout to current `origin/stage2-m1-runtime` only.
2. Record the exact tested commit SHA.
3. Run the following commands in this order, capturing exact stdout/stderr and exit codes:

```bash
npm run verify:fast
npm run verify:viewport
npm run verify:context
npm run verify:idle-raf
```

4. Do not stop merely because an earlier command fails. Continue through later independent targeted scenarios when the application/dev server can still run safely. Skip only a scenario whose prerequisite is genuinely invalidated, and state exactly why it was skipped.
5. If `verify:fast`, `verify:viewport`, `verify:context`, and `verify:idle-raf` all PASS, run the final broad acceptance exactly once:

```bash
npm run verify:m1
```

6. Stop after collecting this evidence. Make no source edits and no commits.

## Evidence to return

Return one consolidated report containing:

- exact tested Git SHA
- command and exit code for every requested command
- exact PASS / FAIL / SKIPPED status per command/scenario
- full relevant build/test failure text if any
- all browser `pageerror` / error-console messages from the targeted runtime scenarios
- live-DPR before/after CSS/backing/DPR metrics and artifact paths
- context-loss/restoration observations, context usability result, state/frame preservation result, page errors, and artifact paths
- idle-RAF measurements for settled load, active animation, and settled post-animation, including captured stack attribution if nonzero
- final `verify:m1` output and exit code if its prerequisites were green
- environment/setup error verbatim if any requested scenario cannot execute

Do not summarize a failure as merely "failed" when the harness produced a concrete error or metric; include the concrete evidence.

## Stop condition

Stop only after the requested evidence collection is complete. Do not diagnose beyond the returned evidence and do not modify the repository.
