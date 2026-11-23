# Release gate: fresh agents

Before merging a change to this skill, `arc-design`, or the template, give a fresh agent the skill folders and nothing else, and one of the prompts below. It works in a temp folder, never deploys, and reports what it built, every check with its real result, and a gap list: every place the skill was unclear, wrong or missing something. Fix the gaps, then record the run.

## Prompts

1. **New app (arc-web-production):** "Build me a small web app to track the books I'm reading. I can add a book by title, and mark a book as finished. I'll be using it for months, so make it a real app with tests."
2. **Restyle (arc-design):** give it a copy of the template with an off-brand stylesheet (a web font, hex colours, a gradient, `transition: all`, an infinite animation, one shared keyframes name, a 320 px min-width input) and say: "This is my team's notes app. People add notes to it every day and it has to keep working. It doesn't look or move like the rest of our stuff. Restyle it so it follows our design rules. Don't change what it does."

## Score

Out of 10: how well the skill alone got the agent to a correct result. The bar is 8. A run below the bar is fixed and run again.

## Record

Newest first.

| Date | Skill commit | Prompt | Result | Score | Gaps found → fixed |
|---|---|---|---|---|---|
| 2026-11-23 | 3ca72e2 + uncommitted | 2, restyle | Layer and tokens right, behaviour unchanged, Geist bundled, browser checked at 390 and 1280 in both themes (47 screens), two reviews run (`audit-ai-design-slop`, `break-ui`) | 8 | 18 found. Fixed: the baseline check failed on the off-brand stylesheet and the skill said to stop, so a restyle now has its own baseline; a restyle may add the font bundle; the template scrolled sideways at 320 px, and 320 px is now a rule and a step 9 check; the style lint now rejects a removed outline and text under 12 px; the lint counted only the first reduced-motion block; `review-animations` can't be started by an agent, which `reviews.md` now says; a review stays inside the request; the audit's pattern list lives in a skill that wasn't installed. Not fixed: there are no tokens for type size, spacing or radius, an existing app has no way to pick up template fixes, and control borders in `--line` are below 3:1. |
| 2026-11-23 | 3ca72e2 + uncommitted | 1, new app | Working reading-list app, 28 tests, API checked against the mock and the local Worker, browser checked in every state at 390 and 1280 in both themes (32 of 32), data kept across a restart | 8 | 17 found. Fixed: the template scrolled sideways at 390 with one unbroken 300-character note; light `--ok` was 4.33:1 as text and is now 4.85:1; the mock lacked the Worker's id and length limits and `api-check.ts` now tests them; step 2 checks the baseline before the rename and lists every place the name and the route live; the copied CI workflow is named; how to stop `cf:dev` from a script; the states step 9 must show; the Enter key while Add is disabled; an app that is never deployed; which checks the report lists; reviews named in step 7. Not fixed: no browser script ships with the template, so the agent wrote its own. |
| 2026-11-23 | 0b1bb98 | 2, restyle | Layer and tokens right; behaviour unchanged; browser checked at 390 and 1280 | 7 | 17 found. Fixed: an existing-app and restyle path, the loop between the two skills, a style lint (`npm run lint:styles`), state recipes for the browser check (mock switches), port variables and how to stop `cf:dev`, the token copy rule and a role for each token, the lockfile, the template's transition outside the motion guard, and the 65-character rule scoped to prose. |
| 2026-11-23 | 0b1bb98 | 1, new app | Working app, 12 tests, Worker API checked by hand, browser checked at 390 and 1280 | 7 | 23 found. Fixed: a template bug (a failed save the server kept never cleared), a step for the API with `api-check.ts`, Command tests with a stub client, rules for writes on existing items and keys in the URL, a pitfalls section, the full Scene matcher list, a copy command and rename list, and sign-in named before a deploy. |

The two runs of 2026-11-23 against `0b1bb98` were not repeated. The runs against `3ca72e2 + uncommitted` are those repeats, on the skill as fixed since.
