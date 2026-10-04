# STILLLIGHT

One current six-vessel ordinary sorting game, with retained PixiJS/WebGL and a compatible Canvas fallback consuming the same core frames. PF01–PF04 remove unwanted glass/number focus decoration and liquid symbols/legend, deliver independent concurrent pours and accepted transparent glass in both backends. Numbers render behind all glass/liquid/stream artwork; invisible hit controls stay above the canvas. Native keyboard controls, authored selection feedback and utility focus outlines remain.

Windows: `Start Web Preview.cmd`, or `npm run dev` at [localhost:5179](http://127.0.0.1:5179/). Use existing installed dependencies; for a fresh checkout run `npm ci` once. Build with `npm run build`, then `npm run preview` at [localhost:5180](http://127.0.0.1:5180/).

Current guidance: [work state](WORK_STATE.md), [director constraints](docs/director-plan/STILLIGHT_FINAL_DEVELOPMENT_PLAN.md), factual records in `docs/progress/`. Lightwork is cancelled and other new mechanics/modes are held. Future separately authorized sequence: P1.3 recovery/exact save/Continue, then P2 Home/restoration. This cleanup stops for owner playtesting.

Controls: select a vessel then a matching top or empty destination. Keys 1–6 select; H/U/R activate Hint/Undo/Restart; Ctrl/Cmd+Z requests Undo. Source/receiver pairs stay exclusively owned through recovery; free pairs can pour concurrently. Undo waits for settling and reverses acceptance history. Reduced Motion and Haptics are independent preferences.

Verification:

```powershell
npm test
npm run build
npm run verify:runtime
# Against the built preview:
$env:STILLLIGHT_URL='http://127.0.0.1:5180'
npm run verify:smoke
```

Targeted checks: `verify:viewport`, `verify:context`, `verify:fallback`, `verify:idle-raf`, `verify:freeze`, `verify:pour`, `verify:glass`, `verify:routes`. `verify:fast` runs build/tests; `verify:all` adds runtime and visual states. Browser checks use Playwright with installed Chrome/Edge/Chromium; `CHROMIUM_PATH` selects an executable and `STILLLIGHT_URL` reuses a server. Diagnostics go to ignored `artifacts/verification/`.

Current deterministic API: `window.__STILLLIGHT_PIXI__` (`choose`, `action`, `step`, `state`, copied `lastFrame`). One manual clock, reusable borrowed frames and silent sampling remain. `/?fixture=reference` is a development-only current two-vessel fixture; its compatibility name loads no old implementation. There is no bundled original/oracle demo or standalone benchmark.

Runtime assets: `public/assets/moonlit-studio.png` and `public/assets/pumpkin-cap.png`. Shared accepted glass artwork serves both adapters; the core owns motion, quantities/history and geometry. Retained resources, capped DPR and zero recurring idle RAF remain.

Automated checks do not establish owner gameplay/appearance or physical-device acceptance. No runtime or credit speedup is claimed from cleanup alone.
