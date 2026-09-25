import { performance } from 'node:perf_hooks';
import { withVerificationHarness } from './browser-harness.mjs';
import { makeResult } from './result-utils.mjs';

export async function run(harness) {
  const started=performance.now(), name='CONTEXT_RESTORE'; let item, artifacts=[];
  try {
    const dir=await harness.artifactDir('context-restore'); item=await harness.newIsolatedPage(); const {page,errors}=item;
    await harness.goto(page); await page.waitForSelector('#pixi-host canvas'); await page.waitForTimeout(250);
    const result=await page.evaluate(async()=>{
      const canvas=document.querySelector('#pixi-host canvas');const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
      if(!gl)return{unsupported:true}; const ext=gl.getExtension('WEBGL_lose_context');if(!ext)return{unsupported:true};
      const app=window.__STILLLIGHT_PIXI__;app.action('pour',1000);app.step(1450);const state=JSON.stringify(app.state()),frame=JSON.stringify(app.lastFrame());
      const timeout=label=>new Promise((_,reject)=>setTimeout(()=>reject(new Error(`timed out waiting for ${label}`)),4000));const lost=new Promise(resolve=>canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();resolve('lost')},{once:true}));const restored=new Promise(resolve=>canvas.addEventListener('webglcontextrestored',()=>resolve('restored'),{once:true}));
      ext.loseContext();await Promise.race([lost,timeout('webglcontextlost')]);await new Promise(r=>setTimeout(r,150));ext.restoreContext();await Promise.race([restored,timeout('webglcontextrestored')]);await new Promise(r=>setTimeout(r,500));
      return{state,frame,stateAfter:JSON.stringify(app.state()),frameAfter:JSON.stringify(app.lastFrame()),lost:true,restored:true,lostAfter:gl.isContextLost()};
    });
    if(result.unsupported)return makeResult(name,'SKIPPED',started,'WEBGL_lose_context unavailable');
    await page.screenshot({path:`${dir}/restored.png`});artifacts.push(`${dir}/restored.png`);
    if(result.state!==result.stateAfter||result.frame!==result.frameAfter||result.lostAfter||errors.length)throw Object.assign(new Error(`restore mismatch ${JSON.stringify(result)} errors=${errors.join('; ')}`),{artifacts});
    return makeResult(name,'PASS',started,'context lost and restored; state preserved; context usable',artifacts);
  }catch(error){return makeResult(name,'FAIL',started,error.message,error.artifacts??artifacts)}finally{await item?.context.close().catch(()=>{})}
}
if(process.argv[1]&&import.meta.url===new URL(`file:///${process.argv[1].replaceAll('\\','/')}`).href){try{const r=await withVerificationHarness({},run);console.log(`${r.status} ${r.name}: ${r.details??''}`);if(r.status==='FAIL')process.exitCode=1}catch(e){console.error(`SETUP FAIL: ${e.message}`);process.exitCode=1}}
