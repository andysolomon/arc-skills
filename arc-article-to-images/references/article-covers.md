# Article and subsection covers

Read for arc-reader or requests to illustrate an article's structure with covers.

## Product contract

Every article gets a cover page. Every subsection gets a cover page introducing its own content, including nested subsections. The count follows the source hierarchy: one article cover plus one per subsection. An article without subsections gets one cover. Do not impose a four-card set, select only three highlights, or invent sections to meet a quota.

An article cover carries its title, one dominant illustration of its central subject, and optional author/source metadata. A subsection cover carries the original heading, a distinct illustration grounded in that subsection, and a quiet parent-article label. A short subtitle is optional. These are visual introductions; avoid filling them with a lesson summary or diagram unless the user asks for that treatment.

## Map the source

- Build the hierarchy from content headings, preserving their order and nesting. In arc-reader, imported headings are retained in the document text; exclude code fences and embedded visual metadata before detecting Markdown headings. A repeated article title is not another subsection.
- Exclude navigation, related-link lists, and other site furniture. Do not silently discard genuine short or nested subsections. If a short section needs context, use its parent to clarify the meaning while keeping its own subject distinct.
- Record each subsection's heading path, occurrence, source range, and parent. Repeated headings must remain separate; heading text alone is not an identifier. Use an existing document/section identity if the consumer provides one.
- The article cover draws on the whole article; each subsection cover draws on that section's body and descendants. A section with children still gets its own cover.
- Preserve missing-content states honestly. If the article is unreadable, request accessible content. If subsection bodies are missing, identify those covers as blocked instead of inventing subject matter from headings.

Completion: a manifest accounts for the article and every actual subsection, in reading order, with source anchors and per-cover status.

## Keep the family coherent

Use shared paper, palette, typography, and illustration technique. Change the focal object or action for each subsection. Give the article cover the strongest composition; subsection covers should feel like chapter openings from the same publication. Follow the art-direction guidance in field-notes.md.

For exported files, use an article directory with `cover.png` and an ordered `sections/` set. Include stable section keys in the manifest, not just sequence numbers in filenames. Preserve alt text and source mappings for every cover. Batch large articles without dropping covers to fit a processing batch size.

## arc-reader integration intent

The intended reader experience places the article cover at its opening and each subsection cover immediately before the corresponding heading/content. The article cover can also supply the library thumbnail. Preserve heading accessibility and the reader's text-based listening positions; generated art is associated metadata, not a rewrite of the article text.

The app integration should generate and store covers per document/section, with separate queued, generating, ready, and failed states. Reading can proceed while covers arrive. Reuse assets by source content, style version, and generation settings; recheck changed sections without blindly regenerating unrelated ones. Cache validated assets for the library and reader rather than placing image bytes inside every document-sync payload.

This reference defines the desired integration. The skill's image output alone does not install background generation, storage, or reader UI into arc-reader; those require application code.
