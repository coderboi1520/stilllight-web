# A–Z local candidate acceptance evidence — 2026-10-05

Status: complete local implementation candidate; owner end-to-end visual/gameplay acceptance pending. The owner's continuous-run authorization supersedes older P2 stops and Home prop instructions. Starting local/origin main: `62669f6`; Worktree OFF; implementation branch `codex/complete-local-campaign`. Implementation commit: `ecf367eab7a701082ecf95feacca37fa1a07bf4d`. Git history/final handoff supply final documentation/delivery identity. No deployment, Android packaging, payment/ad SDK, account service or cloud sync was performed.

## Implemented and exercised

| Area | Delivered behavior |
| --- | --- |
| Ordinary content | 30 stable IDs, three chapters of ten. New tutorial has exactly `[[0,0,1,1],[1,1,0,0],[]]`, bottom to top; actual user pours 0→2, 1→0, 1→2. Original three IDs/boards unchanged; dense legacy level closes chapter one at level 10. |
| Teaching/tools | Selection-specific, settle-aware current-board guidance; no autoplay. Undo, Restart, reload, alternate legal moves, keyboard and Skip work. Help replay preserves the underway campaign. Free Undo/Hint/Restart retain core behavior. |
| Completion | Actual solved/settled state precedes caps/results. Three stars at authored trace target, two at target+3, otherwise one. Best moves/stars improve; first clear adds 25 once. Chapter payoff, real Next and 30-level end/album work. |
| Navigation | Bottle-free Home with live title/actual coins/Continue; four functional dock roots; Journey real current/locked/completed states; utility back returns to origin. Choosing an unawarded current Journey level creates a campaign run with Next; earlier replay preserves Continue. |
| Cosmetics | Nine catalog entries: each background/cap/glass category has a free default and two coin unlocks. Prices 60–100; real preview, affordability, buy, equip, reload. Native preview dialog blocks underlying actions. Background changes Home atmosphere; cap and glass finishes use actual cached artwork. |
| Profile | Editable 1–24 character local name, four avatars, real stats/bests, four progress-based once-only achievement claims. No invented ranks or account identity. |
| Daily/attendance | Complete one distinct level, settle three full glasses through distinct completed boards, explore two distinct levels. Each earned daily claim adds 10 once. Visit any three distinct dates in a Monday-based week for 15 once; misses have no penalty. |
| Settings/utilities | Reduced Motion persists and retains outcomes; feedback rows unavailable. Help/tutorial replay, About, local privacy/terms, feedback information, confirmed reset and return paths are reachable. Reset preserves unrelated keys/preferences/evidence. |
| Silent boundary | No AudioContext unlock/play or haptic dispatch, even with stored enabled preferences. Original feedback modules/preferences and semantic presented-event observations remain. |
| Honest previews | Payments, rewarded video/2×, Premium, Ultimate, Remove Ads, purchase history and global leaderboard explicitly unavailable. Clicking previews cannot grant currency, purchases, entitlements or ranks. |

The ledger derives coins from recorded first clears/earned claims minus owned prices; no separate editable coin balance exists. All thirty first clears alone yield 750 coins before spending. Validation rejects unaffordable ownership, unearned claims, invalid dates, duplicate ownership/claims and unowned equipment. Local storage is user-controlled; these validations are consistency checks, not tamper-proof accounts.

Daily dates use the device's local calendar, not UTC. Monday-week calculation uses local noon. Old records are retained: returning to an already recorded date cannot duplicate its claimed rewards; going forward creates a new date, and misses never erase progress. Manual clock changes are not server-authenticated and may make other calendar dates available. No anti-cheat or network-time promise is made.

## Save/core preservation

Save v2 uses existing `stilllight.session.v1` and `stilllight.session.last-good.v1` keys. v1 imports retain exact legacy active board and reversible acceptance history. Tutorial is waived; legacy progression maps through level 10 into later chapters, including continued levels 11/12. Each recorded original clear receives one star/25 first-clear coins during migration, without fabricated best moves or missing intermediate clears. Current saves validate campaign awards and product state together.

Corrupt primary/last-good, unsupported versions and temporarily unreadable storage preserve original bytes until explicit recovery/new-save acknowledgement; evidence is retained before replacement. Quota failure retains in-memory progress with Retry. This preserves the existing two-slot recovery contract and does not claim filesystem-style transactional storage.

Capacity-four/maximal matching rules; 1040 ms pours; transfer/stream windows; connected mouths; exclusive owners/concurrent independent pairs; stationary 520 ms exact Undo; tiny same-color continuity; unchanged gameplay palette/material/geometry; one clock; borrowed frames/copied snapshots; capped DPR; retained resources and zero idle RAF remain. Original engine/audio/haptic files were not replaced. Cosmetic tints affect cap/reflection/rim artwork, leaving liquid color identity intact.

A bounded Pixi glass-view pool fixes a discovered six-to-five chapter transition hazard: retiring mesh views could leave stale Pixi render callbacks. Active model/frame/buttons still contain only the board's real glass count. DPR/context retirement checks remain green. Root review also found and fixed Journey's current-level replay classification; domain and actual-browser regressions cover campaign start/Next.

## Actual verification

All listed checks passed on the final implementation tree; local logs remain in `D:\STILLLIGHT\artifacts\`.

| Command/check | Actual result/evidence |
| --- | --- |
| `npm test` | 139 tests, 139 pass, 0 fail/skip. `az-final-unit.txt`. Includes all 30 legal conserved boards/traces, legacy migration/history, campaign end/reward deduplication, Journey start, ledger/claims and silent tutorial contracts. |
| `npm run build` | TypeScript and Vite production build pass; original dependency/package-lock untouched. |
| `npm run verify:campaign` | Six combinations: WebGL/Canvas × 400×889, 450×1000, 400×778. Actual tutorial input, Undo/reload, real Next/end, preserved underway run, replay, route/placeholder checks, 48px targets, no horizontal overflow, silent probes/idle RAF and no browser errors. `az-final-campaign.txt`; `verification/az-campaign/report.json`. |
| `npm run verify:product` | Both backends: actual buy/equip/preview/profile/claims/reload, pearl cap chapter payoff and Next, corrupt/unsupported/quota/read-denied recovery, confirmed/cancelled reset/unrelated-key preservation. `az-final-product.txt`. |
| `verify-journey-album.mjs` | Both backends: real Journey tutorial campaign/Next; dense board controls fit all three portraits; 30-light/original-pane album and return; personal stats and unavailable leaderboard. `az-final-album.txt`. |
| `npm run verify:smoke` | Existing parallel pours/ownership/exact two Undos/Restart, transparent backend material, label occlusion and retired-route protection pass. `az-final-smoke.txt`. |
| `npm run verify:runtime` | All five: viewport/DPR including live resize, context restore/exact state, forced Canvas (14,932 painted probe pixels), idle RAF (25 while active, 0 idle), manual frame-freeze/resize invalidation. `az-final-runtime.txt`. |
| `verify-production.mjs` | Both built backends: delayed assets/ignored early Play, actual three/six glass scenes, Hint/pour/exact Undo, reduced-motion reload and unavailable feedback controls. `az-final-production.txt`. |
| Content authoring | Deterministic seeded offline author, canonicalized generated patterns, generated search budget 18,000; fixed tutorial/legacy search 60,000. All 30 traces replay under actual rules; no optimality claim. `CAMPAIGN_SOLUTION_TRACES.json`. |

Completion tests prepare earlier levels by replaying real rules offline, then exercise actual final-level input/cap/settle/results/Next in the browser. They do not claim thirty human browser playthroughs. Daily/weekly dates and v1 variants also have domain tests.

The inherited label pixel detector was adjusted to include antialiased ivory edges (R>175/G>160/B>135), because a narrow 12px numeral at fractional raster alignment otherwise contributed only two fully opaque pixels. Existing minimum ink, natural overlap occlusion, uncovered-label and absent-rejected-outline assertions remain; labels were not enlarged/moved/hidden. Existing haptic smoke now checks two semantic contact events and zero backend vibration, matching the authorized silent boundary.

Sole root implementer performed source and representative visual review. One authorized Luna Low read-only helper checked routes/placeholders/silent flags and reported no concrete mechanical failures (`az-placeholder-review.md`); it did not provide human visual/feel acceptance. No broader reviewer, Astra chat or extra worktree was created.

## Artwork provenance

One built-in ImageGen generation, no image repair, supplied a finished portrait moonlit botanical conservatory: midnight navy/petrol, ivory lilies at the edges, aged brass architecture, crescent/stars/clouds, calm central/lower action space and dark upper title space. Prompt expressly excluded UI/text/logos/watermarks/buttons/people/bottles/glasses/vessels. Root inspected the result; live text/controls remain HTML.

Original generated output remains at `C:\Users\itsjo\.codex\generated_images\01a108af-acd3-7373-b74a-8144b283112e\exec-386014b3-2dfe-4aa3-bcb5-1711364e2111.png`. Bundled Pillow converted it to `public/assets/home-conservatory.webp` at quality 88/method 6, 334,404 bytes. No original gameplay asset was recompressed. Original Git blobs still match baseline: moonlit-studio `229237a1b96394738074ed834b61e0feff63c445`; pumpkin-cap `e8df975da621a71f1e3bfe0a4aa30076b2d9c461`.

Cap variants use cached grayscale authored cap artwork plus the chosen finish; default uses the original artwork. Glass variants tint only reflection/edge/rim presentation. Previews share these materials. There is no new icon/logo system or second game renderer/clock.

## Representative visual evidence

Six original screenshots are retained in `docs/progress/az-local-candidate/` with this record: [Home](az-local-candidate/home.png), [tutorial](az-local-candidate/tutorial.png), [short Settings](az-local-candidate/settings.png), [chapter result](az-local-candidate/chapter-result.png), [ending](az-local-candidate/end.png) and [album](az-local-candidate/album.png). They are evidence, not runtime dependencies. Root inspected Home, tutorial/dense gameplay, Journey, Shop/preview, Profile, Daily, Settings, settled result, end and album across the requested portraits/backends. Additional local screenshots remain under untracked `artifacts/`:

- [Home](../../artifacts/verification/az-campaign/webgl-400x889-home.png), [tutorial](../../artifacts/verification/az-campaign/webgl-400x889-game.png), [short dense board](../../artifacts/verification/az-campaign/webgl-400x778-dense-game.png).
- [Journey](../../artifacts/verification/az-campaign/webgl-400x889-journey.png), [Shop](../../artifacts/verification/az-campaign/webgl-400x889-shop.png), [Profile](../../artifacts/verification/az-campaign/webgl-400x889-profile.png), [Daily](../../artifacts/verification/az-campaign/webgl-400x889-daily.png).
- [Short Settings](../../artifacts/verification/az-campaign/webgl-400x778-settings.png), [actual pearl preview](../../artifacts/verification/az-product-recovery/webgl-owned-cap-preview.png), [chapter result](../../artifacts/verification/az-product-recovery/webgl-chapter-payoff-finishes.png).
- [30-level ending](../../artifacts/verification/az-campaign/end.png), [short restoration album](../../artifacts/verification/az-campaign/webgl-400x778-album.png). Canvas counterparts remain in the same evidence folders.

## Owner playtest / known limits

Open the built local preview at http://127.0.0.1:5182/. Finish the three-glass tutorial with actual selection/pours, try free Undo/Hint/Restart, then use Next. Leave an underway level through Home/Journey/Settings and check Continue and reload. Earn coins, preview/buy/equip cosmetics, edit local Profile and claim actual achievements/Daily progress. Replay a prior level and confirm the active run survives. Check chapter/end/album using normal progression; paid/ad/leaderboard entries should stay unavailable. Settings Reduced Motion is functional; this candidate makes no sound or vibration.

Owner gameplay/appearance/learning acceptance, physical Redmi/native qualification, screen-reader testing, fresh-player trials, commercial/legal release review and measured performance/credit comparisons are NOT RUN. Full local content is delivered; accounts/network sync, real commerce/ads/global rankings, Android and deployment are deferred. No guaranteed quality score or runtime/credit saving is claimed. After owner playtest, apply concrete feedback within the authorized project scope.
