import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {withVerificationHarness} from './browser-harness.mjs';
// A retired HTML URL can legitimately receive the current game's SPA fallback.
// Confirm payload/repository absence, not an ambiguous HTTP 200 alone.
const retired=['debug.html','reference/original/index.html','reference/original/debug-host.html','benchmark/original-canvas/index.html','benchmark/pixi-retained/index.html','src/debug/ParityHarness.ts','reference/original/src/main.js','benchmark/pixi-retained/main.js'];
for(const path of retired){let exists=true;try{await access(new URL(`../../${path}`,import.meta.url));}catch{exists=false;}assert.equal(exists,false,`retired source remains: ${path}`);}
await withVerificationHarness({},async h=>{
 const root=await fetch(h.baseURL);assert.ok(root.ok);const game=await root.text();
 assert.match(game,/STILLLIGHT — Moonlit commission/);
 for(const path of retired){
  const response=await fetch(`${h.baseURL}/${path}`),body=await response.text();
  assert.ok(response.status===404||response.status===200&&body===game,`retired route serves a distinct payload: ${path} (${response.status})`);
  console.log(`PASS retired /${path}: ${response.status===404?'absent':'current-game SPA fallback only'}`);
 }
});
