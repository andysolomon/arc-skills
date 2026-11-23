#!/usr/bin/env node
// Capture a Stageshow still as static HTML and CSS for the kit's `stage` shell. The demo is
// rendered in headless Chrome from Stageshow's own playground (or any page that mounts it),
// then the laid-out DOM is copied out with only the CSS rules it uses, scoped under the shell.
// No script ships: the result passes the page contract like any other block.
//
//   node stage.mjs --stageshow <stageshow dir> --url "http://127.0.0.1:5173/?capture=static-card&still=1" \
//                  --slug billing --label "Customers list with Jackson Hot Yoga selected" --out <dir>/billing \
//                  [--select .ss-fit] [--theme light|dark|both] [--compact 358]
//
// --stageshow  the installed stageshow skill folder, after `npm install` there. playwright-core
//              is loaded from it, so this script has no dependencies of its own.
// --url        a page that renders one still. For the playground, run `npm run dev` in the
//              stageshow folder and use ?capture=<example>&still=1. A host app's route works too.
// --select     the element to copy (default .ss-fit, the stage root).
// --slug       names the shell class (.stage-<slug>) and prefixes every id.
// --label      what the still shows, in one sentence: the aria-label screen readers get.
// --theme      light (default), dark, or both. both captures twice and switches with
//              prefers-color-scheme, so the page's dark and light modes each get a matching UI.
// --compact    phone column width for the compact design (default 358). Skipped when the
//              stage has no compact design; it then scrolls inside its shell on narrow screens.
// --out        writes <out>.css (paste into the page's <style>, after the kit's stage block)
//              and <out>.html (paste into the page). Prints sizes and warnings to stderr.
// Needs Chrome: CHROME_PATH, else the installed Chrome channel. Exits 2 on bad input or a
// failed capture, with the reason on stderr.

import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  const src = readFileSync(new URL(import.meta.url), 'utf8');
  process.stdout.write(src.split('\n').slice(1).filter(l => l.startsWith('//')).map(l => l.replace(/^\/\/ ?/, '')).join('\n') + '\n');
  process.exit(argv.length ? 0 : 2);
}
const die = msg => { process.stderr.write(`stage.mjs: ${msg}\n`); process.exit(2); };
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) die(`--${name} needs a value`);
  return v;
};
const need = name => opt(name) ?? die(`--${name} is required`);

const ssDir = resolve(need('stageshow'));
const url = need('url');
const slug = need('slug');
const label = need('label');
const out = need('out');
const select = opt('select', '.ss-fit');
const theme = opt('theme', 'light');
const compactW = Number(opt('compact', '358'));
if (!/^[a-z][a-z0-9-]*$/.test(slug)) die('--slug must be lowercase letters, digits and hyphens, starting with a letter');
if (!['light', 'dark', 'both'].includes(theme)) die('--theme must be light, dark or both');
if (!Number.isFinite(compactW) || compactW < 240) die('--compact must be a width of 240 or more');
if (!existsSync(resolve(ssDir, 'package.json'))) die(`no package.json in ${ssDir}; pass the stageshow skill folder`);

let chromium;
try {
  ({ chromium } = createRequire(resolve(ssDir, 'package.json'))('playwright-core'));
} catch {
  die(`playwright-core is not installed in ${ssDir}; run npm install there first`);
}
let browser;
try {
  browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
} catch {
  die(`couldn't start Chrome${process.env.CHROME_PATH ? ` at ${process.env.CHROME_PATH}` : ''}; install Chrome or set CHROME_PATH to a Chrome or Chromium binary`);
}

const scope = `.stage-${slug}`;

// Runs in the page: copy the element's DOM and the CSS rules that reach it.
function collect({ select, scope, prefix }) {
  const root = document.querySelector(select);
  if (!root) return { error: `nothing matches ${select}` };
  const warnings = [];
  const inRoot = sel => {
    try { return [...document.querySelectorAll(sel)].some(e => root === e || root.contains(e)); } catch { return false; }
  };
  // Probe class on the parent stands in for the shell, to test that a scoped selector still matches.
  const probe = 'stage-capture-probe';
  root.parentElement.classList.add(probe);
  const DYNAMIC = /:(hover|focus|focus-visible|focus-within|active|visited|target)\b/;
  const PSEUDO_EL = /::?(before|after|placeholder|marker|selection|backdrop|first-letter|first-line|-webkit-[\w-]+|-moz-[\w-]+)(\([^)]*\))?/g;
  const splitList = text => {
    const parts = []; let depth = 0, cur = '';
    for (const ch of text) {
      if (ch === '(' || ch === '[') depth++;
      if (ch === ')' || ch === ']') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  };
  const scopeSel = sel => {
    if (DYNAMIC.test(sel)) return null; // a still has no hover or focus
    const bare = sel.replace(PSEUDO_EL, '') || '*';
    if (!inRoot(bare)) return null;
    // A leading :root, html or body holds tokens the stage reads: move them onto the shell.
    const lifted = sel.replace(/^(:root|html|body)(?=$|[\s>~+])/, '');
    if (lifted !== sel) {
      const rest = lifted.trim();
      return rest ? `${scope} ${rest.replace(/^[>~+]\s*/, '')}` : scope;
    }
    const bareTest = `.${probe} ${bare}`;
    const viaShell = inRoot(bareTest) || inRoot(`.${probe} > ${bare}`);
    if (!viaShell && /#example\b/.test(sel)) return null; // the playground's own frame
    if (!viaShell) { warnings.push(`dropped a rule that depends on context outside the stage: ${sel}`); return null; }
    return `${scope} ${sel}`;
  };
  const cleanDecls = text => text.replace(/(^|;)\s*(animation|transition)[\w-]*\s*:[^;]*(?=;|$)/g, '$1').replace(/^;\s*/, '').replace(/;\s*;/g, ';').trim();
  // Each kept rule is one entry with the at-rule preludes around it, so variants can be merged
  // rule by rule and regrouped without breaking a block.
  const entries = [];
  const walk = (rules, wrap) => {
    for (const r of rules) {
      if (r instanceof CSSStyleRule) {
        const sels = splitList(r.selectorText).map(scopeSel).filter(Boolean);
        if (!sels.length) continue;
        const decls = cleanDecls(r.style.cssText);
        const nested = r.cssRules && r.cssRules.length ? [...r.cssRules].map(n => n.cssText).join('') : '';
        if (decls || nested) entries.push({ wrap, text: `${sels.join(',')}{${decls}${nested}}` });
      } else if (typeof CSSLayerBlockRule !== 'undefined' && r instanceof CSSLayerBlockRule) {
        // Kept as a layer: Stageshow layers its kit so a demo's own rules always win, and keeps
        // only its host-page guards unlayered. The capture keeps that order.
        walk(r.cssRules, [...wrap, `@layer ${r.name}`]);
      } else if (r instanceof CSSMediaRule) {
        if (/prefers-reduced-motion:\s*no-preference/.test(r.conditionText)) continue; // motion only
        walk(r.cssRules, [...wrap, `@media ${r.conditionText}`]);
      } else if (r instanceof CSSSupportsRule) {
        walk(r.cssRules, [...wrap, `@supports ${r.conditionText}`]);
      } else if (typeof CSSContainerRule !== 'undefined' && r instanceof CSSContainerRule) {
        walk(r.cssRules, [...wrap, `@container ${r.conditionText}`]);
      }
      // @keyframes, @font-face, @import, @property and layer statements are left out: a still
      // doesn't move, and the page contract allows no web fonts or imports.
    }
  };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules, []); } catch { warnings.push(`couldn't read a stylesheet (${sheet.href || 'inline'})`); }
  }
  root.parentElement.classList.remove(probe);

  const clone = root.cloneNode(true);
  clone.querySelectorAll('script,style,link,iframe,object,embed,noscript').forEach(n => n.remove());
  // The frame is one role="img" with the capture's label, so the icons inside are decoration.
  clone.querySelectorAll('svg').forEach(n => { n.setAttribute('aria-hidden', 'true'); n.setAttribute('focusable', 'false'); });
  const ids = new Map();
  clone.querySelectorAll('[id]').forEach(n => { const next = `${prefix}${n.id.replace(/[^\w-]/g, '')}`; ids.set(n.id, next); n.id = next; });
  for (const n of [clone, ...clone.querySelectorAll('*')]) {
    for (const a of [...n.attributes]) {
      if (/^on/i.test(a.name)) { n.removeAttribute(a.name); continue; }
      let v = a.value;
      for (const [from, to] of ids) {
        v = v.split(`url(#${from})`).join(`url(#${to})`).split(`url("#${from}")`).join(`url(#${to})`);
        if ((a.name === 'href' || a.name === 'xlink:href') && v === `#${from}`) v = `#${to}`;
        if (/^aria-(labelledby|describedby|controls)$|^for$/.test(a.name)) v = v.split(/\s+/).map(t => t === from ? to : t).join(' ');
      }
      if (v !== a.value) n.setAttribute(a.name, v);
    }
  }
  const layout = root.querySelector('.ss-stage')?.dataset.layout || root.dataset.layout || 'wide';
  return { html: clone.outerHTML, entries, warnings, layout, width: root.getBoundingClientRect().width };
}

// Local images and CSS url()s become data: URIs (pages load images from https: and data: only).
async function inlineAssets(page, text) {
  const refs = new Set();
  for (const m of text.matchAll(/(?:src|href)="([^"]+)"|url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const ref = (m[1] || m[2]).replace(/&amp;/g, '&');
    if (/^(data:|https:|#)/.test(ref)) continue;
    refs.add(ref);
  }
  for (const ref of refs) {
    const dataUrl = await page.evaluate(async ref => {
      const res = await fetch(ref);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
    }, ref).catch(() => null);
    if (!dataUrl) { process.stderr.write(`stage.mjs: warning: couldn't inline ${ref}; it won't load on the page\n`); continue; }
    text = text.split(ref).join(dataUrl);
  }
  return text;
}

async function capture({ width, dark, prefix }) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', colorScheme: dark ? 'dark' : 'light' });
  // Stageshow's film hook: renders every stage in the dark theme.
  if (dark) await page.addInitScript(() => { window.__stageshow = { ...(window.__stageshow || {}), theme: 'dark' }; });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector(select, { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400); // let the stage measure and place its scene
    const got = await page.evaluate(collect, { select, scope, prefix });
    if (got.error) die(got.error);
    got.html = await inlineAssets(page, got.html);
    for (const e of got.entries) e.text = await inlineAssets(page, e.text);
    return got;
  } catch (e) {
    die(`capture failed at ${url} (width ${width}): ${e.message.split('\n')[0]}`);
  } finally {
    await page.close();
  }
}

const themes = theme === 'both' ? ['light', 'dark'] : [theme];
const variants = [];
for (const t of themes) {
  const wide = await capture({ width: 1400, dark: t === 'dark', prefix: `${slug}-${t}-w-` });
  variants.push({ key: `wide-${t}`, t, size: 'wide', ...wide });
  const narrow = await capture({ width: compactW, dark: t === 'dark', prefix: `${slug}-${t}-c-` });
  if (narrow.layout === 'compact') variants.push({ key: `compact-${t}`, t, size: 'compact', ...narrow });
}
await browser.close();

// Union of rules across variants, in first-seen order, then regrouped under their at-rules.
const seen = new Set(); const merged = [];
for (const v of variants) for (const e of v.entries) {
  const k = e.wrap.join('\u0000') + '\u0001' + e.text;
  if (!seen.has(k)) { seen.add(k); merged.push(e); }
}
let css = '';
for (let i = 0; i < merged.length;) {
  const wrap = merged[i].wrap; const group = [];
  while (i < merged.length && merged[i].wrap.join('\u0000') === wrap.join('\u0000')) group.push(merged[i++].text);
  css += wrap.reduceRight((inner, at) => `${at}{\n${inner}\n}`, group.join('\n')) + '\n';
}

const hasCompact = variants.some(v => v.size === 'compact');
const widthOf = size => Math.round(variants.find(v => v.size === size).width);
const designW = widthOf('wide');
// Every rule only hides, and the default is shown, so the size and theme rules never fight.
// Size follows the frame's own width (a container query), not the window's, so the same
// still fits a 728px T3 thread and a full-width Postplan page.
const sel = (attrs, tail = '') => `${scope} .stage-v${attrs}${tail}`;
let switches = `${scope} .stage-frame{container-type:inline-size}\n`;
if (themes.length === 2) {
  switches += `@media not (prefers-color-scheme: light){${sel('[data-tone="light"]')}{display:none}}\n`;
  switches += `@media (prefers-color-scheme: light){${sel('[data-tone="dark"]')}{display:none}}\n`;
}
// Stageshow scales a stage down to fit its slot. CSS can't divide widths, so the capture
// steps the zoom in 5% rungs instead, down to 75% before the compact design takes over.
const RUNGS = [0.95, 0.9, 0.85, 0.8, 0.75];
const ladder = (size, w, floor) => {
  let css = '';
  let top = w - 1;
  for (const k of RUNGS) {
    if (k < floor) break;
    const min = Math.ceil(w * k);
    css += `@container (min-width:${min}px) and (max-width:${top}px){${sel(`[data-size="${size}"]`, ' .ss-fit')}{zoom:${k}}}\n`;
    top = min - 1;
  }
  return { css, cut: top + 1 };
};
const wide = ladder('wide', designW, 0.75);
switches += wide.css;
let below = wide.cut;
if (hasCompact) {
  switches += `@container (min-width:${wide.cut}px){${sel('[data-size="compact"]')}{display:none}}\n`;
  switches += `@container (max-width:${wide.cut - 1}px){${sel('[data-size="wide"]')}{display:none}}\n`;
  const compactW = widthOf('compact');
  const c = ladder('compact', compactW, 0.75);
  switches += c.css;
  below = c.cut;
  switches += `@container (max-width:${c.cut - 1}px){${sel('[data-size="compact"]', ' .ss-fit')}{zoom:0.75}}\n`;
} else {
  switches += `@container (max-width:${wide.cut - 1}px){${sel('[data-size="wide"]', ' .ss-fit')}{zoom:0.75}}\n`;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const head = `/* stage: ${slug} (captured from Stageshow by scripts/stage.mjs; MIT, Benji Taylor) */\n`;
writeFileSync(`${out}.css`, head + switches + css);
const html = `<figure class="stage stage-${slug}">\n  <div class="stage-frame" role="img" aria-label="${esc(label)}">\n` +
  variants.map(v => `    <div class="stage-v" data-size="${v.size}" data-tone="${v.t}">${v.html}</div>`).join('\n') +
  `\n  </div>\n  <figcaption>${esc(label)}</figcaption>\n</figure>\n`;
writeFileSync(`${out}.html`, html);

const warnings = [...new Set(variants.flatMap(v => v.warnings))];
for (const w of warnings) process.stderr.write(`stage.mjs: warning: ${w}\n`);
if (!hasCompact) process.stderr.write(`stage.mjs: warning: no compact design; in a frame under ${below}px the stage scrolls inside its shell. Stageshow asks for a compact design for any demo that can sit in a phone column.\n`);
const kb = n => (n / 1024).toFixed(1);
const cssB = Buffer.byteLength(head + switches + css), htmlB = Buffer.byteLength(html);
process.stderr.write(`stage.mjs: ${variants.map(v => v.key).join(', ')} · design width ${designW}px · css ${kb(cssB)} KiB · html ${kb(htmlB)} KiB\n`);
if (cssB + htmlB > 150 * 1024) process.stderr.write(`stage.mjs: warning: over 150 KiB; the page budget is 512 KiB\n`);
