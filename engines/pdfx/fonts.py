"""The PDF's own fonts, made usable in Word and in web pages.

Fonts embedded in a PDF are often subsets without a usable character map (the PDF maps
characters to glyph numbers itself). From the text trace we know which glyph each character
used, so a proper cmap can be rebuilt; missing tables a browser or Word requires are added.
Only TrueType outlines can be embedded in Word; web pages take TrueType and OpenType (CFF).
Fonts that cannot be repaired get a stand-in from the fonts every computer has, sized to the
exact width the text has in the PDF.
"""
import io
import re

import pymupdf as fitz

# fonts every Windows / Office computer has
OFFICE_FONTS = {'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia',
                'Corbel', 'Courier New', 'Georgia', 'Impact', 'Lucida Console', 'Palatino Linotype', 'Segoe UI', 'Tahoma',
                'Times New Roman', 'Trebuchet MS', 'Verdana', 'Garamond', 'Century Gothic', 'Book Antiqua', 'Symbol', 'Wingdings'}
# PostScript base names -> the family Word and browsers know (metric-compatible)
ALIASES = {'helvetica': 'Arial', 'arial': 'Arial', 'arialmt': 'Arial', 'times': 'Times New Roman', 'timesroman': 'Times New Roman',
           'timesnewroman': 'Times New Roman', 'timesnewromanps': 'Times New Roman', 'courier': 'Courier New', 'couriernew': 'Courier New',
           'symbol': 'Symbol', 'zapfdingbats': 'Wingdings', 'liberationsans': 'Arial', 'liberationserif': 'Times New Roman',
           'liberationmono': 'Courier New', 'dejavusans': 'Verdana', 'nimbussans': 'Arial', 'nimbussansl': 'Arial',
           'nimbusroman': 'Times New Roman', 'nimbusromno': 'Times New Roman', 'nimbusmono': 'Courier New', 'nimbusmonops': 'Courier New',
           'texgyreheros': 'Arial', 'texgyretermes': 'Times New Roman', 'texgyrecursor': 'Courier New', 'freesans': 'Arial',
           'freeserif': 'Times New Roman', 'freemono': 'Courier New', 'arimo': 'Arial', 'tinos': 'Times New Roman', 'cousine': 'Courier New'}
# stand-ins by kind: Word/CSS font, PyMuPDF metrics (regular, bold), generic CSS family
STAND_INS = {'sans': ('Arial', 'helv', 'hebo', 'sans-serif'), 'serif': ('Times New Roman', 'tiro', 'tibo', 'serif'),
             'mono': ('Courier New', 'cour', 'cobo', 'monospace'), 'script': ('Segoe Script', 'helv', 'hebo', 'cursive')}
SCRIPT = re.compile(r'script|vibes|hand|brush|pacifico|dancing|signature|allura|sacramento|parisienne|satisfy|cursive|calligraph|'
                    r'tangerine|alex ?brush|kaushan|lobster', re.I)
SERIF = re.compile(r'times|georgia|garamond|playfair|merriweather|lora|baskerville|bodoni|didot|(?<!sans )serif|roman|cormorant|crimson|'
                   r'cinzel|abril|prata|spectral|cambria|minion|caslon|palatino|book ?antiqua|century schoolbook|charter|tiro', re.I)
MONO = re.compile(r'mono|courier|consol|code|menlo', re.I)
BOLD = re.compile(r'bold|black|heavy|semibold|demi', re.I)
ITALIC = re.compile(r'italic|oblique', re.I)


def clean_name(raw):
    """'ABCDEF+Montserrat-SemiBold' -> 'Montserrat-SemiBold'."""
    return raw.split('+', 1)[-1]


def family(raw):
    """Family name for display: 'Montserrat-SemiBold' -> 'Montserrat', 'TimesNewRomanPS-BoldMT' -> 'Times New Roman'."""
    name = clean_name(raw)
    base = re.split(r'[-,]', name)[0]
    base = re.sub(r'(PSMT|MT|PS)$', '', base)
    key = re.sub(r'[^a-z]', '', base.lower())
    if key in ALIASES:
        return ALIASES[key]
    base = re.sub(r'(Bold|Italic|Oblique|Regular|Medium|Light|Black|Semibold|SemiBold)+$', '', base) or base
    return re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', base)


def kind(raw):
    if SCRIPT.search(raw):
        return 'script'
    if MONO.search(raw):
        return 'mono'
    if SERIF.search(raw):
        return 'serif'
    return 'sans'


class FontInfo:
    """One font used in the PDF: how to show it in Word and in HTML, and how wide its text is."""

    def __init__(self, raw):
        self.raw = raw
        self.family = family(raw)            # e.g. 'Montserrat'
        self.kind = kind(raw)
        self.bold = bool(BOLD.search(raw))
        self.italic = bool(ITALIC.search(raw))
        self.data = None                     # repaired font file (bytes) when usable
        self.ext = None                      # 'ttf' or 'otf'
        self.truetype = False                # glyf outlines: can be embedded in Word
        self.metrics = None                  # fitz.Font for measuring text in this font
        self.embed_name = None               # family name inside the repaired file

    @property
    def office(self):
        return self.family in OFFICE_FONTS

    @property
    def stand_in(self):
        return STAND_INS[self.kind]

    def word_font(self):
        """(name, exact) for Word: an embedded TrueType font or an Office font is exact."""
        if self.data and self.truetype:
            return self.embed_name, True
        if self.office:
            return self.family, True
        return self.stand_in[0], False

    def width(self, text, size, bold=False):
        """Width of text in points in the font Word/HTML will use (the PDF font when available)."""
        if self.metrics is not None:
            return self.metrics.text_length(text, fontsize=size)
        si = self.stand_in if not self.office else STAND_INS['serif' if self.kind == 'serif' else 'mono' if self.kind == 'mono' else 'sans']
        return fitz.get_text_length(text, fontname=si[2] if bold else si[1], fontsize=size)


def _repair(buf, uni2gid, name, bold, italic):
    """Return (bytes, ext, truetype) of a font file with a real cmap and the tables apps need, or None."""
    from fontTools.ttLib import TTFont, newTable
    from fontTools.ttLib.tables._c_m_a_p import CmapSubtable
    try:
        ft = TTFont(io.BytesIO(buf), lazy=False)
    except Exception:
        return None
    truetype = 'glyf' in ft
    if not truetype and 'CFF ' not in ft:
        return None
    for t in ('head', 'hhea', 'hmtx', 'maxp'):
        if t not in ft:
            return None
    order = ft.getGlyphOrder()
    mapping = {}
    if 'cmap' in ft:
        best = ft['cmap'].getBestCmap() or {}
        # keep the font's own map only when it agrees with what the PDF showed
        if all(best.get(u) == order[g] for u, g in uni2gid.items() if g < len(order) and u in best):
            mapping.update(best)
    for u, g in uni2gid.items():
        if 0 <= g < len(order) and u not in (0, 0xFFFD):
            mapping[u] = order[g]
    if not mapping:
        return None
    cmap = newTable('cmap')
    cmap.tableVersion = 0
    subs = []
    bmp = {u: g for u, g in mapping.items() if u <= 0xFFFF}
    for pid, eid in ((3, 1), (0, 3)):
        st = CmapSubtable.newSubtable(4)
        st.platformID, st.platEncID, st.language, st.cmap = pid, eid, 0, dict(bmp)
        subs.append(st)
    if any(u > 0xFFFF for u in mapping):
        st = CmapSubtable.newSubtable(12)
        st.platformID, st.platEncID, st.language, st.cmap = 3, 10, 0, dict(mapping)
        subs.append(st)
    cmap.tables = subs
    ft['cmap'] = cmap

    style = 'Regular'
    name_t = newTable('name')
    name_t.names = []
    for nid, val in ((1, name), (2, style), (3, f'{name};pdf'), (4, name), (6, re.sub(r'[^A-Za-z0-9-]', '', name)[:60] or 'PDFFont'),
                     (16, name), (17, style)):
        name_t.setName(val, nid, 3, 1, 0x409)
        name_t.setName(val, nid, 1, 0, 0)
    ft['name'] = name_t

    head, hhea = ft['head'], ft['hhea']
    head.macStyle = 0
    if 'OS/2' not in ft:
        os2 = newTable('OS/2')
        os2.version = 4
        os2.xAvgCharWidth = int(sum(w for w, _ in ft['hmtx'].metrics.values()) / max(1, len(ft['hmtx'].metrics)))
        os2.usWeightClass = 700 if bold else 400
        os2.usWidthClass = 5
        os2.fsType = 0
        for a in ('ySubscriptXSize', 'ySubscriptYSize', 'ySubscriptXOffset', 'ySubscriptYOffset', 'ySuperscriptXSize', 'ySuperscriptYSize',
                  'ySuperscriptXOffset', 'ySuperscriptYOffset', 'yStrikeoutSize', 'yStrikeoutPosition', 'sFamilyClass'):
            setattr(os2, a, 0)
        from fontTools.ttLib.tables.O_S_2f_2 import Panose
        os2.panose = Panose()
        os2.ulUnicodeRange1 = os2.ulUnicodeRange2 = os2.ulUnicodeRange3 = os2.ulUnicodeRange4 = 0
        os2.achVendID = 'PDF '
        os2.fsSelection = 0x40
        os2.usFirstCharIndex = min(bmp) if bmp else 0x20
        os2.usLastCharIndex = max(bmp) if bmp else 0x7E
        os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = hhea.ascent, hhea.descent, hhea.lineGap
        os2.usWinAscent, os2.usWinDescent = max(0, hhea.ascent), max(0, -hhea.descent)
        os2.ulCodePageRange1, os2.ulCodePageRange2 = 1, 0
        os2.sxHeight, os2.sCapHeight = int(hhea.ascent * 0.5), int(hhea.ascent * 0.7)
        os2.usDefaultChar, os2.usBreakChar, os2.usMaxContext = 0, 32, 0
        ft['OS/2'] = os2
    else:
        ft['OS/2'].fsType = 0  # installable: the font is only used for this document
        ft['OS/2'].fsSelection = (ft['OS/2'].fsSelection & ~0x61) | 0x40
    if 'post' not in ft:
        post = newTable('post')
        post.formatType = 3.0
        post.italicAngle = post.underlinePosition = post.underlineThickness = 0
        post.isFixedPitch = post.minMemType42 = post.maxMemType42 = post.minMemType1 = post.maxMemType1 = 0
        ft['post'] = post
    elif truetype:
        ft['post'].formatType = 3.0  # glyph names are not needed and are often broken in subsets
    for t in ('kern', 'GPOS', 'GSUB', 'GDEF', 'hdmx', 'LTSH', 'VDMX'):
        if t in ft and t in ('hdmx', 'LTSH', 'VDMX'):
            del ft[t]
    out = io.BytesIO()
    try:
        ft.save(out)
    except Exception:
        return None
    return out.getvalue(), 'ttf' if truetype else 'otf', truetype


def collect(pdf, used):
    """used: raw font name -> {unicode: glyph id} from the text trace. Returns raw name -> FontInfo."""
    files = {}
    for page in pdf:
        for f in page.get_fonts(full=True):
            nm = clean_name(f[3])
            if f[0] not in files.setdefault(nm, []):
                files[nm].append(f[0])
    fonts = {}
    taken = set()
    for raw, uni2gid in used.items():
        fi = FontInfo(raw)
        fonts[raw] = fi
        for xref in files.get(clean_name(raw), []):
            try:
                _, ext, _, buf = pdf.extract_font(xref)
            except Exception:
                continue
            if ext not in ('ttf', 'otf', 'cff') or not buf:
                continue
            name = f'{fi.family}{" " if fi.family else ""}PDF {len(taken) + 1}'.strip()
            fixed = _repair(buf, uni2gid, name, fi.bold, fi.italic)
            if not fixed:
                continue
            data, fext, tt = fixed
            try:
                met = fitz.Font(fontbuffer=data)
            except Exception:
                continue
            if not all(met.has_glyph(u) for u in uni2gid if u > 32 and u != 0xFFFD):
                continue
            fi.data, fi.ext, fi.truetype, fi.metrics, fi.embed_name = data, fext, tt, met, name
            taken.add(name)
            break
    return fonts
