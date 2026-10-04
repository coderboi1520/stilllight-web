import assert from 'node:assert/strict';
import {withVerificationHarness} from './browser-harness.mjs';
if(!process.env.STILLLIGHT_URL)throw Error('Set STILLLIGHT_URL to a built local preview.');
const fallback=()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){if(t==='webgl'||t==='webgl2')return null;return get.call(this,t,...a);};};
await withVerificationHarness({},async h=>{
 for(const backend of ['webgl','canvas']){
  const {page,context,errors}=await h.newIsolatedPage({width:400,height:889,initScripts:backend==='canvas'?[fallback]:[]});let release;const blocked=new Promise(r=>{release=r;});
  await page.route('**/assets/pumpkin-cap.png',async route=>{await blocked;await route.continue();});await page.goto(h.baseURL,{waitUntil:'domcontentloaded'});assert.match(await page.locator('script[type="module"]').getAttribute('src'),/^\/assets\//);
  await page.locator('[data-nav="play"]').click();release();await page.waitForFunction(()=>!!window.__STILLLIGHT_SESSION__);assert.equal(await page.evaluate(()=>window.__STILLLIGHT_SESSION__.snapshot().active),null,'early input during asset initialization does not start a run');assert.equal(await page.locator('[data-glass]').count(),3);
  await h.gotoGame(page);assert.equal(await page.evaluate(()=>window.__STILLLIGHT_PIXI__.backend()),backend);const initial=await page.evaluate(()=>window.__STILLLIGHT_SESSION__.state().board);assert.equal(await page.locator('[data-glass]').count(),6);
  await page.getByRole('button',{name:'Hint',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.__STILLLIGHT_SESSION__.state().board),initial);await page.waitForTimeout(750);await page.locator('[data-glass="0"]').click();await page.locator('[data-glass="1"]').click();await page.waitForFunction(()=>!window.__STILLLIGHT_SESSION__.state().animating);await page.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForFunction(()=>!window.__STILLLIGHT_SESSION__.state().animating);assert.deepEqual(await page.evaluate(()=>window.__STILLLIGHT_SESSION__.state().board),initial);
  await page.locator('header [data-nav="settings"]').click();assert.equal(await page.locator('.unavailable-row').count(),3);await page.getByRole('button',{name:'Reduced motion',exact:true}).click();await page.reload();await page.waitForFunction(()=>!!window.__STILLLIGHT_SESSION__);await page.locator('header [data-nav="settings"]').click();assert.equal(await page.getByRole('button',{name:'Reduced motion',exact:true}).getAttribute('aria-pressed'),'true');assert.deepEqual(errors,[]);await context.close();console.log(`PASS built ${backend}: delayed assets/early input, three and six vessel scenes, Hint/pour/exact Undo, reduced-motion reload, unavailable feedback controls`);
 }
});
