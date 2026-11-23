#!/usr/bin/env node
// Checks src/styles.css against arc-design's look and motion rules. Part of `npm run check`.
//
//   node scripts/check-styles.mjs [file.css]
//
// Colours, fonts and durations must come from tokens (tokens.css); every animation and
// transition sits inside @media (prefers-reduced-motion: no-preference); keyframes animate
// only opacity and transform; each animated state has its own keyframes name.
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? new URL('../src/styles.css', import.meta.url).pathname;
const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const problems = [];
const lineOf = (i) => css.slice(0, i).split('\n').length;
const each = (re, msg) => { for (const m of css.matchAll(re)) problems.push(`line ${lineOf(m.index)}: ${msg(m)}`); };

// the reduced-motion block, by brace matching
let guard = [0, 0];
const g = css.search(/@media\s*\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)/);
if (g >= 0) {
  let depth = 0, i = css.indexOf('{', g);
  for (const start = i; i < css.length; i++) { if (css[i] === '{') depth++; else if (css[i] === '}' && --depth === 0) break; }
  guard = [g, i];
}
const inGuard = (i) => i > guard[0] && i < guard[1];
// keyframes bodies are checked separately
const frames = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)];
const inFrames = (i) => frames.some((f) => i >= f.index && i < f.index + f[0].length);

each(/#[0-9a-fA-F]{3,8}\b/g, (m) => `colour ${m[0]}: use a token`);
each(/\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/g, (m) => `colour function ${m[0]}…): use a token`);
each(/(?:^|[\s:,])(white|black|red|blue|green|gray|grey|orange|yellow|purple|pink)\b(?![\w-])/gm, (m) => `named colour ${m[1]}: use a token`);
each(/@import\b/g, () => '@import: no web fonts or remote CSS');
each(/\b(?:linear|radial|conic)-gradient\(/g, (m) => `${m[0]}…): no ornamental gradients`);
each(/font-family\s*:\s*(?!var\(--(?:sans|mono)\)|inherit)[^;}]+/g, (m) => `${m[0].trim()}: use var(--sans) or var(--mono)`);
each(/(?<![\w-])\d*\.?\d+m?s\b/g, (m) => `duration ${m[0]}: use --t-micro, --t-state, --t-enter or --stagger`);
each(/\binfinite\b/g, () => 'infinite animation: motion shows a state change, then stops');
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

if (problems.length) { console.log(`FAIL ${file}`); for (const p of problems) console.log(`  ${p}`); process.exit(1); }
console.log(`ok  styles: ${file.split('/').slice(-2).join('/')} uses tokens only, motion is guarded`);
