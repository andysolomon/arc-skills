# Release gate: the fresh-agent test

Unit tests prove the scripts work. They don't prove an agent can follow the skill. Before merging a change to `SKILL.md`, `template.html` or `components.html`, hand the skill to agents that have never seen this repo and check what they make.

The idea comes from MengTo/Skills: after writing each illustration skill, its author had a fresh agent draw a new card from that skill's folder alone, and every test exposed something missing.

## How to run it

0. Build the worst-case page (`node tests/worst-case.mjs <out.html>`) and preview it at 390 (light) and 728 (dark) with animations off. Nothing may widen the page, overlap, or get cut off. It feeds every kit component realistic worst data: an unbreakable German compound, a 64-character email, a 100-character path, zero, exactly one, 1,284,000, right-to-left text. The method comes from break-ui in emilkowalski/skills.
0b. Capture a gold still. In an installed stageshow folder run `npm install` and `npm run dev`, then `node scripts/stage.mjs --stageshow <dir> --url "<playground>/?capture=static-card&still=1" --slug card --label "Illustrative: a customers list" --theme both --out <scratch>/card`. Paste the kit's `stage` block and the two outputs into the template. The page must pass the lint and show the wide design at 728 (dark) and the compact one at 390 (light), with no page-level horizontal scroll. Do it again with `hero-demo`, which has icons and is wider than T3's frame.
1. Start one fresh agent per prompt below, in parallel. No conversation history, no hints beyond the brief.
2. Give each the same brief: the absolute path to this skill folder, the prompt, and an output path in a scratch folder. Tell it to read `SKILL.md` first and to follow it, to skip publishing and inline rendering, and to report which skill instructions were unclear or missing.
3. When they finish, check every page yourself; don't trust the agents' own reports:
   - `bash scripts/lint.sh <page>` prints `PASS`.
   - `cd ~ && npx -y postplan@0.0.6 check <page>` prints `Ready.`
   - Preview at 728 and at 390 (light): no page-level horizontal scroll, nothing clipped, readable in both themes.
   - A page with an entrance: the agent ran `scripts/frames.mjs` and previewed the sheet, and the poster frame shows the finished visual.
   - Score it with the rubric below.
4. Fix the skill for every gap a run exposed, then run that prompt again with a new fresh agent.

## Prompts

Each one exercises a different part of the skill. Real data is in the prompt so the agent has nothing to invent.

1. **Chart and findings.** "Our build times last week were: esbuild 1.4 s, Vite 3.2 s, webpack 11.6 s, Rollup 4.7 s. CI flakes: 5 of 60 runs failed on the e2e suite, all on the login spec. Write me a short report on where the build time goes and what to fix first."
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
| 2026-11-23 | 3ca72e2 + uncommitted, after the fixes below | 2. Branching diagram, rerun | PASS | Ready | 9/10, one judge | 13 found, against 17 the first time. Fixed: 720 was too wide for a 728 preview, so the viewBox is 680 and no wider; the focal node goes in the first 340 px; a legend is required with two kinds of node; the `ext` treatment was near invisible in dark; a `chosen` style for the option the user picked; a name-only node; the kit example's label gap. Not fixed: the lint doesn't say whether diagram-design's self-check ran, and the headless preview has no fixed place to load Playwright from. |
| 2026-11-23 | 3ca72e2 + uncommitted, after the fixes below | 1. Chart and findings, rerun | PASS | Ready | 9/10, one judge | 12 found, against 15 the first time. Fixed: reviews were required by `arc-design` and optional here, so a page now names only the reviews it ran; a wrong pointer from `reviews.md` to `worst-case.mjs`; plain lists ran past 65 characters; a rule for the title and the headline accent; a relative date in the user's own data; `chart.mjs bars` needs the `details` block too. |
| 2026-11-23 | 3ca72e2 + uncommitted | 3. Work report | PASS | Ready | 9/10, one judge | 21 found. Fixed: Design named as the page's look step, with reviews reported in the packet and never in chat; `check-tokens.mjs` added to Check it and both path placeholders defined; the packet's `evidence` lines named; `NOT_RUN` with "not recorded" for a check with no record; a two-section work report allowed; a kicker rule for a request with no project; the template's packet comment; the example total, which matched this prompt; a headless-browser preview path. Not fixed: `NOT_RUN` stays in the dim colour, and the lint still doesn't check the status words. |
| 2026-11-23 | 3ca72e2 + uncommitted | 2. Branching diagram | PASS | Ready | 9/10, one judge | 17 found. Fixed: the stale claim that diagram-design has no geometry checker; the kit's diagram example, which failed that checker; four missing node treatments in the shell; `loop` defined as flowing dashes only; a recipe for a CSS `reveal`; the legend wording; a phone rule for the focal node; `data-label` for stacked table cells; what to do when nothing follows a decision. Not fixed: the shell still has no phone variant. |
| 2026-11-23 | 3ca72e2 + uncommitted | 1. Chart and findings | PASS | Ready | 9/10, one judge | 15 found. Fixed: a bar's value sat on the bar's own fill at low contrast, so the value now has its own ground; three kit animations used durations that weren't tokens; `dataviz` scoped to form and colour; what deleting a template block means; `check-tokens.mjs --help`; this prompt's numbers, which matched the kit's sample data. Not fixed: `--on-hi` is still absent from the page token block, because a page puts no text on the accent. |
| 2026-11-22 | 26c4949 + uncommitted, after the fixes above | 3. Work report | PASS | Ready | 8/10, one judge | Kit `changes` sample mirrored this prompt and added made-up details; "work report" unclear when the user describes the work; no rule for an unknown revision or command; deleting template blocks could trip the motion lint; motion with no chart unclear; stats without a denominator; `WARN` vs packet status words; open items repeated in findings and packet; kicker and dates unexplained. All fixed. |
| 2026-11-22 | 26c4949 + uncommitted | 2. Branching diagram | PASS | Ready | 9/10, one judge | Profile type sizes contradicted SKILL.md; shell vs diagram-design markup undecided; profile carried upstream sections that don't apply; no legend guidance; "no pause" rule put meta text on the page; standalone block unclear when rendering and publishing; geometry rules unchecked; kit base not identical to template (`--c1`..`--c4`). All fixed. |
| 2026-11-22 | 26c4949 + uncommitted | 1. Chart and findings | PASS | Ready | 9/10, one judge | `chart.mjs` help and feature list overstated; donut rounded 7.5% to 8%; `stacked` colors and `.note` lived outside their blocks; "one motion moment" clashed with per-component animations; packet rule unclear for analysis pages; no stats-vs-donut tie-breaker; derived numbers not covered; no layout check outside T3. All fixed. |
