import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { withVerificationHarness } from './browser-harness.mjs';
import { makeResult } from './result-utils.mjs';

const digest = buffer => createHash('sha256').update(buffer).digest('hex');

export async function run(harness) {
  const started = performance.now(), name = 'PARITY_FREEZE';
  let item; const artifacts = [];
  try {
    const dir = await harness.artifactDir('parity-freeze');
    item = await harness.newIsolatedPage();
    const { page, errors } = item;
    await harness.goto(page);
    await page.waitForSelector('#pixi-host canvas');

    async function check(label, action, presentedAt, expectPresented, expectNext) {
      const first = await page.evaluate(({ action, presentedAt }) => {
        const app = window.__STILLLIGHT_PIXI__;
        app.action('reset', 900);
        app.action(action, 1000);
        app.step(presentedAt);
        return { state: app.state(), frame: app.lastFrame() };
      }, { action, presentedAt });
      if (!expectPresented(first)) throw new Error(`${label}: incorrect boundary presentation`);
      const canvas = page.locator('#pixi-host canvas');
      const original = await page.evaluate(() => { const c = document.querySelector('#pixi-host canvas'); return [c.width, c.height]; });
      const before = await canvas.screenshot();
      const painted = await page.evaluate(async png => { const image = new Image(); image.src = png; await image.decode(); const copy = document.createElement('canvas'); copy.width = image.width; copy.height = image.height; const context = copy.getContext('2d'); context.drawImage(image, 0, 0); const pixels = context.getImageData(0, 0, copy.width, copy.height).data; let count = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 45 || pixels[i + 1] > 55 || pixels[i + 2] > 65) count++; return count; }, `data:image/png;base64,${before.toString('base64')}`);
      if (painted === 0) throw new Error(`${label}: blank presented scene`);
      await page.setViewportSize({ width: 320, height: 496 });
      await page.waitForFunction(([w, h]) => { const c = document.querySelector('#pixi-host canvas'); return c.width !== w || c.height !== h; }, original);
      await page.setViewportSize({ width: 400, height: 620 });
      await page.waitForFunction(([w, h]) => { const c = document.querySelector('#pixi-host canvas'); return c.width === w && c.height === h; }, original);
      const second = await page.evaluate(() => { const app = window.__STILLLIGHT_PIXI__; return { state: app.state(), frame: app.lastFrame() }; });
      const after = await canvas.screenshot();
      if (JSON.stringify(first) !== JSON.stringify(second) || digest(before) !== digest(after)) {
        throw new Error(`${label}: presented frame changed on resize invalidation; data=${JSON.stringify(first) === JSON.stringify(second) ? 'stable' : 'changed'}, image=${digest(before) === digest(after) ? 'stable' : 'changed'}`);
      }
      const next = await page.evaluate(now => { const app = window.__STILLLIGHT_PIXI__; app.step(now); return { state: app.state(), frame: app.lastFrame() }; }, presentedAt + 1);
      if (!expectNext(next)) throw new Error(`${label}: next explicit step did not expose transition`);
      const path = `${dir}/${label}.png`;
      await page.screenshot({ path }); artifacts.push(path);
      return digest(before);
    }

    const mid = await check('mid-pour', 'pour', 1450,
      x => x.state.busy && x.frame.glasses.some(g => g.moving),
      x => x.state.busy && x.frame.glasses.some(g => g.moving));
    const hintBefore = await check('hint-before-expiry', 'hint', 1679,
      x => x.frame.glasses[0].hintRole === 'source' && x.frame.glasses[1].hintRole === 'target' && x.frame.glasses.every(g => g.hintStrength > 0 && g.hintStrength < 1),
      x => x.frame.glasses.every(g => g.hintRole === null && g.hintStrength === 0));
    const hint = await check('hint-expiry', 'hint', 1680,
      x => x.frame.glasses.every(g => g.hintRole === null && g.hintStrength === 0),
      x => x.frame.glasses.every(g => g.hintRole === null && g.hintStrength === 0));
    const pour = await check('pour-completion', 'pour', 2040,
      x => !x.state.busy && x.frame.glasses.some(g => g.moving),
      x => !x.state.busy && x.frame.glasses.every(g => !g.moving));
    if (errors.length) throw new Error(errors.map(e => e.split('\n')[0]).join('; '));
    return makeResult(name, 'PASS', started, `mid=${mid}; hint-before=${hintBefore}; hint=${hint}; pour=${pour}; resize invalidation and next-step transitions stable`, artifacts);
  } catch (error) { return makeResult(name, 'FAIL', started, error.message, artifacts); }
  finally { await item?.context.close().catch(() => {}); }
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  try { const result = await withVerificationHarness({}, run); console.log(`${result.status} ${result.name}: ${result.details ?? ''}`); if (result.status === 'FAIL') process.exitCode = 1; }
  catch (error) { console.error(`SETUP FAIL: ${error.message}`); process.exitCode = 1; }
}
