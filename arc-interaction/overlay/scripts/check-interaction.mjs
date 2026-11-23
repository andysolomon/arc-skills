#!/usr/bin/env node
// arc-interaction: checks the rules a style lint can't see. Part of `npm run check`.
//
//   node scripts/check-interaction.mjs
//
// Motion is imported in one file. No other animation library and no React entry is
// imported anywhere. Spring numbers live in src/interaction/constants.ts only. Script moves
// only transform and opacity. Every Mount builds its resource inside Effect.acquireRelease.
// A file that drags uses pointer capture, and a stylesheet sets touch-action.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const files = walk(join(root, 'src')).map((path) => ({ rel: relative(root, path), text: readFileSync(path, 'utf8') }));
const scripts = files.filter((f) => f.rel.endsWith('.ts'));
const styles = files.filter((f) => f.rel.endsWith('.css'));
// comments explain the rules, so they are not checked against them
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const problems = [];

const MOTION_FILE = 'src/interaction/motion.ts';
const CONSTANTS_FILE = 'src/interaction/constants.ts';
const BANNED = /from\s+["'](motion\/react[\w-]*|motion\/remix|framer-motion[\w/-]*|gsap[\w/-]*|animejs[\w/-]*|@react-spring\/[\w/-]+|popmotion|velocity-animate|react|react-dom[\w/-]*|@lucasmarkes\/hairline\/react)["']/g;

for (const { rel, text } of scripts) {
  const src = code(text);
  for (const m of src.matchAll(BANNED)) problems.push(`${rel}: imports ${m[1]}. Only Motion's plain entry ("motion") and a figure's plain DOM entry are allowed`);
  if (/from\s+["']motion["']/.test(src) && rel !== MOTION_FILE) problems.push(`${rel}: imports "motion". Only ${MOTION_FILE} does; ask it for a spring by name`);
  if (rel !== CONSTANTS_FILE) {
    for (const m of src.matchAll(/\b(stiffness|damping|mass|bounce|visualDuration|restSpeed|restDelta)\s*:\s*-?[\d.]/g)) {
      problems.push(`${rel}: a spring number (${m[1]}) outside ${CONSTANTS_FILE}. Name it there and say why it exists`);
    }
  }
  for (const m of src.matchAll(/\.style\.(\w+)/g)) {
    if (!['transform', 'opacity'].includes(m[1])) problems.push(`${rel}: script sets style.${m[1]}. Only transform and opacity move`);
  }
  for (const m of src.matchAll(/animate\(\s*\w+\s*,\s*\{([^}]*)\}/g)) {
    for (const key of m[1].matchAll(/(?:^|,)\s*\[?([\w]+)\]?\s*:/g)) {
      if (!['x', 'y', 'opacity', 'axis'].includes(key[1])) problems.push(`${rel}: animate() moves ${key[1]}. Only x, y (transform) and opacity`);
    }
  }
  if (/addEventListener\(\s*["']pointermove["']/.test(src) && !/setPointerCapture\(/.test(src)) {
    problems.push(`${rel}: listens for pointermove without setPointerCapture. A drag loses the pointer when it leaves the element`);
  }
  // each Mount.define / Mount.defineStream block, up to the next one
  const mounts = src.split(/(?=Mount\.define(?:Stream)?\()/).slice(1);
  for (const block of mounts) {
    const name = /Mount\.define(?:Stream)?\(\s*["']([\w-]+)["']/.exec(block)?.[1] ?? '(unnamed)';
    if (!/Effect\.acquireRelease\(/.test(block)) problems.push(`${rel}: Mount ${name} has no Effect.acquireRelease. Build its resource inside one, so the release runs when the element leaves`);
  }
}
const drags = scripts.some((f) => /setPointerCapture\(/.test(code(f.text)));
if (drags && !styles.some((f) => /touch-action\s*:/.test(f.text))) {
  problems.push('a file drags with pointer capture, but no stylesheet sets touch-action. A sideways swipe will fight vertical scroll');
}

if (problems.length) { console.log('FAIL interaction rules'); for (const p of problems) console.log(`  ${p}`); process.exit(1); }
console.log(`ok  interaction: Motion in one file, spring numbers in one file, transform and opacity only, ${scripts.reduce((n, f) => n + (code(f.text).match(/Mount\.define(?:Stream)?\(/g) ?? []).length, 0)} Mounts release what they acquire`);
