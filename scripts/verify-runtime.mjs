import { withVerificationHarness } from './verification/browser-harness.mjs';
import { printSummary } from './verification/result-utils.mjs';
import { run as viewport } from './verification/verify-viewport-dpr.mjs';
import { run as context } from './verification/verify-context-restore.mjs';
import { run as fallback } from './verification/verify-canvas-fallback.mjs';
import { run as idle } from './verification/verify-idle-raf.mjs';
import { run as freeze } from './verification/verify-frame-freeze.mjs';

try {
  const results = await withVerificationHarness({}, async harness => {
    const scenarios = [['VIEWPORT_DPR',viewport],['CONTEXT_RESTORE',context],['CANVAS_FALLBACK',fallback],['IDLE_RAF',idle],['FRAME_FREEZE',freeze]];
    const out=[];
    for(const [,fn] of scenarios) out.push(await fn(harness));
    return out;
  });
  if(!printSummary(results,'Runtime verification'))process.exitCode=1;
} catch(error) { console.error(`SETUP FAIL: ${error.message}`); process.exitCode=1; }
