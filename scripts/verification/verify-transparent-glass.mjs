import assert from 'node:assert/strict';
import {withVerificationHarness} from './browser-harness.mjs';
const disableWebGL=()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(['webgl','webgl2','experimental-webgl'].includes(type))return null;return get.call(this,type,...args);};};
await withVerificationHarness({},async h=>{
 const dir=await h.artifactDir('current-cleanup');let accepted;
 for(const backend of ['webgl','canvas']){
  const {page,context,errors}=await h.newIsolatedPage({width:400,height:889,initScripts:backend==='canvas'?[disableWebGL]:[]});
  await h.gotoGame(page);await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__);
  assert.equal(await page.evaluate(()=>window.__STILLLIGHT_PIXI__.backend()),backend);
  await page.evaluate(()=>{const a=window.__STILLLIGHT_PIXI__;a.action('reset',1000);a.step(1000);});
  const colors=await page.evaluate(async()=>{
   window.__STILLLIGHT_PIXI__.step(1000);
   const c=document.querySelector('#pixi-host canvas'),image=new Image();image.src=c.toDataURL();await image.decode();
   const copy=document.createElement('canvas');copy.width=c.width;copy.height=c.height;const ctx=copy.getContext('2d');ctx.drawImage(image,0,0);
   // Vessel six is empty: compare the backdrop visible through its central interior.
   const a=window.__STILLLIGHT_PIXI__,g=a.lastFrame().glasses[5],scale=c.width/a.presentation().geometry.width;
   return [40,70,100].map(y=>Array.from(ctx.getImageData(Math.round(g.pose.x*scale),Math.round((g.pose.y+y*g.localScale)*scale),1,1).data).slice(0,3));
  });
  await page.screenshot({path:`${dir}/${backend}-transparent-idle.png`});
  console.log(`${backend} empty-glass pixels: ${JSON.stringify(colors)}`);
  assert.ok(colors.every(rgb=>rgb.some(c=>c>0)),'sample a freshly rendered WebGL buffer');
  if(backend==='webgl')accepted=colors;
  else for(let i=0;i<colors.length;i++)for(let c=0;c<3;c++)assert.ok(Math.abs(colors[i][c]-accepted[i][c])<=3,`fallback hides accepted backdrop at sample ${i}: ${colors[i]} vs ${accepted[i]}`);
  await page.evaluate(()=>{const a=window.__STILLLIGHT_PIXI__;a.action('reset',10000);a.choose(0,10000);a.choose(1,10001);a.choose(2,10100);a.choose(5,10101);a.step(10550);});
  await page.screenshot({path:`${dir}/${backend}-transparent-two-streams.png`});
  assert.equal(errors.length,0,errors.join('\n'));await context.close();
 }
 console.log('PASS transparent fallback: empty-vessel backdrop agrees with accepted Pixi material; both two-stream captures recorded');
});
