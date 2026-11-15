import { app, BrowserWindow } from 'electron';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Run against an isolated preview database, with preview credentials in the environment.
const base = process.env.ACADEX_PREVIEW_URL || 'http://127.0.0.1:3002';
const wait = ms => new Promise(done => setTimeout(done, ms));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 1000, useContentSize: true, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: true } });
  const evaluate = source => win.webContents.executeJavaScript(source);
  const ready = async selector => {
    for (let i = 0; i < 60; i++) {
      if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
      await wait(200);
    }
    throw new Error('Timed out waiting for ' + selector);
  };
  try {
    await win.loadURL(base + '/login');
    const login = { method: 'admin', username: process.env.ACADEX_PREVIEW_USER, password: process.env.ACADEX_PREVIEW_PASSWORD };
    assert.ok(login.username && login.password, 'Set preview credentials');
    await evaluate(`fetch('/api/auth/login', {method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify(${JSON.stringify(login)})}).then(r => { if (!r.ok) throw new Error('Preview login failed'); })`);
    await evaluate("localStorage.removeItem('acadex-ambient-paused')");
    await win.loadURL(base + '/');
    await ready('.progress-orbit__ring');
    // The hero light intentionally rests for the first 15% of its 14s cycle.
    await wait(3200);
    const sample = () => evaluate(`({
      light: getComputedStyle(document.querySelector('.ambient-light')).transform,
      orbit: getComputedStyle(document.querySelector('.progress-orbit__ring'), '::after').transform,
      shine: getComputedStyle(document.querySelector('.home-hero'), '::before').transform
    })`);
    const first = await sample(); await wait(500); const second = await sample();
    for (const key of Object.keys(first)) assert.notEqual(first[key], second[key], key + ' should move');
    await evaluate("document.querySelector('.effects-toggle').click()"); await wait(100);
    const paused = await sample(); await wait(500);
    assert.deepEqual(await sample(), paused, 'All decorative effects pause');
    await win.loadURL(base + '/'); await ready('.progress-orbit__ring');
    assert.equal(await evaluate("document.querySelector('.effects-toggle').getAttribute('aria-label')"), 'Resume ambient effects');
    await evaluate("document.querySelector('.effects-toggle').click()");
    for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
      win.setContentSize(width, height); await wait(400);
      assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), name + ' has no horizontal overflow');
      await writeFile(resolve('artifacts', 'acadex-motion-' + name + '.png'), (await win.webContents.capturePage()).toPNG());
    }
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await wait(300);
    const reduced = await evaluate(`({
      light: getComputedStyle(document.querySelector('.ambient-light')).animationName,
      orbit: getComputedStyle(document.querySelector('.progress-orbit__ring'), '::after').display,
      toggle: getComputedStyle(document.querySelector('.effects-toggle')).display
    })`);
    assert.deepEqual(reduced, { light: 'none', orbit: 'none', toggle: 'none' });
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
    await evaluate("document.querySelector('.mobile-dock a[href=\"/quiz\"]').click()");
    await ready('[data-page="/quiz"]');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.ambient-light')).animationPlayState"), 'paused');
    console.log('PASS: motion advances, pause freezes all effects and persists, reduced motion disables effects, quiz pauses background, 390/768/1440px layouts fit.');
  } catch (error) { console.error(error); win.destroy(); app.exit(1); return; }
  win.destroy(); app.quit();
});
