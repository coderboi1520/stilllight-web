import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withVerificationHarness} from './browser-harness.mjs';
import {COMMISSIONS} from '../../src/session/content.ts';
import {solve} from '../../src/session/solver.ts';
import {pour} from '../../src/core/rules.ts';
import {validateSave} from '../../src/session/session.ts';

const before=process.argv.includes('--before');
const disableWebGL=()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return ['webgl','webgl2','experimental-webgl'].includes(type)?null:get.call(this,type,...args);};};
const probe=()=>{const raf=requestAnimationFrame;window.__rafCount=0;window.requestAnimationFrame=cb=>{window.__rafCount++;return raf(cb);};};
function fixture(index,complete=false,underway=false){
 const c=COMMISSIONS[index];let board=structuredClone(c.board);const history=[];
 for(const [s,t] of solve(board).path.slice(0,complete?undefined:underway?1:0)){const r=pour(board,s,t);history.push({source:s,target:t,color:r.color,amount:r.amount,beforeSource:board[s],beforeTarget:board[t],afterSource:r.board[s],afterTarget:r.board[t]});board=r.board;}
 return validateSave({version:1,awarded:COMMISSIONS.slice(0,index+(complete?1:0)).map(c=>c.id),active:{id:c.id,state:{board,history},hints:0,completed:complete}});
}
await withVerificationHarness({},async h=>{
 const dir=await h.artifactDir(`p2-visual-correction/${before?'before':'after'}`),report=[];
 const open=async(backend,width,height,saved)=>{const item=await h.newIsolatedPage({width,height,initScripts:[probe,...(backend==='canvas'?[disableWebGL]:[])]});if(saved)await item.context.addInitScript(s=>localStorage.setItem('stilllight.session.v1',JSON.stringify(s)),saved);await h.goto(item.page);await item.page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);assert.equal(await item.page.evaluate(()=>window.__STILLLIGHT_PIXI__.backend()),backend);return item;};
 const bounds=async(page,width,height)=>{for(const r of await page.locator('button:visible,summary:visible').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};}))){assert.ok(r.w>=48&&r.h>=48,JSON.stringify(r));assert.ok(r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1,JSON.stringify(r));}};
 const paintedAction=async page=>{const button=page.locator('[data-nav="play"]');await button.blur();const painted=await button.screenshot();await page.locator('.board').evaluate(e=>e.style.visibility='hidden');const unobstructed=await button.screenshot();await page.locator('.board').evaluate(e=>e.style.visibility='');
  if(!before){await button.locator('.primary-label,.primary-commission').evaluateAll(es=>es.forEach(e=>e.style.visibility='hidden'));const withoutLettering=await button.screenshot();await button.locator('.primary-label,.primary-commission').evaluateAll(es=>es.forEach(e=>e.style.visibility=''));const changed=await page.evaluate(async([a,b])=>{const pixels=async s=>{const img=new Image();img.src=`data:image/png;base64,${s}`;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);return x.getImageData(0,0,c.width,c.height).data;};const p=await pixels(a),q=await pixels(b);let n=0;for(let i=0;i<p.length;i+=4)if(p[i]!==q[i]||p[i+1]!==q[i+1]||p[i+2]!==q[i+2])n++;return n;},[painted.toString('base64'),withoutLettering.toString('base64')]);assert.ok(changed>=40,`Primary lettering paints only ${changed} pixels`);}
  return painted.equals(unobstructed);};
 for(const backend of ['webgl','canvas'])for(const [width,height] of [[400,889],[450,1000]]){
  for(const [label,saved] of [['fresh',undefined],['partial',fixture(1,false,true)],['full',fixture(2,true)]]){
   const {page,context,errors}=await open(backend,width,height,saved),shot=label=>page.screenshot({path:`${dir}/${backend}-${width}-${label}.png`});
   const original=await page.evaluate(()=>window.__STILLLIGHT_SESSION__.snapshot());await shot(`home-${label}`);const clear=await paintedAction(page);report.push({backend,width,height,screen:`home-${label}`,paintedActionClear:clear});
   if(!before){assert.ok(clear,'Home canvas paints over primary action');await bounds(page,width,height);assert.equal(await page.locator('[data-glass]:visible').count(),0);assert.equal(await page.locator('.home-props .board').count(),1);}
   if(label==='fresh'){await page.getByRole('button',{name:'Settings',exact:true}).click();await shot('settings');if(!before){await bounds(page,width,height);await page.getByRole('button',{name:/^Sound /}).click();}await page.getByRole('button',{name:'Back',exact:true}).click();}
   if(label==='partial'){
    await page.getByRole('button',{name:'Commissions',exact:true}).click();await shot('commissions');if(!before){await bounds(page,width,height);assert.equal(await page.getByRole('button',{name:/Moon in glass · Locked/}).isEnabled(),false);await page.getByRole('button',{name:/Replay First light/}).click();await page.getByRole('button',{name:'Home',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.__STILLLIGHT_SESSION__.snapshot()),original,'Replay preserves underway Continue');}else await page.getByRole('button',{name:'Back',exact:true}).click();
    await page.getByRole('button',{name:/^Continue /}).click();assert.deepEqual(await page.evaluate(()=>window.__STILLLIGHT_SESSION__.snapshot()),original);await shot('gameplay');await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await page.evaluate(()=>window.__STILLLIGHT_SESSION__.state().screen),'game');assert.deepEqual(await page.evaluate(()=>window.__STILLLIGHT_SESSION__.snapshot()),original);await page.getByRole('button',{name:'Home',exact:true}).click();
   }
   if(label==='full'){await page.getByRole('button',{name:'Collection',exact:true}).click();await shot('journal');if(!before){await bounds(page,width,height);assert.equal(await page.locator('.journal-list li').count(),3);}await page.getByRole('button',{name:'Back',exact:true}).click();}
   if(!before){await page.setViewportSize({width,height:height-40});await page.setViewportSize({width,height});assert.deepEqual(await page.evaluate(()=>window.__STILLLIGHT_SESSION__.snapshot()),original,'Home layout does not alter accepted session');await page.evaluate(()=>window.__rafCount=0);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__rafCount),0,'Idle Home has no RAF');}
   assert.deepEqual(errors,[]);await context.close();
  }
  const {page,context,errors}=await open(backend,width,height,fixture(0,true));await page.getByRole('button',{name:/^Continue /}).click();await page.screenshot({path:`${dir}/${backend}-${width}-result.png`});if(!before){await bounds(page,width,height);await page.getByRole('button',{name:/^Next /}).click();assert.equal(await page.evaluate(()=>window.__STILLLIGHT_SESSION__.state().id),COMMISSIONS[1].id);}assert.deepEqual(errors,[]);await context.close();
  console.log(`CAPTURE ${backend} ${width}x${height}: fresh/partial/full Home, commissions, settings, journal, gameplay and result`);
 }
 for(const backend of ['webgl','canvas']){const {page,context}=await open(backend,400,778);await page.screenshot({path:`${dir}/${backend}-400-short-home.png`});const clear=await paintedAction(page);report.push({backend,width:400,height:778,screen:'home-short',paintedActionClear:clear});if(!before){assert.ok(clear,'Owner short viewport: canvas covers Play pixels');await bounds(page,400,778);}await context.close();}
 await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));
 assert.ok(report.every(r=>r.paintedActionClear),'Painted-pixel regression: Home canvas covers Play/Continue');
 console.log('PASS painted Home actions, native targets, actual progression, Continue/replay/settings preservation and idle rendering');
});
