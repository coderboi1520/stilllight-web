# STILLLIGHT

A complete local ordinary water-sort candidate: 30 authored levels in three chapters, a genuine three-glass tutorial, bottle-free Home, Journey, coin cosmetics, local Profile, Daily goals, Settings and a restoration album. Retained PixiJS/WebGL and Canvas render the same core frames. The original three commission IDs, boards, reversible histories and artwork remain compatible.

Play selects a source and a matching top or empty destination. Keys 1â€“6 select glasses; H/U/R activate free Hint/Undo/Restart; Ctrl/Cmd+Z requests Undo. Independent pairs may pour concurrently, with exclusive ownership until recovery. Completion waits for settling, then awards stars and 25 first-clear coins. Replay preserves the current campaign run. Stars and personal bests improve without duplicating first-clear rewards.

Nine cosmetics provide three backgrounds, three cap finishes and three glass finishes, each with a free default. Preview, purchase and equip use the actual local ledger. Profile has editable name/avatar, personal statistics and earned achievement claims. Daily offers three ordinary-play goals and a weekly reward for visiting on any three distinct days. Local-date rollover never deletes past claims; missing days have no penalty. These are local records, without account sync or a trusted server clock.

Sound effects, original ambient music and optional browser vibration are integrated. Gameplay and general Settings have independent saved Sound, Music and Vibration controls. Audio starts after interaction, suspends in background/manual sampling and uses a native looping music buffer without idle game RAF. Physical-device vibration qualification is pending. Gameplay Motion remains available and respects OS Reduced Motion. Gameplay Settings is a focus-trapped casement; Back to Home lives there. Reset requires a 600 ms hold or two keyboard presses; Skip currently confirms a Coming later notice without changing progress. Payments, rewarded video/2Ã—, Premium, Ultimate, Remove Ads, purchase history and global leaderboard are explicitly unavailable previews. No billing, ad SDK or fabricated transactions/entitlements/ranks are present.

Windows: `Start Web Preview.cmd`, or `npm run dev` at [localhost:5179](http://127.0.0.1:5179/). Use installed dependencies; a fresh checkout uses `npm ci`. Build with `npm run build`, then `npm run preview` at [localhost:5180](http://127.0.0.1:5180/). Current built preview is [localhost:5180](http://127.0.0.1:5180/).

Current gameplay UI evidence: [Claude acceptance and screenshots](docs/progress/CLAUDE_GAMEPLAY_UI_ACCEPTANCE.md). Current guidance: [work state](WORK_STATE.md), [director constraints](docs/director-plan/STILLIGHT_FINAL_DEVELOPMENT_PLAN.md), [Aâ€“Z acceptance evidence](docs/progress/A_Z_LOCAL_CANDIDATE_ACCEPTANCE.md), [coverage/resume checklist](docs/progress/A_Z_LOCAL_BUILD_CHECKLIST.md). Earlier phase stops and decorative Home-glass instructions are superseded by the owner's complete local-candidate authorization. Lightwork and other rule families remain cancelled or deferred. Owner local-candidate acceptance passed on 2026-10-07. Feedback listening/device qualification and release gates remain pending. See [feedback integration](docs/progress/FEEDBACK_WEB_ACCEPTANCE.md).

Verification:

```powershell
npm test
npm run build
npm run verify:runtime
$env:STILLLIGHT_URL='http://127.0.0.1:5180'
npm run verify:feedback
npm run verify:gameplay
npm run verify:smoke
npm run verify:campaign
npm run verify:product
node --experimental-strip-types scripts/verification/verify-journey-album.mjs
node scripts/verification/verify-production.mjs
```

Campaign checks cover WebGL/Canvas at 400Ã—889, 450Ã—1000 and 400Ã—778. Product checks cover actual purchases/claims, persistence and corrupt/unsupported/quota/read-denied recovery. `verify:p2` and `verify:p2-visual` are compatibility aliases for current campaign checks. Targeted runtime commands include `verify:viewport`, `verify:context`, `verify:fallback`, `verify:idle-raf` and `verify:freeze`. Browser checks use Playwright with installed Chrome/Edge/Chromium; `CHROMIUM_PATH` selects an executable and `STILLLIGHT_URL` reuses a server. Diagnostics/screenshots go to untracked `artifacts/verification/`.

[CAMPAIGN_SOLUTION_TRACES.json](docs/progress/CAMPAIGN_SOLUTION_TRACES.json) records legal completions. `node --experimental-strip-types scripts/verification/author-campaign.mts` deterministically regenerates content offline; it is not a runtime dependency. Targets are legal completion lengths, without a mathematical optimality claim.

Save format v2 uses existing primary/last-good storage keys and reads v1. Migration retains exact legacy active history, waives the new tutorial, maps progression and gives each recorded legacy clear its once-only first-clear credit. It invents no best-move record or missing clears. Invalid bytes require explicit recovery and are preserved as evidence; unavailable storage leaves play usable in memory with an honest error. Reset requires confirmation and leaves unrelated storage and preferences intact.

The deterministic development API remains `window.__STILLLIGHT_PIXI__` (`choose`, `action`, `step`, `state`, copied `lastFrame`). One manual clock, borrowed frames/copied snapshots, retained resources, capped DPR and zero recurring idle RAF remain. `presentation()` reports the current geometry/numeral visibility/hint duration; `redraw()` repaints the cached frame without advancing. `/?fixture=claude` is a development-only genuine eight-vessel visual reference; `/?fixture=reference` retains the compatibility fixture; no original/oracle demo is bundled.

Original artwork: `public/assets/moonlit-studio.png` and `public/assets/pumpkin-cap.png`, byte-preserved. `public/assets/home-conservatory.webp` is the one new generated Home background; provenance is recorded in acceptance notes. No deployment, Android packaging or real commerce is included.
