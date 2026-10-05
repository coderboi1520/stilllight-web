import assert from 'node:assert/strict';
import {withVerificationHarness} from './browser-harness.mjs';
const disableWebGL=()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(['webgl','webgl2','experimental-webgl'].includes(type))return null;return get.call(this,type,...args);};};
await withVerificationHarness({},async h=>{
 const dir=await h.artifactDir('current-cleanup');
 for(const backend of ['webgl','canvas']){
  const {page,context,errors}=await h.newIsolatedPage({width:400,height:889,initScripts:backend==='canvas'?[disableWebGL]:[]});
  await h.gotoGame(page);await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);
  assert.equal(await page.evaluate(()=>window.__STILLLIGHT_PIXI__.backend()),backend);
  assert.equal(await page.locator('.hit-glasses button > *').count(),0,'no artwork in the controls above the canvas');
  for(const [width,height] of [[400,889],[450,1000]]){
   await page.setViewportSize({width,height});
   await page.evaluate(()=>{const a=window.__STILLLIGHT_PIXI__;a.action('reset',10000);a.step(10000);});
   assert.equal(await page.evaluate(()=>window.__STILLLIGHT_PIXI__.presentation().numbersVisible),false,'Claude gameplay removes rendered vessel numerals');
   const frame=await page.evaluate(()=>{const a=window.__STILLLIGHT_PIXI__;a.choose(0,10000);a.choose(1,10001);a.choose(2,10100);a.choose(5,10101);return a.step(10550);});
   assert.equal(frame.streams.length,2);assert.equal(await page.evaluate(()=>window.__STILLLIGHT_PIXI__.presentation().numbersVisible),false);
   assert.equal(await page.locator('[data-glass]').count(),6);assert.equal(await page.locator('.hit-glasses button > *').count(),0);
   await page.screenshot({path:`${dir}/${backend}-unlabelled-overlap-${width}.png`});
  }
  // Reset the manual flight before checking the unchanged native control target.
  await page.evaluate(()=>{const a=window.__STILLLIGHT_PIXI__;a.action('reset',performance.now());a.exitParity();});
  const first=page.getByRole('button',{name:/^Vessel 1,/});await first.focus();await page.keyboard.press('Enter');
  assert.equal((await page.evaluate(()=>window.__STILLLIGHT_PIXI__.state())).selected,0);
  assert.equal(await first.evaluate(b=>getComputedStyle(b).outlineStyle),'none');
  assert.equal(errors.length,0,errors.join('\n'));await context.close();
 }
 console.log('PASS vessel labels: both backends omit rendered numerals while retaining genuine semantic controls, keyboard selection and parallel flights');
});
