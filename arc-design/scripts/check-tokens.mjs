#!/usr/bin/env node
// Checks that copies of the design tokens match arc-design/tokens.css.
//
//   node check-tokens.mjs                 check the known copies in this repo
//   node check-tokens.mjs <file> [...]    check these files (.css copies or .html pages)
//
// A copy may wrap a value in a host fallback, var(--host-name, VALUE): the VALUE is what
// is compared. A copy may define extra tokens. It may not change a shared one. A .css copy
// may not drop one either; an .html page may omit tokens it has no use for (a page has no
// buttons, so no --on-hi).
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const SOURCE = join(here, '..', 'tokens.css');
const KNOWN = ['arc-web-production/template/src/tokens.css', 'arc-html-response/template.html'];

const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const unwrap = (value) => {
  let v = value.trim();
  for (;;) {
    const m = /^var\(\s*--[\w-]+\s*,([\s\S]*)\)$/.exec(v);
    if (!m) return v.replace(/\s+/g, '');
    v = m[1].trim();
  }
};
const decls = (block) => {
  const out = new Map();
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(m[1], unwrap(m[2]));
  return out;
};
// dark = declarations outside the light media block; light = declarations inside it
const parse = (text) => {
  const css = strip(/<style[^>]*>([\s\S]*?)<\/style>/i.exec(text)?.[1] ?? text);
  const start = css.search(/@media\s*\(\s*prefers-color-scheme\s*:\s*light\s*\)/);
  if (start < 0) return { dark: decls(css), light: new Map() };
  let depth = 0, end = css.indexOf('{', start);
  for (let i = end; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) { end = i; break; }
  }
  return { dark: decls(css.slice(0, start) + css.slice(end + 1)), light: decls(css.slice(start, end + 1)) };
};

const source = parse(readFileSync(SOURCE, 'utf8'));
const files = process.argv.slice(2).length > 0 ? process.argv.slice(2) : KNOWN.map((f) => join(repo, f));
let failed = 0;
for (const file of files) {
  const rel = relative(repo, file);
  const name = rel === '' || rel.startsWith('..') ? file : rel;
  if (!existsSync(file)) { console.log(`FAIL ${name}: file not found`); failed++; continue; }
  const copy = parse(readFileSync(file, 'utf8'));
  const partial = /\.html?$/i.test(file);
  const problems = [];
  for (const mode of ['dark', 'light']) {
    for (const [token, want] of source[mode]) {
      const got = copy[mode].get(token);
      if (got === undefined) { if (!partial) problems.push(`${mode} ${token} is missing`); }
      else if (got !== want) problems.push(`${mode} ${token} is ${got}, expected ${want}`);
    }
  }
  if (problems.length > 0) { failed++; console.log(`FAIL ${name}`); for (const p of problems) console.log(`  ${p}`); }
  else console.log(`PASS ${name}`);
}
process.exit(failed > 0 ? 1 : 0);
