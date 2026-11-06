"""Score locally kept, manually transcribed scan regions; no OCR confidence scores."""
import json
import pathlib
import sys
import unicodedata

folder = pathlib.Path(__file__).resolve().parents[1] / 'tests/reports/real-scans'
def normalize(text):
    return ''.join(c for c in unicodedata.normalize('NFKC', text).casefold() if c.isalnum())

def distance(a, b):
    row = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        nxt = [i]
        for j, y in enumerate(b, 1):
            nxt.append(min(row[j] + 1, nxt[-1] + 1, row[j - 1] + (x != y)))
        row = nxt
    return row[-1]

source = folder / (sys.argv[1] if len(sys.argv) > 1 else 'ocr-results.json')
samples = {s['id']: s for s in json.loads(source.read_text(encoding='utf-8'))}
scores = []
for truth in json.loads((folder / 'ground-truth.json').read_text(encoding='utf-8')):
    page = samples[truth['sample']]['records'][truth['page'] - 1]
    x0, y0, x1, y1 = truth['rect']
    words = [w for w in page['words'] if x0 <= w['rect'][0] + w['rect'][2]/2 <= x1 and y0 <= w['rect'][1] + w['rect'][3]/2 <= y1]
    text = ' '.join(w['text'] for w in words)
    expected, actual = normalize(truth['text']), normalize(text)
    errors = distance(expected, actual)
    scores.append({'id': truth['id'], 'referenceCharacters': len(expected), 'editDistance': errors, 'characterErrorRate': errors/len(expected), 'normalizedAccuracy': 1-errors/len(expected), 'region': truth['rect'], 'recognized': text})
    print(truth['id'], len(expected), 'characters,', errors, 'edits,', f'{100*(1-errors/len(expected)):.2f}%')
# Verify that the main columns occur in column order in the actual cached transcript.
linn = samples['linn']['records'][0]['text']
ordered = linn.index('To record a sequence') < linn.index('To erase a wrong note') < linn.index('simply use LOCATE') < linn.index('Composition Without Compromise')
report = {'method': '1 - Levenshtein CER; NFKC, lowercase, letters/digits only; manually checked whole regions. Punctuation, equations and stamp-covered text are not included in this metric.', 'source': source.name, 'twoColumnReadingOrder': ordered, 'scores': scores}
(folder / (source.stem + '-accuracy.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('Two-column cached reading order:', ordered)
