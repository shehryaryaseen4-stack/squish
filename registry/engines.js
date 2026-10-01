'use strict';
// Engines are the libraries/tools that do the actual work. Converters (converters.js)
// point at engines by id, so "what can this server do" and "what do we plan to add"
// are answered in one place.
//
//   status   'installed'  an npm dependency (always available)
//            'system'     a command-line tool; available only if every binary in `bins` is on PATH
//                         (detected at startup, see engines/detect.js). The Dockerfile installs them all.
//            'planned'    not integrated yet; converters that use it can only be 'planned'
//   bins     for 'system' engines: the binaries that must be installed
//   npm      for 'installed' engines whose npm package name differs from the id
//   runtime  'server' | 'browser' | 'both'   where the engine can run. 'server' means any conversion
//            that uses it needs backend processing; 'browser' or 'both' means it does not.
//   license  short note. Check with counsel before shipping in a hosted commercial service.

const ENGINES = [
  // ---- installed today
  { id: 'sharp', name: 'Sharp (libvips)', status: 'installed', runtime: 'server', license: 'Apache-2.0 (libvips LGPL)',
    handles: ['image'], notes: 'Primary raster image engine: JPG, PNG, WebP, AVIF, TIFF, GIF, SVG rasterizing.' },
  { id: 'jimp', name: 'Jimp', status: 'installed', runtime: 'server', license: 'MIT',
    handles: ['image'], notes: 'Pure-JS fallback used only to decode BMP, which libvips cannot read.' },
  { id: 'png-to-ico', name: 'png-to-ico', status: 'installed', runtime: 'server', license: 'MIT',
    handles: ['image'], notes: 'Packs PNG renders from Sharp into a multi-size .ico.' },

  // ---- planned (server)
  { id: 'imagemagick', name: 'ImageMagick', status: 'system', bins: ['convert'], runtime: 'server', license: 'ImageMagick License',
    handles: ['image', 'pdf'], notes: 'ICO reading, PSD, and fallbacks for odd raster formats.' },
  { id: 'libraw', name: 'LibRaw', status: 'planned', runtime: 'server', license: 'LGPL-2.1 / CDDL-1.0',
    handles: ['image'], notes: 'Camera RAW decoding (CR2, CR3, NEF, ARW, DNG, ...).' },
  { id: 'djvulibre', name: 'DjVuLibre', status: 'system', bins: ['ddjvu', 'djvutxt'], runtime: 'server', license: 'GPL-2.0',
    handles: ['document'], notes: 'DjVu rendering and text extraction.' },
  { id: 'libredwg', name: 'LibreDWG / ODA File Converter', status: 'planned', runtime: 'server', license: 'GPL-3.0 / proprietary freeware',
    handles: ['cad'], notes: 'DWG reading/writing and DWG<->DXF. Check licensing before choosing between them.' },
  { id: 'libheif', name: 'libheif', status: 'system', bins: ['heif-convert'], runtime: 'server', license: 'LGPL-3.0',
    handles: ['image'], notes: 'Reliable HEIC/HEIF decoding when the Sharp build lacks it.' },
  { id: 'ffmpeg', name: 'FFmpeg', status: 'system', bins: ['ffmpeg'], runtime: 'server', license: 'LGPL/GPL depending on build',
    handles: ['video', 'audio'], notes: 'All video and audio conversion. Needs its own worker pool, timeouts and size limits.' },
  { id: 'libreoffice', name: 'LibreOffice (headless)', status: 'system', bins: ['soffice'],
    // Writer, Calc and Impress modules; `soffice` alone (libreoffice-core) cannot open documents.
    binFiles: { soffice: ['libswlo.so', 'libsclo.so', 'libsdlo.so'] }, runtime: 'server', license: 'MPL-2.0',
    handles: ['document', 'spreadsheet', 'presentation', 'pdf'], notes: 'Office documents, spreadsheets and presentations, incl. export to PDF. Run one instance per job in a sandbox.' },
  { id: 'pandoc', name: 'Pandoc', status: 'system', bins: ['pandoc'], runtime: 'server', license: 'GPL-2.0-or-later',
    handles: ['document', 'ebook'], notes: 'Text/markup conversions (HTML, TXT, RTF, ODT, DOCX, EPUB).' },
  { id: 'calibre', name: 'Calibre ebook-convert', status: 'system', bins: ['ebook-convert'], runtime: 'server', license: 'GPL-3.0',
    handles: ['ebook'], notes: 'EPUB/MOBI/AZW3 conversion. Run as a subprocess. Cannot handle DRM.' },
  { id: 'poppler', name: 'Poppler + Ghostscript', status: 'system', bins: ['pdftoppm', 'pdftotext', 'pdftohtml', 'pdftocairo', 'pdfinfo', 'gs'], runtime: 'server', license: 'GPL-2.0 / Apache-2.0',
    handles: ['pdf'], notes: 'PDF rasterizing and text extraction; qpdf for structural work.' },
  { id: 'ghostscript', name: 'Ghostscript', status: 'system', bins: ['gs'], runtime: 'server', license: 'AGPL-3.0',
    handles: ['pdf', 'vector'], notes: 'EPS/PS/AI rendering and PDF compression. AGPL: review obligations for a hosted service.' },
  { id: 'inkscape', name: 'Inkscape', status: 'system', bins: ['inkscape'], runtime: 'server', license: 'GPL-3.0 / MPL-2.0',
    handles: ['vector'], notes: 'Vector-to-vector conversion (SVG, EPS, AI, DXF).' },
  { id: 'fonttools', name: 'fontTools (+ brotli)', status: 'planned', runtime: 'server', license: 'MIT',
    handles: ['font'], notes: 'TTF<->OTF outline conversion and EOT output (not integrated yet).' },
  { id: 'woff', name: 'WOFF/WOFF2 (wawoff2 + zlib)', status: 'installed', npm: 'wawoff2', runtime: 'both', license: 'MIT',
    handles: ['font'], notes: 'Wraps TTF/OTF fonts as WOFF/WOFF2 and unwraps them again. Pure JS/WebAssembly.' },
  { id: 'libarchive', name: 'libarchive (bsdtar) + 7-Zip', status: 'system', bins: ['bsdtar', '7z', 'gzip', 'bzip2', 'xz', 'lzip', 'lzop', 'compress'], runtime: 'server', license: 'BSD / LGPL',
    handles: ['archive'], notes: 'Archive conversion. RAR can be read but never created. Enforce zip-bomb and path-traversal limits.' },

  // ---- planned (browser-capable)
  { id: 'pdf-lib', name: 'pdf-lib', status: 'installed', runtime: 'both', license: 'MIT / Apache-2.0',
    handles: ['pdf', 'image'], notes: 'Client-side image-to-PDF and simple PDF page operations.' },
  { id: 'sheetjs', name: 'SheetJS', status: 'planned', runtime: 'both', license: 'Apache-2.0 (community edition)',
    handles: ['spreadsheet'], notes: 'CSV/TSV/XLS/XLSX/ODS conversion in the browser or in Node.' },
];

module.exports = { ENGINES };
