# STILLLIGHT — Narrow Luna Final Verification Task

**STATUS: ACTIVE**  
**ROLE: LOCAL RUNTIME VERIFIER ONLY**

Repository: `coderboi1520/stilllight-web`  
Branch: `stage2-m1-runtime`

## Sol-owned checkpoint

Consolidated verification at `1101bd22847e2932528ae1249e5007035f778c1c` proved:

- `npm run verify:fast` — PASS
- `npm run verify:context` — PASS
- `npm run verify:viewport` — FAIL only because a same-size live DPR change was not observed by `ViewportController`
- `npm run verify:idle-raf` — FAIL only because the initial sample included one Pixi startup RAF request that was scheduled during `Application.init` and then canceled by the existing scheduler teardown; post-animation settled idle was already 0

Sol diagnosed both remaining failures, self-reviewed them together, and adopted the combined fix in:

- `6c0a67df8a9037074084e018162d74150cde0eda`

Current implementation details being verified:

1. **Live DPR** — `ViewportController` now maintains a re-armed resolution media-query watcher for DPR-only transitions. It still uses the existing `sync()` path, so density changes flow through the same renderer resize/rebuild logic without polling or a permanent RAF.
2. **Idle RAF acceptance** — production scheduler teardown remains unchanged. Pixi's system ticker requests one RAF while `SchedulerSystem.init()` runs, and ticker listener removal cancels that pending request when no listeners remain. The idle harness now waits for `window.__STILLLIGHT_PIXI__`, resets the pre-load RAF probe, and then measures settled idle. This excludes canceled initialization requests while still detecting any recurring ticker/RAF that survives startup.
3. **Context restoration** — no production change was made to the now-passing retained-context path.

Do **not** edit production source, tests, harness code, dependencies, configuration, or documentation. Return evidence only.

## Required steps

1. Fast-forward the local checkout to current `origin/stage2-m1-runtime` only.
2. Record the exact tested commit SHA.
3. Run this directly necessary regression check first:

```bash
npx tsc -p tsconfig.json --noEmit
node --test tests/renderer-structure.test.mjs
```

4. Run the two targeted runtime checks:

```bash
npm run verify:viewport
npm run verify:idle-raf
```

5. If the TypeScript/structural regression check, `verify:viewport`, and `verify:idle-raf` all PASS, run the final broad acceptance exactly once:

```bash
npm run verify:m1
```

6. Stop after collecting the requested evidence. Make no source edits and no commits.

## Evidence to return

Return one report containing:

- exact tested Git SHA
- command and exit code for every requested command
- structural test count/result
- `verify:viewport` PASS/FAIL with live-DPR before/after board, CSS, backing-store, and DPR metrics plus page errors/artifacts
- `verify:idle-raf` PASS/FAIL with settled-after-load, active-animation, and settled-after-animation RAF counts plus any captured stacks/page errors
- final `verify:m1` exact output and exit code if prerequisites are green
- environment/setup errors verbatim if any command cannot execute

Do not modify anything and do not diagnose beyond the returned evidence.
