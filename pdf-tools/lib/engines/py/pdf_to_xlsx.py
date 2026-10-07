"""PDF -> XLSX: every table pdfplumber finds becomes rows in a worksheet.

Pages without a detectable table contribute their text lines (one line per row, split into
cells on runs of 2+ spaces) so nothing is silently dropped.

Usage: pdf_to_xlsx.py <input.pdf> <output.xlsx> <page|single>
Exit codes: 0 ok, 3 password-protected, 4 unreadable, 5 no text at all (scanned PDF).
"""
import re
import sys


def number_or_text(value):
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    # "1,234.50" / "-12" / "45%" stay text unless they are plain numbers, so nothing is misread.
    if re.fullmatch(r"-?\d{1,15}(\.\d+)?", text):
        try:
            return int(text) if "." not in text else float(text)
        except ValueError:
            return text
    if re.fullmatch(r"-?\d{1,3}(,\d{3})+(\.\d+)?", text):
        return float(text.replace(",", ""))
    return text


def clean(value):
    if value is None:
        return None
    # openpyxl rejects control characters
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(value))


def main():
    src, dest, layout = sys.argv[1], sys.argv[2], sys.argv[3]
    import pdfplumber
    from openpyxl import Workbook
    from openpyxl.styles import Font
    from openpyxl.utils import get_column_letter

    try:
        pdf = pdfplumber.open(src)
    except Exception as exc:  # pdfminer raises PDFPasswordIncorrect for encrypted files
        if "password" in type(exc).__name__.lower() or "encrypt" in str(exc).lower():
            sys.exit(3)
        sys.exit(4)

    wb = Workbook()
    wb.remove(wb.active)
    sheet = None
    any_text = False
    widths = {}

    def add_row(ws, values, bold=False):
        cells = [number_or_text(v) for v in values]
        ws.append([c if isinstance(c, (int, float)) else clean(c) for c in cells])
        row = ws.max_row
        for i, v in enumerate(values, start=1):
            if v is not None:
                key = (ws.title, i)
                widths[key] = max(widths.get(key, 0), min(60, len(str(v))))
            if bold:
                ws.cell(row=row, column=i).font = Font(bold=True)

    with pdf:
        for number, page in enumerate(pdf.pages, start=1):
            if layout == "page" or sheet is None:
                sheet = wb.create_sheet(f"Page {number}" if layout == "page" else "PDF")
            tables = page.extract_tables() or []
            tables = [t for t in tables if t and any(any(c for c in row) for row in t)]
            if layout == "single" and number > 1:
                sheet.append([])
                add_row(sheet, [f"Page {number}"], bold=True)
            if tables:
                any_text = True
                for index, table in enumerate(tables):
                    if index:
                        sheet.append([])
                    for r, row in enumerate(table):
                        add_row(sheet, [None if c is None else str(c).replace("\n", " ") for c in row], bold=(r == 0))
            else:
                text = page.extract_text() or ""
                for line in text.splitlines():
                    if line.strip():
                        any_text = True
                        add_row(sheet, re.split(r"\s{2,}", line.strip()))

    if not any_text:
        sys.exit(5)
    for ws in wb.worksheets:
        for (title, col), width in widths.items():
            if title == ws.title:
                ws.column_dimensions[get_column_letter(col)].width = max(8, width + 2)
    wb.save(dest)


if __name__ == "__main__":
    main()
