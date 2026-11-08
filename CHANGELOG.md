# Changelog

## 1.0.5 · 2026-11-08

- r2: Fix long answers painting over the self-check card. Lay out history, answers and quizzes in natural vertical flow; scroll wide display equations within their own containers. Verify long math, follow-ups, history expansion, zoom and restart in real Chromium.

- Drop folders or documents anywhere to import local copies recursively, preserving subfolder paths. Handle full directory batches, hidden files, unsupported formats and read failures.
- Keep one chat across new selections, documents, pages and library navigation. Persist the transcript, per-turn sources and quizzes locally and restore after restart. Only the top-right + starts a new chat.
- Replace six-turn/8,000-character history and 48,000-character proxy limits with a 1M-token application budget and 32 MiB transport bound. Preserve all history; report provider limits without silently truncating. Token usage is estimated.
- Send source images to compatible vision models, including scanned PDF pages, selected regions and dropped/pasted images. Adapt OpenAI-compatible and native Claude content blocks; offer an explicit vision/OCR setting.
- Add one-question multiple-choice and fill-in-the-blank checks based on each answer, with answers hidden until submission or reveal and locally saved feedback.

Implementation and verification: [V1.0.5](docs/release-1.0.5.md).

## 1.0.4 · 2026-11-06

- Import DOCX as readable text, including paragraphs, table cells and common formula expressions; accept `.markdown` files across library import, folder scans, attachments and source relinking. DOCX uses reflow sections, not Word pagination.
- Automatically recognize image-only PDF pages with bundled English/Chinese OCR. Keep the source image and add a selectable, draggable, annotatable text layer. Cache per revision; offer cancellable whole-book recognition and corrected transcripts.
- Add a keyboard-accessible `/` output picker without changing automatic output selection. Explicit choices flow through the existing validated renderer and repair path.
- Separate composer drops from immediate canvas drops. Expand the composer, preserve the draft and existing answer, stage the source quote, and wait for Send.

- Restore the compact idle composer; use a plus menu that preserves the draft and does not close during a click. Keep slash typing and temporary drag expansion.
- Link anatomy colors, numbered parts, buttons, descriptions and motion controls; render formulas and limit illustration height on short screens.
- Render saved illustrations interactively inside notes with explicit state save/reset and restart restoration, using the same components as the canvas.
- Align graph zoom, geometry angles/reset, derived-layer selections, permutation composition snapshots and process navigation with their displayed results. Preserve interaction through compatible edits and undo/redo.
- Validate seven pages from three real scanned PDFs; enable automatic page segmentation, bounded 300-DPI OCR and Chinese/English recognition. Preserve manual corrections when refreshing old OCR caches.
- Check the actual upload endpoint before every release transfer, with a verified temporary probe, bounded retries/timeouts and transfer heartbeats.

## 1.0.2 · 2026-11-05

- Add in-app updates to the installed Windows application: check for a stable release, download with progress, then explicitly restart and install. Background checks do not force a download or restart.
- Retry failed or unverified downloads. Keep pending updates across the current session, and prevent restart while an AI request or note editor needs attention.
- Build compatible NSIS installers with `electron-builder`; publish the installer, block map and `latest.yml` together on the public `Joydivisor/Folio` release. Preserve the application's data directory and saved documents, notes and settings.
- Treat 1.0.2 as the starting point for future automatic updates. macOS and Linux retain the manual download workflow.

## 1.0.1 · 2026-11-05

- Use the public `Joydivisor/Folio` repository for all installer downloads and update links. Accept its exact versioned release URLs while retaining the existing URL safety checks.
- Retire the separate `Folio-downloads` public mirror. Versions 1.0.0 and earlier need one manual download from the website to migrate; installing over the existing app retains documents, notes and settings.
- Include Windows x64, macOS Apple Silicon / Intel and Linux x64 packages. The missing Apple Silicon package was also added to the original 1.0.0 release from its original source tag.

## 1.0.0 · 2026-11-05

- First stable, public source release under GPL-3.0-only, with Windows, macOS and Linux packages.
- Restore connected document folders automatically on application restart. Persist a folder-bound catalog so unavailable disks or renewed browser permissions do not erase the visible library. Preserve explicit import write permission.
- Default to continuous reading with saved page offsets and on-demand distant pages; retain paged mode.
- Put answers in an editable canvas with contextual diagrams, complete derivations, comparisons and mixed text/visuals. Add local edits, history, snapshots and undo/redo.
- Add model-independent Anatomy SVG illustrations, parameter controls, more geometry primitives and bounded custom meshes; support Claude Messages and OpenAI-compatible interfaces.
- Unify search fields, menus, dialogs and sliding segmented controls across Chinese/English and light/dark themes. Remove playback controls from fully displayed derivations.
- Retain source-linked notes, nested collections, document attachments, PDF selection, backups and local credential storage.

Windows remains unsigned; macOS is ad-hoc signed and not Apple-notarized. AI calls require the user's own provider and key. Rendering and mathematical schema checks do not establish the correctness of arbitrary model explanations.

## 1.0.0-beta.9 · library update 2026-11-03 (r4)

- Isolate reader notes, counts and exports by document identity; group global notes by source, including unlinked and unavailable originals. Preserve old note URLs and source navigation.
- Add nested topic collections with colors, multiple membership, parent filtering and collection notes. Deleting a collection preserves documents/notes and promotes its children.
- Add editable document metadata, tags and reading status, combined tag/status filters, and unfiled/with-notes filters.
- Group explicitly selected files as attachments under a document, choose its primary file, import attachments, or detach without deleting files or notes. Aggregate document notes while retaining attachment-specific reader notes.
- Track same-version revision updates in the update dialog.
- Include collections and metadata in validated workspace backups; existing file identities, page references and notes remain unchanged.

Validation: 112 automated tests and 24 isolated note/library UI scenarios, plus PDF selection, import-permission and packaged-runtime regression checks. Native platform builds and installer checks are required before publishing.


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
