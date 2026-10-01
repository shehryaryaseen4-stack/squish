'use strict';
// The converter registry. Every "X -> Y" relationship in the whole site comes from here;
// pages, routes, the sitemap, format pickers and the API all read it and never
// hard-code a pair themselves.
//
// A rule is a matrix: every format in `from` converts to every format in `to`
// (same-format pairs are skipped). registry/index.js expands the rules into one
// converter record per pair.
//
//   id        rule name (shown as `group` on each expanded converter)
//   status    'live'          works today and may get a public page
//             'experimental'  code path exists but is unverified (accepted by the API, no page)
//             'planned'       nothing implemented yet; kept so the format pickers and roadmap have data
//   from/to   format ids from formats.js. Order matters: it is the order pages and menus list them.
//   engine    primary engine id (engines.js). Whether the pair needs a backend is derived from
//             the engine's runtime there, not repeated here.
//   decoders  per-input engine override   { bmp: 'jimp' }
//   encoders  per-output engine override  { ico: 'png-to-ico' }
//   handler   server code that runs it (engines/index.js). Required for live/experimental.
//   quality   'high' | 'good' | 'limited'  expectation for output fidelity
//   except    [[from, to], ...] pairs to leave out of the matrix
//   notes     caveats for users/developers
//
// To add a converter: add a rule (or extend one) and, for live ones, install the engine
// and register a handler. Nothing else needs to change.

const IMG_OUT = ['jpg', 'png', 'webp', 'avif', 'tiff', 'gif', 'ico'];
const IMG_RASTER_OUT = ['jpg', 'png', 'webp', 'avif', 'tiff', 'gif']; // no ICO (used where ICO adds no value)

const VIDEO_IN = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'mpeg', 'mpg', 'm4v', '3gp', 'ogv', 'ts', 'mts', 'm2ts', 'vob', 'mxf'];
const VIDEO_OUT = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'mpeg', 'mpg', 'm4v', '3gp', 'ogv', 'ts', 'mxf'];
const AUDIO = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'aiff', 'amr', 'opus', 'ac3', 'alac'];
const DOCS = ['doc', 'docx', 'odt', 'rtf', 'txt', 'html'];
const SHEETS = ['xls', 'xlsx', 'csv', 'ods', 'tsv'];
const SLIDES = ['ppt', 'pptx', 'odp'];
const EBOOK_IN = ['epub', 'mobi', 'azw', 'azw3'];
const EBOOK_OUT = ['epub', 'mobi', 'azw3'];
const FONT_IN = ['ttf', 'otf', 'woff', 'woff2'];
const FONT_OUT = ['ttf', 'otf', 'woff', 'woff2', 'eot'];
const ARCHIVE_IN = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'tar-gz', 'tar-bz2'];
const ARCHIVE_OUT = ['zip', '7z', 'tar', 'gz', 'bz2', 'tar-gz', 'tar-bz2'];

const CONVERSION_RULES = [
  // ===================================================================== LIVE ==
  // Everything below "live" is what the server does today (POST /api/compress).
  // Order of from/to is the order shown on pages, hub and menus.
  {
    id: 'image-raster', status: 'live', engine: 'sharp', handler: 'image',
    from: ['jpg', 'png', 'webp', 'avif', 'tiff', 'gif', 'bmp', 'svg'],
    to: IMG_OUT,
    decoders: { bmp: 'jimp' },      // libvips cannot read BMP; Jimp decodes it, then Sharp takes over
    encoders: { ico: 'png-to-ico' },// libvips cannot write ICO; Sharp renders PNG sizes and png-to-ico packs them
    quality: 'high',
    notes: 'Animated GIF stays animated only when the output is GIF or WebP. SVG is rasterized at its declared size.',
  },

  // ============================================================ EXPERIMENTAL ==
  {
    id: 'image-heic', status: 'experimental', engine: 'sharp', handler: 'image',
    from: ['heic', 'heif'],
    to: IMG_OUT,
    quality: 'good',
    notes: 'Works only if the libvips build includes HEVC decoding (prebuilt Sharp usually does not). ' +
      'Verify with a real iPhone photo, then change status to "live" to publish landing pages.',
  },

  // =============================================================== PLANNED ==
  // ---- images
  { id: 'image-ico-input', status: 'planned', engine: 'imagemagick', from: ['ico'], to: IMG_RASTER_OUT,
    notes: 'Reading .ico needs a decoder libvips does not have.' },
  { id: 'image-psd-input', status: 'planned', engine: 'imagemagick', from: ['psd'], to: IMG_RASTER_OUT, quality: 'limited',
    notes: 'Flattened composite only; layers are not preserved.' },
  { id: 'image-psd-output', status: 'planned', engine: 'imagemagick', from: ['jpg', 'png', 'webp', 'tiff'], to: ['psd'] },

  // ---- image <-> pdf
  { id: 'pdf-to-image', status: 'planned', engine: 'poppler', from: ['pdf'], to: ['jpg', 'png', 'webp', 'tiff', 'gif'],
    notes: 'One image per page, delivered as a ZIP for multi-page PDFs.' },
  { id: 'image-to-pdf', status: 'planned', engine: 'pdf-lib',
    from: ['jpg', 'png', 'webp', 'tiff', 'gif', 'bmp', 'svg'], to: ['pdf'] },

  // ---- documents
  { id: 'document-matrix', status: 'planned', engine: 'libreoffice', from: DOCS, to: DOCS, quality: 'good',
    notes: 'Fidelity depends on fonts installed on the worker.' },
  { id: 'document-to-pdf', status: 'planned', engine: 'libreoffice', from: DOCS, to: ['pdf'], quality: 'high' },
  { id: 'pdf-to-document', status: 'planned', engine: 'libreoffice', from: ['pdf'], to: ['docx', 'odt', 'rtf', 'txt', 'html'], quality: 'limited',
    notes: 'Lossy for complex layouts. Scanned PDFs need OCR first.' },

  // ---- spreadsheets
  { id: 'spreadsheet-matrix', status: 'planned', engine: 'sheetjs', from: SHEETS, to: SHEETS,
    notes: 'Formatting, formulas and charts are not carried into CSV/TSV.' },
  { id: 'spreadsheet-to-pdf', status: 'planned', engine: 'libreoffice', from: ['xls', 'xlsx', 'ods'], to: ['pdf'] },

  // ---- presentations
  { id: 'presentation-matrix', status: 'planned', engine: 'libreoffice', from: SLIDES, to: SLIDES },
  { id: 'presentation-to-pdf', status: 'planned', engine: 'libreoffice', from: SLIDES, to: ['pdf'], quality: 'high' },

  // ---- ebooks
  { id: 'ebook-matrix', status: 'planned', engine: 'calibre', from: EBOOK_IN, to: EBOOK_OUT,
    notes: 'DRM-protected books cannot be converted.' },
  { id: 'ebook-to-pdf', status: 'planned', engine: 'calibre', from: EBOOK_IN, to: ['pdf'] },
  { id: 'pdf-to-ebook', status: 'planned', engine: 'calibre', from: ['pdf'], to: EBOOK_OUT, quality: 'limited' },

  // ---- fonts
  { id: 'font-matrix', status: 'planned', engine: 'fonttools', from: FONT_IN, to: FONT_OUT,
    notes: 'OTF to TTF converts curves and can change outlines slightly. EOT is output only.' },

  // ---- archives
  { id: 'archive-matrix', status: 'planned', engine: 'libarchive', from: ARCHIVE_IN, to: ARCHIVE_OUT,
    notes: 'RAR is input only. GZ and BZ2 hold a single file. Needs zip-bomb and path-traversal protection.' },

  // ---- vectors
  { id: 'vector-matrix', status: 'planned', engine: 'inkscape', from: ['svg', 'eps', 'ai', 'dxf'], to: ['svg', 'eps', 'dxf'], quality: 'good' },
  { id: 'vector-to-pdf', status: 'planned', engine: 'ghostscript', from: ['svg', 'eps', 'ai'], to: ['pdf'] },
  { id: 'pdf-to-vector', status: 'planned', engine: 'poppler', from: ['pdf'], to: ['svg'], quality: 'limited' },
  { id: 'vector-to-raster', status: 'planned', engine: 'inkscape', from: ['eps', 'ai', 'dxf'], to: IMG_RASTER_OUT },

  // ---- audio
  { id: 'audio-matrix', status: 'planned', engine: 'ffmpeg', from: AUDIO, to: AUDIO,
    notes: 'AMR is speech-only; converting music to AMR sounds poor.' },

  // ---- video
  { id: 'video-matrix', status: 'planned', engine: 'ffmpeg', from: VIDEO_IN, to: VIDEO_OUT,
    notes: 'Heavy: needs async jobs, a dedicated worker pool, timeouts and size limits.' },
  { id: 'video-to-audio', status: 'planned', engine: 'ffmpeg', from: VIDEO_IN, to: AUDIO, notes: 'Extracts the audio track.' },
  { id: 'video-to-gif', status: 'planned', engine: 'ffmpeg', from: VIDEO_IN, to: ['gif'], quality: 'limited',
    notes: 'GIF is limited to 256 colours; long clips make very large files.' },
  { id: 'gif-to-video', status: 'planned', engine: 'ffmpeg', from: ['gif'], to: ['mp4', 'webm', 'mov', 'avi', 'mkv'] },
];

// Compression = re-encoding a format to the same format, smaller. Kept separate from
// conversions because each one is its own landing page (/compress-png) and tool.
const COMPRESS_RULES = [
  { id: 'compress-image', status: 'live', engine: 'sharp', handler: 'image',
    formats: ['jpg', 'png', 'webp', 'avif', 'tiff', 'gif'] },
  { id: 'compress-pdf', status: 'planned', engine: 'ghostscript', formats: ['pdf'] },
];

// Conversions promoted in footers, the home page and 404 page (in this order).
// Entries that are not live yet are ignored by default, so planned ones can be listed ahead of time.
const POPULAR = [
  ['png', 'webp'], ['jpg', 'webp'], ['webp', 'png'], ['webp', 'jpg'], ['png', 'jpg'], ['jpg', 'png'],
  ['avif', 'jpg'], ['gif', 'webp'], ['svg', 'png'], ['png', 'ico'], ['tiff', 'jpg'], ['bmp', 'jpg'],
  ['heic', 'jpg'], ['pdf', 'docx'], ['docx', 'pdf'], ['mp4', 'mp3'], ['mp4', 'gif'], ['ttf', 'woff'],
];

module.exports = { CONVERSION_RULES, COMPRESS_RULES, POPULAR };
