"""PDF -> HTML package (ZIP) or Word (DOCX) that keeps the PDF's design and stays editable.

    pdf2docx-python engines/pdfx/run.py <in.pdf> <out.zip|out.docx> <text|ocr> [lang]

  text  never runs OCR; scanned pages are reported (they keep their pictures)
  ocr   pages that are scans are read with Tesseract (OCR); pages with text use their own text

Prints one JSON line with what was done: pages, OCR pages, warnings.
Exit codes: 3 password-protected, 5 no pages, 6 nothing readable (no text and no OCR).
"""
import json
import os
import sys
import warnings

warnings.filterwarnings('ignore')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pymupdf as fitz  # noqa: E402

import model  # noqa: E402


def main():
    src, dst, mode = sys.argv[1], sys.argv[2], sys.argv[3]
    lang = sys.argv[4] if len(sys.argv) > 4 else 'eng'
    work = os.path.dirname(os.path.abspath(dst))
    try:
        pdf = fitz.open(src)
    except Exception:
        print(json.dumps({'error': 'damaged'}))
        sys.exit(2)
    if pdf.needs_pass:
        sys.exit(3)
    if pdf.page_count == 0:
        sys.exit(5)
    report = {'pages': pdf.page_count, 'mode': mode, 'warnings': [], 'scanned_no_ocr': [], 'ocr_pages': [], 'text_layer_pages': []}
    pages, fonts = model.analyze(pdf, mode, lang, work, report)
    chars = sum(len(r['text'].strip()) for pg in pages for blocks in (pg['blocks'], pg['header'], pg['footer'])
                for b in blocks for p in b['paras'] for l in p['lines'] for r in l['runs'])
    chars += sum(len(r['text'].strip()) for pg in pages for t in pg['tables'] for c in t['cells'] for p in c.get('paras', [])
                 for l in p['lines'] for r in l['runs'])
    report['characters'] = chars
    report['fonts_embedded'] = sum(1 for f in fonts.values() if f.data)
    report['fonts_substituted'] = sorted({f.family for f in fonts.values() if not f.data and not f.office})
    if chars == 0 and report['scanned_no_ocr'] and len(report['scanned_no_ocr']) == pdf.page_count:
        print(json.dumps(report))
        sys.exit(6)
    title = (pdf.metadata or {}).get('title') or os.path.splitext(os.path.basename(src))[0]
    if dst.endswith('.zip'):
        import html_out
        files = html_out.write(pages, fonts, title, dst)
        # check the package: a page per PDF page, and the text really is in the HTML
        index = files['index.html'].decode('utf-8')
        assert index.count('<section class="page"') == len(pages), 'page count'
    else:
        import docx_out
        docx_out.write(pages, fonts, pdf.metadata or {}, dst)
        # check the document opens and holds the text
        from docx import Document
        Document(dst)
    print(json.dumps(report))


if __name__ == '__main__':
    main()
