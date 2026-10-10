# STILLLIGHT — Two-Glass Gameplay UI Review Demo

An isolated, **gameplay-only** branch for Claude art-direction review. This is not the production campaign and must not be merged back into `main` as a replacement.

## Run

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:5179/.

Only the two-vessel fixtures and optional three-glass animation board, moonlit artwork, original retained Pixi/WebGL + Canvas-fallback rendering, accepted authored liquid motion, brass/glass gameplay HUD, Settings casement, reset/Undo/Hint, deferred Skip notice, level-clear presentation, WebAudio feedback, ambient music and supported browser vibration are available. No Home, Journey, shop, profile, coins, leaderboard, campaign or unrelated product screens.

- **Default**: solvable two-glass demonstration `[[2,2,2],[2]]`; tap the larger glass then the smaller one to pour, complete, see cap/level-clear effects, and replay. Hint suggests the valid solution.
- **Three-glass animation test**: open `/?board=three` for teal and rose liquids. Pour the middle glass into the left glass, then the middle into the right rose glass to test both pours, caps and completion. Keyboard keys `1`, `2`, `3` select the glasses; Undo, Reset, Hint and Replay work as usual.
- **Colorful interaction / Undo screenshot fixture**: open http://127.0.0.1:5179/?board=mixed to load the original colorful two-glass arrangement `[[2,0,3],[3]]`; demonstrate selection, pouring, Hint, Undo, Reset, Settings, but it is **not mathematically solvable**, so its Hint shows a legal move without falsely promising completion.

A nontrivial two-color water sort with only two vessels, capacity four and both colors totaling four each has no legal initial move unless already solved; the two fixtures avoid misrepresenting the game's rules. Production campaign levels use more vessels.

## Controls

- Tap glass to select a source and destination; desktop keys `1` and `2`.
- Undo: medallion or `U`; Reset: press and hold the Reset medallion for 800 ms or press `R` twice within two seconds. An untouched board reports “Already at start.”
- Hint: medallion or `H`; Skip: existing **Coming later** UI only (no destination level).
- Settings: animated brass/glass casement with **Sound**, **Music**, **Vibration** and **Motion** preferences; Resume Game closes it.
- Audio must be unlocked by interaction. Music uses the tracked `public/assets/moonlit-ambient.wav`. Haptics require a browser/device supporting `navigator.vibrate`; desktop browsers usually cannot vibrate.
- Motion respects the OS reduced-motion setting. No permanent game RAF is expected while idle.

## Review boundary

Claude should improve **gameplay HUD + gameplay Settings visuals and motion** using this branch as implementation reference, retaining the existing renderer/pour/liquid contract. The normal full-game `main` branch is untouched. The alternative colorful fixture is visual evidence, not a replacement puzzle.

## Verification

Run `npm run build` and `npm test`. With a preview running on a separate port, run `npm run verify:gameplay`; set `STILLLIGHT_URL` and `CHROMIUM_PATH` when needed. Browser checks exercise both fixtures and WebGL/Canvas at 320×568, 390×844 and 430×932. Captures remain under ignored `artifacts/verification/`. The demo excludes the campaign and non-game screens; desktop checks do not qualify physical Android frame rate, haptic feel or audio taste.
