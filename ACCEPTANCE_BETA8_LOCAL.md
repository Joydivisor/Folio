# Folio 1.0.0-beta.8 — local acceptance

Local Windows x64 build only. No repository push, website deployment or public release.

## Changes

- Renderable results open directly in Presentation; Explanation / Presentation switches existing views without an API request.
- Up to two contextual learning actions appear directly below a result. Version/history management remains in More.
- Reading prompts prioritize concise introductions and appropriate steps, comparison tables, permutation or supported 3D scenes. Explicit prose-only requests take precedence. Clear reading intent participates in bounded format repair.
- Save to notes opens AI organization and a Markdown/LaTeX preview before writing. Title and body can be edited, the original answer restored, or the dialog cancelled. Source and artifact snapshots remain attached.
- Delimited formulas are checked with KaTeX before saving. This checks rendering syntax, not the truth of a mathematical argument.

## Verification

- Automated tests: 84 / 84 passed.
- Live DeepSeek evaluation: 5 / 5 cases passed in the final run: automatic permutation, proof, comparison, cube geometry, and explicit prose-only. Proof-to-note output also parsed and rendered its formulas. Earlier runs exposed comparison schema and representation-selection failures; these prompted the schema and intent-repair changes.
- Browser component checks: view switching, visible follow-up action, light/dark and 350 px result column, interactive 3D rotation, invalid formula rejection, editable note preview, save source isolation, cancelled asynchronous organization leaves no saved note or dialog.
- Full application flow on an isolated local origin with deterministic API fixtures: imported a test text, asked a question, opened the default permutation, requested steps via the visible action, organized/saved a note and opened it from Notes. Formula rendering, source route and Restore interaction entry verified. This UI flow is separate from the live-model evaluation.
- Packaged runtime: 14 application/vendor routes passed using the packaged Electron runtime and archive; fresh server has no configured key. The existing user's beta.7 window was not interrupted for a second desktop-window launch.
- Archive: runtime allowlist only, version/source matches, private test credential absent, evaluation pages and reports excluded.
- Installer integration: 12 / 12 checks passed. Temporary installation, shortcuts and registry entries cleaned up; unrelated test user file preserved through uninstall.

## Scope

- 3D remains bounded to the supported cube, tetrahedron and octahedron engines; no arbitrary generated executable code.
- A failed structured response may retain its explanation after one repair attempt. Five passing live cases do not establish correctness for every selection or model.
- Existing notes are not rewritten. Opt-in conversation archiving retains its existing local recording behavior; the new AI organization runs when explicitly saving a reading result as a study note.
- New AI-organized notes require a configured model and make a model request. The original answer remains available on failure or without a connection.

Installer: `releases/Folio-Setup-1.0.0-beta.8-win-x64.exe`

SHA256: `fdbaec5d8188dfd70f9ff55e8be279f55ced1ba14c454f9271f0ea269a2c4e74`
