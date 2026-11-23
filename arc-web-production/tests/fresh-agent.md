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
| 2026-11-23 | 0b1bb98 | 2, restyle | Layer and tokens right; behaviour unchanged; browser checked at 390 and 1280 | 7 | 17 found. Fixed: an existing-app and restyle path, the loop between the two skills, a style lint (`npm run lint:styles`), state recipes for the browser check (mock switches), port variables and how to stop `cf:dev`, the token copy rule and a role for each token, the lockfile, the template's transition outside the motion guard, and the 65-character rule scoped to prose. |
| 2026-11-23 | 0b1bb98 | 1, new app | Working app, 12 tests, Worker API checked by hand, browser checked at 390 and 1280 | 7 | 23 found. Fixed: a template bug (a failed save the server kept never cleared), a step for the API with `api-check.ts`, Command tests with a stub client, rules for writes on existing items and keys in the URL, a pitfalls section, the full Scene matcher list, a copy command and rename list, and sign-in named before a deploy. |

Neither run has been repeated against the fixed skill yet.
