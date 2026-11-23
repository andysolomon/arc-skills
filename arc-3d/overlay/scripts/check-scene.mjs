#!/usr/bin/env node
// Checks the scene code against arc-3d's rules. Part of `npm run check`.
//
//   node scripts/check-scene.mjs
//
// The style lint (check-styles.mjs) reads CSS, so it can't see a colour written in
// TypeScript. This reads src/scene/*.ts and src/app.ts and fails on:
//   - a colour literal: the scene's colours come from tokens.ts, which reads tokens.css;
//   - three.js imported anywhere but scene.ts, or imported whole (`import * as THREE`);
//   - text drawn on the canvas: text stays HTML;
//   - three.js's always-on loop (setAnimationLoop): the scene renders on demand;
//   - a `three` version in package.json that is not an exact pin.
import { readdirSync, readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const sceneDir = `${root}src/scene/`;
const files = [...readdirSync(sceneDir).filter((f) => f.endsWith('.ts')).map((f) => `src/scene/${f}`), 'src/app.ts'];
const problems = [];

for (const file of files) {
  // Comments may name colours as examples; code may not.
  const code = readFileSync(root + file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');
  const lineOf = (i) => code.slice(0, i).split('\n').length;
  const each = (re, msg) => { for (const m of code.matchAll(re)) problems.push(`${file}:${lineOf(m.index)}: ${msg(m)}`); };

  each(/["'`]#[0-9a-fA-F]{3,8}["'`]/g, (m) => `colour ${m[0]}: read it from a token in tokens.ts`);
  each(/\b0x[0-9a-fA-F]{6}\b/g, (m) => `colour ${m[0]}: read it from a token in tokens.ts`);
  each(/["'`](?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/g, (m) => `colour function ${m[0]}…: read it from a token in tokens.ts`);
  each(/["'`](?:white|black|red|blue|green|gray|grey|orange|yellow|purple|pink)["'`]/g, (m) => `named colour ${m[0]}: read it from a token in tokens.ts`);
  each(/\.(?:setHex|setStyle|setColorName|setHSL)\(/g, (m) => `${m[0]}…): set colours with the Palette from tokens.ts`);
  each(/new Color\(\s*[^)\s]/g, () => 'new Color(<value>): start empty and paint it from the Palette');
  each(/\b(?:fillText|strokeText|TextGeometry|CanvasTexture)\b/g, (m) => `${m[0]}: text stays HTML, next to the canvas`);
  each(/\bsetAnimationLoop\(/g, () => 'setAnimationLoop: render on demand, and stop when nothing changes');

  for (const m of code.matchAll(/import\s+([^;]*?)\s+from\s+["']three(?:\/[^"']*)?["']/g)) {
    const at = `${file}:${lineOf(m.index)}`;
    if (file !== 'src/scene/scene.ts') problems.push(`${at}: three.js is imported outside scene.ts: keep it in the one file the Mount loads on demand`);
    if (!/^(?:type\s+)?\{/.test(m[1].trim())) problems.push(`${at}: import only the names the scene uses, not the whole module`);
  }
  if (file !== 'src/scene/mount.ts' && /import\(\s*["']\.\/scene\.ts["']\s*\)/.test(code)) problems.push(`${file}: only mount.ts loads scene.ts`);
  if (file !== 'src/scene/scene.ts' && /from\s+["']\.\/scene\.ts["']/.test(code)) problems.push(`${file}: a static import of scene.ts pulls three.js into the first chunk and into the Node tests`);
}

const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8'));
for (const [name, version] of [['three', pkg.dependencies?.three], ['@types/three', pkg.devDependencies?.['@types/three']]]) {
  if (version === undefined) problems.push(`package.json: ${name} is missing`);
  else if (!/^\d+\.\d+\.\d+$/.test(version)) problems.push(`package.json: ${name} is "${version}": pin it exactly (npm install --save-exact)`);
}

if (problems.length) { console.log('FAIL scene'); for (const p of problems) console.log(`  ${p}`); process.exit(1); }
console.log(`ok  scene: ${files.length} files, no colour literal, three.js only in scene.ts, exact pins`);
