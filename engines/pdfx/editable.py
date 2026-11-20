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
            if edge and cw > 0.7 * ww and not (cy == 0 and cy + ch >= hh and len(w['text']) <= 2):
                continue  # a line or the edge of a picture, not a letter (a letter filling a short word's box is kept)
            keep[lab == i] = 1
        rows = np.where(keep.any(axis=1))[0]
        if len(rows) and rows[-1] - rows[0] + 1 >= 4:
            w['y'], w['h'] = y + int(rows[0]), int(rows[-1] - rows[0] + 1)


def measure(img, words, sides=True):
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
    gap = max(4, int(0.7 * hh))  # a word space is about 0.3 of the size, so this reaches the next word
    for a, b in ((max(0, x0 - gap), max(0, x0 - 1)), (min(W, x1 + 1), min(W, x1 + gap))):
        if sides and b > a:
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


def span_of(img, words):
    """The whole row of ink a line belongs to: its words' box grown sideways while there is more ink
    within a word space (the part of the line Tesseract missed). Also whether the text is lighter
    than its background (it is then inverted before reading)."""
    H, W = img.shape[:2]
    x0 = min(w['x'] for w in words); x1 = max(w['x'] + w['w'] for w in words)
    # the height comes from the words read with some confidence: a word read badly can have a box
    # far taller than the line, and the span would then take in the rows above and below
    sure = [w for w in words if w['conf'] >= 50] or words
    y0 = min(w['y'] for w in sure); y1 = max(w['y'] + w['h'] for w in sure)
    hh = max(4, y1 - y0)
    band = img[max(0, y0 - 2):min(H, y1 + 2)].astype(np.int32)
    ring = np.concatenate([band[:2, max(0, x0 - 4):x1 + 4].reshape(-1, 3), band[-2:, max(0, x0 - 4):x1 + 4].reshape(-1, 3)])
    bg = np.median(ring, axis=0)
    ink = np.abs(band - bg).sum(axis=2)
    peak = ink[:, x0:x1].max() if x1 > x0 else 0
    if peak < 60:
        return None
    thr = max(45, 0.45 * peak)
    col = (ink > thr).sum(axis=0) > 1
    # the text's own colour: ink of a clearly different colour (a red icon beside grey text) is
    # something else, and ends the line
    inner0 = img[y0:y1, x0:x1].astype(np.int32)
    d0 = np.abs(inner0 - bg).sum(axis=2)
    fg0 = np.median(inner0[d0 >= 0.75 * peak], axis=0) if (d0 >= 0.75 * peak).any() else 255 - bg
    # anti-aliased letter edges are blends of the text and background colours: a pixel counts as
    # the text's when it lies near the line from the background colour to the text colour
    v = (fg0 - bg).astype(np.float64)
    vv = max(1.0, float((v * v).sum()))
    rel = band.astype(np.float64) - bg
    t = np.clip((rel * v).sum(axis=2) / vv, 0, 1)
    off = np.abs(rel - t[..., None] * v).sum(axis=2)
    textlike = (off < 70) & (ink > thr)
    other = col & ~(textlike.sum(axis=0) > 0)
    # rows just above AND below the line: ink on both sides in the same column belongs to something
    # taller than the text (an icon, a button edge, a picture), which ends the line. (Ink on one side
    # only is usually a letter of the line above or below: the tail of a g, the top of a capital.)
    m = max(3, int(0.5 * hh))
    above = np.abs(img[max(0, y0 - 2 - m):max(0, y0 - 2)].astype(np.int32) - bg).sum(axis=2)
    below = np.abs(img[min(H, y1 + 2):min(H, y1 + 2 + m)].astype(np.int32) - bg).sum(axis=2)
    tall = np.zeros(W, bool)
    if above.size and below.size:
        tall = (above > thr).any(axis=0) & (below > thr).any(axis=0)
    gap_max, reach = int(1.1 * hh), int(40 * hh)
    def grow(x, step):
        last, gap = x, 0
        while 0 <= x + step < W and abs(x + step - last) < reach:
            x += step
            if col[x] and (tall[x] or other[x]):
                break
            if col[x]:
                last, gap = x, 0
            else:
                gap += 1
                if gap > gap_max:
                    break
        return last
    x1 = grow(x1 - 1, 1) + 1
    x0 = grow(x0, -1)
    inner = img[y0:y1, x0:x1].astype(np.int32)
    d = np.abs(inner - bg).sum(axis=2)
    fg = np.median(inner[d >= 0.75 * peak], axis=0) if (d >= 0.75 * peak).any() else 255 - bg
    return {'x0': x0, 'y0': max(0, y0 - 2), 'x1': x1, 'y1': min(H, y1 + 2), 'light': float(fg.mean()) > float(bg.mean())}


def reread(img, spans, lang, work):
    """Reads the given spans again in one Tesseract run: each is cut out, made dark on light, scaled
    so its letters are about 40 px tall and stacked with gaps. Returns the words of each span in page
    coordinates (an empty list where nothing was read)."""
    if not spans:
        return []
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    strips, y, width = [], 16, 0
    for sp in spans:
        crop = gray[sp['y0']:sp['y1'], sp['x0']:sp['x1']]
        if sp['light']:
            crop = 255 - crop
        k = min(4.0, max(1.0, 40.0 / max(1, sp['y1'] - sp['y0'])))
        crop = cv2.resize(crop, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC)
        strips.append((crop, y, k))
        y += crop.shape[0] + 28
        width = max(width, crop.shape[1])
    canvas = np.full((y + 16, width + 32), 255, np.uint8)
    for crop, top, _ in strips:
        canvas[top:top + crop.shape[0], 16:16 + crop.shape[1]] = crop
    file = os.path.join(work, 'reread-%d.png' % os.getpid())
    cv2.imwrite(file, canvas)
    env = dict(os.environ, OMP_THREAD_LIMIT='1')
    out = subprocess.run(['tesseract', file, 'stdout', '-l', lang, '--psm', '6', 'tsv'],
                         capture_output=True, env=env, check=True).stdout.decode('utf8', 'replace')
    os.remove(file)
    found = [[] for _ in spans]
    for row in out.splitlines()[1:]:
        f = row.split('\t')
        if len(f) < 12 or f[0] != '5' or not f[11].strip():
            continue
        l, t, w, h = map(int, f[6:10])
        cy = t + h / 2
        for i, (crop, top, k) in enumerate(strips):
            if top - 4 <= cy <= top + crop.shape[0] + 4:
                sp = spans[i]
                found[i].append({'text': f[11].strip(), 'conf': float(f[10]),
                                 'x': sp['x0'] + int((l - 16) / k), 'y': sp['y0'] + int((t - top) / k),
                                 'w': max(2, int(w / k)), 'h': max(4, int(h / k)), 'key': sp['key']})
                break
    return found


def word_color(img, w):
    """The strongest ink colour of a word (against the background just around it)."""
    H, W = img.shape[:2]
    x0, y0, x1, y1 = max(0, w['x'] - 2), max(0, w['y'] - 2), min(W, w['x'] + w['w'] + 2), min(H, w['y'] + w['h'] + 2)
    box = img[y0:y1, x0:x1].astype(np.int32)
    if box.size == 0:
        return None
    ring = np.concatenate([box[:2].reshape(-1, 3), box[-2:].reshape(-1, 3)])
    bg = np.median(ring, axis=0)
    d = np.abs(box - bg).sum(axis=2)
    if d.max() < 60:
        return None
    return np.median(box[d >= 0.75 * d.max()], axis=0)


def pieces(img, ws):
    """A line's words, without what is not text: an icon read as a letter at either end (ink of a
    clearly different colour from the rest of the line, like a logo beside its name) and a lone "v"
    (a menu arrow). The line is cut where such a word was, so it stays in the picture."""
    if len(ws) < 2:
        return [ws]
    cols = [word_color(img, w) for w in ws]
    known = [c for c in cols if c is not None]
    mid = np.median(known, axis=0) if known else None
    hs = sorted(w['h'] for w in ws)
    mh = hs[len(hs) // 2]
    # the height of a capital or tall letter on this line (words of small letters only are shorter)
    th = sorted(w['h'] for w in ws if any(c in ASC or c.isdigit() for c in w['text']))
    tall_h = th[len(th) // 2] if th else mh / 0.74
    def filled(w):
        box = img[w['y']:w['y'] + w['h'], w['x']:w['x'] + w['w']].astype(np.int32)
        if box.size == 0:
            return False
        bg = np.median(np.concatenate([box[:1].reshape(-1, 3), box[-1:].reshape(-1, 3)]), axis=0)
        return (np.abs(box - bg).sum(axis=2) > 60).mean() > 0.6
    def odd(i):
        if mid is not None and cols[i] is not None and np.abs(cols[i] - mid).sum() > 150 and ws[i]['conf'] < 60:
            return True
        # taller than the line's text and mostly ink, or taller and barely read: an icon
        w = ws[i]
        return w['h'] > 1.25 * tall_h and (filled(w) or w['conf'] < 45)
    keep = [True] * len(ws)
    i = 0
    while i < len(ws) - 1 and odd(i):
        keep[i] = False
        i += 1
    j = len(ws) - 1
    while j > 0 and odd(j):
        keep[j] = False
        j -= 1
    for k, w in enumerate(ws):
        if w['text'] in ('v', 'V', '~', '»', '›', '>'):
            keep[k] = False
    out, cur = [], []
    for w, k in zip(ws, keep):
        # a wide gap (menu items, table cells) also ends a piece, so each is picked up on its own
        # so does a change of colour (a name in two colours keeps both)
        i = ws.index(w)
        recol = cur and cols[i] is not None and cols[ws.index(cur[-1])] is not None and np.abs(cols[i] - cols[ws.index(cur[-1])]).sum() > 150
        if k and cur and (recol or w['x'] - (cur[-1]['x'] + cur[-1]['w']) > 2.0 * mh):
            out.append(cur)
            cur = []
        if k:
            cur.append(w)
        elif cur:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def missed_below(img, m, words):
    """A line of the same paragraph just below a line that was read, that Tesseract did not see at
    all (it happens with the last short line of a paragraph). Returns a stand-in word covering its
    ink, to be read again, or None."""
    H, W = img.shape[:2]
    hh = m['y1'] - m['y0']
    if hh < 4:
        return None
    top, bot = m['y1'] + 1, min(H, m['y1'] + int(2.6 * hh))
    x0, x1 = m['x0'], m['x1']
    if bot - top < hh:
        return None
    for w in words:  # something was read there already
        if w['x'] < x1 and w['x'] + w['w'] > x0 and w['y'] < bot and w['y'] + w['h'] > top:
            return None
    area = np.abs(img[top:bot, x0:x1].astype(np.int32) - m['bg']).sum(axis=2)
    fgd = float(np.abs(np.asarray(m['fg'], np.float64) - m['bg']).sum())
    ink = area > max(45, 0.5 * fgd)
    rows = np.where(ink.sum(axis=1) > 0)[0]
    if not len(rows):
        return None
    # the first run of rows with ink, of about the line's height, starting at the line's left edge
    r0 = rows[0]
    r1 = r0
    while r1 + 1 < len(ink) and ink[r1 + 1].any():
        r1 += 1
    if not (0.5 * hh <= r1 - r0 + 1 <= 1.4 * hh) or r0 < 0.15 * hh:
        return None
    cols = np.where(ink[r0:r1 + 1].any(axis=0))[0]
    if not len(cols) or cols[0] > 1.5 * hh:
        return None
    return {'text': '?', 'conf': 50.0, 'x': x0 + int(cols[0]), 'y': top + int(r0),
            'w': int(cols[-1] - cols[0] + 1), 'h': int(r1 - r0 + 1), 'key': m.get('key', (0, 0, 0))}


def misread(ws):
    """Whether a word is far wider than its letters could be (\"Home\" read as \"He\"): the line is
    then read again."""
    hs = sorted(w['h'] for w in ws)
    mh = hs[len(hs) // 2]
    return any(len(w['text']) <= 6 and w['w'] > 1.5 * len(w['text']) * mh for w in ws)


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
    good, retry = [], []
    for ws in [p for line in lines_of(words) for p in pieces(img, line)]:
        # a line is replaced as it is only when it was read well as a whole; a line read in part (more
        # ink beside it) or with low confidence is read again below, as a whole row
        confs = sorted(w['conf'] for w in ws)
        m = None
        if not (confs[len(confs) // 2] < MIN_CONF or sum(c < 35 for c in confs) > len(confs) / 4 or misread(ws)):
            m = measure(img, ws)
        if m:
            good.append((ws, m))
        else:
            sp = span_of(img, ws)
            if sp:
                sp['key'] = ws[0]['key']
                retry.append(sp)
    # a paragraph's line Tesseract did not see at all, just below a line it read
    for ws, m in list(good):
        w = missed_below(img, m, words)
        if w:
            sp = span_of(img, [w])
            if sp:
                sp['key'] = ws[0]['key']
                retry.append(sp)
    # spans that grew into each other (two parts of one row) are read once
    retry.sort(key=lambda sp: (sp['y0'], sp['x0']))
    merged = []
    for sp in retry:
        last = merged[-1] if merged else None
        over = min(sp['y1'], last['y1']) - max(sp['y0'], last['y0']) if last else 0
        if last and sp['x0'] <= last['x1'] and over > 0.5 * min(sp['y1'] - sp['y0'], last['y1'] - last['y0']):
            last.update(x0=min(last['x0'], sp['x0']), y0=min(last['y0'], sp['y0']), x1=max(last['x1'], sp['x1']), y1=max(last['y1'], sp['y1']))
        else:
            merged.append(dict(sp))
    # pieces of a row that is read again as a whole are dropped (the whole row replaces them)
    def inside(m, sp):
        over = min(m['y1'], sp['y1']) - max(m['y0'], sp['y0'])
        return over > 0.5 * (m['y1'] - m['y0']) and m['x0'] >= sp['x0'] - 2 and m['x1'] <= sp['x1'] + 2
    good = [(ws, m) for ws, m in good if not any(inside(m, sp) for sp in merged)]
    taken = [(m['x0'], m['y0'], m['x1'], m['y1']) for _, m in good]
    def clash(w):
        return any(w['x'] < bx1 and w['x'] + w['w'] > bx0 and w['y'] < by1 and w['y'] + w['h'] > by0 for bx0, by0, bx1, by1 in taken)
    for ws in reread(img, merged, lang, os.path.dirname(os.path.abspath(path))):
        ws = [w for w in ws if any(c.isalnum() for c in w['text']) and not clash(w)]
        # an icon or arrow read as a letter at either end, with low confidence, is left out
        while ws and ws[0]['conf'] < 40: ws.pop(0)
        while ws and ws[-1]['conf'] < 40: ws.pop()
        if not ws:
            continue
        confs = sorted(w['conf'] for w in ws)
        if confs[len(confs) // 2] < 50:
            continue
        for line in [p for l in lines_of(ws) for p in pieces(img, l)]:
            m = measure(img, line, sides=False)
            if m:
                good.append((line, m))
    # one size for the lines of a paragraph, so the paragraph is picked up and edited as one
    measured = []
    for ws, m in good:
        font = font_for(m)
        measured.append([ws, m, font, fit(m, font)])
    paras = {}
    for e in measured:
        paras.setdefault((e[0][0]['key'][0], e[0][0]['key'][1], e[2]), []).append(e)
    for group in paras.values():
        if len(group) < 2:
            continue
        sizes = sorted(e[3] for e in group)
        med = sizes[len(sizes) // 2]
        for e in group:
            if abs(e[3] - med) <= 0.3 * med:
                e[3] = med
    for ws, m, font, size in measured:
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
