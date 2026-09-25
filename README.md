# STILLLIGHT Stage 2 — Astra Review Candidate

This package is the implementation candidate to audit against the previously supplied golden Canvas reference, reference video, and Astra Max architecture recommendation.

This review copy intentionally omits implementer verification claims and generated parity results. Audit the code, tests, harness, and runtime independently.

## Run

Windows: `Start Web Preview.cmd`

Or:

```bash
npm install
npm run dev
```

Main candidate: http://127.0.0.1:5179/

Parity/debug harness: http://127.0.0.1:5179/debug.html

## Independent checks available

```bash
npm test
npm run test:reference
npm run build
npm run parity:capture
```

The untouched supplied Canvas reference source is under `reference/original/`. The implementation candidate is under `src/`. The parity harness source is under `src/debug/`, `debug.html`, and `scripts/capture-parity.mjs`.
