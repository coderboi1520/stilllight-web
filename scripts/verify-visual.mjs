import { withVerificationHarness } from './verification/browser-harness.mjs';
import { printSummary } from './verification/result-utils.mjs';
import { run } from './verification/verify-pour-states.mjs';
try { const results=await withVerificationHarness({},async harness=>[await run(harness)]);if(!printSummary(results,'Visual verification'))process.exitCode=1; }
catch(error){console.error(`SETUP FAIL: ${error.message}`);process.exitCode=1;}
