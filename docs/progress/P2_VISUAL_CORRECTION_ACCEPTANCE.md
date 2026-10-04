# P2 corrective visual candidate — 2026-10-04

**Owner-rejected initial UI; corrective candidate awaiting owner acceptance.** No formal Golden/device/human acceptance or P3 authorization. One local inline implementer, Worktree OFF, no agents/reviewer chats. Scope came from the owner's screenshots and clarification: “homescreen should look like a game ui, watersort puzzle type.”

Source: clean local/live main `08a376110137568193fb4c865c37e149dfc85edb`, origin `https://github.com/coderboi1520/stilllight-web.git`. Branch `codex/p2-scene-visual-correction`; implementation `ba7a7109d5c65f88fcb24a85e2dc3f4b7b7c8fb9`. This record and work-state/director updates follow in a documentation commit; final pushed identity is supplied in the handoff.

## Presentation

Home leads with STILLLIGHT and secondary Water sort / Moonlit Atelier, short truthful commission progress, a centered tactile brass Play/Continue showing the actual commission, Settings gear and two icon utilities. Three unnumbered static glasses use existing accepted glass frames and material. The **same canvas and retained glass views** move into a bounded flow-layout Home prop slot and back into the game slot; gameplay restores all six numbered vessels. There is no second model, renderer, clock or recurring Home animation. Model/session/history/storage/audio/solver/content and source artwork are unchanged.

Commissions is a three-seal numbered game selection with distinct completed/current/locked appearance and icons; disabled locks are real. Settings has compact icon/toggle rows and expandable instructions. Collection presents the existing earned restoration and contributions in an illustrated folio. Native accessible labels, keyboard operation, utility focus and minimum 48px targets remain. Gameplay retains its rules, timing, maximal pours, materials, caps, authored selection, number stacking, completion and actual Next.

## Actual verification

| Check | Result |
| --- | --- |
| `npm run build` | PASS, TypeScript + Vite |
| `npm test` | PASS, 127/127 |
| `STILLLIGHT_URL=http://127.0.0.1:5180 npm run verify:p2-visual` | PASS, WebGL + Canvas at 400×889 and 450×1000; additional 400×778 Home in each backend |
| `npm run verify:runtime` against built preview | PASS, all five: viewport/DPR, context restoration, fallback, idle RAF, exact frozen frames |
| `npm run verify:smoke` against built preview | PASS, semantic focus/parallel pours/contact/Undo/Restart, transparent fallback, numbers behind artwork and retired routes |

Focused visual harness captures **34 before and 34 after PNGs**: fresh/partial/full Home, settings, commissions, journal, gameplay, completed-before-Next result across four configurations; two shorter Home captures. Fixtures are legal solved/underway histories validated by the real save validator. Checks cover painted primary lettering, exact same primary pixels with the board shown/hidden, visible native target bounds, real current/locked states, preserved underway Continue through replay, returning Settings, unchanged accepted session on Home resizing, result's actual Next ID and zero idle Home RAF. Captures were visually inspected for title/action hierarchy, glass placement, state legibility and bounded portraits.

**Regression reproduced:** before implementation, the painted-action comparison fails in both 400×778 cases (the old canvas covers button pixels), while the larger portraits happen to pass. After correction all 14 Home state/viewport/backend cases pass; hiding primary lettering changes at least 40 actual pixels, preventing a clickable-but-covered text false positive. Screenshots retain the actual owner rejection alongside comparable captures.

A runtime attempt exposed a composed screenshot variation: 12 pixels changed by one RGB value with unchanged model/frame and identical direct canvas readbacks. An isolated renderer experiment did not resolve it and was reverted. The freeze harness now takes a direct canvas readback before each composed screenshot, verifying **both** native canvas bytes and composed screenshot bytes exactly, alongside model/frame equality. All four boundaries pass; no tolerance or freeze requirement was relaxed and no renderer batching experiment remains.

Local evidence (ignored, not GitHub assets): `artifacts/verification/p2-visual-correction/{before,after}/`, each with `report.json`; owner originals `owner-rejected-home.png` and `owner-rejected-commissions.png`. Suggested small comparison: `before/webgl-400-short-home.png` → `after/webgl-400-short-home.png`, and `before/webgl-400-commissions.png` → `after/webgl-400-commissions.png`. Diagnostics from the bounded investigation are in the same local evidence folder. Previous full persistence/corruption/quota/audio campaign remains in the historical P1.3/P2 record; it was not duplicated for this presentation-only correction.

## Preview and stop

Refreshed built preview: [localhost:5180](http://127.0.0.1:5180/). Entry `dist/assets/index-DuTGXO0Q.js`, SHA256 `96504c22424bb83964d6693ca5e5270508e81eab382eb59f5d146f8d52055040`.

Approved moonlit SHA256 remains `db85586fa404107b6d9f94cba3dce59749471804f113638fbd7f7eb4edbeb2c6`; pumpkin `67a408c66a7cfe33e4a3588c7a8622ba7f4296bd1217c3c5cd1d05e6e8c6c0f9`; lockfile `d7f4c4280e8a6545a440b9a753cc2f23d9bbc7792007cd763266978434b26b23`. Existing toolchain/dependencies only; CSS/SVG icons add no raster assets or asset re-exports.

NOT RUN: owner acceptance of corrective UI/gameplay/feel; physical Redmi/native actuator/device, screen reader, fresh-player or formal director/Golden review. Browser screenshots and native semantics do not establish those gates. Restoration remains the existing localized treatment, not a new artwork revision. P3/campaign/bulk content/packaging/distribution and other mechanics remain held.

Only next action: owner playtest this corrective build, judge the Home/menu hierarchy and screen transitions, then exercise Continue, Settings, replay and completion/Next; report corrections in this chat.
