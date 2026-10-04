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
  const ink=async time=>page.evaluate(async time=>{
   window.__STILLLIGHT_PIXI__.step(time);
   const c=document.querySelector('#pixi-host canvas'),r=c.getBoundingClientRect(),image=new Image();image.src=c.toDataURL();await image.decode();
   const copy=document.createElement('canvas');copy.width=c.width;copy.height=c.height;const ctx=copy.getContext('2d');ctx.drawImage(image,0,0);
   return Array.from({length:6},(_,i)=>{
    const x=(80+i%3*120)*c.width/400,y=(130+Math.floor(i/3)*242+20-8+620*.28)*c.height/620;
    const pixels=ctx.getImageData(Math.round(x-5*c.width/r.width),Math.round(y),Math.round(10*c.width/r.width),Math.round(14*c.height/r.height)).data;
    // Fixed 12px glyphs now land on fractional pixels at the narrower mobile
    // board sizes. Include their antialiased ivory edges, retaining the same
    // visibility and natural occlusion assertions rather than counting only
    // near-opaque glyph cores.
    let count=0;for(let p=0;p<pixels.length;p+=4)if(pixels[p]>175&&pixels[p+1]>160&&pixels[p+2]>135&&pixels[p]>=pixels[p+1]&&pixels[p+1]>=pixels[p+2])count++;
    return count;
   });
  },time);
  for(const [width,height] of [[400,889],[450,1000]]){
   await page.setViewportSize({width,height});
   await page.waitForFunction(()=>{const c=document.querySelector('#pixi-host canvas'),r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio,2);return Math.abs(c.width-r.width*d)<1&&Math.abs(c.height-r.height*d)<1;});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.evaluate(()=>window.__STILLLIGHT_PIXI__.action('reset',10000));
   const idle=await ink(10000);
   await page.screenshot({path:`${dir}/${backend}-labels-idle-${width}.png`});
   assert.ok(idle.every(n=>n>=4),`all idle labels remain visible: ${idle}`);
   const frame=await page.evaluate(()=>{const a=window.__STILLLIGHT_PIXI__;a.choose(0,10000);a.choose(1,10001);a.choose(2,10100);a.choose(5,10101);return a.step(10550);});
   assert.equal(frame.streams.length,2);
   const pouring=await ink(10550);
   assert.ok(pouring[1]<idle[1]/2,`glass/liquid occludes label 2: idle ${idle[1]}, pouring ${pouring[1]}`);
   assert.ok(pouring[3]>=4&&pouring[4]>=4&&pouring[5]>=4,'uncovered numbers remain visible during pours');
   await page.screenshot({path:`${dir}/${backend}-labels-overlap-${width}.png`});
   console.log(`${backend} ${width}: idle label ink ${idle}; overlapping label ink ${pouring}`);
  }
  // Reset the manual flight before checking the unchanged native control target.
  await page.evaluate(()=>{const a=window.__STILLLIGHT_PIXI__;a.action('reset',performance.now());a.exitParity();});
  const first=page.getByRole('button',{name:/^Vessel 1,/});await first.focus();await page.keyboard.press('Enter');
  assert.equal((await page.evaluate(()=>window.__STILLLIGHT_PIXI__.state())).selected,0);
  assert.equal(await first.evaluate(b=>getComputedStyle(b).outlineStyle),'none');
  assert.equal(errors.length,0,errors.join('\n'));await context.close();
 }
 console.log('PASS vessel labels: both backends retain idle numbers, artwork occludes overlaps, free numbers stay visible, semantic keyboard controls remain');
});
