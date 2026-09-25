# STILLLIGHT — Original Two-Glass Gameplay Reference

This is a deliberately stripped golden-reference build extracted from the original STILLLIGHT gameplay implementation.

It contains only:
- exactly two original Canvas glasses
- original layered liquid rendering
- original gravity-aware tilted liquid / area conservation
- original glass selection lift + gold outline
- original valid pour animation and dynamic tilt
- original source slosh, receiver slosh, stream, impact and settle
- original invalid/wrong-match shake + red outlines
- original hint-attention motion + source/target outlines

It intentionally contains no title, background artwork, HUD, settings, audio, save system, navigation, level UI, undo/restart/hint buttons, completion screen, Android code, React, Capacitor, PixiJS, or other game-shell code.

The original project contains no haptics implementation, so this golden reference does not invent one.

## Run / web preview

1. Extract the ZIP.
2. Double-click `Start Web Preview.cmd`.
3. It opens `http://127.0.0.1:5178/`.
4. Keep the server window open while testing.

No npm install or build step is required.

## Visible interaction

- Click a non-empty glass to select it: original lift, liquid response and gold selected outline.
- Click the other glass: valid pour if legal, otherwise original invalid animation.
- Initial state is deliberately valid from left → right and transfers the top iris/purple unit.
- After that pour, left → right becomes an invalid color match, so the wrong-match animation can be checked immediately.

## Hidden verification shortcuts

These add no visible UI:
- `P` — trigger the valid left → right pour when available
- `H` — trigger original hint-attention animation (left source, right target)
- `I` — trigger original invalid animation directly
- `R` — reset to the initial two-glass state

Astra/verifiers can also use `window.__STILLLIGHT_ORIGINAL_TWO_GLASS__` from DevTools.

## Source structure

```text
src/
  geometry.js   original movement / tilt / pour-path math
  puzzle.js     original pour rule + color palette
  main.js       original Canvas glass/liquid/animation renderer, stripped to 2 glasses
  styles.css    only the canvas layout and invisible hit targets
```

This project is intended to be the golden source for a future 1:1 direct port. Do not visually improve or retune this build before parity comparison.
