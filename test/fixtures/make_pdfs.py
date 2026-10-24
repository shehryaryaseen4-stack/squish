"""Builds the PDF test set for the PDF to HTML / Word tests (PyMuPDF only, no other tools).

    pdf2docx-python test/fixtures/make_pdfs.py <out dir>

  simple.pdf     paragraphs and a link
  styles.pdf     headings, sizes, bold, italic, colours, a bullet list
  images.pdf     two embedded pictures (one photo-like, one with transparency)
  tables.pdf     a ruled table with a coloured header row
  multipage.pdf  three pages with a repeated header and a "Page N of 3" footer
  scanned.pdf    styles.pdf as a picture only (needs OCR)
  mixed.pdf      a text page followed by a scanned page
  columns.pdf    two columns of text
  rotated.pdf    a landscape (rotated) page and a line of vertical text
  unicode.pdf    accented Latin, Greek and Cyrillic text
  locked.pdf     simple.pdf with a password
  resume.pdf     a designed page like a Canva resume: dark sidebar with white text, a round
                 (clipped) photo with a ring drawn over it, a band drawn over a picture, and a
                 crop box that is not at the page origin
"""
import os
import sys

import numpy as np
import pymupdf as fitz

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(OUT, exist_ok=True)
A4 = fitz.paper_rect('a4')
CSS = 'body{font-family:sans-serif;font-size:11pt;color:#222} h1{font-size:22pt;color:#1d4ed8} h2{font-size:15pt} p{margin:0 0 8pt 0}'
LOREM = ('Converting documents should keep the words, the layout and the look of the original. This paragraph is long enough '
         'to wrap over several lines, so that line breaks, spacing and alignment can be checked in the converted file.')


def story_pdf(name, html, pages_hint=1, rects=None, css=CSS):
    path = os.path.join(OUT, name)
    story = fitz.Story(html=html, user_css=css)
    writer = fitz.DocumentWriter(path)
    rects = rects or [A4 + (54, 54, -54, -54)]
    more, i = True, 0
    while more:
        dev = writer.begin_page(A4)
        more, _ = story.place(rects[i % len(rects)])
        story.draw(dev)
        while more and len(rects) > 1 and (i + 1) % len(rects):
            i += 1
            more, _ = story.place(rects[i % len(rects)])
            story.draw(dev)
        writer.end_page()
        i += 1
    writer.close()
    return path


def photo(w, h, alpha=False):
    y, x = np.mgrid[0:h, 0:w]
    img = np.zeros((h, w, 4 if alpha else 3), np.uint8)
    img[..., 0] = (x * 255 / w).astype(np.uint8)
    img[..., 1] = (y * 255 / h).astype(np.uint8)
    img[..., 2] = ((x + y) % 97 * 2).astype(np.uint8)
    if alpha:
        r = ((x - w / 2) ** 2 + (y - h / 2) ** 2) ** 0.5
        img[..., 3] = np.where(r < min(w, h) / 2, 255, 0).astype(np.uint8)
    pix = fitz.Pixmap(fitz.csRGB, w, h, img.tobytes(), alpha)
    return pix


def simple():
    path = os.path.join(OUT, 'simple.pdf')
    story = fitz.Story(html=f'<h1>Simple document</h1><p>{LOREM}</p><p>Second paragraph with a link to '
                            '<a href="https://example.com/">example.com</a> in the middle of it.</p>', user_css=CSS)
    story.write_with_links(lambda n, filled: (A4, A4 + (54, 54, -54, -54), None)).save(path)
    return path


def styles():
    return story_pdf('styles.pdf', '<h1>Quarterly Sales Report</h1><h2>Prepared for Acme Incorporated</h2>'
                     f'<p>{LOREM}</p><p>This sentence has <b>bold words</b>, <i>italic words</i> and '
                     '<span style="color:#c00000">red words</span> in it.</p>'
                     '<ul><li>First point of the list</li><li>Second point of the list</li><li>Third point of the list</li></ul>'
                     '<p style="font-size:18pt;color:#0a7d32">Large green line</p>')


def images():
    doc = fitz.open()
    page = doc.new_page(width=A4.width, height=A4.height)
    page.insert_text((54, 80), 'Pictures in a document', fontsize=20, fontname='hebo')
    page.insert_image(fitz.Rect(54, 110, 314, 280), pixmap=photo(520, 340))
    page.insert_image(fitz.Rect(340, 110, 500, 270), pixmap=photo(200, 200, alpha=True))
    page.insert_text((54, 310), 'A photo on the left and a round picture on the right.', fontsize=11)
    path = os.path.join(OUT, 'images.pdf')
    doc.save(path)
    return path


def tables():
    rows = ''.join(f'<tr><td>Item {i}</td><td>{i * 3}</td><td>{i * 12.5:.2f}</td></tr>' for i in range(1, 5))
    return story_pdf('tables.pdf', '<h2>Price list</h2><table><tr><th>Product</th><th>Qty</th><th>Price</th></tr>' + rows + '</table>',
                     css=CSS + ' table{border-collapse:collapse} th{background:#1d4ed8;color:#fff} th,td{border:1px solid #444;padding:4pt 8pt}')


def multipage():
    path = story_pdf('multipage.pdf', '<h1>Long report</h1>' + ''.join(f'<h2>Section {i}</h2><p>{LOREM} {LOREM}</p>' for i in range(1, 13)),
                     rects=[A4 + (54, 80, -54, -80)])
    doc = fitz.open(path)
    n = doc.page_count
    for i, page in enumerate(doc):
        page.insert_text((54, 50), 'ACME Corporation - Annual report', fontsize=9, color=(0.4, 0.4, 0.4))
        page.draw_line((54, 58), (A4.width - 54, 58), color=(0.6, 0.6, 0.6), width=0.5)
        page.insert_text((A4.width / 2 - 25, A4.height - 40), f'Page {i + 1} of {n}', fontsize=9, color=(0.4, 0.4, 0.4))
    doc.saveIncr()
    return path


def scanned(src, name, pages=None):
    s = fitz.open(src)
    out = fitz.open()
    for i, p in enumerate(s):
        if pages is not None and i not in pages:
            out.insert_pdf(s, from_page=i, to_page=i)
            continue
        pix = p.get_pixmap(dpi=200)
        np_ = out.new_page(width=p.rect.width, height=p.rect.height)
        np_.insert_image(np_.rect, stream=pix.tobytes('jpeg'))
    path = os.path.join(OUT, name)
    out.save(path)
    return path


def mixed():
    a = fitz.open(simple_path)
    b = fitz.open(scanned_path)
    a.insert_pdf(b)
    path = os.path.join(OUT, 'mixed.pdf')
    a.save(path)
    return path


def columns():
    w = (A4.width - 108 - 24) / 2
    return story_pdf('columns.pdf', '<h2>Two columns</h2>' + ''.join(f'<p>{LOREM}</p>' for _ in range(8)),
                     rects=[fitz.Rect(54, 54, 54 + w, A4.height - 54), fitz.Rect(54 + w + 24, 54, A4.width - 54, A4.height - 54)])


def rotated():
    doc = fitz.open()
    page = doc.new_page(width=A4.width, height=A4.height)
    page.insert_text((60, 100), 'This page is shown in landscape.', fontsize=16)
    page.insert_text((60, 130), 'Its text must still read left to right.', fontsize=12)
    page.insert_text((40, 700), 'Vertical label', fontsize=12, rotate=90)
    page.set_rotation(90)
    path = os.path.join(OUT, 'rotated.pdf')
    doc.save(path)
    return path


def unicode():
    return story_pdf('unicode.pdf', '<h2>Languages</h2><p>Español: ¿Dónde está la estación? Mañana.</p>'
                     '<p>Français: Où est la bibliothèque ? Très bien, merci.</p><p>Deutsch: Größe, Straße, Übung.</p>'
                     '<p>Ελληνικά: Καλημέρα κόσμε.</p><p>Русский: Привет, мир.</p>')


def circle(cx, cy, r):
    k = 0.5523 * r
    return (f'{cx + r} {cy} m {cx + r} {cy + k} {cx + k} {cy + r} {cx} {cy + r} c {cx - k} {cy + r} {cx - r} {cy + k} {cx - r} {cy} c '
            f'{cx - r} {cy - k} {cx - k} {cy - r} {cx} {cy - r} c {cx + k} {cy - r} {cx + r} {cy - k} {cx + r} {cy} c')


def resume():
    doc = fitz.open()
    W, H = 612, 860  # media box; the crop box below shows 595 x 842 of it, offset from the origin
    page = doc.new_page(width=W, height=H)
    page.insert_image(fitz.Rect(0, 0, 10, 10), pixmap=photo(300, 300))
    page.insert_image(fitz.Rect(0, 0, 10, 10), pixmap=photo(400, 200))
    names = [img[7] for img in page.get_images(full=True)]
    page.clean_contents()
    ox, oy = 9, 8  # crop box origin (PDF units, from the bottom-left)
    content = (
        # sidebar panel and main background band
        f'q 0.118 0.165 0.267 rg {ox} {oy} 200 842 re f Q '
        # round photo: clip to a circle, then paint the picture
        f'q {circle(ox + 100, oy + 842 - 110, 60)} W n 120 0 0 120 {ox + 40} {oy + 842 - 170} cm /{names[0]} Do Q '
        # a ring drawn over the photo (must stay above it)
        f'q 1 1 1 RG 4 w {circle(ox + 100, oy + 842 - 110, 60)} S Q '
        # a picture in the main area with a coloured band painted over its lower part
        f'q 300 0 0 150 {ox + 250} {oy + 842 - 420} cm /{names[1]} Do Q '
        f'q 0.9 0.2 0.18 rg {ox + 250} {oy + 842 - 420} 300 40 re f Q '
    )
    doc.update_stream(page.get_contents()[0], content.encode())
    page.set_cropbox(fitz.Rect(ox, H - oy - 842, ox + 595, H - oy))
    white, dark = (1, 1, 1), (0.12, 0.16, 0.27)
    page.insert_text((30, 230), 'CONTACT', fontsize=12, fontname='hebo', color=white)
    for i, t in enumerate(['0300-1234567', 'name@example.com', 'Lahore, Pakistan']):
        page.insert_text((30, 255 + i * 16), t, fontsize=10, color=white)
    page.insert_text((30, 330), 'SKILLS', fontsize=12, fontname='hebo', color=white)
    for i, t in enumerate(['Architectural design', '3D visualization', 'Space planning']):
        page.insert_text((30, 355 + i * 16), '\u2022  ' + t, fontsize=10, color=white)
    page.insert_text((240, 100), 'MUNEEB MIRZA', fontsize=30, fontname='hebo', color=dark)
    page.insert_text((240, 128), 'Architect | Architectural Designer', fontsize=14, color=dark)
    page.insert_text((240, 190), 'PROFILE', fontsize=13, fontname='hebo', color=dark)
    page.insert_text((262, 405), 'Text over the red band', fontsize=12, fontname='hebo', color=white)
    for i, t in enumerate(['Motivated and creative designer with a bachelor of architecture',
                           'and three years of freelance work for clients worldwide.']):
        page.insert_text((240, 212 + i * 15), t, fontsize=10, color=(0.2, 0.2, 0.2))
    path = os.path.join(OUT, 'resume.pdf')
    doc.save(path)
    return path


simple_path = simple()
styles_path = styles()
images()
tables()
multipage()
scanned_path = scanned(styles_path, 'scanned.pdf')
mixed()
columns()
rotated()
unicode()
resume()
fitz.open(simple_path).save(os.path.join(OUT, 'locked.pdf'), encryption=fitz.PDF_ENCRYPT_AES_256, user_pw='secret', owner_pw='owner')
print('ok')
