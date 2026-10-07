"""PDF -> DOCX with pdf2docx (layout reconstruction: paragraphs, tables, images).

Usage: pdf_to_docx.py <input.pdf> <output.docx>
Exit codes: 0 ok, 3 password-protected, 4 no pages / unreadable.
"""
import logging
import sys

logging.disable(logging.CRITICAL)  # pdf2docx logs every page at INFO level


def main():
    src, dest = sys.argv[1], sys.argv[2]
    import pymupdf  # installed with pdf2docx

    try:
        doc = pymupdf.open(src)
    except Exception:
        sys.exit(4)
    if doc.needs_pass:
        sys.exit(3)
    if doc.page_count == 0:
        sys.exit(4)
    doc.close()

    from pdf2docx import Converter

    cv = Converter(src)
    try:
        cv.convert(dest, multi_processing=False)
    finally:
        cv.close()


if __name__ == "__main__":
    main()
