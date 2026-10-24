"""PDF -> DOCX with pdf2docx (keeps tables, fonts, colours and images in place).
Usage: pdf2docx_run.py input.pdf output.docx [password]
Exit code 3: the PDF needs a password."""
import sys, logging, warnings
warnings.filterwarnings("ignore")
logging.disable(logging.CRITICAL)
from pdf2docx import Converter

src, dst = sys.argv[1], sys.argv[2]
try:
    cv = Converter(src, password=sys.argv[3] if len(sys.argv) > 3 else None)
except Exception as e:  # damaged or encrypted
    print(str(e), file=sys.stderr)
    sys.exit(3 if "password" in str(e).lower() or "encrypt" in str(e).lower() else 2)
try:
    cv.convert(dst, multi_processing=False)
finally:
    cv.close()
