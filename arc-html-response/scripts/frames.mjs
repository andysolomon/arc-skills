#!/usr/bin/env node
// Film a page's motion as a contact sheet: the same page frozen at several moments, stacked
// in one HTML file you preview once. Each frame is the page in a srcdoc iframe with a small
// script that pauses every CSS animation at that time. Stagger delays are kept, so a broken
// order or a one-frame jump shows up. The last frame is always the poster: every finite
// animation finished, loops at their start, which is what a screenshot, a thumbnail and
// reduced motion show. The idea is Stageshow's rehearsal: read every frame, and make sure
// the poster tells the story on its own.
//
//   node frames.mjs <page.html> [--at 0,120,240,360,500] [--select ".bars"] [--width 728] [--height 420] [--out <file>]
//
// --at       times in ms to freeze at, before the poster (default 0,120,240,360,500).
// --select   scrolls this element to the top of each frame (default: the page's top).
// --width    frame width in px (default 728, T3's reply width; try 390 for a phone).
// --height   frame height in px (default 420).
// --out      the contact sheet (default <page>.frames.html next to the page).
// Each frame's label also reports what is moving: how many animations, the longest one's own
// duration, when the last one settles (stagger included), and how many loop forever. An
// animation that runs longer than 1000 ms on its own is flagged: the skill's limit.
// The contact sheet runs a script, so it is for previewing only: never publish it.
// Exits 2 on bad input, with the reason on stderr.

import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
if (!argv.length || argv[0] === '--help' || argv[0] === '-h') {
  const src = readFileSync(new URL(import.meta.url), 'utf8');
  process.stdout.write(src.split('\n').slice(1).filter(l => l.startsWith('//')).map(l => l.replace(/^\/\/ ?/, '')).join('\n') + '\n');
  process.exit(argv.length ? 0 : 2);
}
const die = msg => { process.stderr.write(`frames.mjs: ${msg}\n`); process.exit(2); };
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) die(`--${name} needs a value`);
  return v;
};
const file = argv[0];
let page;
try { page = readFileSync(file, 'utf8'); } catch { die(`can't read ${file}`); }
const at = opt('at', '0,120,240,360,500').split(',').map(s => {
  const n = Number(s.trim());
  if (s.trim() === '' || !Number.isFinite(n) || n < 0) die(`--at has a time that is not a number of ms: "${s}"`);
  return n;
});
const width = Number(opt('width', '728'));
const height = Number(opt('height', '420'));
if (!(width >= 240 && width <= 1600)) die('--width must be between 240 and 1600');
if (!(height >= 120 && height <= 4000)) die('--height must be between 120 and 4000');
const select = opt('select');
const out = opt('out', file.replace(/\.html?$/i, '') + '.frames.html');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const freeze = t => `<script>(() => {
  const sel = ${JSON.stringify(select ?? null)};
  const run = () => {
    if (sel) { const el = document.querySelector(sel); if (el) el.scrollIntoView({ block: 'start' }); }
    const all = document.getAnimations();
    let end = 0, longest = 0, loops = 0;
    for (const a of all) {
      const timing = a.effect && a.effect.getComputedTiming();
      const finite = timing && timing.endTime !== Infinity;
      if (finite) { end = Math.max(end, timing.endTime); longest = Math.max(longest, timing.activeDuration); } else loops++;
      a.pause();
      a.currentTime = ${t === 'poster' ? 'finite ? timing.endTime : 0' : t};
    }
    parent.postMessage({ frame: ${JSON.stringify(String(t))}, count: all.length, end: Math.round(end), longest: Math.round(longest), loops }, '*');
  };
  if (document.readyState === 'complete') run(); else addEventListener('load', run);
})();</script>`;
const frameDoc = t => /<\/body>/i.test(page) ? page.replace(/<\/body>/i, `${freeze(t)}</body>`) : page + freeze(t);

const cells = [...at, 'poster'].map(t => `<figure>
  <figcaption><b>${t === 'poster' ? 'poster (all settled)' : `${t} ms`}</b> <span data-t="${t}"></span></figcaption>
  <iframe width="${width}" height="${height}" srcdoc="${esc(frameDoc(t))}"></iframe>
</figure>`).join('\n');

const sheet = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Frames: ${esc(file.split('/').pop())}</title>
<style>
body{margin:0;padding:12px;background:#18181b;color:#e4e4e7;font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
figure{margin:0 0 14px}
figcaption{margin:0 0 4px}
figcaption .late{color:#ff5a5f}
iframe{display:block;max-width:100%;border:1px solid #3f3f46;border-radius:6px;background:#fff}
</style></head><body>
<p>Contact sheet for preview only (it runs a script). ${at.length + 1} frames at ${width}×${height}${select ? `, scrolled to ${esc(select)}` : ''}.</p>
${cells}
<script>
addEventListener('message', e => {
  const d = e.data; if (!d || typeof d.frame !== 'string') return;
  for (const span of document.querySelectorAll('span[data-t="' + d.frame + '"]')) {
    span.textContent = '· ' + d.count + ' animation' + (d.count === 1 ? '' : 's') + ', longest ' + d.longest + ' ms, all settled by ' + d.end + ' ms' + (d.loops ? ', ' + d.loops + ' looping' : '');
    if (d.longest > 1000) { span.className = 'late'; span.textContent += ' · one runs over 1000 ms'; }
  }
});
</script>
</body></html>
`;
writeFileSync(out, sheet);
// The sheet adds 12px padding and a 1px border each side; previewing at this width shows frames 1:1.
process.stderr.write(`frames.mjs: ${at.length} frames + poster → ${out}\nframes.mjs: preview it at width ${width + 26}\n`);
