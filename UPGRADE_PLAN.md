# Folio upgrade plan · 2026-11-01

Positioning: a local-first interactive reading workspace, grounded in the user's source documents.

## beta.4 delivery

- Native macOS Apple Silicon / Intel DMG builds, Linux x64 Debian package, Windows setup.
- Native window chrome on macOS and Linux; macOS application menu; reject unprotected Linux key storage.
- Keep the DeepSeek endpoint under advanced connection settings. Parse only text explicitly pasted into the key field; never poll the clipboard or infer a provider from an ambiguous key prefix.
- Bind internal selections to their document. External dragged text must not silently inherit the currently open book.
- Keep explicit permutation powers in the interactive renderer; reduce indiscriminate concept-map routing.
- Play and scrub repeated permutation actions. Save a validated experiment snapshot in a note and restore it with its source document. This is a saved state, not yet full artifact version history.

## Next reading upgrades

1. Persistent document indexing and retrieval of definitions, referenced formulas and neighboring sections; visible evidence coverage.
2. Typed display plans: explanation, comparison, derivation, process animation, parameter exploration, geometry, and concept relationships. Validate the mathematical data independently from the presentation.
3. Artifact IDs, patch-based follow-ups, undo/redo and version history across all renderers; keep model state separate from camera/display state.
4. PDF outline and full-text search, formula/figure anchors, then OCR with explicit confidence and page-image evidence.
5. Zotero metadata/collections import and source linking before any bidirectional synchronization.
6. Data migration, backup/restore, signed releases and update delivery.

## ChatGPT sign-in investigation

Checked official documentation on 2026-11-01:
- https://developers.openai.com/siwc/quickstart
- https://developers.openai.com/siwc/request-client-id
- https://developers.openai.com/siwc/token-sharing-open-source

Official Sign in with ChatGPT exists. Identity-only authorization does not grant model access; eligible plan inference uses separately authorized Responses API scopes. Commercial integrations are currently a limited trial; plan usage is available to open-source partners and selected private clients. Folio source remains private, so eligibility and a Folio client registration must be resolved before implementing a working login button. Do not reuse Codex's client ID, browser cookies or another application's tokens. Do not open-source Folio merely to obtain access.

If approved: system-browser authorization with PKCE/state/nonce; validate redirect, issuer, audience and scopes; keep tokens in the desktop process and OS credential storage; support expiry, revocation and logout; introduce a Responses API adapter rather than treating OAuth tokens as DeepSeek keys.

## Acceptance

Check source identity, context retrieval, output-type suitability, numerical correctness, citation support, state replay, cancellation, session isolation and failure recovery separately. Match quotations against source text without claiming that a quote match establishes the truth of the whole explanation. Cross-platform CI smoke tests do not replace physical-device usability or macOS Gatekeeper testing.
