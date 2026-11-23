---
name: arc-web-production
description: Builds web apps that last, on the Effect stack - Foldkit (The Elm Architecture on Effect v4, no React), Vite, tests that run without a browser, and an Alchemy stack that deploys to Cloudflare. Use when asked to build, extend, test or ship a real web app, dashboard or frontend; when a Lakebed prototype has outgrown Lakebed; or to render app data as a script-free page. Not for one-off answers and reports (arc-html-response), throwaway shared-state prototypes (Lakebed, through arc-html-response), or screens inside a Salesforce org.
---

# Web production

A web app here is a Foldkit program: one Model, Messages as facts, a pure `update`, a pure `view`, and side effects as Commands. [template/](template) is a small working app in that shape with its tests, a mock API, a static render and a Cloudflare stack. Start from it; don't start from a blank folder or from React.

## Steps

1. **Pick the rung.** Choose the lowest one that serves the request, and say which in one line.
   - Nobody types into it: render a pure view once to a page with no script (`npm run static`), then publish it by `arc-html-response`'s rules.
   - People type into it, but it is a throwaway or a quick try: a Lakebed capsule. Follow `arc-html-response`'s `lakebed.md`, not this skill.
   - It must last, needs npm packages, or needs its own domain: a Foldkit app. Continue below.

   Completion: the rung and its reason are stated.
2. **Copy the template and prove it works before changing it.** Copy `template/` to the project, then run `npm install` and `npm run check`. Completion: typecheck and all tests pass on the untouched copy. If they don't, stop and report that, because the installed versions have drifted from the pins.
3. **Design the states before the screen.** Write the Model and Messages first. Read [references/foldkit-rules.md](references/foldkit-rules.md) now; it holds the rules for Model, `update`, Commands, `view`, and the pitfalls. Completion: every remote value is an `AsyncData`, every write the user can start has a phase union and an idempotency key in the Model, and every Message is a past-tense fact.
4. **Write `update` and the Commands.** Completion: `update` reads no clock, randomness or network; every Command turns its failures into a Message; a write is retried only because its body carries the key.
5. **Write `view`.** Completion: loading, empty, failure and stale each render something specific; every control has a label; lists are keyed by a Model identity; error text is a plain sentence.
6. **Apply the look.** Load `arc-design` and follow it. Keep `src/tokens.css` as an unedited copy of `arc-design/tokens.css`, and style with tokens only. Completion: `src/styles.css` has no hex colour and no one-off duration, every animation sits inside the reduced-motion guard, and each animated state has its own `@keyframes` name.
7. **Test without a browser.** Story for `update`, Scene for `view`, one direct `update` call for anything with two requests in flight. Add a test for each new write: the key is minted before the send, a double submit sends nothing, a retry reuses the key. Completion: `npm run check` passes, and one deliberately wrong expectation was seen to fail.
8. **Look at it.** Run `npm run cf:dev` (the real Worker on local workerd, no account needed) or `npm run mock` with `npm run dev`, and open it at 390 px and at desktop width, in light and dark. Completion: no sideways scroll at 390 px and the states look right, or the reply says `NOT_RUN` for the browser check.
9. **Deploy only when asked.** A deploy creates a public URL, so confirm first. Follow [references/deploy.md](references/deploy.md). Completion: the URL answers, a note saved twice with the same id is stored once, and the reply gives the URL and the destroy command.
10. **Report** through `arc-html-response`, ending with its packet. Completion: every check is labelled `PASS`, `FAIL` or `NOT_RUN`.

## Pins

The template pins `foldkit` 0.171.0 exactly, `effect` to `~4.1.4`, `@foldkit/vite-plugin` 0.29.1 and `alchemy` 2.0.0-beta.87. Foldkit and Alchemy are pre-1.0, and Foldkit's peer range is `effect ~4.1`. Don't raise a pin as a side effect of other work. Effect here is v4: most examples online are v3 and won't compile, so read `node_modules/effect/ai-docs` instead of answering from memory.

## Maintaining this skill

After changing the template, run `bash <skill-dir>/tests/test-template.sh`. It copies the template to a temp folder, installs, typechecks, runs the tests, builds, renders the static page and lints it. It needs the network.
