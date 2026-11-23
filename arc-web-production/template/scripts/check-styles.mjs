#!/usr/bin/env node
// Checks the app's stylesheets against arc-design's look and motion rules. Part of `npm run check`.
//
//   node scripts/check-styles.mjs               every .css file under src/, except tokens.css
//   node scripts/check-styles.mjs <file.css>    one file
//
// Colours, fonts and durations must come from tokens (tokens.css); every animation and
// transition sits inside @media (prefers-reduced-motion: no-preference); keyframes animate
// only opacity and transform; each animated state has its own keyframes name. An @font-face
// block may only bundle Geist or Geist Mono from a file in this app.
import { readdirSync, readFileSync } from 'node:fs';

const srcDir = new URL('../src/', import.meta.url).pathname;
const files = process.argv[2] ? [process.argv[2]]
  : readdirSync(srcDir, { recursive: true }).filter((f) => f.endsWith('.css') && !f.endsWith('tokens.css')).sort().map((f) => srcDir + f);
let failed = false;
for (const file of files) {
const raw = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const problems = [];
const lineOf = (i) => raw.slice(0, i).split('\n').length;
// @font-face blocks have their own rules; blank them out so the token rules skip them
for (const m of raw.matchAll(/@font-face\s*\{([^{}]*)\}/g)) {
  const at = `line ${lineOf(m.index)}: @font-face`;
  const family = /font-family\s*:\s*["']?([^;"']+)["']?/.exec(m[1])?.[1].trim();
  if (family !== 'Geist' && family !== 'Geist Mono') problems.push(`${at} ${family ?? '(no family)'}: only Geist and Geist Mono, the faces the tokens name`);
  const urls = [...m[1].matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((u) => u[1]);
  if (urls.length === 0) problems.push(`${at}: no src url`);
  for (const u of urls) if (!/^\.\.?\//.test(u)) problems.push(`${at} src ${u}: bundle the file in this app (a relative path), never a font CDN`);
  if (!/font-display\s*:\s*swap/.test(m[1])) problems.push(`${at}: add font-display: swap so text shows before the font loads`);
}
const css = raw.replace(/@font-face\s*\{[^{}]*\}/g, (block) => block.replace(/[^\n]/g, ' '));
const each = (re, msg) => { for (const m of css.matchAll(re)) problems.push(`line ${lineOf(m.index)}: ${msg(m)}`); };

// every reduced-motion block, by brace matching (a stylesheet may have more than one)
const guards = [];
for (const m of css.matchAll(/@media\s*\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)/g)) {
  let depth = 0, i = css.indexOf('{', m.index);
  for (; i < css.length; i++) { if (css[i] === '{') depth++; else if (css[i] === '}' && --depth === 0) break; }
  guards.push([m.index, i]);
}
const inGuard = (i) => guards.some(([from, to]) => i > from && i < to);
// keyframes bodies are checked separately
const frames = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)];
const inFrames = (i) => frames.some((f) => i >= f.index && i < f.index + f[0].length);

each(/#[0-9a-fA-F]{3,8}\b/g, (m) => `colour ${m[0]}: use a token`);
each(/\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/g, (m) => `colour function ${m[0]}…): use a token`);
each(/(?:^|[\s:,])(white|black|red|blue|green|gray|grey|orange|yellow|purple|pink)\b(?![\w-])/gm, (m) => `named colour ${m[1]}: use a token`);
each(/@import\b/g, () => '@import: no web fonts or remote CSS');
each(/\b(?:linear|radial|conic)-gradient\(/g, (m) => `${m[0]}…): no ornamental gradients`);
each(/font-family\s*:\s*(?!\s*(?:var\(--(?:sans|mono)\)|inherit))[^;}]+/g, (m) => `${m[0].trim()}: use var(--sans) or var(--mono)`);
each(/(?<![\w-])\d*\.?\d+m?s\b/g, (m) => `duration ${m[0]}: use --t-micro, --t-state, --t-enter or --stagger`);
each(/\binfinite\b/g, () => 'infinite animation: motion shows a state change, then stops');
each(/outline\s*:\s*(?:none|0)\b/g, () => 'outline removed: keyboard focus needs its ring');
each(/font-size\s*:\s*(?:\d|1[01])(?:\.\d+)?px/g, (m) => `${m[0]}: text under 12px is too small to read`);
each(/transition\s*:\s*all\b/g, () => 'transition: all: name the property');
each(/\bease-in\b(?!-)/g, () => 'ease-in: use var(--ease)');
for (const m of css.matchAll(/(?:^|[;{\s])(animation(?:-name)?|transition)\s*:/g)) {
  if (!inGuard(m.index) && !inFrames(m.index)) problems.push(`line ${lineOf(m.index)}: ${m[1]} outside the prefers-reduced-motion guard`);
}
for (const f of frames) {
  for (const p of f[2].matchAll(/([\w-]+)\s*:/g)) {
    if (!['opacity', 'transform'].includes(p[1])) problems.push(`line ${lineOf(f.index)}: @keyframes ${f[1]} animates ${p[1]}: only opacity and transform`);
  }
}
const uses = new Map();
for (const m of css.matchAll(/([^{}]+)\{[^{}]*\banimation\s*:\s*([\w-]+)/g)) {
  const list = uses.get(m[2]) ?? []; list.push(m[1].trim()); uses.set(m[2], list);
}
for (const [name, selectors] of uses) {
  if (selectors.length > 1) problems.push(`@keyframes ${name} is used by ${selectors.length} rules (${selectors.join(' | ')}): give each state its own name, or a class change won't replay it`);
}

if (problems.length) { failed = true; console.log(`FAIL ${file}`); for (const p of problems) console.log(`  ${p}`); }
else console.log(`ok  styles: ${file.split('/').slice(-2).join('/')} uses tokens only, motion is guarded`);
}
process.exit(failed ? 1 : 0);
