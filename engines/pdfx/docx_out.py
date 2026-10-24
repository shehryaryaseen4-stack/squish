"""Document model -> an editable Word document that looks like the PDF.

Each PDF page is a Word section of the same size and orientation:
  - text is ordinary body text: real paragraphs with the PDF's fonts, sizes, colours, bold,
    italics, links, alignment, indents, exact line heights and the space before each paragraph,
    bullets/numbering as Word lists, and tab stops for text further along the same line (a
    date at the right of a job title)
  - the page's text is cut into bands and columns the way a reader sees it (an XY cut); columns
    side by side (a sidebar next to the main text) become a layout table without borders or cell
    padding, so each column flows on its own
  - ruled tables are real Word tables in the flow, with cell colours and borders
  - vector drawings (backgrounds, panels, lines) as Word shapes and pictures as Word pictures,
    anchored to the page behind the text, in the PDF's drawing order
  - the repeated header/footer in Word's header/footer, page numbers as page-number fields
  - only rotated or vertical text, which cannot flow, sits in a text box (no border, no fill,
    no inner margins)
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
        self.hf = {}

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
    def extra(self, run):
        """The PDF's character spacing of a run (points per character), for embedded fonts."""
        fi = self.fonts.get(run['font'])
        t = run['text'].rstrip()
        if fi is None or fi.metrics is None or len(t) < 2:
            return 0
        x = (run['bbox'].width - fi.metrics.text_length(t, fontsize=run['size'])) / len(t)
        return x if abs(x) > 0.05 else 0

    def width(self, run, text=None):
        fi = self.fonts.get(run['font']) or FontInfo(run['font'])
        text = run['text'] if text is None else text
        return fi.width(text, run['size'], run.get('bold')) + self.extra(run) * len(text)

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
        elif exact and not scale and self.extra(run):  # the PDF's character spacing
            props.append(f'<w:spacing w:val="{int(round(self.extra(run) * 20))}"/>')
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

    def para_xml(self, p, cx0, cx1, before, numbering=None, align=None, tabs=(), extra=()):
        """One Word paragraph for a PDF paragraph, in a column running from cx0 to cx1 (points).
        Its place in the column comes from the indents: lines keep the PDF's left edge, centred
        and right-aligned text keep their own span, and text that flows wraps at the PDF's right
        edge. tabs/extra: further pieces of the same line, each after a tab stop."""
        ls = p['lines']
        L = self.line_height(p)
        first = ls[0]
        left = min(l['bbox'].x0 for l in ls[1:]) if len(ls) > 1 else first['bbox'].x0
        right_edge = max(l['bbox'].x1 for l in ls)
        align = align or p['align']
        ind = {}  # one w:ind with all its attributes (Word rejects two)
        strip = None
        if numbering:
            text_x, strip = numbering['text_x'], numbering['text']
            ind.update(left=tw(text_x - cx0), hanging=tw(max(0, text_x - numbering['bullet_x'])))
            left = numbering['bullet_x']
        elif align == 'center':
            slack = 2 + (right_edge - left) * 0.03
            ind.update(left=tw(p['bbox'].x0 - cx0 - slack), right=tw(cx1 - p['bbox'].x1 - slack))
        elif align == 'right':
            ind['right'] = tw(cx1 - p['bbox'].x1)
        else:
            first_ind = first['bbox'].x0 - left
            if abs(first_ind) > 0.8 and len(ls) > 1:
                ind.update({'left': tw(left - cx0), 'firstLine' if first_ind > 0 else 'hanging': tw(abs(first_ind))})
            elif abs(left - cx0) > 0.05:
                ind['left'] = tw(left - cx0)
        flow = len(ls) > 1 and align in ('left', 'justify') and not extra and self.can_flow(p, right_edge + 0.5 - left)
        if flow:
            # wrap where the PDF wraps: the text column ends at the paragraph's right edge
            ind['right'] = tw(cx1 - right_edge - 0.5)
        jc = {'left': 'left', 'justify': 'both', 'center': 'center', 'right': 'right'}[align]
        if not flow and jc == 'both':
            jc = 'left'
        # paragraph properties in the order the WordprocessingML schema requires (Word refuses others)
        ppr = ['<w:widowControl w:val="0"/>']
        if numbering:
            ppr.append(f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{numbering["num"]}"/></w:numPr>')
        if tabs:
            ppr.append('<w:tabs>' + ''.join(f'<w:tab w:val="{kind}" w:pos="{tw(pos)}"/>' for kind, pos in sorted(tabs, key=lambda t: t[1])) + '</w:tabs>')
        ppr.append('<w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/>')
        ppr.append(f'<w:spacing w:before="{tw(max(0, before))}" w:after="0" w:line="{max(1, tw(L))}" w:lineRule="exact"/>')
        if ind:
            order = ('left', 'right', 'hanging', 'firstLine')
            ppr.append('<w:ind ' + ' '.join(f'w:{k}="{ind[k]}"' for k in order if k in ind) + '/>')
        ppr.append(f'<w:jc w:val="{jc}"/>')
        body = []
        for i, l in enumerate(ls):
            if i:
                body.append('<w:r><w:t xml:space="preserve"> </w:t></w:r>' if flow else '<w:r><w:br/></w:r>')
            body.append(self.line_runs_xml(l, strip if i == 0 else None))
        for ln in extra:
            body.append('<w:r><w:tab/></w:r>' + self.line_runs_xml(ln))
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

    # ------------------------------------------------------------------------- flowing layout --
    # Text is written as ordinary paragraphs in the page body. The page's text items (paragraphs
    # and tables) are cut into bands and columns (an XY cut, the way a reader sees the layout):
    # columns side by side become a borderless layout table, everything else is one paragraph
    # after another, placed by exact line heights and the space before each paragraph.

    def items(self, blocks, tables, rotated):
        out = []
        for b in blocks:
            for p in b['paras']:
                if not self.regular(p):
                    for l in p['lines']:
                        if abs(l.get('angle', 0)) >= 1:
                            rotated.append(l)
                        else:
                            q = dict(p, lines=[l], align='left', kind='p', step=None)
                            q['bbox'] = fitz.Rect(l['bbox'])
                            out.append(self.para_item(q))
                    continue
                out.append(self.para_item(p))
        for t in tables:
            bb = fitz.Rect(t['bbox'])
            out.append({'kind': 'table', 't': t, 'x0': bb.x0, 'x1': bb.x1, 'top': bb.y0, 'bottom': bb.y1})
        return out

    def para_item(self, p):
        L = self.line_height(p)
        top = p['lines'][0]['baseline'] - L * BASELINE_IN_LINE
        x0 = min(l['bbox'].x0 for l in p['lines'])
        x1 = max(l['bbox'].x1 for l in p['lines'])
        return {'kind': 'para', 'p': p, 'x0': x0, 'x1': x1, 'top': top, 'bottom': top + L * len(p['lines']),
                'single': len(p['lines']) == 1, 'baseline': p['lines'][0]['baseline']}

    @staticmethod
    def gaps(spans, lo, hi, min_gap):
        """Free stretches between the spans (start, end) inside lo..hi, at least min_gap wide."""
        spans = sorted(spans)
        out, end = [], None
        for a, b in spans:
            if end is not None and a - end >= min_gap:
                out.append((end, a))
            end = b if end is None else max(end, b)
        return out

    def columns(self, items, cx0, cx1, strong):
        """Split items at vertical gutters (free strips at least 6 pt wide) into columns. strong:
        only when every column runs down a good part of the area (a sidebar next to content)."""
        gs = self.gaps([(i['x0'], i['x1']) for i in items], cx0, cx1, 6)
        if not gs:
            return None
        bounds = [cx0] + [(a + b) / 2 for a, b in gs] + [cx1]
        groups = []
        for k in range(len(bounds) - 1):
            g = [i for i in items if bounds[k] <= (i['x0'] + i['x1']) / 2 < bounds[k + 1]]
            if g:
                groups.append([bounds[k], bounds[k + 1], g])
        if len(groups) < 2:
            return None
        groups[0][0], groups[-1][1] = cx0, cx1
        for k in range(len(groups) - 1):  # neighbouring columns meet in the middle of their gutter
            mid = (max(i['x1'] for i in groups[k][2]) + min(i['x0'] for i in groups[k + 1][2])) / 2
            groups[k][1] = groups[k + 1][0] = mid
        if strong:
            height = max(i['bottom'] for i in items) - min(i['top'] for i in items)
            if min(max(i['bottom'] for i in g) - min(i['top'] for i in g) for _, _, g in groups) < height * 0.4:
                return None
        return ('cols', [(a, b, self.cut(g, a, b)) for a, b, g in groups])

    def cut(self, items, cx0, cx1):
        """Layout tree for items in the column cx0..cx1: ('stack', entries) where an entry is an
        item or ('cols', [(x0, x1, subtree), ...]) for columns side by side."""
        if len(items) <= 1:
            return ('stack', list(items))
        node = self.columns(items, cx0, cx1, True)
        if node:
            return ('stack', [node])
        # bands: horizontal strips with nothing across them, top to bottom
        bands = []
        for i in sorted(items, key=lambda i: i['top']):
            if bands and i['top'] < bands[-1]['bottom'] - 0.5:
                bands[-1]['items'].append(i)
                bands[-1]['bottom'] = max(bands[-1]['bottom'], i['bottom'])
            else:
                bands.append({'items': [i], 'bottom': i['bottom']})
        out = []
        for band in bands:
            its = band['items']
            if len(its) > 1 and not self.one_line(its):
                sub = self.columns(its, cx0, cx1, False)
                if sub:
                    out.append(sub)
                    continue
            out.extend(sorted(its, key=lambda i: (round(i['baseline'] if i['kind'] == 'para' else i['top'], 1), i['x0'])))
        return ('stack', out)

    @staticmethod
    def one_line(band):
        """Single lines that share a baseline (a title and a date at the right): one paragraph."""
        return all(i['kind'] == 'para' and i['single'] for i in band) and \
            max(i['baseline'] for i in band) - min(i['baseline'] for i in band) <= 1.5

    def spacer(self, height):
        """An empty paragraph exactly height points tall (moves what follows down)."""
        h = max(1, tw(height))
        return (f'<w:p><w:pPr><w:widowControl w:val="0"/><w:spacing w:before="0" w:after="0" w:line="{h}" w:lineRule="exact"/>'
                f'<w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>')

    def emit(self, node, cx0, cx1, cursor):
        """XML for a stack, starting at page height cursor; returns (xml list, cursor after)."""
        out = []
        entries = node[1]
        k = 0
        while k < len(entries):
            it = entries[k]
            if isinstance(it, tuple):  # columns side by side: a borderless layout table
                xml, cursor = self.layout_table(it, cx0, cx1, cursor)
                out.extend(xml)
                k += 1
                continue
            if it['kind'] == 'table':
                gap = it['top'] - cursor
                if gap > 0.05:
                    out.append(self.spacer(gap))
                    cursor = it['top']
                out.append(self.table_xml(it['t'], indent=it['x0'] - cx0))
                cursor = max(cursor, it['bottom'])
                k += 1
                continue
            # pieces of one line (same baseline) go into one paragraph, separated by tab stops
            group = [it]
            while k + len(group) < len(entries):
                nxt = entries[k + len(group)]
                if isinstance(nxt, tuple) or nxt['kind'] != 'para' or not nxt['single'] or not it['single'] \
                        or abs(nxt['baseline'] - it['baseline']) > 1.5:
                    break
                group.append(nxt)
            group.sort(key=lambda i: i['x0'])
            first = group[0]
            p = first['p']
            L = max(self.line_height(g['p']) for g in group)
            top = first['baseline'] - L * BASELINE_IN_LINE
            before = top - cursor
            numbering = self.list_numbering(p) if p['kind'] == 'li' and len(group) == 1 else None
            tabs, extra = [], []
            for g in group[1:]:
                gp = g['p']
                at_right = cx1 - g['x1'] <= 3 or (gp['align'] == 'right')
                tabs.append(('right', g['x1'] - cx0) if at_right else ('left', g['x0'] - cx0))
                extra.append(gp['lines'][0])
            q = dict(p, step=None) if len(group) > 1 else p
            if len(group) > 1:
                q = dict(q, align='left')
                q['size'] = max(g['p']['size'] for g in group)
            out.append(self.para_xml(q, cx0, cx1, before, numbering, tabs=tabs, extra=extra))
            cursor = max(cursor, top) + L * len(p['lines'])
            k += len(group)
        return out, cursor

    def layout_table(self, node, cx0, cx1, cursor):
        """Columns as a one-row table with no borders and no cell padding."""
        cols = node[1]
        tops = []
        for a, b, sub in cols:
            t = self.first_top(sub)
            if t is not None:
                tops.append(t)
        row_top = min(tops) if tops else cursor
        out = []
        if row_top - cursor > 0.05:
            out.append(self.spacer(row_top - cursor))
        else:
            row_top = cursor
        bounds = [cx0] + [b for _, b, _ in cols[:-1]] + [cx1]
        cells, bottom = [], row_top
        for k, (a, b, sub) in enumerate(cols):
            xml, end = self.emit(sub, bounds[k], bounds[k + 1], row_top)
            bottom = max(bottom, end)
            if not xml or not xml[-1].startswith('<w:p>') and not xml[-1].startswith('<w:p '):
                xml.append(self.spacer(0.05))
            cells.append(f'<w:tc><w:tcPr><w:tcW w:w="{tw(bounds[k + 1] - bounds[k])}" w:type="dxa"/>'
                         f'<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>'
                         f'<w:vAlign w:val="top"/></w:tcPr>{"".join(xml)}</w:tc>')
        grid = ''.join(f'<w:gridCol w:w="{tw(bounds[k + 1] - bounds[k])}"/>' for k in range(len(cols)))
        out.append(f'<w:tbl><w:tblPr><w:tblW w:w="{tw(cx1 - cx0)}" w:type="dxa"/>'
                   f'<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>'
                   f'<w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/>'
                   f'<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>'
                   f'<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>'
                   f'<w:tblGrid>{grid}</w:tblGrid><w:tr><w:trPr><w:trHeight w:val="{max(1, tw(bottom - row_top))}" w:hRule="atLeast"/></w:trPr>'
                   f'{"".join(cells)}</w:tr></w:tbl>')
        return out, bottom

    def first_top(self, node):
        for it in node[1]:
            if isinstance(it, tuple):
                tops = [self.first_top(sub) for _, _, sub in it[1]]
                tops = [t for t in tops if t is not None]
                if tops:
                    return min(tops)
            else:
                return it['top'] if it['kind'] == 'table' else it['baseline'] - self.line_height(it['p']) * BASELINE_IN_LINE
        return None

    def rotated_line(self, l):
        q = {'lines': [l], 'align': 'left', 'kind': 'p', 'size': l['size'], 'step': None}
        L = l['size'] * 1.2
        xml = self.para_xml(q, l['origin'][0], l['origin'][0] + 2000, 0)
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
    def table_xml(self, t, indent=0.0):
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
        tblpr = (f'<w:tblPr><w:tblW w:w="{tw(xs[-1] - xs[0])}" w:type="dxa"/><w:tblInd w:w="{tw(indent)}" w:type="dxa"/>'
                 f'<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
                 f'<w:tblLayout w:type="fixed"/>'
                 f'<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>'
                 f'<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>')
        return f'<w:tbl>{tblpr}<w:tblGrid>{grid}</w:tblGrid>{"".join(rows)}</w:tbl>'

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
            xml = self.para_xml(p, cb.x0, cb.x1, before, align=jc)
            out.append(xml)
            prev_bottom = top + L * len(p['lines'])
        return ''.join(out) or '<w:p/>'

    # ----------------------------------------------------------------------------- page/sections --
    def body_xml(self, xml):
        """Parse body-level XML written without namespace declarations."""
        return list(parse_xml(f'<w:body {NS}>{xml}</w:body>'))

    def margins(self, pg, items):
        W, H = pg['w'], pg['h']
        if items:
            x0 = min(i['x0'] for i in items)
            x1 = max(i['x1'] for i in items)
            top = min(i['top'] for i in items)
            bottom = max(i['bottom'] for i in items)
        else:
            x0, x1, top, bottom = 36, W - 36, 36, H - 36
        left = max(0.0, min(36.0, x0 - 0.5))
        right = max(0.0, min(36.0, W - x1 - 0.5))
        hf = self.hf
        if hf.get('hdr_bottom') is not None:
            top_m = min(max(hf['hdr_bottom'] + 0.5, 0), max(0.0, top - 0.1))
        else:
            top_m = max(0.0, min(36.0, top - 0.1))
        if hf.get('ftr_top') is not None:
            bottom_m = max(0.0, min(H - hf['ftr_top'] + 0.5, H - bottom - 0.1))
        else:
            bottom_m = max(0.0, min(18.0, H - bottom - 1))
        return left, right, top_m, bottom_m

    def page(self, pg, idx):
        doc = self.doc
        W, H = pg['w'], pg['h']
        sec = doc.sections[0] if idx == 0 else doc.add_section(WD_SECTION.NEW_PAGE)
        sec.orientation = WD_ORIENT.LANDSCAPE if W > H else WD_ORIENT.PORTRAIT
        sec.page_width, sec.page_height = Pt(W), Pt(H)
        rotated = []
        items = self.items(pg['blocks'], pg['tables'], rotated)
        left, right, top_m, bottom_m = self.margins(pg, items)
        sec.left_margin, sec.right_margin, sec.top_margin, sec.bottom_margin = Pt(left), Pt(right), Pt(top_m), Pt(bottom_m)
        sec.header_distance = Pt(self.hf.get('hdr_top', 12) or 0)
        sec.footer_distance = Pt(max(0, H - self.hf['ftr_bottom']) if self.hf.get('ftr_bottom') is not None else 12)
        body = doc.element.body
        sect_anchor = body.find(qn('w:sectPr'))

        # the page's pictures and shapes, anchored to the page behind the text, in the PDF's
        # drawing order; a hair-thin first paragraph holds them (and any rotated text)
        z = 1000
        runs = []
        for r in pg['rasters']:
            b = r['bbox']
            runs.append(self.picture(r['data'], b.x0, b.y0, b.width, b.height, True, z, 'Scan' if r['kind'] == 'scan' else 'Picture'))
            z += 1
        layers = [(d.get('seqno', 0), 0, d) for d in pg['vectors'][:3000]] + [(im.get('seq', 10 ** 6), 1, im) for im in pg['images']]
        layers.sort(key=lambda t: (t[0], t[1]))
        for _, kind, item in layers:
            if kind == 0:
                xml = self.shape(item, z)
            else:
                b = item['bbox']
                xml = self.picture(item['data'], b.x0, b.y0, b.width, b.height, True, z)
            if xml:
                runs.append(xml)
                z += 1
        for l in rotated:  # rotated / vertical text: the one place a (borderless) text box is used
            runs.append(self.rotated_line(l))
        anchor = (f'<w:p><w:pPr><w:widowControl w:val="0"/><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/>'
                  f'<w:rPr><w:sz w:val="2"/></w:rPr></w:pPr>{"".join(runs)}</w:p>')
        cx0, cx1 = left, W - right
        flow, _ = self.emit(self.cut(items, cx0, cx1), cx0, cx1, top_m + 0.05)
        for el in self.body_xml(anchor + ''.join(flow)):
            sect_anchor.addprevious(el)

    def header_footer(self):
        """The first page's repeated header/footer becomes the document's header/footer, written
        as ordinary paragraphs (page numbers as page-number fields)."""
        pg = self.pages[0] if self.pages else None
        if not pg:
            return
        sec = self.doc.sections[0]
        cx0 = sec.left_margin.pt
        cx1 = pg['w'] - sec.right_margin.pt
        for kind in ('header', 'footer'):
            blocks = pg[kind]
            if not blocks:
                continue
            part = sec.header if kind == 'header' else sec.footer
            part.is_linked_to_previous = False
            el = part._element
            for p in list(el.iterchildren(qn('w:p'))):
                el.remove(p)
            for b in blocks:
                if b.get('page_number'):
                    page_number_fields(b)
            rotated = []
            items = self.items(blocks, [], rotated)
            start = self.hf['hdr_top'] if kind == 'header' else self.hf['ftr_top']
            xml, _ = self.emit(self.cut(items, cx0, cx1), cx0, cx1, start)
            for child in list(parse_xml(f"<w:hdr {NS}>{''.join(xml) or self.spacer(0.05)}</w:hdr>")):
                el.append(child)

    def measure_hf(self):
        """Where the header and footer sit (from the first page), so margins leave room for them."""
        self.hf = {}
        pg = self.pages[0] if self.pages else None
        if not pg:
            return
        for kind, a, b in (('header', 'hdr_top', 'hdr_bottom'), ('footer', 'ftr_top', 'ftr_bottom')):
            items = self.items(pg[kind], [], []) if pg[kind] else []
            if items:
                self.hf[a] = max(0.0, min(i['top'] for i in items))
                self.hf[b] = max(i['bottom'] for i in items)

    def build(self, dst):
        # the template's <w:zoom> lacks the percentage the schema requires
        zoom = self.doc.settings.element.find(qn('w:zoom'))
        if zoom is not None and zoom.get(qn('w:percent')) is None:
            zoom.set(qn('w:percent'), '100')
        self.measure_hf()
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
