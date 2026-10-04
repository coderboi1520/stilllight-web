import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withVerificationHarness} from './browser-harness.mjs';
import {COMMISSIONS} from '../../src/session/content.ts';
import {solve} from '../../src/session/solver.ts';
const disableWebGL=()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(['webgl','webgl2','experimental-webgl'].includes(type))return null;return get.call(this,type,...args);};};
const probe=()=>{window.__audio=[];const make=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(...args){const o=make.apply(this,args),start=o.start.bind(o);o.start=(...args)=>{window.__audio.push(performance.now());return start(...args);};return o;};window.__feedback=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:p=>{window.__feedback.push(p.join(','));return true;}});const raf=requestAnimationFrame;window.__rafCount=0;window.requestAnimationFrame=cb=>{window.__rafCount++;return raf(cb);};};
await withVerificationHarness({},async h=>{
 const dir=await h.artifactDir('p1-3-p2');
 await writeFile(`${dir}/solutions.json`,JSON.stringify(COMMISSIONS.map(c=>({id:c.id,board:c.board,...solve(c.board)})),null,2));
 for(const backend of ['webgl','canvas'])for(const [width,height] of [[400,889],[450,1000]]){
  const item=await h.newIsolatedPage({width,height,initScripts:backend==='canvas'?[probe,disableWebGL]:[probe]});let page=item.page;const {context,errors}=item;
  await h.goto(page);await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);
  const shot=label=>page.screenshot({path:`${dir}/${backend}-${width}-${label}.png`});
  const state=()=>page.evaluate(()=>window.__STILLLIGHT_SESSION__.state());
  const snapshot=()=>page.evaluate(()=>window.__STILLLIGHT_SESSION__.snapshot());
  const b=i=>page.locator(`[data-glass="${i}"]`);
  const bounds=async()=>{const rects=await page.locator('button:visible').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return{w:r.width,h:r.height,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));for(const r of rects){assert.ok(r.w>=48&&r.h>=48,JSON.stringify(r));assert.ok(r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1,JSON.stringify(r));}};
  assert.equal(await page.locator('[data-screen="home"]:visible').count(),1,'normal boot Home');await bounds();await shot('home-fresh');
  await page.getByRole('button',{name:'Settings',exact:true}).click();await bounds();await shot('settings');
  await page.getByRole('button',{name:/^Sound /}).click();await page.getByRole('button',{name:'Back',exact:true}).click();await page.reload();await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);
  assert.equal(await page.getByRole('button',{name:/^Play /}).count(),1,'settings alone does not create Continue');
  await page.getByRole('button',{name:/^Play /}).click();await bounds();await shot('gameplay');
  await b(0).focus();await page.keyboard.press('Enter');assert.equal((await state()).selected,0);assert.equal(await b(0).evaluate(e=>getComputedStyle(e).outlineStyle),'none');await b(2).click();
  const accepted=(await snapshot()).active;await page.reload();await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);
  await page.getByRole('button',{name:/^Continue /}).click();assert.deepEqual((await snapshot()).active,accepted,'in-flight accepted board/history restored');
  assert.equal((await state()).busy,false);await page.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForTimeout(650);
  assert.deepEqual((await state()).board,COMMISSIONS[0].board);await page.getByRole('button',{name:'Hint',exact:true}).click();assert.deepEqual((await state()).board,COMMISSIONS[0].board);await page.waitForTimeout(800);
  for(let i=0;i<3;i++){
   const path=solve((await state()).board).path;
   for(const [s,d] of path){await b(s).click();await b(d).click();const accepted=await state();if(accepted.board.every(g=>!g.length||g.length===4&&g.every(c=>c===g[0])))assert.equal(accepted.completed,false,'physical arrival and settling precede award');await page.waitForFunction(()=>!window.__STILLLIGHT_SESSION__.state().animating,{},{timeout:6000});}
   await page.waitForFunction(()=>window.__STILLLIGHT_SESSION__.state().completed);assert.equal((await snapshot()).awarded.length,i+1);assert.equal((await state()).restoring,true,'new localized contribution has a finite reveal');await page.waitForFunction(()=>!window.__STILLLIGHT_SESSION__.state().restoring);await bounds();await shot(`result-${i+1}`);
   if(i===0){await page.reload();await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);await page.getByRole('button',{name:/^Continue /}).click();assert.equal((await snapshot()).awarded.length,1);assert.equal((await state()).completed,true);await shot('reload-result');await page.getByRole('button',{name:'Home',exact:true}).click();await page.getByRole('button',{name:'Commissions',exact:true}).click();assert.equal(await page.getByRole('button',{name:/Moon in glass · Locked/}).isEnabled(),false);await page.getByRole('button',{name:/Play Sill reflection · Current/}).click();assert.equal((await state()).id,COMMISSIONS[1].id);await page.getByRole('button',{name:'Home',exact:true}).click();await page.getByRole('button',{name:'Commissions',exact:true}).click();await page.getByRole('button',{name:/Replay First light/}).click();await page.getByRole('button',{name:'Home',exact:true}).click();await page.getByRole('button',{name:/^Continue /}).click();}
   if(i<2){if(i>0)await page.getByRole('button',{name:/^Next /}).click();await page.getByRole('button',{name:'Home',exact:true}).click();await shot('home-partial');await page.getByRole('button',{name:/^Continue /}).click();}
   else await page.getByRole('button',{name:'View restored room',exact:true}).click();
  }
  await bounds();await shot('home-full');assert.equal((await snapshot()).awarded.length,3);
  const localized=await page.locator('.room-light canvas:last-child').evaluate(c=>{const x=c.getContext('2d');return{outside:x.getImageData(20,950,1,1).data[3],pane:x.getImageData(552,199,1,1).data[3],sill:x.getImageData(490,751,1,1).data[3]};});assert.equal(localized.outside,0);assert.ok(localized.pane>0&&localized.sill>0,'registered pane and sill carry light');
  await page.getByRole('button',{name:'Collection',exact:true}).click();await bounds();await shot('journal');await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:'Commissions',exact:true}).click();await bounds();await page.getByRole('button',{name:/Replay First light/}).click();
  for(const [s,d] of solve((await state()).board).path){await b(s).click();await b(d).click();await page.waitForFunction(()=>!window.__STILLLIGHT_SESSION__.state().animating,{},{timeout:6000});}
  assert.equal((await snapshot()).awarded.length,3);await page.getByRole('button',{name:'Return Home',exact:true}).click();
  await page.evaluate(()=>{window.__rafCount=0;});await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.__rafCount),0,'Home idle RAF');
  const saved=await snapshot();await page.evaluate(()=>localStorage.setItem('stilllight.session.v1','{broken'));await page.reload();await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);
  assert.equal(await page.locator('.storage-error:visible').count(),1);assert.equal(await page.evaluate(()=>localStorage.getItem('stilllight.session.v1')),'{broken');assert.deepEqual(await snapshot(),saved);await shot('storage-recovery');
  await page.getByRole('button',{name:'Recover save',exact:true}).click();assert.ok(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('.evidence.'))));
  assert.equal(await page.evaluate(()=>localStorage.getItem('stilllight.sound.enabled')),'false');
  // A completed replay must also preserve an underway, non-completed Continue.
  await h.gotoGame(page);await b(0).click();await b(1).click();await page.getByRole('button',{name:'Home',exact:true}).click();const underway=(await snapshot()).active;
  await page.getByRole('button',{name:'Commissions',exact:true}).click();await page.getByRole('button',{name:/Replay First light/}).click();
  await page.getByRole('button',{name:'Home',exact:true}).click();assert.deepEqual((await snapshot()).active,underway);await page.getByRole('button',{name:/^Continue /}).click();
  await page.getByRole('button',{name:'Restart',exact:true}).click();
  await page.getByRole('button',{name:'Hint',exact:true}).click();await b(0).click();await b(2).click();assert.equal((await snapshot()).active.state.history.length,0);await page.waitForTimeout(650);
  await b(0).click();await b(1).click();await b(2).click();await b(5).click();assert.equal(await b(0).isEnabled(),false);assert.equal(await b(5).isEnabled(),false);assert.equal(await b(4).isEnabled(),true);
  const concurrent=(await snapshot()).active;assert.equal(concurrent.state.history.length,2);await page.close();page=await context.newPage();page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await h.goto(page);await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);await page.getByRole('button',{name:/^Continue /}).click();assert.deepEqual((await snapshot()).active,concurrent);assert.equal((await state()).busy,false);await shot('concurrent-reopen');
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Haptics',exact:true}).click();await page.getByRole('button',{name:'Reduced motion',exact:true}).click();await page.getByRole('button',{name:/^Sound /}).click();await page.waitForTimeout(60);
  await page.getByRole('button',{name:'Back',exact:true}).click();assert.equal((await state()).screen,'game');assert.deepEqual((await snapshot()).active,concurrent);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForTimeout(650);await page.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForTimeout(650);assert.deepEqual((await state()).board,COMMISSIONS[2].board);
  await b(0).click();await b(1).click();await page.getByRole('button',{name:'Restart',exact:true}).click();assert.deepEqual((await state()).board,COMMISSIONS[2].board);
  await page.reload();await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);await page.getByRole('button',{name:/^Continue /}).click();assert.deepEqual((await state()).board,COMMISSIONS[2].board);
  assert.equal(await page.evaluate(()=>localStorage.getItem('stilllight.haptics.enabled')),'false');assert.equal(await page.evaluate(()=>localStorage.getItem('stilllight.motion.reduced')),'true');assert.equal(await page.evaluate(()=>localStorage.getItem('stilllight.sound.enabled')),'true');
  const audioBefore=await page.evaluate(()=>window.__audio.length),feedbackBefore=(await state()).feedback;
  await page.evaluate(()=>{const a=window.__STILLLIGHT_PIXI__;a.action('reset',1000);a.choose(0,1000);a.choose(1,1001);a.choose(2,1100);a.choose(5,1101);a.step(1500);a.step(2100);a.step(5000);});
  assert.equal(await page.evaluate(()=>window.__audio.length),audioBefore);assert.deepEqual((await state()).feedback,feedbackBefore);await page.evaluate(()=>{const a=window.__STILLLIGHT_PIXI__;a.action('reset',performance.now());a.exitParity();});
  // Genuine user gesture unlock creates live cues; manual sampling above did not.
  await b(0).click();await page.waitForTimeout(80);await b(0).click();await b(0).click();await page.waitForTimeout(80);assert.ok(await page.evaluate(n=>window.__audio.length>n,audioBefore));await b(0).click();await page.waitForTimeout(300);
  const backgroundAudio=await page.evaluate(()=>window.__audio.length);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__audio.length),backgroundAudio);await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  const valid=await page.evaluate(()=>localStorage.getItem('stilllight.session.v1'));
  await page.evaluate(()=>{window.__allowWrites=false;const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(!window.__allowWrites)throw new DOMException('quota','QuotaExceededError');return set.call(this,k,v);};});
  await b(0).click();await b(1).click();assert.equal(await page.locator('.storage-error:visible').count(),1);assert.equal(await page.evaluate(()=>localStorage.getItem('stilllight.session.v1')),valid,'denied write leaves last persisted board intact');await shot('quota-denied');
  await page.getByRole('button',{name:'Keep playing in memory',exact:true}).click();await page.waitForFunction(()=>!window.__STILLLIGHT_SESSION__.state().animating);assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).isEnabled(),true);await page.getByRole('button',{name:'Settings',exact:true}).click();await page.evaluate(()=>{window.__allowWrites=true;});await page.getByRole('button',{name:'Retry saving',exact:true}).click();assert.equal(await page.locator('.storage-error:visible').count(),0);await page.getByRole('button',{name:'Back',exact:true}).click();
  const acceptedAfterRetry=(await snapshot()).active;await page.reload();await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);await page.getByRole('button',{name:/^Continue /}).click();assert.deepEqual((await snapshot()).active,acceptedAfterRetry);
  await page.evaluate(()=>{window.__STILLLIGHT_PIXI__.enterParity();localStorage.setItem('stilllight.session.v1','{"version":999}');localStorage.removeItem('stilllight.session.last-good.v1');});await page.reload();await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);
  assert.equal(await page.evaluate(()=>localStorage.getItem('stilllight.session.v1')),'{"version":999}');assert.equal(await page.getByRole('button',{name:'Start a new save',exact:true}).count(),1);await page.getByRole('button',{name:'Start a new save',exact:true}).click();assert.ok(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('.evidence.'))));assert.equal(await page.evaluate(()=>localStorage.getItem('stilllight.haptics.enabled')),'false');
  await h.gotoGame(page);const protectedBytes=await page.evaluate(()=>localStorage.getItem('stilllight.session.v1'));
  await page.addInitScript(()=>{window.__allowReads=false;const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(!window.__allowReads)throw new DOMException('denied','SecurityError');return get.call(this,k);};});await page.reload();await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);
  assert.equal(await page.locator('.storage-error:visible').count(),1);await page.evaluate(()=>{window.__allowReads=true;window.dispatchEvent(new Event('pagehide'));});assert.equal(await page.evaluate(()=>localStorage.getItem('stilllight.session.v1')),protectedBytes,'read-denied startup cannot overwrite progress when access returns');
  await page.getByRole('button',{name:'Start a new save',exact:true}).click();assert.ok(await page.evaluate(raw=>Object.keys(localStorage).filter(k=>k.includes('.evidence.')).some(k=>localStorage.getItem(k)===raw),protectedBytes),'explicit replacement archives previously unread progress');
  assert.equal(errors.length,0,errors.join('\n'));await context.close();
  console.log(`PASS ${backend} ${width}x${height}: full loop/solutions, final-settle/reveal, localized panes/sill, Next/current/locks, exact concurrent tab reopen/Undo/Restart, preserved Continue through replay, independent settings, journal, corrupt/version/quota recovery, live audio unlock/manual/background silence, bounds and idle Home`);
 }
});
