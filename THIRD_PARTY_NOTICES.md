# Third-party notices

Folio's original code is Copyright © 2026 Joydivisor and Folio contributors,
licensed under GPL-3.0-only. Third-party components retain their original
copyright notices and licenses. This file does not replace those licenses.

| Component | License | Source / distributed notice |
| --- | --- | --- |
| Electron and its bundled Chromium / Node.js components | MIT and component-specific licenses | https://github.com/electron/electron · Electron's `LICENSE` and `LICENSES.chromium.html` accompany the packaged runtime. |
| Anatomy `iso-kit.mjs` | MIT | https://github.com/wheresryan22/anatomy · `public/vendor/anatomy/LICENSE` and `NOTICE.md`. Unmodified core pinned to commit `1482e8469b0a9e0d8cc18ea2740a01423d29ae80`; Folio's adapter is separate. |
| elkjs / Eclipse Layout Kernel | EPL-2.0 OR GPL-3.0-or-later | https://github.com/kieler/elkjs · `public/elk-LICENSE.md` and the license notices in `node_modules/elkjs`. |
| PDF.js | Apache-2.0 and bundled font/component licenses | https://github.com/mozilla/pdf.js · `node_modules/pdfjs-dist`. |
| Tesseract.js and its OCR runtime | Apache-2.0 and component-specific licenses | https://github.com/naptha/tesseract.js · `node_modules/tesseract.js` and `tesseract.js-core`. |
| Tesseract English / Simplified Chinese data packages | MIT package license; retain upstream data notices | https://github.com/naptha/tessdata · `node_modules/@tesseract.js-data`. |
| KaTeX | MIT and bundled font licenses | https://github.com/KaTeX/KaTeX · `node_modules/katex`. |
| markdown-it | MIT | https://github.com/markdown-it/markdown-it · `node_modules/markdown-it`. |
| fflate | MIT | https://github.com/101arrowz/fflate · `node_modules/fflate`. |

Production dependencies and their license files are included in `resources/app.asar`
(on macOS: `Folio.app/Contents/Resources/app.asar`). The lockfile records the exact
dependency versions used by the source release. Development-only dependencies
are not included in the installer payload.

The application uses Anatomy as a constrained numeric geometry/SVG library.
It does not bundle or execute the upstream Claude agent workflow.
