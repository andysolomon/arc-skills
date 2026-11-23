# Reviews

Read at step 4, after the taste and motion rules are checked. A review is another skill that looks at finished work. Each one is optional: run the ones that are installed and fit the level, and name the rest as `NOT_RUN`.

**These rules win.** Every review below was written for another design system. When a finding contradicts a token or a rule in `arc-design`, dismiss it and name the rule that settles it. The clashes already known are listed, so nobody argues them again.

**Give each review a target.** Name the file, screen or URL to look at. The three from `emilkowalski/skills` answer with a fixed line and nothing else when they get no target. `review-animations` is user-invoked: an agent can't start it. Name it `NOT_RUN` and give the user the command, `/review-animations <target>`.

**Stay inside the request.** A review reports. Fix what the request covers and list the rest as open, so a restyle doesn't turn into a behaviour change.

| Review | Run it on | What it does | Dismiss these findings |
|---|---|---|---|
| `audit-ai-design-slop` | any level | Read-only. Reports five to eight findings: decoration stacked on decoration, the same block repeated, copy clutter, motion with no job, fake proof, plain defects such as low contrast or a missing state. | A finding against true black, the one pink accent, Geist or the small mono labels. Those are tokens. |
| `break-ui` | level 2 and up | Builds one worst-case data set and checks every screen with it at 320 px, the widest layout, 200% zoom, dark, and right-to-left. Reports before it fixes. | Its demo-data toggle is a dev aid and never ships. In a restyle, feed its worst-case data through the mock and add no toggle. A level 1 page has no script, so it doesn't apply to a page: the page kit's own maintainers test the kit with worst-case data. |
| `review-animations` | level 2 and up | Read-only. Checks ten standards and returns a before, after and why table. | "UI duration over 300 ms": `--t-enter` is 500 ms on purpose. "Keyframes on things triggered rapidly": each state has its own `@keyframes` name here. "Reduced motion, gentler not zero": here all motion sits inside `no-preference`. Any advice to add blur or a second easing curve. |
| `animation-performance` | level 3 and up, when motion drops frames | Names the cause before it changes code. Keeps motion on `transform` and `opacity`. | Its advice to use Framer Motion's React components. A Foldkit app has no React. |

## Install

```sh
npx skills add MengTo/Skills -g -y -s audit-ai-design-slop
npx skills add MengTo/Skills -g -y -s no-ai-design-slop   # the audit reads this skill's pattern list; don't run it
npx skills add emilkowalski/skills -g -y -s break-ui
npx skills add emilkowalski/skills -g -y -s review-animations
npx skills add emilkowalski/skills -g -y -s animation-performance
```

Both repos are MIT licensed.

## Read and left out

- `no-ai-design-slop` (MengTo/Skills) is installed only because the audit reads its pattern list. Don't run it: it edits the work, and that list counts a popular default font and a black ground as suspect. Both are tokens here.
- `remove-animations` and `find-animation-opportunities` (emilkowalski/skills) act on their own numbers: a 300 ms budget, a 150 ms hover cap and three easing curves. They also search for React and Motion component code. The motion rules in `arc-design` already say when something moves.
