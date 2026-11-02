# Changelog

## 1.0.0-beta.9 · selection update 2026-11-03 (r3)

- Detect sustained column gutters before merging same-baseline PDF text. Narrow two-column abstracts and three-column pages retain their reading order; original page pixels and text positions stay unchanged.
- Add large start/end selection handles, a magnifier of the original text, character-boundary snapping and edge auto-scroll. Both handles support keyboard adjustment, reverse selection and crossing endpoints.
- Preserve the selected source when dragging into AI; show the drop ripple for pointer-based drags as well as native drops. Clear selection controls when pages or documents change.
- Add a top-right circled question mark and F1 feature guide, with ten searchable bilingual topics covering reading, AI, annotations, LaTeX notes, settings, backups and shortcuts.

Validation: 103 automated tests, real two-column PDF pointer tests, unchanged text-layer geometry, source-linked notes/annotations, import-permission regression checks and native packaged-runtime checks. The tester's exact biomedical PDF was unavailable; narrow-gutter synthetic cases and a public two-column paper cover the reported layout pattern.

## 1.0.0-beta.9 · maintenance update 2026-11-02

- Fix single-file import into an existing read-only library folder: check write access first, then request missing permission only from a new Allow and import button click.
- Offer explicit local-copy storage when folder authorization is declined or unavailable. Cancel imports nothing; cancel and failure both reset the file picker so the same document can be selected again.
- Return successful imports to All documents so a local copy is visible even when import started from a folder filter. Existing files keep collision-safe names.

- Add visible Remove controls, a right-click confirmation and Delete-key support for library documents. Imported copies can be deleted; linked folder entries stay hidden after reopening. Original disk files, notes and annotations are retained.

Validation: automated tests and isolated Electron checks cover import permissions, cancellation, local-copy persistence, deletion and folder-entry removal. All platform installers are rebuilt for this maintenance update.

## 1.0.0-beta.9 · 2026-11-01

- PDF appearance is unchanged. Reading order is organized inside its transparent text layer automatically; no Reading mode toggle.
- Native selection plus triple-click / hover paragraph selection and Shift extension; source context follows the selection.
- Direct drag-to-AI without an intervening modal. Visible 1.6-second double ripple and receipt, with reduced-motion support.
- Existing notes and annotations are preserved, including references from the earlier beta.9 reading view.
- Materialized file copies and first-import read recovery retained.
- Dismiss the selection toolbar after deselection, a blank-page click or Escape, while preserving source text for toolbar actions.

Complex/rotated/scanned layouts may still need OCR or manual verification. Text-only models do not analyze image pixels.

## 1.0.0-beta.8 · 2026-11-01

- Open supported interactive results directly, with an Explanation / Presentation switch that does not request another model answer.
- Surface contextual learning actions such as step-by-step reasoning and permutation demonstrations below results; keep version management in More.
- Prefer appropriate derivations, comparison tables and supported experiments, with concise introductions and a bounded repair when a clear request receives only prose.
- Organize reading results into editable Markdown/LaTeX study notes before saving. Preserve source links and experiment snapshots; allow cancellation or keeping the original answer.
- Check delimited formula syntax before saving, without claiming to verify mathematical truth.
- Include the locally tested beta.7 upgrades: adjustable region selection, editable selected text, Markdown note previews and Obsidian-compatible exports.
- Retain existing documents, notes and protected model credentials across upgrades. No test keys, private documents or development fixtures are bundled.

Validation: 84 automated tests, five live DeepSeek reading cases, note-rendering and end-to-end UI checks, and 12 Windows installation checks. macOS and Linux packages are built and smoke-tested on their respective CI runners before publication.

## 1.0.0-beta.4 · 2026-11-01

- Add macOS Apple Silicon and Intel disk images and a Linux x64 Debian package.
- Adapt native windows and application menus; refuse persistent credentials on Linux plaintext fallback storage.
- Extract one API key from explicitly pasted text; keep endpoint settings under Advanced.
- Bind dragged passages to the correct source document; external text no longer inherits an unrelated open book.
- Keep permutation powers interactive, with cycle playback, an exponent slider and source-linked saved experiment snapshots.
- Document the next reading upgrades and the official ChatGPT sign-in eligibility requirements.

## 1.0.0-beta.3 · 2026-10-31

- Add a self-contained Windows x64 installer with English and Simplified Chinese setup pages.
- Choose an installation directory and an optional desktop shortcut; add Start menu entries and Windows uninstall registration.
- Support updating the existing installation. Preserve personal documents, annotations, notes and settings when uninstalling.
- Generate an exact uninstall file manifest so unrelated files in the installation folder are retained.
- Keep the empty-library, credential-free distribution from beta.2.

## 1.0.0-beta.2 · 2026-10-31

- Replace the composer send control with a solid circle and centered SVG arrow; match the stop control.
- Start with an empty library. Remove the bundled group-theory guide, example questions and fixed demonstration entries.
- Keep interactive renderers available for users' own documents and AI-generated plans.
- Re-audit the packaged runtime for credentials, local profiles and development fixtures.

## 1.0.0-beta.1 · 2026-10-31

First downloadable Windows beta, based on local revision 13.

- Local PDF, TXT and Markdown library, collections, recent reading and favorites.
- Reader with highlights, underlines, comments and source-linked notes.
- Right-hand AI canvas with contextual explanations, concept graphs and supported interactive group-theory / 3D experiments.
- Isolated conversations and optional automatic conversation notes.
- Chinese / English interface, light / dark appearance, unified preferences and application menus.
- Document tabs support a close button and a context menu.
- Updated canvas icon and desktop window styling.
- Public builds exclude credentials, development reports and local browser profiles.

This beta is unsigned and has no automatic updater. OCR, macOS/Linux packages and Zotero synchronization are not included.
