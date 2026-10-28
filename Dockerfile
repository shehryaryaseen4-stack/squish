# FlipFree with every conversion engine installed.
# Ubuntu 24.04 is used because its package names are the ones the conversion tests were run
# against; Node comes from the official Node image. The result is large (~2 GB) because of
# LibreOffice and Calibre. To leave an engine out, delete its packages below: the site
# detects what is installed at startup and only offers those conversions.
FROM node:20-bookworm-slim AS node

FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
# UTF-8 file names everywhere (archives, office files, ebooks with accented or non-Latin names)
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8
RUN apt-get update && apt-get install -y --no-install-recommends \
    # audio + video
    ffmpeg \
    # office documents, spreadsheets, presentations (headless LibreOffice)
    libreoffice-core-nogui libreoffice-writer-nogui libreoffice-calc-nogui libreoffice-impress-nogui libreoffice-draw-nogui \
    # markup documents, ebooks
    pandoc calibre \
    # PDF, PostScript, vector graphics
    ghostscript poppler-utils inkscape \
    # PDF passwords and repair (Protect / Unlock / Repair PDF)
    qpdf \
    # text recognition (Image to Text, OCR PDF): English plus the main European languages
    tesseract-ocr tesseract-ocr-osd tesseract-ocr-eng tesseract-ocr-spa tesseract-ocr-fra tesseract-ocr-deu tesseract-ocr-ita tesseract-ocr-por tesseract-ocr-nld \
    # extra image formats (PSD, ICO, PPM, BMP/PSD/EPS output; HEIC/HEIF)
    imagemagick libheif-examples libheif-plugin-libde265 \
    # camera RAW photos (dcraw_emu), macOS icons (icns2png), XPS documents (mutool), EOT fonts (mkeot)
    libraw-bin icnsutils mupdf-tools eot-utils \
    # PDF to Word / HTML (engines/pdfx: PyMuPDF, OpenCV, python-docx, fontTools; installed below)
    python3 python3-venv \
    # archives (unar opens old solid RAR files that bsdtar cannot)
    libarchive-tools p7zip-full gzip bzip2 xz-utils lzip lzop ncompress unar \
    # DjVu
    djvulibre-bin \
    # fonts: text in share images and faithful office/PDF rendering
    fontconfig fonts-dejavu-core fonts-liberation2 fonts-crosextra-carlito fonts-crosextra-caladea \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Python tools for PDF to Word / HTML (engines/pdfx) in their own virtual environment; engines/pdfword.js
# calls it as pdf2docx-python. pdf2docx pins tested versions of PyMuPDF, OpenCV, python-docx and fontTools.
RUN python3 -m venv /opt/pdf2docx \
  && /opt/pdf2docx/bin/pip install --no-cache-dir pdf2docx==0.5.13 \
  && printf '#!/bin/sh\nexec /opt/pdf2docx/bin/python "$@"\n' > /usr/local/bin/pdf2docx-python \
  && chmod +x /usr/local/bin/pdf2docx-python \
  && pdf2docx-python -c "import cv2, docx, lxml, pymupdf, fontTools.ttLib; print('pdf tools ok')"

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

WORKDIR /app
# Background remover model (IS-Net general use, Apache-2.0, from the rembg project), checked against
# its known SHA-256 so a changed or broken download stops the build.
RUN mkdir -p models && node -e " \
  const want = '60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a'; \
  fetch('https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx').then(async (r) => { \
    if (!r.ok) throw new Error('model download: HTTP ' + r.status); \
    const b = Buffer.from(await r.arrayBuffer()); \
    const got = require('crypto').createHash('sha256').update(b).digest('hex'); \
    if (got !== want) throw new Error('model checksum mismatch: ' + got); \
    require('fs').writeFileSync('models/isnet-general-use.onnx', b); console.log('background model ok'); \
  }).catch((e) => { console.error(e.message); process.exit(1); });"
COPY package*.json ./
# ONNX Runtime (background remover) ships CPU binaries in the package; skip its optional GPU download
ENV ONNXRUNTIME_NODE_INSTALL=skip
# npm can occasionally crash yet still exit 0 ("Exit handler never called"), so prove the
# libraries the site needs are really there; otherwise the build stops here instead of
# shipping an image whose image conversions all fail.
RUN npm ci --omit=dev \
  && rm -rf node_modules/onnxruntime-node/bin/napi-v*/darwin node_modules/onnxruntime-node/bin/napi-v*/win32 \
  && node -e "require('onnxruntime-node')" \
  && node -e "for (const m of ['express','multer','sharp','jimp','png-to-ico','pdf-lib','wawoff2','jszip','helmet']) require(m); require('sharp')({create:{width:1,height:1,channels:3,background:'#fff'}}).png().toBuffer().then(()=>console.log('dependencies ok'))"

COPY . .

# Conversions run as an unprivileged user; their temp folders live in /tmp.
RUN useradd --create-home --shell /usr/sbin/nologin squish
# Accounts live in /data, a Docker volume (deploy/update.sh), so they survive rebuilds.
RUN mkdir -p /data && chown squish /data
ENV DATA_DIR=/data
USER squish

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
