"""The text of a PDF, read with the same document model as PDF to Word (model.py), for the PDF
intelligence tools: PDF to Markdown, the AI summarizer and chat, and Translate PDF.

    pdf2docx-python engines/pdfx/text.py md    <in.pdf> <out.json> <text|ocr> [lang]
    pdf2docx-python engines/pdfx/text.py plan  <in.pdf> <work dir> <text|ocr> [lang]
    pdf2docx-python engines/pdfx/text.py apply <work dir> <translations.json> <out.pdf> [rtl]

  md     Markdown for each page, in reading order: headings (#, ## ... by size), paragraphs with
         bold, italic and links, bullet and numbered lists, and ruled tables as Markdown tables.
         Repeated page headers and footers are left out. -> {"title", "pages": [md, ...], report}
  plan   the paragraphs to translate (work/plan.json: id, text, box and style of each) and the PDF
         they go back into (work/base.pdf: the original pages with that text removed and every
         picture, drawing and colour kept; scanned pages are their scan with the words painted out)
  apply  writes each translated paragraph into its box in base.pdf, in the paragraph's size,
         colour, weight and alignment; text that runs longer than the original is set smaller
         so it stays inside its box. translations.json: {"<id>": "text", ...}

Prints one JSON line (the report). Exit codes as run.py: 2 damaged, 3 password-protected,
5 no pages, 6 nothing readable (scanned and no OCR).
"""
import html
import json
import os
import re
import sys
import warnings

warnings.filterwarnings('ignore')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pymupdf as fitz  # noqa: E402

import model  # noqa: E402

ORDERED_NUM = re.compile(r'^\(?(\d{1,3}|[a-zA-Z]|[ivxIVX]{1,4})[.)]\s*')
SERIF = re.compile(r'times|serif|georgia|garamond|roman|cambria|book|minion|caslon|baskerville|palatino', re.I)
MONO = re.compile(r'courier|mono|consol|menlo|code', re.I)


def open_pdf(src):
    try:
        pdf = fitz.open(src)
    except Exception:
        sys.exit(2)
    if pdf.needs_pass:
        sys.exit(3)
    if pdf.page_count == 0:
        sys.exit(5)
    return pdf


def read(src, mode, lang, work):
    pdf = open_pdf(src)
    report = {'pages': pdf.page_count, 'mode': mode, 'warnings': [], 'scanned_no_ocr': [], 'ocr_pages': [], 'text_layer_pages': []}
    pages, fonts = model.analyze(pdf, mode, lang, work, report)
    chars = sum(len(l['text'].strip()) for pg in pages for b in pg['blocks'] for p in b['paras'] for l in p['lines'])
    chars += sum(len(l['text'].strip()) for pg in pages for t in pg['tables'] for c in t['cells'] for l in c['lines'])
    report['characters'] = chars
    if chars == 0 and report['scanned_no_ocr'] and len(report['scanned_no_ocr']) == pdf.page_count:
        print(json.dumps(report))
        sys.exit(6)
    return pdf, pages, fonts, report


def reading_order(pages, fonts):
    """Each page's paragraphs and tables in the order a reader takes them: bands top to bottom,
    columns left to right (the same XY cut PDF to Word lays the page out with)."""
    import docx_out
    w = docx_out.Writer(pages, fonts, {})
    out = []
    for pg in pages:
        rotated = []
        items = w.items(pg['blocks'], pg['tables'], rotated)
        flat = []

        def walk(node):
            for e in node[1]:
                if isinstance(e, tuple) and e[0] == 'cols':
                    for _, _, sub in e[1]:
                        walk(sub)
                elif isinstance(e, tuple):
                    walk(e)
                else:
                    flat.append(e)
        walk(w.cut(items, 0, pg['w']))
        out.append(flat)
    return out


# ------------------------------------------------------------------------------------ markdown --
def esc(t):
    return re.sub(r'([\\`*_\[\]<>|])', r'\\\1', t)


def para_text(p, md=True):
    """A paragraph's text with its lines joined (a word broken with a hyphen at a line end is
    joined again); md: with **bold**, *italic* and [links](url)."""
    pieces = []  # (text, bold, italic, link)
    for i, ln in enumerate(p['lines']):
        runs = [dict(r) for r in ln['runs']]
        if i:
            prev = pieces[-1][0] if pieces else ''
            first = runs[0]['text'].lstrip()
            if prev.endswith('-') and not prev.endswith(' -') and first[:1].islower():
                pieces[-1] = (prev[:-1],) + pieces[-1][1:]
                runs[0]['text'] = first
            elif not prev.endswith(' '):
                pieces.append((' ', False, False, None))
        for r in runs:
            pieces.append((r['text'], md and r.get('bold', False), md and r.get('italic', False), md and r.get('link')))
    merged = []
    for t, b, it, lk in pieces:
        if merged and merged[-1][1:] == (b, it, lk):
            merged[-1] = (merged[-1][0] + t, b, it, lk)
        elif merged and not t.strip():
            merged[-1] = (merged[-1][0] + t,) + merged[-1][1:]
        else:
            merged.append((t, b, it, lk))
    out = []
    for t, b, it, lk in merged:
        t = re.sub(r'\s+', ' ', t)
        if not md:
            out.append(t)
            continue
        core = t.strip()
        if not core:
            out.append(t)
            continue
        lead, trail = t[:len(t) - len(t.lstrip())], t[len(t.rstrip()):]
        s = esc(core)
        if b and it:
            s = f'***{s}***'
        elif b:
            s = f'**{s}**'
        elif it:
            s = f'*{s}*'
        if lk and not lk.startswith('#'):
            s = f'[{s}]({lk.replace(")", "%29").replace(" ", "%20")})'
        out.append(lead + s + trail)
    return re.sub(r'\s+', ' ', ''.join(out)).strip()


def heading_levels(pages):
    sizes = sorted({round(p['size']) for pg in pages for b in pg['blocks'] for p in b['paras'] if p['kind'] == 'h'}, reverse=True)
    return {s: min(i + 1, 4) for i, s in enumerate(sizes)}


def para_md(p, levels):
    text = para_text(p)
    if not text:
        return ''
    if p['kind'] == 'h':
        plain = text.replace('**', '').replace('***', '')
        return '#' * levels.get(round(p['size']), 4) + ' ' + plain.strip('* ')
    if p['kind'] == 'li':
        raw = para_text(p, md=False)
        if model.is_bullet(raw):
            body = re.sub(r'^(\\?[^\w\s\\]|\\.)\s*', '', text, count=1)
            return '- ' + body.strip()
        m = ORDERED_NUM.match(raw)
        if m:
            num = m.group(1)
            body = text[len(esc(m.group(0)).rstrip()):].strip() if text.startswith(esc(m.group(0)).rstrip()) else text
            return f'{num}. {body}' if num.isdigit() else f'- {esc(m.group(0).strip())} {body}'
        return '- ' + text
    if re.match(r'^(#|>|[-+] |\d+[.)] )', text):
        text = '\\' + text
    return text


def table_md(t):
    xs, ys = t['xs'], t['ys']
    rows, cols = len(ys) - 1, len(xs) - 1
    if rows < 1 or cols < 1:
        return ''
    grid = [['' for _ in range(cols)] for _ in range(rows)]
    for c in t['cells']:
        txt = '<br>'.join(s for s in (para_text(p) for p in c.get('paras', [])) if s)
        if c['row'] < rows and c['col'] < cols:
            grid[c['row']][c['col']] = txt.replace('|', '\\|')
    lines = ['| ' + ' | '.join(grid[0]) + ' |', '|' + '|'.join(['---'] * cols) + '|']
    lines += ['| ' + ' | '.join(r) + ' |' for r in grid[1:]]
    return '\n'.join(lines)


def markdown(src, dst, mode, lang):
    work = os.path.dirname(os.path.abspath(dst))
    pdf, pages, fonts, report = read(src, mode, lang, work)
    levels = heading_levels(pages)
    out = []
    for pg, items in zip(pages, reading_order(pages, fonts)):
        parts = []
        prev_li = False
        for it in items:
            s = table_md(it['t']) if it['kind'] == 'table' else para_md(it['p'], levels)
            if not s:
                continue
            li = it['kind'] == 'para' and it['p']['kind'] == 'li'
            parts.append(('\n' if li and prev_li else '\n\n') + s if parts else s)
            prev_li = li
        out.append(''.join(parts))
    title = (pdf.metadata or {}).get('title') or ''
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump({'title': title, 'pages': out}, f, ensure_ascii=False)
    print(json.dumps(report))


# ----------------------------------------------------------------------------------- translate --
def style(p):
    runs = [r for l in p['lines'] for r in l['runs'] if r['text'].strip()]
    main = max(runs, key=lambda r: len(r['text'])) if runs else {}
    font = str(main.get('font') or '')
    c = main.get('color') or (0, 0, 0)
    return {'size': round(p['size'], 2), 'color': '#%02x%02x%02x' % tuple(c[:3]),
            'bold': bool(runs) and sum(len(r['text']) for r in runs if r.get('bold')) * 2 > sum(len(r['text']) for r in runs),
            'italic': bool(runs) and sum(len(r['text']) for r in runs if r.get('italic')) * 2 > sum(len(r['text']) for r in runs),
            'family': 'monospace' if MONO.search(font) else 'serif' if SERIF.search(font) else 'sans-serif',
            'align': p.get('align', 'left'), 'lh': round(p['step'] / p['size'], 3) if p.get('step') and p['size'] else 1.2}


def paper(pix, r):
    """The colour just around rectangle r on a page picture (the median of a thin frame)."""
    import numpy as np
    a = np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w, pix.n)[..., :3]
    x0, x1 = max(0, int(r.x0) - 2), min(pix.w, int(r.x1) + 3)
    y0, y1 = max(0, int(r.y0) - 3), min(pix.h, int(r.y1) + 3)
    ring = np.concatenate([a[y0:y0 + 2, x0:x1].reshape(-1, 3), a[max(y0, y1 - 2):y1, x0:x1].reshape(-1, 3),
                           a[y0:y1, x0:x0 + 2].reshape(-1, 3), a[y0:y1, max(x0, x1 - 2):x1].reshape(-1, 3)])
    if not len(ring):
        return (1, 1, 1)
    return tuple(float(v) / 255 for v in np.median(ring, axis=0))


def room(paras, obstacles, fills, w, h):
    """The box each translated paragraph may fill: a translation is often longer than the
    original, so a line may grow to the right (left for right-aligned text, both ways when
    centred) and a paragraph downwards, up to the next text, table or the page margin, and never
    out of the panel or picture it sits on (white text on a dark sidebar stays on the sidebar).
    Text in a table cell gets the cell."""
    margin = max(18, min((p['box'].x0 for p in paras), default=36))
    for p in paras:
        b = p['box']
        if p['cell'] is not None:
            c = fitz.Rect(p['cell'])
            p['box'] = fitz.Rect(c.x0 + 1.5, b.y0, c.x1 - 1.5, max(b.y1, c.y1 - 1))
            continue
        others = [o for o in obstacles if not (o.contains(b) or b.contains(o))]
        level = [o for o in others if o.y0 < b.y1 - 1 and o.y1 > b.y0 + 1]
        right = min([w - margin] + [o.x0 - 4 for o in level if o.x0 >= b.x1 - 1])
        left = max([margin] + [o.x1 + 4 for o in level if o.x1 <= b.x0 + 1])
        x0, x1 = b.x0, b.x1
        if p['lines'] == 1:
            if p['align'] == 'right':
                x0 = min(b.x0, left)
            elif p['align'] == 'center':
                d = max(0, min(b.x0 - left, right - b.x1))
                x0, x1 = b.x0 - d, b.x1 + d
            else:
                x1 = max(b.x1, right)
        below = [o.y0 for o in others if o.x0 < x1 - 1 and o.x1 > x0 + 1 and o.y0 >= b.y1 - 1]
        y1 = max(b.y1 + p['size'] * 0.35, min([h - 12] + [y - 1 for y in below]))
        on = [f for f in fills if f.x0 <= b.x0 + 1 and f.y0 <= b.y0 + 1 and f.x1 >= b.x1 - 1 and f.y1 >= b.y1 - 1]
        if on:
            f = min(on, key=lambda r: r.width * r.height)
            x0, x1 = min(b.x0, max(x0, f.x0 + 3)), max(b.x1, min(x1, f.x1 - 3))
            y1 = max(b.y1 + p['size'] * 0.2, min(y1, f.y1 - 1))
        p['box'] = fitz.Rect(x0, b.y0, x1, y1)


def plan(src, work, mode, lang):
    os.makedirs(work, exist_ok=True)
    pdf, pages, fonts, report = read(src, mode, lang, work)
    base = fitz.open()
    paras = []
    for pg in pages:
        n = pg['n']
        scan = pg['kind'] in ('scan', 'textlayer') and pg['rasters']
        if scan:
            page = base.new_page(width=pg['w'], height=pg['h'])
            page.insert_image(fitz.Rect(0, 0, pg['w'], pg['h']), stream=pg['rasters'][0]['data'])
            pix = page.get_pixmap(dpi=72)
        else:
            base.insert_pdf(pdf, from_page=n, to_page=n)
            page = base[-1]
        found = [(p, None) for blocks in (pg['blocks'], pg['header'], pg['footer']) for b in blocks for p in b['paras']]
        found += [(p, c['bbox']) for t in pg['tables'] for c in t['cells'] for p in c.get('paras', [])]
        start = len(paras)
        texts = [fitz.Rect(p['bbox']) for p, _ in found]  # every line of text, translated or not, is in the way
        for p, cell in found:
            lines = [l for l in p['lines'] if abs(l.get('angle', 0)) < 1]
            if len(lines) != len(p['lines']):
                continue  # rotated text stays as it is
            text = para_text(p, md=False)
            if not re.search(r'[^\W\d_]', text):
                continue  # numbers and symbols only: nothing to translate
            prefix = ''
            if p['kind'] == 'li':
                m = re.match(r'^(\S{1,4}\s+)', text) if model.is_bullet(text) else ORDERED_NUM.match(text)
                if m:
                    prefix, text = m.group(0), text[len(m.group(0)):]
            box = fitz.Rect(lines[0]['bbox'])
            for l in lines[1:]:
                box |= l['bbox']
            for l in lines:
                r = fitz.Rect(l['bbox'])
                if scan:
                    # on a scan, cover what is left of the words with the paper colour around them
                    page.draw_rect(r + (-1, -1, 1, 1), color=None, fill=paper(pix, r), overlay=True)
                else:
                    inset = r.height * 0.15
                    page.add_redact_annot(fitz.Rect(r.x0, r.y0 + inset, r.x1, r.y1 - inset))
            paras.append({'id': len(paras), 'page': n, 'text': text, 'prefix': prefix, 'box': box, 'cell': cell, 'lines': len(lines), **style(p)})
        fills = [fitz.Rect(d['rect']) for d in pg.get('all_vectors', []) if d.get('fill') is not None and (d.get('fill_opacity') or 0) > 0]
        fills += [fitz.Rect(i['bbox']) for i in pg['images']]
        fills = [r for r in fills if r.width * r.height < pg['w'] * pg['h'] * 0.85 and r.width > 20 and r.height > 8]
        room(paras[start:], texts + [fitz.Rect(t['bbox']) for t in pg['tables']], fills, pg['w'], pg['h'])
        if not scan:
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE, text=fitz.PDF_REDACT_TEXT_REMOVE)
    for p in paras:
        p['box'] = [round(v, 2) for v in p['box']]
        del p['cell']
    base.save(os.path.join(work, 'base.pdf'), garbage=3, deflate=True)
    with open(os.path.join(work, 'plan.json'), 'w', encoding='utf-8') as f:
        json.dump({'paras': paras}, f, ensure_ascii=False)
    report['paragraphs'] = len(paras)
    print(json.dumps(report))


def apply(work, translations, dst, rtl=False):
    with open(os.path.join(work, 'plan.json'), encoding='utf-8') as f:
        paras = json.load(f)['paras']
    with open(translations, encoding='utf-8') as f:
        tr = json.load(f)
    doc = fitz.open(os.path.join(work, 'base.pdf'))
    missing = 0
    for p in paras:
        text = tr.get(str(p['id']))
        if not text:
            missing += 1
            text = p['text']
        page = doc[p['page']]
        box = fitz.Rect(p['box'])
        align = p['align']
        css = (f"*{{margin:0;padding:0}} p{{font-family:{p['family']};font-size:{p['size']}pt;color:{p['color']};"
               f"line-height:{max(1.0, min(1.6, p['lh']))};text-align:{align};"
               f"font-weight:{'bold' if p['bold'] else 'normal'};font-style:{'italic' if p['italic'] else 'normal'}}}")
        body = html.escape(p['prefix'] + text.strip()).replace('\n', '<br>')
        page.insert_htmlbox(box, f'<p{" dir=rtl" if rtl else ""}>{body}</p>', css=css, scale_low=0)
    doc.subset_fonts()
    doc.save(dst, garbage=3, deflate=True)
    print(json.dumps({'paragraphs': len(paras), 'untranslated': missing}))


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'md':
        markdown(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else 'eng')
    elif cmd == 'plan':
        plan(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else 'eng')
    elif cmd == 'apply':
        apply(sys.argv[2], sys.argv[3], sys.argv[4], len(sys.argv) > 5 and sys.argv[5] == 'rtl')
    else:
        sys.exit('unknown command')
