#!/usr/bin/env node
// Capture one pose of a Hairline figure as a static SVG for the kit's `hairline` shell. The
// figure's page (hairline-<name>.html, from the hairline-create skill) is opened in headless
// Chrome, held still, and its <svg> copied out with ids prefixed and a title and desc added.
// No script ships: the page's CSS gives the strokes their colours (see the kit's hairline block).
//
//   node hairline.mjs --page hairline-funnel.html --slug funnel \
//                     --title "Sales funnel" --desc "Four trays step down, each narrower ..." \
//                     [--at 220,120] [--hairline <hairline-create dir>] --out <dir>/funnel.svg
//
// --page      the figure's built page, hairline-<name>.html.
// --slug      prefixes every id (<slug>-…) and names the title and desc ids.
// --title     a short name for the figure: the svg's <title>.
// --desc      one sentence on what the pose shows: the svg's <desc>.
// --at        a viewBox point (400 x 320) to hold the pointer on, so the pose shows the figure
//             answering. Take it from look.mjs, which prints one for --answer. Without it, the
//             rest pose is captured: rest is the figure's thumbnail (Hairline's rule 05).
// --hairline  the installed hairline-create skill folder. playwright-core and the browser come
//             from its look.mjs, so this script has no dependencies of its own. Default:
//             ~/.claude/skills/hairline-create, then ~/.agents/skills/hairline-create.
// --out       writes the <svg> there. Prints the read-out, the size and warnings to stderr.
// Needs Chrome, or the Chromium of the playwright-core that look.mjs installs. Exits 2 on bad
// input or a failed capture, with the reason on stderr.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  const src = readFileSync(new URL(import.meta.url), 'utf8');
  process.stdout.write(src.split('\n').slice(1).filter(l => l.startsWith('//')).map(l => l.replace(/^\/\/ ?/, '')).join('\n') + '\n');
  process.exit(argv.length ? 0 : 2);
}
const die = msg => { process.stderr.write(`hairline.mjs: ${msg}\n`); process.exit(2); };
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) die(`--${name} needs a value`);
  return v;
};
const need = name => opt(name) ?? die(`--${name} is required`);

const page = resolve(need('page'));
const slug = need('slug');
const title = need('title');
const desc = need('desc');
const out = need('out');
const atRaw = opt('at');
if (!/^[a-z][a-z0-9-]*$/.test(slug)) die('--slug must be lowercase letters, digits and hyphens, starting with a letter');
let at = null;
if (atRaw !== undefined) {
  at = atRaw.split(',').map(Number);
  if (at.length !== 2 || !at.every(Number.isFinite) || at[0] < 0 || at[0] > 400 || at[1] < 0 || at[1] > 320) die('--at must be a viewBox point x,y within 400 x 320');
}
if (!existsSync(page)) die(`no page at ${page}; build it with the hairline-create skill's build.mjs`);
if (!/data-hairline|hairline\(/.test(readFileSync(page, 'utf8'))) die(`${page} is not a Hairline page`);

const candidates = [opt('hairline'), join(homedir(), '.claude/skills/hairline-create'), join(homedir(), '.agents/skills/hairline-create')].filter(Boolean);
const hlDir = candidates.map(d => resolve(d)).find(d => existsSync(join(d, 'look.mjs')));
if (!hlDir) die(`no hairline-create skill with look.mjs in ${candidates.join(' or ')}; install it: npx skills add lucasmarkes/hairline`);
const { cacheDir, playwright, launch } = await import(pathToFileURL(join(hlDir, 'look.mjs')).href);

let pw;
try { pw = playwright(cacheDir()); } catch (e) { die(`couldn't get playwright-core: ${e.message}`); }
const browser = await (process.env.CHROME_PATH ? pw.chromium.launch({ executablePath: process.env.CHROME_PATH }) : launch(pw)).catch(() => null);
if (!browser) die(`no Chrome and no Playwright Chromium; set CHROME_PATH, or run: node "${pw.cli}" install chromium`);

let svg, read;
try {
  const tab = await browser.newPage({ viewport: { width: 900, height: 900 } });
  const errors = [];
  tab.on('pageerror', e => errors.push(e.message));
  await tab.goto(pathToFileURL(page).href + (at ? `?at=${at.join(',')}` : ''));
  await tab.waitForTimeout(1500); // strokes fade in 260ms, tweens take 700ms, springs about a second
  const grab = () => tab.evaluate(() => {
    const s = document.querySelector('[data-hairline] svg');
    return s ? { svg: s.outerHTML, read: document.querySelector('#read')?.textContent?.trim() ?? '' } : null;
  });
  let last = await grab(), stillSince = Date.now();
  const end = Date.now() + 5000;
  while (last && Date.now() < end && Date.now() - stillSince < 250) {
    await tab.waitForTimeout(50);
    const now = await grab();
    if (now?.svg !== last.svg) { last = now; stillSince = Date.now(); }
  }
  if (!last) die(`no [data-hairline] svg on the page${errors.length ? `; the page threw: ${errors[0]}` : ''}`);
  if (Date.now() - stillSince < 250) process.stderr.write('hairline.mjs: warning: the drawing never held still for 250ms in 5s; the pose may be mid-move\n');
  ({ svg, read } = last);
} finally {
  await browser.close();
}

// Prefix every id and every reference to one, so two figures (or a figure and the kit) can share a page.
const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
for (const id of ids) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  svg = svg.replace(new RegExp(`(\\sid=")${esc}"`, 'g'), `$1${slug}-${id}"`)
    .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${slug}-${id})`)
    .replace(new RegExp(`(href=")#${esc}"`, 'g'), `$1#${slug}-${id}"`);
}
const escText = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
svg = svg.replace(/^<svg\b([^>]*)>/, (_, attrs) => {
  const kept = attrs.replace(/\s(aria-hidden|role|aria-label|aria-labelledby|class|style)="[^"]*"/g, '');
  return `<svg${kept} role="img" aria-labelledby="${slug}-title ${slug}-desc"><title id="${slug}-title">${escText(title)}</title><desc id="${slug}-desc">${escText(desc)}</desc>`;
});
if (/<script|\son[a-z]+=/i.test(svg)) die('the captured svg holds a script or a handler; refusing to write it');

writeFileSync(out, svg + '\n');
const kb = (Buffer.byteLength(svg) / 1024).toFixed(1);
process.stderr.write(`hairline.mjs: ${at ? `pose at ${at.join(',')}` : 'rest pose'}, read-out "${read || 'none'}", ${kb} KiB -> ${out}\n`);
if (at && read === 'rest') process.stderr.write('hairline.mjs: warning: the read-out still says "rest", so --at misses the part; take the point look.mjs prints for --answer\n');
if (Buffer.byteLength(svg) > 80 * 1024) process.stderr.write('hairline.mjs: warning: over 80 KiB; simplify the figure (fewer solids or ring samples)\n');
