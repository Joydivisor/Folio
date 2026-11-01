# beta.6 connection and result-controls fix

- Fixed the actual cross-restart credential bug: Electron 45 decryptStringAsync returns {result, shouldReEncrypt}, not a string. Legacy encrypted DeepSeek records remain readable. Original encrypted files are retained on unlock failures.
- Credentials are bound to normalized full service endpoints, stored separately with OS encryption, never returned through status or renderer configuration. Desktop save is visibly checked by default; session-only remains selectable. Browser sessions remain memory-only.
- Added DeepSeek, OpenAI and Gemini endpoint presets plus a custom OpenAI-compatible endpoint. Model choices are fetched from the selected service; listing is not a guarantee of account credit or Chat Completions capability. Only DeepSeek has been live-tested with an authorized real account in this round.
- Simplified result controls to type/save status, Save to notes, Source and More. Version history, manual edits and representation overrides remain optional. Select menus inside a modal now remain within the modal's accessible subtree.
- 74 automated tests and 64 module syntax checks passed. Real Windows safeStorage save and restore succeeded in separate Electron processes with synthetic credentials for two isolated endpoints.
- Browser verification: switch to OpenAI does not retain DeepSeek credentials or model; DeepSeek live model enumeration returned two models; Flash test call succeeded. Existing cube artifact and optional controls restored successfully.

Public beta.5 review: native macOS arm64/x64 built, ad-hoc codesign verified, DMG checksums verified, app window and 13 assets loaded. Ubuntu 22.04 x64 DEB installed, started, served assets and uninstalled. These are smoke/integration checks, not complete physical-device acceptance. macOS Keychain permissions, Gatekeeper and every Linux desktop/keyring have not been manually certified.

Security review on 2026-11-01: runtime npm audit reports zero known vulnerabilities. Microsoft Defender completed a custom scan of the local releases directory (event 1001, 16:11:46 local) with zero matching threat detections. This does not establish absence of all vulnerabilities or provide macOS notarization. Windows unsigned; macOS ad-hoc signed and not notarized.

Download diagnosis: website is on Cloudflare Pages, installers redirect to release-assets.githubusercontent.com. Local 2 MiB range probes: macOS arm64 0.138 MiB/s; macOS x64 0.188 MiB/s. Results reflect this route and a small sample, not a nationwide speed guarantee. Cloudflare R2 API reports that the account has not enabled R2; no billing subscription or mirror has been created.

beta.6 published on 2026-11-01 from runtime commit a8c4f40. Native CI run 41284268726 passed on macOS arm64, macOS Intel and Ubuntu 22.04. Windows installer integration passed 12/12 checks. Final four asset sizes and SHA-256 digests match the public GitHub assets; checksum file verified. Both getfolio.pages.dev and the GitHub Pages site serve beta.6; all four installer range probes returned 206 with the expected 1024 bytes. Final Defender scan of releases reported zero matching detections.

Post-release UI refinement (source only): removed always-visible artifact type/save labels, implementation badges, redundant English eyebrows, generic library/reader instructions and repeated settings copy. Primary actions remain Save to notes, Source, More. Preserved citations, mathematical conventions, errors and credential/privacy state. This subsequent refinement is not part of the already published beta.6 installers.
