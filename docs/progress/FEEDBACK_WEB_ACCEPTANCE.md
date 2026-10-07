# Sound, music and vibration — web integration, 2026-10-07

Owner explicitly authorized integrating all three feedback systems, testing on web first, enabling haptics now for later personal device testing, and making Vibration available in game. This supersedes the former silent candidate. It does not authorize commerce, ads, accounts/cloud, new game mechanics, deployment or Android packaging.

## Delivered

Existing event sound synthesis now dispatches for selection, pour contact, rejection, completion and UI actions. One lazy AudioContext shares independent effects and music channels. Music is an original 32-second slow four-chord/bell ambience, rendered into `public/assets/moonlit-ambient.wav` (mono PCM16, 22,050 Hz, 1,411,244 bytes). It is fetched/decoded after activation and loops in the native audio graph; score synthesis, JS scheduling timers and game RAF are not used during playback. `src/platform/music.ts` preserves the original score and `node --experimental-strip-types scripts/render-music.mjs` reproduces the asset. No third-party track or new dependency was added.

Sound effects, Music and Vibration have separate persisted preferences. Existing explicit Sound/Vibration Off values are retained; absent preferences default On, while audio still waits for interaction. Sound Off leaves Music audible; Music Off leaves effects audible. The existing `stilllight.sound.enabled` and `stilllight.haptics.enabled` keys remain; Music uses `stilllight.music.enabled`. These preferences remain outside campaign progression and survive reset-progress.

Claude's approved gameplay plaque, medallions, rail and Sound/Vibration/Motion lancets remain. The former Coming later note is replaced by a compact brass/glass Music switch below the triptych and a supported-device vibration note. General Settings now has working Sound effects, Music and Vibration buttons. Focus trapping/inert/return and OS Reduced Motion remain intact.

Vibration uses the existing short semantic patterns, preserved per-event throttling and transaction-deduplicated concurrent contacts. Off cancels ongoing vibration; the runtime does not force an Off-confirmation vibration. Background state blocks even forced cues and cancels the platform pattern. Missing/refused vibration support never interrupts gameplay. Web tests record the API boundary rather than claim physical-actuator feel.

Audio is gesture-activated, mutes/suspends in background, restores after visibility/BFCache return, and pauses during deterministic manual/parity sampling. The first gesture sound is queued through resume. A first-resume/background race identified in bounded review was reproduced with a failing regression and fixed. The same one-context/one-music-source guards prevent duplicate ambience on repeated input and foreground returns. Nonpersisted page exit closes audio resources.

## Fresh verification

- `npm run verify:fast`: build and 151 unit tests PASS, zero failure/skip. Includes independent sound/music lifecycle, activation/background races, generated score continuity/audibility, haptic cancellation/background suppression and the authorized capability boundary.
- `npm run verify:feedback`: WebGL and forced Canvas PASS. Real native analyser confirms both music and effect signals. Actual gameplay exercises On/Off, independently muted channels, presented contact vibration, saved controls across reload, all-Off without audio allocation, simulated background/foreground, manual silence, general Settings consistency, and zero idle game RAF. Missing vibration API also passes actual play. Actuator output is not claimed.
- Built `verify-production.mjs`: both renderers PASS for delayed assets/early input, three/six-glass scenes, Hint/pour/exact Undo, Motion reload and active feedback controls.
- `verify-ordinary-fixes.mjs`: both renderers PASS, including actual two presented concurrent contact patterns, ownership, exact double Undo, reset, manual sampling, keyboard/portrait bounds and idle RAF.
- `npm run verify:gameplay`: nine portraits in both renderers PASS for existing layout/font/control bounds, actual 3–6-glass content, concurrency/history/reset/Hint/Skip, modal/inflight/focus, Motion/reload/Next and idle RAF. Main agent inspected representative updated Settings captures. The final Music control has a 48px target and targeted 320×568 / 768×1024 modal bounds checks. Historical unrelated suites were not indiscriminately rerun.

One GPT-6 Luna Medium helper edited only four verification scripts' superseded feedback expectations and performed a bounded lifecycle inspection. Main agent assessed the finding, implemented and verified the fix, and owns source/visual/final review. Broad layout/campaign scenarios retain their game-state assertions and run with feedback muted; dedicated `verify:feedback` covers live dispatch. No implementation ownership or visual authority was delegated.

Verification now supports `STILLLIGHT_ARTIFACTS` to isolate output paths. New captures/logs use this chat's work/output directories; pre-existing diagnostic files were backed up before checks and were not overwritten in this integration pass. Tracked acceptance screenshots from the silent baseline remain historical.

Representative new evidence: [gameplay Settings](feedback-web/webgl-390x844-settings.png), [narrow Settings](feedback-web/webgl-320x568-settings.png), and [native audio/browser report](feedback-web/report.json). All 525 artifact files present before this integration remained unchanged. The new music asset was regenerated with the tracked Node script and matched its SHA-256 exactly.

## Remaining

Owner listening/volume/taste acceptance and physical-device vibration feel/support are pending. The release platform/package, physical touch/performance, screen readers, fresh-player learning, release/legal checks and the existing development dependency advisory remain separate gates. The live built preview is `http://127.0.0.1:5180/`; refresh, interact and use Settings to test the three independent feedback preferences.
