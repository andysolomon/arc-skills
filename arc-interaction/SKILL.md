---
name: arc-interaction
description: Builds the gestures CSS keyframes cannot do in a Foldkit app - a drag or swipe that carries its velocity, a layout move where neighbours travel to their new places, and a spring the user can interrupt - with Motion's plain animate() inside a Foldkit Mount, a labelled button for every gesture, and a real-browser test. Use when asked for swipe to dismiss, drag, reorder, rows that slide into place when a list changes, a spring that can be caught mid-flight, or an empty-state figure, in an app built on arc-web-production. Not for hovers, fades and entrances (plain CSS, arc-web-production), scroll-driven animation, text effects, decoration, live connections (arc-realtime) or 3D scenes (arc-3d).
---

# Interaction

This skill builds level 3 of `arc-design`'s pyramid. It starts from `arc-web-production`'s template and adds to it; it never replaces it. [overlay/](overlay) is the working example, on the template's notes app: a note row you swipe away, rows that travel when one is added or removed, and an empty-state figure. Each addition to a template file is marked `arc-interaction`.

Level 3 exists for three cases CSS can't do: a drag or swipe that carries its velocity, a layout move, and a spring the user can interrupt. Everything else stays CSS on the timing tokens, which is level 2.

It is not for decoration: no scroll-driven animation, no text effects, no hover springs, no animation that shows no state change.

## Steps

1. **Name the case.** Say which of the three it is and which state change it shows. If it is none of them, say so, build it as level 2 CSS by `arc-web-production` step 7, and stop here. Completion: one sentence names the case and the state change, or says the request is level 2.
2. **Start from a passing app.** Do `arc-web-production` steps 1 and 2: a new app from its template, or an existing app in that shape. Completion: `npm run check` passes before you change anything.
3. **Add the overlay.** Run `bash <skill-dir>/scripts/apply-overlay.sh <app-dir>`. It copies `overlay/`, installs the two pinned packages, and adds the scripts `lint:interaction`, `browser:check` and `preview`. If the app has changed a template file the overlay replaces, it writes nothing and lists the files: copy the overlay's new files, then merge the marked additions into those by hand. Keep the parts the request needs (swipe, layout move and figure are separate Mounts) and delete the rest. Completion: `npm run check` passes with the overlay in.
4. **Write the facts before the gesture.** Read [references/interaction-rules.md](references/interaction-rules.md) now. The Model stays the truth. The gesture ends in one past-tense Message, `update` decides what it means, and the write it starts follows the template's rules (a phase union, the item's id as the key). Add the labelled control that sends the same intent, because a gesture is never the only way. Completion: both Messages reach one branch of `update`; the Model holds no offset, velocity or dragging flag; `update` ignores the second of a swipe and a click on the same item.
5. **Write the DOM code, then its Mount.** DOM code is a plain function in `src/interaction/` that returns its own cleanup. The Mount in `src/mounts.ts` builds it inside `Effect.acquireRelease`. Motion is imported only in `src/interaction/motion.ts`, and every call checks reduced motion first, because `animate()` doesn't. Spring and velocity numbers go in `src/interaction/constants.ts`, each with its reason. Only `transform` and `opacity` move; the element sets `touch-action` and uses pointer capture. Completion: `npm run lint:interaction` passes.
6. **Apply the look.** Read `arc-design`'s "The look", "Taste rules" and "Motion" sections and follow them; don't run its routing steps. Every state has a screen: loading, empty, failure and stale from the template, plus dragging, returning, leaving and a failed write. Every control has a label. Touch targets are at least 44 px tall. Under `prefers-reduced-motion: reduce` the element may still follow the finger, and the release ends at once. Completion: `npm run lint:styles` passes, including `src/interaction.css`, and `node <arc-design>/scripts/check-tokens.mjs src/tokens.css` passes.
7. **Test without a browser.** Read [references/testing.md](references/testing.md) now. A Scene throws on any Mount it hasn't resolved, so existing scenes need a line too. Write a Story for `update`, a Scene that shows the Mount is present and that its Message changes the Model, and a plain test for each pure function. Completion: `npm run check` passes, and one wrong expectation in a temporary copy was seen to fail.
8. **Test in a real browser.** A Scene has no DOM, so it can't see anything move. Extend `scripts/browser-check.mjs` for the new gesture and run it against the mock: the element follows the pointer, a fast release and a slow release end differently, a second touch takes a spring over, the neighbours travel, reduced motion skips the animation, nothing scrolls sideways at 390 px. Completion: `npm run browser:check -- <url>` passes, or the reply says `NOT_RUN` and why. Firefox, Safari, a real phone and a screen reader are `NOT_RUN` unless you ran them.
9. **Report** through `arc-html-response`, ending with its packet. Completion: every check is labelled `PASS`, `FAIL` or `NOT_RUN`, and the report names the case from step 1.

## Pins

`scripts/apply-overlay.sh` installs both with `--save-exact`. Don't raise a pin as a side effect of other work, and keep `arc-web-production`'s pins as they are.

- `motion` 14.14.0. The version the Mount test ran against. Its behaviour under reduced motion and on `stop()` was found by test, not from its docs, so a new version needs the browser check again. Import `animate` from `"motion"`, never from `"motion/react"`.
- `@lucasmarkes/hairline` 0.5.1. Pre-1.0. Use its plain DOM entry, never `"/react"`. React is an optional peer of both packages and must not be installed.
- `playwright-core` 1.65.1, a devDependency for the browser check only. It needs a Chromium or Chrome at `CHROME_PATH`.

## Maintaining this skill

After changing the overlay, or after `arc-web-production`'s template changes, run `TMPDIR=<a folder with room> bash <skill-dir>/tests/test-overlay.sh`. It copies the current template, runs `npm ci`, applies the overlay, and runs typecheck, tests, both lints, the build, the static render, the API check and the browser check. It needs the network. With no browser on `PATH` and no `CHROME_PATH`, the browser step prints `SKIP`.

Its second step fails when the template has changed one of the nine files the overlay replaces. Merge that change into the overlay's copy, then record the new base with `bash <skill-dir>/scripts/record-base.sh`.
