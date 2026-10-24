"""PDF -> Word that looks exactly like the PDF and can be edited.

    pdf2docx-python exactdocx_run.py <in.pdf> <out.docx|out.html> <auto|ocr|text> [lang]

  out.html: the same exact copy as a web page (each page an inline SVG: picture + selectable text)

  auto: OCR only the pages that have no text; ocr: OCR every page; text: never OCR (no Tesseract)

Every page becomes one Word page of the same size. The page itself, without its text, is a
picture behind everything (backgrounds, photos, shapes, lines and colours stay exactly where they
were), and every line of text is real, editable Word text in a borderless text box at the same
place, in the same font, size, colour, bold and italics. Nothing is reflowed, so nothing moves.

Where the text comes from:
  - pages with real text: from the PDF itself (exact words, fonts and positions)
  - scanned pages (no text inside), or every page with "ocr": read with Tesseract. Reliably read
    words are painted out of the picture (OpenCV inpainting); words Tesseract was unsure about stay
    in the picture, so nothing goes missing or comes out garbled.
"""
import csv
import io
import os
import re
import subprocess
import sys
from xml.sax.saxutils import escape

import cv2
import numpy as np
import pymupdf as fitz
from docx import Document
from docx.enum.section import WD_SECTION
from docx.oxml import parse_xml
from docx.oxml.ns import qn
from docx.shared import Pt

OCR_DPI = 300   # Tesseract reads small text much better at 300 dpi
BG_DPI = 200    # the background picture in Word
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


def textbox(n, x, y, w, h, runs):
    """A text box at x, y (points from the page corner) with no border, no fill and no inner
    margins, that never wraps its line: it shows only the text, which can be clicked and edited.
    runs: [(text, font, size, bold, italic, (r, g, b), width %)]"""
    xml = ''
    for text, font, size, bold, italic, colour, scale in runs:
        f = escape(font, {'"': '&quot;'})
        sc = f'<w:w w:val="{scale}"/>' if scale != 100 else ''
        xml += (f'<w:r><w:rPr><w:rFonts w:ascii="{f}" w:hAnsi="{f}" w:cs="{f}"/>{"<w:b/>" if bold else ""}{"<w:i/>" if italic else ""}{sc}'
                f'<w:color w:val="{"%02X%02X%02X" % colour}"/><w:sz w:val="{max(2, round(size * 2))}"/><w:szCs w:val="{max(2, round(size * 2))}"/></w:rPr>'
                f'<w:t xml:space="preserve">{escape(text)}</w:t></w:r>')
    cx, cy = max(1, int(w * EMU)), max(1, int(h * EMU))
    return parse_xml(f'''<w:drawing {W_NS}><wp:anchor xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
 distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="{n + 2}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">
 <wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>{int(x * EMU)}</wp:posOffset></wp:positionH>
 <wp:positionV relativeFrom="page"><wp:posOffset>{int(y * EMU)}</wp:posOffset></wp:positionV><wp:extent cx="{cx}" cy="{cy}"/>
 <wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="{n}" name="Text {n}"/><wp:cNvGraphicFramePr/>
 <a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp>
 <wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>
 <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></wps:spPr>
 <wps:txbx><w:txbxContent><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>{xml}</w:p></w:txbxContent></wps:txbx>
 <wps:bodyPr rot="0" vert="horz" wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t" anchorCtr="0"><a:noAutofit/></wps:bodyPr>
 </wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing>''')


# PostScript font names -> the family name Word knows
FONT_ALIASES = {'helvetica': 'Arial', 'arial': 'Arial', 'arialmt': 'Arial', 'times': 'Times New Roman', 'timesroman': 'Times New Roman',
                'timesnewroman': 'Times New Roman', 'timesnewromanps': 'Times New Roman', 'courier': 'Courier New', 'couriernew': 'Courier New',
                'symbol': 'Symbol', 'zapfdingbats': 'Wingdings'}


# fonts every Windows / Office computer has; any other font is shown as Arial stretched or
# squeezed to the exact width the text has in the PDF, so lines keep their length and place
OFFICE_FONTS = {'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia',
                'Corbel', 'Courier New', 'Georgia', 'Impact', 'Lucida Console', 'Palatino Linotype', 'Segoe UI', 'Tahoma',
                'Times New Roman', 'Trebuchet MS', 'Verdana', 'Garamond', 'Century Gothic', 'Book Antiqua', 'Symbol', 'Wingdings'}


# stand-ins for other fonts, by kind: (Word font, PyMuPDF metrics regular/bold, width factor)
STAND_INS = {'sans': ('Arial', 'helv', 'hebo', 1.0), 'serif': ('Times New Roman', 'tiro', 'tibo', 1.0),
             'mono': ('Courier New', 'cour', 'cobo', 1.0), 'script': ('Segoe Script', 'helv', 'hebo', 1.3)}
SCRIPT = re.compile(r'script|vibes|hand|brush|pacifico|dancing|signature|allura|sacramento|parisienne|satisfy|cursive|calligraph|tangerine|alex ?brush|kaushan|lobster', re.I)


SERIF = re.compile(r'times|georgia|garamond|playfair|merriweather|lora|baskerville|bodoni|didot|(?<!sans )serif|roman|cormorant|crimson|'
                   r'cinzel|abril|prata|spectral|cambria|minion|caslon|palatino|book ?antiqua|century schoolbook|charter|libre caslon', re.I)
MONO = re.compile(r'mono|courier|consol|code|menlo', re.I)


def stand_in(font, flags):
    """The kind of a font by its name (the PDF's own serif flag is often wrong, e.g. on Montserrat)."""
    if SCRIPT.search(font):
        return STAND_INS['script']
    if MONO.search(font):
        return STAND_INS['mono']
    if SERIF.search(font):
        return STAND_INS['serif']
    return STAND_INS['sans']


def fit(text, size, bold, width, kind=STAND_INS['sans']):
    """Width scale (%) that makes text in the stand-in font exactly width points wide."""
    natural = fitz.get_text_length(text, fontname=kind[2] if bold else kind[1], fontsize=size) * kind[3]
    return 100 if natural <= 0 or width <= 0 else int(min(300, max(40, round(width / natural * 100))))


def family(name):
    """'ABCDEF+Montserrat-SemiBold' -> 'Montserrat', 'TimesNewRomanPS-BoldMT' -> 'Times New Roman'."""
    name = name.split('+', 1)[-1]
    base = re.split(r'[-,]', name)[0]
    base = re.sub(r'(PSMT|MT|PS)$', '', base)
    key = re.sub(r'[^a-z]', '', base.lower())
    if key in FONT_ALIASES:
        return FONT_ALIASES[key]
    base = re.sub(r'(Bold|Italic|Oblique|Regular|Medium|Light|Black|Semibold|SemiBold)+$', '', base) or base
    return re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', base)


def pdf_lines(page):
    """The page's own text: lines of spans (text, font, size, bold, italic, colour, bbox, origin).
    Rotated lines and text without proper characters are left out (they stay in the picture)."""
    out = []
    for b in page.get_text('dict', flags=fitz.TEXT_PRESERVE_WHITESPACE)['blocks']:
        for ln in b.get('lines', []):
            if abs(ln['dir'][1]) > 0.01 or ln['dir'][0] < 0:
                continue
            spans = []
            for sp in ln['spans']:
                t = sp['text']
                if not t.strip() and not spans:
                    continue
                if t.count('\ufffd') > len(t) / 4:
                    spans = None
                    break
                fl, nm = sp['flags'], sp['font']
                bold = bool(fl & 16) or bool(re.search(r'bold|black|heavy|semibold', nm, re.I))
                italic = bool(fl & 2) or bool(re.search(r'italic|oblique', nm, re.I))
                c = sp['color']
                spans.append((t, family(nm), sp['size'], bold, italic, ((c >> 16) & 255, (c >> 8) & 255, c & 255),
                              fitz.Rect(sp['bbox']), sp['origin'], sp.get('ascender', 0.9), fl, nm))
            if spans:
                while spans and not spans[-1][0].strip():
                    spans.pop()
            if spans:
                out.append(spans)
    return out


def background(doc, n, w, h, rid):
    drawing = parse_xml(f'<w:drawing {W_NS}/>')
    drawing.append(parse_xml(anchor_xml(rid, n + 1, int(w * EMU), int(h * EMU))))
    return drawing


def encode_jpeg(rgb, w, h):
    bw, bh = max(1, round(w * BG_DPI / 72)), max(1, round(h * BG_DPI / 72))
    if rgb.shape[1] != bw:
        rgb = cv2.resize(rgb, (bw, bh), interpolation=cv2.INTER_AREA)
    _, jpg = cv2.imencode('.jpg', cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 88])
    return jpg.tobytes()


def jpeg(doc, rgb, w, h):
    return doc.part.get_or_add_image(io.BytesIO(encode_jpeg(rgb, w, h)))[0]


def css_family(*names):
    out = []
    for nm in names:
        if nm and nm not in out:
            out.append(nm)
    return ', '.join(f"'{nm}'" for nm in out)


def page_fonts(pdf, fonts, pieces, faces):
    """Embed the PDF's own fonts (TrueType/OpenType) in the web page when they can show every
    character used with them; faces: raw font name -> (css name, @font-face rule) for the document."""
    files = {}
    for f in fonts:  # page.get_fonts(full=True), read before the text was removed
        files.setdefault(f[3].split('+', 1)[-1], f[0])
    for pc in pieces:
        raw = pc[10]
        if not raw or raw in faces:
            continue
        faces[raw] = None
        xref = files.get(raw)
        if not xref:
            continue
        try:
            _, ext, _, buf = pdf.extract_font(xref)
            if ext not in ('ttf', 'otf') or not buf:
                continue
            font = fitz.Font(fontbuffer=buf)
            chars = {ch for q in pieces if q[10] == raw for ch in q[3] if not ch.isspace()}
            if not all(font.has_glyph(ord(ch)) for ch in chars):
                continue
        except Exception:
            continue
        import base64
        name = f'pdf-font-{len(faces)}'
        mime = 'font/ttf' if ext == 'ttf' else 'font/otf'
        faces[raw] = (name, f"@font-face{{font-family:'{name}';src:url(data:{mime};base64,{base64.b64encode(buf).decode()})}}")


def svg_page(w, h, jpg, pieces, faces=None):
    """One page as inline SVG: the design picture, and the text on top at its exact baseline and
    width (textLength), so it lines up whatever font the browser uses. The text can be selected."""
    import base64
    parts = [f'<svg class="page" viewBox="0 0 {w:.2f} {h:.2f}" width="{w * 4 / 3:.0f}" height="{h * 4 / 3:.0f}" xmlns="http://www.w3.org/2000/svg">',
             f'<image href="data:image/jpeg;base64,{base64.b64encode(jpg).decode()}" x="0" y="0" width="{w:.2f}" height="{h:.2f}" preserveAspectRatio="none"/>']
    for x, base, width, text, fam, alt, size, bold, italic, colour, raw in pieces:
        face = (faces or {}).get(raw)
        if face:  # the PDF's own font: already bold or italic itself
            fam, bold, italic = face[0], False, False
        generic = 'serif' if alt in ('Times New Roman', 'Georgia', 'Garamond', 'Book Antiqua', 'Palatino Linotype', 'Cambria', 'Constantia') \
            else 'monospace' if alt in ('Courier New', 'Consolas', 'Lucida Console') else 'cursive' if alt == 'Segoe Script' else 'sans-serif'
        attrs = (f'x="{x:.2f}" y="{base:.2f}" font-size="{size:.2f}" fill="#{"%02x%02x%02x" % colour}" '
                 f'font-family="{escape(css_family(fam, alt), {chr(34): "&quot;"})}, {generic}"')
        if bold:
            attrs += ' font-weight="bold"'
        if italic:
            attrs += ' font-style="italic"'
        if width > 0 and len(text) > 1:
            attrs += f' textLength="{width:.2f}" lengthAdjust="spacingAndGlyphs"'
        parts.append(f'<text {attrs}>{escape(text)}</text>')
    parts.append('</svg>')
    return ''.join(parts)


def write_html(dst, title, pages, faces=None):
    html = ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            f'<title>{escape(title)}</title>\n<style>\n'
            'body{margin:0;background:#fff}\n'
            '.page{display:block;margin:0 auto 8px;max-width:100%;height:auto}\n'
            'text{white-space:pre}\n' + ''.join(f[1] + '\n' for f in (faces or {}).values() if f) + '</style>\n</head>\n<body>\n' + '\n'.join(pages) + '\n</body>\n</html>\n')
    with open(dst, 'w', encoding='utf-8') as f:
        f.write(html)


def text_page(pdf, n, page):
    """Background without the text (removed with redactions, nothing else touched) + text boxes."""
    lines = pdf_lines(page)
    # heavy display fonts (Anton, Bebas Neue, ...) are not marked bold in the PDF: measure their strokes
    look = page.get_pixmap(dpi=150, alpha=False, colorspace=fitz.csRGB)
    img = np.frombuffer(look.samples, dtype=np.uint8).reshape(look.height, look.width, 3)
    q = look.width / page.rect.width
    for ln in lines:
        for i, sp in enumerate(ln):
            if sp[3] or sp[1] in OFFICE_FONTS or not sp[0].strip():
                continue
            r = sp[6]
            box = (int(max(0, r.x0 * q)), int(max(0, r.y0 * q)), int(min(look.width, r.x1 * q)), int(min(look.height, r.y1 * q)))
            if box[2] - box[0] > 2 and box[3] - box[1] > 2 and style_of(img, box)[1] / max(1, sp[2] * q) > 0.125:
                ln[i] = sp[:3] + (True,) + sp[4:]
    for ln in lines:
        for sp in ln:
            r = fitz.Rect(sp[6])
            r.y0 += r.height * 0.2  # a little inside, so neighbouring text is not caught
            r.y1 -= r.height * 0.2
            if not r.is_empty:
                page.add_redact_annot(r, fill=False)
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE, text=fitz.PDF_REDACT_TEXT_REMOVE)
    pix = page.get_pixmap(dpi=BG_DPI, alpha=False, colorspace=fitz.csRGB)
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    boxes, pieces = [], []
    for ln in lines:
        for t, f, sz, bo, it, c, bbox, origin, _, fl, raw in ln:
            lead, trail = len(t) - len(t.lstrip()), len(t) - len(t.rstrip())
            if t.strip():
                sp_w = sz * 0.28  # about one space
                pieces.append((bbox.x0 + lead * sp_w, origin[1], max(0, bbox.width - (lead + trail) * sp_w), t.strip(),
                               f, stand_in(f, fl)[0] if f not in OFFICE_FONTS else f, sz, bo, it, c, raw))
    for ln in lines:
        # split the line where spans are far apart (columns, tab stops), so each part keeps its place
        groups, cur = [], [ln[0]]
        for sp in ln[1:]:
            gap = sp[6].x0 - cur[-1][6].x1
            if gap > max(sp[2], cur[-1][2]) * 1.5:
                groups.append(cur)
                cur = [sp]
                continue
            if gap > sp[2] * 0.15 and not cur[-1][0].endswith(' ') and not sp[0].startswith(' '):
                cur[-1] = (cur[-1][0] + ' ',) + cur[-1][1:]  # words placed apart without a space
            cur.append(sp)
        groups.append(cur)
        for g in groups:
            while g and not g[0][0].strip():
                g = g[1:]
            if not g:
                continue
            runs = []
            for k, (t, f, sz, bo, it, c, bbox, _, _, fl, _) in enumerate(g):
                if k == 0:
                    t = t.lstrip()
                if f in OFFICE_FONTS:
                    runs.append((t, f, sz, bo, it, c, 100))
                else:
                    kind = stand_in(f, fl)
                    runs.append((t, kind[0], sz, bo, it, c, fit(t.rstrip(), sz, bo, bbox.width - (sz * 0.28 if t.endswith(' ') else 0), kind)))
            x = g[0][6].x0
            # Word puts the baseline one font ascent below the box top (Arial: 0.905 of the size)
            top = min(sp[7][1] - sp[2] * (min(1.05, max(0.75, sp[8])) if sp[1] in OFFICE_FONTS else 0.905) for sp in g)
            size = max(sp[2] for sp in g)
            boxes.append((x, top, (g[-1][6].x1 - x) * 1.1 + size, size * 1.3, runs))
    return rgb, boxes, pieces


def ocr_page(page, lang, work, n):
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
    k = page.rect.width / pix.width  # picture pixels -> points
    boxes, pieces = [], []
    for s, (colour, bold) in zip(segs, styles):
        text = ' '.join(t[0] for t in s)
        x0, x1 = min(t[1] for t in s), max(t[3] for t in s)
        sizes = sorted(size_of(t)[0] for t in s)
        size = sizes[len(sizes) // 2] * k
        width = (x1 - x0) * k
        size = max(4, round(size * 2) / 2)
        base = max(t[4] - size_of(t)[1] * size_of(t)[0] for t in s) * k
        # Tesseract's box says how wide the text really is
        boxes.append((x0 * k, base - size * 0.905, width * 1.1 + size, size * 1.3, [(text, 'Arial', size, bold, False, colour, fit(text, size, bold, width))]))
        pieces.append((x0 * k, base, width, text, 'Arial', 'Arial', size, bold, False, colour, None))
    return clean, boxes, pieces


def main():
    src, dst, mode = sys.argv[1], sys.argv[2], sys.argv[3]
    lang = sys.argv[4] if len(sys.argv) > 4 else 'eng'
    work = os.path.dirname(os.path.abspath(dst))
    pdf = fitz.open(src)
    if dst.endswith('.html'):
        svgs, faces = [], {}
        for n, page in enumerate(pdf):
            w, h = page.rect.width, page.rect.height
            has_text = len(re.sub(r'\s+', '', page.get_text())) >= 10
            use_ocr = mode == 'ocr' or (mode == 'auto' and not has_text)
            fonts = page.get_fonts(full=True)
            rgb, _, pieces = ocr_page(page, lang, work, n) if use_ocr else text_page(pdf, n, page)
            if not use_ocr:
                page_fonts(pdf, fonts, pieces, faces)
            svgs.append(svg_page(w, h, encode_jpeg(rgb, w, h), pieces, faces))
        write_html(dst, (pdf.metadata or {}).get('title') or 'Document', svgs, faces)
        return
    doc = Document()
    body = doc.element.body
    for p in list(body.iterchildren(qn('w:p'))):  # the blank paragraph a new document starts with
        body.remove(p)
    found = 0
    ids = 1000  # drawing ids; the page pictures use 1, 2, ...
    for n, page in enumerate(pdf):
        w, h = page.rect.width, page.rect.height
        sec = doc.sections[0] if n == 0 else doc.add_section(WD_SECTION.NEW_PAGE)
        sec.page_width, sec.page_height = Pt(w), Pt(h)
        sec.left_margin = sec.right_margin = sec.top_margin = sec.bottom_margin = Pt(0)
        sec.header_distance = sec.footer_distance = Pt(0)
        has_text = len(re.sub(r'\s+', '', page.get_text())) >= 10
        use_ocr = mode == 'ocr' or (mode == 'auto' and not has_text)
        rgb, boxes, _ = ocr_page(page, lang, work, n) if use_ocr else text_page(pdf, n, page)

        # one paragraph per page holds the background picture and every text box, so nothing flows
        par = doc.add_paragraph()
        tight(par)
        par.add_run()._r.append(background(doc, n, w, h, jpeg(doc, rgb, w, h)))
        for x, y, bw, bh, runs in boxes:
            ids += 1
            par.add_run()._r.append(textbox(ids, x, y, bw, bh, runs))
            found += 1
    if not found and mode != 'text':
        sys.exit(4)  # no text at all
    doc.save(dst)


if __name__ == '__main__':
    main()
