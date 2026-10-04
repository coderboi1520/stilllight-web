import assert from 'node:assert/strict';
import {withVerificationHarness} from './browser-harness.mjs';
if(!process.env.STILLLIGHT_URL)throw new Error('Set STILLLIGHT_URL to a running vite preview of npm run build.');
const disableWebGL=()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(['webgl','webgl2','experimental-webgl'].includes(type))return null;return get.call(this,type,...args);};};
await withVerificationHarness({},async h=>{
 const dir=await h.artifactDir('ordinary');
 for(const backend of ['webgl','canvas']){
  const {page,context,errors}=await h.newIsolatedPage({width:400,height:889,initScripts:backend==='canvas'?[disableWebGL]:[]});
  let release;const blocked=new Promise(resolve=>{release=resolve;});
  await page.route('**/assets/pumpkin-cap.png',async route=>{await blocked;await route.continue();});
  await page.goto(h.baseURL,{waitUntil:'domcontentloaded'});assert.match(await page.locator('script[type="module"]').getAttribute('src'),/^\/assets\//,'verify the built bundle, not the development server');
  await page.locator('[data-glass="0"]').click();await page.locator('[data-glass="1"]').click();release();
  await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__,{},{timeout:5000});
  assert.equal(await page.locator('[data-glass]').count(),6);assert.equal(await page.evaluate(()=>window.__STILLLIGHT_PIXI__.backend()),backend);
  const state=()=>page.evaluate(()=>window.__STILLLIGHT_PIXI__.state());
  const initial=(await state()).board;
  assert.equal((await state()).selected,null,'input while assets initialize is safely ignored');
  await h.gotoGame(page);
  await page.getByRole('button',{name:'Hint',exact:true}).click();assert.deepEqual((await state()).board,initial);await page.waitForTimeout(750);
  await page.locator('[data-glass="0"]').click();await page.locator('[data-glass="1"]').click();await page.waitForTimeout(1800);
  assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).isEnabled(),true);await page.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForTimeout(650);
  assert.deepEqual((await state()).board,initial);
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Haptics',exact:true}).click();await page.reload();await page.waitForFunction(()=>!!window.__STILLLIGHT_PIXI__,{},{timeout:5000});await page.getByRole('button',{name:'Settings',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Haptics',exact:true}).getAttribute('aria-pressed'),'false');
  assert.equal(errors.length,0,errors.join('\n'));await page.screenshot({path:`${dir}/production-${backend}-400x889.png`});await context.close();
  console.log(`PASS production ${backend}: startup/early input, six-vessel scene, Hint, real pointer pour, exact Undo, preference reload, no browser errors`);
 }
});
