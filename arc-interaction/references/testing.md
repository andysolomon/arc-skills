# Testing a gesture

Read this when you write the tests for a Mount. A gesture needs three kinds of test, because each one sees a different part.

| Test | Runs in | Proves | Can't see |
|---|---|---|---|
| Pure function | Node | The release rule and the velocity sum (`decideRelease`, `velocityOf`). | Anything in the DOM. |
| Story | Node | `update`: what a gesture's Message does to the Model, and which Command it asks for. | The view, the Mount. |
| Scene | Node | The Mount is in the view, and its Message changes the Model and the screen. | The Mount's body. A Scene has no DOM, so no pointer event and no animation ever runs. |
| Browser check | Chromium | The row moves, the spring runs, the neighbours travel, reduced motion, the figure. | Nothing about other browsers. |

All but the last are in `test/interaction.test.ts`. The last is `scripts/browser-check.mjs`.

## Story: the Message is a fact, `update` decides

- Send the gesture's Message (`SwipedAwayNote`) and assert the Command (`RemoveNote` with the note's id) and the phase.
- Send the button's Message (`ClickedRemove`) and assert the same.
- Test the double by calling `update` twice by hand. A Story refuses a new Message while a Command is unresolved.
- Cover the lost reply: a `Failed` removal whose note is gone from the next list load is cleared.

## Scene: the rules Mounts add

Found by running them against `foldkit` 0.171.0. `foldkit-rules.md` names the calls; these are the rules that bite.

- **A scene throws on an unresolved Mount**, at the next interaction and at the end. `Scene.Mount.expectHas` doesn't settle it.
- **A stream Mount counts.** `Mount.defineStream` is pending like any other.
- **One resolver settles one Mount.** Three rows need three resolvers. A Definition matcher (`[SwipeNote, message]`) settles only the first, so use an instance: `[SwipeNote({ noteId }), message]`.
- **Resolve with the Message that changes nothing.** That is what `CompletedAttachSwipe` is for. The overlay's helper does it for every row:

  ```ts
  const rowsReady = (...ids: ReadonlyArray<string>) =>
    Scene.Mount.resolveAll(
      [MoveRows, Message.CompletedMoveRows()],
      ...ids.map((noteId) => [SwipeNote({ noteId }), Message.CompletedAttachSwipe()] as const)
    )
  ```
- **To test the gesture's result, resolve its Mount with the gesture's Message**: `[SwipeNote({ noteId: "a" }), Message.SwipedAwayNote({ noteId: "a" })]`. Then assert the Command and that the row is gone.
- **A Mount that leaves the view must be acknowledged**: `Scene.Mount.expectEnded(SwipeNote)`. Use the Definition here, not an instance. Scene tracks same-named Mounts by position, so when the first row leaves it reports the last position as ended, with that row's args.
- **A new Mount can appear mid-scene.** Removing the last row brings the empty state and its `DrawEmptyFigure`. Resolve it before the next step.
- **Existing scenes break.** The moment a row carries a Mount, every scene that renders a row needs a resolve line. The overlay adds one to each of the template's two scenes in `test/app.test.ts`.

Find the figure by role and label: `Scene.role("img", { name: "An empty drawer" })`. That works because `view` sets both on the host.

## Browser check

```
npm run mock                                   # the API, memory only
npm run dev                                    # or: npm run build && npm run preview
npm install --save-dev --save-exact playwright-core@1.65.1
CHROME_PATH=/usr/bin/chromium npm run browser:check -- http://127.0.0.1:5173
```

It removes every note and writes its own, so it refuses any address that isn't loopback. Free ports first (`ss -ltn`). The servers read `PORT`, `WEB_PORT` and `API_URL`, as in `arc-web-production` step 9.

It runs 15 checks. The table groups them:

| Check | How it knows |
|---|---|
| The row follows the pointer | Reads the row's `translateX` while the mouse is held. The page's `scrollWidth` stays within the window. |
| A slow drag springs back | Samples `translateX` on every animation frame after the release. Some frames lie between the release point and home, the last ones are home, and no `DELETE` was sent. |
| A second touch takes the spring over | Presses 70 ms into the spring. The row is caught part way, stays there for 150 ms, then moves exactly as far as the pointer does. |
| A fast flick removes the note | An 80 px drag released while moving. The row passes its own width, one `DELETE` goes out, and the API no longer lists the note. |
| The neighbours move | Samples the next row's `translateY` per frame. It starts near one row height, ends at zero, and the row rests where the removed one was. Adding a note moves rows the other way. |
| The keyboard path | Focuses Remove and presses Enter. No pointer is used. |
| A drag from the button isn't a click | A short drag that starts on Remove springs back and removes nothing. |
| A press that ends outside the row | The next swipe on that row still works. |
| Touch targets and `touch-action` | Each row button is at least 44 px tall. The row's computed `touch-action` is `pan-y`. |
| Reduced motion | The row still follows. After a slow release no frame lies part way home. After a flick no frame shows the fly-off, and the row below is never transformed. |
| The figure | An SVG is drawn in a host with `role="img"` and the label. Its strokes and fill equal the computed `--fg`, `--dim`, `--line` and `--bg`, in dark and in light. It changes under the pointer, and doesn't under reduced motion. |
| Touch | Real touch events through the DevTools protocol. A vertical pan scrolls the page, the row stays, and the browser sends `pointercancel`. A sideways pan moves the row and the page stays. |

Extend it for a new gesture. The parts worth copying: `frames` samples a value on every animation frame, so start it before the action and await it after. `reset` gives each group of checks its own notes. The thresholds are imported from `src/interaction/constants.ts`, so the check and the app can't drift apart.

Three things made it flaky until they were fixed:

- A release while the mouse is still moving is a flick. Pause longer than `VELOCITY_WINDOW_MS` before a "slow" release.
- `Enter` right after `fill` meets a button that is still disabled. Click Add instead. Playwright waits until it is enabled.
- Compare to a threshold, not to an exact pixel, wherever a frame boundary decides the value.

## What stays `NOT_RUN`

Say so in the report, in those words:

- Firefox and Safari. The check drives Chromium only.
- A real phone. Touch is synthesised through the DevTools protocol.
- A screen reader. The check proves the role, the label and the keyboard path. It doesn't prove what is announced.
- DevTools time travel. The Mounts ignore `viewStateChanges`.

## Prove a test can fail

Before you trust a green run, break one thing in a temporary copy and see `FAIL`. Two that were run against this overlay: `DISMISS_VELOCITY` set to 500000 fails the browser check ("the row did not fly off"), and a wrong expectation in `test/interaction.test.ts` fails the tests step.
