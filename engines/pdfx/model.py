"""Read a PDF page into a document model that HTML and Word writers can rebuild.

A page becomes:
  vectors   the PDF's vector drawings (backgrounds, shapes, lines, borders) as paths
  images    each embedded picture on its own, cropped and clipped as shown on the page
  rasters   pictures of the few areas nothing else could capture (e.g. gradients), and, for
            scanned pages, the scan itself with the recognised words painted out
  tables    ruled tables, cell by cell, with their text, colours and borders
  blocks    text blocks made of paragraphs (headings, list items, body text) made of lines
            made of runs (text with font, size, colour, bold, italic, link)
  header / footer   blocks that repeat at the top or bottom of every page

Text comes from the PDF itself. OCR (Tesseract) is only used on scanned pages and only when
asked for; pages whose text is an invisible layer over a scan use that layer.
"""
import csv
import io
import math
import os
import re
import subprocess
from collections import Counter

import cv2
import numpy as np
import pymupdf as fitz

from fonts import FontInfo

BULLETS = '•●○◦▪■□‣⁃∙·➢✓✔❖►▸-*–'
ORDERED = re.compile(r'^(\(?\d{1,3}[.)]|\(?[a-zA-Z][.)]|[ivxIVX]{1,4}[.)])$')
OCR_DPI = 300
MIN_CONF = 60


def rgb(c):
    if isinstance(c, int):
        return ((c >> 16) & 255, (c >> 8) & 255, c & 255)
    if c is None:
        return None
    c = list(c) + [0, 0, 0]
    return tuple(int(round(max(0, min(1, v)) * 255)) for v in c[:3])


# ----------------------------------------------------------------------------------------- text --

def trace(page):
    """Per-span facts the text dictionary lacks: invisible text and glyph ids (for repairing fonts)."""
    invisible = set()
    glyphs = {}
    for sp in page.get_texttrace():
        name = sp['font']
        hidden = sp.get('type') == 3 or sp.get('opacity', 1) == 0
        m = glyphs.setdefault(name, {})
        for ch in sp['chars']:
            u, gid, origin = ch[0], ch[1], ch[2]
            if hidden:
                invisible.add((round(origin[0], 1), round(origin[1], 1)))
            if u > 0 and gid >= 0 and u not in m:
                m[u] = gid
    return invisible, glyphs


def raw_lines(page, invisible):
    """Lines of runs from the PDF text: visible, readable text only."""
    lines, garbled = [], []
    d = page.get_text('dict', flags=fitz.TEXT_PRESERVE_WHITESPACE | fitz.TEXT_MEDIABOX_CLIP)
    for b in d['blocks']:
        for ln in b.get('lines', []):
            runs = []
            for sp in ln['spans']:
                t = sp['text']
                if not t:
                    continue
                o = sp['origin']
                if (round(o[0], 1), round(o[1], 1)) in invisible:
                    continue
                if t.count('�') > len(t) / 4:
                    garbled.append(fitz.Rect(sp['bbox']))
                    continue
                runs.append({'text': t, 'font': sp['font'], 'size': sp['size'], 'flags': sp['flags'], 'color': rgb(sp['color']),
                             'bbox': fitz.Rect(sp['bbox']), 'origin': o, 'asc': sp.get('ascender', 0.9), 'desc': sp.get('descender', -0.2),
                             'alpha': sp.get('alpha', 255), 'link': None})
            while runs and not runs[0]['text'].strip():
                runs.pop(0)
            while runs and not runs[-1]['text'].strip():
                runs.pop()
            if not runs:
                continue
            dx, dy = ln['dir']
            lines.append({'runs': runs, 'bbox': fitz.Rect(ln['bbox']), 'angle': math.degrees(math.atan2(dy, dx)), 'block': id(b)})
    return lines, garbled


def finish_runs(line, fonts):
    """Fix spaces between runs placed apart, and bold/italic from the font."""
    runs = line['runs']
    out = []
    for r in runs:
        fi = fonts.get(r['font']) or FontInfo(r['font'])
        r['bold'] = bool(r['flags'] & 16) or fi.bold
        r['italic'] = bool(r['flags'] & 2) or fi.italic
        if out:
            prev = out[-1]
            gap = r['bbox'].x0 - prev['bbox'].x1
            if gap > r['size'] * 0.15 and not prev['text'].endswith(' ') and not r['text'].startswith(' '):
                prev['text'] += ' '
        out.append(r)
    line['runs'] = out
    line['x'] = runs[0]['bbox'].x0
    line['baseline'] = runs[0]['origin'][1]
    line['origin'] = runs[0]['origin']
    line['size'] = max(r['size'] for r in runs)
    line['text'] = ''.join(r['text'] for r in runs)


def split_columns(line):
    """Split a line where runs are far apart (tab stops, columns) so each part keeps its place."""
    if abs(line['angle']) >= 1 or len(line['runs']) < 2:
        return [line]
    parts, cur = [], [line['runs'][0]]
    for r in line['runs'][1:]:
        if r['bbox'].x0 - cur[-1]['bbox'].x1 > max(r['size'], cur[-1]['size']) * 1.5:
            parts.append(cur)
            cur = [r]
        else:
            cur.append(r)
    parts.append(cur)
    if len(parts) == 1:
        return [line]
    out = []
    for p in parts:
        bb = fitz.Rect(p[0]['bbox'])
        for r in p[1:]:
            bb |= r['bbox']
        out.append({'runs': p, 'bbox': bb, 'angle': 0.0, 'block': (line['block'], len(out))})
    return out


def is_bullet(text):
    """A bullet on its own ('•') or at the start of the text ('•  First point')."""
    t = text.strip()
    return bool(t) and t[0] in BULLETS and (len(t) == 1 or t[1].isspace())


def paragraphs(lines, body_size):
    """Group the lines of one text block into paragraphs: headings, list items and body text."""
    lines = sorted(lines, key=lambda l: (l['baseline'], l['x']))
    paras = []
    for ln in lines:
        first = ln['runs'][0]['text'].strip()
        bullet = is_bullet(ln['runs'][0]['text']) or bool(ORDERED.match(first.split()[0] if first else ''))
        if paras:
            p = paras[-1]
            last = p['lines'][-1]
            gap = ln['bbox'].y0 - last['bbox'].y1
            step = ln['baseline'] - last['baseline']
            same_size = abs(ln['size'] - last['size']) <= max(0.6, last['size'] * 0.12)
            spacing = p.get('step') or step
            new = (bullet or not same_size or gap > max(2.5, last['size'] * 0.6) or step <= 0 or abs(last['angle']) >= 1
                   or (p.get('step') and abs(step - p['step']) > max(1.0, p['step'] * 0.25)) or abs(ln['angle']) >= 1)
            if not new:
                p['lines'].append(ln)
                p['step'] = spacing
                continue
        paras.append({'lines': [ln], 'bullet': bullet, 'step': None, 'glyph': is_bullet(ln['runs'][0]['text'])})
    # "1." or "a)" starts a list item only when items follow one another ("M. Siddiqui" is a name)
    for i, p in enumerate(paras):
        if p['bullet'] and not p['glyph']:
            near = [paras[j] for j in (i - 1, i + 1) if 0 <= j < len(paras)]
            if not any(q['bullet'] for q in near):
                p['bullet'] = False
    for p in paras:
        ls = p['lines']
        p['bbox'] = fitz.Rect(ls[0]['bbox'])
        for l in ls[1:]:
            p['bbox'] |= l['bbox']
        size = max(l['size'] for l in ls)
        bold = all(r['bold'] for l in ls for r in l['runs'] if r['text'].strip())
        p['size'] = size
        p['kind'] = 'li' if p['bullet'] else 'p'
        if not p['bullet'] and len(ls) <= 3 and body_size and (size >= body_size * 1.25 or (bold and size >= body_size * 1.1)):
            p['kind'] = 'h'
        p['align'] = alignment(ls)
    return paras


def alignment(ls):
    if len(ls) < 2:
        return 'left'
    lefts = [l['bbox'].x0 for l in ls]
    rights = [l['bbox'].x1 for l in ls]
    mids = [(l['bbox'].x0 + l['bbox'].x1) / 2 for l in ls]
    tol = max(1.5, ls[0]['size'] * 0.2)
    same = lambda v: max(v) - min(v) <= tol
    if same(lefts[1:]) and same(rights[:-1]) and len(ls) >= 3 and not same(rights):
        return 'justify'
    if same(lefts[1:]) or same(lefts):
        if same(rights[:-1]) and len(ls) >= 2 and max(rights) - min(rights) <= tol:
            return 'justify'
        return 'left'
    if same(mids):
        return 'center'
    if same(rights):
        return 'right'
    return 'left'


# --------------------------------------------------------------------------------------- tables --

def edges(drawings):
    """Horizontal (y, x0, x1) and vertical (x, y0, y1) edges drawn on the page: lines and the
    sides of filled rectangles."""
    hs, vs = [], []
    for d in drawings:
        for it in d['items']:
            if it[0] == 'l':
                a, b = it[1], it[2]
                if abs(a.y - b.y) < 0.8:
                    hs.append((a.y, min(a.x, b.x), max(a.x, b.x)))
                elif abs(a.x - b.x) < 0.8:
                    vs.append((a.x, min(a.y, b.y), max(a.y, b.y)))
            elif it[0] in ('re', 'qu'):
                r = it[1] if it[0] == 're' else it[1].rect
                hs += [(r.y0, r.x0, r.x1), (r.y1, r.x0, r.x1)]
                vs += [(r.x0, r.y0, r.y1), (r.x1, r.y0, r.y1)]
        r = fitz.Rect(d['rect'])
        if d.get('fill') is not None and len(d['items']) == 4 and all(it[0] == 'l' for it in d['items']):
            hs += [(r.y0, r.x0, r.x1), (r.y1, r.x0, r.x1)]
            vs += [(r.x0, r.y0, r.y1), (r.x1, r.y0, r.y1)]
    return hs, vs


def find_tables(page, lines, drawings):
    """Ruled tables as grids of cells; their text is taken out of the lines. A grid counts as a
    table only when most of its inner row or column boundaries are drawn on the page; its outer
    edges are moved onto the drawn edges (backgrounds, rules) next to them."""
    try:
        found = page.find_tables()
    except Exception:
        return [], lines
    hs, vs = edges(drawings)
    tables = []
    for tb in found.tables:
        if tb.row_count < 2 or tb.col_count < 2:
            continue
        cells = [fitz.Rect(c) for c in tb.cells if c]
        if len(cells) < 3:
            continue
        xs = sorted({round(v, 1) for c in cells for v in (c.x0, c.x1)})
        ys = sorted({round(v, 1) for c in cells for v in (c.y0, c.y1)})
        xs = merge_close(xs)
        ys = merge_close(ys)
        if len(xs) < 3 or len(ys) < 3:
            continue
        width, height = xs[-1] - xs[0], ys[-1] - ys[0]

        def covered(segs, at, lo, hi):
            """How much of lo..hi the segments at this coordinate cover (cell borders are often
            drawn cell by cell)."""
            parts = sorted((max(lo, e[1]), min(hi, e[2])) for e in segs if abs(e[0] - at) <= 1.5 and e[2] > lo and e[1] < hi)
            total, end = 0.0, lo
            for a, b in parts:
                if b > end:
                    total += b - max(a, end)
                    end = b
            return total

        drawn_h = lambda y: covered(hs, y, xs[0], xs[-1]) >= width * 0.5
        drawn_v = lambda x: covered(vs, x, ys[0], ys[-1]) >= height * 0.3
        inner_r = [drawn_h(y) for y in ys[1:-1]]
        inner_c = [drawn_v(x) for x in xs[1:-1]]
        if not ((inner_r and sum(inner_r) >= len(inner_r) * 0.6) or (inner_c and sum(inner_c) >= len(inner_c) * 0.6)):
            continue
        old = (xs[0], ys[0], xs[-1], ys[-1])
        top = [e[0] for e in hs if old[1] - 12 <= e[0] <= old[1] + 0.5 and e[2] - e[1] >= width * 0.5]
        bottom = [e[0] for e in hs if old[3] - 0.5 <= e[0] <= old[3] + 12 and e[2] - e[1] >= width * 0.5]
        if top:
            ys[0] = min(top)
        if bottom:
            ys[-1] = max(bottom)
        span = [e for e in hs if ys[0] - 0.5 <= e[0] <= ys[-1] + 0.5 and e[2] - e[1] >= width * 0.5]
        left = [e[1] for e in span if old[0] - 12 <= e[1] <= old[0] + 0.5] + [e[0] for e in vs if old[0] - 12 <= e[0] <= old[0] + 0.5]
        right = [e[2] for e in span if old[2] - 0.5 <= e[2] <= old[2] + 12] + [e[0] for e in vs if old[2] - 0.5 <= e[0] <= old[2] + 12]
        if left:
            xs[0] = min(left)
        if right:
            xs[-1] = max(right)
        idx = lambda arr, v: min(range(len(arr)), key=lambda i: abs(arr[i] - v))
        cells = [fitz.Rect(xs[0] if abs(c.x0 - old[0]) < 0.5 else c.x0, ys[0] if abs(c.y0 - old[1]) < 0.5 else c.y0,
                           xs[-1] if abs(c.x1 - old[2]) < 0.5 else c.x1, ys[-1] if abs(c.y1 - old[3]) < 0.5 else c.y1) for c in cells]
        grid = []
        for c in cells:
            c0, c1, r0, r1 = idx(xs, c.x0), idx(xs, c.x1), idx(ys, c.y0), idx(ys, c.y1)
            if c1 <= c0 or r1 <= r0:
                continue
            grid.append({'row': r0, 'col': c0, 'rowspan': r1 - r0, 'colspan': c1 - c0, 'bbox': fitz.Rect(xs[c0], ys[r0], xs[c1], ys[r1]),
                         'lines': [], 'fill': None, 'borders': {}})
        if not grid:
            continue
        bbox = fitz.Rect(xs[0], ys[0], xs[-1], ys[-1])
        tables.append({'bbox': bbox, 'xs': xs, 'ys': ys, 'cells': grid})
    rest = []
    for ln in lines:
        c = (ln['bbox'].tl + ln['bbox'].br) / 2
        home = None
        for t in tables:
            if c in t['bbox']:
                for cell in t['cells']:
                    if c in cell['bbox']:
                        home = cell
                        break
            if home:
                break
        if home is not None and abs(ln['angle']) < 1:
            home['lines'].append(ln)
        else:
            rest.append(ln)
    return tables, rest


def merge_close(vals, tol=2.0):
    out = []
    for v in vals:
        if out and v - out[-1] <= tol:
            continue
        out.append(v)
    return out


def table_styles(tables, vectors):
    """Cell colours and borders from the drawings inside each table; those drawings are then
    drawn by the table itself (and removed from the vector layer)."""
    keep = []
    for v in vectors:
        r = v['rect']
        home = next((t for t in tables if r in fitz.Rect(t['bbox'].x0 - 2, t['bbox'].y0 - 2, t['bbox'].x1 + 2, t['bbox'].y1 + 2)), None)
        if not home or not all(it[0] in ('re', 'l') or (it[0] == 'qu' and it[1].is_rectangular) for it in v['items']):
            keep.append(v)
            continue
        used = False
        thin = min(r.width, r.height) <= 2.5
        if v.get('fill') and not thin:
            for cell in home['cells']:
                c = (cell['bbox'].tl + cell['bbox'].br) / 2
                if c in r and (cell['fill'] is None or cell.get('fill_area', 1e9) > r.get_area()):
                    cell['fill'], cell['fill_area'] = rgb(v['fill']), r.get_area()
                    used = True
            if used and not v.get('color'):
                continue
        segs = []
        for it in v['items']:
            if it[0] == 'l':
                segs.append((it[1], it[2], v.get('width') or 1, v.get('color')))
            elif thin and v.get('fill'):
                if r.width <= r.height:
                    segs.append((fitz.Point((r.x0 + r.x1) / 2, r.y0), fitz.Point((r.x0 + r.x1) / 2, r.y1), r.width, v['fill']))
                else:
                    segs.append((fitz.Point(r.x0, (r.y0 + r.y1) / 2), fitz.Point(r.x1, (r.y0 + r.y1) / 2), r.height, v['fill']))
            elif it[0] in ('re', 'qu') and v.get('color'):
                rr = it[1] if it[0] == 're' else it[1].rect
                w = v.get('width') or 1
                segs += [(rr.tl, rr.tr, w, v['color']), (rr.bl, rr.br, w, v['color']), (rr.tl, rr.bl, w, v['color']), (rr.tr, rr.br, w, v['color'])]
        placed = 0
        for a, b, w, col in segs:
            if col is None:
                continue
            horiz = abs(a.y - b.y) < 1
            vert = abs(a.x - b.x) < 1
            if not horiz and not vert:
                continue
            for cell in home['cells']:
                cb = cell['bbox']
                tol = 2.5
                if horiz and min(a.x, b.x) <= cb.x1 - 1 and max(a.x, b.x) >= cb.x0 + 1:
                    if abs(a.y - cb.y0) <= tol:
                        cell['borders']['top'] = (w, rgb(col)); placed += 1
                    if abs(a.y - cb.y1) <= tol:
                        cell['borders']['bottom'] = (w, rgb(col)); placed += 1
                if vert and min(a.y, b.y) <= cb.y1 - 1 and max(a.y, b.y) >= cb.y0 + 1:
                    if abs(a.x - cb.x0) <= tol:
                        cell['borders']['left'] = (w, rgb(col)); placed += 1
                    if abs(a.x - cb.x1) <= tol:
                        cell['borders']['right'] = (w, rgb(col)); placed += 1
        if not placed and not used:
            keep.append(v)
    return keep


# --------------------------------------------------------------------------- vectors / images --

def vectors(page):
    out = []
    for d in page.get_drawings():
        if not d.get('items'):
            continue
        fill, stroke = d.get('fill'), d.get('color')
        if fill is None and stroke is None:
            continue
        if (fill is None or (d.get('fill_opacity') or 0) == 0) and (stroke is None or (d.get('stroke_opacity') or 0) == 0):
            continue
        r = fitz.Rect(d['rect'])
        if r.is_empty and not r.is_infinite and r.width == 0 and r.height == 0:
            continue
        out.append(d)
    return out


def layer_pages(pdf, pno, text_rects):
    """Two working copies of the page: 'clean' without the extracted text (pictures are cut from
    it) and 'rest' with only what neither text, images nor vectors cover."""
    work = fitz.open()
    work.insert_pdf(pdf, from_page=pno, to_page=pno)
    work.insert_pdf(pdf, from_page=pno, to_page=pno)
    for i in (0, 1):
        pg = work[i]
        for r, angle in text_rects:
            r = fitz.Rect(r)
            if 45 <= abs(angle) <= 135:  # vertical text: its letters stand across the width
                w = r.width
                r.x0 += w * 0.2
                r.x1 -= w * 0.2
            else:
                h = r.height
                r.y0 += h * 0.2
                r.y1 -= h * 0.2
            if not r.is_empty:
                pg.add_redact_annot(r, fill=False)
        pg.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE, text=fitz.PDF_REDACT_TEXT_REMOVE)
    images_only = work[0]
    rest = work[1]
    rest.add_redact_annot(rest.rect, fill=False)
    rest.apply_redactions(images=fitz.PDF_REDACT_IMAGE_REMOVE, graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED, text=fitz.PDF_REDACT_TEXT_NONE)
    # the picture layer: text gone, vector art gone, pictures stay (with their clipping)
    clean = fitz.open()
    clean.insert_pdf(work, from_page=0, to_page=0)
    cp = clean[0]
    cp.add_redact_annot(cp.rect, fill=False)
    cp.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED, text=fitz.PDF_REDACT_TEXT_NONE)
    return work, images_only, clean, rest


def encode(pix, photo_hint=True):
    """PNG for pictures with transparency or few colours, JPEG for photos."""
    a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    opaque = pix.n < 4 or a[:, :, 3].min() == 255
    if pix.n == 4 and a[:, :, 3].max() == 0:
        return None, None
    if opaque and photo_hint and pix.width * pix.height > 4000:
        rgbimg = a[:, :, :3]
        small = rgbimg[::4, ::4].reshape(-1, 3)
        colours = len(np.unique(small[:, 0].astype(np.int32) * 65536 + small[:, 1].astype(np.int32) * 256 + small[:, 2]))
        if colours > 256:
            ok, buf = cv2.imencode('.jpg', cv2.cvtColor(np.ascontiguousarray(rgbimg), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 88])
            return buf.tobytes(), 'jpg'
    if pix.n == 4:
        ok, buf = cv2.imencode('.png', cv2.cvtColor(np.ascontiguousarray(a), cv2.COLOR_RGBA2BGRA))
    else:
        ok, buf = cv2.imencode('.png', cv2.cvtColor(np.ascontiguousarray(a[:, :, :3]), cv2.COLOR_RGB2BGR))
    return buf.tobytes(), 'png'


def images(page, clean_page):
    """Each picture on the page, cut out of the picture layer so clipping (round photos) and
    transparency stay as they look, at about its own resolution (96-300 dpi)."""
    out, seen = [], set()
    for info in page.get_image_info(xrefs=True):
        r = fitz.Rect(info['bbox']) & page.rect
        if r.is_empty or r.width < 1 or r.height < 1:
            continue
        key = (round(r.x0), round(r.y0), round(r.x1), round(r.y1))
        if key in seen:
            continue
        seen.add(key)
        w_px = info.get('width') or 0
        dpi = 150 if not w_px else min(300, max(96, w_px / max(1e-3, r.width / 72)))
        pix = clean_page.get_pixmap(clip=r, dpi=int(dpi), alpha=True, colorspace=fitz.csRGB)
        data, ext = encode(pix)
        if data is None:
            continue
        out.append({'bbox': r, 'data': data, 'ext': ext, 'px': (pix.width, pix.height), 'xref': info.get('xref', 0)})
    return out


def residue(rest_page, clean_doc_page, garbled):
    """Areas still showing something after text, pictures and vector art were taken out (e.g.
    gradients, patterns, text in unreadable fonts): kept as pictures of just those areas."""
    pix = rest_page.get_pixmap(dpi=36, alpha=False, colorspace=fitz.csRGB)
    a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    mask = (np.abs(a.astype(np.int16) - 255).sum(axis=2) > 24).astype(np.uint8)
    if not mask.any():
        return []
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask)
    k = 72 / 36
    out = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 3:
            continue
        r = fitz.Rect(x * k, y * k, (x + w) * k, (y + h) * k) & rest_page.rect
        if r.is_empty:
            continue
        pix2 = clean_doc_page.get_pixmap(clip=r, dpi=150, alpha=True, colorspace=fitz.csRGB)
        data, ext = encode(pix2)
        if data:
            out.append({'bbox': r, 'data': data, 'ext': ext, 'kind': 'residue'})
    return out


# ------------------------------------------------------------------------------------------- OCR --

def osd(png):
    """Tesseract's orientation check: degrees to rotate the picture clockwise to make it upright."""
    try:
        out = subprocess.run(['tesseract', png, 'stdout', '--psm', '0'], capture_output=True, timeout=60,
                             env={**os.environ, 'OMP_THREAD_LIMIT': '1'}).stdout.decode('utf-8', 'replace')
    except Exception:
        return 0
    m = re.search(r'Rotate:\s*(\d+)', out)
    c = re.search(r'Orientation confidence:\s*([\d.]+)', out)
    if m and c and float(c.group(1)) >= 2:
        return int(m.group(1)) % 360
    return 0


def tesseract_words(png, lang):
    out = subprocess.run(['tesseract', png, 'stdout', '-l', lang, '--psm', '3', 'tsv'], capture_output=True, check=True,
                         env={**os.environ, 'OMP_THREAD_LIMIT': '1'}).stdout
    words = []
    for r in csv.DictReader(io.StringIO(out.decode('utf-8', 'replace')), delimiter='\t', quoting=csv.QUOTE_NONE):
        text = (r.get('text') or '').strip()
        if r.get('level') != '5' or not text:
            continue
        x, y, w, h = (int(r[k]) for k in ('left', 'top', 'width', 'height'))
        words.append({'text': text, 'box': (x, y, x + w, y + h), 'conf': float(r.get('conf') or -1),
                      'key': (int(r['block_num']), int(r['par_num']), int(r['line_num']))})
    return words


ASC = set('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789bdfhklt!?%$&#@/()[]{}|ÄÖÜÉÈÀ')
DESC = set('gjpqy,;()[]{}|@')


def size_of(text, y0, y1):
    """Font size (pixels) from a word's ink height: capitals reach 0.72 of the size above the
    baseline, lower case 0.52, descenders 0.21 below it. Returns (size, descender part)."""
    top = 0.72 if any(c in ASC for c in text) else 0.52
    bottom = 0.21 if any(c in DESC for c in text) else 0
    return (y1 - y0) / (top + bottom), bottom


def style_of(img, box):
    """(colour, stroke width) of the ink in a box; the background is a ring just outside it."""
    x0, y0, x1, y1 = box
    part = img[y0:y1, x0:x1].astype(np.int32)
    if not part.size:
        return (0, 0, 0), 0
    H, W = img.shape[:2]
    r = 6
    outer = img[max(0, y0 - r):min(H, y1 + r), max(0, x0 - r):min(W, x1 + r)].astype(np.int32)
    ring = np.ones(outer.shape[:2], bool)
    ring[min(r, y0):min(r, y0) + (y1 - y0), min(r, x0):min(r, x0) + (x1 - x0)] = False
    bg = np.median(outer[ring], axis=0) if ring.any() else np.median(part.reshape(-1, 3), axis=0)
    dist = np.abs(part - bg).sum(axis=2)
    ink = part[dist >= max(60, dist.max() * 0.6)]
    colour = tuple(int(v) for v in np.median(ink, axis=0)) if len(ink) else (0, 0, 0)
    mask = (dist > max(60, dist.max() * 0.5)).astype(np.uint8)
    dt = cv2.distanceTransform(np.pad(mask, 1), cv2.DIST_L2, 3)[1:-1, 1:-1]
    inside = dt[mask > 0]
    return colour, (2 * float(np.percentile(inside, 90)) if inside.size else 0)


def word_lines(words, img, k, reliable):
    """Words (picture pixels) -> lines of one run each, in points; unreliable words are left out
    (they stay in the picture). Lines break where words are far apart (columns)."""
    groups = {}
    for w in words:
        groups.setdefault(w['key'], []).append(w)
    # stroke weight of every reliable word relative to its letter size; bold = clearly heavier
    # than the page's usual text
    ratios = []
    for w in words:
        if reliable(w):
            x0, y0, x1, y1 = w['box']
            w['style'] = style_of(img, w['box'])
            w['ratio'] = w['style'][1] / max(1, size_of(w['text'], y0, y1)[0])
            ratios.append(w['ratio'])
    usual = sorted(ratios)[len(ratios) // 2] if ratios else 0.1
    lines = []
    for key, ws in sorted(groups.items()):
        ws.sort(key=lambda w: w['box'][0])
        hs = sorted(w['box'][3] - w['box'][1] for w in ws)
        gap = max(12, hs[len(hs) // 2] * 1.6)
        seg = []
        segs = []
        for w in ws:
            if not reliable(w) or (seg and w['box'][0] - seg[-1]['box'][2] > gap):
                if seg:
                    segs.append(seg)
                seg = []
            if reliable(w):
                seg.append(w)
        if seg:
            segs.append(seg)
        for s in segs:
            x0, y0 = min(w['box'][0] for w in s), min(w['box'][1] for w in s)
            x1, y1 = max(w['box'][2] for w in s), max(w['box'][3] for w in s)
            text = ' '.join(w['text'] for w in s)
            sizes = sorted(size_of(w['text'], w['box'][1], w['box'][3])[0] for w in s)
            size_px = sizes[len(sizes) // 2]
            size = max(4, round(size_px * k * 2) / 2)
            base = max(w['box'][3] - size_of(w['text'], w['box'][1], w['box'][3])[1] * size_of(w['text'], w['box'][1], w['box'][3])[0] for w in s) * k
            # colour and weight word by word; neighbouring words that look alike share a run
            runs = []
            for w in s:
                colour = w['style'][0]
                bold = w['ratio'] > max(0.1, usual * 1.3)
                bb = fitz.Rect(w['box'][0] * k, w['box'][1] * k, w['box'][2] * k, w['box'][3] * k)
                if runs and runs[-1]['bold'] == bold and sum(abs(a - b) for a, b in zip(runs[-1]['color'], colour)) < 90:
                    r = runs[-1]
                    r['text'] += ' ' + w['text']
                    r['bbox'] |= bb
                    continue
                if runs:
                    runs[-1]['text'] += ' '
                runs.append({'text': w['text'], 'font': 'Arial', 'size': size, 'flags': 16 if bold else 0, 'color': colour, 'bbox': bb,
                             'origin': (bb.x0, base), 'asc': 0.905, 'desc': -0.212, 'alpha': 255, 'link': None, 'bold': bold, 'italic': False})
            bbox = fitz.Rect(x0 * k, y0 * k, x1 * k, y1 * k)
            lines.append({'runs': runs, 'bbox': bbox, 'angle': 0.0, 'block': key[:2], 'x': bbox.x0, 'baseline': base, 'size': size,
                          'text': text, 'ocr': True, 'origin': (x0 * k, base)})
    return lines


def scan_page(page, lang, work, n, words_from_pdf=False):
    """A scanned page: the scan with the read words painted out, plus the words as text."""
    pix = page.get_pixmap(dpi=OCR_DPI, alpha=False, colorspace=fitz.csRGB)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).copy()
    k = page.rect.width / pix.width
    rotated = 0
    if words_from_pdf:
        words = []
        for x0, y0, x1, y1, t, b, l, _ in page.get_text('words'):
            words.append({'text': t, 'box': (int(x0 / k), int(y0 / k), int(x1 / k), int(y1 / k)), 'conf': 100, 'key': (b, 0, l)})
    else:
        png = os.path.join(work, f'ocr-{n}.png')
        cv2.imwrite(png, cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
        rotated = osd(png)
        if rotated:
            img = np.ascontiguousarray(np.rot90(img, k=-(rotated // 90)))
            cv2.imwrite(png, cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
        words = tesseract_words(png, lang)
        os.remove(png)

    def reliable(w):
        t = w['text']
        if w['conf'] < MIN_CONF or not any(c.isalnum() for c in t):
            return False
        x0, y0, x1, y1 = w['box']
        if x1 - x0 < 2 or y1 - y0 < 5:
            return False
        if len(t) >= 2:
            by_h = size_of(t, y0, y1)[0]
            by_w = (x1 - x0) / max(0.1, fitz.get_text_length(t, fontname='helv', fontsize=1))
            if max(by_h, by_w) / max(1e-6, min(by_h, by_w)) >= 1.7:
                return False
        return True

    H, W = img.shape[:2]
    w_pt, h_pt = W * k, H * k
    lines = word_lines(words, img, k, reliable)
    mask = np.zeros(img.shape[:2], np.uint8)
    pad = 4
    for w in words:
        if reliable(w):
            x0, y0, x1, y1 = w['box']
            mask[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad] = 255
    for w in words:  # words that stay in the picture keep every pixel
        if not reliable(w):
            x0, y0, x1, y1 = w['box']
            mask[y0:y1, x0:x1] = 0
    clean = cv2.inpaint(img, mask, 5, cv2.INPAINT_TELEA) if mask.any() else img
    bw, bh = max(1, round(w_pt * 200 / 72)), max(1, round(h_pt * 200 / 72))
    small = cv2.resize(clean, (bw, bh), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode('.jpg', cv2.cvtColor(small, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 85])
    raster = {'bbox': fitz.Rect(0, 0, w_pt, h_pt), 'data': buf.tobytes(), 'ext': 'jpg', 'kind': 'scan'}
    return {'w': w_pt, 'h': h_pt, 'lines': lines, 'raster': raster, 'rotated': rotated, 'words': len(words)}


# -------------------------------------------------------------------------------------- the page --

def page_kind(page, invisible_count, visible_chars):
    area = page.rect.get_area() or 1
    big = 0
    for info in page.get_image_info():
        r = fitz.Rect(info['bbox']) & page.rect
        big = max(big, r.get_area() / area)
    if visible_chars >= 20 or (visible_chars > 0 and big < 0.5):
        return 'text'
    if invisible_count >= 20 and big >= 0.3:
        return 'textlayer'
    if big >= 0.3:
        return 'scan'
    return 'text'


def analyze(pdf, mode, lang, work, report):
    """All pages -> (pages, fonts). mode 'text' never runs OCR; 'ocr' reads scanned pages with it."""
    # straighten rotated pages first, so every coordinate is as the page is shown
    for page in pdf:
        if page.rotation:
            page.remove_rotation()
    used = {}
    facts = []
    for page in pdf:
        invisible, glyphs = trace(page)
        for name, m in glyphs.items():
            dst = used.setdefault(name, {})
            for u, g in m.items():
                dst.setdefault(u, g)
        lines, garbled = raw_lines(page, invisible)
        visible = sum(len(l['runs'][0]['text'].strip()) + sum(len(r['text'].strip()) for r in l['runs'][1:]) for l in lines)
        facts.append((lines, garbled, page_kind(page, len(invisible), visible)))
    from fonts import collect
    fonts = collect(pdf, used)

    pages = []
    for n, page in enumerate(pdf):
        lines, garbled, kind = facts[n]
        w, h = page.rect.width, page.rect.height
        pg = {'n': n, 'w': w, 'h': h, 'kind': kind, 'vectors': [], 'images': [], 'rasters': [], 'tables': [], 'blocks': [],
              'header': [], 'footer': [], 'links': []}
        if kind in ('scan', 'textlayer'):
            if kind == 'scan' and mode != 'ocr':
                report['warnings'].append(f'Page {n + 1} is a scanned picture with no text in it. Choose OCR to get editable text from it.')
                report['scanned_no_ocr'].append(n + 1)
                kind = pg['kind'] = 'picture'
            else:
                s = scan_page(page, lang, work, n, words_from_pdf=(kind == 'textlayer'))
                pg['w'], pg['h'] = s['w'], s['h']
                pg['rasters'].append(s['raster'])
                if kind == 'scan':
                    report['ocr_pages'].append(n + 1)
                    if s['rotated']:
                        report['warnings'].append(f'Page {n + 1} was scanned sideways or upside down; it was turned upright ({s["rotated"]}°).')
                else:
                    report['text_layer_pages'].append(n + 1)
                body = median_size(s['lines'])
                for blk in group_blocks(s['lines']):
                    pg['blocks'].append(make_block(blk, body))
                if not s['lines']:
                    report['warnings'].append(f'No readable text was found on page {n + 1}.')
                pages.append(pg)
                continue

        # a page with real text (or pictures/drawings only)
        for ln in lines:
            finish_runs(ln, fonts)
        split = []
        for ln in lines:
            for part in split_columns(ln):
                if part is not ln:
                    finish_runs(part, fonts)
                split.append(part)
        lines = split
        links = []
        for lk in page.get_links():
            target = lk.get('uri') or (f'#page-{lk["page"] + 1}' if lk.get('kind') == fitz.LINK_GOTO and lk.get('page', -1) >= 0 else None)
            if target:
                links.append((fitz.Rect(lk['from']), target))
        for ln in lines:
            for r in ln['runs']:
                c = (r['bbox'].tl + r['bbox'].br) / 2
                for rect, target in links:
                    if c in rect:
                        r['link'] = target
                        break
        text_rects = [(r['bbox'], ln.get('angle', 0)) for ln in lines for r in ln['runs']]
        work_doc, images_only, clean, rest = layer_pages(pdf, n, text_rects)
        vecs = vectors(page)
        tables, free = find_tables(page, lines, vecs)
        vecs = table_styles(tables, vecs)
        for t in tables:
            body = median_size([l for c in t['cells'] for l in c['lines']]) or 10
            for c in t['cells']:
                c['paras'] = paragraphs(c['lines'], body) if c['lines'] else []
        pg['tables'] = tables
        pg['vectors'] = vecs
        pg['images'] = images(page, clean[0])
        pg['rasters'] = residue(rest, images_only, garbled)
        if pg['rasters']:
            report['warnings'].append(f'Page {n + 1}: {len(pg["rasters"])} area(s) (for example gradients or text in unreadable fonts) are kept as pictures of that area.')
        body = median_size(free)
        for blk in group_blocks(free):
            pg['blocks'].append(make_block(blk, body))
        if kind == 'picture' and not free:
            pass
        pages.append(pg)
    mark_headers(pages)
    return pages, fonts


def median_size(lines):
    sizes = []
    for l in lines:
        for r in l['runs']:
            sizes += [r['size']] * len(r['text'].strip())
    if not sizes:
        return 0
    sizes.sort()
    return sizes[len(sizes) // 2]


def group_blocks(lines):
    groups = {}
    order = []
    for ln in lines:
        key = ln['block']
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(ln)
    return [groups[k] for k in order]


def make_block(lines, body):
    paras = paragraphs(lines, body)
    bbox = fitz.Rect(paras[0]['bbox'])
    for p in paras[1:]:
        bbox |= p['bbox']
    return {'bbox': bbox, 'paras': paras}


def mark_headers(pages):
    """Blocks repeated near the top/bottom of (nearly) every page are the header/footer; page
    numbers among them are marked so Word can show a page-number field."""
    if len(pages) < 2:
        return
    norm = lambda t: re.sub(r'\d+', '#', re.sub(r'\s+', ' ', t.strip().lower()))
    seen = Counter()
    for pg in pages:
        keys = set()
        for b in pg['blocks']:
            zone = 'top' if b['bbox'].y1 <= pg['h'] * 0.12 else 'bottom' if b['bbox'].y0 >= pg['h'] * 0.88 else None
            if zone:
                txt = ' '.join(l['text'] for p in b['paras'] for l in p['lines'])
                keys.add((zone, norm(txt), round(b['bbox'].y0 / 4)))
        for k in keys:
            seen[k] += 1
    need = max(2, int(len(pages) * 0.6 + 0.5))
    for pg in pages:
        keep = []
        for b in pg['blocks']:
            zone = 'top' if b['bbox'].y1 <= pg['h'] * 0.12 else 'bottom' if b['bbox'].y0 >= pg['h'] * 0.88 else None
            if zone:
                txt = ' '.join(l['text'] for p in b['paras'] for l in p['lines'])
                if seen[(zone, norm(txt), round(b['bbox'].y0 / 4))] >= need:
                    b['page_number'] = bool(re.fullmatch(r'(page\s*)?#(\s*(of|/)\s*#)?', norm(txt)))
                    pg['header' if zone == 'top' else 'footer'].append(b)
                    continue
            keep.append(b)
        pg['blocks'] = keep
