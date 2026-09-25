import { spawn } from 'node:child_process';
import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const exists = async p => { try { await access(p); return true; } catch { return false; } };

export async function resolveChromiumExecutable() {
  const attempted = [];
  const candidates = [];
  if (process.env.CHROMIUM_PATH) candidates.push(process.env.CHROMIUM_PATH);
  try { candidates.push(chromium.executablePath()); } catch {}
  if (process.platform === 'win32') {
    for (const base of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]) {
      if (base) candidates.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else {
    candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/microsoft-edge');
  }
  for (const candidate of [...new Set(candidates.filter(Boolean))]) {
    attempted.push(candidate);
    if (await exists(candidate)) return candidate;
  }
  throw new Error(`Chromium unavailable. Set CHROMIUM_PATH to Chrome/Edge/Chromium. Attempted: ${attempted.join(', ') || '(none)'}`);
}

export async function withVerificationHarness(options, fn) {
  const artifactsRoot = path.join(root, 'artifacts', 'verification');
  await mkdir(artifactsRoot, { recursive: true });
  let server = null, browser = null;
  try {
    let baseURL = process.env.STILLLIGHT_URL;
    if (!baseURL) {
      baseURL = 'http://127.0.0.1:5179';
      server = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let startupOutput = '';
      server.stdout.on('data', b => startupOutput += b.toString());
      server.stderr.on('data', b => startupOutput += b.toString());
      const deadline = Date.now() + 20000;
      let ready = false;
      while (Date.now() < deadline && !ready) {
        if (server.exitCode !== null) throw new Error(`Vite setup failed (exit ${server.exitCode}): ${startupOutput}`);
        try { const response = await fetch(baseURL); ready = response.ok; } catch {}
        if (!ready) await new Promise(r => setTimeout(r, 200));
      }
      if (!ready) throw new Error(`Vite setup timed out or port 5179 is unavailable. ${startupOutput}`);
    } else {
      try { const response = await fetch(baseURL); if (!response.ok) throw new Error(`HTTP ${response.status}`); }
      catch (error) { throw new Error(`STILLLIGHT_URL is unavailable (${baseURL}): ${error.message}`); }
    }
    const executablePath = await resolveChromiumExecutable();
    browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const harness = {
      baseURL, browser, artifactsRoot,
      artifactDir: async name => { const dir = path.join(artifactsRoot, name); await mkdir(dir, { recursive: true }); return dir; },
      newIsolatedPage: async ({ width = 400, height = 620, dpr = 1, initScripts = [] } = {}) => {
        const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
        for (const script of initScripts) await context.addInitScript(script);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
        page.on('console', msg => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
        return { context, page, errors };
      },
      setDeviceMetrics: async (page, { width, height, dpr }) => {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false });
        return cdp;
      },
      goto: async (page, suffix = '/') => page.goto(`${baseURL.replace(/\/$/, '')}${suffix}`, { waitUntil: 'networkidle', timeout: 20000 }),
    };
    return await fn(harness);
  } catch (error) {
    if (options?.setupFailureAsThrow) throw error;
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) { server.kill(); }
  }
}

export { root as repositoryRoot };
