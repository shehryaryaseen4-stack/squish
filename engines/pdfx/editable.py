"""Image (or scanned page) -> an editable PDF: real text in place of the pictured text.

    pdf2docx-python engines/pdfx/editable.py <out.pdf> <lang> <dpi> <page1.png> [page2.png ...]

A searchable PDF (Tesseract's own) keeps the picture and hides the recognised words under it,
in a font with no shapes: editing that text leaves the old letters showing and falls back to
another font. Here every line Tesseract reads with confidence is:
  - measured on the picture: its text color, background color, size and weight (bold or not),
  - removed from the picture (filled with the background around it, or inpainted over photos),
  - written back as one line of real Helvetica text at the same place, size, color and weight.
The PDF then edits like any other: the text keeps its font, size, color and position, and there
is nothing left underneath. Words read with low confidence, icons and logos stay in the picture.

Prints one JSON line: {"pages": n, "lines": n, "words": n}.
"""
import json
import os
import subprocess
import sys
import warnings

warnings.filterwarnings('ignore')

import cv2  # noqa: E402
import numpy as np  # noqa: E402
import pymupdf as fitz  # noqa: E402

MIN_CONF = 55
MAX_PAGE_PT = 14000  # PDF viewers struggle above 14400 pt
ASC = set('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789bdfhiklt!?%&$#@/\\|()[]{}\'"')
DESC = set('gjpqy,;()[]{}|')


def tsv(img, lang):
    env = dict(os.environ, OMP_THREAD_LIMIT='1')
    out = subprocess.run(['tesseract', img, 'stdout', '-l', lang, '--psm', '3', 'tsv'],
                         capture_output=True, env=env, check=True).stdout.decode('utf8', 'replace')
    words = []
    for row in out.splitlines()[1:]:
        f = row.split('\t')
        if len(f) < 12 or f[0] != '5':
            continue
        text = f[11].strip()
        conf = float(f[10])
        if not text or not any(c.isalnum() for c in text):
            continue
        l, t, w, h = map(int, f[6:10])
        if w < 2 or h < 4:
            continue
        words.append({'text': text, 'conf': conf, 'x': l, 'y': t, 'w': w, 'h': h, 'key': (int(f[2]), int(f[3]), int(f[4]))})
    return words


def lines_of(words):
    """Tesseract's lines, split again where it joined words from two rows (side by side columns)."""
    groups = {}
    for w in words:
        groups.setdefault(w['key'], []).append(w)
    out = []
    for ws in groups.values():
        rows = []
        for w in sorted(ws, key=lambda w: w['y'] + w['h'] / 2):
            cy = w['y'] + w['h'] / 2
            for r in rows:
                if abs(r['cy'] - cy) < 0.45 * max(r['h'], w['h']):
                    r['words'].append(w)
                    break
            else:
                rows.append({'cy': cy, 'h': w['h'], 'words': [w]})
        for r in rows:
            r['words'].sort(key=lambda w: w['x'])
            # a big gap means two separate pieces of text on one row (a label and a button ...)
            piece = [r['words'][0]]
            for w in r['words'][1:]:
                prev = piece[-1]
                if w['x'] - (prev['x'] + prev['w']) > 2.5 * max(prev['h'], w['h']):
                    out.append(piece)
                    piece = [w]
                else:
                    piece.append(w)
            out.append(piece)
    return out


def tighten(img, words, bg):
    """Word boxes cut down to their letters: Tesseract's box sometimes takes in the edge of a photo
    or a rule above or below (ink touching the top or bottom of the box and running across it)."""
    for w in words:
        x, y, ww, hh = w['x'], w['y'], w['w'], w['h']
        d = np.abs(img[y:y + hh, x:x + ww].astype(np.int32) - bg).sum(axis=2)
        if d.size == 0 or d.max() < 60:
            continue
        ink = (d > 0.4 * d.max()).astype(np.uint8)
        n, lab, st, _ = cv2.connectedComponentsWithStats(ink, 8)
        keep = np.zeros_like(ink)
        for i in range(1, n):
            cx, cy, cw, ch, area = st[i]
            edge = cy == 0 or cy + ch >= hh
            if edge and cw > 0.7 * ww:
                continue  # a line or the edge of a picture, not a letter
            keep[lab == i] = 1
        rows = np.where(keep.any(axis=1))[0]
        if len(rows) and rows[-1] - rows[0] + 1 >= 4:
            w['y'], w['h'] = y + int(rows[0]), int(rows[-1] - rows[0] + 1)


def measure(img, words):
    """Colors, size, weight and baseline of one line, from the pixels."""
    H, W = img.shape[:2]
    x0 = min(w['x'] for w in words); y0 = min(w['y'] for w in words)
    x1 = max(w['x'] + w['w'] for w in words); y1 = max(w['y'] + w['h'] for w in words)
    first = img[max(0, y0 - 3):min(H, y1 + 3), max(0, x0 - 3):min(W, x1 + 3)].astype(np.int32)
    tighten(img, words, np.median(np.concatenate([first[:3].reshape(-1, 3), first[-3:].reshape(-1, 3)]), axis=0))
    x0 = min(w['x'] for w in words); y0 = min(w['y'] for w in words)
    x1 = max(w['x'] + w['w'] for w in words); y1 = max(w['y'] + w['h'] for w in words)
    pad = 3
    X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
    box = img[Y0:Y1, X0:X1].astype(np.int32)
    ring = np.concatenate([box[:pad].reshape(-1, 3), box[-pad:].reshape(-1, 3), box[:, :pad].reshape(-1, 3), box[:, -pad:].reshape(-1, 3)])
    bg = np.median(ring, axis=0)
    flat = bool(np.mean(np.std(ring, axis=0)) < 14)  # a plain background (not a photo)
    inner = img[y0:y1, x0:x1].astype(np.int32)
    dist = np.abs(inner - bg).sum(axis=2)
    peak = dist.max() if dist.size else 0
    if peak < 60:
        return None  # no contrast: nothing we can measure or remove cleanly
    # more ink right next to the line, on the same row: text Tesseract did not read. Replacing only
    # the part it read would leave the rest of the line in the picture, overlapping the new text.
    hh = y1 - y0
    gap = max(3, int(0.45 * hh))
    for a, b in ((max(0, x0 - gap), max(0, x0 - 1)), (min(W, x1 + 1), min(W, x1 + gap))):
        if b > a:
            side = np.abs(img[y0:y1, a:b].astype(np.int32) - bg).sum(axis=2)
            if (side > max(45, 0.5 * peak)).sum() > 2:
                return None
    # all the ink, edges included, in the box with a margin (soft letter edges reach past Tesseract's
    # box by a pixel or two): this is what is taken out of the picture
    whole = np.abs(img[Y0:Y1, X0:X1].astype(np.int32) - bg).sum(axis=2)
    mask = (whole > max(30, 0.25 * peak)).astype(np.uint8)
    strong = inner[dist >= 0.75 * peak]
    fg = np.median(strong, axis=0) if len(strong) else 255 - bg
    # stroke width from the core of the ink: area / half the outline length
    core = (dist > 0.5 * peak).astype(np.uint8)
    cnts, _ = cv2.findContours(core, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    perim = sum(cv2.arcLength(c, True) for c in cnts)
    stroke = 2.0 * core.sum() / perim if perim else 0
    text = ' '.join(w['text'] for w in words)
    # each word's height says its size, given which letters it has: capitals and tall letters reach
    # 0.72 of the size, small letters 0.53, and g, j, p, q, y hang 0.21 below the line
    def size_of(w):
        return w['h'] / ((0.72 if any(c in ASC for c in w['text']) else 0.53) + (0.21 if any(c in DESC for c in w['text']) else 0.0))
    sizes = [size_of(w) for w in words]
    med = float(np.median(sizes))
    size_h = float(np.median([z for z in sizes if z <= 1.5 * med] or sizes))  # a misread tall box does not count
    plain = [w for w in words if not any(c in DESC for c in w['text'])]
    base = float(np.median([w['y'] + w['h'] for w in plain])) if plain else y1 - 0.21 * size_h
    return {'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1, 'box': (X0, Y0, X1, Y1), 'bg': bg, 'fg': fg, 'flat': flat, 'mask': mask,
            'stroke': stroke, 'size': size_h, 'base': base, 'text': text}


def font_for(m):
    # stroke / size, measured on rendered Helvetica: regular 0.077 (60 px) to 0.102 (11 px), bold
    # 0.115 to 0.145; small screen text reads heavier still (anti-aliasing, hinting), so the limit
    # rises there and small text is only bold when clearly heavy
    size = m['size']
    limit = 0.098 + 0.035 * min(1.0, max(0.0, (20 - size) / 8))
    return 'hebo' if size > 0 and m['stroke'] / size > limit else 'helv'


def fit(m, font):
    """One size for the line: the measured one, smaller if Helvetica would run past its end."""
    width = fitz.get_text_length(m['text'], fontname=font, fontsize=1)
    size = m['size'] if width <= 0 else min(m['size'], (m['x1'] - m['x0']) * 1.03 / width)
    return max(size, 4.0)


def page(doc, path, lang, dpi, stats, words=None):
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(4)
    H, W = img.shape[:2]
    k = 72.0 / dpi
    if max(W, H) * k > MAX_PAGE_PT:
        k = MAX_PAGE_PT / max(W, H)
    if words is None:
        words = tsv(path, lang)
    clean = img.copy()
    paint = np.zeros((H, W), np.uint8)
    out = []
    for ws in lines_of(words):
        # a line is replaced only when it was read well as a whole; otherwise it stays in the picture
        # (half a line retyped next to half a line of picture would overlap)
        confs = sorted(w['conf'] for w in ws)
        if confs[len(confs) // 2] < MIN_CONF or sum(c < 35 for c in confs) > len(confs) / 4:
            continue
        m = measure(img, ws)
        if not m:
            continue
        font = font_for(m)
        size = fit(m, font)
        # take the old letters out of the picture
        grow = cv2.dilate(m['mask'], np.ones((3, 3), np.uint8), iterations=2)
        if m['flat']:
            X0, Y0, X1, Y1 = m['box']
            region = clean[Y0:Y1, X0:X1]
            region[grow > 0] = m['bg'].astype(np.uint8)
        else:
            X0, Y0, X1, Y1 = m['box']
            paint[Y0:Y1, X0:X1] |= grow
        out.append((ws, m, font, size))
    if paint.any():
        clean = cv2.inpaint(clean, paint, 3, cv2.INPAINT_TELEA)
    pg = doc.new_page(width=W * k, height=H * k)
    ok, jpg = cv2.imencode('.jpg', clean, [cv2.IMWRITE_JPEG_QUALITY, 90])
    pg.insert_image(pg.rect, stream=jpg.tobytes())
    for ws, m, font, size in out:
        color = tuple(float(c) / 255 for c in m['fg'][::-1])  # BGR -> RGB
        # the whole line as one piece of text: normal word spacing, and it edits as one line
        pg.insert_text((m['x0'] * k, m['base'] * k), m['text'], fontname=font, fontsize=size * k, color=color)
        stats['words'] += len(ws)
        stats['lines'] += 1


def main():
    out, lang, dpi, images = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4:]
    doc = fitz.open()
    stats = {'pages': len(images), 'lines': 0, 'words': 0}
    # Tesseract reads the pages side by side (one core each); the pages are then built in order
    from concurrent.futures import ThreadPoolExecutor
    workers = max(1, int(os.environ.get('OCR_PARALLEL', '2')))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        read = list(pool.map(lambda p: tsv(p, lang), images))
    for p, words in zip(images, read):
        page(doc, p, lang, dpi, stats, words)
    doc.set_metadata({'producer': 'Flipit Free OCR', 'creator': 'Flipit Free'})
    doc.save(out, garbage=3, deflate=True)
    print(json.dumps(stats))


if __name__ == '__main__':
    main()
