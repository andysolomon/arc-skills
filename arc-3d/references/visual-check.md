# The visual check

Read this at step 9. The tests prove the scene draws, reacts and cleans up. They don't say whether it looks right. This check does. It takes a screenshot of the running scene in a real browser, compares it with a target, fixes what differs, and repeats until a stated condition says stop.

The loop comes from [dream-loop](https://github.com/achimala/dream-loop) (MIT, by Anshu Chimala), read from its README and `SKILL.md` at commit `9bddb901f7d0` on 2026-11-23. In dream-loop an image model draws a target frame, the agent builds toward it, and a separate critic compares a screenshot of the build with the target. This level keeps that shape and changes two things. The target is written first and drawn only when an image tool exists. And the look is fixed by `arc-design`, so the target can't drift from it.

**Status.** The written-target loop below was run on the overlay, three rounds, with screenshots at 1000 px dark and 390 px light. Round 1 failed composition (the chart filled a small part of the stage) and the table's toggle had no marker. Round 2 failed composition again (a bar hid one tick of the scale). Round 3 passed every line. Builder and critic were the same agent, so that is the weaker form of the check. Image generation is `NOT_RUN`, because no image tool was used. A critic subagent is `NOT_RUN`, because the skill was built without subagents. The `dream-loop` skill itself was not run.

## What the loop needs

| Need | With it | Without it |
|---|---|---|
| A real browser | Screenshots of the running app. Headless Chromium with `playwright-core` works; `test/scene.browser.mjs` shows how to launch it. | No check. Say `NOT_RUN` for step 9. |
| Vision (you can read an image) | You or the critic read the screenshot. | Compare only numbers. Use the browser test's pixel counts against the token values. Say that the picture itself was not looked at. |
| Image generation | A target image, drawn from the target prompt below. | The written target is the target. This is the normal case. |
| A subagent for the critic | A fresh agent judges each round, so the builder doesn't mark its own work. | Judge it yourself against the written checklist, one line per item, and say that builder and critic were the same agent. |
| The `dream-loop` skill | See "With dream-loop installed" below. | Follow this file. It needs nothing from that skill. |

## 1. Write the target

Before the first screenshot, write the target as a short list a critic can tick. It says what the picture must show, not how to code it.

- **Data:** which marks appear and what each position, size and colour means. Use real values from the app's current state ("4 bars; the second is the tallest at 56 characters").
- **Composition:** the camera's angle, what fills the frame, and what sits at the edges. Nothing is cut off at 390 px.
- **Look:** the fixed block below, word for word.
- **Not in the picture:** no text on the canvas, no gradient, no glow, no stock object, no background scenery.

The look block, taken from `arc-design`'s tokens. Copy it into every target and every image prompt, and fill the values from the app's own `src/tokens.css`:

```
Look (fixed): a true black page, #000. White text, #fff. One accent, pink #ff2e93, used for
one thing only. Secondary lines in grey #a1a1aa and #27272a. Series colours are #ff2e93,
#4f9dff, #2ec4b6 and #f5a524, and each has one stated meaning. Flat, unlit colour on faces:
no gradients, no glow, no reflections, no textures. Type is Geist or the system sans-serif,
and all of it is HTML outside the canvas. In the light scheme the page is #fbfaf7, text is
#141416 and the accent is #d1006b.
```

## 2. Draw a target image, only with an image tool

When an image tool exists, generate one image from the written target plus the look block. Follow dream-loop's rules for the prompt:

- Ask for a real screenshot of the running app at a stated size, such as 1000 by 800 in the dark scheme. Don't use the words "concept art", "cinematic" or "painting": dream-loop warns that the result is then an artist's view, not a target to match.
- When the scene already exists, give the current screenshot as the starting image, so the target improves on it and does not wander off.
- When the user supplies a target image, use theirs.

Then check the image against the look block before you build toward it. An image that breaks the look (a second accent, a gradient, text drawn in the scene) is a bad target. Regenerate it or fall back to the written target. Keep the image in `.dream-loop/target.png`, the path dream-loop uses, and add `.dream-loop` to `.gitignore`.

The image never overrides the tokens or the data. Where it disagrees with the written target, the written target wins.

## 3. Take the screenshot

- Run the built app with real data in the state the target describes (`npm run build`, the mock API, `vite preview`).
- Shoot the stage at the width it is shown at: 1000 px in the dark scheme and 390 px in the light scheme, at least.
- Wait until the canvas reports `data-scene-state="idle"`, so the shot is the resting frame and not a transition.
- Keep each round's file (`round-1-dark-1000.png`), so the next round can be compared with the last.

## 4. Judge

Give the critic the screenshot, the written target, the target image if there is one, and the last round's shot and verdict. The critic answers each line with `PASS` or `FAIL` and one sentence that says what to change:

1. **Data.** Every mark in the target is there, and none is extra. Positions and sizes fit the values.
2. **Tokens.** The background is `--bg`. Each fill is its token. The browser test's colour check passes.
3. **Composition.** The camera and framing fit the target. Nothing is cut off. At 390 px the marks can still be told apart.
4. **Restraint.** Nothing is in the picture that the data did not put there.
5. **Around the canvas.** The legend, the caption and the controls are HTML, readable, and agree with the picture.

A `FAIL` must name the thing and the fix ("the scale post is hidden behind the tallest bar, so move it to the left corner"). "It looks off" is not a verdict.

## 5. Fix, then repeat

Fix every `FAIL`, run `npm run check` and the browser test again, and go back to step 3.

## 6. Stop

Stop on the first of these:

- **Done:** every line is `PASS` at both widths and in both colour schemes, and `npm run check` and the browser test pass.
- **Stalled:** the same line failed in two rounds in a row. Stop making small changes. Rethink that part once (the camera, the layout, what the marks are). If it fails again, stop and ask the user, with the last screenshot.
- **Out of rounds:** three rounds are done. Report what still fails and ask before going on. dream-loop's Plus workflow also stops after three and asks.
- **Out of time:** the user gave a time limit and it has passed.

The stop conditions are adapted from dream-loop's exit rules. dream-loop scores out of 10 on composition, lighting, materials and details. This level uses `PASS` and `FAIL` lines, because its scenes are flat and unlit and the question is whether the data reads.

Frame rate is not part of this loop. dream-loop checks it; here it belongs to `arc-webgl-performance`.

## With dream-loop installed

When the `dream-loop` skill is listed and the user asks for it by name, or asks for a scene built to a target picture, load it and let it run its own loop, with these overrides so the result fits this level:

- **The look is not open.** Put the look block in its target prompt. A target that breaks `arc-design` is regenerated.
- **Real data only.** The target shows the app's own data. dream-loop builds toward a picture; here the picture must still be true.
- **Its asset steps stop at Blender.** A model follows [blender-models.md](blender-models.md). No downloaded assets.
- **Its workflows choose their own orchestrator.** Its Plus workflow tells very large models to stop and ask the user to switch to a smaller one. Follow what it says and tell the user.
- **This skill's tests still gate the result.** A scene that matches the target and fails `npm run check` or the browser test is not done.

When it is not installed, say so in one line and follow this file.
