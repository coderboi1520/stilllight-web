import { performance } from 'node:perf_hooks';
import { withVerificationHarness } from './browser-harness.mjs';
import { makeResult } from './result-utils.mjs';

export async function run(harness) {
  const started = performance.now(), name = 'VIEWPORT_DPR';
  let pageCtx, dir, artifacts = [];
  try {
    dir = await harness.artifactDir('viewport-dpr');
    const inspect = page => page.evaluate(() => {
      const board = document.querySelector('.board').getBoundingClientRect(), canvas = document.querySelector('#pixi-host canvas');
      const rect = canvas.getBoundingClientRect();
      return { board: [board.width, board.height], css: [rect.width, rect.height], backing: [canvas.width, canvas.height], dpr: devicePixelRatio };
    });
    const cases = [];
    for (const [width, height, dpr, label] of [[400,620,1,'portrait-1x'],[320,496,2,'portrait-2x'],[620,400,1,'landscape']]) {
      const isolated=await harness.newIsolatedPage({width,height,dpr}), testPage=isolated.page;
      await harness.gotoGame(testPage); await testPage.waitForSelector('#pixi-host canvas');
      const seen = await inspect(testPage); cases.push({ label, ...seen });
      if (Math.abs(seen.css[0]-seen.board[0])>1 || Math.abs(seen.css[1]-seen.board[1])>1) throw new Error(`${label}: board/canvas CSS mismatch ${JSON.stringify(seen)}`);
      if (seen.backing[0] !== Math.round(seen.css[0]*Math.min(dpr,2)) || seen.backing[1] !== Math.round(seen.css[1]*Math.min(dpr,2))) throw new Error(`${label}: backing/DPR mismatch ${JSON.stringify(seen)}`);
      if (seen.dpr !== dpr) throw new Error(`${label}: expected DPR ${dpr}, got ${seen.dpr}`);
      await isolated.context.close();
    }
    pageCtx=await harness.newIsolatedPage({width:400,height:620,dpr:1});
    const {page,errors}=pageCtx; await harness.gotoGame(page); await page.waitForSelector('#pixi-host canvas');
    // Same-DPR change on one live page.
    let metrics = await harness.setDeviceMetrics(page, { width: 400,height:620,dpr:1 }); await page.waitForTimeout(150); await metrics.detach();
    metrics = await harness.setDeviceMetrics(page, { width: 360,height:558,dpr:1 }); await page.waitForTimeout(200); await metrics.detach();
    const resized = await inspect(page); cases.push({ label:'same-dpr-live-resize', ...resized });
    await page.locator('[data-glass="0"]').click();
    const selected = await page.evaluate(() => window.__STILLLIGHT_PIXI__.state().selected);
    if (selected !== 0) throw new Error(`hit alignment/select failed: selected=${selected}`);
    metrics = await harness.setDeviceMetrics(page, { width: 320,height:496,dpr:1 }); await page.waitForTimeout(200); await metrics.detach();
    const before = await inspect(page);
    await page.evaluate(() => { const query=matchMedia('(resolution: 1dppx)'); window.__dprNotification={initial:query.matches,changes:[],resizes:0};query.addEventListener('change',event=>window.__dprNotification.changes.push({matches:event.matches,dpr:devicePixelRatio}));window.addEventListener('resize',()=>window.__dprNotification.resizes++); });
    metrics = await harness.setDeviceMetrics(page, { width: 320,height:496,dpr:2 }); await page.waitForTimeout(300);
    const after = await inspect(page);
    const notification=await page.evaluate(()=>({...window.__dprNotification,query1:matchMedia('(resolution: 1dppx)').matches,query2:matchMedia('(resolution: 2dppx)').matches}));
    await page.locator('[data-glass="0"]').click(); await page.locator('[data-glass="1"]').click();
    const selectedAfter=await page.evaluate(()=>window.__STILLLIGHT_PIXI__.state().selected);
    const picture=await page.screenshot({ path: `${dir}/dpr-live-change-fail.png` }); artifacts.push(`${dir}/dpr-live-change-fail.png`);
    const painted=await page.evaluate(async png=>{const image=new Image();image.src=png;await image.decode();const copy=document.createElement('canvas');copy.width=image.width;copy.height=image.height;const context=copy.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,0,copy.width,copy.height).data;let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>45||pixels[i+1]>55||pixels[i+2]>65)count++;return count},`data:image/png;base64,${picture.toString('base64')}`);
    await metrics.detach();
    if (errors.length) throw Object.assign(new Error(errors.join('; ')), { artifacts });
    if (!notification.initial || !notification.changes.some(change=>change.matches===false&&change.dpr===2) || notification.query1 || !notification.query2) throw Object.assign(new Error(`DPR notification path failed: ${JSON.stringify(notification)}`), { artifacts });
    if(selectedAfter!==1||painted===0)throw Object.assign(new Error(`DPR scene/hit failure: selected=${selectedAfter}, painted=${painted}`),{artifacts});
    // A live DPR change must rebuild the backing store for the new effective density.
    if (after.backing[0] !== Math.round(after.css[0]*2) || after.backing[1] !== Math.round(after.css[1]*2) || (after.dpr === 2 && after.backing[0] === before.backing[0] && after.backing[1] === before.backing[1])) throw Object.assign(new Error(`DPR_LIVE_CHANGE: FAIL\nbefore: ${JSON.stringify(before)}\nafter: ${JSON.stringify(after)}\nnotification: ${JSON.stringify(notification)}\npage errors: ${errors.join('; ')||'none'}`), { artifacts });
    return makeResult(name,'PASS',started,`cases=${JSON.stringify(cases)}; after=${JSON.stringify(after)}`,artifacts);
  } catch (error) { return makeResult(name,'FAIL',started,error.message,error.artifacts ?? artifacts); }
  finally { await pageCtx?.context.close().catch(()=>{}); }
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\','/')}`).href) {
  try { const result=await withVerificationHarness({},run); console.log(`${result.status} ${result.name}: ${result.details??''}`); if(result.status==='FAIL')process.exitCode=1; }
  catch(error){console.error(`SETUP FAIL: ${error.message}`);process.exitCode=1;}
}
