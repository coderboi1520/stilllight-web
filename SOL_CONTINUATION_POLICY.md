# STILLLIGHT — Sol High Web Continuation / Verification Policy

**STATUS: ACTIVE OVERRIDE**  
**APPLIES TO:** `stage2-m1-runtime`  
**PRIMARY ENGINEER:** Sol High Web  
**RUNTIME VERIFIER:** Luna Codex, only when truly necessary  
**FINAL ARCHITECTURE GATE:** Astra Max

---

## 1. Purpose and precedence

This file exists to prevent an inefficient Sol -> Luna -> Sol handoff after every small fix.

Read `SOL_TASK.md` as the main engineering specification, but for **when to stop, when to request Luna, and how to batch verification**, this file takes precedence over any conflicting wording in `SOL_TASK.md`, especially its Work Package A/B/C verification instructions and STOP/handoff conditions.

Do **not** interpret inability to execute a local command from Web as an automatic stop condition.

The intended workflow is:

```text
Sol diagnoses + implements + self-reviews continuously
        -> Sol completes all source work that can be justified safely
        -> ONE consolidated Luna runtime-verification handoff
        -> Sol interprets all returned evidence and fixes any real failures
        -> at most one final Luna acceptance rerun if fixes were required
        -> Sol pre-audit
        -> Astra Max final architecture review
```

Luna is not a mandatory gate between ordinary Sol work packages.

---

## 2. Immediate instruction for the current checkpoint

The latest Luna evidence established that the prior production TypeScript/Vite build fix successfully reached a production build, while one structural unit test failed because the source no longer contained the exact literal `renderer.events.setTargetElement(null)` form.

Sol has already corrected that structural regression by restoring the literal runtime call and using a targeted TypeScript suppression for Pixi's declaration/runtime mismatch.

**Do not stop and send this small correction back to Luna immediately.**

Queue `npm run verify:fast` for the consolidated Luna verification pass and continue now into:

1. Work Package B — live DPR + WebGL/context lifecycle
2. Work Package C — idle RAF

The source-level correction is sufficient to continue engineering because the remaining uncertainty is only confirmation of a narrow regression test/build gate, not an architectural decision blocker.

---

## 3. New default rule: CONTINUE, DO NOT STOP

After every implementation change, Sol must:

1. inspect the exact diff
2. reason through behavior and architectural impact
3. inspect relevant tests/harness code statically
4. record the pending runtime evidence needed
5. **continue to the next logically independent engineering task**

Do not stop merely because:

- Web cannot run `npm` locally
- Web cannot launch Chromium/Playwright locally
- a build/test rerun would be useful confirmation
- a fix changes a source pattern asserted by an existing test
- a targeted runtime check would provide confidence
- the next work package can still be reasoned about safely from source

These are **deferred verification items**, not automatic handoff points.

Maintain a compact verification queue such as:

| Pending evidence | Why needed | Blocking? |
|---|---|---|
| `npm run verify:fast` | confirm build/unit/reference after build/type correction | No |
| live DPR scenario | confirm WebGL resource lifecycle fix | No until implementation complete |
| context restore scenario | confirm restored-resource ownership | No until implementation complete |
| idle RAF scenario | confirm zero recurring idle callbacks | No until implementation complete |

Do not create a Luna handoff simply because an item enters this queue.

---

## 4. The ONLY normal reason to stop early for Luna

Stop before finishing the remaining source work **only if runtime evidence is genuinely decision-blocking**.

A runtime question is decision-blocking only when ALL of the following are true:

1. source/static reasoning cannot distinguish between two or more materially different implementation paths;
2. choosing the wrong path could cause architectural damage, invalidate authored behavior, or create significant rework;
3. the next engineering step depends directly on knowing which runtime behavior is real;
4. no existing harness result, repository evidence, GitHub/CI result, or authoritative API/source inspection can answer it.

Examples that MAY justify an early Luna stop:

- two plausible Pixi resource-lifecycle fixes require opposite ownership semantics and only a context-loss reproduction can identify which object is actually stale;
- behavior differs by real browser/GPU generation in a way that determines the implementation itself.

Examples that DO NOT justify an early Luna stop:

- confirming that TypeScript still builds after a tiny source-level type workaround;
- rerunning a structural regex test after restoring the exact literal it requires;
- confirming an obviously intended unit-test result before beginning an independent renderer investigation;
- checking a known failure after every intermediate edit;
- obtaining confidence rather than information required for the next decision.

When uncertain, prefer continuing source work and batching the check.

---

## 5. Sol remains the primary verifier

Sol High Web must still verify everything it can itself.

Use:

- actual source inspection
- exact diffs
- existing tests and harness source
- Git history
- architectural invariants
- previous runtime evidence
- GitHub commit/check information if available
- authoritative library/type declarations when needed

Do not equate “cannot execute this command in Web” with “cannot verify anything.”

Static and architectural verification should be completed before asking Luna for runtime confirmation.

---

## 6. Complete Work Package B before Luna

For live DPR + context restoration:

1. inspect the complete relevant ownership/lifecycle path;
2. identify the root cause;
3. implement the smallest robust fix;
4. inspect the exact diff;
5. reason explicitly about:
   - renderer/context generation
   - retained Mesh/Geometry/Buffer lifetime
   - density-change rebuild ownership
   - fresh-load vs live-transition behavior
   - context-loss/restoration behavior
   - Canvas fallback isolation
   - authored model invariants
6. add the required runtime checks to the deferred verification queue;
7. **continue to Work Package C without handing off to Luna**, unless a genuinely decision-blocking ambiguity meets Section 4.

Do not use Luna merely to validate each intermediate DPR/context edit.

---

## 7. Complete Work Package C before Luna

For idle RAF:

1. find the actual recurring callback owner from source and existing evidence;
2. implement the smallest production fix;
3. preserve active rendering, input, resize, context restore, parity isolation, and FrameGate ownership;
4. inspect the exact diff;
5. add the idle-RAF scenario to the deferred verification queue;
6. continue to the consolidated verification handoff.

Do not stop after the edit solely because the browser measurement cannot be executed from Web.

---

## 8. One consolidated Luna verification handoff

After Work Packages A, B, and C are source-complete and self-reviewed, create/update **one** `LUNA_VERIFY_TASK.md` covering the pending runtime evidence.

The consolidated Luna task should normally run, in one local session:

1. record exact tested Git SHA;
2. `npm run verify:fast`;
3. targeted live-DPR verification;
4. targeted context-restoration verification;
5. targeted idle-RAF verification;
6. any directly related visual/runtime regression scenario that Sol changed and genuinely needs runtime evidence;
7. if all prerequisite targeted checks are green, run the final broad `npm run verify:m1` once.

Luna must:

- not modify production source;
- not redesign;
- not broadly debug unless explicitly requested;
- return exact PASS/FAIL, outputs, page errors, measurements, and artifact paths;
- continue through the requested evidence collection so Sol receives one coherent report rather than multiple tiny handoffs.

If an early command fails, Luna should still run later **independent diagnostic scenarios** when technically safe so Sol gets the maximum useful evidence from the same handoff. It should skip only checks whose prerequisites are genuinely invalidated by the failure.

---

## 9. If consolidated Luna verification finds failures

When Luna returns evidence:

1. Sol interprets all failures together;
2. Sol fixes all source-level issues that can be diagnosed from that report in one engineering pass;
3. Sol self-reviews the full corrective diff;
4. Sol requests **one final acceptance rerun**, containing only the failed/affected checks plus final `verify:m1` as appropriate.

Do not return to one-Luna-call-per-fix behavior.

Target from this point forward:

- **zero** intermediate Luna handoffs under normal conditions;
- **one** consolidated verification handoff after A+B+C;
- **at most one** final acceptance rerun if the consolidated pass exposes real defects.

A third Luna round requires a genuine new runtime-only blocker and must be explicitly justified.

---

## 10. Git and task-file behavior

Do not repeatedly rewrite `LUNA_VERIFY_TASK.md` after every small source edit.

Until the consolidated verification point:

- keep working on `stage2-m1-runtime`;
- commit coherent production fixes by area;
- maintain the pending verification queue in your own running ledger/report;
- update `LUNA_VERIFY_TASK.md` only when the consolidated task is ready, unless Section 4 forces an early blocker handoff.

Do not force-push or rewrite history.

---

## 11. Relationship to final Astra review

Astra Max remains the final architecture/correctness certification gate.

The purpose of Luna is only to provide runtime evidence Sol Web cannot directly execute.

The desired final chain is:

```text
Astra architecture
   -> Sol implementation of all remaining fixes
   -> one consolidated Luna runtime evidence pass
   -> Sol corrective pass if necessary
   -> one final acceptance rerun if necessary
   -> Sol final pre-audit + ASTRA_M1_FINAL_REVIEW.md
   -> Astra Max audits its own architecture
```

Do not send Astra routine execution work.

Do not send Luna routine engineering work.

---

## 12. Continue now

Resume the existing authoritative `SOL_TASK.md`, but apply this continuation policy to all verification/handoff decisions.

**Do not request another Luna run for the just-fixed `setTargetElement(null)` structural regression.**

Proceed directly with Work Package B, then Work Package C, performing full source/diff/static review for each.

Only after those source fixes are complete should you prepare the consolidated Luna verification handoff described above, unless a true decision-blocking runtime ambiguity satisfies Section 4.

Do not stop at routine verification boundaries.
