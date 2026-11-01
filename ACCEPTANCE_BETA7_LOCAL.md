# Folio beta.7 — local Windows validation

Built locally on 2026-11-01. No source push, GitHub release, website update, or Cloudflare deployment in this packaging round.

- Version: 1.0.0-beta.7; Windows x64.
- Installer: releases/Folio-Setup-1.0.0-beta.7-win-x64.exe (170344596 bytes).
- SHA-256: 74c33b8120e4b3f981cc91664c247c197d4e505dc78fe5d50ad39a2f2818c99a.
- 79 regression tests passed; 68 modules passed syntax checks.
- Packaged runtime smoke: 15 asset/version endpoints passed; the bundled Markdown parser and ZIP export round trip passed in an isolated Electron profile.
- Archive privacy audit: 1252 packaged files, only allowlisted runtime roots; no reference test credential or credential-pattern findings; no bundled demonstration library.
- Installer integration: 12/12 checks passed, including unrelated-folder rejection, custom location, shortcut opt-in/out, payload hash, update behavior, removal and preservation of an unrelated test user file.
- Windows Defender custom scan completed with zero detections for this installer. This is a point-in-time check, not a guarantee of absence of all vulnerabilities. Installer remains unsigned.

The existing personal Folio profile was not used for packaging tests. See ACCEPTANCE_SELECTION_NOTES.md for feature scope and known OCR/model limitations. This round built Windows only.
