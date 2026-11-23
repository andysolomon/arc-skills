#!/usr/bin/env node
// arc-interaction: proves in a real browser what a Scene test can't see. A Scene has no DOM,
// so a Mount's body never runs there. This drives the running app with a real pointer.
//
//   CHROME_PATH=/usr/bin/chromium node scripts/browser-check.mjs http://127.0.0.1:4173
//
// Needs playwright-core (a devDependency, pinned exactly) and a Chromium at CHROME_PATH.
// It REMOVES EVERY NOTE and writes its own, so it only runs against a loopback address.
// Start the mock and the app first: `npm run mock` and `npm run dev`, or `npm run preview`.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const api = `${base}/api/notes`;
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)) {
  console.log(`FAIL ${base} is not a loopback address. This check removes every note, so it runs on local data only.`);
  process.exit(1);
}
if (!process.env.CHROME_PATH) { console.log('FAIL set CHROME_PATH to a Chromium or Chrome binary'); process.exit(1); }

// What the checks need to know about the gesture. Read from the app's one constants module.
const { DISMISS_DISTANCE_RATIO, DRAG_SLOP_PX, VELOCITY_WINDOW_MS } = await import('../src/interaction/constants.ts');
const PAUSE = VELOCITY_WINDOW_MS + 150; // long enough that a release counts as "at rest"

/** Replace the server's notes with these, top to bottom. */
const reset = async (texts) => {
  for (const note of await (await fetch(api)).json()) await fetch(`${api}/${encodeURIComponent(note.id)}`, { method: 'DELETE' });
  for (const text of [...texts].reverse()) {
    await fetch(api, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: `check-${text}`, text }) });
  }
};
const stored = async () => (await (await fetch(api)).json()).map((n) => n.text);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
let passed = 0;
const ok = (label) => { passed++; console.log(`ok  browser: ${label}`); };

/** A page on a fresh context, with its errors and its DELETE requests recorded. */
const open = async (options = {}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 700 }, colorScheme: 'dark', ...options });
  const page = await context.newPage();
  const errors = [];
  const removals = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on('request', (r) => r.method() === 'DELETE' && removals.push(decodeURIComponent(new URL(r.url()).pathname)));
  await page.goto(base);
  return { context, page, errors, removals };
};

// In-page helpers. A row is found by its note text; `part` is the swipe element or the list item.
const find = `(text, part) => {
  const li = [...document.querySelectorAll('.items > li')].find((el) => el.querySelector('.text')?.textContent === text);
  return li ? (part === 'li' ? li : li.querySelector('.swipe')) : null;
}`;
/** The element's translate on one axis right now, or null when it is not in the DOM. */
const offset = (page, text, part, axis) => page.evaluate(`(() => {
  const el = (${find})(${JSON.stringify(text)}, ${JSON.stringify(part)});
  if (!el) return null;
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return ${axis === 'x' ? 'm.m41' : 'm.m42'};
})()`);
/** The same value on every animation frame for `ms`. Start it before the action, await it after. */
const frames = (page, text, part, axis, ms) => page.evaluate(`new Promise((resolve) => {
  const out = []; const start = performance.now();
  const tick = () => {
    const el = (${find})(${JSON.stringify(text)}, ${JSON.stringify(part)});
    out.push(el ? (() => { const m = new DOMMatrixReadOnly(getComputedStyle(el).transform); return ${axis === 'x' ? 'm.m41' : 'm.m42'}; })() : null);
    if (performance.now() - start < ${ms}) requestAnimationFrame(tick); else resolve(out);
  };
  tick();
})`);
const top = (page, text) => page.evaluate(`(${find})(${JSON.stringify(text)}, 'li')?.getBoundingClientRect().top ?? null`);
const noSidewaysScroll = (page) => page.evaluate('document.documentElement.scrollWidth <= window.innerWidth');
/** The middle of a row's text, where a drag starts. */
const grip = async (page, text) => {
  const box = await page.locator('.items > li', { has: page.locator('.text', { hasText: new RegExp(`^${text}$`) }) }).locator('.swipe').boundingBox();
  return { x: box.x + 40, y: box.y + box.height / 2, width: box.width, height: box.height };
};
/** Press on a row and move sideways by `dx`. Returns where the pointer ended. The first step crosses the slop. */
const drag = async (page, text, dx, steps = 5) => {
  const from = await grip(page, text);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y, { steps });
  return { x: from.x + dx, y: from.y, width: from.width };
};

// 1. The row follows the pointer, a slow release springs back, and a second touch takes the spring over.
{
  await reset(['A', 'B', 'C', 'D', 'E']);
  const { context, page, errors, removals } = await open();
  await page.waitForSelector('.swipe');
  const topBefore = await top(page, 'B');
  const held = await drag(page, 'B', 100);
  assert.ok(held.width * DISMISS_DISTANCE_RATIO > 100, 'this check needs a row wide enough that 100 px is a short drag');
  const x = await offset(page, 'B', 'swipe', 'x');
  assert.ok(x > 100 - 2 * (100 / 5) - DRAG_SLOP_PX && x <= 100, `the row is at ${x} px, expected it near the pointer's 100 px`);
  assert.equal(await top(page, 'B'), topBefore, 'the row moved down or up while it was dragged sideways');
  assert.equal(await page.evaluate(`(${find})('B', 'swipe').hasAttribute('data-dragging')`), true);
  assert.ok(await noSidewaysScroll(page), 'a dragged row widened the page');
  ok(`the row follows the pointer (${Math.round(x)} px for a 100 px drag, less the slop) and the page does not scroll sideways`);

  await page.waitForTimeout(PAUSE);
  const sampling = frames(page, 'B', 'swipe', 'x', 1000);
  await page.mouse.up();
  const path = await sampling;
  assert.ok(path.some((v) => v > 2 && v < x - 2), `no frame between the release point and home: ${path.slice(0, 8).map(Math.round)}`);
  const settledAt = path.findIndex((v, i) => path.slice(i).every((w) => Math.abs(w) < 0.5));
  assert.ok(settledAt > 0, 'the row never settled at home within one second');
  assert.ok(['', 'none'].includes(await page.evaluate(`(${find})('B', 'swipe').style.transform`)), 'the resting row still carries a transform');
  assert.deepEqual(removals, [], 'a slow, short drag removed the note');
  assert.deepEqual(await stored(), ['A', 'B', 'C', 'D', 'E']);
  ok(`a slow drag springs back through ${path.filter((v) => v > 2).length} frames and removes nothing`);

  // A second touch while the spring is in flight.
  const again = await drag(page, 'B', 120);
  await page.waitForTimeout(PAUSE);
  const released = await offset(page, 'B', 'swipe', 'x');
  await page.mouse.up();
  await page.waitForTimeout(70);
  const before = await offset(page, 'B', 'swipe', 'x');
  await page.mouse.down(); // the pointer has not moved since the release
  const caught = await offset(page, 'B', 'swipe', 'x');
  await page.waitForTimeout(150);
  const stillThere = await offset(page, 'B', 'swipe', 'x');
  assert.ok(caught > 5 && caught < released, `the spring was not in flight when it was caught (${caught} px of ${released})`);
  assert.ok(caught <= before + 0.5 && before - caught < 40, `the row jumped from ${before} to ${caught} px when it was caught`);
  assert.ok(Math.abs(stillThere - caught) < 0.5, `the spring kept running under the finger: ${caught} then ${stillThere}`);
  await page.mouse.move(again.x + 30, again.y);
  const carried = await offset(page, 'B', 'swipe', 'x');
  assert.ok(Math.abs(carried - (caught + 30)) < 1, `after the catch the row should be at ${caught + 30} px, it is at ${carried}`);
  await page.waitForTimeout(PAUSE);
  await page.mouse.up();
  await page.waitForFunction(`['', 'none'].includes((${find})('B', 'swipe').style.transform)`, null, { timeout: 2000 });
  assert.deepEqual(removals, []);
  ok(`a second touch catches the spring at ${Math.round(caught)} px, holds it there, and the drag carries on from that point`);
  assert.deepEqual(errors, [], 'the page logged errors');
  await context.close();
}

// 2. A fast flick removes the note through the API, and the neighbours travel to their new places.
{
  await reset(['A', 'B', 'C', 'D', 'E']);
  const { context, page, errors, removals } = await open();
  await page.waitForSelector('.swipe');
  const [topC, topD] = [await top(page, 'C'), await top(page, 'D')];
  const from = await grip(page, 'C');
  const exit = frames(page, 'C', 'swipe', 'x', 600);
  const neighbour = frames(page, 'D', 'li', 'y', 1200);
  await page.mouse.move(from.x + 200, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 120, from.y, { steps: 4 }); // 80 px, then released while still moving
  await page.mouse.up();
  const exitPath = (await exit).filter((v) => v !== null);
  const neighbourPath = await neighbour;
  assert.ok(80 < from.width * DISMISS_DISTANCE_RATIO, 'this check needs 80 px to be a short drag, so only speed can dismiss');
  assert.ok(Math.min(...exitPath) < -from.width * 0.6, `the row did not fly off, it only reached ${Math.round(Math.min(...exitPath))} px`);
  await page.waitForFunction(`(${find})('C', 'li') === null`, null, { timeout: 2000 });
  assert.deepEqual(removals, ['/api/notes/check-C'], 'the removal did not go through the API once');
  await page.waitForFunction(async (url) => !(await (await fetch(url)).json()).some((n) => n.text === 'C'), api, { timeout: 3000 });
  ok(`a fast flick over 80 px sends the row off (to ${Math.round(Math.min(...exitPath))} px) and removes the note with one DELETE`);

  const moving = neighbourPath.filter((v) => v !== null && v > 1);
  assert.ok(moving.length >= 3, `the row below did not travel, its translateY was: ${neighbourPath.slice(0, 12).map((v) => Math.round(v ?? 0))}`);
  assert.ok(Math.max(...moving) <= topD - topC + 1, 'the row below started further away than one row');
  assert.ok(Math.abs(neighbourPath[neighbourPath.length - 1]) < 0.5, 'the row below did not come to rest');
  assert.ok(Math.abs((await top(page, 'D')) - topC) < 1, 'the row below did not end where the removed row was');
  ok(`the row below travels up ${Math.round(Math.max(...moving))} px over ${moving.length} frames and rests where the removed row was`);

  // Adding a note pushes the rows down, and they travel too.
  const pushed = frames(page, 'A', 'li', 'y', 1200);
  await page.getByLabel('Note', { exact: true }).fill('F');
  await page.getByRole('button', { name: 'Add' }).click(); // waits until the button is enabled, one frame after typing
  const pushedPath = await pushed;
  assert.ok(pushedPath.filter((v) => v < -1).length >= 3, `the first row did not travel down when a note was added: ${pushedPath.slice(0, 12).map(Math.round)}`);
  assert.ok(Math.abs(pushedPath[pushedPath.length - 1]) < 0.5);
  ok('adding a note moves the rows down to make room');
  assert.deepEqual(errors, []);
  await context.close();
}

// 3. The keyboard path, and a drag that starts on the button.
{
  await reset(['A', 'B', 'C']);
  const { context, page, errors, removals } = await open();
  await page.waitForSelector('.swipe');
  for (const height of await page.locator('.items button').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) {
    assert.ok(height >= 44, `a row button is ${height} px tall`);
  }
  assert.equal(await page.evaluate(`getComputedStyle((${find})('A', 'swipe')).touchAction`), 'pan-y');
  ok('each row has a labelled Remove button at least 44 px tall, and the row sets touch-action: pan-y');

  // A press on the button that is dragged a little is a drag, so it must not end as a click.
  const button = await page.getByRole('button', { name: 'Remove A' }).boundingBox();
  await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
  await page.mouse.down();
  await page.mouse.move(button.x + button.width / 2 - 30, button.y + button.height / 2, { steps: 3 });
  await page.waitForTimeout(PAUSE);
  await page.mouse.up();
  await page.waitForTimeout(600);
  assert.deepEqual(removals, [], 'a drag that began on the Remove button removed the note');
  ok('a short drag that starts on the Remove button springs back and does not click it');

  // A press that leaves the row before it becomes a drag never sends its pointerup to the row.
  const lost = await grip(page, 'C');
  await page.mouse.move(lost.x, lost.y);
  await page.mouse.down();
  await page.mouse.move(lost.x + 2, lost.y + 200, { steps: 3 });
  await page.mouse.up();
  await drag(page, 'C', 60);
  const afterLost = await offset(page, 'C', 'swipe', 'x');
  assert.ok(afterLost > 20, `after a press that ended outside the row, the row no longer follows (${afterLost} px)`);
  await page.waitForTimeout(PAUSE);
  await page.mouse.up();
  await page.waitForTimeout(600);
  assert.deepEqual(removals, []);
  ok('a press that ends outside the row does not leave the row deaf to the next swipe');

  await page.getByRole('button', { name: 'Remove B' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(`(${find})('B', 'li') === null`, null, { timeout: 2000 });
  assert.deepEqual(removals, ['/api/notes/check-B']);
  ok('the keyboard removes a note with no gesture: focus Remove, press Enter');
  assert.deepEqual(errors, []);
  await context.close();
}

// 4. Reduced motion: the row still follows the finger, and the release ends at once.
{
  await reset(['A', 'B', 'C', 'D', 'E']);
  const { context, page, errors, removals } = await open({ reducedMotion: 'reduce' });
  await page.waitForSelector('.swipe');
  await drag(page, 'B', 100);
  const x = await offset(page, 'B', 'swipe', 'x');
  assert.ok(x > 50 && x <= 100, `under reduced motion the row should still follow the pointer, it is at ${x} px`);
  await page.waitForTimeout(PAUSE);
  const sampling = frames(page, 'B', 'swipe', 'x', 400);
  await page.mouse.up();
  const path = await sampling;
  const after = path.slice(path.findIndex((v) => Math.abs(v) < 0.5));
  assert.ok(path.every((v) => Math.abs(v) < 0.5 || v > x - 1), `under reduced motion the row was drawn part of the way home: ${path.slice(0, 8).map(Math.round)}`);
  assert.ok(after.length > 0 && after.every((v) => Math.abs(v) < 0.5));
  ok('reduced motion: the row follows the pointer, and a slow release puts it home with no frame in between');

  const [topC] = [await top(page, 'C')];
  const from = await grip(page, 'C');
  const exit = frames(page, 'C', 'swipe', 'x', 500);
  const neighbour = frames(page, 'D', 'li', 'y', 800);
  await page.mouse.move(from.x + 200, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 120, from.y, { steps: 4 });
  await page.mouse.up();
  const exitPath = (await exit).filter((v) => v !== null);
  const neighbourPath = (await neighbour).filter((v) => v !== null);
  await page.waitForFunction(`(${find})('C', 'li') === null`, null, { timeout: 2000 });
  assert.deepEqual(removals, ['/api/notes/check-C']);
  assert.ok(exitPath.every((v) => v > -81 || v < -from.width), `under reduced motion the row was drawn flying off: ${exitPath.map(Math.round)}`);
  assert.ok(neighbourPath.every((v) => Math.abs(v) < 0.5), `under reduced motion the row below was animated: ${neighbourPath.slice(0, 8).map(Math.round)}`);
  assert.ok(Math.abs((await top(page, 'D')) - topC) < 1);
  ok('reduced motion: a flick still removes the note, with no fly-off frames and no layout animation');
  assert.deepEqual(errors, []);
  await context.close();
}

// 5. The empty-state figure draws, is labelled, follows the theme, and rests under reduced motion.
{
  await reset([]);
  const read = async (options) => {
    const { context, page, errors } = await open(options);
    await page.waitForSelector('.figure svg');
    const seen = await page.evaluate(() => {
      const host = document.querySelector('.figure');
      const probe = document.body.appendChild(document.createElement('span'));
      const token = (name) => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color; };
      const tokens = { bg: token('--bg'), fg: token('--fg'), dim: token('--dim'), line: token('--line') };
      probe.remove();
      const shapes = [...host.querySelectorAll('svg *')].map((el) => getComputedStyle(el));
      return {
        tokens, role: host.getAttribute('role'), label: host.getAttribute('aria-label'), width: host.getBoundingClientRect().width,
        strokes: [...new Set(shapes.map((s) => s.stroke))], fills: [...new Set(shapes.map((s) => s.fill))]
      };
    });
    const before = await page.evaluate(() => document.querySelector('.figure svg').innerHTML);
    const box = await page.locator('.figure').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3, { steps: 4 });
    await page.waitForTimeout(500);
    const answered = before !== (await page.evaluate(() => document.querySelector('.figure svg').innerHTML));
    assert.deepEqual(errors, []);
    await context.close();
    return { ...seen, answered };
  };
  const dark = await read({ colorScheme: 'dark' });
  const light = await read({ colorScheme: 'light' });
  const reduced = await read({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const [name, f] of [['dark', dark], ['light', light]]) {
    assert.equal(f.role, 'img');
    assert.equal(f.label, 'An empty drawer');
    for (const t of ['fg', 'dim', 'line']) assert.ok(f.strokes.includes(f.tokens[t]), `${name}: no line is drawn in --${t} (${f.tokens[t]}); strokes are ${f.strokes}`);
    assert.ok(f.fills.includes(f.tokens.bg), `${name}: no plate is filled with --bg (${f.tokens.bg})`);
  }
  assert.notEqual(dark.tokens.fg, light.tokens.fg, 'dark and light gave the same token, so the theme was not exercised');
  assert.ok(dark.width <= 240 && dark.width >= 160, `the figure is ${dark.width} px wide`);
  ok(`the figure draws with role img and a label, in the app's tokens: lines ${dark.tokens.fg} on ${dark.tokens.bg} in dark, ${light.tokens.fg} on ${light.tokens.bg} in light`);
  assert.equal(dark.answered, true, 'the figure did not answer the pointer, so it may not be mounted');
  assert.equal(reduced.answered, false, 'under reduced motion the figure still moved under the pointer');
  ok('the figure answers the pointer, and rests under reduced motion');
}

// 6. Touch: a vertical pan scrolls the page and leaves the row alone; a sideways pan moves the row.
{
  await reset(Array.from({ length: 16 }, (_, i) => `T${i + 1}`));
  const { context, page, errors } = await open({ viewport: { width: 390, height: 500 }, hasTouch: true, isMobile: true });
  await page.waitForSelector('.swipe');
  const cdp = await context.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const from = await grip(page, 'T3');
  await page.evaluate(`window.__cancelled = 0; (${find})('T3', 'swipe').addEventListener('pointercancel', () => window.__cancelled++)`);
  await touch('touchStart', from.x, from.y);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', from.x, from.y - i * 15); await page.waitForTimeout(16); }
  const during = await offset(page, 'T3', 'swipe', 'x');
  await touch('touchEnd');
  await page.waitForTimeout(300);
  const scrolled = await page.evaluate('window.scrollY');
  assert.ok(scrolled > 50, `a vertical touch pan over a row scrolled the page by only ${scrolled} px`);
  assert.equal(during, 0, 'the row moved sideways during a vertical pan');
  assert.ok((await page.evaluate('window.__cancelled')) >= 1, 'the browser did not take the pointer for the scroll');

  await page.evaluate('window.scrollTo(0, 0)');
  await page.waitForTimeout(100);
  const again = await grip(page, 'T3');
  await touch('touchStart', again.x, again.y);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', again.x + i * 10, again.y); await page.waitForTimeout(16); }
  await page.waitForTimeout(PAUSE);
  const held = await offset(page, 'T3', 'swipe', 'x');
  assert.ok(held > 40 && held <= 80, `a sideways touch pan should move the row, it is at ${held} px`);
  assert.equal(await page.evaluate('window.scrollY'), 0, 'a sideways touch pan scrolled the page');
  await touch('touchEnd');
  await page.waitForFunction(`['', 'none'].includes((${find})('T3', 'swipe').style.transform)`, null, { timeout: 2000 });
  assert.equal((await stored()).length, 16);
  ok(`touch: a vertical pan scrolls the page ${Math.round(scrolled)} px and the row stays put; a sideways pan moves the row ${Math.round(held)} px and the page stays put`);
  assert.deepEqual(errors, []);
  await context.close();
}

await browser.close();
console.log(`ok  browser: ${passed} checks passed against ${base}`);
