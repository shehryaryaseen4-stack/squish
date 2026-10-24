"""Compares rendered HTML pages with the PDF pages they came from.

    pdf2docx-python test/fixtures/visual_compare.py <in.pdf> <shot-1.png> [<shot-2.png> ...]

Each screenshot is one HTML page at 96 px per inch (1 CSS pt = 4/3 px), the PDF page is
rendered at the same scale. Prints one JSON line per page:
  size_ok       the HTML page has the PDF page's size (within 2 px)
  diff_pct      share of pixels that differ clearly (after a 1 px blur, so anti-aliasing and
                tiny font differences do not count)
  worst_block   the largest average difference in any 32 x 32 px block (sensitive: a 1 px shift
                of large bold text already counts)
  layout        the largest difference between the two pages shrunk 8 times (area average):
                letters vanish into grey, but a shifted panel, a missing picture or a block of
                text in the wrong place stands out
  layout_bad_pct  share of those shrunk cells that differ clearly (> 48): the main pass/fail
                number for the page composition
"""
import json
import sys
import warnings

warnings.filterwarnings('ignore')
import cv2  # noqa: E402
import numpy as np  # noqa: E402
import pymupdf as fitz  # noqa: E402

doc = fitz.open(sys.argv[1])
for n, shot in enumerate(sys.argv[2:]):
    pix = doc[n].get_pixmap(dpi=96, alpha=False, colorspace=fitz.csRGB)
    a = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 3)[:, :, ::-1].astype(np.int16)
    b = cv2.imread(shot).astype(np.int16)
    size_ok = abs(a.shape[0] - b.shape[0]) <= 2 and abs(a.shape[1] - b.shape[1]) <= 2
    b = cv2.resize(b.astype(np.uint8), (a.shape[1], a.shape[0]), interpolation=cv2.INTER_AREA).astype(np.int16)
    ga = cv2.GaussianBlur(a.astype(np.uint8), (3, 3), 0).astype(np.int16)
    gb = cv2.GaussianBlur(b.astype(np.uint8), (3, 3), 0).astype(np.int16)
    d = np.abs(ga - gb).max(axis=2)
    diff_pct = float((d > 64).mean() * 100)
    h, w = d.shape
    blocks = [d[y:y + 32, x:x + 32].mean() for y in range(0, h - 31, 16) for x in range(0, w - 31, 16)]
    worst = float(max(blocks)) if blocks else 0.0
    sa = cv2.resize(a.astype(np.uint8), (max(1, w // 8), max(1, h // 8)), interpolation=cv2.INTER_AREA).astype(np.int16)
    sb = cv2.resize(b.astype(np.uint8), (max(1, w // 8), max(1, h // 8)), interpolation=cv2.INTER_AREA).astype(np.int16)
    cells = np.abs(sa - sb).max(axis=2)
    layout = float(cells.max())
    layout_bad = float((cells > 48).mean() * 100)
    print(json.dumps({'page': n + 1, 'size_ok': size_ok, 'pdf_px': [a.shape[1], a.shape[0]], 'html_px': [int(b.shape[1]), int(b.shape[0])],
                      'diff_pct': round(diff_pct, 2), 'worst_block': round(worst, 1),
                      'layout': round(layout, 1), 'layout_bad_pct': round(layout_bad, 2)}))
    cv2.imwrite(shot.replace('.png', '-diff.png'), np.hstack([a, b, np.dstack([d] * 3)]).astype(np.uint8))
