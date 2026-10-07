# STILLLIGHT — Two-Glass Gameplay UI Review Demo

An isolated, **gameplay-only** branch for Claude art-direction review. This is not the production campaign and must not be merged back into `main` as a replacement.

## Run

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:5179/.

Only the two-vessel board, moonlit artwork, original retained Pixi/WebGL + Canvas-fallback rendering, accepted authored liquid motion, brass/glass gameplay HUD, Settings casement, reset/Undo/Hint, deferred Skip notice, level-clear presentation, WebAudio feedback, ambient music and supported browser vibration are available. No Home, Journey, shop, profile, coins, leaderboard, campaign or unrelated product screens.

- **Default**: solvable two-glass demonstration `[[2,2,2],[2]]`; tap the larger glass then the smaller one to pour, complete, see cap/level-clear effects, and replay. Hint suggests the valid solution.
- **Colorful interaction / Undo screenshot fixture**: open http://127.0.0.1:5179/?board=mixed to load the original colorful two-glass arrangement `[[2,0,3],[3]]`; demonstrate selection, pouring, Hint, Undo, Reset, Settings, but it is **not mathematically solvable**, so its Hint shows a legal move without falsely promising completion.

A nontrivial two-color water sort with only two vessels, capacity four and both colors totaling four each has no legal initial move unless already solved; the two fixtures avoid misrepresenting the game's rules. Production campaign levels use more vessels.

## Controls

- Tap glass to select a source and destination; desktop keys `1` and `2`.
- Undo: medallion or `U`; Reset: press and hold the Reset medallion for 600 ms or press `R` twice within two seconds.
- Hint: medallion or `H`; Skip: existing **Coming later** UI only (no destination level).
- Settings: animated brass/glass casement with **Sound**, **Music**, **Vibration** and **Motion** preferences; Resume Game closes it.
- Audio must be unlocked by interaction. Music uses the tracked `public/assets/moonlit-ambient.wav`. Haptics require a browser/device supporting `navigator.vibrate`; desktop browsers usually cannot vibrate.
- Motion respects the OS reduced-motion setting. No permanent game RAF is expected while idle.

## Review boundary

Claude should improve **gameplay HUD + gameplay Settings visuals and motion** using this branch as implementation reference, retaining the existing renderer/pour/liquid contract. The normal full-game `main` branch is untouched. The alternative colorful fixture is visual evidence, not a replacement puzzle.

## Verification

Run `npm run build`. A fresh build/browser acceptance check should be performed locally before judging this branch as production-ready. This review branch intentionally excludes the campaign, verification suite, non-game screens and benchmark artifacts.
