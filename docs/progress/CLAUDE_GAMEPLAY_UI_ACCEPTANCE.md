# Claude gameplay UI integration — 2026-10-05

The owner's complete Claude brief and execution clarifications govern this pass. Implementation started at main/origin `9565f48` on `codex/claude-gameplay-ui`, with Worktree OFF and no helpers. The scope is gameplay presentation, its settings overlay, related verification and documentation. The prior A–Z candidate remains the product foundation.

## Delivered behavior

Gameplay uses the original moonlit plate at full strength, registered at 50%/54%, an empty top center, a live level plaque and Settings medallion, and four brass/lens medallions on the prescribed arc. Cinzel 500/600/700 is self-hosted. Glasses retain original transparent material, palette, pumpkin caps and equipped finishes. Native invisible buttons retain actual color labels and keyboard selection; visible vessel numerals are removed in both renderers.

Shared presentation geometry drives core poses, pouring mouths, receiver contact, both renderer scales and semantic hit positions. The actual campaign retains 3/4/5/6 vessels: balanced occupied rows are 3, 2+2, 3+2 and 3+3, respectively. The exact 4+4 arrangement is a genuine solvable development fixture, `npm run dev` then `/?fixture=claude`. It displays level 12 without adding a campaign ID or saving a fake run. Production ignores that fixture flag.

Hint remains free and unlimited, shows ∞, and marks the actual solver pair with amber/silver attention. Undo reverses actual history in the existing stationary 520 ms recovery and marks only that pair. Reset requires a 600 ms hold or two distinct Enter/Space/R presses within two seconds; early release, drag-out, cancellation, hidden document, blur and modal navigation cancel arming. It invokes the real current-level restart, including during a flight, clears selection/history/hints and transient cues, and preserves campaign awards. Its finite dip is presentation only. Skip uses the same confirmation but shows “Skip — Coming later”; board, save, coins, stars and level remain unchanged.

The casement grows from the Settings medallion, uses a static blurred scrim and three lancet switches, traps focus, makes scene input inert, closes by close button/scrim/Escape/Settings, and returns focus. Accepted pours settle behind it without export/import/reset on opening. Completion while open keeps focus inside until closing. Back to Home is a secondary action here. Storage recovery can be redisplayed and retried from gameplay settings. Tutorial guidance, result/Next/replay and storage notices remain transient overlays.

Sound and Vibration store their existing preferences and show actual ON/OFF words, with a visible Coming later note. Runtime feedback remains disabled at the existing capability boundary; no oscillator, AudioContext or vibration dispatch was enabled. Motion is the inverse of the saved Reduced Motion preference and respects a live OS reduction request without overwriting the stored choice. Motion off removes repeated decorative animation and uses panel/orb crossfades. No idle RAF loop was added; up to twelve ambient motes use CSS and stop when hidden or reduced.

## Deliberate adaptations

- The dummy brief's eight wells, three consumable hints/undos, fabricated level increment and enabled audio/vibration do not replace the real product rules. The adaptations above follow explicit owner directions.
- At narrow stage widths the moon track scales proportionally; below 350 viewport pixels the glyph medallion is 36 px and label/state stations adjust to avoid collisions. Lancet labels stay at least 9 px, lancets and utility hit targets meet their prescribed minimums.
- Component timings take precedence over approximate totals. The staggered lancets finish at 520 ms and their kindling by 600 ms. Reset uses a 260 ms dip per vessel plus its 30 ms stagger. The overlay's extra feedback note and Home action increase panel height while preserving safe bounds.
- Manual presentation disables decorative CSS motion. Resize applies shared layout before redraw; frozen-frame native readback redraws only the cached frame synchronously to avoid WebGL's discarded buffer, after a 100 ms browser resize settle. Exact data/native/composed comparisons remain; no pixel tolerance was introduced. Hint expiry checks use the actual presentation duration.

## Verification and review

`npm run build` and `npm test`: PASS, 145 tests. The new domain checks include real board conservation, connected mouths, concurrent ownership, exact history Undo, finite reset/Undo cues, hint pulse boundaries, eight-fixture legality and injected-clock hold cancellation/confirmation.

`STILLLIGHT_URL=http://127.0.0.1:5182` with `npm run verify:gameplay`: PASS in WebGL and forced Canvas at 320×568, 360×640, 375×667, 390×844, 430×932, 768×1024, plus 400×889, 450×1000 and 400×778. Checks include painted/target/panel bounds, actual 3/4/5/6 boards, Cinzel loading, native semantics, modal inert/focus/return, real parallel pours and exact Undo, hold/drag/repeat/Reset, unlimited Hint, unchanged deferred Skip, midflight settings, preference/save reload, completion/Next, zero feedback dispatch and zero idle RAF.

`npm run verify:runtime`: five PASS (viewport/DPR, context restoration, Canvas fallback, idle RAF and exact frozen frames). `npm run verify:smoke`, `npm run verify:campaign`, `npm run verify:product`, and the built `verify-production.mjs`: PASS. Campaign covers six portrait/backend combinations, genuine tutorial/replay/return/end and legacy concurrent migration. Recovery covers actual cosmetics/claims and corrupt, unsupported, quota and read-denied saves, preserving unrelated storage. Existing checks changed selectors/coordinates or the explicitly superseded numeral expectation; their underlying state, conservation and recovery assertions remain.

Development `node scripts/verification/verify-claude-fixture.mjs`: PASS in both backends at 390/320, with genuine eight-vessel content, OS Motion override, keyboard input and unchanged protected save bytes. Browser tests use isolated contexts.

Root reviewed the changed source and all eighteen game/settings portrait pairs, plus tutorial, eight-vessel, Motion-off and result captures. [Gameplay matrix](claude-gameplay/qa-game.png), [settings matrix](claude-gameplay/qa-settings.png), [game](claude-gameplay/webgl-390x844-game.png), [settings](claude-gameplay/webgl-390x844-settings.png), [narrow settings](claude-gameplay/webgl-320x568-settings.png), [eight-fixture reference](claude-gameplay/webgl-390x844-eight-fixture.png), [Motion off](claude-gameplay/canvas-reduced-settings.png), [result](claude-gameplay/webgl-result.png), [tutorial](claude-gameplay/tutorial-three-glasses.png). Full raw logs/captures remain in untracked `artifacts/`.

Cinzel comes from Google Fonts' Cinzel distribution, with the accompanying [SIL Open Font License](../../public/assets/fonts/OFL.txt). Original gameplay/cap artwork bytes are unchanged. No generated art, dependency replacement, deployment or Android work occurred.

The built preview remains [localhost:5182](http://127.0.0.1:5182/). Owner appearance/gameplay, physical-device and screen-reader acceptance remain pending. Suggested playtest: play the tutorial, use unlimited Hint and actual Undo, compare early/confirmed Reset, confirm deferred Skip, open Settings during a pour, toggle Motion, then return Home and Continue. No quality-score or device-certification claim is made.
