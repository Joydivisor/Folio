# Selection and Markdown notes — unreleased

Implemented on 2026-11-01. No installer build, release asset replacement, or website download update in this round.

## Changes

- Added a visible Select area action and replaced the one-shot region capture with a movable rectangle, eight resize handles, keyboard adjustments and a confirmation preview. PDF text is extracted by character centers within the selected rectangle; plain-text pages use the same reader geometry. The preview allows correction, local region OCR, saving a source-image note, or sending the confirmed text to the existing AI flow.
- Selection is cancelled on page changes, zoom, document changes and leaving the reader. Source records preserve document identity, revision, page and normalized rectangle; conversation archives retain region references.
- Notes render Markdown with LaTeX, headings, lists, tables, quotes and Obsidian-style callouts. Editing offers a preview and cancel action. Existing note bodies are not migrated or rewritten automatically.
- Export a plain note as Markdown; source-image notes and full collections export as ZIP with Markdown files and relative PNG attachments. Exports include source metadata and excerpts. Local image files are verified before export; missing images raise an error.
- Markdown rendering disables raw HTML, validates links, and does not fetch remote embedded images. Markdown and ZIP dependencies are served locally from two fixed asset routes and included as runtime dependencies.

## Verification

- 79 automated tests pass. Added checks for rectangle constraints, visual text ordering and exclusion, math preservation, active-content escaping, export metadata and source-reference persistence.
- Browser flow: select a single line in group-theory.pdf, adjust the right edge, preview exactly that line, run local OCR, save a region note, edit Markdown, preview KaTeX/callout/table, save, export, then inspect the ZIP. ZIP contains one Markdown file plus its referenced PNG.
- Browser checks: changing page and zoom removes old selection; reader tools fit a 980 px window; note contrast checked in both themes; original source can be reopened from a note. No browser console errors were observed in these flows.
- Live DeepSeek invocation from the region preview selected the S3 derived-series renderer. A follow-up formatting probe returned math delimiters. This verifies routing and formatting, not universal mathematical accuracy: model prose still produced an incorrect intermediate element-action trace, even though the final commutator and subgroup conclusion were correct. The separate local group engine has its own numerical checks. No claim that prompting alone fixes mathematical reliability.
- npm audit --omit=dev reports zero known runtime vulnerabilities at the time of this check. No claim of absence of all security defects.

## Limits

- Region OCR handles printed text; mathematical symbols and complex layouts may need user correction. The current model request sends confirmed text and document context, not an image to a vision model.
- Rectangles select one current page at a time. Complex multi-column selections should be split into smaller regions.
- The earlier personal Obsidian template was not recovered; this implementation uses compatible Markdown, $ / $$ math and callout formatting rather than claiming an exact reproduction of that template.
