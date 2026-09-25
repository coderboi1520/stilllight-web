import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const base=process.env.STILLLIGHT_URL??'http://127.0.0.1:5179';
const out=path.resolve('parity-screenshots');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1050,height:1150},deviceScaleFactor:1});
await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
const errors=[];
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon.ico'))errors.push(`console: ${m.text()}`);});
page.on('pageerror',e=>errors.push(`page: ${e.message}`));
await page.goto(`${base}/debug.html`,{waitUntil:'networkidle'});
await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.startsWith('ready'));
const states=['idle','selected','hint','invalid','pour0','pour25','pour50','pour75','pour100','settle'];
const report={comparisonScope:'The untouched Canvas oracle runtime exposes only board, selected and busy. Those fields are compared directly. Candidate RenderFrame geometry is captured for inspection but is not claimed as live-oracle numerical output.',states:{}};
for(const state of states){
  await page.click(`[data-state="${state}"]`);
  await page.waitForTimeout(30);
  const oracle=page.frames().find(f=>f.url().includes('debug-host.html'));
  const candidate=page.frames().find(f=>f.url().includes('embedded=1'));
  if(!oracle||!candidate)throw new Error('parity iframe unavailable');
  const oracleState=await oracle.evaluate(()=>globalThis.__STILLLIGHT_ORIGINAL_TWO_GLASS__.state());
  const candidateState=await candidate.evaluate(()=>globalThis.__STILLLIGHT_PIXI__.state());
  assert.deepEqual(candidateState,oracleState,`${state}: oracle-exposed state differs`);
  const op=path.join(out,`${state}-canvas.png`),pp=path.join(out,`${state}-pixi.png`);
  await oracle.locator('canvas').screenshot({path:op});
  await candidate.locator('canvas').screenshot({path:pp});
  report.states[state]={oracleComparableState:oracleState,candidateComparableState:candidateState,candidateRenderFrame:await candidate.evaluate(()=>globalThis.__STILLLIGHT_PIXI__.lastFrame()),oracle:op,candidate:pp,stateComparison:'PASS'};
}
await browser.close();
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
if(errors.length)throw new Error(errors.join('\n'));
console.log(`captured ${states.length} parity states; oracle-exposed state matched in all states -> ${out}`);
