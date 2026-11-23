# Release gate: the fresh-agent test

Unit tests prove the scripts work. They don't prove an agent can follow the skill. Before merging a change to `SKILL.md`, `template.html` or `components.html`, hand the skill to agents that have never seen this repo and check what they make.

The idea comes from MengTo/Skills: after writing each illustration skill, its author had a fresh agent draw a new card from that skill's folder alone, and every test exposed something missing.

## How to run it

0. Build the worst-case page (`node tests/worst-case.mjs <out.html>`) and preview it at 390 (light) and 728 (dark) with animations off. Nothing may widen the page, overlap, or get cut off. It feeds every kit component realistic worst data: an unbreakable German compound, a 64-character email, a 100-character path, zero, exactly one, 1,284,000, right-to-left text. The method comes from break-ui in emilkowalski/skills.
1. Start one fresh agent per prompt below, in parallel. No conversation history, no hints beyond the brief.
2. Give each the same brief: the absolute path to this skill folder, the prompt, and an output path in a scratch folder. Tell it to read `SKILL.md` first and to follow it, to skip publishing and inline rendering, and to report which skill instructions were unclear or missing.
3. When they finish, check every page yourself; don't trust the agents' own reports:
   - `bash scripts/lint.sh <page>` prints `PASS`.
   - `cd ~ && npx -y postplan@0.0.6 check <page>` prints `Ready.`
   - Preview at 728 and at 390 (light): no page-level horizontal scroll, nothing clipped, readable in both themes.
   - Score it with the rubric below.
4. Fix the skill for every gap a run exposed, then run that prompt again with a new fresh agent.

## Prompts

Each one exercises a different part of the skill. Real data is in the prompt so the agent has nothing to invent.

1. **Chart and findings.** "Our build times last week were: esbuild 1.2 s, Vite 2.9 s, webpack 9.8 s, Rollup 4.1 s. CI flakes: 3 of 40 runs failed on the e2e suite, all on the login spec. Write me a short report on where the build time goes and what to fix first."
2. **Branching diagram and a decision.** "Explain how a request moves through our system and help me decide on caching. The browser calls the API gateway, which sends reads to a cache and writes to the orders service; the orders service writes to Postgres and publishes to a queue that the email worker consumes. Options: cache at the gateway, or in the orders service." Also check that the choice is asked in the question dialog, with the recommended option first, not as a request to type "1A".
3. **Work report.** "You changed src/auth/session.ts (+24 −9, refresh once per tab), added src/auth/lock.ts (+41, a cross-tab lock) and fixed tests/e2e/login.spec.ts (+18 −30, wait for the cookie instead of sleeping). Unit tests passed 212/212; e2e on CI was not run. Report the work."

## Rubric

Five criteria, 0, 1 or 2 points each. The bar is 8 of 10. With two judges, score each page as the lower of the two.

| Criterion | 2 points means |
|---|---|
| Answer first | The headline is the verdict, and the first paragraph says what to do. |
| Kit fidelity | It reuses the kit's components and tokens instead of inventing look-alikes. |
| Visual earns its place | Each chart or diagram shows real numbers or a real mechanism, with a title, a desc and a scale. |
| Contract and motion | Lint passes; motion follows the reading-order rule and the timing tokens. |
| Plain and short | Plain words, 3 to 6 sections, nothing the user won't act on. Work reports end with a packet using the literal `PASS` / `FAIL` / `NOT_RUN`. |

## Record

Add a row per run, newest first.

| Date | Skill commit | Prompt | Lint | Check | Score | Gaps found → fixed |
|---|---|---|---|---|---|---|
| 2026-11-22 | 26c4949 + uncommitted, after the fixes above | 3. Work report | PASS | Ready | 8/10, one judge | Kit `changes` sample mirrored this prompt and added made-up details; "work report" unclear when the user describes the work; no rule for an unknown revision or command; deleting template blocks could trip the motion lint; motion with no chart unclear; stats without a denominator; `WARN` vs packet status words; open items repeated in findings and packet; kicker and dates unexplained. All fixed. |
| 2026-11-22 | 26c4949 + uncommitted | 2. Branching diagram | PASS | Ready | 9/10, one judge | Profile type sizes contradicted SKILL.md; shell vs diagram-design markup undecided; profile carried upstream sections that don't apply; no legend guidance; "no pause" rule put meta text on the page; standalone block unclear when rendering and publishing; geometry rules unchecked; kit base not identical to template (`--c1`..`--c4`). All fixed. |
| 2026-11-22 | 26c4949 + uncommitted | 1. Chart and findings | PASS | Ready | 9/10, one judge | `chart.mjs` help and feature list overstated; donut rounded 7.5% to 8%; `stacked` colors and `.note` lived outside their blocks; "one motion moment" clashed with per-component animations; packet rule unclear for analysis pages; no stats-vs-donut tie-breaker; derived numbers not covered; no layout check outside T3. All fixed. |
