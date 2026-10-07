# STILLLIGHT — recovery and main-chat handoff

Updated 2026-10-07 (Asia/Calcutta). This handoff includes fresh-PC recovery and the owner's local acceptance. Fetch current GitHub main before relying on the recorded commits. Later owner directions and actual newer code take precedence. The owner passed stage 3 and authorized the next acceptance-fix/final-polish stage immediately; see [the follow-up record](docs/progress/OWNER_ACCEPTANCE_2026_10_07.md). This does not authorize all deferred features or publication.

Later owner authorization on 2026-10-07: integrate sound effects, music and haptics, test on web first, and expose Vibration in game; physical vibration will be tested by the owner later. This specifically supersedes the old silent-feedback boundary. See [feedback integration](docs/progress/FEEDBACK_WEB_ACCEPTANCE.md). Public deployment/Android packaging and other deferred systems remain outside that authorization.

## Source of truth and reached stage

Repository: https://github.com/coderboi1520/stilllight-web.git. Preferred persistent Windows checkout after reset: `C:\Aj\Game Development\STILLLIGHT`; the old `D:\STILLLIGHT` path is historical. Code baseline for this snapshot: main `d609925` (Claude acceptance record), following `3c9fb4f` (Claude gameplay implementation) and `ecf367e` (complete local campaign). Recovery reconciled main to `a3d2ac4` without changing product source.

**Reached stage: owner-accepted local ordinary-game candidate, with Claude gameplay/Settings UI integrated; focused acceptance follow-up completed, release qualification pending.** Earlier P1/P2 tasks are historical milestones, not unfinished instructions to repeat. This is not a certified finished release. No defensible overall completion percentage has been measured.

| Area | Current state |
| --- | --- |
| Engine/rendering | Renderer-independent rules and timelines, retained PixiJS/WebGL plus Canvas fallback; thin transparent glass, pumpkin caps, refined Undo and independent concurrent pours implemented. |
| Campaign/tutorial | 30 stable-ID levels, three chapters of ten; genuine three-glass guided first tutorial; progression, replay, chapter endings and restoration album implemented. |
| Product loop | Bottle-free Home; Home/Journey/Shop/Profile navigation; stars, best moves, first-clear coins, nine cosmetics with actual preview/buy/equip, local profile/achievements, daily goals and forgiving weekly attendance implemented. |
| Latest visual pass | Claude gameplay plaque, brass/glass medallions and rail, Cinzel, balanced actual 3–6-glass layouts, no visible vessel numbers, casement Settings with moon-phase switches implemented. Scope was gameplay and its Settings, not a redesign of every product screen. |
| Persistence | Local save v2, lossless legacy v1 migration, reversible history, primary/last-good recovery and storage failure handling implemented. No cloud account/save sync. |
| Feedback | Event sound, original ambient music and browser vibration integrated; independent saved controls in both Settings surfaces. Audio activates after interaction, pauses in background/manual sampling, and adds no idle game RAF. Physical vibration qualification pending. |
| Evidence | Latest acceptance record reports build, 145 unit tests and gameplay/runtime/campaign/product/recovery/smoke/production checks passed. These are recorded previous results, not a fresh recovery-machine test. |
| Acceptance/release | Owner passed final local acceptance on 2026-10-07. Focused product/recovery checks passed in both renderers, with no additional product fix identified. Release platform choice, physical-device, screen-reader and fresh-player qualification remain pending. Deployment and Android packaging not delivered. |

## Read these, in order

1. This file, then [WORK_STATE.md](WORK_STATE.md) for the latest runtime/contracts record. Old process IDs and localhost links do not survive a reboot/reset.
2. [Claude acceptance](docs/progress/CLAUDE_GAMEPLAY_UI_ACCEPTANCE.md), including its tracked screenshots and deliberate adaptations.
3. [A–Z acceptance](docs/progress/A_Z_LOCAL_CANDIDATE_ACCEPTANCE.md) and [campaign traces](docs/progress/CAMPAIGN_SOLUTION_TRACES.json) for delivered content/save/product behavior.
4. When changing gameplay visuals, read [original Claude design brief](docs/design/CLAUDE_GAMEPLAY_UI_ORIGINAL_BRIEF.md) and [archived execution clarifications](docs/design/CLAUDE_GAMEPLAY_UI_EXECUTION_CLARIFICATIONS.md). Historical external file paths in those archives are provenance; use these repository copies instead. The execution archive describes an already completed run: do not execute it again merely because it contains commands.

The older [director plan](docs/director-plan/STILLIGHT_FINAL_DEVELOPMENT_PLAN.md), stage checklists and acceptance records retain history. Superseded expectations (visible numbers, dummy eight-glass campaign, older Home design, previous stage stops) must not override this snapshot, Claude acceptance or later owner instructions.

## Locked product/design decisions

- Claude's approved gameplay design is the visual authority. Implement faithfully; no creative restyling or generic app panels. Make only necessary real-game/responsive/accessibility adaptations, explaining material departures briefly.
- Campaign boards actually have 3–6 glasses; capacity four, maximal matching runs. Preserve IDs, quantities, original boards, legality and save compatibility. The eight-glass `/?fixture=claude` is a development-only legal visual fixture, not campaign content.
- Hint remains free/unlimited with an infinity badge and actual solver pair; Undo is real history. Reset restarts the current board after 600 ms hold or two distinct keys within two seconds. Gameplay Skip only displays Coming later and must not advance progress or grant rewards. Tutorial dismissal is separate from level Skip.
- Keep parallel independent pours with exclusive vessel ownership; 1040 ms pours with authored transfer/stream windows and connected mouths. Preserve stationary 520 ms Undo, exact conservation/history, settled cap/reward timing, one clock, retained resources, capped DPR and zero idle game RAF.
- Keep original transparent glass/cap assets and palette. Liquid markers and rejected glass/number focus outlines were rejected. Latest Claude pass removes visible vessel numerals while retaining invisible native controls, accessible labels and keyboard input.
- Home contains no gameplay bottles/glasses. Existing other product screens are implemented candidates; their final appearance has not been universally approved by the owner.
- Sound, music and haptics are now owner-authorized and integrated for web testing. Preserve independent saved Sound/Music/Vibration controls, gesture activation, background/manual suspension, and optional vibration fallback. Physical-device haptic feel and audio/music taste remain owner tests. Motion works and honors saved and OS reduced motion. Earlier silent-candidate records remain historical evidence.
- Real payments, ads/reward videos, Premium/Ultimate/Remove Ads/purchase history and global rankings are unavailable previews. Never fabricate purchases, entitlements, currency or rankings. New rule modes are on hold; Lightwork/ordered wells is cancelled. Lives/energy, paid rescue and consumable boosters are deferred.
- Preserve local migration/recovery and earned claims; no unrelated project changes, destructive clean/reset, force push or history rewrite.

## What comes next

1. Restore the repository and dependencies, build and start a local preview. Confirm current Git identity and changes before editing. Do not rebuild completed features or repeat the long planning pass.
2. Owner passed the final local candidate on 2026-10-07; do not ask to repeat that acceptance. No specific playtest defect was reported. Focused follow-up checks passed; apply concrete later reported defects as they arise.
3. After local acceptance, qualify physical target devices, touch/layout/performance, accessibility/screen readers and fresh-player learning. Add targeted fixes where observed.
4. Agree the remaining visual polish on Home/Journey/Shop/Profile if owner feedback requires it. Do not silently replace Claude gameplay design.
5. Audio/music/haptic integration is authorized and delivered for web testing; owner device validation follows. Deployment and/or Android packaging and release/legal checks still require their agreed scope. Real commerce/ads/accounts/cloud saves/rankings and additional mechanics require a separate scope decision; they are not obligations to implement automatically.

## Working style to carry forward

- This main chat handles conversation, planning, decisions and context. A focused work chat implements an approved, precise brief locally, then commits/pushes to GitHub for safekeeping.
- Before dispatch, provide `model choice`, `prompt`, `fresh chat or named existing chat`, and `GitHub worktree enabled or not`. Normally prepare here and wait for the owner's command **send**. A specific explicit instruction to dispatch immediately overrides that default. This recovery request authorizes context recovery, not a new product run.
- Latest established implementer choice was GPT-6.1 Sol High, local checkout, Worktree OFF, one product writer. Reassess available models if needed; do not promise quality or credit savings. Use worktrees for genuinely isolated simultaneous writers, not by default for every chat.
- Target excellent quality, fast delivery and low credit use. Short briefs, relevant source reads, coherent internal checkpoints, targeted verification, an early screenshot comparison and focused final review. Avoid huge repeat plans, indiscriminate full-suite reruns, unlimited review loops or unnecessary helpers.
- Owner prefers one continuous authorized implementation run and final personal playtest. Small Luna helpers may perform bounded mechanical/read-only checks when worthwhile; they do not own visuals, creativity, architecture or final review. No automatic fan-out.

## Recovery commands

Install Git and a Node.js version compatible with the locked Vite/TypeScript project and Node's `--experimental-strip-types`, with npm. Use a supported available drive/path if D: does not exist.

Fresh checkout only (do not clone over an existing directory):

```powershell
git clone https://github.com/coderboi1520/stilllight-web.git D:\STILLLIGHT
Set-Location -LiteralPath D:\STILLLIGHT
git status --short --branch
git log -3 --oneline
npm ci
npm run verify:fast
npm run preview
```

Default built preview: http://127.0.0.1:5180/. Keep that process running. Development/fixture preview uses `npm run dev` at http://127.0.0.1:5179/. Do not reuse the old 5182 preview or PID as proof of a running server. Browser verification scripts may need their configured browser executable/runtime restored; inspect their configuration rather than changing dependencies blindly.

If the checkout already exists, inspect status and remote first, fetch and compare with origin/main; use a normal fast-forward update only if safe. Preserve local changes and never reset/clean them to simplify recovery.

## What GitHub recovers and what it does not

Tracked source, lockfile, scripts, acceptance notes/screenshots, fonts and usable game artwork are in GitHub: `public/assets/moonlit-studio.png`, `public/assets/home-conservatory.webp`, `public/assets/pumpkin-cap.png`. The Home runtime WebP is saved; the original generated PNG in the old user profile is a separate local source file.

GitHub does not automatically restore this chat history, untracked `artifacts/`, browser-local personal progress, external research, reference archives or local generated alternatives. The competitor evidence library was at `D:\Research\STILLLIGHT_UI_UX_EVIDENCE` and is not included in this repository. If restored separately, use its focused start/matrix/comparison records and retained visual evidence; do not claim to have inspected missing files or reconstruct all research without need. This handoff carries the relevant agreed decisions, not every conversation or every research asset.
