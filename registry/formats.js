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
//   traits       small facts used by existing page copy: sizeRank (higher = usually smaller), alpha
//   notes        caveats worth surfacing to users or future developers

const FORMATS = [
  // ------------------------------------------------------------------ Image --
  {
    id: 'jpg', name: 'JPG', fullName: 'Joint Photographic Experts Group', category: 'image',
    aliases: ['jpeg'], altLabel: 'JPEG', mimeType: 'image/jpeg', browser: 'NN', apiFormat: 'jpeg',
    traits: { sizeRank: 3, alpha: false },
    description: 'JPG (also written JPEG) is the most widely used format for photographs. It uses lossy compression, which keeps files small by discarding fine detail the eye is unlikely to miss. It does not support transparency or animation, and virtually every device, browser and app can open it.',
  },
  {
    id: 'png', name: 'PNG', fullName: 'Portable Network Graphics', category: 'image',
    mimeType: 'image/png', browser: 'NN', apiFormat: 'png',
    traits: { sizeRank: 2, alpha: true },
    description: 'PNG stores images with lossless compression and supports full transparency, which makes it the usual choice for logos, screenshots and graphics with sharp edges. The trade-off is size: a photograph saved as PNG is normally far larger than the same photo saved as JPG or WebP.',
  },
  {
    id: 'webp', name: 'WebP', fullName: 'WebP', category: 'image',
    mimeType: 'image/webp', browser: 'NL', apiFormat: 'webp',
    traits: { sizeRank: 4, alpha: true },
    description: 'WebP is an image format developed by Google. It supports lossy and lossless compression, transparency and animation, and at comparable visual quality its files are usually smaller than JPG or PNG. That is why it is popular for websites, and current versions of all major browsers can display it.',
  },
  {
    id: 'avif', name: 'AVIF', fullName: 'AV1 Image File Format', category: 'image',
    mimeType: 'image/avif', browser: 'NL', apiFormat: 'avif',
    traits: { sizeRank: 5, alpha: true },
    description: 'AVIF is a modern image format built on the AV1 video codec. It supports transparency and high dynamic range, and it often produces the smallest files of any web image format at a given quality. Encoding is slower than for JPG or WebP, and older browsers and some apps cannot open it.',
  },
  {
    id: 'tiff', name: 'TIFF', fullName: 'Tagged Image File Format', category: 'image',
    aliases: ['tif'], mimeType: 'image/tiff', browser: 'LL', apiFormat: 'tiff',
    traits: { sizeRank: 1, alpha: true },
    description: 'TIFF is a flexible, high-quality format used in scanning, print production and professional photography. Files are usually large, and many web browsers cannot display TIFF at all, so images are normally converted before they are published online.',
  },
  {
    id: 'gif', name: 'GIF', fullName: 'Graphics Interchange Format', category: 'image', alsoIn: ['video'],
    mimeType: 'image/gif', browser: 'NL', apiFormat: 'gif',
    traits: { sizeRank: 2, alpha: true },
    description: 'GIF dates from 1987 and is best known for short looping animations. Each frame is limited to 256 colours and transparency is on or off only, so photographs often look banded. It is still handy for simple graphics and animations that need to work everywhere.',
  },
  {
    id: 'bmp', name: 'BMP', fullName: 'Bitmap', category: 'image',
    mimeType: 'image/bmp', mimeTypes: ['image/x-ms-bmp'], browser: 'NL',
    traits: { sizeRank: 0, alpha: false },
    description: 'BMP is a simple image format from Windows that usually stores pixels with little or no compression, so files are large compared with JPG, PNG or WebP. It is rarely used on the web, and converting a BMP is the easiest way to make it small enough to share.',
  },
  {
    id: 'ico', name: 'ICO', fullName: 'Windows Icon', category: 'image',
    mimeType: 'image/x-icon', mimeTypes: ['image/vnd.microsoft.icon'], browser: 'NL', apiFormat: 'ico',
    traits: { sizeRank: null, alpha: true },
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
    id: 'pdf', name: 'PDF', fullName: 'Portable Document Format', category: 'pdf', alsoIn: ['document'],
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
    id: 'docx', name: 'DOCX', fullName: 'Microsoft Word Document', category: 'document',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', browser: 'XX',
    description: 'DOCX is the standard Microsoft Word format. It stores text, styles, images and tables in a zipped XML package.',
    notes: 'Faithful rendering needs a server-side office engine (LibreOffice).',
  },
  {
    id: 'txt', name: 'TXT', fullName: 'Plain Text', category: 'document',
    mimeType: 'text/plain', browser: 'NN',
    description: 'TXT holds plain unformatted text. Every device can open it, but it cannot store fonts, images or layout.',
  },
  {
    id: 'rtf', name: 'RTF', fullName: 'Rich Text Format', category: 'document',
    mimeType: 'application/rtf', mimeTypes: ['text/rtf'], browser: 'XX',
    description: 'RTF is a cross-platform text format that keeps basic formatting such as bold, fonts and lists. It can be opened by most word processors.',
  },
  {
    id: 'odt', name: 'ODT', fullName: 'OpenDocument Text', category: 'document',
    mimeType: 'application/vnd.oasis.opendocument.text', browser: 'XX',
    description: 'ODT is the open standard word-processing format used by LibreOffice and OpenOffice.',
  },
  {
    id: 'html', name: 'HTML', fullName: 'HyperText Markup Language', category: 'document',
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
    traits: { sizeRank: null, alpha: true },
    description: 'SVG describes an image with shapes and paths written in XML instead of pixels, so it can scale to any size without losing sharpness. It is widely used for logos and icons on websites. To convert an SVG into a pixel format, it is drawn at its own declared size.',
  },
  {
    id: 'eps', name: 'EPS', fullName: 'Encapsulated PostScript', category: 'vector',
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

module.exports = { FORMATS };
