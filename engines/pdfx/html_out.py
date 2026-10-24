"""Document model -> one self-contained HTML file (styles, pictures and fonts inside it).

Every PDF page is a fixed-size <section> (the page as shown: crop box applied, rotation removed;
1 PDF point = 1 CSS pt). Everything on it is placed in that one coordinate system, from the
page's top-left corner, and stacked in the PDF's own drawing order:
  - scans (OCR pages) and pictures of the rare areas nothing else could capture, at the bottom
  - vector drawings (backgrounds, panels, shapes, rules, table colours) as inline <svg>, and
    each embedded picture as its own <img>, interleaved as the PDF paints them
  - tables as <table> elements holding the cell text
  - text on top, as headings, paragraphs and lists (<h1>-<h3>, <p>, <ul>/<ol>, <a>) whose lines
    sit at the PDF's baselines, in the PDF's own fonts where they could be embedded

Positions are written on each element itself (not only in the stylesheet), so the page keeps
its layout even if the styles are lost. A small script lines each line up with the PDF exactly
(baseline and width) once the fonts have loaded, and scales pages down on narrow screens.
"""
import html
import io
import re

ESC = lambda s: html.escape(s, quote=True)
STAND_IN_METRICS = {'Arial': (0.905, 0.212), 'Times New Roman': (0.891, 0.216), 'Courier New': (0.833, 0.300), 'Segoe Script': (1.06, 0.38)}


def f2(v):
    return f'{v:.2f}'.rstrip('0').rstrip('.') if v % 1 else str(int(v))


def css_rgb(c, alpha=1.0):
    if c is None:
        return 'none'
    if alpha < 1:
        return f'rgba({c[0]},{c[1]},{c[2]},{alpha:.3f})'
    return '#%02x%02x%02x' % tuple(c)


def path_d(d):
    out, cur = [], None
    for it in d['items']:
        op = it[0]
        if op == 'l':
            a, b = it[1], it[2]
            if cur is None or abs(cur.x - a.x) > 0.01 or abs(cur.y - a.y) > 0.01:
                out.append(f'M{f2(a.x)} {f2(a.y)}')
            out.append(f'L{f2(b.x)} {f2(b.y)}')
            cur = b
        elif op == 'c':
            a, c1, c2, b = it[1], it[2], it[3], it[4]
            if cur is None or abs(cur.x - a.x) > 0.01 or abs(cur.y - a.y) > 0.01:
                out.append(f'M{f2(a.x)} {f2(a.y)}')
            out.append(f'C{f2(c1.x)} {f2(c1.y)} {f2(c2.x)} {f2(c2.y)} {f2(b.x)} {f2(b.y)}')
            cur = b
        elif op == 're':
            r = it[1]
            out.append(f'M{f2(r.x0)} {f2(r.y0)}H{f2(r.x1)}V{f2(r.y1)}H{f2(r.x0)}Z')
            cur = None
        elif op == 'qu':
            q = it[1]
            out.append(f'M{f2(q.ul.x)} {f2(q.ul.y)}L{f2(q.ur.x)} {f2(q.ur.y)}L{f2(q.lr.x)} {f2(q.lr.y)}L{f2(q.ll.x)} {f2(q.ll.y)}Z')
            cur = None
    if d.get('closePath') and out and not out[-1].endswith('Z'):
        out.append('Z')
    return ''.join(out)


def svg_path(d):
    from model import rgb
    attrs = [f'd="{path_d(d)}"']
    fill = rgb(d.get('fill')) if d.get('fill') is not None else None
    stroke = rgb(d.get('color')) if d.get('color') is not None else None
    attrs.append(f'fill="{css_rgb(fill)}"')
    if fill is not None and (d.get('fill_opacity') if d.get('fill_opacity') is not None else 1) < 1:
        attrs.append(f'fill-opacity="{d["fill_opacity"]:.3f}"')
    if fill is not None and d.get('even_odd'):
        attrs.append('fill-rule="evenodd"')
    if stroke is not None and 's' in (d.get('type') or 's'):
        attrs.append(f'stroke="{css_rgb(stroke)}" stroke-width="{f2(d.get("width") or 1)}"')
        if (d.get('stroke_opacity') if d.get('stroke_opacity') is not None else 1) < 1:
            attrs.append(f'stroke-opacity="{d["stroke_opacity"]:.3f}"')
        m = re.match(r'\[\s*([\d.\s]+)\]', d.get('dashes') or '')
        if m and m.group(1).strip():
            attrs.append(f'stroke-dasharray="{" ".join(m.group(1).split())}"')
        cap = (d.get('lineCap') or (0,))[0]
        attrs.append(f'stroke-linecap="{["butt", "round", "square"][int(cap) if cap in (0, 1, 2) else 0]}"')
        join = d.get('lineJoin') or 0
        attrs.append(f'stroke-linejoin="{["miter", "round", "bevel"][int(join) if join in (0, 1, 2) else 0]}"')
    return f'<path {" ".join(attrs)}/>'


class Writer:
    def __init__(self, pages, fonts, title, lang='en'):
        self.pages, self.fonts, self.title, self.lang = pages, fonts, title, lang
        self.files = {}          # name -> bytes (index.html; pictures and fonts are kept for checks)
        self.font_css = {}       # raw font name -> css family of the embedded file
        self.image_hash = {}
        sizes = sorted({round(p['size'], 1) for pg in pages for b in pg['blocks'] for p in b['paras'] if p['kind'] == 'h'}, reverse=True)
        self.heading_level = {s: min(6, i + 1) for i, s in enumerate(sizes)}

    def asset(self, folder, name, data):
        """Each picture and font goes into the page itself (data: URL), so the downloaded HTML
        file shows everything on its own, wherever it is opened."""
        import base64
        mime = {'png': 'image/png', 'jpg': 'image/jpeg', 'ttf': 'font/ttf', 'otf': 'font/otf'}[name.rsplit('.', 1)[-1]]
        self.files[f'{folder}/{name}'] = data
        return f'data:{mime};base64,{base64.b64encode(data).decode()}'

    def font_family(self, run):
        """CSS for a run's font: the PDF's own font file when it could be embedded, else the
        family name with a stand-in. Returns (css, ascent, descent, synthetic bold/italic allowed)."""
        fi = self.fonts.get(run['font'])
        if fi is not None and fi.data:
            if fi.raw not in self.font_css:
                n = len(self.font_css) + 1
                self.font_css[fi.raw] = (f'pdf-font-{n}', self.asset('fonts', f'font-{n}.{fi.ext}', fi.data), fi.ext)
            return f"'{self.font_css[fi.raw][0]}'", fi.asc, fi.desc, False
        if fi is None:
            from fonts import FontInfo
            fi = FontInfo(run['font'])
        stand = fi.family if fi.office else fi.stand_in[0]
        asc, desc = STAND_IN_METRICS.get(stand, (0.9, 0.22))
        names = [n for n in dict.fromkeys([fi.family, stand]) if n]
        return ', '.join(f"'{ESC(n)}'" for n in names) + f', {fi.stand_in[3]}', asc, desc, True

    def letter_spacing(self, r):
        """Extra space per character (the PDF's character spacing), when the PDF's own font is
        embedded and its letters therefore have their real widths."""
        fi = self.fonts.get(r['font'])
        text = r['text'].rstrip()
        if fi is None or fi.metrics is None or len(text) < 2:
            return 0
        extra = (r['bbox'].width - fi.metrics.text_length(text, fontsize=r['size'])) / len(text)
        return extra if abs(extra) > 0.05 else 0

    def run_html(self, r):
        fam, asc, desc, synth = self.font_family(r)
        # line-height = ascent + descent: the run's box then starts exactly one ascent above its baseline
        st = [f'font-family:{fam}', f'font-size:{f2(r["size"])}pt', f'line-height:{asc + desc:.4f}']
        if r.get('color') and tuple(r['color']) != (0, 0, 0):
            st.append(f'color:{css_rgb(r["color"])}')
        sp = self.letter_spacing(r)
        if sp:
            st.append(f'letter-spacing:{sp:.3f}pt')
        if synth and r.get('bold'):
            st.append('font-weight:700')
        if synth and r.get('italic'):
            st.append('font-style:italic')
        text = ESC(r['text'])
        span = f'<span style="{";".join(st)}">{text}</span>'
        if r.get('link'):
            span = f'<a href="{ESC(r["link"])}">{span}</a>'
        return span, asc, desc

    def line_html(self, ln, dx=0.0, dy=0.0):
        parts, asc_max = [], 0.0
        for r in ln['runs']:
            h, asc, desc = self.run_html(r)
            parts.append(h)
            asc_max = max(asc_max, asc * r['size'])
        base = ln['origin'][1] - dy
        x = ln['origin'][0] - dx
        width = ln['runs'][-1]['bbox'].x1 - ln['runs'][0]['bbox'].x0
        st = ['position:absolute', 'white-space:pre', 'font-size:0', f'left:{f2(x)}pt', f'top:{f2(base - asc_max)}pt']
        if abs(ln.get('angle', 0)) >= 1:
            st.append(f'transform:rotate({f2(ln["angle"])}deg)')
            st.append(f'transform-origin:0 {f2(asc_max)}pt')
            return f'<span class="l" style="{";".join(st)}">{"".join(parts)}</span>'
        return (f'<span class="l" style="{";".join(st)}" data-b="{f2(base)}" data-w="{f2(width)}">'
                f'<i class="b"></i>{"".join(parts)}</span>')

    def para_html(self, p, dx=0.0, dy=0.0, in_table=False):
        lines = ''.join(self.line_html(l, dx, dy) for l in p['lines'])
        if p['kind'] == 'h' and not in_table:
            lvl = self.heading_level.get(round(p['size'], 1), 3)
            return f'<h{lvl}>{lines}</h{lvl}>'
        if p['kind'] == 'li':
            return f'<li>{lines}</li>'
        return f'<p>{lines}</p>'

    def paras_html(self, paras, dx=0.0, dy=0.0, in_table=False):
        out, i = [], 0
        while i < len(paras):
            p = paras[i]
            if p['kind'] == 'li':
                group = []
                while i < len(paras) and paras[i]['kind'] == 'li':
                    group.append(paras[i])
                    i += 1
                first = group[0]['lines'][0]['runs'][0]['text'].strip()
                tag = 'ol' if re.match(r'^\(?[\divxIVXa-zA-Z]{1,4}[.)]', first) and not first[:1] in '-*' and not len(first) == 1 else 'ul'
                out.append(f'<{tag}>' + ''.join(self.para_html(g, dx, dy) for g in group) + f'</{tag}>')
                continue
            out.append(self.para_html(p, dx, dy, in_table))
            i += 1
        return ''.join(out)

    def table_html(self, t):
        xs, ys = t['xs'], t['ys']
        x0, y0 = xs[0], ys[0]
        cols = ''.join(f'<col style="width:{f2(xs[i + 1] - xs[i])}pt">' for i in range(len(xs) - 1))
        by_start = {}
        covered = set()
        for c in t['cells']:
            by_start[(c['row'], c['col'])] = c
            for r in range(c['row'], c['row'] + c['rowspan']):
                for k in range(c['col'], c['col'] + c['colspan']):
                    covered.add((r, k))
        rows = []
        for r in range(len(ys) - 1):
            tds = []
            for k in range(len(xs) - 1):
                c = by_start.get((r, k))
                if c is None:
                    if (r, k) not in covered:
                        tds.append('<td></td>')
                    continue
                st = []
                span = (f' rowspan="{c["rowspan"]}"' if c['rowspan'] > 1 else '') + (f' colspan="{c["colspan"]}"' if c['colspan'] > 1 else '')
                cb = c['bbox']
                inner = self.paras_html(c.get('paras') or [], cb.x0, cb.y0, in_table=True)
                tag = 'th' if r == 0 and all(rr.get('bold') for p in c.get('paras') or [] for l in p['lines'] for rr in l['runs']) and c.get('paras') else 'td'
                tds.append(f'<{tag}{span}{" style=" + chr(34) + ";".join(st) + chr(34) if st else ""}><div class="c">{inner}</div></{tag}>')
            rows.append(f'<tr style="height:{f2(ys[r + 1] - ys[r])}pt">{"".join(tds)}</tr>')
        return (f'<table class="t" style="position:absolute;left:{f2(x0)}pt;top:{f2(y0)}pt;width:{f2(xs[-1] - x0)}pt;height:{f2(ys[-1] - y0)}pt">'
                f'<colgroup>{cols}</colgroup>{"".join(rows)}</table>')

    def page_html(self, pg):
        """One page: every layer in the PDF's own coordinates (points from the page's top-left
        corner, after the crop box and rotation are applied) and in the PDF's drawing order."""
        n = pg['n'] + 1
        W, H = pg['w'], pg['h']
        box = lambda b: f'position:absolute;left:{f2(b.x0)}pt;top:{f2(b.y0)}pt;width:{f2(b.width)}pt;height:{f2(b.height)}pt'
        parts = []
        for i, r in enumerate(pg['rasters']):  # scans and uncaptured areas: at the bottom
            src = self.asset('images', f'page{n}-{r["kind"]}{i + 1}.{r["ext"]}', r['data'])
            alt = 'Scanned page' if r['kind'] == 'scan' else ''
            parts.append(f'<img class="r" src="{src}" alt="{alt}" style="{box(r["bbox"])}">')
        layers = [(d.get('seqno', 0), 0, d) for d in pg.get('all_vectors', pg['vectors'])]
        layers += [(im.get('seq', 10 ** 6), 1, im) for im in pg['images']]
        layers.sort(key=lambda t: (t[0], t[1]))
        svg_open = (f'<svg class="v" viewBox="0 0 {f2(W)} {f2(H)}" width="{f2(W)}pt" height="{f2(H)}pt" '
                    f'style="position:absolute;left:0;top:0;width:{f2(W)}pt;height:{f2(H)}pt;overflow:visible" aria-hidden="true">')
        group, k = [], 0
        for _, kind, item in layers:
            if kind == 0:
                group.append(svg_path(item))
                continue
            if group:
                parts.append(svg_open + ''.join(group) + '</svg>')
                group = []
            k += 1
            src = self.asset('images', f'page{n}-image{k}.{item["ext"]}', item['data'])
            parts.append(f'<img class="i" src="{src}" alt="Picture {k} on page {n}" width="{item["px"][0]}" height="{item["px"][1]}" style="{box(item["bbox"])}">')
        if group:
            parts.append(svg_open + ''.join(group) + '</svg>')
        for t in pg['tables']:
            parts.append(self.table_html(t))
        if pg['header']:
            parts.append('<header>' + ''.join(self.paras_html(b['paras']) for b in pg['header']) + '</header>')
        for b in pg['blocks']:
            parts.append(self.paras_html(b['paras']))
        if pg['footer']:
            parts.append('<footer>' + ''.join(self.paras_html(b['paras']) for b in pg['footer']) + '</footer>')
        return (f'<section class="page" id="page-{n}" aria-label="Page {n}" '
                f'style="position:relative;overflow:hidden;width:{f2(W)}pt;height:{f2(H)}pt">'
                + '\n'.join(parts) + '</section>')

    def build(self):
        body = '\n'.join(self.page_html(pg) for pg in self.pages)
        faces = ''.join(f"@font-face{{font-family:'{fam}';src:url({path}) format('{'truetype' if ext == 'ttf' else 'opentype'}');font-display:block}}\n"
                        for fam, path, ext in self.font_css.values())
        first = self.pages[0] if self.pages else {'w': 595, 'h': 842}
        css = (faces + """html{-webkit-text-size-adjust:100%}
body{margin:0;background:#e9e9ec;font-synthesis:none}
.doc{padding:16px 0}
.page{position:relative;overflow:hidden;margin:0 auto 16px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25)}
.page>*{position:absolute}
.page header,.page footer,.page p,.page h1,.page h2,.page h3,.page h4,.page h5,.page h6,.page ul,.page ol,.page li{position:static;margin:0;padding:0;font-size:inherit;font-weight:inherit;list-style:none}
.page .r,.page .i{display:block;max-width:none}
.page .v{left:0;top:0;width:100%;height:100%;overflow:visible}
.page .l{position:absolute;white-space:pre;font-size:0;transform-origin:0 0}
.page .l .b{display:inline-block;width:0;height:0;vertical-align:baseline}
.page a{color:inherit;text-decoration:none}
.page .t{border-collapse:collapse;table-layout:fixed;border-spacing:0}
.page .t td,.page .t th{position:relative;padding:0;vertical-align:top;font-weight:inherit;text-align:left}
.page .t .c{position:absolute;inset:0;overflow:visible}
@media print{body{background:none}.doc{padding:0}.page{margin:0;box-shadow:none;break-after:page;zoom:1!important}}
""" + f'@page{{size:{f2(first["w"])}pt {f2(first["h"])}pt;margin:0}}\n')

        script = """<script>
(function(){
  function fit(){
    document.querySelectorAll('.page').forEach(function(pg){pg.style.zoom='';});
    var pt=96/72;
    document.querySelectorAll('.l[data-b]').forEach(function(l){
      l.style.transform='';
      var host=l.offsetParent; if(!host) return;
      var hr=host.getBoundingClientRect(), m=l.querySelector('.b'), w=parseFloat(l.dataset.w)*pt;
      var base=m.getBoundingClientRect().top-hr.top, want=parseFloat(l.dataset.b)*pt;
      var top=parseFloat(l.style.top)*pt+(want-base);
      l.style.top=(top/pt).toFixed(2)+'pt';
      var have=l.getBoundingClientRect().width;
      if(w>0&&have>0&&Math.abs(have-w)>0.5) l.style.transform='scaleX('+(w/have).toFixed(4)+')';
    });
    scale();
  }
  function scale(){
    var avail=document.documentElement.clientWidth-16;
    document.querySelectorAll('.page').forEach(function(pg){
      var w=parseFloat(pg.style.width)*96/72; pg.style.zoom=w>avail?(avail/w).toFixed(4):'';
    });
  }
  (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(fit);
  window.addEventListener('resize',scale);
})();
</script>"""
        doc = (f'<!DOCTYPE html>\n<html lang="{self.lang}">\n<head>\n<meta charset="utf-8">\n'
               '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
               f'<title>{ESC(self.title)}</title>\n<meta name="generator" content="PDF to HTML">\n'
               f'<style>\n{css}</style>\n</head>\n<body>\n<main class="doc">\n'
               f'{body}\n</main>\n{script}\n</body>\n</html>\n')
        self.files['index.html'] = doc.encode('utf-8')
        return self.files


def write(pages, fonts, title, dst):
    """One self-contained .html file: styles, pictures and fonts are inside it."""
    files = Writer(pages, fonts, title).build()
    with open(dst, 'wb') as f:
        f.write(files['index.html'])
    return files
