'use strict';
// Converter pages under the names people actually search for: "PDF to Word", "Word to PDF",
// "Excel to PDF" ... Each is a working converter (the same engines as /pdf-to-docx etc.) that
// accepts every file type the name covers (Word = DOC, DOCX, ODT, RTF ...), with its own text.
// Only conversions that really work are listed here (no PDF to Excel or PDF to PowerPoint:
// the server cannot do those yet).
//
//   slug, inputs (format ids), outputs (first one is preselected), title (without " | site"),
//   desc (<= 160), h1, intro, sections [[h2, html]], faq [[q, a]], see (related paths)

module.exports = [
  {
    slug: 'pdf-to-word', inputs: ['pdf'], outputs: ['docx', 'rtf', 'txt'],
    title: 'PDF to Word Converter - Free, Editable DOCX',
    desc: 'Convert PDF to Word for free: turn a PDF into an editable DOCX file you can open in Microsoft Word or Google Docs. No sign-up, no watermark, no email.',
    h1: 'PDF to Word Converter',
    intro: 'Turn PDF files into editable Word documents (DOCX) for free. Drop one PDF or many, and download Word files you can change in Microsoft Word, Google Docs or LibreOffice. No sign-up, no email, no watermark.',
    sections: [
      ['How to convert PDF to Word', '<ol><li>Drop your PDF into the box above, or click to choose it. You can add many PDFs at once.</li><li>Word (DOCX) is already selected. Click <strong>Convert</strong>.</li><li>Download each Word file, or all of them together as a ZIP.</li></ol>'],
      ['What you get in the Word file', '<p>The text of your PDF becomes normal, editable Word text: paragraphs, headings, bold and italic, lists and links, with the pictures that are in the PDF. Because a PDF fixes every word to a position on the page and Word flows text from line to line, complex layouts (several columns, text over images, forms) can come out arranged a little differently. For editing, rewriting and copying text this works well; check the result before you send it on.</p>'],
      ['Scanned PDFs', '<p>A scanned PDF is a photo of a page, not text, so there are no words to convert: the Word file will be empty or only contain the image. This converter does not read text from images (OCR). If your PDF is a scan, you can still add or change text on it with our <a href="/edit-pdf">PDF editor</a>.</p>'],
      ['Other ways to get your text out', '<p>Need just the words? Choose <strong>TXT</strong> as the output for plain text. Choose <strong>RTF</strong> for a simple document that opens in any word processor. To go the other way, use <a href="/word-to-pdf">Word to PDF</a>.</p>'],
    ],
    faq: [
      ['Is this PDF to Word converter free?', 'Yes. It is completely free, with no sign-up, no email address, no watermark and no limit on how many files you convert in a day within fair use.'],
      ['Can I edit the Word file after converting?', 'Yes. The result is a normal DOCX file with editable text that opens in Microsoft Word, Google Docs, WPS Office and LibreOffice.'],
      ['Will the formatting stay the same?', 'Text, headings, bold, italic, lists and images come across. Complex layouts with columns, tables drawn as lines or text placed over pictures may be arranged differently, because Word flows text instead of fixing it to positions.'],
      ['Can I convert a scanned PDF to Word?', 'Not into editable text: a scanned page is an image, and this converter does not do OCR. Use the PDF editor to type on top of a scan instead.'],
      ['Can I convert PDF to Word on my phone?', 'Yes. The converter works in the browser on Android and iPhone; the Word file is saved to your downloads.'],
      ['Are my PDF files safe?', 'Files are converted on our server and deleted as soon as the conversion finishes. We never keep, read or share them.'],
    ],
    see: ['/pdf-to-docx', '/word-to-pdf', '/pdf-to-image', '/edit-pdf', '/pdf-to-txt'],
  },
  {
    slug: 'word-to-pdf', inputs: ['docx', 'doc', 'odt', 'rtf', 'dotx', 'dot', 'docm'], outputs: ['pdf'],
    title: 'Word to PDF Converter - Free, Keeps Formatting',
    desc: 'Convert Word to PDF for free: DOC and DOCX files to PDF with fonts, tables and images kept. Many files at once, no sign-up, no watermark.',
    h1: 'Word to PDF Converter',
    intro: 'Convert Word documents (DOCX and DOC) to PDF for free. Your fonts, tables, pictures and page layout stay as they are, so the PDF looks the same on every computer and phone.',
    sections: [
      ['How to convert Word to PDF', '<ol><li>Drop your Word files (DOCX, DOC, ODT or RTF) into the box above. Add as many as you like.</li><li>PDF is already selected. Click <strong>Convert</strong>.</li><li>Download each PDF, or all of them as a ZIP.</li></ol>'],
      ['Why send a PDF instead of a Word file', '<p>A Word file can look different on another computer: missing fonts, moved pictures, different page breaks. A PDF looks exactly the same everywhere and cannot be changed by accident. That is why CVs, invoices, assignments and contracts are usually sent as PDF.</p>'],
      ['What is kept', '<p>The conversion is done by LibreOffice, so text, fonts, headings, tables, images, headers and footers, page numbers and page size all come across. Fonts that are not installed on our server are replaced by a close match; if the exact font matters, embed it in Word before uploading, or check the PDF.</p>'],
      ['Every Word format', '<p>DOCX and DOC from any version of Microsoft Word, Word templates (DOTX, DOT), macro documents (DOCM, macros are not run), OpenDocument (ODT) from LibreOffice and RTF all work. To edit a PDF afterwards, use the <a href="/edit-pdf">PDF editor</a>; to go back to Word, use <a href="/pdf-to-word">PDF to Word</a>.</p>'],
    ],
    faq: [
      ['Is Word to PDF free?', 'Yes, completely free, with no sign-up, no email and no watermark.'],
      ['Does it keep my formatting?', 'Yes. Text, fonts, tables, images, headers, footers and page numbers are kept. A font that is not available on the server is replaced by a similar one.'],
      ['Can I convert DOC files from old versions of Word?', 'Yes. Both DOCX and the older DOC format work, as well as ODT and RTF.'],
      ['Can I convert many Word files at once?', 'Yes. Drop them all in, convert, and download them together as a ZIP.'],
      ['Can I convert Word to PDF on my phone?', 'Yes. It works in the browser on Android and iPhone without an app.'],
      ['Is my document kept on your server?', 'No. It is deleted as soon as the PDF has been made.'],
    ],
    see: ['/docx-to-pdf', '/doc-to-pdf', '/pdf-to-word', '/excel-to-pdf', '/powerpoint-to-pdf'],
  },
  {
    slug: 'excel-to-pdf', inputs: ['xlsx', 'xls', 'ods', 'csv', 'xlsm'], outputs: ['pdf'],
    title: 'Excel to PDF Converter - Free XLSX, XLS to PDF',
    desc: 'Convert Excel to PDF for free: XLSX, XLS and CSV spreadsheets to PDF with tables, borders and charts kept. Many files at once, no sign-up.',
    h1: 'Excel to PDF Converter',
    intro: 'Turn Excel spreadsheets (XLSX, XLS) and CSV files into PDF for free. Tables, borders, colours and charts are kept, ready to print, email or attach to a report.',
    sections: [
      ['How to convert Excel to PDF', '<ol><li>Drop your Excel files (XLSX, XLS, ODS or CSV) into the box above.</li><li>PDF is already selected. Click <strong>Convert</strong>.</li><li>Download the PDFs one by one, or all together as a ZIP.</li></ol>'],
      ['Get the page layout right', '<p>Each worksheet is printed to PDF with the page settings saved in the file. If a wide sheet is split over several pages, set <strong>Page Layout &rarr; Orientation: Landscape</strong> and <strong>Fit to 1 page wide</strong> in Excel before converting. Set a <strong>Print Area</strong> to convert only part of a sheet.</p>'],
      ['What is kept', '<p>Values, number formats, fonts, cell colours, borders, merged cells, images and most charts are kept. Formulas are converted to their results, which is usually what you want in a PDF. For invoices and price lists that need to look polished, try the <a href="/invoice-generator">invoice generator</a>.</p>'],
    ],
    faq: [
      ['Is Excel to PDF free?', 'Yes, free with no sign-up and no watermark.'],
      ['Why is my sheet split over several pages?', 'The sheet is wider than the paper. In Excel set landscape and "Fit to 1 page wide" in Page Layout, save, and convert again.'],
      ['Are all worksheets converted?', 'Yes. Every sheet with content is added to the PDF, using its own print settings.'],
      ['Can I convert CSV to PDF?', 'Yes. CSV files become a simple table in the PDF.'],
      ['Can I convert PDF back to Excel?', 'Not yet; this site does not convert PDF tables to spreadsheets.'],
    ],
    see: ['/xlsx-to-pdf', '/xls-to-pdf', '/csv-to-xlsx', '/word-to-pdf', '/powerpoint-to-pdf'],
  },
  {
    slug: 'powerpoint-to-pdf', inputs: ['pptx', 'ppt', 'odp', 'ppsx', 'pps'], outputs: ['pdf'],
    title: 'PowerPoint to PDF Converter - Free PPTX to PDF',
    desc: 'Convert PowerPoint to PDF for free: PPTX and PPT slides to PDF, one slide per page, with images and fonts kept. No sign-up, no watermark.',
    h1: 'PowerPoint to PDF Converter',
    intro: 'Convert PowerPoint presentations (PPTX, PPT) to PDF for free. Every slide becomes a page with its pictures, colours and fonts, ready to share, print or upload where PowerPoint files are not accepted.',
    sections: [
      ['How to convert PowerPoint to PDF', '<ol><li>Drop your presentations (PPTX, PPT, PPSX or ODP) into the box above.</li><li>PDF is already selected. Click <strong>Convert</strong>.</li><li>Download each PDF, or all together as a ZIP.</li></ol>'],
      ['Why share slides as PDF', '<p>A PDF opens on every phone and computer without PowerPoint, keeps your fonts and layout, and is usually smaller. Teachers and universities often ask for assignments as PDF, and handouts print more reliably from a PDF.</p>'],
      ['What is kept', '<p>Each slide becomes one page with its text, images, shapes, charts and backgrounds. Animations, transitions and videos cannot be shown in a PDF, so they are left out; speaker notes are not included. To make the PDF smaller afterwards, use <a href="/compress-pdf">Compress PDF</a>; to turn slides into pictures, convert <a href="/pptx-to-jpg">PPTX to JPG</a>.</p>'],
    ],
    faq: [
      ['Is PowerPoint to PDF free?', 'Yes, completely free, with no sign-up and no watermark.'],
      ['Are animations kept?', 'No. A PDF shows each slide as a still page; animations, transitions and videos are left out.'],
      ['Can I convert old PPT files?', 'Yes. PPT, PPTX, PPSX slide shows and ODP presentations all work.'],
      ['Why does a font look different?', 'A font that is not installed on our server is replaced by a similar one. Embed fonts in PowerPoint before saving to keep them exactly.'],
      ['Can I convert PDF back to PowerPoint?', 'Not yet; this site does not convert PDF to PPTX.'],
    ],
    see: ['/pptx-to-pdf', '/ppt-to-pdf', '/pptx-to-jpg', '/word-to-pdf', '/compress-pdf'],
  },
  {
    slug: 'image-to-pdf', inputs: ['jpg', 'png', 'webp', 'heic', 'jfif', 'gif', 'bmp', 'tiff', 'avif'], outputs: ['pdf'],
    title: 'Image to PDF Converter - JPG, PNG, HEIC Free',
    desc: 'Convert images to PDF for free: JPG, PNG, HEIC iPhone photos and more. Combine many pictures into one PDF or make one PDF each. No sign-up.',
    h1: 'Image to PDF Converter',
    intro: 'Turn photos and pictures into PDF for free: JPG, PNG, WebP, HEIC (iPhone photos), GIF, BMP and TIFF. Combine many images into one PDF, or make a separate PDF for each one.',
    sections: [
      ['How to convert images to PDF', '<ol><li>Drop your images into the box above, in the order you want them. You can add dozens at once.</li><li>PDF is already selected. Click <strong>Convert</strong>.</li><li>Click <strong>Download all</strong> and choose <strong>One PDF</strong> to combine every image into a single PDF, or <strong>Separate PDFs</strong> to get one file per image.</li></ol>'],
      ['Scan documents with your phone', '<p>Take a photo of each page of a form, receipt or ID card, then drop the photos here and choose One PDF: you get a single document to email or upload. iPhone HEIC photos work without converting them first.</p>'],
      ['Make it smaller', '<p>Photos from phones are large, so a PDF of many photos can be big. Shrink the finished file with <a href="/compress-pdf">Compress PDF</a> before you email it. To add text or a signature to the PDF, use the <a href="/edit-pdf">PDF editor</a>.</p>'],
    ],
    faq: [
      ['Can I combine several images into one PDF?', 'Yes. Convert them all, click Download all and choose One PDF; the pages follow the order of the list.'],
      ['Is it free?', 'Yes, with no sign-up, no watermark and no daily limit within fair use.'],
      ['Does it work with iPhone HEIC photos?', 'Yes. HEIC photos are converted directly.'],
      ['Will the image quality drop?', 'No. Each image is placed on its page at its full resolution. If the PDF is too big to email, make it smaller with Compress PDF.'],
      ['Can I do this on my phone?', 'Yes. Choose photos from your gallery in the browser and download the PDF.'],
    ],
    see: ['/jpg-to-pdf', '/png-to-pdf', '/heic-to-pdf', '/pdf-to-image', '/compress-pdf'],
  },
  {
    slug: 'pdf-to-image', inputs: ['pdf'], outputs: ['jpg', 'png', 'webp'],
    title: 'PDF to Image Converter - Free PDF to JPG, PNG',
    desc: 'Convert PDF to images for free: every page of a PDF to a JPG, PNG or WebP picture in high quality. Download all pages as a ZIP. No sign-up.',
    h1: 'PDF to Image Converter',
    intro: 'Turn every page of a PDF into a picture for free: JPG for small files, PNG for sharp text and graphics, or WebP. Download the pages one by one or all together as a ZIP.',
    sections: [
      ['How to convert PDF to images', '<ol><li>Drop your PDF into the box above.</li><li>Choose JPG, PNG or WebP as the output.</li><li>Click <strong>Convert</strong> and download the pages: a PDF with several pages gives a ZIP with one image per page.</li></ol>'],
      ['JPG, PNG or WebP?', '<p><strong>JPG</strong> gives the smallest files and is best for pages with photos, and for WhatsApp or social media. <strong>PNG</strong> keeps text and lines perfectly sharp, best for documents, diagrams and screenshots. <strong>WebP</strong> is small and sharp, good for websites.</p>'],
      ['Common uses', '<p>Post a page of a PDF on Instagram or WhatsApp, put a flyer on a website, add a page to a presentation, or upload a document where only images are accepted. To go the other way, use <a href="/image-to-pdf">Image to PDF</a>.</p>'],
    ],
    faq: [
      ['Is PDF to image free?', 'Yes, free with no sign-up and no watermark.'],
      ['Is every page converted?', 'Yes. Each page becomes its own image; several pages are downloaded together as a ZIP.'],
      ['Which format has the best quality?', 'PNG keeps text and lines sharpest. JPG is smaller and fine for photos.'],
      ['Can I convert only one page?', 'Convert the PDF and keep the image of the page you need, or remove the other pages first with the PDF editor.'],
    ],
    see: ['/pdf-to-jpg', '/pdf-to-png', '/image-to-pdf', '/pdf-to-word', '/edit-pdf'],
  },
];
