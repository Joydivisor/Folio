// Tesseract inserts spaces between CJK glyphs. Keep Latin word boundaries and line breaks.
export function normalizeOCRText(text){return String(text).replace(/(?<=[\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])/g,'');}
