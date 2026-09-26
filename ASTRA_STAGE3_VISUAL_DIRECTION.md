# STILLLIGHT — Astra Max Stage 3 Visual Direction Task

## Role

You are **Astra Max**, acting as the visual/animation director and architecture authority for STILLLIGHT Stage 3.

M1 is complete and accepted. The current production baseline is:

`1088f0950825bf68e0c9ffeae91672cc57949035`

Repository:

`coderboi1520/stilllight-web`

Current branch:

`stage2-m1-runtime`

This task is **planning only**.

Do **not** implement anything.
Do **not** run tests, builds, npm, TypeScript, Playwright, browsers, benchmarks, profiling, screenshots, or runtime verification.
Do **not** modify or commit source.

Your job is to inspect the accepted M1 source statically and prepare one concise, high-value visual/animation refinement plan for a fresh **GPT-6 Sol High Codex** implementation session.

---

## Stage 3 Goal

The current game is technically correct, but the moment-to-moment presentation still feels somewhat janky, mechanical, and under-polished.

Stage 3 should make it feel:

- very smooth
- satisfying
- premium casual-game quality
- fluid and responsive
- visually cohesive
- polished rather than mechanical
- elegant rather than noisy
- strong in liquid/glass presentation
- convincing at 60 / 90 / 120 Hz
- mobile-friendly and performant

This is the first stage where intentional visual improvement **beyond the original reference** is allowed.

Do not merely list technical cleanup items. Use your own visual judgment as the **art/animation director** and decide what the game should feel and look like at a premium commercial quality bar.

---

## Foundation That Must Remain Intact

Preserve the accepted M1 architecture and gameplay foundation:

```text
Input
  -> authored gameplay / timeline
  -> original liquid / motion mathematics
  -> reusable renderer-independent frame/state
  -> retained PixiJS 8 WebGL renderer
```

Do not:

- change puzzle rules
- break liquid-volume correctness
- replace the authored liquid geometry system
- replace deterministic authored behavior with generic physics
- add unstable spring simulation just for visual flair
- introduce an always-running render loop
- sacrifice mobile performance
- redesign the architecture
- contaminate the untouched golden reference
- reopen M1 parity work unless a Stage 3 change directly requires it

Stage 3 may improve visual presentation and animation feel while keeping the validated gameplay foundation.

---

## Creative Direction Priorities

Study the current source and decide where the largest perceived-quality gains are available.

Focus especially on:

1. selection / deselection feel
2. hint animation
3. invalid-pour feedback
4. source-glass lift and departure
5. horizontal/arc travel toward the receiver
6. tilt progression
7. liquid-surface motion while moving
8. stream appearance, shape, continuity and disappearance
9. receiver impact response
10. fill feedback
11. source recovery
12. settle / recovery animation
13. glass material and highlights
14. liquid depth / readability
15. subtle secondary motion
16. continuity between animation phases
17. perceived smoothness across 60 / 90 / 120 Hz
18. removing robotic or linear-looking transitions
19. localized premium effects that do not require expensive full-screen post-processing

Pay particular attention to this full motion chain:

```text
selection
-> lift
-> travel
-> tilt
-> stream appearance
-> receiver impact
-> fill progression
-> stream disappearance
-> source recovery
-> final settling
```

It should feel like **one coherent animation**, not a sequence of independent scripted chunks.

Identify where phases should overlap, blend, anticipate, or follow through instead of waiting for one phase to visibly finish before the next begins.

---

## Mobile-First Visual Discipline

Prefer improvements with high perceived impact and controlled cost.

Good directions may include, where appropriate:

- better easing curves
- anticipatory/follow-through motion
- subtle overshoot where deterministic and controlled
- better interpolation between authored phases
- localized glass highlights
- richer retained material treatment
- subtle liquid shading/depth
- cleaner stream taper / opacity / continuity
- receiver impact deformation / localized highlight response
- better surface damping/settling presentation
- subtle secondary motion tied to authored state

Avoid by default:

- full-screen blur chains
- expensive post-processing stacks
- large continuous particle systems
- per-frame object churn
- high-cost effects that do not materially improve feel
- visual clutter
- effects that make liquid state harder to read

Retained resources and demand-driven rendering should remain the default performance model.

---

## Prioritization

Do **not** produce a huge wish list.

Select approximately **6–10 high-impact changes** for the first Stage 3 pass.

Classify each item as:

- **P0 — visible jank / awkwardness that should be fixed first**
- **P1 — major satisfaction / polish improvement**
- **P2 — optional premium finishing touch**

For every recommendation provide:

- current problem / what feels wrong
- exact desired behavior / visual target
- likely code/system area involved
- category:
  - timing/easing
  - geometry/motion
  - shader/material/rendering
  - secondary animation
  - feedback/effects
- performance risk: LOW / MEDIUM / HIGH
- implementation risk: LOW / MEDIUM / HIGH
- expected visual impact: LOW / MEDIUM / HIGH
- concise acceptance criteria

Be decisive.

The objective is the **smallest set of changes with the largest improvement in perceived quality**.

---

## Sol High Codex Handoff Requirements

Your final output must be directly usable by a fresh **GPT-6 Sol High Codex** session.

The handoff should:

- preserve accepted M1 architecture
- avoid another architecture discussion
- tell Sol exactly what to change first
- batch related animation/visual work efficiently
- avoid unnecessary refactors
- avoid unrelated gameplay/UI work
- avoid dependency upgrades
- allow Sol to inspect the running result itself
- use targeted visual/runtime checks during implementation
- avoid Sol ↔ Luna handoff loops
- aim to complete the first major visual-polish pass in one Codex session
- remain credit-efficient and time-efficient

Sol High Codex should own:

```text
inspect relevant code
-> implement Stage 3 pass
-> visually inspect result
-> refine obvious jank
-> run focused regressions/performance sanity checks
-> self-review combined diff
-> commit
-> push
```

Do not require Astra or Luna after every tweak.

---

## Efficiency Rules For The Future Sol Task

The implementation handoff you prepare should tell Sol to:

1. read the task once;
2. inspect only relevant source/render/animation files;
3. not rediscover settled architecture;
4. not create extra planning or handoff documents;
5. batch related edits where safe;
6. visually inspect the actual game after meaningful batches, not after every tiny edit;
7. use targeted checks while iterating;
8. avoid repeatedly running broad verification suites;
9. avoid cosmetic refactors unrelated to the visual pass;
10. keep the first Stage 3 pass bounded;
11. stop once the selected 6–10 improvements are implemented, reviewed and pushed.

The goal is a **fast, high-value visual pass**, not another verification bureaucracy cycle.

---

## Required Final Output

Return exactly three sections:

### 1. Prioritized Stage 3 visual refinement list

Approximately 6–10 recommendations, aggressively prioritized as P0/P1/P2.

### 2. Recommended implementation order

Give the most efficient sequencing, including which items should be implemented together because they share timing, geometry or rendering systems.

### 3. Self-contained GPT-6 Sol High Codex handoff

Write a concise implementation handoff that can be saved as a single task file and executed in a completely fresh Sol High Codex session.

It must include:

- mission
- exact selected visual changes
- relevant systems/files
- architectural invariants
- acceptance criteria
- efficient implementation order
- focused visual/runtime validation strategy
- Git workflow
- stop conditions

Do not over-explain obvious programming concepts.

Do not implement anything yourself.

Stop after producing the Stage 3 plan and Sol High handoff.