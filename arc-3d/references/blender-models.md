# A model from Blender

Read this at step 4, only when the scene needs a shape that code can't build. The default is geometry built in code, which is what the overlay uses.

**Status.** `NOT_RUN`. Blender is not installed on the machine this skill was written on, and neither is the `blender-skills` plugin. Nothing below was run. The facts about `blender-skills` come from its README and its `blender-export-pipelines` skill (version 1.2.0), fetched from the repository at commit `1a1cc6c49312` on 2026-11-23. The loader names were checked against the pinned `three` 0.187.0 package; loading a real file was not. Check the current docs before relying on any of it, and replace this notice with what you ran.

## The tool

[blender-skills](https://github.com/EL4CTEO/blender-skills) (MIT) is 28 agent skills for Blender. Its README says they are built for Blender 5.2 LTS or later and verified on 5.3.

- **When it is installed**, load `blender-core` first, as its README says, and follow its own workflow. Installed means the skills `blender-core` and `blender-export-pipelines` are listed and `blender --version` answers 5.2 or later. This skill only adds the rules under "Into the scene" below.
- **When it is not installed:** say so in one line and build the shape in code. Don't hand-write a model file, and never download a stock model.
- **Install**, when the user asks for it. In Claude Code: `/plugin marketplace add EL4CTEO/blender-skills`, then `/plugin install blender-agent-skills@blender-agent-skills`. For any other agent, clone the repository and run `install/install.sh`. Blender itself is a separate install.

Without a Blender MCP server, its README says the agents run Blender in the background, so no open Blender window is needed.

## Out of Blender

From `blender-export-pipelines`:

1. Run `blender-asset-qa` before exporting, and `blender-game-optimization` for budgets.
2. Export with the `web` preset. The skill's example is `scripts/export_asset.py -- --preset web --collection Export --out //export/scene.glb`.
3. The `web` preset writes one `.glb` file (glTF 2.0, binary, textures inside) with meshopt compression and WebP textures. `--draco` switches to Draco, which the skill calls smaller for static meshes and slower to decode.
4. Read what the export script returns. The skill says it reports `ok`, the file size and, for a `.glb`, a summary of meshes, materials, images, animations and triangles. Compare that with what you expected. It also names the Khronos glTF Validator for a second check.

glTF is Y-up, in metres and right-handed. The skill says the exporter converts from Blender's Z-up, so the model needs no rotation in the scene.

## Into the scene

| Question | Rule |
|---|---|
| File format | One `.glb` per model. |
| Where it lives | `src/scene/models/<name>.glb`, committed with the app. Import it in `scene.ts` as `import url from "./models/<name>.glb?url"`, so Vite gives it a hashed name and the Worker serves it from the app's own origin. Add `declare module "*.glb?url"` next to `css.d.ts`. Never load a model from another site. |
| Blender source | Keep the `.blend` file out of `src/`. Put it in a `models-src/` folder or outside the app. |
| How it is loaded | `GLTFLoader` from `three/addons/loaders/GLTFLoader.js`, with `setMeshoptDecoder(MeshoptDecoder)` from `three/addons/libs/meshopt_decoder.module.js`. Both exist in `three` 0.187.0. Import them in `scene.ts` only. |
| When it is loaded | Inside the Mount's acquire, after the `scene.ts` chunk. Call `loader.loadAsync(url)`, then build the scene. The "Loading the chart…" screen already covers the wait. A failed load is a `FailedStartScene`, so the fallback shows. |
| Disposal | The release must free what the file brought. Walk the loaded object and dispose every geometry, material and texture. The browser test's "0 geometries after dispose" check then covers the model too. |
| Size budget | 2 MB per `.glb` and 5 MB for all models in one scene. `blender-export-pipelines` gives a range for the web: a hero model of 2 to 5 MB, a whole scene of 10 to 20 MB, textures of 1k to 2k, and 50 to 100 draw calls at most on mobile web. This skill takes the low end, because the model sits inside an app screen and is not the whole page. These budgets are a starting rule, not a measurement. Measure with `arc-webgl-performance` and change them with the numbers. |
| Colour | A model in a data scene brings shape, not colour. Export it without textures and give it materials painted from the Palette in `tokens.ts`, so it follows the tokens in both colour schemes. Keep a model's own textures only when its real look is the data, such as a product. Then set the renderer's tone mapping to match Blender's view transform, as the skill says (`NeutralToneMapping` for Khronos PBR Neutral), and say in the reply that those colours are not tokens. |
| Renders and textures | A still render or a baked texture is a file a maker tool outputs, not a level. Embed it as an image at any level. It needs no scene. |

## What to report

Say which of these ran: the plugin was installed, Blender's version, the export preset, the file's size against the budget, and whether the browser test passed with the model in the scene. Anything not run is `NOT_RUN`.
