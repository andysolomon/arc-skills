#!/usr/bin/env node
// Checks every skill's evals/evals.json: it parses, names its own skill, and every eval
// has an id, a prompt and at least one assertion. The design pyramid's skills must have
// evals, each with an expected output; other skills without evals are listed, not failed.
//
//   node scripts/check-evals.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED = [
  'arc-design', 'arc-html-response', 'arc-web-production', 'arc-interaction', 'arc-realtime',
  'arc-3d', 'arc-salesforce-engineering', 'arc-system-architecture', 'arc-webgl-performance',
];
const skills = readdirSync(repo, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(repo, d.name, 'SKILL.md'))).map((d) => d.name).sort();

let failed = 0;
const without = [];
for (const skill of REQUIRED) if (!skills.includes(skill)) { failed++; console.log(`FAIL ${skill}: the skill folder or its SKILL.md is missing`); }
for (const skill of skills) {
  const file = join(repo, skill, 'evals', 'evals.json');
  if (!existsSync(file)) {
    if (REQUIRED.includes(skill)) { failed++; console.log(`FAIL ${skill}: evals/evals.json is missing`); }
    else without.push(skill);
    continue;
  }
  const problems = [];
  let doc;
  try { doc = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { problems.push(`not valid JSON: ${e.message}`); }
  if (doc) {
    if (doc.skill_name !== skill) problems.push(`skill_name is ${JSON.stringify(doc.skill_name)}, expected "${skill}"`);
    const evals = Array.isArray(doc.evals) ? doc.evals : [];
    if (evals.length < 2) problems.push(`${evals.length} eval(s): a skill needs at least a positive path and an adjacent negative`);
    const ids = new Set();
    for (const [i, e] of evals.entries()) {
      const at = `eval ${e?.id ?? `#${i + 1}`}`;
      if (typeof e.id !== 'string' && typeof e.id !== 'number') problems.push(`${at}: no id`);
      else if (ids.has(e.id)) problems.push(`${at}: id is used twice`);
      ids.add(e.id);
      if (typeof e.prompt !== 'string' || e.prompt.trim() === '') problems.push(`${at}: no prompt`);
      if (REQUIRED.includes(skill) && (typeof e.expected_output !== 'string' || e.expected_output.trim() === '')) problems.push(`${at}: no expected_output`);
      const assertions = Array.isArray(e.assertions) ? e.assertions : [];
      if (assertions.length === 0) problems.push(`${at}: no assertions`);
      const seen = new Set();
      for (const a of assertions) {
        if (typeof a === 'string') { if (a.trim() === '') problems.push(`${at}: an empty assertion`); continue; }
        if (!a || typeof a !== 'object' || (!a.kind && !a.type)) { problems.push(`${at}: an assertion has no kind or type`); continue; }
        if (a.id !== undefined) { if (seen.has(a.id)) problems.push(`${at}: assertion id ${a.id} is used twice`); seen.add(a.id); }
        if (a.method === 'judge' && (typeof a.prompt !== 'string' || a.prompt.trim() === '')) problems.push(`${at}: judge assertion ${a.id ?? ''} has no prompt`);
      }
    }
  }
  if (problems.length) { failed++; console.log(`FAIL ${skill}`); for (const p of problems) console.log(`  ${p}`); }
  else console.log(`PASS ${skill} (${doc.evals.length} evals)`);
}
if (without.length) console.log(`note: no evals yet for ${without.join(', ')}`);
process.exit(failed > 0 ? 1 : 0);
