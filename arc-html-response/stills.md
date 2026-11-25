# Product UI stills (opt-in)

Read this when the page's subject is an interface (a report on a UI change, a design proposal, a feature walkthrough), or when the user asks for a UI still or an animated product demo. In every other case a page shows no product UI. One still per page, and it doesn't move.

- **One of our own apps:** a still of an app we built (with `arc-web-production`) is a screenshot of the real, running app, not a Stageshow build. Shoot it at the width it is shown at, in the page's dark theme (add a light shot only when the light look matters), with real data. Headless Chromium driven by Playwright works. Embed it as an `<img>` with a `data:` PNG source and `alt` text that says what it shows, and name the width and theme in a `figcaption`. Shots at 390 and 728 px ran 10 to 25 KB each. A screenshot needs neither the kit's `stage` shell nor the size warning below.
- **Any other interface** (one that doesn't exist yet, or isn't ours): stills come from the `stageshow` skill ([benjitaylor/skills](https://github.com/benjitaylor/skills/tree/main/stageshow), MIT; `npx skills add benjitaylor/skills --skill stageshow`). Load it and follow its own workflow through its rehearsal (`film.mjs --gate`, ending in `rehearsal passed`). Build a still, or a demo with a `poster`: the poster is the frame that gets captured. If it isn't installed, say so and skip the still. Never hand-build a faux UI.
- **Capture:** Stageshow's output is a React component, which a page can't run, so [scripts/stage.mjs](scripts/stage.mjs) renders it in headless Chrome and copies out the laid-out result. Start Stageshow's playground (`npm run dev` in its folder; it needs `npm install` there first), or the host app's own route, then:

  ```sh
  node <skill-dir>/scripts/stage.mjs --stageshow <stageshow-dir> \
    --url "<playground>/?capture=<example>&still=1" --slug <slug> \
    --label "<what the still shows>" --theme both --out <scratchpad>/<slug>
  ```

  It writes `<slug>.css` and `<slug>.html`: the DOM with only the CSS rules it uses (Stageshow's `@layer` kept), scoped to `.stage-<slug>`, local images inlined as `data:` URIs, icons marked `aria-hidden`, no script. It needs Chrome (`CHROME_PATH`, else the installed Chrome) and loads `playwright-core` from the stageshow folder. `--help` lists every flag.
- **Embedding:** copy the kit's `stage` CSS block, paste `<slug>.css` after it inside the page's one `<style>`, and put `<slug>.html` where the still goes. Don't edit the captured markup: change the still in Stageshow and capture it again.
- **Fit:** the size follows the frame's own width (a container query), so one still fits T3's thread and a full-width Postplan page. It steps the zoom down to 75% before it swaps to the compact design. `--theme both` captures the light and dark themes and swaps them with the page's color scheme. A still with no compact design scrolls inside its frame on phones. The script warns when this happens; give the still a compact design in Stageshow (Stageshow asks for one anyway).
- **Budget:** with both themes and both sizes, Stageshow's `static-card` came to 35 KiB and `hero-demo` to 71 KiB. The script prints the size and warns past 150 KiB.
- **Caption:** `--label` becomes both the frame's `aria-label` and its `figcaption`. A still is illustrative: its names and numbers are filler unless you put real ones in, so say so in the label ("Illustrative: …").

## An animated product demo

A Stageshow demo with its cursor, or any React component, needs a script and npm packages, so it never goes on a page, scripted or not, not even rebuilt as CSS keyframes.

- Put its poster on the page as a still (above) and link the running demo with an ordinary link.
- Host its built files the way `arc-web-production` deploys (its `references/deploy.md`: a Worker with static assets in an Alchemy stack). It stays a React demo; don't rebuild it as a Foldkit app.
- Confirm before deploying it: a deploy creates a public URL.
