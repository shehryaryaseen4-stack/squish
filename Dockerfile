# Squish with every conversion engine installed.
# Ubuntu 24.04 is used because its package names are the ones the conversion tests were run
# against; Node comes from the official Node image. The result is large (~2 GB) because of
# LibreOffice and Calibre. To leave an engine out, delete its packages below: the site
# detects what is installed at startup and only offers those conversions.
FROM node:20-bookworm-slim AS node

FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    # audio + video
    ffmpeg \
    # office documents, spreadsheets, presentations (headless LibreOffice)
    libreoffice-core-nogui libreoffice-writer-nogui libreoffice-calc-nogui libreoffice-impress-nogui libreoffice-draw-nogui \
    # markup documents, ebooks
    pandoc calibre \
    # PDF, PostScript, vector graphics
    ghostscript poppler-utils inkscape \
    # extra image formats (PSD, ICO, PPM, BMP/PSD/EPS output; HEIC/HEIF)
    imagemagick libheif-examples libheif-plugin-libde265 \
    # archives
    libarchive-tools p7zip-full gzip bzip2 xz-utils lzip lzop ncompress \
    # DjVu
    djvulibre-bin \
    # fonts: text in share images and faithful office/PDF rendering
    fontconfig fonts-dejavu-core fonts-liberation2 fonts-crosextra-carlito fonts-crosextra-caladea \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

WORKDIR /app
COPY package*.json ./
# npm can occasionally crash yet still exit 0 ("Exit handler never called"), so prove the
# libraries the site needs are really there; otherwise the build stops here instead of
# shipping an image whose image conversions all fail.
RUN npm ci --omit=dev \
  && node -e "for (const m of ['express','multer','sharp','jimp','png-to-ico','pdf-lib','wawoff2','jszip','helmet']) require(m); require('sharp')({create:{width:1,height:1,channels:3,background:'#fff'}}).png().toBuffer().then(()=>console.log('dependencies ok'))"

COPY . .

# Conversions run as an unprivileged user; their temp folders live in /tmp.
RUN useradd --create-home --shell /usr/sbin/nologin squish
USER squish

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
