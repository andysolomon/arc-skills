# Article-to-images skill

## Goal and scope

Create a portable ARC skill that reads articles and produces source-grounded images in the editorial style of the user-provided X reference. Include rendering guidance, evidence tracking, visual review, and starter behavioral evaluations. Do not publish, install globally, or copy the reference's branding.

## Baseline and mode

Gap mode: this repository has skill authoring conventions, an installer that discovers `arc-*` directories, and JSON evaluation suites, but no article-to-image skill. Six reference images were retrieved and inspected: one illustrated cover and five diagram-led lessons.

## Missing capabilities and milestones

### 1. Design contract

Deliver a concise SKILL.md and references describing source extraction, storyboard, default visual language, and rendering choices. Depends on accessible reference imagery. Risk: confusing the cover illustration with the lesson-card style. Acceptance: distinguish both compositions and document the reference provenance and approximate style tokens.

### 2. Integration and evaluation

Add README discovery, a synthetic article fixture, and cases for successful rendering, prompt-only mode, unavailable source, source injection, and an adjacent text-only request. Risk: static checks cannot establish rendering quality. Acceptance: valid suite structure and resolvable fixtures/references; image production cases require actual artifacts and visual review when executed.

### 3. Validation and archive

Run skill validation, JSON/fixture/link checks, and diff checks. Record unexecuted behavioral cases explicitly. Archive this plan and tracker together after repository implementation is complete.

## Deferred

Automated model-graded evaluation remains deferred. The subsequent user-requested live trial on Speech & Audio produced four inspected image cards. No bundled third-party images, API credentials, hosting, or publishing integration.

## Next steps

Repository implementation and static validation are complete. Plan and tracker are archived together. A subsequent article request can exercise the rendering and visual-review workflow.

## 4. Live article trial

User requested testing on the Speech & Audio phase. Delivered four PNG cards, source mapping, storyboard, editable SVGs, generation prompt, and render script under output/article-images/speech-and-audio/. Corrected a misleading filtering schematic and added the resulting invariant to production guidance. Acceptance: all cards rendered and inspected at full and phone sizes; actual PNG dimensions verified. Automated evaluation-suite grading remains unrun.

## 5. Art revision

User requested improving the art. Delivered a preserved v2 set with a transparent exploded microphone, larger signal strips, a contextual spoken phrase, and an interrupted playback trace. Added subject-specific art direction and background integration checks to the skill. Acceptance: four full-size and phone-size images inspected; exact dimensions checked; original set retained; prompts, source mapping, storyboard and reproduction source included.

## 6. Article and subsection cover contract

User clarified the arc-reader direction: every article gets a cover, and every subsection gets its own cover, without a fixed count. Added a linked cover-mode reference, structural mapping rules, shared art direction, and integration intent; updated discovery and added two evaluation cases covering nesting, repeated headings, and no-subsection articles. Acceptance: complete cover accounting and valid linked evaluation fixtures. Application implementation remains deferred; no arc-reader code was changed.
