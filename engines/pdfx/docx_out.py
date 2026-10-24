"""Document model -> an editable Word document that looks like the PDF.

Each PDF page is a Word section of the same size and orientation. On it, positioned as in the
PDF:
  - vector drawings as Word shapes (backgrounds, boxes, lines) and pictures as Word pictures
  - tables as real Word tables (floating at their place) with cell colours and borders
  - text in borderless text boxes holding real paragraphs: fonts, sizes, colours, bold,
    italics, alignment, indents, line spacing, spacing between paragraphs, bullets/numbering
    as Word lists, and links
  - the repeated header/footer in Word's header/footer, page numbers as page-number fields
The PDF's own fonts are embedded in the file when they are TrueType; other fonts are replaced
by a common font stretched to the width the text has in the PDF.

Paragraph text flows (wraps by itself when edited) whenever Word would break the lines exactly
where the PDF does; otherwise each PDF line ends with a line break so nothing moves.
"""
import copy
import io
import re
import uuid
from xml.sax.saxutils import escape

from docx import Document
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.opc.packuri import PackURI
from docx.opc.part import Part
from docx.oxml import parse_xml
from docx.oxml.ns import qn
from docx.shared import Pt

import pymupdf as fitz

from fonts import FontInfo, STAND_INS

EMU = 12700  # per point
NS = ('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
      'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" '
      'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" '
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
      'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"')
# Word 2010+ shapes and text boxes are written the way Word writes them: inside mc:AlternateContent
WPS_OPEN = '<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing>'
WPS_CLOSE = '</w:drawing></mc:Choice></mc:AlternateContent></w:r>'
# where Word puts the first baseline in a line of exact height L: L * 0.8 (measured; the same
# rule LibreOffice uses), so text tops are placed from the baseline the PDF gives
BASELINE_IN_LINE = 0.8


def e(v):
    return int(round(v * EMU))


def tw(v):
    return int(round(v * 20))


def hexc(c):
    return '%02X%02X%02X' % tuple(c) if c else '000000'


def rgbt(c):
    from model import rgb
    return rgb(c)


class Writer:
    def __init__(self, pages, fonts, meta):
        self.pages, self.fonts, self.meta = pages, fonts, meta
        self.doc = Document()
        body = self.doc.element.body
        for p in list(body.iterchildren(qn('w:p'))):
            body.remove(p)
        self.ids = 1
        self.embedded = {}       # raw font -> Word font name (embedded)
        self.bullet_abs = {}     # (bullet char, font) -> abstractNum id
        self.next_abs = 100
        self.next_num = 100
        self.rels = {}
        self.flowed = False

    # ---------------------------------------------------------------------------------- fonts --
    def word_font(self, run):
        """(Word font name, exact metrics?, bold/italic must be set on the run)."""
        fi = self.fonts.get(run['font']) or FontInfo(run['font'])
        name, exact = fi.word_font()
        if fi.data and fi.truetype:
            self.embedded[fi.raw] = name
            return name, True, False
        return name, exact, True

    def embed_fonts(self):
        if not self.embedded:
            return
        part = next(r.target_part for r in self.doc.part.rels.values() if r.reltype == RT.FONT_TABLE)
        root = parse_xml(part.blob)
        for i, (raw, name) in enumerate(self.embedded.items(), 1):
            data = bytearray(self.fonts[raw].data)
            guid = uuid.uuid4()
            key = bytes.fromhex(guid.hex)[::-1]
            for k in range(min(32, len(data))):
                data[k] ^= key[k % 16]
            fpart = Part(PackURI(f'/word/fonts/font{i}.odttf'), 'application/vnd.openxmlformats-officedocument.obfuscatedFont',
                         bytes(data), self.doc.part.package)
            rid = part.relate_to(fpart, RT.FONT)
            root.append(parse_xml(
                f'<w:font {NS} w:name="{escape(name, {chr(34): "&quot;"})}"><w:charset w:val="00"/><w:family w:val="auto"/>'
                f'<w:pitch w:val="variable"/><w:embedRegular r:id="{rid}" w:fontKey="{{{str(guid).upper()}}}"/></w:font>'))
        from lxml import etree
        part._blob = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
        st = self.doc.settings.element
        flag = parse_xml(f'<w:embedTrueTypeFonts {NS}/>')
        zoom = st.find(qn('w:zoom'))
        if zoom is not None:
            zoom.addnext(flag)
        else:
            st.insert(0, flag)

    # ----------------------------------------------------------------------------------- text --
    def width(self, run, text=None):
        fi = self.fonts.get(run['font']) or FontInfo(run['font'])
        return fi.width(run['text'] if text is None else text, run['size'], run.get('bold'))

    def run_xml(self, run, text=None, scale=None):
        text = run['text'] if text is None else text
        name, exact, set_style = self.word_font(run)
        f = escape(name, {'"': '&quot;'})
        props = [f'<w:rFonts w:ascii="{f}" w:hAnsi="{f}" w:cs="{f}" w:eastAsia="{f}"/>']
        if set_style and run.get('bold'):
            props.append('<w:b/><w:bCs/>')
        if set_style and run.get('italic'):
            props.append('<w:i/><w:iCs/>')
        props.append(f'<w:color w:val="{hexc(run.get("color"))}"/>')
        if scale and scale != 100:
            props.append(f'<w:w w:val="{scale}"/>')
        sz = max(2, int(round(run['size'] * 2)))
        props.append(f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>')
        rpr = f'<w:rPr>{"".join(props)}</w:rPr>'
        parts = re.split('\u2063(PAGE|NUMPAGES)\u2063', text)
        xml = ''
        for i, part in enumerate(parts):
            if i % 2:
                xml += (f'<w:r>{rpr}<w:fldChar w:fldCharType="begin"/></w:r><w:r>{rpr}<w:instrText xml:space="preserve"> {part} </w:instrText></w:r>'
                        f'<w:r>{rpr}<w:fldChar w:fldCharType="separate"/></w:r><w:r>{rpr}<w:t>1</w:t></w:r><w:r>{rpr}<w:fldChar w:fldCharType="end"/></w:r>')
            elif part:
                xml += f'<w:r>{rpr}<w:t xml:space="preserve">{escape(part)}</w:t></w:r>'
        if run.get('link') and not run['link'].startswith('#'):
            key = run['link']
            if key not in self.rels:
                self.rels[key] = self.doc.part.relate_to(key, RT.HYPERLINK, is_external=True)
            xml = f'<w:hyperlink r:id="{self.rels[key]}">{xml}</w:hyperlink>'
        return xml

    def exact_line(self, ln):
        # OCR lines are measured from the scan, not from a font: never exact
        return not ln.get('ocr') and all(self.word_font(r)[1] for r in ln['runs'])

    def line_runs_xml(self, ln, strip_first=None):
        approx = bool(ln.get('ocr'))
        """Runs of one line; fonts that are not exact are stretched to the PDF width."""
        out = []
        runs = ln['runs']
        for i, r in enumerate(runs):
            text = r['text']
            if i == 0 and strip_first is not None:
                text = strip_first
            if i == len(runs) - 1:
                text = text.rstrip()
            if not text:
                continue
            scale = None
            if (approx or not self.word_font(r)[1]) and text.strip():
                want = r['bbox'].width
                if text.endswith(' ') or text.startswith(' '):
                    want -= r['size'] * 0.28 * (len(text) - len(text.strip()))
                have = self.width(r, text.strip())
                if have > 0 and want > 0:
                    scale = int(min(300, max(40, round(want / have * 100))))
            out.append(self.run_xml(r, text, scale))
        return ''.join(out)

    @staticmethod
    def line_height(p):
        if len(p['lines']) >= 2 and p.get('step'):
            return p['step']
        return p['size'] * 1.2

    def can_flow(self, p, box_w):
        """True when Word, given box_w, would break this paragraph's lines where the PDF does."""
        ls = p['lines']
        if len(ls) < 2:
            return True
        if not all(self.exact_line(l) for l in ls):
            return False
        for i, l in enumerate(ls):
            if l['text'].rstrip().endswith('-'):
                return False
            w = sum(self.width(r) for r in l['runs'])
            w_trim = w - self.width(l['runs'][-1], l['runs'][-1]['text']) + self.width(l['runs'][-1], l['runs'][-1]['text'].rstrip())
            if w_trim > box_w + 0.5:
                return False
            if i + 1 < len(ls):
                nxt = ls[i + 1]['runs'][0]
                word = nxt['text'].strip().split(' ')[0]
                if w_trim + self.width(nxt, ' ' + word) <= box_w - 0.5:
                    return False
        return True

    def para_xml(self, p, box_x, box_w, before, numbering=None, jc_override=None):
        """One Word paragraph for a PDF paragraph, placed in a box starting at box_x."""
        ls = p['lines']
        L = self.line_height(p)
        first = ls[0]
        left = min(l['bbox'].x0 for l in ls[1:]) if len(ls) > 1 else first['bbox'].x0
        ind = []
        text_x = first['bbox'].x0
        strip = None
        if numbering:
            text_x, strip = numbering['text_x'], numbering['text']
            ind.append(f'<w:ind w:left="{tw(text_x - box_x)}" w:hanging="{tw(text_x - numbering["bullet_x"])}"/>')
        else:
            first_ind = first['bbox'].x0 - left
            if abs(first_ind) > 0.8 and len(ls) > 1:
                ind.append(f'<w:ind w:left="{tw(left - box_x)}" w:{"firstLine" if first_ind > 0 else "hanging"}="{tw(abs(first_ind))}"/>')
            elif abs(left - box_x) > 0.3 and p['align'] in ('left', 'justify'):
                ind.append(f'<w:ind w:left="{tw(left - box_x)}"/>')
        align = jc_override or p['align']
        flow = self.can_flow(p, box_w - max(0, left - box_x)) and align in ('left', 'justify')
        self.flowed = self.flowed or (flow and len(ls) > 1)
        jc = {'left': 'left', 'justify': 'both', 'center': 'center', 'right': 'right'}[align]
        if not flow and jc == 'both':
            jc = 'left'
        ppr = [f'<w:spacing w:before="{tw(max(0, before))}" w:after="0" w:line="{tw(L)}" w:lineRule="exact"/>'] + ind + [f'<w:jc w:val="{jc}"/>']
        if numbering:
            ppr.insert(0, f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{numbering["num"]}"/></w:numPr>')
        ppr.insert(0, '<w:widowControl w:val="0"/><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/>')
        body = []
        for i, l in enumerate(ls):
            if i:
                body.append('<w:r><w:t xml:space="preserve"> </w:t></w:r>' if flow else '<w:r><w:br/></w:r>')
            body.append(self.line_runs_xml(l, strip if i == 0 else None))
        return f'<w:p><w:pPr>{"".join(ppr)}</w:pPr>{"".join(body)}</w:p>'

    def list_numbering(self, p):
        """Word numbering for a list item: the bullet (or number) becomes the list label."""
        first = p['lines'][0]
        runs = first['runs']
        t0 = runs[0]['text']
        m = re.match(r'^(\s*)(\S+)(\s*)(.*)$', t0, re.S)
        if not m:
            return None
        label, rest = m.group(2), m.group(4)
        bullet_x = runs[0]['bbox'].x0
        if rest:
            # where the text starts: measured back from the run's right edge (the gap after a
            # bullet is often wider than its spaces)
            text_x = runs[0]['bbox'].x1 - self.width(runs[0], rest.rstrip()) if len(runs) == 1 or not rest.endswith(' ') else \
                runs[0]['bbox'].x1 - self.width(runs[0], rest)
        elif len(runs) > 1:
            text_x = runs[1]['bbox'].x0
            rest = None
        else:
            return None
        font = self.word_font(runs[0])[0]
        np_ = self.doc.part.numbering_part.element
        mnum = re.match(r'^\(?(\d+)([.)])$', label)
        if mnum:
            aid = self.next_abs
            self.next_abs += 1
            lvl = (f'<w:lvl w:ilvl="0"><w:start w:val="{int(mnum.group(1))}"/><w:numFmt w:val="decimal"/>'
                   f'<w:lvlText w:val="{"(" if label.startswith("(") else ""}%1{mnum.group(2)}"/><w:lvlJc w:val="left"/>'
                   f'<w:rPr><w:rFonts w:ascii="{escape(font)}" w:hAnsi="{escape(font)}"/><w:color w:val="{hexc(runs[0].get("color"))}"/>'
                   f'<w:sz w:val="{int(round(runs[0]["size"] * 2))}"/></w:rPr></w:lvl>')
        else:
            key = (label, font)
            aid = self.bullet_abs.get(key)
            lvl = None
            if aid is None:
                aid = self.next_abs
                self.next_abs += 1
                self.bullet_abs[key] = aid
                lvl = (f'<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="{escape(label, {chr(34): "&quot;"})}"/>'
                       f'<w:lvlJc w:val="left"/><w:rPr><w:rFonts w:ascii="{escape(font)}" w:hAnsi="{escape(font)}"/>'
                       f'<w:color w:val="{hexc(runs[0].get("color"))}"/><w:sz w:val="{int(round(runs[0]["size"] * 2))}"/></w:rPr></w:lvl>')
        if lvl:
            absn = parse_xml(f'<w:abstractNum {NS} w:abstractNumId="{aid}"><w:multiLevelType w:val="singleLevel"/>{lvl}</w:abstractNum>')
            firstnum = np_.find(qn('w:num'))
            if firstnum is not None:
                firstnum.addprevious(absn)
            else:
                np_.append(absn)
        num = self.next_num
        self.next_num += 1
        np_.append(parse_xml(f'<w:num {NS} w:numId="{num}"><w:abstractNumId w:val="{aid}"/></w:num>'))
        return {'num': num, 'bullet_x': bullet_x, 'text_x': text_x, 'text': rest}

    def paras_box(self, paras, jc=None):
        """Paragraphs that share a left edge -> XML of the paragraphs and the box (x, y, w, h)."""
        x = min(min(l['bbox'].x0 for l in p['lines']) for p in paras)
        x1 = max(max(l['bbox'].x1 for l in p['lines']) for p in paras)
        w = x1 - x
        xml, y_top, prev_bottom = [], None, None
        self.flowed = False
        for p in paras:
            L = self.line_height(p)
            top = p['lines'][0]['baseline'] - L * BASELINE_IN_LINE
            before = 0 if prev_bottom is None else top - prev_bottom
            if y_top is None:
                y_top = top
            numbering = self.list_numbering(p) if p['kind'] == 'li' else None
            xml.append(self.para_xml(p, x, w + 1, before, numbering, jc))
            prev_bottom = top + L * len(p['lines'])
        h = (prev_bottom or y_top) - y_top
        return ''.join(xml), (x, y_top, w + 1.5, max(h, 1))

    def regular(self, p):
        """A paragraph Word can show as one paragraph: lines share a left edge (first line may be
        indented), or are centred / right-aligned together."""
        ls = p['lines']
        if any(abs(l.get('angle', 0)) >= 1 for l in ls):
            return False
        if len(ls) == 1 or p['align'] in ('center', 'right'):
            return True
        lefts = [l['bbox'].x0 for l in ls[1:]]
        return max(lefts) - min(lefts) <= max(1.5, p['size'] * 0.2) and ls[0]['bbox'].x0 >= min(lefts) - p['size'] * 3

    def text_boxes(self, blocks):
        """XML of the anchored text boxes for these blocks."""
        out = []
        for b in blocks:
            paras = b['paras']
            group = []

            def flush():
                if not group:
                    return
                if len(group) == 1 and group[0]['align'] in ('center', 'right') and len(group[0]['lines']) == 1:
                    p = group[0]
                    xml, (x, y, w, h) = self.paras_box(group, 'left')
                else:
                    xml, (x, y, w, h) = self.paras_box(group)
                out.append(self.textbox(x, y, w, h, xml, wrap=self.flowed))
                group.clear()

            for p in paras:
                if not self.regular(p):
                    flush()
                    for l in p['lines']:
                        if abs(l.get('angle', 0)) >= 1:
                            out.append(self.rotated_line(l))
                        else:
                            q = dict(p, lines=[l], align='left', kind='p')
                            xml, (x, y, w, h) = self.paras_box([q])
                            out.append(self.textbox(x, y, w, h, xml, wrap=False))
                    continue
                if group:
                    gl = min(l['bbox'].x0 for l in group[-1]['lines'])
                    pl = min(l['bbox'].x0 for l in p['lines'])
                    if p['align'] in ('center', 'right') or group[-1]['align'] in ('center', 'right') or abs(gl - pl) > max(2, p['size'] * 0.3) and p['kind'] != 'li' and group[-1]['kind'] != 'li':
                        flush()
                group.append(p)
            flush()
        return ''.join(out)

    def rotated_line(self, l):
        q = {'lines': [l], 'align': 'left', 'kind': 'p', 'size': l['size'], 'step': None}
        L = l['size'] * 1.2
        xml = self.para_xml(q, l['origin'][0], 2000, 0)
        w = sum(self.width(r) for r in l['runs']) + 2
        import math
        ox, oy = l['origin']
        if abs(abs(l['angle']) - 90) < 1:
            # vertical text: an upright box whose text runs bottom-to-top (vert270) or top-to-bottom (vert)
            up = l['angle'] < 0
            bx = ox - L * BASELINE_IN_LINE if up else ox - L * (1 - BASELINE_IN_LINE)
            by = oy - w if up else oy
            return self.textbox(bx, by, L, w, xml, wrap=False, vert='vert270' if up else 'vert')
        # any other angle: the box is turned around its centre so its left baseline lands on the origin
        a = math.radians(l['angle'])
        ox, oy = l['origin']
        top_off = L * BASELINE_IN_LINE
        cx_local, cy_local = w / 2, L / 2
        # vector from box centre to the baseline origin in box coordinates
        vx, vy = 0 - cx_local, top_off - cy_local
        rx = vx * math.cos(a) - vy * math.sin(a)
        ry = vx * math.sin(a) + vy * math.cos(a)
        cx, cy = ox - rx, oy - ry
        return self.textbox(cx - w / 2, cy - L / 2, w, L, xml, rot=l['angle'], wrap=False)

    def textbox(self, x, y, w, h, inner, rot=0, wrap=True, vert='horz'):
        n = self.ids
        self.ids += 1
        rot_attr = f' rot="{int(round(rot * 60000))}"' if rot else ''
        return (WPS_OPEN + f'<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="{200000 + n}" '
                f'behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/>'
                f'<wp:positionH relativeFrom="page"><wp:posOffset>{e(x)}</wp:posOffset></wp:positionH>'
                f'<wp:positionV relativeFrom="page"><wp:posOffset>{e(y)}</wp:posOffset></wp:positionV>'
                f'<wp:extent cx="{max(1, e(w))}" cy="{max(1, e(h))}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>'
                f'<wp:docPr id="{n}" name="Text {n}"/><wp:cNvGraphicFramePr/><a:graphic>'
                f'<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr txBox="1"/>'
                f'<wps:spPr><a:xfrm{rot_attr}><a:off x="0" y="0"/><a:ext cx="{max(1, e(w))}" cy="{max(1, e(h))}"/></a:xfrm>'
                f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></wps:spPr>'
                f'<wps:txbx><w:txbxContent>{inner}</w:txbxContent></wps:txbx>'
                f'<wps:bodyPr rot="0" vert="{vert}" wrap="{"square" if wrap else "none"}" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t" anchorCtr="0"><a:noAutofit/></wps:bodyPr>'
                f'</wps:wsp></a:graphicData></a:graphic></wp:anchor>' + WPS_CLOSE)

    # ------------------------------------------------------------------------- shapes / pictures --
    def picture(self, data, x, y, w, h, behind=True, z=0, name='Picture'):
        rid, _ = self.doc.part.get_or_add_image(io.BytesIO(data))
        n = self.ids
        self.ids += 1
        return (f'<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="{z}" '
                f'behindDoc="{1 if behind else 0}" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/>'
                f'<wp:positionH relativeFrom="page"><wp:posOffset>{e(x)}</wp:posOffset></wp:positionH>'
                f'<wp:positionV relativeFrom="page"><wp:posOffset>{e(y)}</wp:posOffset></wp:positionV>'
                f'<wp:extent cx="{max(1, e(w))}" cy="{max(1, e(h))}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>'
                f'<wp:docPr id="{n}" name="{name} {n}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
                f'<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'
                f'<pic:nvPicPr><pic:cNvPr id="{n}" name="{name} {n}"/><pic:cNvPicPr/></pic:nvPicPr>'
                f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
                f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{max(1, e(w))}" cy="{max(1, e(h))}"/></a:xfrm>'
                f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>')

    def shape(self, d, z):
        """A vector drawing as a Word shape with its own outline (custom geometry)."""
        r = fitz.Rect(d['rect'])
        sw = d.get('width') or 0
        stroke = d.get('color') is not None and 's' in (d.get('type') or 's')
        pad = sw / 2 if stroke else 0
        x0, y0 = r.x0 - pad, r.y0 - pad
        w, h = max(0.01, r.width + 2 * pad), max(0.01, r.height + 2 * pad)
        P = lambda p: f'<a:pt x="{e(p.x - x0)}" y="{e(p.y - y0)}"/>'
        cmds, cur = [], None
        for it in d['items']:
            op = it[0]
            if op == 'l':
                a, b = it[1], it[2]
                if cur is None or abs(cur.x - a.x) > 0.01 or abs(cur.y - a.y) > 0.01:
                    cmds.append(f'<a:moveTo>{P(a)}</a:moveTo>')
                cmds.append(f'<a:lnTo>{P(b)}</a:lnTo>')
                cur = b
            elif op == 'c':
                a, c1, c2, b = it[1:5]
                if cur is None or abs(cur.x - a.x) > 0.01 or abs(cur.y - a.y) > 0.01:
                    cmds.append(f'<a:moveTo>{P(a)}</a:moveTo>')
                cmds.append(f'<a:cubicBezTo>{P(c1)}{P(c2)}{P(b)}</a:cubicBezTo>')
                cur = b
            elif op in ('re', 'qu'):
                q = it[1].quad if op == 're' else it[1]
                cmds.append(f'<a:moveTo>{P(q.ul)}</a:moveTo><a:lnTo>{P(q.ur)}</a:lnTo><a:lnTo>{P(q.lr)}</a:lnTo><a:lnTo>{P(q.ll)}</a:lnTo><a:close/>')
                cur = None
        if d.get('closePath') and cmds and not cmds[-1].endswith('<a:close/>'):
            cmds.append('<a:close/>')
        if not cmds:
            return ''
        fill = d.get('fill')
        if fill is not None:
            op = d.get('fill_opacity')
            alpha = f'<a:alpha val="{int(op * 100000)}"/>' if op is not None and op < 1 else ''
            fill_xml = f'<a:solidFill><a:srgbClr val="{hexc(rgbt(fill))}">{alpha}</a:srgbClr></a:solidFill>'
        else:
            fill_xml = '<a:noFill/>'
        if stroke:
            op = d.get('stroke_opacity')
            alpha = f'<a:alpha val="{int(op * 100000)}"/>' if op is not None and op < 1 else ''
            dash = ''
            m = re.match(r'\[\s*([\d.\s]+)\]', d.get('dashes') or '')
            if m and m.group(1).strip():
                vals = [float(v) for v in m.group(1).split()]
                if len(vals) == 1:
                    vals *= 2
                ds = ''.join(f'<a:ds d="{int(vals[i] / max(sw, 0.1) * 100000)}" sp="{int(vals[i + 1] / max(sw, 0.1) * 100000)}"/>' for i in range(0, len(vals) - 1, 2))
                dash = f'<a:custDash>{ds}</a:custDash>'
            cap = {1: 'rnd', 2: 'sq'}.get(int((d.get('lineCap') or (0,))[0] or 0), 'flat')
            ln = f'<a:ln w="{max(1, e(sw or 1))}" cap="{cap}"><a:solidFill><a:srgbClr val="{hexc(rgbt(d["color"]))}">{alpha}</a:srgbClr></a:solidFill>{dash}</a:ln>'
        else:
            ln = '<a:ln><a:noFill/></a:ln>'
        n = self.ids
        self.ids += 1
        return (WPS_OPEN + f'<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="{z}" '
                f'behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/>'
                f'<wp:positionH relativeFrom="page"><wp:posOffset>{e(x0)}</wp:posOffset></wp:positionH>'
                f'<wp:positionV relativeFrom="page"><wp:posOffset>{e(y0)}</wp:posOffset></wp:positionV>'
                f'<wp:extent cx="{max(1, e(w))}" cy="{max(1, e(h))}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>'
                f'<wp:docPr id="{n}" name="Shape {n}"/><wp:cNvGraphicFramePr/><a:graphic>'
                f'<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr/>'
                f'<wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{max(1, e(w))}" cy="{max(1, e(h))}"/></a:xfrm>'
                f'<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/>'
                f'<a:pathLst><a:path w="{max(1, e(w))}" h="{max(1, e(h))}"{" fill=" + chr(34) + "none" + chr(34) if fill is None else ""}>{"".join(cmds)}</a:path></a:pathLst></a:custGeom>'
                f'{fill_xml}{ln}</wps:spPr><wps:bodyPr/></wps:wsp></a:graphicData></a:graphic></wp:anchor>' + WPS_CLOSE)

    # ---------------------------------------------------------------------------------- tables --
    def table_xml(self, t):
        xs, ys = t['xs'], t['ys']
        by_start = {(c['row'], c['col']): c for c in t['cells']}
        cover = {}
        for c in t['cells']:
            for r in range(c['row'], c['row'] + c['rowspan']):
                for k in range(c['col'], c['col'] + c['colspan']):
                    cover[(r, k)] = c
        grid = ''.join(f'<w:gridCol w:w="{tw(xs[i + 1] - xs[i])}"/>' for i in range(len(xs) - 1))
        rows = []
        for r in range(len(ys) - 1):
            cells = []
            k = 0
            while k < len(xs) - 1:
                c = cover.get((r, k))
                if c is None:
                    cells.append(f'<w:tc><w:tcPr><w:tcW w:w="{tw(xs[k + 1] - xs[k])}" w:type="dxa"/></w:tcPr><w:p/></w:tc>')
                    k += 1
                    continue
                span = c['colspan']
                width = xs[k + span] - xs[k]
                pr = [f'<w:tcW w:w="{tw(width)}" w:type="dxa"/>']
                if span > 1:
                    pr.append(f'<w:gridSpan w:val="{span}"/>')
                if c['rowspan'] > 1:
                    pr.append('<w:vMerge w:val="restart"/>' if c['row'] == r else '<w:vMerge/>')
                b = []
                for side in ('top', 'left', 'bottom', 'right'):
                    if side in c['borders']:
                        wdt, col = c['borders'][side]
                        b.append(f'<w:{side} w:val="single" w:sz="{max(2, int(round(wdt * 8)))}" w:space="0" w:color="{hexc(col)}"/>')
                    else:
                        b.append(f'<w:{side} w:val="nil"/>')
                pr.append(f'<w:tcBorders>{"".join(b)}</w:tcBorders>')
                if c['fill']:
                    pr.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{hexc(c["fill"])}"/>')
                pr.append('<w:vAlign w:val="top"/>')
                if c['row'] == r and c.get('paras'):
                    content = self.cell_paras(c)
                else:
                    content = '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>'
                cells.append(f'<w:tc><w:tcPr>{"".join(pr)}</w:tcPr>{content}</w:tc>')
                k += span
            rows.append(f'<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="{tw(ys[r + 1] - ys[r])}" w:hRule="exact"/></w:trPr>{"".join(cells)}</w:tr>')
        tblpr = (f'<w:tblPr><w:tblpPr w:leftFromText="0" w:rightFromText="0" w:topFromText="0" w:bottomFromText="0" '
                 f'w:horzAnchor="page" w:vertAnchor="page" w:tblpX="{tw(xs[0])}" w:tblpY="{tw(ys[0])}"/>'
                 f'<w:tblOverlap w:val="overlap"/><w:tblW w:w="{tw(xs[-1] - xs[0])}" w:type="dxa"/>'
                 f'<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
                 f'<w:tblLayout w:type="fixed"/>'
                 f'<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>'
                 f'<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>')
        return f'<w:tbl {NS}>{tblpr}<w:tblGrid>{grid}</w:tblGrid>{"".join(rows)}</w:tbl>'

    def cell_paras(self, c):
        cb = c['bbox']
        out = []
        prev_bottom = cb.y0
        for p in c['paras']:
            L = self.line_height(p)
            top = p['lines'][0]['baseline'] - L * BASELINE_IN_LINE
            before = top - prev_bottom
            mid = (p['bbox'].x0 + p['bbox'].x1) / 2
            if abs(mid - (cb.x0 + cb.x1) / 2) <= 2 and p['bbox'].x0 - cb.x0 > 4:
                jc = 'center'
            elif cb.x1 - p['bbox'].x1 < p['bbox'].x0 - cb.x0 and cb.x1 - p['bbox'].x1 <= 12:
                jc = 'right'
            else:
                jc = None
            if jc:
                xml = self.para_xml(dict(p, align=jc), cb.x0, cb.width, before, jc_override=jc)
                if jc == 'right':
                    xml = xml.replace('<w:jc w:val="right"/>', f'<w:ind w:right="{tw(max(0, cb.x1 - p["bbox"].x1))}"/><w:jc w:val="right"/>', 1)
            else:
                xml = self.para_xml(p, cb.x0, cb.width, before)
            out.append(xml)
            prev_bottom = top + L * len(p['lines'])
        return ''.join(out) or '<w:p/>'

    # ----------------------------------------------------------------------------- page/sections --
    def page(self, pg, idx):
        doc = self.doc
        sec = doc.sections[0] if idx == 0 else doc.add_section(WD_SECTION.NEW_PAGE)
        sec.orientation = WD_ORIENT.LANDSCAPE if pg['w'] > pg['h'] else WD_ORIENT.PORTRAIT
        sec.page_width, sec.page_height = Pt(pg['w']), Pt(pg['h'])
        boxes = [b['bbox'] for b in pg['blocks']] + [t['bbox'] for t in pg['tables']]
        if boxes:
            left = min(b.x0 for b in boxes)
            top = min(b.y0 for b in boxes)
            right = pg['w'] - max(b.x1 for b in boxes)
            bottom = pg['h'] - max(b.y1 for b in boxes)
        else:
            left = top = right = bottom = 36
        clamp = lambda v: Pt(max(18, min(72, v)))
        sec.left_margin, sec.top_margin, sec.right_margin, sec.bottom_margin = clamp(left), clamp(top), clamp(right), clamp(bottom)
        sec.header_distance = sec.footer_distance = Pt(12)
        body = doc.element.body
        sect_anchor = body.find(qn('w:sectPr'))
        for t in pg['tables']:
            el = parse_xml(self.table_xml(t))
            sect_anchor.addprevious(el)
        z = 1000
        runs = []
        for r in pg['rasters']:
            b = r['bbox']
            runs.append(self.picture(r['data'], b.x0, b.y0, b.width, b.height, True, z, 'Scan' if r['kind'] == 'scan' else 'Picture'))
            z += 1
        vec = pg['vectors']
        for d in vec[:3000]:
            s = self.shape(d, z)
            if s:
                runs.append(s)
                z += 1
        for im in pg['images']:
            b = im['bbox']
            runs.append(self.picture(im['data'], b.x0, b.y0, b.width, b.height, True, z))
            z += 1
        runs.append(self.text_boxes(pg['blocks']))
        p = parse_xml(f'<w:p {NS}><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr>{"".join(runs)}</w:p>')
        sect_anchor.addprevious(p)

    def header_footer(self):
        """The first page's repeated header/footer becomes the document's header/footer."""
        pg = self.pages[0] if self.pages else None
        if not pg:
            return
        for kind in ('header', 'footer'):
            blocks = pg[kind]
            if not blocks:
                continue
            part = self.doc.sections[0].header if kind == 'header' else self.doc.sections[0].footer
            part.is_linked_to_previous = False
            el = part._element
            for p in list(el.iterchildren(qn('w:p'))):
                el.remove(p)
            for b in blocks:
                if b.get('page_number'):
                    b = page_number_fields(b)
            xml = self.text_boxes(blocks)
            el.append(parse_xml(f'<w:p {NS}><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr>{xml}</w:p>'))

    def build(self, dst):
        for i, pg in enumerate(self.pages):
            self.page(pg, i)
        self.header_footer()
        self.embed_fonts()
        cp = self.doc.core_properties
        cp.title = (self.meta.get('title') or '')[:255]
        cp.author = (self.meta.get('author') or '')[:255]
        cp.subject = (self.meta.get('subject') or '')[:255]
        cp.keywords = (self.meta.get('keywords') or '')[:255]
        cp.comments = 'Converted from PDF'
        self.doc.save(dst)


def page_number_fields(block):
    """Mark the numbers in a page-number line so they become PAGE / NUMPAGES fields."""
    for p in block['paras']:
        for l in p['lines']:
            seen = 0
            for r in l['runs']:
                def sub(m):
                    nonlocal seen
                    seen += 1
                    return '⁣PAGE⁣' if seen == 1 else '⁣NUMPAGES⁣'
                r['text'] = re.sub(r'\d+', sub, r['text'])
    return block


def write(pages, fonts, meta, dst):
    Writer(pages, fonts, meta).build(dst)
