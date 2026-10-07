# PDFKaro PDF tools with every server-side engine installed.
# Browser-side tools need nothing here; the engines below power the server tools
# (Office conversions, compression, passwords, OCR, repair, image extraction).
FROM node:22-bookworm-slim AS node

FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Office <-> PDF (headless LibreOffice; draw provides the PDF import used by PDF to PowerPoint)
    libreoffice-core-nogui libreoffice-writer-nogui libreoffice-calc-nogui libreoffice-impress-nogui libreoffice-draw-nogui \
    # compress / reduce / repair, passwords and restrictions, image extraction
    ghostscript qpdf poppler-utils \
    # OCR (add more tesseract-ocr-<lang> packages for more languages)
    ocrmypdf tesseract-ocr tesseract-ocr-eng tesseract-ocr-deu tesseract-ocr-fra tesseract-ocr-spa tesseract-ocr-ita \
    tesseract-ocr-por tesseract-ocr-nld tesseract-ocr-pol tesseract-ocr-tur tesseract-ocr-rus tesseract-ocr-ara \
    tesseract-ocr-hin tesseract-ocr-urd tesseract-ocr-chi-sim tesseract-ocr-jpn tesseract-ocr-kor \
    # PDF to Word / Excel helpers
    python3 python3-venv \
    # fonts for faithful document rendering
    fontconfig fonts-dejavu-core fonts-liberation2 fonts-crosextra-carlito fonts-crosextra-caladea fonts-noto-core \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/py && /opt/py/bin/pip install --no-cache-dir pdf2docx pdfplumber openpyxl
ENV PYTHON=/opt/py/bin/python

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && node -e "for (const m of ['express','multer','pdf-lib','pdfjs-dist/package.json','jszip','helmet','@pdf-lib/fontkit']) require.resolve(m); console.log('dependencies ok')"
COPY . .

# Jobs run as an unprivileged user; uploads live in private folders under /tmp and are
# deleted after every request.
RUN useradd --create-home --shell /usr/sbin/nologin pdfkaro
USER pdfkaro
ENV PORT=3000 NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
