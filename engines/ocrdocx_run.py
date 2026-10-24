"""Scanned PDF -> Word that keeps the design and can be edited.

    pdf2docx-python ocrdocx_run.py <in.pdf> <out.docx> [lang]

Each page is rendered as a picture and read with Tesseract, which gives every word with its
position. The words that were read reliably are painted out of the picture (OpenCV inpainting
fills them with the colours around them), so the picture keeps the background, photos, shapes and
colours. In Word that picture sits behind the text of its page, and each line of text is written
back as real, editable text in a frame at the same place, size and colour. Words Tesseract was not
sure about stay in the picture, so nothing goes missing or comes out garbled.
"""
import csv
import io
import os
import subprocess
import sys

import cv2
import numpy as np
import pymupdf as fitz
from docx import Document
from docx.enum.section import WD_SECTION
from docx.oxml import parse_xml
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

OCR_DPI = 300   # Tesseract reads small text much better at 300 dpi
BG_DPI = 170    # the background picture in Word
MIN_CONF = 60   # words below this stay in the picture
EMU = 914400 / 72  # points -> EMU
W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'


def read_words(png, lang):
    """Tesseract TSV -> lines (in reading order) of words (text, x0, y0, x1, y1, good)."""
    out = subprocess.run(['tesseract', png, 'stdout', '-l', lang, '--psm', '3', 'tsv'],
                         capture_output=True, check=True, env={**os.environ, 'OMP_THREAD_LIMIT': '1'}).stdout
    lines = {}
    for r in csv.DictReader(io.StringIO(out.decode('utf-8', 'replace')), delimiter='\t', quoting=csv.QUOTE_NONE):
        text = (r.get('text') or '').strip()
        if r.get('level') != '5' or not text:
            continue
        x, y, w, h = (int(r[k]) for k in ('left', 'top', 'width', 'height'))
        good = float(r.get('conf') or -1) >= MIN_CONF and any(c.isalnum() for c in text) and w >= 2 and h >= 5
        if good and len(text) >= 3:
            # a box whose height and width disagree about the letter size was misread; keep it in the picture
            by_h = size_of((text, x, y, x + w, y + h))[0]
            by_w = w / max(0.1, fitz.get_text_length(text, fontname='helv', fontsize=1))
            good = max(by_h, by_w) / max(1e-6, min(by_h, by_w)) < 1.7
        lines.setdefault((int(r['block_num']), int(r['par_num']), int(r['line_num'])), []).append((text, x, y, x + w, y + h, good))
    return [sorted(ws, key=lambda t: t[1]) for _, ws in sorted(lines.items())]


def segments(words):
    """Runs of reliable words, split where words are far apart (table columns, two columns)."""
    hs = sorted(t[4] - t[2] for t in words)
    gap = max(12, hs[len(hs) // 2] * 1.6)
    segs, cur = [], []
    for t in words:
        if not t[5] or (cur and t[1] - cur[-1][3] > gap):
            if cur:
                segs.append(cur)
            cur = []
        if t[5]:
            cur.append(t)
    if cur:
        segs.append(cur)
    return segs


ASC = set('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789bdfhklt!?%$&#@/()[]{}|')
DESC = set('gjpqy,;()[]{}|@')


def size_of(t):
    """Font size (picture pixels) from a word's ink height: capitals and ascenders reach 0.72 of
    the size above the baseline, lower case 0.52, descenders 0.21 below it."""
    text, _, y0, _, y1 = t[:5]
    top = 0.72 if any(c in ASC for c in text) else 0.52
    bottom = 0.21 if any(c in DESC for c in text) else 0
    return (y1 - y0) / (top + bottom), bottom


def style_of(img, box):
    """(colour, bold) of the text in a box: ink = the pixels farthest from the box's background."""
    x0, y0, x1, y1 = box
    part = img[y0:y1, x0:x1].astype(np.int32)
    if not part.size:
        return (0, 0, 0), False
    # background: a ring just outside the box (the box's own edges touch the letters)
    H, W = img.shape[:2]
    r = 6
    outer = img[max(0, y0 - r):min(H, y1 + r), max(0, x0 - r):min(W, x1 + r)].astype(np.int32)
    ring = np.ones(outer.shape[:2], bool)
    ring[min(r, y0):min(r, y0) + (y1 - y0), min(r, x0):min(r, x0) + (x1 - x0)] = False
    bg = np.median(outer[ring], axis=0) if ring.any() else np.median(part.reshape(-1, 3), axis=0)
    dist = np.abs(part - bg).sum(axis=2)
    ink = part[dist >= max(60, dist.max() * 0.6)]
    colour = tuple(int(v) for v in np.median(ink, axis=0)) if len(ink) else (0, 0, 0)
    # stroke width: twice the typical distance from the middle of a stroke to its edge
    mask = (dist > max(60, dist.max() * 0.5)).astype(np.uint8)
    dt = cv2.distanceTransform(np.pad(mask, 1), cv2.DIST_L2, 3)[1:-1, 1:-1]
    inside = dt[mask > 0]
    stroke = 2 * float(np.percentile(inside, 90)) if inside.size else 0
    return colour, stroke


def anchor_xml(rid, n, cx, cy):
    return f'''<wp:anchor xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="1" locked="1" layoutInCell="1" allowOverlap="1">
 <wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>
 <wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="{cx}" cy="{cy}"/>
 <wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="{n}" name="Page {n}"/><wp:cNvGraphicFramePr/>
 <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>
 <pic:nvPicPr><pic:cNvPr id="{n}" name="page{n}.jpg"/><pic:cNvPicPr/></pic:nvPicPr>
 <pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
 <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
 </pic:pic></a:graphicData></a:graphic></wp:anchor>'''


def tight(par):
    f = par.paragraph_format
    f.space_before = f.space_after = Pt(0)
    f.line_spacing = 1.0


def frame(par, x, y, w):
    """Place a paragraph at x, y (points from the page corner) in a frame w points wide."""
    par._p.get_or_add_pPr().insert(0, parse_xml(
        f'<w:framePr {W_NS} w:w="{int(w * 20)}" w:hRule="auto" w:wrap="through" w:hAnchor="page" '
        f'w:vAnchor="page" w:x="{int(x * 20)}" w:y="{int(y * 20)}"/>'))
    tight(par)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    lang = sys.argv[3] if len(sys.argv) > 3 else 'eng'
    work = os.path.dirname(os.path.abspath(dst))
    pdf = fitz.open(src)
    doc = Document()
    body = doc.element.body
    for p in list(body.iterchildren(qn('w:p'))):  # the blank paragraph a new document starts with
        body.remove(p)
    found = 0
    for n, page in enumerate(pdf):
        w, h = page.rect.width, page.rect.height
        sec = doc.sections[0] if n == 0 else doc.add_section(WD_SECTION.NEW_PAGE)
        sec.page_width, sec.page_height = Pt(w), Pt(h)
        sec.left_margin = sec.right_margin = sec.top_margin = sec.bottom_margin = Pt(0)
        sec.header_distance = sec.footer_distance = Pt(0)

        pix = page.get_pixmap(dpi=OCR_DPI, alpha=False, colorspace=fitz.csRGB)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).copy()
        png = os.path.join(work, f'ocr-{n}.png')
        cv2.imwrite(png, cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
        lines = read_words(png, lang)
        os.remove(png)

        segs = [s for ln in lines for s in segments(ln)]
        styles = [style_of(img, (min(t[1] for t in s), min(t[2] for t in s), max(t[3] for t in s), max(t[4] for t in s))) for s in segs]
        # bold: strokes thicker than about 1/8 of the font size (regular text is near 1/11)
        styles = [(c, sw / max(1, sorted(size_of(t)[0] for t in sg)[len(sg) // 2]) > 0.125) for sg, (c, sw) in zip(segs, styles)]
        mask = np.zeros(img.shape[:2], np.uint8)
        pad = 4
        for s in segs:
            for t in s:
                mask[max(0, t[2] - pad):t[4] + pad, max(0, t[1] - pad):t[3] + pad] = 255
        clean = cv2.inpaint(img, mask, 5, cv2.INPAINT_TELEA) if segs else img
        bw, bh = max(1, round(w * BG_DPI / 72)), max(1, round(h * BG_DPI / 72))
        _, jpg = cv2.imencode('.jpg', cv2.cvtColor(cv2.resize(clean, (bw, bh), interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2BGR),
                              [cv2.IMWRITE_JPEG_QUALITY, 85])
        rid, _ = doc.part.get_or_add_image(io.BytesIO(jpg.tobytes()))

        # the page's first paragraph holds the background picture
        first = doc.add_paragraph()
        tight(first)
        drawing = parse_xml(f'<w:drawing {W_NS}/>')
        drawing.append(parse_xml(anchor_xml(rid, n + 1, int(w * EMU), int(h * EMU))))
        first.add_run()._r.append(drawing)

        k = w / pix.width  # picture pixels -> points
        # a frame may be wider than its text (Word's fonts differ a little), but never reach the
        # next piece of text on the same line
        limits = []
        for s in segs:
            y0, y1 = min(t[2] for t in s), max(t[4] for t in s)
            nxt = [o[0][1] for o in segs if o is not s and o[0][1] > s[-1][3] and min(t[4] for t in o) > y0 and max(t[2] for t in o) < y1]
            limits.append((min(nxt) if nxt else pix.width) * k)
        for s, (colour, bold), limit in zip(segs, styles, limits):
            text = ' '.join(t[0] for t in s)
            x0, x1 = min(t[1] for t in s), max(t[3] for t in s)
            sizes = sorted(size_of(t)[0] for t in s)
            size = sizes[len(sizes) // 2] * k
            width = (x1 - x0) * k
            natural = fitz.get_text_length(text, fontname='hebo' if bold else 'helv', fontsize=size)
            if natural > 0:  # Tesseract's box says how wide the text really is
                size = min(max(size * width / natural, size * 0.8), size * 1.15)
            size = max(4, round(size * 2) / 2)
            base = max(t[4] - size_of(t)[1] * size_of(t)[0] for t in s) * k
            par = doc.add_paragraph()
            frame(par, x0 * k, base - size * 0.905, max(width * 1.04 + 1, min(limit - 1 - x0 * k, width * 1.3 + 2 * size)))
            r = par.add_run(text)
            r.font.name = 'Arial'
            r._r.get_or_add_rPr().get_or_add_rFonts().set(qn('w:hAnsi'), 'Arial')
            r.font.size = Pt(size)
            r.font.bold = bold
            r.font.color.rgb = RGBColor(*colour)
            found += 1
    if not found:
        sys.exit(4)  # no text at all
    doc.save(dst)


if __name__ == '__main__':
    main()
