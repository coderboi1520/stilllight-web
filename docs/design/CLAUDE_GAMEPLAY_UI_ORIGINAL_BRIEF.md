# STILLLIGHT — GAMEPLAY UI DEMO IMPLEMENTATION PROMPT

You are the frontend / game-UI engineer. The art direction is already decided. Do NOT redesign, restyle, "improve", or substitute generic UI. Where this brief specifies a value, use it. Where it leaves a small gap, choose the option closest to the described intent. Do not ask clarifying questions; build it.

## 0. Deliverable
A runnable, no-build web prototype: `index.html` + `styles.css` + `app.js` + `/assets`. Vanilla HTML/CSS/JS with inline SVG. No frameworks. No flattened generated PNG for any UI. UI is real DOM/SVG/CSS. Provide the files, plus one line on how to run (open index.html).

Assets you receive: (a) the STILLLIGHT background plate, (b) eight gameplay glasses / glass assets.
- The background plate must contain NO glasses and NO numerals. If the supplied background image still has glasses/numerals baked in, say so in your first line and stop; do not paint over them.
- Reuse the supplied glass art exactly. Do not redraw or restyle vessels or liquid. Only if no standalone glass assets exist, fall back to SVG replicas: rounded-bottom tube, 4 liquid slots, thin pale rim ellipse, flat segment colors teal #45C3B2, yellow #EDBA4D, purple #A18AE0, coral #E77A7B.
- Use the background at full strength. No permanent blur, no heavy recolor, no opaque panels over it.

## 1. Viewport and stage
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. Use `100dvh`. `touch-action: manipulation`, `user-select: none`, `-webkit-tap-highlight-color: transparent`.
- Build one portrait column ("stage"): width = `min(100vw, 100vh * 0.5, 430px)`, height = `100dvh`, centered; area outside is #05080C. All fractions below refer to the stage's width W and height H.
- Background: `object-fit: cover; object-position: 50% 54%`, filling the stage. On tall phones it scales by height, which lands the table's back edge at about 54% H. Moon window stays in the top ~35%.
- Safe areas: `sT = env(safe-area-inset-top)`, `sB = env(safe-area-inset-bottom)`, `sL/sR` likewise (0 fallback).
- Scene overlays (all pointer-events none):
  - Top scrim: `linear-gradient(180deg, rgba(3,6,10,.55), rgba(3,6,10,0))`, height 14% H.
  - Bottom scrim: `linear-gradient(0deg, rgba(3,6,10,.60), rgba(3,6,10,0))`, height 26% H.
  - Moonlight pool on the table: radial-gradient ellipse, color rgba(150,200,220,.07), centered at 50% W / 66% H, 90% W × 26% H, blurred edges. Subtle; must not recolor the art.

## 2. Design tokens (CSS custom properties)
```
--night:#070D14; --night-2:#0D1B26;
--brass-hi:#E6C98A; --brass:#B8904F; --brass-lo:#6E5226; --brass-dk:#2A1E0E;
--moon:#E9EEF2; --moon-glow:#BFD8E6;
--amber:#F2B24B; --ruby:#D9544B; --teal:#5FD3C6; --violet:#A98BE8;
--dim-glyph:#6F8089;
--ease-out:cubic-bezier(.16,1,.3,1);
--ease-in:cubic-bezier(.5,0,.75,0);
--ease-glass:cubic-bezier(.3,.7,.2,1);
```
Typography: Google Font **Cinzel** (weights 500/600/700), fallback `"Trajan Pro", "Cormorant SC", Georgia, serif`. All text uppercase with letter-spacing. Level numeral: 24px/700. Micro-labels: 8.5–10.5px/600, tracking .12–.24em. Never use system UI fonts.

## 3. Glass layout (eight glasses)
Remove the old numerals. Two rows of four. Column centers at **15.5%, 38.5%, 61.5%, 84.5% of W** (identical for both rows).
- Glass width `w = min(19vw, 8.5vh, 92px)`, height `h = 2.4w`, using the supplied art's own aspect ratio if it differs.
- **Back row**: glass bottom edge at **55.5% H**, scaled 0.92, with `filter: brightness(.94)`.
- **Front row**: glass bottom edge at **79% H**, scale 1.0.
- Under each glass: soft elliptical floor shadow (width 70% of glass, height 10% of glass, rgba(0,0,0,.4), blur 4px).
- Contents (bottom→top), 4 colors × 4 units:
  - Back: G1 [teal, yellow, purple]; G2 [purple]; G3 [yellow, coral, teal]; G4 [teal, purple, yellow, coral]
  - Front: G5 [coral, teal, purple, yellow]; G6 empty; G7 [coral]; G8 empty
- Tapping a glass lifts it by 12% of its height (140ms `--ease-out`) with a moon-silver rim glow (`drop-shadow(0 0 6px rgba(191,216,230,.6))`). Tapping it again lowers it; tapping another switches. No pouring logic. Vibration tick if enabled.
- Glass bounding boxes must never overlap each other or the dock at any supported size. Minimum glass tap target 44px (extend with padding if needed).

## 4. HUD composition
**Top row** (top edge at `sT + 6px`; side margins `14px + safe inset`):
- **Level plaque**, top-left, non-interactive. A lancet (pointed-arch) shape, about 60 × 56px (scale with `clamp`). Brass 1.5px edge (brass gradient), smoked-glass fill `rgba(8,16,26,.72)` with a faint teal tint and `backdrop-filter: blur(8px)`. A 5px amber cabochon sits at the apex. Contents: "LEVEL" 8px/600, tracking .24em, color #BFA874; numeral "12" Cinzel 24px/700, color --moon with `text-shadow: 0 0 8px rgba(191,216,230,.35)`.
- **Settings medallion**, top-right, medium size.
- Top center stays empty. Do NOT add a coin counter or any other element.

**Bottom dock**: four medallions on a shallow smile arc. No bar or panel behind them.
- `bottomPad = max(18px, sB + 6px)`.
- Large size `L = clamp(60px, 17.5vw, 72px)`. Medium size `M = clamp(44px, 12.5vw, 52px)`.
- Order and centers (x): **Reset 13.5% W · Undo 36.5% W · Hint 63.5% W · Skip 86.5% W**.
- Undo and Hint (L): center y = `bottomPad + L/2` above the stage bottom.
- Reset and Skip (M): center y = 14px higher than the L centers.
- Hit areas: at least 48×48px for M, extended with an invisible `::after` if needed.
- **Brass rail**: an SVG path behind the medallions, smoothly passing through the four centers and extending 6% W past each end. Stroke 1.25px, gradient opacity 0 → .35 → .35 → 0. A 6px diamond ornament sits at the center-bottom. It is decorative only and pointer-events none.

## 5. Medallion construction (shared by ALL controls and by Settings)
Layers, bottom to top:
1. **Shadow**: `0 6px 10px rgba(0,0,0,.55), 0 1px 0 rgba(255,255,255,.05) inset`.
2. **Brass bezel**: ring thickness 5px (L) / 4px (M). Fill is `conic-gradient(from 210deg, #6E5226, #E6C98A, #B8904F, #4A3518, #D4B070, #6E5226)`. On L only, overlay a knurl: `repeating-conic-gradient(rgba(0,0,0,.28) 0 2deg, transparent 2deg 6deg)` at 35% opacity. Inner 1px dark line #1B1208. 1px light line at the top-left outer edge.
3. **Glass lens**: `radial-gradient(circle at 35% 28%, rgba(120,170,190,.28), rgba(13,27,38,.78) 55%, rgba(5,9,14,.92) 100%)`, `backdrop-filter: blur(6px) saturate(1.15)` (with `-webkit-` prefix), `inset 0 2px 6px rgba(0,0,0,.6)`.
4. **Specular**: a curved white highlight in the upper-left (ellipse ~55% × 28%, rotated −20°, gradient from rgba(255,255,255,.35) to 0).
5. **Tint rim**: a 1px inner ring in the role color at 35% alpha.
6. **Glyph**: inline SVG, `viewBox 0 0 24 24`, rendered at 26px (L) / 22px (M), stroke 2.2px, round caps and joins, `fill: none` unless noted, color --moon, with `filter: drop-shadow(0 0 6px <role color at .4>)`.

**Role colors**: Hint --amber · Undo --moon-glow · Reset --ruby (muted) · Skip brass, no glow · Settings --brass-hi.

**Glyphs** (24×24, stroke):
- Hint: teardrop flame outline `M12 3.5c3.6 3.2 5.2 5.6 5.2 8.2a5.2 5.2 0 0 1-10.4 0c0-1.6.8-3.2 2.4-4.6.3 1.3.9 2 1.7 2.4C10.6 7.6 11 5.6 12 3.5Z`, a smaller filled inner flame at 60% opacity, and a base bar `M9.4 20.5h5.2`.
- Undo: `M9 7h5.5a4.5 4.5 0 0 1 0 9H8` plus arrowhead `M9.2 3.6 5.4 7l3.8 3.4`.
- Reset: `M19.5 12a7.5 7.5 0 1 1-2.4-5.5`, arrowhead `M19.6 4.2v3.8h-3.8`, and a small filled crescent in the center, about 4px.
- Skip: `M5.5 6l6 6-6 6M12.5 6l6 6-6 6M20 6v12`.
- Settings: a rounded 8-tooth cog (outer radius ~9, root ~6.8) whose center hole is a small crescent moon.

**No visible text labels** on any dock or top control. Provide `aria-label`s.

## 6. Button states and feedback
Shared timings:
- **Press**: 70ms `--ease-out`. `scale(.93)`, `translateY(1.5px)`, shadow shrinks to `0 2px 4px rgba(0,0,0,.6)`, bezel conic rotated 180° (looks pushed in), inner shadow deepens, lens brightens with a radial fill of the role color at 35%.
- **Release**: 200ms `--ease-glass` back to normal, no overshoot. A diagonal moonlight glint (a 40%-opacity white band) sweeps across the lens in 260ms.
- **Disabled** (Hint at 0 uses, Undo with empty history): opacity .5, `saturate(.4)`, glyph color --dim-glyph, no glow, no tint rim. Tap = horizontal shake ±4px, 2 cycles, 160ms total, and no action. In reduced motion: a 120ms dim flash instead.
- **Focus-visible**: 2px --brass-hi ring, 3px offset.

**Hint (L, amber)**
- Normal: amber tint rim, a gently lit flame glyph. Badge: a 20px brass roundel at the top-right of the bezel, smoked-glass fill, number in Cinzel 11px/700 --moon, initial count **3**.
- Tap (count>0): lens floods amber over 120ms. The flame glyph scales 1→1.12→1 over 220ms. The badge number rolls: the old digit exits upward in 140ms and the new one enters from below. Count decrements.
- In scene: pulse an amber rim glow on **G4** (source) for 700ms (`drop-shadow(0 0 10px rgba(242,178,75,.9))` 0→1→.35), then pulse a moon-silver rim on **G7** (target) beginning 380ms later. Both fade out by 1.6s. With Motion ON, emit 6 tiny amber motes (2–3px) drifting upward from G4's rim over 900ms. With Motion OFF: static rim glow held 1.2s, fade 200ms, no motes.
- At 0: disabled style, badge shows "0" in muted ruby.

**Undo (L, moon-silver)**
- Tap (stack>0): glyph rotates −50° then back (260ms `--ease-out`). Silver-teal lens pulse 160ms. Brief silver rim shimmer on G5 and G6 for 400ms (dummy "rewound" glasses). Dummy stack starts at 3 and decrements; disabled at 0.

**Reset (M, ruby, quiet: bezel at ~85% brightness, glyph 85% opacity)**
- **Hold 600ms to confirm.** While held: an SVG ring around the bezel (radius = medallion/2 + 3.5px, stroke 2.5px, ruby with glow) fills clockwise linearly over 600ms. The glyph spins one full turn over the same time. The lens takes a ruby fill at 25%.
- Released early: ring retracts in 160ms and a toast chip appears above the button for 1300ms reading "HOLD TO RESET".
- On complete: 120ms warm-white flash; all glasses dip 6px and rise with 30ms stagger (260ms total, `--ease-glass`); selection clears; Hint count → 3 and Undo stack → 3.
- Keyboard (Enter/Space): shows the toast and requires a second press within 2s to confirm.

**Skip (M, quiet: darker lens, glyph 70% opacity, no tint glow at rest)**
- Same hold mechanic and ring (ring color --brass-hi, toast "HOLD TO SKIP"), 600ms.
- On complete: a vertical band of moonlight sweeps across the board left→right in 420ms (white at 18% opacity, blurred edges). The level numeral on the plaque rolls from 12 → 13 in 260ms (old exits up, new enters from below). With Motion OFF: 120ms crossfade, no sweep.

**Toast chip**: capsule, smoked glass `rgba(8,16,26,.85)`, brass hairline border, Cinzel 10.5px/600 uppercase tracking .14em, color #CDBA8E, 6px×12px padding, a small diamond tail pointing to the button, 10px above it. Fade in 140ms, out 220ms.

**Settings medallion (M, brass)**: normal as above; while the panel is open it shows an active state: warm glow `0 0 10px rgba(230,201,138,.5)` and a brighter rim. Tapping it again closes the panel.

## 7. Settings panel — "The Moonglass Casement"
**Geometry**: centered horizontally in the stage, vertical center at 47% H, width `min(88% W, 348px)`, height auto (about 270px at 348px wide), minimum 16px side margins. Outer radius 16px.

**Material**:
- Glass: `linear-gradient(160deg, rgba(20,38,54,.78), rgba(6,12,20,.86))`, `backdrop-filter: blur(18px) saturate(1.25)`. Provide an opaque-ish fallback (rgba(8,14,22,.94)) where backdrop-filter is unsupported.
- Frame: 3px brass gradient border (135°: #E6C98A → #8B6A35 → #D2B06C → #5A4220), plus a 1px inner dark fillet #1A1208 and a moonlit inner top edge (`linear-gradient(180deg, rgba(200,225,240,.22), transparent 18%)` overlay).
- Shadow: `0 24px 60px rgba(0,0,0,.6)`.
- Optional 4% SVG feTurbulence grain overlay.
- Four small brass rivets (6px) at the corners.
- **Amber gem latch**: a 10px amber cabochon on the top frame edge, center, half-protruding; it glows when the panel is open.
- **Title**: "SETTINGS", Cinzel 11px/600, tracking .28em, color #CDBA8E, centered 20px from the top, flanked by small brass diamond-and-line ornaments.
- **Close**: a 34px mini brass medallion in the top-right (inside the frame, 10px offset), with a thin "×" glyph; hit area 44px. Also close on scrim tap and Esc.

**Contents: a triptych of three lancet windows** in a row, 10px gaps, 18px panel padding. Each lancet width = `(panelW − 36 − 20) / 3`, height = width × 1.87.
- Lancet shape: inline SVG, viewBox `0 0 94 176`, path `M3 172V72C3 40 28 20 47 4C66 20 91 40 91 72V172Z`. Fill rgba(5,10,16,.55), brass stroke 1.5px.
- Inside each lancet (top → bottom): glyph medallion (40px: 2px brass ring, dark lens, glyph 22px) at about 38% of lancet height; label at about 60%; toggle track at about 74%; state word at about 90%.
- Labels: Cinzel `clamp(9px, 2.7vw, 10.5px)`/600, tracking .12em, color #CDBA8E. The three labels are **SOUND · VIBRATION · MOTION**.
- State word: "ON" (hue color) or "OFF" (#6F8089), Cinzel 9.5px/600, tracking .2em. This provides non-color redundancy.

**Lancet hues (active glow)**: Sound --teal · Vibration --violet · Motion --amber. Active glow = `radial-gradient(ellipse at 50% 30%, <hue>@.28, transparent 70%)` inside the lancet, and the stroke brightens to a hue-tinted brass. Inactive lancets are unlit smoked glass.

**Glyphs (22px, stroke 2)**:
- Sound: speaker body `M4 9.5h3.2L11.5 6v12L7.2 14.5H4z` plus arcs `M14.5 9.2a4 4 0 0 1 0 5.6` and `M16.8 7a7 7 0 0 1 0 10`.
- Vibration: a rounded device outline (x 8.5, y 4, w 7, h 16, rx 1.8) with two short arc pairs on each side.
- Motion: a circle (cx 15, cy 12, r 4) with three trailing speed lines `M3 9h6M2 12h7M3 15h6`, tapering opacity.

## 8. Toggle design — moonstone track
- **Track**: 62×28px capsule, a recessed carved slot: `linear-gradient(#050A10,#0E1A24)`, `inset 0 2px 4px rgba(0,0,0,.8)`, 1.5px brass gradient border.
- **Orb**: 22px disc, silver #EDEBDD, in a 3px inset. It contains a "phase shadow", a same-size dark disc (#0A1118) clipped to the orb.
  - **OFF** (new moon): the orb sits at the left; the shadow disc is shifted +5px, leaving a thin silver crescent on the left. The orb is dim and cold. No hue light in the track. Glyph is --dim-glyph. The glyph's moving parts are retracted: sound arcs hidden, vibration arcs hidden, motion lines collapsed to a dot.
  - **ON** (full moon): the orb sits at the right (34px of travel), the shadow disc is shifted off (+24px) leaving a full pale-gold-white moon with a glow in the lancet hue (`0 0 8px hue@.6`). Hue light fills the track from the left up to the orb (scaleX from the left origin, hue at 55% alpha). Glyph is --moon bright with a hue glow; moving parts are drawn.
- **Tap transition**: orb translate and shadow shift 280ms `--ease-glass`; track fill 280ms same; lancet glow cross-fades 320ms `--ease-out` (ON) / 220ms `--ease-in` (OFF). When turning ON, a bloom ring expands from the orb (0 → 38px, opacity .5 → 0, 420ms). Glyph response: Sound arcs draw in sequentially (stroke-dashoffset, 60ms stagger) and retract in reverse; Vibration device shakes ±1.5px for 2 cycles (180ms); Motion lines extend from the circle (scaleX 0→1, origin right).
- Hit target: the whole lancet is tappable (it's the switch); minimum 48px.
- Semantics: each lancet `role="switch"` with `aria-checked`, keyboard Space/Enter toggles. Defaults: Sound ON, Vibration ON, Motion ON (but if `prefers-reduced-motion: reduce`, Motion defaults to OFF).
- **Effects of toggles**: Motion OFF sets `data-motion="off"` on the root and disables ambient motes, hint motes, light sweeps, bloom rings, selection lift animation (instant), the orb slide (switches to a 120ms crossfade), and the panel open/close (uses the reduced version below). Vibration ON → `navigator.vibrate` where available: 8ms on taps, 18ms on hold-complete, 12ms when the toggle itself turns ON. Sound ON → optional Web Audio glass-ping (sine 880→1320Hz, 160ms exponential decay, gain ≤ .08) on button taps, created only after the first user gesture; completely silent when OFF. No audio files.

## 9. Settings open / close choreography
**Open (total ≈ 440ms)**:
1. **t=0**: Settings medallion press feedback; cog rotates +45° over 360ms `--ease-out`.
2. **Scrim** (0–260ms): a full-stage layer with `rgba(3,6,10,.58)` and a *static* `backdrop-filter: blur(6px)`; animate only its **opacity** 0→1 over 260ms `--ease-out` (do not animate the blur value itself). Other HUD controls fade to .35 opacity (200ms) and become inert. The Settings medallion stays above the scrim.
3. **Panel grow** (0–380ms): FLIP from the Settings medallion. Compute `dx, dy` from the medallion's center to the panel's center. Start `transform: translate(dx,dy) scale(.2)`, end identity, `transform-origin` center. Easing `--ease-out`. Opacity 0→1 over the first 160ms, `ease-out`. No bounce, no overshoot.
4. **Glass settle** (60–360ms): inner glass tint opacity .0→1; panel backdrop-filter static (ok to be present from the start).
5. **Lancets** (140–440ms): each rises `translateY(10px)→0` and fades in over 260ms `--ease-out`, staggered 60ms (Sound, Vibration, Motion). Active lancets "kindle": hue glow fades in over 260ms starting 80ms after their reveal.
6. **Gem latch** glows from 220–420ms.

**Close (total ≈ 260ms)**:
1. Lancets fade out in 90ms, no stagger.
2. Panel shrinks back toward the medallion: `scale(1)→scale(.2)` and translate back, 260ms, `--ease-in`; opacity 1→0 over 100–260ms.
3. Scrim fades 220ms; HUD returns to full opacity over 200ms after a 60ms delay; cog rotates back −45° over 300ms.

**Reduced-motion version** (when Motion is OFF or `prefers-reduced-motion: reduce`): no translate/scale, no stagger, no cog rotation. Panel and scrim cross-fade: open 140ms, close 100ms, `ease-out`. Scrim dim .62 with static blur. Toggle orbs switch with an 80–120ms crossfade, no bloom ring.

**Dialog behavior**: `role="dialog" aria-modal="true"`, focus moves into the panel on open and returns to the medallion on close, focus trap while open, Esc closes. The gameplay scene is inert while open.

## 10. Ambient life (Motion ON only)
- A soft 8-second "breathing" glow overlay on the moon (radial, ±6% opacity). Must be low-cost.
- Maximum 12 dust motes (1–3px, opacity .1–.4) drifting very slowly through the window beam area.
- Nothing else. Animate only `transform` and `opacity`.

## 11. Dummy state (in memory only, no persistence)
`hints=3, undos=3, level=12, selectedGlass=null, sound/vibration/motion toggles`. Reset restores hints/undos/selection and plays the dip animation. Skip increments the level. There is no puzzle logic, no economy, no shop.

## 12. Responsive rules
- Test at 320×568, 360×640, 375×667, 390×844, 430×932, and a 768×1024 portrait window.
- Anchored: top row to the safe area; dock to the bottom safe area; glass column centers at fixed fractions of W; Settings panel centered at 47% H.
- Compresses: glass size (via the `min()` formula), medallion sizes (via `clamp`), plaque size, label sizes.
- Never compresses: tap targets below 44px; Settings lancet labels below 9px.
- No overlap between glasses, plaque, dock, or panel at any listed size. On narrow phones the glasses get smaller before the gaps do. On tall phones the table stays visible between the front row and the dock; do not stretch glasses to fill it.

## 13. Technical boundaries
- Do not add features not listed here (no coins, shop, home screen, tutorials, extra buttons).
- Do not change colors, shapes, layout fractions, or timings listed above.
- Do not use native form controls, default iOS/Material switches, system fonts, or box-shadow-only "rounded rectangle" buttons.
- Transitions use `transform`/`opacity` only; avoid layout thrash.
- Keep tokens in CSS custom properties; keep the JS under about 400 lines; comment the FLIP math.

## 14. Visual acceptance checklist (verify before replying)
1. Moon and window finial are fully visible with the panel closed; the window's lower half is still readable through and between the glasses.
2. Eight glasses, two rows, no numerals, no overlap.
3. Dock reads as four gem-in-brass medallions on a smile arc; Undo and Hint clearly larger than Reset and Skip.
4. No text on controls at rest; Hint badge shows 3.
5. Pressing any button sinks it and sweeps a glint on release.
6. Reset and Skip require a hold; early release shows the toast.
7. Settings grows from its own medallion in ~440ms with no bounce and closes in ~260ms; reduced-motion crossfade works.
8. The panel is a triptych of lancets with moon-phase toggles; ON/OFF is unmistakable and the glyphs react.
9. It looks like a mobile game, not an app, and would be credible in an App Store screenshot.

Reply with the files and a one-paragraph summary. Do not suggest redesigns.