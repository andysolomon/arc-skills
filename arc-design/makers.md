# Makers

Read when a level needs a diagram, an illustration, a still, a figure, a film or a 3D asset. A maker outputs a file. It has no level of its own: a level embeds or links what it makes.

Every maker is optional. When its skill or tool isn't installed, say so and use the fallback in the last column. Never hand-build something that passes for the maker's output.

| Maker | Makes | Shown from | Wired in by | How it takes the look | Without it |
|---|---|---|---|---|---|
| `diagram-design` | SVG diagrams | level 1 | `arc-html-response` | Its profile `diagram-profile.md` maps each diagram role to a token. | The kit's `diagram` shell, drawn by hand. |
| Illustration cards (`illustration-isometric-mono`, `illustration-teal-spot`, `illustration-line-interior`, `illustration-halftone-line`) | One SVG card a page, only on request, when no figure fits the idea | level 1 | `arc-html-response` | The kit's colour map for each style recolours the card from the page tokens. | No illustration. |
| `stageshow` | A still of an interface that doesn't exist yet or isn't ours | level 1 | `arc-html-response` | `stage.mjs` captures it, scopes its CSS and follows the page's colour scheme. | No still. Our own apps are shown by a screenshot. |
| `arc-article-to-images` | Article covers and carousels as PNG | level 1 | itself | It doesn't. It has its own field-notes style, kept apart from `tokens.css`. | Not applicable. |
| hairline (`hairline-create`, `@lucasmarkes/hairline`) | A line figure that answers the pointer | level 1 as a captured still, level 2 and up live, because the live figure runs script | `arc-html-response` for the still, `arc-interaction` for the live empty state | The page kit maps the figure's classes to tokens. In an app its six `--hairline-*` properties are set from tokens. | On a page, a card or no illustration. In an app, the empty state's sentence alone. |
| HyperFrames (`hyperframes`) | An MP4 film rendered from HTML | any level, as a link or an embedded file | [film.md](film.md) | Composition variables that carry the token values, a copied design spec, and bundled Geist. | No film. Say so. |
| `blender-skills` | 3D models, textures and renders | level 5 | `arc-3d` | `arc-3d` reads scene colours from the tokens. | Geometry built in code. |
| `dream-loop` | A build, screenshot and compare loop for a scene | level 5 | `arc-3d` | Its target prompt carries the tokens. | The same loop against a written target. |

## Rules for every maker

- **The file is the output.** A page links a film. A page shows a still or an SVG inline. An app may embed any of them.
- **One accent still holds.** `--hi` marks the one thing a picture is about, in a figure as in a chart.
- **Real data only.** A number or a name in a still, a film or a scene comes from the work, or the caption says it is illustrative.
- **A maker's own timing stays its own.** hairline's figures move on its engine's clock, and a film moves on HyperFrames' timeline. The timing tokens govern pages and apps.
- **No loop that runs by itself.** hairline's `play` option and a looping film on a page are decoration. Leave `play` off, and let a film start when the reader starts it.

## Install

```sh
npx skills add MengTo/Skills -g -y -s illustration-isometric-mono   # and -teal-spot, -line-interior, -halftone-line
npx skills add benjitaylor/skills -g -y -s stageshow
npx skills add lucasmarkes/hairline -g -y -s hairline-create
npx skills add lucasmarkes/hairline -g -y -s hairline-adopt
npx skills add achimala/dream-loop -g -y -s dream-loop
npx skills add heygen-com/hyperframes -g
```

`diagram-design` installs from its own repo (see `arc-html-response`). `blender-skills` needs Blender 5.2 or later on the machine first.
