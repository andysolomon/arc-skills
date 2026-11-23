# Film

Read when a request is for a film or a video. A film is a maker's output, not a level. A page links the file, and an app may embed it. HyperFrames makes it, so load its skills (`hyperframes`, `hyperframes-cli`) and follow its contract first. These rules are what this look adds. Each was checked by building a 7 second film on HyperFrames 0.9.86.

## Rules

- **HyperFrames picks the runtime.** It renders by seeking a paused timeline, so every frame is a function of timeline time. Each composition registers a paused GSAP timeline. So the page and app limits on motion (no GSAP, CSS first, the reduced-motion query) do not apply to a film. Two timing tokens carry over: `CustomEase.create("arc", "0.2,0.7,0.2,1")` is `--ease`, and an entrance takes 0.5 seconds, which is `--t-enter`.
- **Colours live in one attribute.** Declare one `color` variable per token in `data-composition-variables` on the `<html>` of `index.html`, with the token's name as its id (`bg`, `fg`, `hi`, `on-hi`). Scenes read `var(--hi)`. No colour literal appears anywhere else. Without that attribute the film renders white with no shapes.
- **Copy the design spec.** `cp <skill-dir>/film/design.md <film>/design.md`. HyperFrames' skill reads the first of `frame.md`, `design.md` and `DESIGN.md` at the film's root and takes its frontmatter as the brand's exact values. Its CLI never opens the file, so nothing compares the variables with it. Compare them yourself.
- **Bundle Geist and write it by name.** Copy `Geist-Variable.woff2`, `GeistMono-Variable.woff2` and `OFL.txt` from `arc-web-production/template/src/fonts/` to `assets/fonts/`. Declare both families in every file that uses them. Then write `font-family: "Geist"` or `"Geist Mono"` alone, with no stack and no variable:
  ```css
  @font-face { font-family: "Geist"; src: url("assets/fonts/Geist-Variable.woff2") format("woff2"); font-weight: 100 900; font-style: normal; }
  @font-face { font-family: "Geist Mono"; src: url("assets/fonts/GeistMono-Variable.woff2") format("woff2"); font-weight: 100 900; font-style: normal; }
  ```
  A system stack is swapped for Roboto and JetBrains Mono, fetched from Google Fonts. The token stacks fail lint (`font_family_without_font_face` on `SFMono-Regular`). A family that arrives through a variable hides a missing `@font-face`. Lint stays clean while HyperFrames fetches Geist from Google Fonts.
- **Black and Geist are ours.** HyperFrames' guidance bans a black ground and Geist as defaults, and allows both when the brand uses them. `design.md` says they are the brand's. Its check has no rule on either. The ban is on a black void with small things in its middle, so the subject fills the frame.
- **Text enters by opacity and position.** No blur, scramble or per-letter effect. Nothing in the check asks for one.
- **Motion shows an order, a direction or a size.** No loop, and no glitch, grain, aurora or camera shake from the registry. The check asks for none. It does warn when nothing changes for 3 seconds (`dead_stretch`) or at all (`sweep_static`), so spread the entrances across the film. Never add a loop to quiet it.
- **Three timed elements a file, at most.** Lint warns (`timeline_track_too_dense`) on a fourth element with `data-start`. Put related elements in one clip and time them in the timeline.
- **Read the warnings, not only `ok`.** `check --json` returned `ok: true` and exit 0 for a scene whose timeline was never registered. The only sign was a `dead_stretch` warning. The gate is `ok: true` with zero errors and zero warnings in every section.
- **Look at the frames.** Snapshot the last frame and one frame in the middle of an entrance, and read both. A check proves only what it measured.

## Commands

```sh
hf() { HYPERFRAMES_NO_TELEMETRY=1 node ~/.claude/skills/hyperframes/scripts/plugin-cli.mjs --cli-version 0.9.86 "$@"; }
hf init film --skip-skills --skill=hyperframes && cd film
hf lint                                         # while writing
hf check --json                                 # the gate
hf snapshot --at 0,1.3,4.35,6.9 --no-end --output snapshots
hf preview --background --no-open --port 4571   # Studio on 127.0.0.1; stop it with: hf preview --stop
hf render --quality looks -o pyramid.mp4
ffprobe -v error -show_entries stream=width,height,nb_frames -show_entries format=duration pyramid.mp4
```

`HYPERFRAMES_NO_TELEMETRY=1` turns usage events off. Drop it if the person wants them sent. The render must match the root's `data-width`, `data-height` and `data-duration`.

## Not verified

- A render with no network. HyperFrames' scaffold loads GSAP from jsdelivr.
- A move longer than one second, or one on a property other than `transform` and `opacity`. The test film used neither.
- CSS `@keyframes` in place of GSAP tweens. They seeked correctly in snapshots, with each delay counted from the enclosing clip's start, but that version was never rendered.
- Sound, captions, a second scene, a cut between scenes and a cloud render.
- Studio's Variables panel with a three-digit colour such as `#000`.
