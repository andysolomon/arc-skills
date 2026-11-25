# Charts

Read this when the page has a chart: `bars`, `line`, `donut`, `units`, `stats`, `stacked` or `heat`.

- **Plot real numbers from this session, and don't compute coordinates by hand.** [scripts/chart.mjs](scripts/chart.mjs) prints ready markup:
  - `bars`: scaled widths, an aria-label, a raw-numbers table. With `--then`, the second state inside a `toggle`. `--note "label=text"` writes the `annotate` note.
  - `line`: nice axis ticks, title, desc, a hover read-out per point, a raw-numbers table.
  - `donut`: title, desc, the share with its denominator.
  - `units`: one cell per item, `--tone bad` when the cells are a status. Its key carries both counts, so it needs no raw-numbers table.

  `node <skill-dir>/scripts/chart.mjs --help` lists every flag. Edit the output only to add what no flag makes. It prints markup only, so also copy the matching CSS block from the kit, and the `details` block for the raw-numbers table it adds.
- **Show the scale:** axis labels or a value on each mark.
- **`stats` or `donut`?** A single share with a small denominator ("3 of 40 runs") reads better as a `stats` tile. Use a donut when the share itself is the headline.
- **Accessible:** every `<svg>` gets `role="img"`, a `<title>` and a `<desc>`, with ids prefixed by a slug (`aria-labelledby="deploy-title deploy-desc"`). CSS charts get `role="img"` and an `aria-label`. Put the raw numbers in a `<details>` table under the chart.
- **Form and colour:** load the `dataviz` skill when it is available, and take its advice on form and colour only. Anything of its that needs script, such as a hover tooltip, has no place on a static page, and this kit's colours stay the tokens.
- **A chart the kit lacks** (waterfall, scatter, Sankey, Gantt, radar, treemap) goes to `diagram-design` under the overrides in [diagrams.md](diagrams.md). Without that skill, use the closest kit chart or a table.
