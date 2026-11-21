import { app, BrowserWindow } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
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
    await win.loadURL(base + '/'); await ready('.desk');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.route-reveal')).animationName"), 'glass-settle');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.star-trace')).animationName"), 'trace-ink');
    await evaluate(`document.querySelector('[aria-label="Next atlas plate"]').click()`);
    await ready('.atlas-picture text');
    assert.equal(await evaluate("document.querySelector('.atlas-caption strong').textContent"), 'The Summer Triangle');
    if (await evaluate("document.querySelector('.wallpaper-control').getAttribute('aria-label') === 'Resume background motion'")) {
      await evaluate("document.querySelector('.wallpaper-control').click()");
    }
    const meadowPosition = () => evaluate("JSON.stringify(Array.from(document.querySelectorAll('.meadow-scene > span'), el => getComputedStyle(el).transform))");
    const moving = await meadowPosition(); await wait(1000);
    assert.notEqual(await meadowPosition(), moving, 'The live wallpaper moves');
    await evaluate("document.querySelector('.wallpaper-control').click()"); await wait(80);
    const paused = await meadowPosition(); await wait(250);
    assert.equal(await meadowPosition(), paused, 'Pause holds the current frame');
    await win.loadURL(base + '/'); await ready('.desk');
    assert.equal(await evaluate("document.querySelector('.wallpaper-control').getAttribute('aria-label')"), 'Resume background motion');
    await evaluate("document.querySelector('.wallpaper-control').click()");
    await mkdir('artifacts', { recursive: true });
    for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
      win.setContentSize(width, height); await wait(400);
      assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), name + ' has no horizontal overflow');
      await writeFile(resolve('artifacts', 'acadex-motion-' + name + '.png'), (await win.webContents.capturePage()).toPNG());
    }
    await evaluate(`document.querySelector('.mobile-dock a[href="/leaderboard"]').click()`);
    await ready('[data-page="/leaderboard"]');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.mobile-dock [aria-current=page]'),'::after').animationName"), 'catchlight');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.route-reveal')).animationName"), 'glass-settle');
    await evaluate(`document.querySelector('.mobile-dock a[href="/"]').click()`);
    await ready('.desk');
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await wait(300);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.route-reveal')).animationName"), 'none');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.star-trace')).animationName"), 'none');
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.meadow-scene > span')).every(el => getComputedStyle(el).animationName === 'none')"), true);
    await evaluate("document.querySelector('.mobile-dock a[href=\"/quiz\"]').click()");
    await ready('[data-page="/quiz"]');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.mobile-dock [aria-current=page]'),'::after').animationName"), 'none');
    console.log('PASS: responsive desk, tab turn, reduced motion, mobile navigation.');
  } catch (error) { console.error(error); win.destroy(); app.exit(1); return; }
  win.destroy(); app.quit();
});
