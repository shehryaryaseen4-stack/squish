'use strict';
// Central list of file formats. This file holds only STATIC facts about a format
// (what it is, its MIME type, how well browsers cope with it).
//
// What can be converted to what is NOT stored here. That lives in
// converters.js, and the registry derives each format's `input` / `output`
// support from it, so the two can never disagree.
//
// Fields
//   id           unique url-safe key, also used in routes (/png-to-webp). [a-z0-9-] only,
//                and never containing "-to-".
//   extension    real file extension without the dot (defaults to id; "tar.gz" for id "tar-gz")
//   aliases      other extensions/route spellings that resolve to this format (jpeg -> jpg)
//   name         display name ("WebP")           label is derived: extension.toUpperCase()
//   altLabel     optional second spelling shown in page titles ("JPEG" -> "JPG to PNG Converter (JPEG to PNG)")
//   fullName     long name ("Joint Photographic Experts Group")
//   category     primary category id (see categories.js)
//   alsoIn       extra categories the format should be listed under (PDF also appears in Document)
//   mimeType     primary MIME type; mimeTypes lists extra ones that should also match
//   description  plain-language description, shown on format cards
//   icon         optional icon key, otherwise inherited from the category
//   browser      two letters = [read][write] browser capability HINT:
//                  N native browser API   L needs a JS/WASM library   X not realistic in a browser
//                These are planning hints, not commitments. Registry derives backendRequired from them.
//   apiFormat    the value POST /api/compress accepts for this format as an OUTPUT (only where it differs from id)
//   traits       small facts used by page copy: sizeRank (higher = usually smaller), alpha, and for
//                live formats the comparison-table facts: compression, animation, year, developer, bestFor
//   notes        caveats worth surfacing to users or future developers

const FORMATS = [
  // ------------------------------------------------------------------ Image --
  {
    id: 'jpg', name: 'JPG', fullName: 'Joint Photographic Experts Group', category: 'image',
    aliases: ['jpeg'], altLabel: 'JPEG', mimeType: 'image/jpeg', browser: 'NN', apiFormat: 'jpeg',
    traits: { sizeRank: 3, alpha: false, compression: 'Lossy', animation: false, year: 1992, developer: 'Joint Photographic Experts Group', bestFor: 'Photographs and images shared anywhere' },
    description: 'JPG (also written JPEG) is the most widely used format for photographs. It uses lossy compression, which keeps files small by discarding fine detail the eye is unlikely to miss. It does not support transparency or animation, and virtually every device, browser and app can open it.',
  },
  {
    id: 'png', name: 'PNG', fullName: 'Portable Network Graphics', category: 'image',
    mimeType: 'image/png', browser: 'NN', apiFormat: 'png',
    traits: { sizeRank: 2, alpha: true, compression: 'Lossless', animation: false, year: 1996, developer: 'PNG Development Group (W3C)', bestFor: 'Logos, screenshots and graphics with transparency' },
    description: 'PNG stores images with lossless compression and supports full transparency, which makes it the usual choice for logos, screenshots and graphics with sharp edges. The trade-off is size: a photograph saved as PNG is normally far larger than the same photo saved as JPG or WebP.',
  },
  {
    id: 'webp', name: 'WebP', fullName: 'WebP', category: 'image',
    mimeType: 'image/webp', browser: 'NL', apiFormat: 'webp',
    traits: { sizeRank: 4, alpha: true, compression: 'Lossy and lossless', animation: true, year: 2010, developer: 'Google', bestFor: 'Fast-loading website images' },
    description: 'WebP is an image format developed by Google. It supports lossy and lossless compression, transparency and animation, and at comparable visual quality its files are usually smaller than JPG or PNG. That is why it is popular for websites, and current versions of all major browsers can display it.',
  },
  {
    id: 'avif', name: 'AVIF', fullName: 'AV1 Image File Format', category: 'image',
    mimeType: 'image/avif', browser: 'NL', apiFormat: 'avif',
    traits: { sizeRank: 5, alpha: true, compression: 'Lossy and lossless', animation: true, year: 2019, developer: 'Alliance for Open Media', bestFor: 'The smallest web images in modern browsers' },
    description: 'AVIF is a modern image format built on the AV1 video codec. It supports transparency and high dynamic range, and it often produces the smallest files of any web image format at a given quality. Encoding is slower than for JPG or WebP, and older browsers and some apps cannot open it.',
  },
  {
    id: 'tiff', name: 'TIFF', fullName: 'Tagged Image File Format', category: 'image',
    aliases: ['tif'], mimeType: 'image/tiff', browser: 'LL', apiFormat: 'tiff',
    traits: { sizeRank: 1, alpha: true, compression: 'Lossless or uncompressed', animation: false, year: 1986, developer: 'Aldus (now Adobe)', bestFor: 'Printing, scanning and archiving' },
    description: 'TIFF is a flexible, high-quality format used in scanning, print production and professional photography. Files are usually large, and many web browsers cannot display TIFF at all, so images are normally converted before they are published online.',
  },
  {
    id: 'gif', name: 'GIF', fullName: 'Graphics Interchange Format', category: 'image', alsoIn: ['video'],
    mimeType: 'image/gif', browser: 'NL', apiFormat: 'gif',
    traits: { sizeRank: 2, alpha: true, compression: 'Lossless, 256 colours', animation: true, year: 1987, developer: 'CompuServe', bestFor: 'Short animations and simple graphics' },
    description: 'GIF dates from 1987 and is best known for short looping animations. Each frame is limited to 256 colours and transparency is on or off only, so photographs often look banded. It is still handy for simple graphics and animations that need to work everywhere.',
  },
  {
    id: 'bmp', name: 'BMP', fullName: 'Bitmap', category: 'image',
    mimeType: 'image/bmp', mimeTypes: ['image/x-ms-bmp'], browser: 'NL',
    traits: { sizeRank: 0, alpha: false, compression: 'Usually uncompressed', animation: false, year: 1990, developer: 'Microsoft', bestFor: 'Legacy Windows software' },
    description: 'BMP is a simple image format from Windows that usually stores pixels with little or no compression, so files are large compared with JPG, PNG or WebP. It is rarely used on the web, and converting a BMP is the easiest way to make it small enough to share.',
  },
  {
    id: 'ico', name: 'ICO', fullName: 'Windows Icon', category: 'image',
    mimeType: 'image/x-icon', mimeTypes: ['image/vnd.microsoft.icon'], browser: 'NL', apiFormat: 'ico',
    traits: { sizeRank: null, alpha: true, compression: 'PNG or BMP images inside', animation: false, year: 1985, developer: 'Microsoft', bestFor: 'Favicons and Windows icons' },
    description: 'ICO is the Windows icon format, and browsers also use it for favicons. A single .ico file can hold several sizes of the same icon, from 16x16 up to 256x256, so the right one is shown wherever it is needed.',
    notes: 'Output is a real multi-size .ico (16-256px). Reading an existing .ico is not implemented yet.',
  },
  {
    id: 'heic', name: 'HEIC', fullName: 'High Efficiency Image Container', category: 'image',
    mimeType: 'image/heic', mimeTypes: ['image/heic-sequence'], browser: 'LX',
    description: 'HEIC is the format iPhones and many recent cameras use for photos. It keeps files roughly half the size of JPG at similar quality, but it is not supported by most browsers and many apps, so photos are often converted to JPG or PNG before sharing.',
    notes: 'Decoding depends on how libvips/libheif was built (prebuilt Sharp binaries usually lack HEVC). Kept "experimental" until verified with a real iPhone photo. Encoding HEVC is not planned.',
  },
  {
    id: 'heif', name: 'HEIF', fullName: 'High Efficiency Image File Format', category: 'image',
    mimeType: 'image/heif', mimeTypes: ['image/heif-sequence'], browser: 'LX',
    description: 'HEIF is the container standard behind HEIC. It can hold one or many images with efficient compression, but support outside Apple devices and recent software is patchy, so it is usually converted to JPG or PNG.',
    notes: 'Same libheif/HEVC caveat as HEIC.',
  },
  {
    id: 'psd', name: 'PSD', fullName: 'Adobe Photoshop Document', category: 'image',
    mimeType: 'image/vnd.adobe.photoshop', mimeTypes: ['application/x-photoshop'], browser: 'LX',
    description: 'PSD is the native layered file format of Adobe Photoshop. It keeps layers, masks and effects for editing, which makes files large and unreadable in most browsers and viewers, so it is usually flattened to PNG or JPG for sharing.',
    notes: 'Needs a server-side decoder (ImageMagick or similar). Only the flattened composite can be produced.',
  },

  // ------------------------------------------------------------------- Font --
  {
    id: 'ttf', name: 'TTF', fullName: 'TrueType Font', category: 'font',
    mimeType: 'font/ttf', mimeTypes: ['application/x-font-ttf', 'application/x-font-truetype'], browser: 'LL',
    description: 'TTF is the TrueType outline font format used on Windows, macOS and Linux and supported by all major browsers. It is a common source format when preparing fonts for the web.',
  },
  {
    id: 'otf', name: 'OTF', fullName: 'OpenType Font', category: 'font',
    mimeType: 'font/otf', mimeTypes: ['application/x-font-opentype'], browser: 'LL',
    description: 'OTF is the OpenType font format. It can hold TrueType or PostScript-style outlines plus advanced typographic features such as ligatures and alternates.',
  },
  {
    id: 'woff', name: 'WOFF', fullName: 'Web Open Font Format', category: 'font',
    mimeType: 'font/woff', mimeTypes: ['application/font-woff'], browser: 'LL',
    description: 'WOFF is a compressed font wrapper designed for websites. It is supported by every current browser and loads faster than raw TTF or OTF files.',
  },
  {
    id: 'woff2', name: 'WOFF2', fullName: 'Web Open Font Format 2', category: 'font',
    mimeType: 'font/woff2', mimeTypes: ['application/font-woff2'], browser: 'LL',
    description: 'WOFF2 is the newer web font format with Brotli compression. It typically produces the smallest font files and is supported by all modern browsers.',
  },
  {
    id: 'eot', name: 'EOT', fullName: 'Embedded OpenType', category: 'font',
    mimeType: 'application/vnd.ms-fontobject', browser: 'XX',
    description: 'EOT is a compact font format created by Microsoft for old versions of Internet Explorer. It is only needed to support very old browsers.',
    notes: 'Output only (via a ttf2eot-style tool); reading EOT is not planned.',
  },

  // ------------------------------------------------------------------ Video --
  {
    id: 'mp4', name: 'MP4', fullName: 'MPEG-4 Part 14', category: 'video',
    mimeType: 'video/mp4', browser: 'NX',
    description: 'MP4 is the most widely supported video container. It usually holds H.264 or H.265 video with AAC audio and plays on nearly every phone, computer, TV and browser.',
  },
  {
    id: 'mov', name: 'MOV', fullName: 'QuickTime Movie', category: 'video',
    mimeType: 'video/quicktime', browser: 'XX',
    description: 'MOV is Apple\'s QuickTime video container. It is common for iPhone recordings and video editing, and often produces larger files than MP4.',
  },
  {
    id: 'avi', name: 'AVI', fullName: 'Audio Video Interleave', category: 'video',
    mimeType: 'video/x-msvideo', mimeTypes: ['video/avi'], browser: 'XX',
    description: 'AVI is an older Microsoft video container from 1992. It is still found in legacy archives, but files are large and browsers do not play them.',
  },
  {
    id: 'mkv', name: 'MKV', fullName: 'Matroska Video', category: 'video',
    mimeType: 'video/x-matroska', browser: 'XX',
    description: 'MKV is a flexible open container that can hold many video, audio and subtitle tracks. It is popular for downloaded films but is not supported by all devices and browsers.',
  },
  {
    id: 'webm', name: 'WebM', fullName: 'WebM', category: 'video',
    mimeType: 'video/webm', browser: 'NX',
    description: 'WebM is an open video format for the web using VP8/VP9 or AV1 video with Vorbis or Opus audio. All major browsers play it.',
  },
  {
    id: 'flv', name: 'FLV', fullName: 'Flash Video', category: 'video',
    mimeType: 'video/x-flv', browser: 'XX',
    description: 'FLV is the video format used by Adobe Flash. Flash is discontinued, so FLV files are mostly old downloads that need converting to play on current devices.',
  },
  {
    id: 'wmv', name: 'WMV', fullName: 'Windows Media Video', category: 'video',
    mimeType: 'video/x-ms-wmv', browser: 'XX',
    description: 'WMV is Microsoft\'s Windows Media video format. It plays in Windows apps but has little support on phones and browsers.',
  },
  {
    id: 'mpeg', name: 'MPEG', fullName: 'Moving Picture Experts Group video', category: 'video',
    mimeType: 'video/mpeg', browser: 'XX',
    description: 'MPEG files use MPEG-1 or MPEG-2 video compression. They are common in older digital video and DVD workflows.',
  },
  {
    id: 'mpg', name: 'MPG', fullName: 'MPEG video', category: 'video',
    mimeType: 'video/mpeg', browser: 'XX',
    description: 'MPG is the short-extension form of MPEG video, found on older cameras and DVD-era recordings.',
  },
  {
    id: 'm4v', name: 'M4V', fullName: 'iTunes Video', category: 'video',
    mimeType: 'video/x-m4v', browser: 'NX',
    description: 'M4V is an MP4-style container used by Apple for iTunes video. It works like MP4 but may carry DRM on purchased content.',
    notes: 'DRM-protected files cannot be converted.',
  },
  {
    id: '3gp', name: '3GP', fullName: '3GPP Multimedia', category: 'video',
    mimeType: 'video/3gpp', browser: 'XX',
    description: '3GP is a small video container built for early mobile phones. Files are low resolution and mainly of interest for old phone recordings.',
  },
  {
    id: 'ogv', name: 'OGV', fullName: 'Ogg Video', category: 'video',
    mimeType: 'video/ogg', browser: 'NX',
    description: 'OGV is Ogg video, usually Theora video with Vorbis audio. It is open and royalty-free but rarely used compared with MP4 or WebM.',
  },
  {
    id: 'ts', name: 'TS', fullName: 'MPEG Transport Stream', category: 'video',
    mimeType: 'video/mp2t', browser: 'XX',
    description: 'TS is the MPEG transport stream used for broadcast television and HLS streaming segments.',
  },
  {
    id: 'mts', name: 'MTS', fullName: 'AVCHD Video', category: 'video',
    mimeType: 'video/mp2t', browser: 'XX',
    description: 'MTS files come from AVCHD camcorders and some digital cameras. They use H.264 video and are usually converted to MP4 for editing and sharing.',
  },
  {
    id: 'm2ts', name: 'M2TS', fullName: 'Blu-ray MPEG-2 Transport Stream', category: 'video',
    mimeType: 'video/mp2t', browser: 'XX',
    description: 'M2TS is the transport stream container used on Blu-ray discs and AVCHD camcorders.',
  },
  {
    id: 'vob', name: 'VOB', fullName: 'DVD Video Object', category: 'video',
    mimeType: 'video/mpeg', browser: 'XX',
    description: 'VOB files hold the video, audio and subtitles of a DVD. They are usually converted to MP4 so the film can be played without a disc.',
    notes: 'Input only. Copy-protected discs cannot be converted.',
  },
  {
    id: 'mxf', name: 'MXF', fullName: 'Material Exchange Format', category: 'video',
    mimeType: 'application/mxf', browser: 'XX',
    description: 'MXF is a professional broadcast container used by cameras and editing systems. Files are large and are normally converted to MP4 or MOV for review and delivery.',
  },

  // ------------------------------------------------------------------ Audio --
  {
    id: 'mp3', name: 'MP3', fullName: 'MPEG Audio Layer III', category: 'audio',
    mimeType: 'audio/mpeg', mimeTypes: ['audio/mp3'], browser: 'NL',
    description: 'MP3 is the most widely supported lossy audio format. It makes music files small enough to share and plays on virtually every device.',
  },
  {
    id: 'wav', name: 'WAV', fullName: 'Waveform Audio', category: 'audio',
    mimeType: 'audio/wav', mimeTypes: ['audio/x-wav', 'audio/wave'], browser: 'NL',
    description: 'WAV stores uncompressed audio at full quality. It is standard for recording and editing, but files are large.',
  },
  {
    id: 'aac', name: 'AAC', fullName: 'Advanced Audio Coding', category: 'audio',
    mimeType: 'audio/aac', browser: 'NX',
    description: 'AAC is a lossy audio codec that usually sounds better than MP3 at the same size. It is used by Apple, YouTube and many streaming services.',
  },
  {
    id: 'flac', name: 'FLAC', fullName: 'Free Lossless Audio Codec', category: 'audio',
    mimeType: 'audio/flac', mimeTypes: ['audio/x-flac'], browser: 'NL',
    description: 'FLAC compresses audio without any loss of quality, typically to about half the size of WAV. It is popular for music collections.',
  },
  {
    id: 'ogg', name: 'OGG', fullName: 'Ogg Vorbis', category: 'audio',
    mimeType: 'audio/ogg', mimeTypes: ['application/ogg'], browser: 'NL',
    description: 'OGG usually holds Vorbis audio, an open lossy format with good quality at small sizes. It is common in games and open-source software.',
  },
  {
    id: 'm4a', name: 'M4A', fullName: 'MPEG-4 Audio', category: 'audio',
    mimeType: 'audio/mp4', mimeTypes: ['audio/x-m4a'], browser: 'NX',
    description: 'M4A is an MP4 container for audio, normally AAC. It is the default audio format for iTunes, iPhone voice memos and many podcasts.',
  },
  {
    id: 'wma', name: 'WMA', fullName: 'Windows Media Audio', category: 'audio',
    mimeType: 'audio/x-ms-wma', browser: 'XX',
    description: 'WMA is Microsoft\'s audio format. It plays in Windows apps but has limited support elsewhere.',
  },
  {
    id: 'aiff', name: 'AIFF', fullName: 'Audio Interchange File Format', category: 'audio',
    aliases: ['aif'], mimeType: 'audio/aiff', mimeTypes: ['audio/x-aiff'], browser: 'LL',
    description: 'AIFF is Apple\'s uncompressed audio format, comparable to WAV. It is used in music production on Mac.',
  },
  {
    id: 'amr', name: 'AMR', fullName: 'Adaptive Multi-Rate audio', category: 'audio',
    mimeType: 'audio/amr', browser: 'XX',
    description: 'AMR is a speech codec used for voice recordings and voicemail on mobile phones. Files are very small and tuned for speech, not music.',
  },
  {
    id: 'opus', name: 'OPUS', fullName: 'Opus Audio', category: 'audio',
    mimeType: 'audio/opus', mimeTypes: ['audio/ogg; codecs=opus'], browser: 'NL',
    description: 'Opus is a modern open audio codec that performs well for both speech and music at low bitrates. It is used by WebRTC calls and Discord.',
  },
  {
    id: 'ac3', name: 'AC3', fullName: 'Dolby Digital', category: 'audio',
    mimeType: 'audio/ac3', browser: 'XX',
    description: 'AC3 is Dolby Digital surround sound audio, used on DVDs and in many home-cinema systems.',
  },
  {
    id: 'alac', name: 'ALAC', fullName: 'Apple Lossless Audio Codec', category: 'audio',
    mimeType: 'audio/x-alac', browser: 'XX',
    description: 'ALAC is Apple\'s lossless audio codec. It keeps full quality at about half the size of WAV and plays in iTunes and on Apple devices.',
  },

  // ------------------------------------------------------- Document and PDF --
  {
    id: 'pdf', name: 'PDF', fullName: 'Portable Document Format', category: 'pdf', alsoIn: ['document', 'ebook'],
    mimeType: 'application/pdf', browser: 'LL',
    description: 'PDF is the standard format for documents that must look the same on every device. It preserves layout, fonts and images, but is difficult to edit.',
    notes: 'Converting PDF to editable formats is lossy for complex layouts, and scanned PDFs need OCR.',
  },
  {
    id: 'doc', name: 'DOC', fullName: 'Microsoft Word 97-2003 Document', category: 'document',
    mimeType: 'application/msword', browser: 'XX',
    description: 'DOC is the legacy binary Word format used before 2007. Many old documents still use it, and it is usually converted to DOCX or PDF.',
  },
  {
    id: 'docx', name: 'DOCX', fullName: 'Microsoft Word Document', category: 'document', alsoIn: ['ebook'],
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', browser: 'XX',
    description: 'DOCX is the standard Microsoft Word format. It stores text, styles, images and tables in a zipped XML package.',
    notes: 'Faithful rendering needs a server-side office engine (LibreOffice).',
  },
  {
    id: 'txt', name: 'TXT', fullName: 'Plain Text', category: 'document', alsoIn: ['ebook'],
    mimeType: 'text/plain', browser: 'NN',
    description: 'TXT holds plain unformatted text. Every device can open it, but it cannot store fonts, images or layout.',
  },
  {
    id: 'rtf', name: 'RTF', fullName: 'Rich Text Format', category: 'document', alsoIn: ['ebook'],
    mimeType: 'application/rtf', mimeTypes: ['text/rtf'], browser: 'XX',
    description: 'RTF is a cross-platform text format that keeps basic formatting such as bold, fonts and lists. It can be opened by most word processors.',
  },
  {
    id: 'odt', name: 'ODT', fullName: 'OpenDocument Text', category: 'document', alsoIn: ['ebook'],
    mimeType: 'application/vnd.oasis.opendocument.text', browser: 'XX',
    description: 'ODT is the open standard word-processing format used by LibreOffice and OpenOffice.',
  },
  {
    id: 'html', name: 'HTML', fullName: 'HyperText Markup Language', category: 'document', alsoIn: ['ebook'],
    aliases: ['htm'], mimeType: 'text/html', browser: 'NN',
    description: 'HTML is the markup language of web pages. It can be opened in any browser and converted to documents such as PDF.',
  },

  // ------------------------------------------------------------ Spreadsheet --
  {
    id: 'xls', name: 'XLS', fullName: 'Microsoft Excel 97-2003 Workbook', category: 'spreadsheet',
    mimeType: 'application/vnd.ms-excel', browser: 'LL',
    description: 'XLS is the legacy binary Excel format used before 2007. It is limited to 65,536 rows and is usually converted to XLSX or CSV.',
  },
  {
    id: 'xlsx', name: 'XLSX', fullName: 'Microsoft Excel Workbook', category: 'spreadsheet',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', browser: 'LL',
    description: 'XLSX is the standard Excel format. It stores sheets, formulas, formatting and charts in a zipped XML package.',
  },
  {
    id: 'csv', name: 'CSV', fullName: 'Comma-Separated Values', category: 'spreadsheet',
    mimeType: 'text/csv', browser: 'NN',
    description: 'CSV stores table data as plain text with values separated by commas. Almost every spreadsheet and database can import and export it, but it keeps no formatting or formulas.',
  },
  {
    id: 'ods', name: 'ODS', fullName: 'OpenDocument Spreadsheet', category: 'spreadsheet',
    mimeType: 'application/vnd.oasis.opendocument.spreadsheet', browser: 'LL',
    description: 'ODS is the open standard spreadsheet format used by LibreOffice Calc and OpenOffice.',
  },
  {
    id: 'tsv', name: 'TSV', fullName: 'Tab-Separated Values', category: 'spreadsheet',
    mimeType: 'text/tab-separated-values', browser: 'NN',
    description: 'TSV stores table data as plain text with values separated by tabs. It avoids the comma-escaping problems of CSV for text-heavy data.',
  },

  // ----------------------------------------------------------- Presentation --
  {
    id: 'ppt', name: 'PPT', fullName: 'Microsoft PowerPoint 97-2003 Presentation', category: 'presentation',
    mimeType: 'application/vnd.ms-powerpoint', browser: 'XX',
    description: 'PPT is the legacy binary PowerPoint format used before 2007. It is usually converted to PPTX or PDF.',
  },
  {
    id: 'pptx', name: 'PPTX', fullName: 'Microsoft PowerPoint Presentation', category: 'presentation',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', browser: 'XX',
    description: 'PPTX is the standard PowerPoint format. It stores slides, layouts, media and animations in a zipped XML package.',
    notes: 'Faithful rendering needs a server-side office engine (LibreOffice).',
  },
  {
    id: 'odp', name: 'ODP', fullName: 'OpenDocument Presentation', category: 'presentation',
    mimeType: 'application/vnd.oasis.opendocument.presentation', browser: 'XX',
    description: 'ODP is the open standard presentation format used by LibreOffice Impress and OpenOffice.',
  },

  // ------------------------------------------------------------------ Ebook --
  {
    id: 'epub', name: 'EPUB', fullName: 'Electronic Publication', category: 'ebook',
    mimeType: 'application/epub+zip', browser: 'LL',
    description: 'EPUB is the open standard ebook format. Text reflows to fit any screen, and it is supported by nearly every e-reader except older Kindles.',
  },
  {
    id: 'mobi', name: 'MOBI', fullName: 'Mobipocket eBook', category: 'ebook',
    mimeType: 'application/x-mobipocket-ebook', browser: 'XX',
    description: 'MOBI is an older ebook format from Mobipocket that Kindle devices used for years. Amazon has since moved to newer formats.',
    notes: 'Legacy format; prefer EPUB or AZW3 as output.',
  },
  {
    id: 'azw', name: 'AZW', fullName: 'Amazon Kindle eBook', category: 'ebook',
    mimeType: 'application/vnd.amazon.ebook', browser: 'XX',
    description: 'AZW is Amazon\'s original Kindle ebook format, essentially a MOBI file with optional DRM.',
    notes: 'Input only. DRM-protected books cannot be converted.',
  },
  {
    id: 'azw3', name: 'AZW3', fullName: 'Kindle Format 8', category: 'ebook',
    mimeType: 'application/vnd.amazon.mobi8-ebook', browser: 'XX',
    description: 'AZW3 (Kindle Format 8) is Amazon\'s newer ebook format with better typography and HTML5/CSS support than MOBI.',
    notes: 'DRM-protected books cannot be converted.',
  },

  // ---------------------------------------------------------------- Archive --
  {
    id: 'zip', name: 'ZIP', fullName: 'ZIP Archive', category: 'archive',
    mimeType: 'application/zip', mimeTypes: ['application/x-zip-compressed'], browser: 'LL',
    description: 'ZIP is the most common archive format. It bundles files and folders into one compressed file that every operating system can open.',
  },
  {
    id: 'rar', name: 'RAR', fullName: 'Roshal Archive', category: 'archive',
    mimeType: 'application/vnd.rar', mimeTypes: ['application/x-rar-compressed'], browser: 'XX',
    description: 'RAR is a proprietary archive format that often compresses better than ZIP and supports multi-part archives.',
    notes: 'Input only. Creating RAR archives requires proprietary software.',
  },
  {
    id: '7z', name: '7Z', fullName: '7-Zip Archive', category: 'archive',
    mimeType: 'application/x-7z-compressed', browser: 'LX',
    description: '7Z is the open archive format of 7-Zip. Its LZMA compression usually gives smaller files than ZIP.',
  },
  {
    id: 'tar', name: 'TAR', fullName: 'Tape Archive', category: 'archive',
    mimeType: 'application/x-tar', browser: 'LL',
    description: 'TAR bundles many files into a single uncompressed file. It is standard on Linux and macOS and is usually combined with GZ or BZ2 compression.',
  },
  {
    id: 'gz', name: 'GZ', fullName: 'Gzip Compressed File', category: 'archive',
    aliases: ['gzip'], mimeType: 'application/gzip', mimeTypes: ['application/x-gzip'], browser: 'NN',
    description: 'GZ compresses a single file with the gzip algorithm. It is widely used on servers and for web transfer.',
    notes: 'Holds one file only; converting a multi-file archive to GZ needs TAR.GZ.',
  },
  {
    id: 'bz2', name: 'BZ2', fullName: 'Bzip2 Compressed File', category: 'archive',
    aliases: ['bzip2'], mimeType: 'application/x-bzip2', browser: 'XX',
    description: 'BZ2 compresses a single file with the bzip2 algorithm, usually smaller than gzip but slower.',
    notes: 'Holds one file only; converting a multi-file archive to BZ2 needs TAR.BZ2.',
  },
  {
    id: 'tar-gz', extension: 'tar.gz', name: 'TAR.GZ', fullName: 'Gzip-compressed TAR Archive', category: 'archive',
    aliases: ['tgz'], mimeType: 'application/gzip', mimeTypes: ['application/x-gtar', 'application/x-compressed-tar'], browser: 'LL',
    description: 'TAR.GZ (also .tgz) is a TAR archive compressed with gzip. It is the everyday way to package source code and backups on Linux and macOS.',
  },
  {
    id: 'tar-bz2', extension: 'tar.bz2', name: 'TAR.BZ2', fullName: 'Bzip2-compressed TAR Archive', category: 'archive',
    aliases: ['tbz2', 'tbz'], mimeType: 'application/x-bzip2', mimeTypes: ['application/x-bzip-compressed-tar'], browser: 'XX',
    description: 'TAR.BZ2 is a TAR archive compressed with bzip2, giving smaller files than TAR.GZ at the cost of speed.',
  },

  // ----------------------------------------------------------------- Vector --
  {
    id: 'svg', name: 'SVG', fullName: 'Scalable Vector Graphics', category: 'vector', alsoIn: ['image'],
    mimeType: 'image/svg+xml', browser: 'NX',
    traits: { sizeRank: null, alpha: true, compression: 'Vector (XML text)', animation: true, year: 2001, developer: 'W3C', bestFor: 'Logos and icons that scale to any size' },
    description: 'SVG describes an image with shapes and paths written in XML instead of pixels, so it can scale to any size without losing sharpness. It is widely used for logos and icons on websites. To convert an SVG into a pixel format, it is drawn at its own declared size.',
  },
  {
    id: 'eps', name: 'EPS', fullName: 'Encapsulated PostScript', category: 'vector', alsoIn: ['image'],
    mimeType: 'application/postscript', mimeTypes: ['application/eps', 'image/x-eps'], browser: 'XX',
    description: 'EPS is a print-industry vector format based on PostScript. It is still requested by printers and publishers but is not displayed by browsers.',
    notes: 'Needs a server-side renderer (Ghostscript or Inkscape).',
  },
  {
    id: 'ai', name: 'AI', fullName: 'Adobe Illustrator Artwork', category: 'vector',
    mimeType: 'application/illustrator', mimeTypes: ['application/postscript'], browser: 'XX',
    description: 'AI is the native format of Adobe Illustrator. Modern files embed PDF data, which lets other tools read the artwork.',
    notes: 'Input only. Only the PDF-compatible content can be read.',
  },
  {
    id: 'dxf', name: 'DXF', fullName: 'Drawing Exchange Format', category: 'vector', alsoIn: ['cad'],
    mimeType: 'image/vnd.dxf', mimeTypes: ['application/dxf', 'application/x-dxf'], browser: 'LL',
    description: 'DXF is an open CAD exchange format from Autodesk. It carries 2D and 3D drawings between CAD programs, laser cutters and CNC machines.',
  },
];

// --------------------------------------------------------- extended catalog --
// The rest of the catalog (the full CloudConvert-style format list). These are compact
// rows because they share defaults: browser 'XX' unless given, no traits.
//   [id, name, fullName, mimeType, description, extra?]
function more(category, rows, browser = 'XX') {
  rows.forEach(([id, name, fullName, mimeType, description, extra]) => {
    FORMATS.push({ id, name, fullName, category, mimeType, browser, description, ...(extra || {}) });
  });
}

const RAW = (maker) => `Camera RAW image from ${maker} cameras. It keeps the unprocessed sensor data for maximum editing latitude, so files are large and need a RAW decoder before they can be viewed or shared.`;

more('image', [
  ['jfif', 'JFIF', 'JPEG File Interchange Format', 'image/jpeg',
    'JFIF is a JPEG image with a .jfif extension, often produced when saving pictures from a browser. The image data is ordinary JPEG, so it converts to any other image format without extra loss.',
    { browser: 'NN', traits: { sizeRank: 3, alpha: false, compression: 'Lossy', animation: false, year: 1992, developer: 'Joint Photographic Experts Group', bestFor: 'Photographs (same data as JPG)' } }],
  ['3fr', '3FR', 'Hasselblad RAW', 'image/x-hasselblad-3fr', RAW('Hasselblad')],
  ['arw', 'ARW', 'Sony Alpha RAW', 'image/x-sony-arw', RAW('Sony')],
  ['cr2', 'CR2', 'Canon RAW 2', 'image/x-canon-cr2', RAW('Canon')],
  ['cr3', 'CR3', 'Canon RAW 3', 'image/x-canon-cr3', RAW('recent Canon')],
  ['crw', 'CRW', 'Canon RAW', 'image/x-canon-crw', RAW('older Canon')],
  ['dcr', 'DCR', 'Kodak Digital Camera RAW', 'image/x-kodak-dcr', RAW('Kodak')],
  ['dng', 'DNG', 'Digital Negative', 'image/x-adobe-dng', 'DNG is Adobe\'s open RAW image format. Many phones and cameras can save it, and it keeps the unprocessed sensor data for editing.'],
  ['erf', 'ERF', 'Epson RAW', 'image/x-epson-erf', RAW('Epson')],
  ['mos', 'MOS', 'Leaf RAW', 'image/x-leaf-mos', RAW('Leaf')],
  ['mrw', 'MRW', 'Minolta RAW', 'image/x-minolta-mrw', RAW('Minolta')],
  ['nef', 'NEF', 'Nikon Electronic Format', 'image/x-nikon-nef', RAW('Nikon')],
  ['orf', 'ORF', 'Olympus RAW', 'image/x-olympus-orf', RAW('Olympus')],
  ['pef', 'PEF', 'Pentax Electronic File', 'image/x-pentax-pef', RAW('Pentax')],
  ['raf', 'RAF', 'Fujifilm RAW', 'image/x-fuji-raf', RAW('Fujifilm')],
  ['raw', 'RAW', 'Generic RAW image', 'image/x-panasonic-raw', RAW('Panasonic, Leica and other')],
  ['rw2', 'RW2', 'Panasonic RAW 2', 'image/x-panasonic-rw2', RAW('Panasonic')],
  ['x3f', 'X3F', 'Sigma RAW', 'image/x-sigma-x3f', RAW('Sigma')],
  ['icns', 'ICNS', 'Apple Icon Image', 'image/icns', 'ICNS is the macOS application icon format. One file holds several sizes of the same icon.'],
  ['ppm', 'PPM', 'Portable Pixmap', 'image/x-portable-pixmap', 'PPM is a very simple uncompressed image format from the Netpbm toolkit, mostly used as an intermediate format in image-processing pipelines.'],
  ['xcf', 'XCF', 'GIMP Image', 'image/x-xcf', 'XCF is the native layered file format of the GIMP image editor. Only the flattened image can be converted to other formats.'],
  ['odd', 'ODD', 'OpenDocument Drawing', 'application/vnd.oasis.opendocument.graphics', 'ODD is an OpenDocument drawing file created by LibreOffice Draw and similar programs.', { aliases: ['odg'] }],
  ['xps', 'XPS', 'XML Paper Specification', 'application/oxps', 'XPS is Microsoft\'s fixed-layout document format, similar in purpose to PDF. Windows can print to it, but few other programs open it.', { mimeTypes: ['application/vnd.ms-xpsdocument'] }],
]);

more('audio', [
  ['aifc', 'AIFC', 'Compressed Audio Interchange File', 'audio/x-aifc', 'AIFC is a variant of Apple\'s AIFF format that allows compressed audio.'],
  ['ape', 'APE', "Monkey's Audio", 'audio/ape', "APE (Monkey's Audio) is a lossless audio format with high compression. Few players support it, so it is usually converted to FLAC or MP3."],
  ['au', 'AU', 'Sun Audio', 'audio/basic', 'AU is a simple audio format introduced by Sun Microsystems, still found on Unix systems and in Java applications.'],
  ['caf', 'CAF', 'Core Audio Format', 'audio/x-caf', 'CAF is Apple\'s Core Audio container. It has no practical file-size limit and can hold many audio codecs.'],
  ['dss', 'DSS', 'Digital Speech Standard', 'audio/x-dss', 'DSS is a compressed speech format used by Olympus and Philips dictation recorders.'],
  ['m4b', 'M4B', 'MPEG-4 Audiobook', 'audio/x-m4b', 'M4B is an MPEG-4 audio file for audiobooks. It supports chapters and remembers where you stopped listening.'],
  ['oga', 'OGA', 'Ogg Audio', 'audio/ogg', 'OGA is an Ogg container that holds audio only, usually Vorbis, Opus or FLAC.'],
  ['shn', 'SHN', 'Shorten', 'audio/x-shn', 'SHN (Shorten) is an old lossless audio format, mostly found in live concert recording archives.'],
  ['voc', 'VOC', 'Creative Voice', 'audio/x-voc', 'VOC is an audio format created by Creative Labs for Sound Blaster cards, common in old DOS games.'],
  ['weba', 'WEBA', 'WebM Audio', 'audio/webm', 'WEBA is a WebM file that contains only audio, usually Opus or Vorbis. Browsers play it natively.'],
]);

more('cad', [
  ['dwg', 'DWG', 'AutoCAD Drawing', 'image/vnd.dwg', 'DWG is the native drawing format of AutoCAD. It stores 2D and 3D design data and is the most common CAD file format.',
    { mimeTypes: ['application/acad'] }],
]);

more('document', [
  ['abw', 'ABW', 'AbiWord Document', 'application/x-abiword', 'ABW is the native document format of the AbiWord word processor.'],
  ['zabw', 'ZABW', 'Compressed AbiWord Document', 'application/x-abiword-compressed', 'ZABW is a gzip-compressed AbiWord document.'],
  ['djvu', 'DJVU', 'DjVu Document', 'image/vnd.djvu', 'DjVu is a format for scanned documents and books. It keeps high-resolution scans much smaller than PDF.', { aliases: ['djv'] }],
  ['docm', 'DOCM', 'Word Macro-Enabled Document', 'application/vnd.ms-word.document.macroenabled.12', 'DOCM is a Word document that can contain macros. Apart from the macros it is the same as DOCX.'],
  ['dot', 'DOT', 'Word 97-2003 Template', 'application/msword', 'DOT is a legacy Microsoft Word template file used to create new documents with preset styles.'],
  ['dotx', 'DOTX', 'Word Template', 'application/vnd.openxmlformats-officedocument.wordprocessingml.template', 'DOTX is the modern Microsoft Word template format.'],
  ['hwp', 'HWP', 'Hangul Word Processor Document', 'application/x-hwp', 'HWP is the document format of the Hangul word processor, widely used in South Korea.'],
  ['lwp', 'LWP', 'Lotus Word Pro Document', 'application/vnd.lotus-wordpro', 'LWP is the document format of Lotus Word Pro, a discontinued word processor.'],
  ['md', 'MD', 'Markdown', 'text/markdown', 'Markdown is a plain-text format with simple symbols for headings, lists and links. It is popular for README files, notes and documentation.', { aliases: ['markdown'] }],
  ['pages', 'PAGES', 'Apple Pages Document', 'application/vnd.apple.pages', 'PAGES is the document format of Apple Pages. Outside Apple devices it usually has to be converted to DOCX or PDF.'],
  ['rst', 'RST', 'reStructuredText', 'text/x-rst', 'reStructuredText is a plain-text markup format used for Python documentation and Sphinx sites.'],
  ['sdw', 'SDW', 'StarOffice Writer Document', 'application/vnd.stardivision.writer', 'SDW is the document format of StarOffice Writer, the predecessor of OpenOffice and LibreOffice.'],
  ['tex', 'TEX', 'LaTeX Document', 'application/x-tex', 'TEX is a LaTeX source file. LaTeX is the standard typesetting system for scientific papers and maths.'],
  ['wpd', 'WPD', 'WordPerfect Document', 'application/vnd.wordperfect', 'WPD is the document format of Corel WordPerfect, still used in some legal offices.'],
  ['wps', 'WPS', 'Microsoft Works Document', 'application/vnd.ms-works', 'WPS is the word-processor format of Microsoft Works, a discontinued home office suite.'],
]);

more('ebook', [
  ['azw4', 'AZW4', 'Kindle Print Replica', 'application/vnd.amazon.ebook', 'AZW4 (Print Replica) is a Kindle format that wraps a PDF to keep the exact print layout of textbooks.'],
  ['cbc', 'CBC', 'Comic Book Collection', 'application/x-cbc', 'CBC is a collection of comic book archives packaged in one file.'],
  ['cbr', 'CBR', 'Comic Book RAR', 'application/vnd.comicbook-rar', 'CBR is a comic book: a RAR archive of page images, read with comic viewers.'],
  ['cbz', 'CBZ', 'Comic Book ZIP', 'application/vnd.comicbook+zip', 'CBZ is a comic book: a ZIP archive of page images, read with comic viewers.'],
  ['chm', 'CHM', 'Compiled HTML Help', 'application/vnd.ms-htmlhelp', 'CHM is Microsoft\'s compiled help format, also used for some ebooks.'],
  ['fb2', 'FB2', 'FictionBook', 'application/x-fictionbook+xml', 'FB2 (FictionBook) is an XML ebook format popular in Russia and Eastern Europe.'],
  ['htmlz', 'HTMLZ', 'Zipped HTML Ebook', 'application/x-htmlz', 'HTMLZ is a ZIP file with an HTML ebook and its images, as produced by Calibre.'],
  ['lit', 'LIT', 'Microsoft Reader eBook', 'application/x-ms-reader', 'LIT is the ebook format of the discontinued Microsoft Reader app.'],
  ['lrf', 'LRF', 'Sony BroadBand eBook', 'application/x-sony-bbeb', 'LRF is the ebook format of older Sony Reader devices.'],
  ['oeb', 'OEB', 'Open eBook', 'application/oebps-package+xml', 'OEB (Open eBook) is the predecessor of EPUB.'],
  ['pdb', 'PDB', 'Palm eReader Database', 'application/vnd.palm', 'PDB is an ebook format used by Palm OS readers such as eReader.'],
  ['pml', 'PML', 'Palm Markup Language', 'application/x-pml', 'PML is the markup format behind Palm eReader books.'],
  ['prc', 'PRC', 'Mobipocket Book', 'application/x-mobipocket-ebook', 'PRC is a Mobipocket ebook, closely related to MOBI and readable on older Kindles.'],
  ['rb', 'RB', 'Rocket eBook', 'application/x-rocketbook', 'RB is the format of the Rocket eBook reader from the late 1990s.'],
  ['snb', 'SNB', 'Shanda Bambook eBook', 'application/x-snb', 'SNB is the ebook format of the Shanda Bambook reader.'],
  ['tcr', 'TCR', 'Psion eBook', 'application/x-tcr', 'TCR is a compressed text ebook format from Psion handhelds.'],
  ['txtz', 'TXTZ', 'Zipped Text Ebook', 'application/x-txtz', 'TXTZ is a ZIP file containing a text or Markdown ebook and its images, as produced by Calibre.'],
]);

more('presentation', [
  ['pptm', 'PPTM', 'PowerPoint Macro-Enabled Presentation', 'application/vnd.ms-powerpoint.presentation.macroenabled.12', 'PPTM is a PowerPoint presentation that can contain macros.'],
  ['pps', 'PPS', 'PowerPoint 97-2003 Slide Show', 'application/vnd.ms-powerpoint', 'PPS is a legacy PowerPoint file that opens directly as a slide show.'],
  ['ppsx', 'PPSX', 'PowerPoint Slide Show', 'application/vnd.openxmlformats-officedocument.presentationml.slideshow', 'PPSX is a modern PowerPoint file that opens directly as a slide show.'],
  ['pot', 'POT', 'PowerPoint 97-2003 Template', 'application/vnd.ms-powerpoint', 'POT is a legacy PowerPoint template.'],
  ['potx', 'POTX', 'PowerPoint Template', 'application/vnd.openxmlformats-officedocument.presentationml.template', 'POTX is the modern PowerPoint template format.'],
  ['dps', 'DPS', 'Kingsoft Presentation', 'application/kswps', 'DPS is the presentation format of WPS Office (Kingsoft).'],
  ['key', 'KEY', 'Apple Keynote Presentation', 'application/vnd.apple.keynote', 'KEY is the presentation format of Apple Keynote. Outside Apple devices it usually has to be converted to PPTX or PDF.'],
]);

more('spreadsheet', [
  ['xlsm', 'XLSM', 'Excel Macro-Enabled Workbook', 'application/vnd.ms-excel.sheet.macroenabled.12', 'XLSM is an Excel workbook that can contain macros. Apart from the macros it is the same as XLSX.'],
  ['et', 'ET', 'Kingsoft Spreadsheet', 'application/kset', 'ET is the spreadsheet format of WPS Office (Kingsoft).'],
  ['numbers', 'NUMBERS', 'Apple Numbers Spreadsheet', 'application/vnd.apple.numbers', 'NUMBERS is the spreadsheet format of Apple Numbers. Outside Apple devices it usually has to be converted to XLSX or CSV.'],
]);

more('vector', [
  ['ps', 'PS', 'PostScript', 'application/postscript', 'PostScript is a page description language for printers. PS files describe pages as vector graphics and text.', { alsoIn: ['image'] }],
  ['svgz', 'SVGZ', 'Compressed SVG', 'image/svg+xml-compressed', 'SVGZ is an SVG image compressed with gzip, typically 50-80% smaller than the plain SVG.'],
  ['cdr', 'CDR', 'CorelDRAW Drawing', 'application/vnd.corel-draw', 'CDR is the native vector format of CorelDRAW.'],
  ['cgm', 'CGM', 'Computer Graphics Metafile', 'image/cgm', 'CGM is an ISO standard vector format used in technical illustration, aviation and engineering documentation.'],
  ['emf', 'EMF', 'Enhanced Metafile', 'image/emf', 'EMF is a Windows vector graphics format used by Microsoft Office for clip art and charts.'],
  ['wmf', 'WMF', 'Windows Metafile', 'image/wmf', 'WMF is the older 16-bit predecessor of EMF, still common in old Office documents.'],
  ['sk', 'SK', 'Sketch Drawing', 'image/x-sk', 'SK is the drawing format of the Sketch/Skencil vector editor for Linux.'],
  ['sk1', 'SK1', 'sK1 Drawing', 'image/x-sk1', 'SK1 is the drawing format of the sK1 vector editor, a successor to Skencil.'],
  ['vsd', 'VSD', 'Microsoft Visio Drawing', 'application/vnd.visio', 'VSD is the diagram format of Microsoft Visio, used for flowcharts, floor plans and network diagrams.'],
]);

more('video', [
  ['3g2', '3G2', '3GPP2 Multimedia', 'video/3gpp2', '3G2 is a video container for CDMA mobile phones, closely related to 3GP.'],
  ['3gpp', '3GPP', '3GPP Multimedia', 'video/3gpp', '3GPP is the same mobile video container as 3GP, saved with a longer extension.'],
  ['cavs', 'CAVS', 'Chinese AVS Video', 'video/x-cavs', 'CAVS is video encoded with China\'s AVS standard.'],
  ['dv', 'DV', 'Digital Video', 'video/x-dv', 'DV is the format recorded by MiniDV camcorders. It keeps high quality with simple intra-frame compression.'],
  ['dvr', 'DVR', 'Microsoft Digital Video Recording', 'video/x-ms-dvr', 'DVR-MS is the TV recording format of Windows Media Center.'],
  ['mod', 'MOD', 'Camcorder MPEG-2 Video', 'video/x-mod', 'MOD is MPEG-2 video recorded by JVC, Panasonic and Canon tapeless camcorders.'],
  ['rm', 'RM', 'RealMedia', 'application/vnd.rn-realmedia', 'RM is the RealMedia streaming format from RealNetworks, common on the early web.'],
  ['rmvb', 'RMVB', 'RealMedia Variable Bitrate', 'application/vnd.rn-realmedia-vbr', 'RMVB is RealMedia with variable bitrate, once popular for sharing movies online.'],
  ['swf', 'SWF', 'Shockwave Flash', 'application/x-shockwave-flash', 'SWF is an Adobe Flash animation or video. Browsers no longer play Flash, so old SWF videos are converted to MP4.'],
  ['wtv', 'WTV', 'Windows Recorded TV Show', 'video/x-ms-wtv', 'WTV is the TV recording format of newer Windows Media Center versions.'],
]);

more('archive', [
  ['ace', 'ACE', 'ACE Archive', 'application/x-ace-compressed', 'ACE is an old proprietary archive format. It can be extracted, not created.'],
  ['alz', 'ALZ', 'ALZip Archive', 'application/x-alz-compressed', 'ALZ is the archive format of ALZip, popular in South Korea.'],
  ['arc', 'ARC', 'ARC Archive', 'application/x-arc', 'ARC is one of the earliest archive formats, from the DOS era.'],
  ['arj', 'ARJ', 'ARJ Archive', 'application/x-arj', 'ARJ is a DOS-era archive format that supported multi-volume archives.'],
  ['cab', 'CAB', 'Windows Cabinet', 'application/vnd.ms-cab-compressed', 'CAB is the Windows installer archive format used for drivers and system files.'],
  ['cpio', 'CPIO', 'CPIO Archive', 'application/x-cpio', 'CPIO is a Unix archive format used inside RPM packages and Linux initramfs images.'],
  ['deb', 'DEB', 'Debian Package', 'application/vnd.debian.binary-package', 'DEB is the software package format of Debian and Ubuntu Linux.'],
  ['dmg', 'DMG', 'Apple Disk Image', 'application/x-apple-diskimage', 'DMG is the macOS disk image format, used to distribute Mac apps.'],
  ['img', 'IMG', 'Disk Image', 'application/x-raw-disk-image', 'IMG is a raw copy of a disk or floppy, sector by sector.'],
  ['iso', 'ISO', 'ISO Disc Image', 'application/x-iso9660-image', 'ISO is an exact image of a CD, DVD or Blu-ray disc, used to distribute operating systems.'],
  ['jar', 'JAR', 'Java Archive', 'application/java-archive', 'JAR is a ZIP-based archive that packages Java classes and resources.'],
  ['lha', 'LHA', 'LHA Archive', 'application/x-lzh-compressed', 'LHA (also LZH) is an archive format popular in Japan and on the Amiga.', { aliases: ['lzh'] }],
  ['lz', 'LZ', 'Lzip Compressed File', 'application/x-lzip', 'LZ is a single file compressed with lzip, an LZMA-based compressor.'],
  ['lzma', 'LZMA', 'LZMA Compressed File', 'application/x-lzma', 'LZMA is a single file compressed with the LZMA algorithm used by 7-Zip.'],
  ['lzo', 'LZO', 'LZO Compressed File', 'application/x-lzop', 'LZO is a single file compressed with lzop, which favours speed over size.'],
  ['rpm', 'RPM', 'RPM Package', 'application/x-rpm', 'RPM is the software package format of Red Hat, Fedora and SUSE Linux.'],
  ['rz', 'RZ', 'Rzip Compressed File', 'application/x-rzip', 'RZ is a single file compressed with rzip, which works well on very large files.'],
  ['xz', 'XZ', 'XZ Compressed File', 'application/x-xz', 'XZ is a single file compressed with LZMA2. It gives very small files and is common on Linux.'],
  ['z', 'Z', 'Unix Compressed File', 'application/x-compress', 'Z is a single file compressed with the classic Unix compress tool.'],
  ['tar-7z', 'TAR.7Z', '7-Zip-compressed TAR Archive', 'application/x-7z-compressed', 'TAR.7Z is a TAR archive compressed with 7-Zip.', { extension: 'tar.7z' }],
  ['tar-xz', 'TAR.XZ', 'XZ-compressed TAR Archive', 'application/x-xz', 'TAR.XZ is a TAR archive compressed with xz. It is used for Linux kernel and source releases.', { extension: 'tar.xz', aliases: ['txz'] }],
  ['tar-lzo', 'TAR.LZO', 'LZO-compressed TAR Archive', 'application/x-lzop', 'TAR.LZO is a TAR archive compressed with lzop for fast compression.', { extension: 'tar.lzo', aliases: ['tzo'] }],
  ['tar-z', 'TAR.Z', 'Unix-compressed TAR Archive', 'application/x-compress', 'TAR.Z is a TAR archive compressed with the classic Unix compress tool.', { extension: 'tar.z', aliases: ['tz', 'taz'] }],
]);

module.exports = { FORMATS };
