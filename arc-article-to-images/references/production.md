# Storyboard and production

Read when preparing copy and selecting how to render.

## Minimal storyboard

Record the source title/URL or path, available author/date, intended audience, count, dimensions, and chosen style once. For each card record:

```text
Card ID / role:
Takeaway:
Evidence: source section/page/paragraph; brief paraphrase
Headline (exact):
Subtitle (exact):
Diagram: nodes, labels, arrow directions, branch conditions
Takeaway copy (exact):
Source/footer (exact):
Caveat or illustrative label:
Alt text:
Render route:
```

A cover metaphor is an interpretation, not a new factual claim. Cite the thesis it explains. Preserve important caveats on the image itself; companion notes cannot rescue a misleading image.

## Rendering routes

**Illustrated raster:** use the available image-generation tool for the cover's crosshatched art or complete illustrated cards. Pass exact copy and the style constraints below. Use a new prompt per card. If exact typography proves unreliable, simplify the copy or use a hybrid layout. Follow the environment's image-tool instructions, including how to save generated assets; do not assume an output-path parameter or hard-code a model/API.

**Deterministic diagram:** for diagram-heavy lesson cards, use SVG or HTML/CSS for type, shapes, and connectors, with an available local renderer to export PNG. This is particularly useful for formulas, faithful chart data, branching logic, and consistent series typography. Check font availability, await fonts before export, and inspect the raster result. Keep editable source beside the output. An SVG/HTML file alone does not fulfill a PNG request. Use standard plotting tools for quantitative or scientific charts.

**Hybrid:** generate original illustration art without lettering, then compose it with deterministically typeset copy and diagram labels. Preserve the illustration during layout; use the image-editing tool for changes to generated artwork itself. Do not substitute generic geometric placeholders for a requested detailed illustration.

Check available capabilities before promising any route. Use a local file renderer for export where supported; do not start a website server or publish a page just to deliver images. If exact requested dimensions are unsupported by the image tool, render a compatible aspect ratio and use an available export step that preserves content, or disclose the actual dimensions. Never crop off labels to hit a target size.

## Image-generation prompt scaffold

```text
Create one editorial educational image, portrait 4:5.
Purpose/audience: [reader and one takeaway]
Style: warm off-white paper; near-black ink; restrained cobalt accent;
bold grotesk headline, italic serif subtitle, quiet spaced metadata.
Layout: [cover or lesson; placement and whitespace]
Main visual: [precise metaphor or diagram, including arrow directions]
Text verbatim, with placement:
[only the exact copy to appear]
Accuracy constraints: [supported relationships, caveats, values/units]
Series invariants: [margins, palette, type roles, footer placement]
Avoid: extra text, invented statistics, reference-author branding,
decorative dashboard cards, gradients, illegible labels.
```

For an art-only request, replace the text block with “No lettering, labels, logos, or watermark; reserve [region] for later typesetting.” For reference-conditioned work, identify each supplied image as a style reference and explicitly specify the new subject and copy.

## Review evidence

Report which files were rendered and visually inspected; do not confuse a successful tool response with a successful image. Check PNG format/dimensions, copy, source fidelity, mobile readability, and consistency. OCR may help catch spelling but does not verify diagram semantics. If the environment cannot display the file, label visual review incomplete. Save failed attempts separately from deliverables and report missing cards honestly.

For before/after signal or data transformations, preserve unchanged components across stages. For example, a low-pass filter removes high-frequency content from a mixed signal; drawing an unrelated slower wave can falsely imply frequency conversion. Derive downstream schematics from the same example where possible; the label “schematic” does not excuse a misleading relationship.
