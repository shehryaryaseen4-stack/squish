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

// Extended catalog (CloudConvert-style coverage). Everything built from these is 'planned'.
const RAW_CAMERA = ['3fr', 'arw', 'cr2', 'cr3', 'crw', 'dcr', 'dng', 'erf', 'mos', 'mrw', 'nef', 'orf', 'pef', 'raf', 'raw', 'rw2', 'x3f'];
const IMG_ALL_IN = ['jpg', 'jfif', 'png', 'webp', 'avif', 'tiff', 'gif', 'bmp', 'svg', 'ico', 'icns', 'heic', 'heif', 'psd', 'xcf', 'ppm',
  'eps', 'ps', 'odd', 'xps', ...RAW_CAMERA];
const IMG_ALL_OUT = ['jpg', 'png', 'webp', 'avif', 'tiff', 'gif', 'bmp', 'ico', 'psd', 'eps', 'ps', 'pdf'];
const VIDEO_ALL_IN = [...VIDEO_IN, '3g2', '3gpp', 'cavs', 'dv', 'dvr', 'mod', 'rm', 'rmvb', 'swf', 'wtv'];
const VIDEO_ALL_OUT = [...VIDEO_OUT, '3g2', '3gpp', 'cavs', 'dv', 'dvr', 'mod', 'm2ts', 'mts', 'rm', 'rmvb', 'swf', 'vob', 'wtv'];
const AUDIO_ALL_OUT = [...AUDIO, 'aifc', 'au', 'caf', 'm4b', 'oga', 'voc', 'weba'];
const AUDIO_ALL_IN = [...AUDIO_ALL_OUT, 'ape', 'dss', 'shn'];
const DOC_OFFICE_IN = ['doc', 'docx', 'docm', 'dot', 'dotx', 'odt', 'rtf', 'txt', 'html', 'abw', 'zabw', 'hwp', 'lwp', 'pages', 'sdw', 'wpd', 'wps'];
const DOC_OFFICE_OUT = ['doc', 'docx', 'odt', 'rtf', 'txt', 'html', 'pdf', 'xps'];
const DOC_MARKUP = ['md', 'rst', 'tex', 'html', 'docx', 'odt', 'txt', 'rtf', 'epub'];
const EBOOK_ALL_IN = ['epub', 'mobi', 'azw', 'azw3', 'azw4', 'cbc', 'cbr', 'cbz', 'chm', 'fb2', 'htmlz', 'lit', 'lrf', 'oeb', 'pdb', 'pml', 'prc',
  'rb', 'snb', 'tcr', 'txtz', 'docx', 'odt', 'rtf', 'txt', 'html', 'pdf'];
const EBOOK_ALL_OUT = ['epub', 'mobi', 'azw3', 'fb2', 'htmlz', 'lit', 'lrf', 'oeb', 'pdb', 'pml', 'rb', 'snb', 'tcr', 'txtz', 'docx', 'rtf', 'txt', 'html', 'pdf'];
const SLIDES_ALL_IN = ['ppt', 'pptx', 'pptm', 'pps', 'ppsx', 'pot', 'potx', 'odp', 'dps', 'key'];
const SLIDES_ALL_OUT = ['ppt', 'pptx', 'pptm', 'pps', 'ppsx', 'pot', 'potx', 'odp', 'pdf', 'jpg', 'png'];
const SHEETS_ALL_IN = ['xls', 'xlsx', 'xlsm', 'ods', 'csv', 'tsv', 'et', 'numbers'];
const SHEETS_ALL_OUT = ['xls', 'xlsx', 'xlsm', 'ods', 'csv', 'tsv', 'html', 'pdf'];
const VECTOR_ALL_IN = ['svg', 'svgz', 'eps', 'ps', 'ai', 'cdr', 'cgm', 'emf', 'wmf', 'sk', 'sk1', 'vsd', 'dxf', 'pdf'];
const VECTOR_ALL_OUT = ['svg', 'svgz', 'eps', 'ps', 'emf', 'wmf', 'dxf', 'pdf'];
const ARCHIVE_ALL_IN = [...ARCHIVE_IN, 'ace', 'alz', 'arc', 'arj', 'cab', 'cpio', 'deb', 'dmg', 'img', 'iso', 'jar', 'lha', 'lz', 'lzma', 'lzo',
  'rpm', 'rz', 'xz', 'z', 'tar-7z', 'tar-xz', 'tar-lzo', 'tar-z'];
const ARCHIVE_ALL_OUT = [...ARCHIVE_OUT, 'xz', 'tar-xz', 'tar-7z'];

const CONVERSION_RULES = [
  // ===================================================================== LIVE ==
  // Everything below "live" is what the server does today (POST /api/compress).
  // Order of from/to is the order shown on pages, hub and menus.
  {
    id: 'image-raster', status: 'live', engine: 'sharp', handler: 'image',
    from: ['jpg', 'png', 'webp', 'avif', 'tiff', 'gif', 'bmp', 'svg', 'jfif'],
    to: IMG_OUT,
    decoders: { bmp: 'jimp' },      // libvips cannot read BMP; Jimp decodes it, then Sharp takes over
    encoders: { ico: 'png-to-ico' },// libvips cannot write ICO; Sharp renders PNG sizes and png-to-ico packs them
    quality: 'high',
    notes: 'Animated GIF stays animated only when the output is GIF or WebP. SVG is rasterized at its declared size. ' +
      'JFIF is ordinary JPEG data with another extension, so Sharp reads it directly.',
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

  // ---- extended catalog (CloudConvert-style coverage). Pairs already defined above keep
  //      their earlier rule (and status); these only fill in the rest of the matrix.
  { id: 'image-extended', status: 'planned', engine: 'imagemagick', from: IMG_ALL_IN, to: IMG_ALL_OUT, quality: 'good',
    except: [['ps', 'eps'], ['eps', 'ps']], notes: 'Layered files (PSD, XCF) are flattened. EPS/PS/XPS are rendered with Ghostscript.' },
  { id: 'image-raw-camera', status: 'planned', engine: 'libraw', from: RAW_CAMERA, to: IMG_ALL_OUT, quality: 'good',
    notes: 'RAW files are developed with default settings (white balance as shot).' },
  { id: 'video-extended', status: 'planned', engine: 'ffmpeg', from: VIDEO_ALL_IN, to: VIDEO_ALL_OUT,
    notes: 'Heavy: needs async jobs, a dedicated worker pool, timeouts and size limits.' },
  { id: 'video-extended-to-audio', status: 'planned', engine: 'ffmpeg', from: VIDEO_ALL_IN, to: AUDIO_ALL_OUT, notes: 'Extracts the audio track.' },
  { id: 'video-extended-to-gif', status: 'planned', engine: 'ffmpeg', from: VIDEO_ALL_IN, to: ['gif', 'webp'], quality: 'limited' },
  { id: 'audio-extended', status: 'planned', engine: 'ffmpeg', from: AUDIO_ALL_IN, to: AUDIO_ALL_OUT,
    notes: 'APE, DSS and SHN can be read but not written.' },
  { id: 'document-extended', status: 'planned', engine: 'libreoffice', from: DOC_OFFICE_IN, to: DOC_OFFICE_OUT, quality: 'good',
    notes: 'Fidelity depends on fonts installed on the worker.' },
  { id: 'document-markup', status: 'planned', engine: 'pandoc', from: DOC_MARKUP, to: [...DOC_MARKUP, 'pdf'], quality: 'good' },
  { id: 'djvu', status: 'planned', engine: 'djvulibre', from: ['djvu'], to: ['pdf', 'txt', 'jpg', 'png', 'tiff'] },
  { id: 'pdf-extended', status: 'planned', engine: 'poppler', from: ['pdf'], to: ['html', 'txt', 'jpg', 'png', 'webp', 'tiff', 'svg', 'eps', 'ps', 'xps'] },
  { id: 'ebook-extended', status: 'planned', engine: 'calibre', from: EBOOK_ALL_IN, to: EBOOK_ALL_OUT,
    notes: 'DRM-protected books cannot be converted. Comic formats (CBR/CBZ/CBC) are image-based.' },
  { id: 'presentation-extended', status: 'planned', engine: 'libreoffice', from: SLIDES_ALL_IN, to: SLIDES_ALL_OUT,
    notes: 'Image outputs render each slide; multi-slide decks are delivered as a ZIP.' },
  { id: 'spreadsheet-extended', status: 'planned', engine: 'libreoffice', from: SHEETS_ALL_IN, to: SHEETS_ALL_OUT },
  { id: 'vector-extended', status: 'planned', engine: 'inkscape', from: VECTOR_ALL_IN, to: VECTOR_ALL_OUT, quality: 'good' },
  { id: 'vector-extended-to-raster', status: 'planned', engine: 'inkscape', from: VECTOR_ALL_IN, to: IMG_RASTER_OUT },
  { id: 'cad', status: 'planned', engine: 'libredwg', from: ['dwg', 'dxf'], to: ['dwg', 'dxf', 'pdf', 'svg', 'png', 'jpg'],
    notes: 'Layouts are rendered with default line weights.' },
  { id: 'archive-extended', status: 'planned', engine: 'libarchive', from: ARCHIVE_ALL_IN, to: ARCHIVE_ALL_OUT,
    notes: 'RAR, ACE, DMG and the other legacy formats are input only. Needs zip-bomb and path-traversal protection.' },
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
