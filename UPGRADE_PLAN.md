# Folio upgrade plan · 2026-11-01

Positioning: a local-first interactive reading workspace, grounded in the user's source documents.

## beta.4 delivery

- Native macOS Apple Silicon / Intel DMG builds, Linux x64 Debian package, Windows setup.
- Native window chrome on macOS and Linux; macOS application menu; reject unprotected Linux key storage.
- Keep the DeepSeek endpoint under advanced connection settings. Parse only text explicitly pasted into the key field; never poll the clipboard or infer a provider from an ambiguous key prefix.
- Bind internal selections to their document. External dragged text must not silently inherit the currently open book.
- Keep explicit permutation powers in the interactive renderer; reduce indiscriminate concept-map routing.
- Play and scrub repeated permutation actions. Save a validated experiment snapshot in a note and restore it with its source document. This is a saved state, not yet full artifact version history.

## Next reading upgrades — integrated release proposal, 2026-11-01

Status: beta.5 implemented and acceptance completed; release publication is in progress. See ACCEPTANCE_BETA5.md for checks and the sampled-model limitations. Deliver the six workstreams together after integrated acceptance, with incremental internal checkpoints. Keep beta.4 available until the release passes. No release date or universal model-accuracy guarantee is implied.

Product target: import a document, find a passage, understand it in context, interact with the appropriate representation, save and revise the result, then return to the exact source after reopening or restoring a backup.

### Shared foundation (before new features)

- Introduce a versioned repository layer over the existing local data. Migrate from current IndexedDB/localStorage without deleting the original records before validation succeeds.
- Give documents durable IDs and content revisions. Separate file location from document identity; support missing-file relinking and prevent stale annotations from silently attaching to changed content.
- Share source references across passages, evidence, annotations, conversations, artifacts and Zotero records: document ID/revision, page, text range or page rectangle, and original excerpt.
- Separate semantic artifact parameters, interaction state, camera/display state and version history. A model update must not silently discard user edits or change the source.
- Create and verify a recovery snapshot before migrations. Keep API keys, OAuth tokens and OS credential-store data out of exported backups and logs.

### 1. Persistent reading index and source retrieval

Scope: local persistent page/chunk index; background progress and cancellation; incremental rebuilding after content changes; current passage, neighboring context, relevant definitions and explicit references ranked together. Show retrieved pages, available evidence and pages that could not be read. Do not imply a whole book was understood just because it was indexed.

Acceptance: reopening does not re-extract an unchanged book; remote definitions in the same book are retrieved; long books remain usable during indexing; external text and another document never inherit the active book silently; old requests cannot overwrite a new reading session.

### 2. Output planning and interactive renderers

Scope: use a validated display plan for explanation, comparison, derivation, process, parameter exploration, geometry and concept relationships. Choose based on the user's question and extracted objects, not just keywords. A concise explanation plus one suitable interactive view is the default; users can switch representations.

First integrated release: structured explanations/comparisons/derivations, step-based processes, permutation/group experiments, and bounded 3D geometric transformations with distinct object colors, camera controls, axes and reset. Extend beyond the current tetrahedron through explicitly supported geometric objects; do not advertise arbitrary scenes, chemistry or biological simulation as solved.

Model output describes data and parameters, not executable JavaScript. Check schemas, references, dimensions and supported numerical properties locally. Mark source statements, deductions and illustrative examples distinctly. When a renderer cannot express the content, preserve the useful explanation and source instead of forcing a concept map or substituting an unrelated example.

Acceptance: a representative evaluation corpus checks source retrieval, representation choice, citation support and mathematical correctness separately. For example, sigma^3=e alone does not prove order 3; retrieve sigma's definition and check the smallest positive exponent when available. Include ambiguity, unsupported geometry, scanned text, malformed responses and cancellation cases.

### 3. Persistent, editable artifacts

Scope: stable artifact IDs across every supported renderer; follow-up edits against an explicit base version; undo/redo, named snapshots and restore; notes preserve the artifact and source route. Persist color/visibility/step/camera state independently from semantic model parameters.

Acceptance: change an object or explanation, undo it, restart the application and restore an earlier version with the same source. Late model responses must not overwrite subsequent edits. Source files that moved can be relinked; missing sources do not erase saved artifacts.

### 4. Reading navigation, references and OCR

Scope: PDF outline, full-text results with page previews and highlight navigation, selected formula/figure regions with stable page coordinates, and recognition of explicit in-document references where evidence is unambiguous. Reuse the persistent index rather than building a separate search store.

OCR first scope: on-demand local OCR for printed Chinese/English pages, with recognized text, page-image evidence, engine confidence when available, and correction support. OCR must be cancellable and its results versioned. Complex mathematical expressions and chart semantics retain the original image region; do not label uncertain OCR as a verified formula. High-accuracy mathematical/vision OCR is a separate capability evaluation, not a promise that ordinary text OCR solves it. No automatic upload of page images to a new provider.

Acceptance: text PDFs and scanned pages both have a usable path; search hits and selected regions return to the correct location after zoom/reopen; uncertain recognition can be corrected without destroying the original image.

### 5. Zotero interoperability

Scope: import a Zotero RDF export with metadata, collections, tags, notes and available local attachment references; support the subset explicitly validated by fixtures. Provide an import preview, duplicate handling, unresolved-attachment report and relinking. Preserve external item identifiers when present. Keep imports idempotent where reliable source identifiers are available.

Boundary: one-way import/source linking in this release, not live bidirectional sync or editing Zotero's database. Import/export is not a full-fidelity Zotero backup or preservation of word-processor citation links.

Acceptance: import the same sample twice without unintended duplicates, preserve collection membership and metadata, report missing attachments, and keep the original Zotero library unchanged.

### 6. Migration, backup and release maintenance

Scope: versioned data migration with rollback; backup/restore preview; structural and integrity checks before writes; metadata/notes/artifacts backup by default and optional document copies. Warn when linked originals are not included. Restoration must reject unsupported or corrupt formats and provide relinking for missing originals. Never include credentials.

Release scope: platform/architecture-aware update checking, release notes and explicit download/open-installer flow; preserve documents and settings on upgrade. Full automatic installation is gated by a verified platform updater and recovery tests.

External requirements: Apple Developer ID/notarization and appropriate Windows signing credentials must be supplied through an approved signing setup before claiming signed releases. These cannot be manufactured by code changes. Until available, retain honest beta labeling and manual installation; Linux can continue through its package-install flow.

Acceptance: restore a backup into a clean test profile and compare document references, notes, annotations and artifact versions; test migration failure and rollback; cross-platform install/upgrade/uninstall and secret-exclusion audits must pass.

### Implementation order and release gates

1. Migration-safe data repository, durable source IDs and recovery snapshots (foundation of 3 and 6).
2. Persistent indexing plus outline/search/source anchors (1 and 4).
3. Typed output plans, bounded renderers and artifact revision handling (2 and 3).
4. On-demand OCR and one-way Zotero import using the shared data/source model (4 and 5).
5. Backup restore, update checking, integrated reading scenarios and platform packaging (6 and all workstreams).

Release gate: exercise import → selection → context → answer/view → follow-up edit → saved note → restart → source jump → backup → clean-profile restore. Include book switching during generation, slow/cancelled requests, changed/missing documents and failed imports. Run mathematical unit checks and live-model evaluation separately; passing parser/schema tests is not evidence that all model explanations are correct. Keep public screenshots and installer payloads free of test profiles, credentials and private documents.

### Reference checks

- Zotero export formats and complete-transfer guidance: https://www.zotero.org/support/kb/exporting
- Zotero import/export limitations: https://www.zotero.org/support/kb/field_mappings
- Electron packaging/signing/update guidance: https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging

## ChatGPT sign-in investigation

Checked official documentation on 2026-11-01:
- https://developers.openai.com/siwc/quickstart
- https://developers.openai.com/siwc/request-client-id
- https://developers.openai.com/siwc/token-sharing-open-source

Official Sign in with ChatGPT exists. Identity-only authorization does not grant model access; eligible plan inference uses separately authorized Responses API scopes. Commercial integrations are currently a limited trial; plan usage is available to open-source partners and selected private clients. Folio source remains private, so eligibility and a Folio client registration must be resolved before implementing a working login button. Do not reuse Codex's client ID, browser cookies or another application's tokens. Do not open-source Folio merely to obtain access.

If approved: system-browser authorization with PKCE/state/nonce; validate redirect, issuer, audience and scopes; keep tokens in the desktop process and OS credential storage; support expiry, revocation and logout; introduce a Responses API adapter rather than treating OAuth tokens as DeepSeek keys.

## Acceptance

Check source identity, context retrieval, output-type suitability, numerical correctness, citation support, state replay, cancellation, session isolation and failure recovery separately. Match quotations against source text without claiming that a quote match establishes the truth of the whole explanation. Cross-platform CI smoke tests do not replace physical-device usability or macOS Gatekeeper testing.
