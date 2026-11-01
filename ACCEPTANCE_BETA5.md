# Folio beta.5 acceptance record

Final runtime commit: b65fc31. Native CI run: 41276214746. The final Zotero attachment-opening correction was checked in the browser; all native jobs passed again.

- 68 automated tests passed, including source isolation, stale responses, mathematical checks, backup corruption rejection, migration recovery, canonical document revisions, artifact undo/redo, Zotero RDF parsing, explicit-reference retrieval and OCR normalization.
- Browser integration used isolated localhost origins with synthetic documents, not the user's active library.
- Verified PDF import/read; embedded outline jump to page 2; full-text search and page navigation; local page OCR and correction save; selected page-region capture into a note.
- Verified S4 derived series 24 -> 12 -> 4 -> 1, named snapshot, manual edit, undo, saved note, reload and restored experiment state/source.
- Exported a workspace including its document, then restored it into a clean origin: one document, one note, two indexed pages and a three-version artifact history were preserved. Source jump returned to page 2.
- Zotero RDF preview and import preserved author, tag, collection and note; missing attachment was reported, relinked and opened. Reimporting the same export showed the duplicate notice without adding records. Parser fixtures cover unsafe attachment paths and unsupported XML declarations.
- Actual cube UI: z-axis 90-degree rotation produces (1 2 4 3)(5 6 8 7); 45 degrees is explicitly shown as a continuous non-symmetry state.
- Local bilingual printed-text OCR fixture recognized both Chinese and English, with reported engine confidence 95. This is not a mathematical OCR accuracy guarantee.
- Final broad live-model sample: 11/12 checks passed; the remaining supported 3D request returned prose. After adding one bounded display-plan repair, both targeted cube and derivation cases passed (2/2). Earlier keyword-only false failures were reviewed and evaluation accepts equivalent wording. Model routing and prose remain probabilistic.
- Windows setup integration: 12/12 checks passed (custom directory, shortcuts on/off, upgrade, uninstall and user-file preservation).
- Native macOS arm64/x64 and Ubuntu 22.04 x64 CI succeeded. Each packaged app loaded its window and all 13 checked assets, including both OCR language files. Linux installation/removal and macOS disk-image checks passed.
- Runtime dependency audit: zero known vulnerabilities reported. Build-only dependency findings remain separate.
- Source/runtime privacy audit: no credential matches, no test/demo documents, no user profiles and only allowlisted package roots.

Boundaries: printed Chinese/English OCR with manual correction; one-way Zotero RDF import; bounded geometry/group renderers; explicit downloads/manual updates. Windows remains unsigned and macOS is ad-hoc signed, not Developer ID signed/notarized. No ChatGPT OAuth integration is claimed.

Publication: beta.5 public release contains four installers plus SHA256SUMS.txt. Remote asset sizes/digests match the final local manifest; all four anonymous range-download probes returned 206 with 1024 bytes. Cloudflare Pages and the GitHub Pages mirror both returned beta.5 with matching checksums and English-default markup.
