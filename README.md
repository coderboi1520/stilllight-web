# STILLLIGHT

An ordinary-only three-commission Moonlit Atelier slice: Home → Play/Continue → sorting → caps and localized restoration → Next → restored room. Validated local saves preserve the accepted board and exact reversible history; completed replay preserves active Continue. Retained PixiJS/WebGL and Canvas consume the same core frames. Accepted transparent glass, parallel pours, numbers behind artwork and native semantic controls remain.

Windows: `Start Web Preview.cmd`, or `npm run dev` at [localhost:5179](http://127.0.0.1:5179/). Use existing installed dependencies; for a fresh checkout run `npm ci` once. Build with `npm run build`, then `npm run preview` at [localhost:5180](http://127.0.0.1:5180/).

Current guidance: [work state](WORK_STATE.md), [director constraints](docs/director-plan/STILLIGHT_FINAL_DEVELOPMENT_PLAN.md), [P1.3/P2 candidate evidence](docs/progress/P1_3_P2_ORDINARY_LOOP_ACCEPTANCE.md). Lightwork is cancelled and other new mechanics/modes are held. This candidate stops for owner loop/feel playtesting; P3 and campaign authoring require separate authorization.

Controls: select a vessel then a matching top or empty destination. Keys 1–6 select; H/U/R activate Hint/Undo/Restart; Ctrl/Cmd+Z requests Undo. Source/receiver pairs stay exclusively owned through recovery; free pairs can pour concurrently. Undo waits for settling and reverses acceptance history (existing 64-move window). Sound, Reduced Motion and Haptics persist independently in Settings, which returns to its originating screen. Unreadable saves preserve original bytes and require explicit recovery; unavailable storage keeps in-memory play usable with an honest error.

Verification:

```powershell
npm test
npm run build
npm run verify:runtime
# Against the built preview:
$env:STILLLIGHT_URL='http://127.0.0.1:5180'
npm run verify:smoke
npm run verify:p2
```

Targeted checks: `verify:viewport`, `verify:context`, `verify:fallback`, `verify:idle-raf`, `verify:freeze`, `verify:pour`, `verify:glass`, `verify:routes`. `verify:fast` runs build/tests; `verify:all` adds runtime and visual states. Browser checks use Playwright with installed Chrome/Edge/Chromium; `CHROMIUM_PATH` selects an executable and `STILLLIGHT_URL` reuses a server. Diagnostics go to ignored `artifacts/verification/`.

Current deterministic API: `window.__STILLLIGHT_PIXI__` (`choose`, `action`, `step`, `state`, copied `lastFrame`). One manual clock, reusable borrowed frames and silent sampling remain. `/?fixture=reference` is a development-only current two-vessel fixture; its compatibility name loads no old implementation. There is no bundled original/oracle demo or standalone benchmark.

Runtime assets: `public/assets/moonlit-studio.png` and `public/assets/pumpkin-cap.png`. Shared accepted glass artwork serves both adapters; the core owns motion, quantities/history and geometry. Retained resources, capped DPR and zero recurring idle RAF remain.

Automated checks do not establish owner gameplay/appearance or physical-device acceptance. No runtime or credit speedup is claimed from cleanup alone.
