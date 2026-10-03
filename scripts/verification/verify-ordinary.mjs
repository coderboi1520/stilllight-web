import assert from 'node:assert/strict';
import {withVerificationHarness} from './browser-harness.mjs';
const solution=[[0,1],[4,0],[1,4],[4,1],[2,4],[3,2],[0,3],[3,0],[3,1],[4,3],[2,4],[0,2],[3,0]];
const disableWebGL=()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(['webgl','webgl2','experimental-webgl'].includes(type))return null;return get.call(this,type,...args);};};
const probe=()=>{
 window.__haptics=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{window.__haptics.push({pattern,time:performance.now()});return true;}});
 const raf=requestAnimationFrame;window.__rafCount=0;window.__delayOne=0;window.requestAnimationFrame=cb=>{window.__rafCount++;if(window.__delayOne){const delay=window.__delayOne;window.__delayOne=0;return raf(()=>setTimeout(()=>cb(performance.now()),delay));}return raf(cb);};
};
await withVerificationHarness({},async h=>{
 const dir=await h.artifactDir('ordinary');
 for(const backend of ['webgl','canvas']){
  const {page,context,errors}=await h.newIsolatedPage({width:400,height:889,initScripts:backend==='canvas'?[probe,disableWebGL]:[probe]});
  await h.goto(page);await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);
  const state=()=>page.evaluate(()=>window.__STILLLIGHT_PIXI__.state());
  const button=name=>page.getByRole('button',{name,exact:true});
  const choose=i=>page.locator(`[data-glass="${i}"]`).click();
  const settled=()=>page.waitForTimeout(2100);
  assert.equal(await page.evaluate(()=>window.__STILLLIGHT_PIXI__.backend()),backend);
  if(process.argv.includes('--feedback')){
   await choose(0);await choose(1);await settled();
   assert.equal(await page.evaluate(()=>window.__haptics.filter(e=>e.pattern.join(',')==='16,14,10').length),1);
   await button('Restart').click();await page.waitForTimeout(200);await page.evaluate(()=>{window.__haptics=[];window.__delayOne=1450;});
   await choose(0);await choose(1);await settled();
   assert.equal((await state()).busy,false);
   assert.equal(await page.evaluate(()=>window.__haptics.filter(e=>e.pattern.join(',')==='16,14,10').length),0,'missed stream contact remains silent');
   assert.equal(errors.length,0,errors.join('\n'));await context.close();console.log(`PASS ${backend}: presented contact once; skipped contact frame silent`);continue;
  }
  assert.equal(await page.locator('[data-glass]').count(),6);
  for(const label of ['Hint','Undo','Restart','Haptics','Reduced motion'])assert.equal(await button(label).count(),1);
  for(const [width,height] of [[400,889],[450,1000]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(150);
   const rects=await page.locator('button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {label:b.getAttribute('aria-label')||b.textContent,w:r.width,h:r.height,x:r.x,y:r.y,bottom:r.bottom,right:r.right};}));
   for(const r of rects){assert.ok(r.w>=48&&r.h>=48,JSON.stringify(r));assert.ok(r.x>=0&&r.y>=0&&r.right<=width&&r.bottom<=height,JSON.stringify(r));}
   assert.ok(await page.locator('[role="status"]').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight),'status remains within portrait viewport');
   const hits=await page.locator('[data-glass]').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {i:Number(b.dataset.glass),x:r.x+r.width/2,y:r.y+r.height/2};}));
   for(const hit of hits)assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('button')?.dataset.glass,hit),String(hit.i));
   await page.screenshot({path:`${dir}/${backend}-${width}x${height}.png`});
  }
  const initial=(await state()).board;
  await button('Hint').click();assert.deepEqual((await state()).board,initial);assert.ok((await page.locator('[role="status"]').textContent()).includes('Hint:'));await settled();
  await choose(2);await choose(3);assert.deepEqual((await state()).board,initial);assert.equal((await state()).busy,true);await page.waitForTimeout(600);
  await choose(0);await page.keyboard.press('1');await page.waitForTimeout(200);assert.equal((await state()).selected,null);
  await choose(0);await choose(1);assert.equal((await state()).busy,true);
  const accepted=(await state()).board;await page.keyboard.press('6');assert.deepEqual((await state()).board,accepted);
  await page.waitForTimeout(460);await page.screenshot({path:`${dir}/${backend}-live-pour.png`});await settled();
  assert.equal(await button('Undo').isEnabled(),true);await button('Undo').click();assert.deepEqual((await state()).board,initial);
  await page.waitForTimeout(260);await page.screenshot({path:`${dir}/${backend}-live-undo.png`});await page.waitForTimeout(400);
  await choose(0);await choose(1);await page.waitForTimeout(150);await button('Restart').click();assert.deepEqual((await state()).board,initial);assert.equal((await state()).busy,false);await settled();
  // Keyboard activation uses native button semantics and the same gameplay input.
  await page.locator('[data-glass="0"]').focus();await page.keyboard.press('Enter');assert.equal((await state()).selected,0);await page.keyboard.press('1');await settled();
  await button('Haptics').click();assert.equal(await button('Haptics').getAttribute('aria-pressed'),'false');
  await button('Reduced motion').click();assert.equal(await button('Reduced motion').getAttribute('aria-pressed'),'true');
  await page.reload();await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);
  assert.equal(await button('Haptics').getAttribute('aria-pressed'),'false');assert.equal(await button('Reduced motion').getAttribute('aria-pressed'),'true');assert.deepEqual((await state()).board,initial);
  const off=await page.evaluate(()=>window.__haptics.length);await choose(0);await choose(1);await settled();assert.equal(await page.evaluate(()=>window.__haptics.length),off);
  await button('Reduced motion').click();assert.equal(await button('Haptics').getAttribute('aria-pressed'),'false');await button('Haptics').click();await button('Restart').click();await settled();
  // Solve using actual pointer input; record one two-unit pour and completion feedback.
  await page.evaluate(()=>{window.__haptics=[];});
  let multi=false,captured=false;
  for(const [n,[source,target]] of solution.entries()){
   const before=(await state()).board;await choose(source);await choose(target);
   const after=(await state()).board;assert.equal((await state()).busy,true);
   const amount=after[target].length-before[target].length;assert.ok(amount>0);multi ||=amount>1;
   if(amount>1&&!captured){captured=true;await page.waitForTimeout(450);await page.screenshot({path:`${dir}/${backend}-multi-pour-${n}.png`});}
   await settled();
  }
  assert.ok(multi);assert.ok((await state()).board.every(g=>!g.length||g.length===4&&g.every(c=>c===g[0])));
  const completion=await page.evaluate(()=>window.__haptics.map(e=>e.pattern.join(',')));
  assert.equal(completion.filter(p=>p==='16,14,10').length,13,'one presented contact per accepted pour');
  assert.equal(completion.filter(p=>p==='10,18,22').length,4,'one contact per completed vessel');
  assert.equal(completion.filter(p=>p==='12,20,28,24,10').length,1,'one commission completion after settling');
  await page.screenshot({path:`${dir}/${backend}-complete.png`});
  const solved=(await state()).board;await button('Undo').click();await page.waitForTimeout(650);
  assert.ok(!(await state()).board.every(g=>!g.length||g.length===4&&g.every(c=>c===g[0])));
  const [source,target]=solution.at(-1);await choose(source);await choose(target);await settled();assert.deepEqual((await state()).board,solved);
  const beforeManual=await page.evaluate(()=>window.__haptics.length);
  await page.evaluate(()=>{const app=window.__STILLLIGHT_PIXI__;app.action('reset',10000);app.choose(0,10000);app.choose(1,10001);for(const t of [10100,10350,10521,11041,11251,12500])app.step(t);});
  assert.equal(await page.evaluate(()=>window.__haptics.length),beforeManual,'manual replay is silent');
  // Explicit manual frames give repeatable visual samples without advancing live time.
  for(const [label,t] of [['departure',10130],['contact',10330],['transfer',10521],['return',10870]]){
   await page.evaluate(()=>window.__STILLLIGHT_PIXI__.action('reset',10000));
   await page.evaluate(t=>{const app=window.__STILLLIGHT_PIXI__;app.choose(0,10000);app.choose(1,10001);app.step(t);},t);
   await page.screenshot({path:`${dir}/${backend}-manual-${label}.png`});
  }
  await page.evaluate(()=>{window.__STILLLIGHT_PIXI__.action('reset',performance.now());window.__STILLLIGHT_PIXI__.exitParity();});
  await settled();await page.evaluate(()=>{window.__rafCount=0;});await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>window.__rafCount),0);
  assert.equal(errors.length,0,errors.join('\n'));await context.close();
  console.log(`PASS ${backend}: both portrait sizes, semantic/keyboard/pointer input, Hint, reject, rapid input, exact Undo, mid-flight Restart, preferences/reload, 13-move solution, contact/completion once, cap re-entry, manual silence and idle`);
 }
});
