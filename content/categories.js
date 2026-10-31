'use strict';
// Landing-page content for each converter category (/image-converter, /video-converter ...),
// following one template so every category page is useful on its own, not just a list of links:
//   intro    what the category covers and the problem it solves (trusted HTML, 1-2 paragraphs)
//   tasks    the most-used tools in the category: [path, label, one line]
//   howto    { h, steps: [[strong, text]] } for the most common task
//   settings what can be set and the limits (trusted HTML); {{MAX_MB}} is the upload limit
//   uses     everyday reasons people convert these files
//   faq      questions people ask about this kind of file: [[q, a]] (plain text)
//   guides   /guides articles on the topic (slugs)
//
// Describe only what this site's engines really do (see engines/). Links to pages a server
// does not have (an engine not installed) are dropped when the page is built.

module.exports = {
  image: {
    intro: `<p>Photos and graphics come in many formats, and the right one depends on where the picture is going. JPG is the safe choice for photos you share, PNG keeps sharp edges and transparency for logos and screenshots, and WebP and AVIF make web pages faster because the same picture takes far fewer bytes. HEIC, the format iPhones use, often will not open on Windows or upload to websites until it is turned into JPG.</p>
<p>This image converter changes any of these formats into another, and can make the result smaller at the same time. Upload one picture or a whole batch, choose the format, and download each file or all of them in one ZIP.</p>`,
    tasks: [
      ['/heic-to-jpg', 'HEIC to JPG', 'Open iPhone photos anywhere.'],
      ['/png-to-jpg', 'PNG to JPG', 'Smaller files for photos saved as PNG.'],
      ['/jpg-to-png', 'JPG to PNG', 'A lossless copy for editing.'],
      ['/png-to-webp', 'PNG to WebP', 'Lighter images for websites, transparency kept.'],
      ['/jpg-to-webp', 'JPG to WebP', 'Faster pages at the same look.'],
      ['/webp-to-jpg', 'WebP to JPG', 'Open web images in any program.'],
      ['/compress-jpg', 'Compress JPG', 'Make a photo smaller by a chosen percentage.'],
      ['/image-resizer', 'Image Resizer', 'Fit an upload limit such as 50 KB or 100 KB.'],
    ],
    howto: { h: 'How to convert an image', steps: [
      ['Add your images.', 'Click Select File or drop one or more pictures onto the box above.'],
      ['Choose the format.', 'Pick JPG, PNG, WebP, AVIF or another format for each file. Open Options to set the Quality and a maximum size in pixels.'],
      ['Convert and download.', 'Click Convert. Download each picture, or all of them together as a ZIP. Use Compress to make the results smaller in one go.'],
    ] },
    settings: `<ul><li><strong>Quality</strong> (default 75%) sets how much detail lossy formats such as JPG, WebP and AVIF keep. 70 to 80 suits photos; 85 or more suits text and logos.</li>
<li><strong>Resize</strong> limits the longest side to 2560, 1920, 1280 or 800 pixels. Pictures are never enlarged.</li>
<li>Photos are turned upright automatically, and camera data such as GPS location is removed from the result.</li>
<li>Each file can be up to {{MAX_MB}} MB, and many files can be converted at once.</li></ul>`,
    uses: ['Upload iPhone photos to a website or form that only accepts JPG.', 'Speed up a website by serving WebP or AVIF instead of PNG and JPG.', 'Turn a screenshot into a smaller JPG for email, or a JPG into PNG for editing.', 'Make an image small enough for a job portal, an exam form or a school website.'],
    faq: [
      ['Which image format is best?', 'JPG for photos you share, PNG for logos, screenshots and anything with transparency, and WebP or AVIF for websites, where they are much smaller at the same look.'],
      ['Does converting an image reduce its quality?', 'Lossy formats such as JPG, WebP and AVIF are re-encoded at the Quality you choose, which removes detail you can barely see. PNG is lossless. Converting never adds back detail that the original did not have.'],
      ['Can I convert several images at once?', 'Yes. Drop in as many images as you like; each gets its own card, and Download all saves them in one ZIP.'],
    ],
    guides: ['jpg-vs-png-vs-webp', 'png-to-webp-without-losing-quality', 'open-heic-files-on-windows', 'compress-images-for-website', 'best-image-format-for-website', 'resize-image-to-kb'],
  },

  pdf: {
    intro: `<p>PDF is the format for documents that must look the same everywhere, but that also makes them hard to change. Converting a PDF to Word gives you editable text again; turning pictures or Word files into PDF gives you one tidy file to send, print or upload.</p>
<p>These PDF converters rebuild documents from their content: text stays text in its fonts, pictures stay pictures, and ruled tables become real tables, so the result is editable rather than a picture of each page. Scanned PDFs can be read with OCR.</p>`,
    tasks: [
      ['/pdf-to-word', 'PDF to Word', 'Edit a PDF in Word, layout kept.'],
      ['/word-to-pdf', 'Word to PDF', 'Send a document that looks the same everywhere.'],
      ['/jpg-to-pdf', 'JPG to PDF', 'Photos or scans into one PDF.'],
      ['/pdf-to-jpg', 'PDF to JPG', 'Each page as a picture.'],
      ['/excel-to-pdf', 'Excel to PDF', 'Spreadsheets ready to print or share.'],
      ['/compress-pdf', 'Compress PDF', 'Smaller PDFs for email and upload portals.'],
      ['/merge-pdf', 'Merge PDF', 'Several PDFs into one.'],
      ['/ocr-pdf', 'OCR PDF', 'Make scanned PDFs searchable.'],
    ],
    howto: { h: 'How to convert a PDF', steps: [
      ['Add your PDF.', 'Click Select File or drop the PDF onto the box above.'],
      ['Choose what to make.', 'Pick Word, HTML, JPG or another format. For a scanned PDF, choose OCR when asked so its text can be read.'],
      ['Convert and download.', 'Click Convert and download the result. Anything worth knowing, such as a font that had to be replaced, is shown next to the file.'],
    ] },
    settings: `<ul><li><strong>No OCR or OCR</strong>: PDFs with real text are converted from that text; scans are read with OCR (English, Spanish, French, German, Italian, Portuguese and Dutch).</li>
<li>Word files are checked before you can download them, so they open in Microsoft Word.</li>
<li>Each file can be up to {{MAX_MB}} MB; PDF to Word handles up to 150 pages at once.</li></ul>`,
    uses: ['Edit a contract, CV or form you only have as a PDF.', 'Turn phone photos of documents into one PDF to email or upload.', 'Share a Word or Excel file that must look the same on every device.', 'Make a scanned PDF searchable and its text copyable.'],
    faq: [
      ['Will my PDF look the same in Word?', 'Very close: text, fonts, colors, pictures, tables, columns and headers are rebuilt as editable Word content. Unusual fonts that cannot be embedded are replaced by a similar common font, and you are told when that happens.'],
      ['Can I convert a scanned PDF?', 'Yes. Choose OCR and the scanned pages are read with Tesseract, the open-source text recognition engine, before conversion.'],
      ['Is there a page limit?', 'Up to 150 pages for PDF to Word and PDF to HTML, and the upload limit shown in the box for other conversions.'],
    ],
    guides: ['convert-pdf-to-word-keep-formatting', 'reduce-pdf-file-size', 'why-pdf-looks-different-after-conversion', 'convert-jpg-images-to-one-pdf', 'merge-pdf-files', 'convert-excel-to-pdf'],
  },

  document: {
    intro: `<p>Word processors save documents in different formats: DOCX for Microsoft Word, ODT for LibreOffice, RTF for almost anything, and plain text or HTML for the web. When a file will not open, or must be sent as a PDF, converting it fixes the problem.</p>
<p>Documents are converted with LibreOffice and Pandoc, which keep text, headings, lists, tables and pictures as far as the target format allows.</p>`,
    tasks: [
      ['/word-to-pdf', 'Word to PDF', 'A fixed layout for sending and printing.'],
      ['/docx-to-pdf', 'DOCX to PDF', 'Word documents as PDF.'],
      ['/doc-to-docx', 'DOC to DOCX', 'Old Word files in the current format.'],
      ['/odt-to-docx', 'ODT to DOCX', 'LibreOffice documents for Word users.'],
      ['/rtf-to-docx', 'RTF to DOCX', 'Rich Text into Word.'],
      ['/txt-to-pdf', 'TXT to PDF', 'Plain text as a tidy PDF.'],
      ['/html-to-pdf', 'HTML to PDF', 'A web page saved as a document.'],
    ],
    howto: { h: 'How to convert a document', steps: [
      ['Add your document.', 'Click Select File or drop DOCX, DOC, ODT, RTF, TXT or HTML files onto the box above.'],
      ['Choose the format.', 'Pick PDF, DOCX, ODT, RTF, TXT, HTML or EPUB.'],
      ['Convert and download.', 'Click Convert and download the file, or all files in one ZIP.'],
    ] },
    settings: `<ul><li>Fonts the server does not have are replaced by metric-compatible ones (for example Carlito for Calibri), so lines and page breaks stay in place.</li>
<li>Each file can be up to {{MAX_MB}} MB; many files can be converted at once.</li></ul>`,
    uses: ['Send a CV or cover letter as a PDF so it looks the same for the employer.', 'Open an old .doc file in a current version of Word.', 'Share a LibreOffice document with someone who uses Word.', 'Turn notes in plain text into a document you can format.'],
    faq: [
      ['Will my Word layout change when I convert to PDF?', 'The PDF keeps the layout, fonts and pictures of the document. If a font is missing on our server a metric-compatible one is used, so text does not reflow.'],
      ['Can I convert a PDF back to Word?', 'Yes, with PDF to Word, which rebuilds the PDF as an editable document.'],
      ['Which formats are supported?', 'DOCX, DOC, ODT, RTF, TXT, HTML, Markdown and more, to and from each other and PDF.'],
    ],
    guides: ['convert-word-to-pdf-on-phone', 'convert-pdf-to-word-keep-formatting', 'why-pdf-looks-different-after-conversion'],
  },

  audio: {
    intro: `<p>Audio files differ in how much they are compressed and which devices play them. MP3 plays everywhere, AAC and M4A suit Apple devices, WAV and FLAC keep every detail for editing and archiving, and OGG and Opus are common in games and web apps.</p>
<p>This audio converter turns any of these into another format with FFmpeg, the open-source engine behind most media software, at high-quality settings.</p>`,
    tasks: [
      ['/mp4-to-mp3', 'MP4 to MP3', 'The sound from a video.'],
      ['/wav-to-mp3', 'WAV to MP3', 'Much smaller files for sharing.'],
      ['/m4a-to-mp3', 'M4A to MP3', 'iPhone recordings for any player.'],
      ['/flac-to-mp3', 'FLAC to MP3', 'Lossless music for phones and cars.'],
      ['/mp3-to-wav', 'MP3 to WAV', 'For editing software that wants WAV.'],
      ['/mp3-cutter', 'MP3 Cutter', 'Cut a clip or make a ringtone.'],
    ],
    howto: { h: 'How to convert an audio file', steps: [
      ['Add your audio.', 'Click Select File or drop MP3, WAV, M4A, FLAC, OGG or other files onto the box above.'],
      ['Choose the format.', 'Pick MP3, WAV, AAC, M4A, FLAC, OGG or Opus.'],
      ['Convert and download.', 'Click Convert and download each file or all of them as a ZIP.'],
    ] },
    settings: `<ul><li>Lossy formats are made at high bitrates (for example 192 kbps AAC), lossless formats such as WAV and FLAC keep every sample.</li>
<li>Converting a lossy file to a lossless one makes it bigger but does not bring back lost detail.</li>
<li>Each file can be up to {{MAX_MB}} MB.</li></ul>`,
    uses: ['Get the audio track of a lecture, interview or music video.', 'Play voice memos from an iPhone on any device.', 'Shrink large WAV recordings before emailing them.', 'Prepare files for editing software that only accepts WAV.'],
    faq: [
      ['Which audio format has the best quality?', 'WAV and FLAC are lossless and keep every detail. MP3, AAC and Opus are lossy but sound the same to most people at the bitrates used here, in far smaller files.'],
      ['Can I get the audio from a video?', 'Yes. Convert the video to MP3, M4A or WAV and only the sound is kept.'],
      ['Will converting MP3 to WAV improve the sound?', 'No. It makes an uncompressed copy, which is useful for editing, but it cannot restore detail the MP3 removed.'],
    ],
    guides: ['extract-audio-from-video', 'file-format-vs-codec'],
  },

  video: {
    intro: `<p>A video file is a container (MP4, MOV, MKV, WebM, AVI) holding video and audio streams encoded with a codec. When a video will not play, upload or edit, the answer is usually to convert it to MP4 with H.264 video and AAC audio, which works on practically every phone, browser, TV and editor.</p>
<p>This video converter uses FFmpeg to change the container and re-encode the streams when needed, and can turn videos into GIFs or extract their sound.</p>`,
    tasks: [
      ['/mov-to-mp4', 'MOV to MP4', 'iPhone videos for Windows and Android.'],
      ['/mkv-to-mp4', 'MKV to MP4', 'Play MKV files on phones and TVs.'],
      ['/webm-to-mp4', 'WebM to MP4', 'Screen recordings for any player.'],
      ['/avi-to-mp4', 'AVI to MP4', 'Old videos in a modern format.'],
      ['/mp4-to-mp3', 'MP4 to MP3', 'Keep only the sound.'],
      ['/compress-video', 'Compress Video', 'Smaller videos for email and messaging.'],
      ['/trim-video', 'Trim Video', 'Cut the part you need.'],
    ],
    howto: { h: 'How to convert a video', steps: [
      ['Add your video.', 'Click Select File or drop the video onto the box above.'],
      ['Choose the format.', 'MP4 suits almost every use; WebM is for websites; MP3 or M4A keeps only the audio.'],
      ['Convert and download.', 'Click Convert. Large videos take a while; the page shows the progress.'],
    ] },
    settings: `<ul><li>MP4 is made with H.264 video and AAC audio, the most compatible combination.</li>
<li>WebM is made with VP9 video and Opus audio.</li>
<li>Each file can be up to {{MAX_MB}} MB here; use Compress Video for large files.</li></ul>`,
    uses: ['Play iPhone videos on Windows or upload them where MOV is refused.', 'Watch MKV films on a phone or smart TV.', 'Make a screen recording small enough to share.', 'Pull the audio out of a video.'],
    faq: [
      ['Why will my video not play?', 'Usually the player does not support the codec inside the file. Converting to MP4 with H.264 and AAC fixes this on almost every device.'],
      ['Does converting a video lose quality?', 'Re-encoding is lossy, but the settings used here keep the picture visually the same for normal viewing.'],
      ['What is the difference between a format and a codec?', 'The format (MP4, MKV) is the box; the codec (H.264, VP9, AAC) is how the picture and sound inside are compressed. Our guide explains it in detail.'],
    ],
    guides: ['convert-iphone-video-to-mp4', 'file-format-vs-codec', 'extract-audio-from-video'],
  },

  archive: {
    intro: `<p>Archives bundle many files into one and usually compress them. ZIP opens everywhere, 7Z and TAR.XZ compress harder, and TAR.GZ is standard on Linux and for software downloads. RAR is common for downloads but needs extra software to open on some systems.</p>
<p>This archive converter unpacks the archive and packs the same files again in the format you choose, with names in any language kept.</p>`,
    tasks: [
      ['/rar-to-zip', 'RAR to ZIP', 'Open RAR downloads without extra software.'],
      ['/7z-to-zip', '7Z to ZIP', 'A ZIP anyone can open.'],
      ['/zip-to-7z', 'ZIP to 7Z', 'A smaller archive.'],
      ['/tar-gz-to-zip', 'TAR.GZ to ZIP', 'Linux archives for Windows.'],
    ],
    howto: { h: 'How to convert an archive', steps: [
      ['Add your archive.', 'Click Select File or drop a ZIP, RAR, 7Z, TAR or other archive onto the box above.'],
      ['Choose the format.', 'ZIP for anyone, 7Z or TAR.XZ for the smallest file.'],
      ['Convert and download.', 'Click Convert and download the new archive.'],
    ] },
    settings: `<ul><li>Password-protected archives cannot be converted.</li>
<li>To protect the server, an archive may unpack to at most 500 MB.</li>
<li>Each upload can be up to {{MAX_MB}} MB.</li></ul>`,
    uses: ['Open a RAR or 7Z download on a computer without extra software.', 'Send a folder as a ZIP that anyone can open.', 'Make an archive smaller with 7Z.'],
    faq: [
      ['Can I open a RAR file without WinRAR?', 'Yes. Convert it to ZIP here and open it with the tools built into Windows, macOS or your phone.'],
      ['Are file names in other languages kept?', 'Yes. Names with accents, Urdu, Chinese and other scripts are kept, and names from old Windows archives are converted to readable text.'],
    ],
    guides: [],
  },

  ebook: {
    intro: `<p>Ebook readers want different formats: EPUB for most readers and apps, AZW3 and MOBI for older Kindles, and PDF for reading on a computer. Converting lets you read a book on the device you have.</p>
<p>Ebooks are converted with Calibre, the open-source ebook manager, keeping chapters, the table of contents and pictures.</p>`,
    tasks: [
      ['/epub-to-pdf', 'EPUB to PDF', 'Read or print an ebook on any computer.'],
      ['/epub-to-mobi', 'EPUB to MOBI', 'For older Kindle readers.'],
      ['/mobi-to-epub', 'MOBI to EPUB', 'Kindle books for other readers.'],
      ['/azw3-to-epub', 'AZW3 to EPUB', 'Kindle files for Kobo and Apple Books.'],
    ],
    howto: { h: 'How to convert an ebook', steps: [
      ['Add your ebook.', 'Click Select File or drop EPUB, MOBI, AZW3 or other files onto the box above.'],
      ['Choose the format.', 'EPUB for most readers, PDF for a computer, MOBI or AZW3 for older Kindles.'],
      ['Convert and download.', 'Click Convert and send the file to your reader.'],
    ] },
    settings: `<ul><li>Books protected with DRM cannot be converted.</li><li>Each file can be up to {{MAX_MB}} MB.</li></ul>`,
    uses: ['Read an EPUB on a Kindle.', 'Print or annotate a book as PDF.', 'Move your own ebooks between reading apps.'],
    faq: [
      ['Can I convert Kindle books I bought?', 'Only books without DRM. Most bought books are protected and cannot be converted.'],
      ['Does a Kindle read EPUB?', 'Current Kindles accept EPUB through Send to Kindle, which converts it. Older models need MOBI or AZW3.'],
    ],
    guides: ['read-epub-on-kindle'],
  },

  font: {
    intro: `<p>Fonts come as TTF and OTF for computers and WOFF and WOFF2 for websites, where they load much faster. Converting a font lets you use it on a website or install a web font on your computer.</p>
<p>Fonts are converted with open-source font tools, keeping the glyphs and names of the original.</p>`,
    tasks: [
      ['/ttf-to-woff2', 'TTF to WOFF2', 'The smallest font for websites.'],
      ['/woff-to-ttf', 'WOFF to TTF', 'Install a web font on your computer.'],
      ['/otf-to-ttf', 'OTF to TTF', 'For software that only takes TTF.'],
    ],
    howto: { h: 'How to convert a font', steps: [
      ['Add your font.', 'Click Select File or drop TTF, OTF, WOFF or WOFF2 files onto the box above.'],
      ['Choose the format.', 'WOFF2 for websites, TTF or OTF for computers.'],
      ['Convert and download.', 'Click Convert and download the font.'],
    ] },
    settings: '<ul><li>Check the font license before converting or using it on a website.</li><li>Each file can be up to {{MAX_MB}} MB.</li></ul>',
    uses: ['Serve a font on a website as WOFF2 for faster pages.', 'Install a web font on your computer for a design mock-up.'],
    faq: [
      ['Which font format should I use on a website?', 'WOFF2: it is supported by every current browser and is the smallest.'],
      ['Is converting a font legal?', 'It depends on the font license. Many free fonts allow it; commercial fonts often do not. Check the license first.'],
    ],
    guides: [],
  },

  spreadsheet: {
    intro: `<p>Spreadsheets are saved as XLSX by Excel, ODS by LibreOffice and CSV for plain data exchange. Converting them lets you open a file in the program you have, import data into another system, or share a sheet as a PDF that looks the same for everyone.</p>
<p>Spreadsheets are converted with LibreOffice, keeping sheets, values, formulas where the format allows, and print settings for PDF.</p>`,
    tasks: [
      ['/excel-to-pdf', 'Excel to PDF', 'Share or print a sheet as it looks.'],
      ['/xlsx-to-csv', 'XLSX to CSV', 'Data for import into other systems.'],
      ['/csv-to-xlsx', 'CSV to XLSX', 'Open data as a proper spreadsheet.'],
      ['/xls-to-xlsx', 'XLS to XLSX', 'Old Excel files in the current format.'],
    ],
    howto: { h: 'How to convert a spreadsheet', steps: [
      ['Add your spreadsheet.', 'Click Select File or drop XLSX, XLS, ODS or CSV files onto the box above.'],
      ['Choose the format.', 'PDF to share, CSV for data, XLSX for Excel.'],
      ['Convert and download.', 'Click Convert and download the file.'],
    ] },
    settings: '<ul><li>For PDF, the print area, orientation and "fit to page" settings saved in the spreadsheet are used.</li><li>CSV keeps the first sheet only, as values.</li><li>Each file can be up to {{MAX_MB}} MB.</li></ul>',
    uses: ['Send an invoice or report as a PDF.', 'Import a contact list or price list into another system as CSV.', 'Open an old .xls file in a current version of Excel.'],
    faq: [
      ['How do I fit my spreadsheet on one PDF page?', 'Set "fit to one page wide" in the page setup of Excel or LibreOffice and save, then convert. Our Excel to PDF guide shows how.'],
      ['Does CSV keep formulas and formatting?', 'No. CSV holds only values. Keep the XLSX for formulas, colors and several sheets.'],
    ],
    guides: ['convert-excel-to-pdf'],
  },

  presentation: {
    intro: `<p>Slide decks are saved as PPTX by PowerPoint and ODP by LibreOffice Impress. Converting a presentation to PDF is the safest way to send it: it opens on any device with fonts and layout kept, and nobody needs PowerPoint.</p>
<p>Presentations are converted with LibreOffice, slide by slide, keeping text, pictures and layout.</p>`,
    tasks: [
      ['/powerpoint-to-pdf', 'PowerPoint to PDF', 'Share slides that look the same everywhere.'],
      ['/pptx-to-pdf', 'PPTX to PDF', 'PowerPoint files as PDF.'],
      ['/ppt-to-pdf', 'PPT to PDF', 'Old PowerPoint files as PDF.'],
      ['/odp-to-pptx', 'ODP to PPTX', 'Impress slides for PowerPoint users.'],
    ],
    howto: { h: 'How to convert a presentation', steps: [
      ['Add your presentation.', 'Click Select File or drop PPTX, PPT or ODP files onto the box above.'],
      ['Choose the format.', 'PDF to share, PPTX for PowerPoint, ODP for LibreOffice.'],
      ['Convert and download.', 'Click Convert and download the file.'],
    ] },
    settings: '<ul><li>Animations and embedded videos do not carry over to PDF.</li><li>Each file can be up to {{MAX_MB}} MB.</li></ul>',
    uses: ['Send slides to a teacher, client or conference as PDF.', 'Print handouts.', 'Open an old PPT file in a current version of PowerPoint.'],
    faq: [
      ['Are animations kept in the PDF?', 'No. A PDF shows each slide as it looks at the end; animations and videos are not kept.'],
      ['Can I edit the PDF afterwards?', 'Keep the PPTX for editing. Small changes can be made to the PDF in our PDF editor.'],
    ],
    guides: [],
  },

  vector: {
    intro: `<p>Vector graphics stay sharp at any size because they are drawn from shapes, not pixels. SVG is the vector format of the web, EPS and AI come from design software, and DXF from CAD programs.</p>
<p>Vector files are converted with Inkscape, and can also be turned into PNG or PDF for use where vectors are not supported.</p>`,
    tasks: [
      ['/svg-to-png', 'SVG to PNG', 'A picture for apps that do not take SVG.'],
      ['/svg-to-pdf', 'SVG to PDF', 'Print a vector graphic.'],
      ['/eps-to-svg', 'EPS to SVG', 'Design files for the web.'],
      ['/ai-to-svg', 'AI to SVG', 'Illustrator files for the web.'],
    ],
    howto: { h: 'How to convert a vector file', steps: [
      ['Add your file.', 'Click Select File or drop SVG, EPS, AI, PDF or DXF files onto the box above.'],
      ['Choose the format.', 'SVG for the web, PDF for print, PNG for anywhere vectors are not supported.'],
      ['Convert and download.', 'Click Convert and download the result.'],
    ] },
    settings: '<ul><li>Text in EPS and AI files that uses fonts the server does not have may be drawn with a similar font.</li><li>Each file can be up to {{MAX_MB}} MB.</li></ul>',
    uses: ['Put a logo from a designer on a website as SVG.', 'Use an SVG icon in an app that only accepts PNG.', 'Print a vector drawing as PDF.'],
    faq: [
      ['Why use SVG on a website?', 'SVG logos and icons stay sharp on every screen and are often smaller than PNG.'],
      ['Can a PNG be turned into a real vector?', 'Not by conversion: a PNG has pixels, not shapes. Converting PNG to SVG wraps the picture; for real vectors it has to be traced or redrawn.'],
    ],
    guides: ['best-image-format-for-website'],
  },
};
