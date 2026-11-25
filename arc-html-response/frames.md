# The frame sheet

Read this when you film a page: one with an entrance or a control, in step 6 of [SKILL.md](SKILL.md).

`node <skill-dir>/scripts/frames.mjs <file.html> --select "<main visual>"` writes `<file>.frames.html` next to the page: the page frozen at 0, 120, 240, 500 and 800 ms, then the poster. Each frame is labelled with how many animations run, the longest, and when they all settle. `--help` lists every flag.

- **What to select:** the element that holds the whole moving figure with its controls (`.toggle`, `.steps`, `.bars`), so a frame shows which state is on.
- **Controls:** add `--states` with the selector of each control's input, separated by `;` (`--states 'input[name=read-step][value="2"];.toggle input'`), to add one settled frame per state.
- **Size:** frames are 560 px tall; set `--height` to the figure's own height, lower for a small one and higher for a tall one. `--width 390` films the settled figure at phone width, which the 390 preview catches mid-entrance.
- **A second moving figure:** run it again with another `--select` and its own `--out <name>.frames.html`, or the first sheet is overwritten.
- **View it:** `html_preview` that one file at the width the script prints. The preview captures the first 4000 px, so split a longer sheet across runs with fewer `--at` times or fewer `--states`, each with its own `--out`. Without `html_preview`, screenshot the sheet in a headless browser with scripts on, after a second's wait.
- **Read every frame:** the stagger runs in order, nothing jumps between frames, the poster holds up alone, and every state shows its step or its new values. A label in red means one animation runs past 1s.
- **Preview only:** the sheet runs a script to freeze the frames. Never render, lint or publish it, and leave it out of anything you publish.
