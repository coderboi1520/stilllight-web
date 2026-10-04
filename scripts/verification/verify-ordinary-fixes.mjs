import assert from 'node:assert/strict';
import {withVerificationHarness} from './browser-harness.mjs';
const disableWebGL=()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(['webgl','webgl2','experimental-webgl'].includes(type))return null;return get.call(this,type,...args);};};
const probe=()=>{window.__feedback=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:p=>{window.__feedback.push(p.join(','));return true;}});const raf=requestAnimationFrame;window.__rafCount=0;window.requestAnimationFrame=cb=>{window.__rafCount++;return raf(cb);};};
await withVerificationHarness({},async h=>{
 const dir=await h.artifactDir('ordinary-fixes');
 for(const backend of ['webgl','canvas']){
  const {page,context,errors}=await h.newIsolatedPage({width:400,height:889,initScripts:backend==='canvas'?[probe,disableWebGL]:[probe]});
  await h.goto(page);await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);
  assert.equal(await page.evaluate(()=>window.__STILLLIGHT_PIXI__.backend()),backend);
  await page.keyboard.press('Tab');await page.keyboard.press('Enter');
  const focus=await page.locator('[data-glass="0"]').evaluate(b=>({focused:b.matches(':focus-visible'),outline:getComputedStyle(b).outlineStyle,visualChildren:b.childElementCount}));
  console.log(`${backend} focus: ${JSON.stringify(focus)}`);
  await page.screenshot({path:`${dir}/${backend}-keyboard-focus.png`});
  assert.ok(focus.focused);assert.equal(focus.outline,'none','no oversized hit-area focus outline');
  assert.equal(focus.visualChildren,0,'visual numbers belong behind glass artwork, outside the hit-control layer');
  assert.equal((await page.evaluate(()=>window.__STILLLIGHT_PIXI__.state())).selected,0,'native Enter still selects the vessel');
  await page.locator('[data-glass="0"]').click();await page.keyboard.press('1');
  const afterClickKey=await page.locator('[data-glass="0"]').evaluate(b=>({outline:getComputedStyle(b).outlineStyle,visualChildren:b.childElementCount}));
  assert.deepEqual(afterClickKey,{outline:'none',visualChildren:0},'click then keyboard adds no unwanted DOM decoration');
  const utility=page.getByRole('button',{name:'Hint',exact:true});await utility.focus();
  assert.equal(await utility.evaluate(b=>getComputedStyle(b).outlineStyle),'solid','utility keyboard focus remains');
  assert.equal(await page.locator('.legend').count(),0);
  await page.getByRole('button',{name:'Restart',exact:true}).click();
  const initial=(await page.evaluate(()=>window.__STILLLIGHT_PIXI__.state())).board;
  await page.evaluate(()=>{window.__feedback=[];});
  const b=i=>page.locator(`[data-glass="${i}"]`);
  await b(0).click();await b(1).click();
  assert.equal(await b(0).isEnabled(),false);assert.equal(await b(1).isEnabled(),false);
  assert.equal(await b(2).isEnabled(),true);assert.equal(await b(5).isEnabled(),true);
  await b(2).click();await b(5).click();
  assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).isEnabled(),false);
  await page.waitForTimeout(1750);
  assert.equal(await page.evaluate(()=>window.__feedback.filter(p=>p==='16,14,10').length),2,'one live presented contact for each accepted flight');
  await page.evaluate(()=>{window.__rafCount=0;});await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>window.__rafCount),0,'concurrent pours return to idle');
  const undo=()=>page.getByRole('button',{name:'Undo',exact:true}).click();
  await undo();await page.waitForTimeout(600);await undo();await page.waitForTimeout(600);
  assert.deepEqual((await page.evaluate(()=>window.__STILLLIGHT_PIXI__.state())).board,initial);
  await b(0).click();await b(1).click();await b(2).click();await b(5).click();
  await page.getByRole('button',{name:'Restart',exact:true}).click();
  assert.equal((await page.evaluate(()=>window.__STILLLIGHT_PIXI__.state())).busy,false);
  // Same explicit clock, two mouth-connected streams in each actual backend.
  const feedbackBefore=await page.evaluate(()=>window.__feedback.length);
  const f=await page.evaluate(()=>{const a=window.__STILLLIGHT_PIXI__;a.action('reset',10000);a.choose(0,10000);a.choose(1,10001);a.choose(2,10100);a.choose(5,10101);return a.step(10550);});
  assert.equal(await page.evaluate(()=>window.__feedback.length),feedbackBefore,'manual sampling is silent');
  assert.equal(f.streams.length,2);assert.deepEqual(f.streams.map(s=>[s.source,s.target]),[[0,1],[2,5]]);
  for(const s of f.streams)assert.deepEqual(s.end,f.glasses[s.target].contact.world);
  await page.screenshot({path:`${dir}/${backend}-two-streams.png`});
  for(const [width,height] of [[400,889],[450,1000]]){
   await page.setViewportSize({width,height});
   const rects=await page.locator('button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
   for(const r of rects){assert.ok(r.w>=48&&r.h>=48,JSON.stringify(r));assert.ok(r.x>=0&&r.y>=0&&r.right<=width&&r.bottom<=height,JSON.stringify(r));}
  }
  await page.evaluate(()=>{const a=window.__STILLLIGHT_PIXI__;a.action('reset',performance.now());a.exitParity();});
  await page.waitForTimeout(500);
  assert.equal(errors.length,0,errors.join('\n'));await context.close();
  console.log(`PASS ${backend}: keyboard focus, no legend, free pair input, overlapping streams, contact once per flight, exact two-step Undo, mid-flight restart, manual silence, portrait bounds and zero idle RAF`);
 }
});
