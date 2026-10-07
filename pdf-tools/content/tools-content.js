'use strict';
// Page copy for every tool, keyed by slug (see lib/tools.js).
// Plain text only: no HTML. The renderer appends the brand name to each title.
module.exports = {
  // ------------------------------------------------------------------ convert
  'pdf-to-word': {
    title: 'Convert PDF to Word (DOCX) Online for Free',
    description: "Convert a PDF to an editable Word document for free. Text, paragraphs, tables and images are rebuilt in a DOCX file you can open in Word.",
    h1: 'PDF to Word',
    lead: 'Turn a PDF into a DOCX file you can edit in Microsoft Word, Google Docs or LibreOffice.',
    intro: [
      "A PDF is great for sharing, but it is awkward when you need to change something. Maybe a colleague sent you a contract as a PDF and you need to rewrite a clause, or you lost the original Word file of your resume and only kept the PDF. This tool rebuilds the document as a Word file so you can edit it like any other document.",
      "The converter looks at how each page is laid out and recreates the text, paragraphs, tables and images in DOCX format where it can. Simple documents usually come out very close to the original. Pages with complex layouts, such as magazines or forms with many columns, may need a few touch-ups after conversion. The service is free, with no sign-up and no watermark.",
    ],
    steps: [
      'Choose a PDF file or drop it onto the page.',
      'Click Convert to Word.',
      'Wait a moment while the layout is rebuilt.',
      'Download your DOCX file and open it in your word processor.',
    ],
    features: [
      { title: 'Keeps the structure', text: 'Paragraphs, tables and images are placed back into the document so you are not left with a wall of loose text.' },
      { title: 'Works with any editor', text: 'The DOCX file opens in Microsoft Word, Google Docs, LibreOffice and Pages.' },
      { title: 'Files deleted right away', text: 'Your PDF is sent over an encrypted connection, converted in a private temporary folder and deleted as soon as you get the result.' },
    ],
    faqs: [
      { q: 'Will the Word file look exactly like my PDF?', a: 'For most text documents it will be very close. Complex layouts with overlapping elements, unusual fonts or many columns may shift a little, so check the result and tidy up where needed.' },
      { q: 'Why is my converted document empty or full of pictures?', a: 'Your PDF is probably a scan, which means each page is just a picture with no real text inside. Run it through OCR PDF first to add a text layer, then convert it to Word.' },
      { q: 'Is there a file size limit?', a: 'You can upload one PDF of up to 100 MB at a time. Very long documents take a little longer to convert.' },
      { q: 'What happens to my file after conversion?', a: 'The uploaded PDF and the Word file are deleted from our server as soon as the result is sent back to you. Nobody looks at your documents, and any leftovers are cleared within an hour.' },
      { q: 'Can I convert on my phone?', a: 'Yes. The tool works in any modern mobile browser, and you can open the DOCX in the Word or Google Docs app.' },
    ],
  },

  'pdf-to-excel': {
    title: 'Convert PDF to Excel Spreadsheet Online',
    description: 'Pull tables out of a PDF and into an Excel XLSX file. Choose one sheet per page or put everything on a single sheet. Free, with no sign-up.',
    h1: 'PDF to Excel',
    lead: 'Get the tables from bank statements, invoices and reports into a spreadsheet you can sort and sum.',
    intro: [
      "Typing numbers from a PDF into a spreadsheet by hand is slow and easy to get wrong. Accountants, bookkeepers and anyone who has to reconcile a bank statement or a supplier price list knows the feeling. This tool finds the tables on each page of your PDF and writes them into an Excel workbook, cell by cell.",
      "You decide how the workbook is organized: one sheet for every page, or all the tables stacked on a single sheet, which is handy when one long table runs across many pages. If a page has no table the tool can detect, its lines of text are still written out row by row so nothing is lost. The converted cells hold values only, so add your own formulas afterwards.",
    ],
    steps: [
      'Select the PDF that contains your tables.',
      'Pick One sheet per page or Everything on one sheet.',
      'Click Convert to Excel.',
      'Download the XLSX file and open it in Excel, Google Sheets or LibreOffice Calc.',
    ],
    features: [
      { title: 'Table detection', text: 'Rows and columns are found on every page and placed into matching spreadsheet cells.' },
      { title: 'Your choice of sheets', text: 'Keep each page on its own sheet or merge everything into one long list.' },
      { title: 'Nothing left behind', text: 'Pages without a clear table still have their text written out line by line.' },
    ],
    faqs: [
      { q: 'Are formulas from the original spreadsheet recreated?', a: 'No. A PDF only stores the numbers you see, not the formulas behind them, so the Excel file contains values. You can add formulas again once the data is in place.' },
      { q: 'Does it work with scanned statements?', a: 'A scan is just a picture of the page, so there is no text to read. Use OCR PDF first to make the text recognizable, then convert the result to Excel.' },
      { q: 'Some columns ended up merged or split. Why?', a: 'Tables without clear lines or with uneven spacing are harder to read. The data is still there, but you may need to move a few cells around after conversion.' },
      { q: 'Is my financial data safe?', a: 'Your file travels over an encrypted HTTPS connection, is processed in a private temporary folder and is deleted right after you receive the spreadsheet. Files are never stored or shared.' },
    ],
  },

  'pdf-to-powerpoint': {
    title: 'Convert PDF to PowerPoint Slides for Free',
    description: 'Turn every page of a PDF into a PowerPoint slide with editable text boxes and shapes. Get a PPTX file you can present or change. Free to use.',
    h1: 'PDF to PowerPoint',
    lead: 'Turn a PDF back into a slide deck you can edit, rearrange and present.',
    intro: [
      "Someone shared their presentation as a PDF and you need to reuse a few slides, update the figures or add your own branding. Rebuilding the deck from scratch takes hours. This tool turns each page of the PDF into a PowerPoint slide so you can pick up where the original author left off.",
      "Each page is imported as one slide, with its text placed in editable text boxes and its drawings kept as shapes you can move or recolor. The result is a standard PPTX file that opens in PowerPoint, Keynote, Google Slides and LibreOffice Impress. It works best with PDFs that were exported from presentation software in the first place.",
    ],
    steps: [
      'Choose the PDF you want to turn into slides.',
      'Click Convert to PowerPoint.',
      'Download the PPTX file.',
      'Open it and edit the text boxes and shapes on each slide.',
    ],
    features: [
      { title: 'One page, one slide', text: 'Every PDF page becomes its own slide in the same order.' },
      { title: 'Editable text boxes', text: 'Text is placed in real text boxes, so you can fix a typo or update a number without retyping the slide.' },
      { title: 'Private processing', text: 'The file is converted on our server and deleted immediately after your download is ready.' },
    ],
    faqs: [
      { q: 'Will animations and transitions come back?', a: 'No. A PDF does not store animations or slide transitions, so the slides arrive static. You can add new ones in PowerPoint.' },
      { q: 'Can I convert a scanned handout?', a: 'A scanned page has no real text, so it will arrive as a picture on the slide. For editable text, run OCR PDF first, but keep in mind the layout may still need work.' },
      { q: 'How large can my PDF be?', a: 'You can upload one PDF of up to 100 MB at a time.' },
      { q: 'Can I use this from a tablet?', a: 'Yes. Upload the PDF from your tablet browser and open the PPTX in the PowerPoint, Keynote or Google Slides app.' },
    ],
  },

  'pdf-to-jpg': {
    title: 'Convert PDF to JPG Images in Your Browser',
    description: 'Save PDF pages as JPG images at 72, 150 or 300 dpi. Pick the pages you want. Files are converted in your browser and never uploaded.',
    h1: 'PDF to JPG',
    lead: 'Save each PDF page as a JPG picture you can post, send or paste into another document.',
    intro: [
      "Sometimes a PDF is the wrong format for the job. You might want to post a flyer on social media, drop a page of a report into a chat, or add a certificate to a slideshow. Turning the pages into JPG images makes them easy to view and share almost anywhere, including apps that cannot open PDFs at all.",
      "Choose a quality setting to match what you need: 72 dpi for quick previews, 150 dpi for screens, or 300 dpi for printing and zooming in. You can convert every page or type just the ones you want. All of the work happens in your browser, so your PDF is never uploaded. If you only need the photos inside the PDF rather than whole pages, use Extract Images from PDF instead.",
    ],
    steps: [
      'Open your PDF with the file picker or drag it in.',
      'Pick an image quality: Small, Normal or High.',
      'Optionally type the pages you want, such as 1-3, 5.',
      'Click Convert to JPG and download the image, or a ZIP if there are several.',
    ],
    features: [
      { title: 'Three quality levels', text: 'Choose 72, 150 or 300 dpi depending on whether the image is for a screen or for print.' },
      { title: 'Pick your pages', text: 'Convert the whole document or only the pages you list.' },
      { title: 'Never leaves your device', text: 'Pages are rendered in your browser with JavaScript, so the file is not sent anywhere.' },
    ],
    faqs: [
      { q: 'How do I get all the pages at once?', a: 'Leave the pages box empty. If more than one page is converted, the images are bundled into a single ZIP file for download.' },
      { q: 'Which quality should I choose?', a: 'Normal (150 dpi) suits most screens and email. Pick High (300 dpi) if you plan to print the image or need small text to stay readable when zoomed in.' },
      { q: 'Is my PDF uploaded anywhere?', a: 'No. The conversion runs entirely in your browser, so your document stays on your computer or phone.' },
      { q: 'Why is it slow with a big document?', a: 'Because the pages are drawn on your own device, very large files or high resolutions depend on its memory and speed. Try fewer pages at a time or a lower dpi.' },
      { q: 'What is the difference between JPG and PNG here?', a: 'JPG files are smaller and work well for photos. PNG is lossless and keeps text and line art crisp, so try PDF to PNG if you see blurry edges.' },
    ],
  },

  'pdf-to-png': {
    title: 'Convert PDF Pages to PNG Images Online',
    description: 'Turn PDF pages into sharp, lossless PNG images at the resolution you choose. Conversion runs in your browser, so your file stays on your device.',
    h1: 'PDF to PNG',
    lead: 'Save PDF pages as crisp PNG images with clean text and sharp lines.',
    intro: [
      "PNG is a lossless image format, which means it keeps text, diagrams and thin lines perfectly sharp. That makes it the better choice for things like charts from a report, floor plans, sheet music or a page of a manual you want to put into documentation or a slide. Photos look fine too, but the files are usually larger than JPGs.",
      "Pick 72, 150 or 300 dpi, and convert all pages or only the ones you name. Everything is done inside your browser, so the PDF never leaves your device, which is useful for internal or private documents. On older phones or with very large files, rendering speed depends on how much memory your device has.",
    ],
    steps: [
      'Choose the PDF you want to convert.',
      'Select Small, Normal or High image quality.',
      'Enter specific pages if you do not need them all.',
      'Click Convert to PNG and save the image or ZIP.',
    ],
    features: [
      { title: 'Lossless quality', text: 'PNG keeps every pixel as rendered, so text and lines stay clean with no blurry artifacts.' },
      { title: 'Good for graphics', text: 'Ideal for diagrams, charts and screenshots that you want to reuse elsewhere.' },
      { title: 'Private by design', text: 'The PDF is processed in your browser and is never uploaded to a server.' },
    ],
    faqs: [
      { q: 'Why are my PNG files bigger than JPGs?', a: 'PNG does not throw any detail away, so it needs more space, especially for photos. If file size matters more than sharpness, use PDF to JPG.' },
      { q: 'Can I get only the pictures inside the PDF?', a: 'This tool saves whole pages. To pull out the embedded photos in their original format and resolution, use Extract Images from PDF.' },
      { q: 'How are several pages delivered?', a: 'A single page downloads as one PNG. Two or more pages are packed into a ZIP file.' },
      { q: 'Does it work on a phone?', a: 'Yes. It runs in mobile browsers too. For long documents at 300 dpi, convert a few pages at a time so your phone does not run out of memory.' },
    ],
  },

  'jpg-to-pdf': {
    title: 'Convert JPG to PDF: Combine Photos Into One File',
    description: 'Combine JPG photos and scans into one PDF. Drag to reorder, pick a page size and margins. Runs in your browser, so images are never uploaded.',
    h1: 'JPG to PDF',
    lead: 'Turn photos of receipts, documents or homework into one tidy PDF.',
    intro: [
      "Many forms and portals only accept PDFs, but what you have is a handful of photos taken with your phone. Students photograph handwritten homework, freelancers snap receipts for expense claims, and job seekers scan certificates one page at a time. This tool puts all those JPG images together into one PDF, in the order you choose.",
      "You can keep each page the same size as its image, or place the images on A4 or US Letter pages with a margin. JPG images are embedded exactly as they are, without being compressed again, so there is no extra loss of quality. The whole process runs in your browser and nothing is uploaded, though very large batches depend on your device's memory.",
    ],
    steps: [
      'Add your JPG images. You can select many at once.',
      'Drag the images into the order you want.',
      'Choose a page size, orientation and margin.',
      'Click Create PDF and download your document.',
    ],
    features: [
      { title: 'Drag to reorder', text: 'Put pages in the right order before you create the PDF, no renaming needed.' },
      { title: 'No quality loss', text: 'JPG files are placed into the PDF as they are, without being re-compressed.' },
      { title: 'Stays on your device', text: 'Images are combined in your browser and are never sent to a server.' },
    ],
    faqs: [
      { q: 'How many images can I combine?', a: 'You can add up to 100 JPG images in one go. The practical limit for very large photos depends on the memory of your device.' },
      { q: 'What does Same as image mean?', a: 'Each page is made exactly the size of its photo, so nothing is scaled or cropped. Choose A4 or US Letter if you want standard pages that print neatly.' },
      { q: 'Can I do this on my phone?', a: 'Yes. Pick photos straight from your gallery in a mobile browser, reorder them and save the PDF. Nothing is uploaded.' },
      { q: 'My PDF is too big to email. What can I do?', a: 'Phone photos are often large. Run the finished PDF through Compress PDF or Reduce PDF Size to make it smaller.' },
    ],
  },

  'png-to-pdf': {
    title: 'Convert PNG Images and Screenshots to PDF',
    description: 'Turn PNG screenshots and images into a single PDF. Reorder pages, choose A4, Letter or image size, and add margins. Works in your browser.',
    h1: 'PNG to PDF',
    lead: 'Collect screenshots, diagrams and PNG graphics into one PDF that is easy to share.',
    intro: [
      "Screenshots pile up quickly: a sequence of steps for a support ticket, proof of a payment, slides from an online class, or design mockups for a client review. Sending them one by one is messy. Putting them into a single PDF keeps them in order and makes them easy to print, attach or archive.",
      "Add your PNG files, drag them into place, and choose whether each page should match the image size or use A4 or US Letter with optional margins. Orientation can follow each image automatically or be fixed to portrait or landscape. Images are combined in your browser, so even confidential screenshots never leave your computer or phone.",
    ],
    steps: [
      'Select the PNG files you want in the PDF.',
      'Drag them into the right order.',
      'Set the page size, orientation and margin.',
      'Click Create PDF to download the result.',
    ],
    features: [
      { title: 'Made for screenshots', text: 'Using Same as image keeps each screenshot at its natural size with no white borders.' },
      { title: 'Standard page sizes', text: 'Choose A4 or US Letter when the PDF needs to print cleanly.' },
      { title: 'No upload needed', text: 'Everything happens in your browser, so private screenshots stay private.' },
    ],
    faqs: [
      { q: 'Do transparent areas stay transparent?', a: 'Transparent parts of a PNG show the white of the page behind them in most PDF viewers.' },
      { q: 'Can I mix JPG and PNG files?', a: 'This page accepts PNG files. For photos, use JPG to PDF, then combine the two PDFs with Merge PDF.' },
      { q: 'What does Auto orientation do?', a: 'With A4 or US Letter, Auto turns each page to portrait or landscape to match the shape of its image, so wide screenshots get wide pages.' },
      { q: 'Is there a limit on the number of images?', a: 'You can add up to 100 PNG files at once. Very large images use more of your device memory, so huge batches may be slow on older phones.' },
    ],
  },

  'word-to-pdf': {
    title: 'Convert Word Documents to PDF Online',
    description: 'Convert DOCX, DOC, ODT and RTF documents to PDF so they look the same on every device. Free, no sign-up, and files are deleted right after.',
    h1: 'Word to PDF',
    lead: 'Save a Word document as a PDF that looks the same on every screen and printer.',
    intro: [
      "When you send a Word file, the layout can change on the other person's computer: a different font, a page break in the wrong place, a table that spills onto the next page. A PDF fixes the layout in place. That is why employers, schools and government offices so often ask for a resume, essay or application as a PDF.",
      "This tool accepts DOCX and older DOC files, as well as ODT from LibreOffice and RTF. The conversion keeps your headings, lists, tables, images, headers and footers. If your document uses a font we do not have installed, a similar-looking font is used instead, so check the result if you rely on a special typeface. Password-protected documents need to be unlocked in Word first.",
    ],
    steps: [
      'Choose your DOCX, DOC, ODT or RTF file.',
      'Click Convert to PDF.',
      'Download the PDF and check that it looks right.',
    ],
    features: [
      { title: 'Several formats', text: 'Works with DOCX, DOC, ODT and RTF documents.' },
      { title: 'Layout stays put', text: 'Your PDF looks the same whoever opens it and on whatever device.' },
      { title: 'Deleted after use', text: 'The uploaded document and the PDF are removed from our server as soon as you have your file.' },
    ],
    faqs: [
      { q: 'Why does a font look different in the PDF?', a: 'If a font used in your document is not installed on our server, a similar one is substituted. For an exact match, use common fonts or export to PDF from Word itself.' },
      { q: 'Can I convert a password-protected Word file?', a: 'No. Remove the password in Word or LibreOffice first, then upload the document again.' },
      { q: 'How large can the document be?', a: 'One file of up to 100 MB at a time, which covers almost any text document, even with many images.' },
      { q: 'Are my documents kept?', a: 'No. Files are processed in a private temporary folder and deleted right after the PDF is sent back. Nobody reads them.' },
      { q: 'Can I combine several Word files into one PDF?', a: 'Convert each document here, then put the PDFs together with Merge PDF.' },
    ],
  },

  'excel-to-pdf': {
    title: 'Convert Excel Spreadsheets to PDF Online',
    description: 'Turn XLSX, XLS, ODS and CSV spreadsheets into PDF files that are easy to share and print. Free to use, and files are deleted after converting.',
    h1: 'Excel to PDF',
    lead: 'Share a spreadsheet as a clean, read-only PDF that anyone can open.',
    intro: [
      "Spreadsheets are made for working, not for sending. If you email a price list, a timesheet or a monthly report as an Excel file, the reader may need the right software, may change a cell by accident, or may see hidden columns you did not mean to share. A PDF shows exactly what you want people to see and nothing more.",
      "Upload an XLSX, XLS, ODS or CSV file and get a PDF back. Each sheet is laid out using the print settings saved in the workbook, such as page orientation, print area and scaling, so it is worth setting those in Excel first if a wide sheet keeps breaking across pages. Fonts that are not installed on our server may be replaced with similar ones.",
    ],
    steps: [
      'Choose your spreadsheet file.',
      'Click Convert to PDF.',
      'Download the PDF and check the page breaks.',
    ],
    features: [
      { title: 'Spreadsheets and CSV', text: 'Accepts XLSX, XLS, ODS and plain CSV files.' },
      { title: 'Uses your print setup', text: 'Orientation, print areas and scaling saved in the workbook are respected.' },
      { title: 'Secure transfer', text: 'Files are sent over HTTPS and deleted as soon as the conversion is done.' },
    ],
    faqs: [
      { q: 'My wide table is split across several pages. How do I fix it?', a: 'In Excel, set the page to landscape and choose Fit all columns on one page in the print settings, save the file, and convert it again.' },
      { q: 'Are all sheets converted?', a: 'Yes, every sheet in the workbook that has content is added to the PDF, one after another.' },
      { q: 'Can I convert a password-protected workbook?', a: 'No. Open it in Excel, remove the password, save, and then upload it here.' },
      { q: 'Will the reader be able to change my numbers?', a: 'A PDF is not a spreadsheet, so cells cannot be edited the way they can in Excel. For extra control, lock the file with Protect PDF.' },
    ],
  },

  'powerpoint-to-pdf': {
    title: 'Convert PowerPoint Presentations to PDF',
    description: 'Convert PPTX, PPT, ODP and PPSX slides to a PDF that opens anywhere. Ideal for handouts and sharing decks by email. Free and private.',
    h1: 'PowerPoint to PDF',
    lead: 'Turn a slide deck into a PDF that is easy to email, print or upload.',
    intro: [
      "A presentation file can be large, depends on the right software and may look different on another computer. Teachers share lecture slides as PDFs, speakers send decks to event organizers, and students submit group projects as PDFs because they open on any phone or laptop without PowerPoint.",
      "Upload a PPTX, PPT, ODP, PPSX or PPS file and you get a PDF with one page per slide. Text, pictures, shapes and backgrounds are kept. Animations, videos and transitions cannot be stored in a PDF, so each slide is shown in its final state. If you used an unusual font, a similar one may be used in its place.",
    ],
    steps: [
      'Choose your presentation file.',
      'Click Convert to PDF.',
      'Download the PDF with one page per slide.',
    ],
    features: [
      { title: 'One slide per page', text: 'Each slide becomes a page in the same order as your deck.' },
      { title: 'Opens anywhere', text: 'Anyone can view the PDF on a phone, tablet or computer, no PowerPoint needed.' },
      { title: 'No copies kept', text: 'Your presentation is deleted from our server as soon as the PDF is delivered.' },
    ],
    faqs: [
      { q: 'Are speaker notes included?', a: 'No, only the slides themselves are converted. Notes stay in your original presentation file.' },
      { q: 'What happens to animations and videos?', a: 'A PDF is a static format, so animations and transitions are dropped and each slide appears fully built. Embedded videos do not play.' },
      { q: 'The PDF is too large to email. What now?', a: 'Slide decks with many photos can be heavy. Run the PDF through Compress PDF to shrink it.' },
      { q: 'Is there a size limit?', a: 'You can upload one presentation of up to 100 MB at a time.' },
    ],
  },

  'html-to-pdf': {
    title: 'Convert a Saved HTML File to PDF',
    description: 'Upload a saved HTML or HTM file and get a PDF back. Scripts and online resources are left out for safety. Free and no account needed.',
    h1: 'HTML to PDF',
    lead: 'Turn an HTML file saved on your computer into a PDF document.',
    intro: [
      "HTML files turn up in more places than you might think: an email newsletter you saved, a report exported from a business tool, an offline help page, or a simple page you wrote yourself. This tool turns that file into a PDF so you can keep it, print it or attach it to an email. Note that it works with a file you upload, not with a web address.",
      "For your safety, scripts in the page are removed and nothing is fetched from the internet during conversion. That means styles written inside the file and images embedded directly in it are shown, but pictures and stylesheets that live on other websites are left out, so such pages will look plainer. For the best result, use a self-contained HTML file.",
    ],
    steps: [
      'Choose a saved .html or .htm file from your device.',
      'Click Convert to PDF.',
      'Download the PDF and check how it looks.',
    ],
    features: [
      { title: 'Works with saved files', text: 'Upload an HTML file from your computer or phone, no live website needed.' },
      { title: 'Safe conversion', text: 'Scripts are stripped out and no outside resources are downloaded while your file is processed.' },
      { title: 'Deleted right after', text: 'The HTML file and the PDF are removed from our server once you have the result.' },
    ],
    faqs: [
      { q: 'Can I enter a website address instead of a file?', a: 'No. This tool converts an HTML file you upload. To capture a live web page, save it from your browser first or use your browser\'s Print to PDF option.' },
      { q: 'Why are images or colors missing from my PDF?', a: 'Images and stylesheets that are loaded from the internet are not downloaded during conversion. Styles written in the file and images embedded in it as data are kept.' },
      { q: 'Does JavaScript run on the page?', a: 'No. Scripts are removed before conversion for safety, so content that only appears after a script runs will not be in the PDF.' },
      { q: 'What is the largest file I can upload?', a: 'One HTML file of up to 100 MB.' },
    ],
  },

  'pdf-to-text': {
    title: 'Extract Text From a PDF to a TXT File',
    description: 'Copy all the text out of a PDF into a plain TXT file. Preview it, copy it with one click or download it. Runs in your browser with no upload.',
    h1: 'PDF to Text',
    lead: 'Pull the words out of a PDF so you can paste, search or reuse them anywhere.',
    intro: [
      "Copying text from a PDF one page at a time is tedious, and the result is often full of odd line breaks. Researchers collecting quotes, writers reusing an old article, and anyone feeding a document into another program just want the plain words. This tool reads the text layer of the whole PDF and gives it to you as a simple TXT file.",
      "You see a preview right away and can copy everything to the clipboard with one button, or download the TXT file. Formatting such as bold text, columns and images is left out on purpose. The extraction happens in your browser, so the document is not uploaded. If your PDF is a scan, there is no text layer to read, so run OCR PDF on it first.",
    ],
    steps: [
      'Choose your PDF.',
      'Click Extract text.',
      'Review the text in the preview.',
      'Copy it to your clipboard or download the TXT file.',
    ],
    features: [
      { title: 'Preview and copy', text: 'See the extracted text on the page and copy it all with a single click.' },
      { title: 'Plain TXT output', text: 'A simple text file that opens in any editor and works with any program.' },
      { title: 'No upload', text: 'Text is read in your browser, so your PDF stays on your device.' },
    ],
    faqs: [
      { q: 'Why is the result empty?', a: 'The PDF is probably a scan or a photo, so the pages are images with no text inside. Use OCR PDF to add a text layer, or Image to Text for single pictures.' },
      { q: 'Is the formatting kept?', a: 'No. You get plain text only. If you need headings, tables and layout, use PDF to Word instead.' },
      { q: 'Why do some words come out in a strange order?', a: 'PDFs with several columns or text boxes do not always store words in reading order. A quick check of the text usually sorts it out.' },
      { q: 'Is it private?', a: 'Yes. The text is extracted in your browser and the file is never sent to a server. Very large PDFs depend on your device\'s memory.' },
    ],
  },

  // ------------------------------------------------------------------ organize
  'merge-pdf': {
    title: 'Merge PDF Files Online for Free',
    description: 'Combine 2 to 50 PDF files into one document in the order you choose. Merging runs in your browser, so your files are never uploaded.',
    h1: 'Merge PDF',
    lead: 'Put several PDFs together into one file, in exactly the order you want.',
    intro: [
      "Job applications often ask for a single file containing your cover letter, resume and references. Accountants want all of last quarter's invoices in one document. Teachers collect worksheets into one pack. Whatever the reason, merging saves you from attaching a pile of separate files and hoping they get read in the right order.",
      "Add between 2 and 50 PDFs, drag them into place and click merge. Every page of every file is copied into the new document. Because it all runs in your browser, the files are never uploaded, which is a plus for personal paperwork. Very large collections depend on your device's memory, so on an older phone it can help to merge in smaller batches.",
    ],
    steps: [
      'Add two or more PDF files.',
      'Drag the files into the order you want.',
      'Click Merge PDF.',
      'Download your combined document.',
    ],
    features: [
      { title: 'Up to 50 files', text: 'Combine anything from two short letters to a large stack of reports in one go.' },
      { title: 'Drag to order', text: 'Move files up and down before merging so the pages come out in sequence.' },
      { title: 'Fully in your browser', text: 'Your PDFs are joined on your own device and never sent to a server.' },
    ],
    faqs: [
      { q: 'Are bookmarks and form fields kept?', a: 'The pages are copied into a new file, so bookmarks, outlines and fillable form fields may not carry over. The visible content of every page stays the same.' },
      { q: 'Can I change the order of pages, not just files?', a: 'Merge first, then open the result in Rearrange PDF Pages to move individual pages around or Delete PDF Pages to drop ones you do not need.' },
      { q: 'Does merging work on a phone?', a: 'Yes. Pick files from your phone storage or cloud drive in a mobile browser. Since nothing is uploaded, it works even on a slow connection once the page has loaded.' },
      { q: 'My merged file is too large. What can I do?', a: 'Run it through Compress PDF to reduce the size, especially if the original files contain photos or scans.' },
      { q: 'Can I merge password-protected PDFs?', a: 'Remove the password first with Unlock PDF, as long as you know it, then merge the files.' },
    ],
  },

  'split-pdf': {
    title: 'Split a PDF Into Separate Files',
    description: 'Split a PDF by page ranges, every few pages or into single pages. Several results are bundled in a ZIP. Free, and it runs right in your browser.',
    h1: 'Split PDF',
    lead: 'Break one large PDF into smaller files by range, by page count or page by page.',
    intro: [
      "A scanner that fed fifty pages into one file, a combined bank download covering a whole year, or a textbook PDF where you only need one chapter for class: these are all cases where one big document should really be several smaller ones. Splitting also helps when an upload form has a size or page limit.",
      "Choose how to split. Type page ranges such as 1-3, 4-8, 9 and each range becomes its own PDF. Or split every N pages, which is perfect for a batch of two-page forms scanned together. Or split every page into its own file. When there is more than one result, they are bundled into a ZIP. The PDF is processed in your browser and never uploaded.",
    ],
    steps: [
      'Open the PDF you want to split.',
      'Choose By page ranges, Every N pages or Every page.',
      'Enter your ranges or the number of pages per file.',
      'Click Split PDF and download the files.',
    ],
    features: [
      { title: 'Three ways to split', text: 'Custom ranges, fixed-size chunks or one file per page.' },
      { title: 'Page preview', text: 'Thumbnails of every page help you see where each section starts and ends.' },
      { title: 'Private and local', text: 'Splitting happens in your browser, so the document stays on your device.' },
    ],
    faqs: [
      { q: 'How do I write page ranges?', a: 'Separate ranges with commas, for example 1-3, 4-8, 9. Each range becomes a separate PDF, and a single number gives a one-page file.' },
      { q: 'How are multiple files delivered?', a: 'When the split produces more than one PDF, they are packed into a ZIP file so you get everything in one download.' },
      { q: 'I just want a few pages, not many files. Which tool?', a: 'Use Extract PDF Pages to click the pages you need and save them as one new PDF.' },
      { q: 'Is there a page limit?', a: 'There is no fixed page limit. Because splitting runs on your device, very large files depend on how much memory your computer or phone has.' },
    ],
  },

  'extract-pdf-pages': {
    title: 'Extract Pages From a PDF and Save Them',
    description: 'Click the pages you need from a PDF and save them as a new file, or as separate PDFs in a ZIP. Pages are copied in your browser, not uploaded.',
    h1: 'Extract PDF Pages',
    lead: 'Pick out just the pages you need and save them as a new PDF.',
    intro: [
      "Often you only need a small part of a long document: the signature page of a contract, the two pages of a report your manager asked about, or the answer key at the back of a workbook. Instead of sending the entire file, pull out the pages that matter and share only those.",
      "Click page thumbnails to select them, or type the page numbers if you already know them. Save the selection as one new PDF, or tick the option to save each page as its own PDF, delivered together in a ZIP. The original file is not changed. Everything runs in your browser, so the document never leaves your device.",
    ],
    steps: [
      'Open your PDF to see a thumbnail of every page.',
      'Click the pages you want to keep, or type their numbers.',
      'Choose whether to save each page as a separate PDF.',
      'Click Extract pages and download the result.',
    ],
    features: [
      { title: 'Click to select', text: 'Visual thumbnails make it easy to find the right pages, even in a long document.' },
      { title: 'One file or many', text: 'Save the pages together or as individual PDFs bundled in a ZIP.' },
      { title: 'Original untouched', text: 'Your source file stays as it was. You only download a new copy.' },
    ],
    faqs: [
      { q: 'What is the difference between Extract and Split?', a: 'Extract lets you hand-pick any pages, even scattered ones, into one file. Split PDF cuts the whole document into parts by ranges or page counts.' },
      { q: 'Does the quality change?', a: 'No. Pages are copied as they are, so text, images and links look exactly the same.' },
      { q: 'Can I do this on my phone?', a: 'Yes. Tap the thumbnails to select pages. The work happens in your mobile browser and nothing is uploaded.' },
      { q: 'Can I remove pages instead of picking the ones to keep?', a: 'Yes, use Delete PDF Pages when it is quicker to mark the few pages you do not want.' },
    ],
  },

  'delete-pdf-pages': {
    title: 'Delete Pages From a PDF Online',
    description: 'Remove blank, duplicate or unwanted pages from a PDF by clicking their thumbnails. Free to use, and the file is processed in your browser.',
    h1: 'Delete PDF Pages',
    lead: 'Remove blank, outdated or unwanted pages and keep the rest.',
    intro: [
      "Scanners love to add blank pages, especially when the back of each sheet is empty. Reports come with an old cover page, a contract has a draft page that should not have been there, or a downloaded statement includes pages of advertising you do not need. Removing them makes the document shorter and easier to read.",
      "Every page is shown as a thumbnail. Click the pages you want to remove and they are marked for deletion, then save the cleaned-up PDF. The remaining pages keep their order and quality. Nothing is uploaded, because the file is handled in your browser. Large documents with hundreds of pages may take a moment to show on slower devices.",
    ],
    steps: [
      'Open your PDF.',
      'Click each page you want to remove.',
      'Check the marked pages, then click Delete pages.',
      'Download the shorter PDF.',
    ],
    features: [
      { title: 'See before you delete', text: 'Thumbnails show exactly which pages are marked for removal.' },
      { title: 'Order is kept', text: 'Remaining pages stay in their original order with no change in quality.' },
      { title: 'Nothing uploaded', text: 'The page removal happens in your browser, so the file stays private.' },
    ],
    faqs: [
      { q: 'Can I undo a deletion?', a: 'Before you save, click a marked page again to unmark it. Your original file is never changed, so you can always start again from it.' },
      { q: 'Will deleting pages make the file smaller?', a: 'Usually yes, as long as the removed pages had their own content. To shrink it further, use Compress PDF.' },
      { q: 'Does it work on tablets?', a: 'Yes. Tap the thumbnails to mark pages. The tool runs in mobile browsers on iPad and Android tablets.' },
      { q: 'Can I keep only a few pages instead?', a: 'If you want to keep a small number of pages, Extract PDF Pages may be faster.' },
    ],
  },

  'rearrange-pdf-pages': {
    title: 'Rearrange and Reorder PDF Pages',
    description: 'Drag and drop PDF pages into a new order, move them with buttons or reverse the whole document. Free, and your file never leaves your browser.',
    h1: 'Rearrange PDF Pages',
    lead: 'Drag pages into the right order and save the PDF.',
    intro: [
      "Pages end up in the wrong order all the time. A double-sided document scanned one side at a time, an appendix that should come before the index, or a merged file where one section landed in the wrong place. Rearranging lets you fix that without printing and rescanning anything.",
      "Each page appears as a thumbnail. Drag pages to their new spot, or use the move buttons if dragging is fiddly on a small screen. A reverse button flips the whole document in one click, which is handy when a scanner fed the pages back to front. When it looks right, save the new order. The work is done in your browser and the file is not uploaded.",
    ],
    steps: [
      'Open your PDF to see all its pages.',
      'Drag pages to a new position, or use the move buttons.',
      'Use Reverse if the whole document is back to front.',
      'Click Save new order and download the PDF.',
    ],
    features: [
      { title: 'Drag and drop', text: 'Move pages with your mouse or finger and see the new order instantly.' },
      { title: 'One-click reverse', text: 'Flip the entire page order when a scan came out backwards.' },
      { title: 'Private by default', text: 'Pages are reordered in your browser, so the document never reaches a server.' },
    ],
    faqs: [
      { q: 'Does reordering affect quality?', a: 'No. Pages are moved, not re-rendered, so text and images stay exactly the same.' },
      { q: 'Some pages are upside down too. Can I fix that here?', a: 'Save the new order, then open the file in Rotate PDF to turn those pages the right way up.' },
      { q: 'Is it easy to use on a phone?', a: 'Yes. Besides dragging, every page has move buttons, which are easier to use on a small touch screen.' },
      { q: 'Can I add pages from another PDF?', a: 'Combine the files with Merge PDF first, then come back here to put all the pages in order.' },
    ],
  },

  'rotate-pdf': {
    title: 'Rotate PDF Pages and Save Them',
    description: 'Turn sideways or upside-down PDF pages by 90 degrees, one page at a time or all at once. Lossless and done in your browser, with no upload.',
    h1: 'Rotate PDF',
    lead: 'Turn sideways or upside-down pages the right way up and save the result.',
    intro: [
      "A scanned contract with one landscape page, a phone scan that came out sideways, or a wide spreadsheet printout that reads vertically: rotating in your PDF viewer only fixes it until you close the file. This tool saves the rotation into the PDF itself, so it opens the right way for everyone.",
      "Turn single pages left or right by 90 degrees, or rotate every page at once. Rotation is lossless: only the page orientation setting changes, so text stays sharp and images are not recompressed. The whole job runs in your browser and the file is not uploaded, which keeps sensitive scans on your own device.",
    ],
    steps: [
      'Open the PDF with the pages you want to turn.',
      'Click the rotate buttons on individual pages, or rotate all pages.',
      'Check the thumbnails until every page looks right.',
      'Click Save rotation and download the PDF.',
    ],
    features: [
      { title: 'Page by page', text: 'Rotate just the pages that need it and leave the others alone.' },
      { title: 'Lossless', text: 'Only the page orientation changes. Content and quality stay exactly the same.' },
      { title: 'No upload', text: 'Your PDF is rotated in the browser and stays on your device.' },
    ],
    faqs: [
      { q: 'Why does my PDF open sideways again in other apps?', a: 'Rotating in a viewer usually only changes the view. Saving the file here stores the rotation in the PDF, so it opens correctly everywhere.' },
      { q: 'Can I rotate by 180 degrees?', a: 'Yes. Rotate the page twice in the same direction to turn it upside down.' },
      { q: 'Will rotating reduce quality?', a: 'No. The page content is not touched, only the instruction that tells viewers which way is up.' },
      { q: 'Does it work on phones?', a: 'Yes. It runs in mobile browsers, which is handy for fixing a sideways scan straight from your phone camera.' },
    ],
  },

  'duplicate-pdf-pages': {
    title: 'Duplicate Pages in a PDF Document',
    description: 'Copy selected PDF pages up to 20 times and insert each copy right after its original. Handy for forms and handouts. Runs in your browser.',
    h1: 'Duplicate PDF Pages',
    lead: 'Make extra copies of selected pages, placed right after the originals.',
    intro: [
      "Sometimes you need the same page more than once. A teacher wants three copies of an answer sheet in one printable file, an event organizer needs a sign-in sheet repeated for each session, or you want a blank form page twice so you can fill one in and keep one clean. Duplicating saves you from merging the same file with itself.",
      "Select the pages to copy, choose how many copies of each you want, from 1 to 20, and save. Each copy is inserted directly after its original page, so the rest of the document keeps its order. The file is processed in your browser and never uploaded. Very long documents with many copies depend on your device's memory.",
    ],
    steps: [
      'Open your PDF and view its pages.',
      'Click the pages you want to duplicate.',
      'Set the number of copies for each selected page.',
      'Click Duplicate pages and download the file.',
    ],
    features: [
      { title: 'Up to 20 copies', text: 'Choose how many times each selected page is repeated.' },
      { title: 'Smart placement', text: 'Copies are placed straight after their original so the document still reads in order.' },
      { title: 'Stays private', text: 'Everything runs in your browser, so your file is never uploaded.' },
    ],
    faqs: [
      { q: 'Where do the copies go?', a: 'Each copy is inserted right after the page it was copied from. If you want them somewhere else, move them with Rearrange PDF Pages afterwards.' },
      { q: 'Can I duplicate the whole document?', a: 'Yes, select every page. For two full copies in a row instead of page-by-page copies, use Merge PDF and add the same file twice.' },
      { q: 'Do the copies look exactly like the original?', a: 'Yes. Pages are copied as they are, with no change in quality.' },
      { q: 'Can I use it on a phone?', a: 'Yes. Tap pages to select them and set the number of copies. Nothing is uploaded.' },
    ],
  },

  // ------------------------------------------------------------------ edit
  'edit-pdf': {
    title: 'Edit PDF Online: Add Text, Images and Shapes',
    description: 'Add text, images, shapes, drawings, highlights, notes and signatures to any PDF. A free online PDF editor that works in your browser.',
    h1: 'Edit PDF',
    lead: 'Add text, pictures, shapes, signatures and notes on top of any PDF page.',
    intro: [
      "This is the full editor, with every tool in one place. Fill in a form that has no fillable fields, add your company logo to a quote, sign a lease, draw an arrow to point out a problem on a plan, or leave a sticky note for a colleague. Text boxes come with a choice of font, size and color, and every object can be moved, resized or deleted until you save.",
      "It is worth knowing what the editor does not do. It adds new content on top of the page; it does not rewrite the text already in the PDF. To change an existing word or number, cover it with the white-out box and type the new text over it. Everything runs in your browser, so the document is never uploaded, and very large files depend on your device's memory.",
    ],
    steps: [
      'Open the PDF you want to edit.',
      'Pick a tool from the toolbar: text, image, shape, pen, highlighter, white-out, signature or note.',
      'Click on the page to add it, then drag to move or resize.',
      'Click Save PDF to download the edited file.',
    ],
    features: [
      { title: 'All tools together', text: 'Text, images, rectangles, ellipses, lines, arrows, freehand drawing, highlighter, white-out, signatures and sticky notes.' },
      { title: 'Change until you save', text: 'Move, resize or delete anything you have added before you download the result.' },
      { title: 'No upload', text: 'Your PDF is edited in the browser and never leaves your device.' },
    ],
    faqs: [
      { q: 'Can I change the existing text in my PDF?', a: 'Not directly. The editor adds new content on top of the page. To replace a word, cover it with the white-out tool and type the new text in a text box on top.' },
      { q: 'Will people see my white-out box?', a: 'It looks like plain white paper on a white page. But the original text is still in the file underneath, so for anything confidential use Redact PDF, which removes it for good.' },
      { q: 'Can I edit a PDF on my phone or tablet?', a: 'Yes. The editor works with touch, so you can tap to place items and drag them with your finger. A larger screen makes precise placement easier.' },
      { q: 'Is a watermark added to my file?', a: 'No. The tool is free and your saved PDF contains only what you added.' },
      { q: 'Do sticky notes show up in other PDF readers?', a: 'Yes. Notes are saved as real PDF comments, so they appear in Adobe Acrobat and other readers that show comments.' },
    ],
  },

  'add-text-to-pdf': {
    title: 'Add Text to a PDF and Fill In Forms',
    description: 'Type text anywhere on a PDF to fill in forms, add labels or write notes. Choose the font, size and color. Free, and it works in your browser.',
    h1: 'Add Text to PDF',
    lead: 'Type anywhere on a PDF, like a typewriter, to fill in forms and add notes.',
    intro: [
      "Plenty of PDF forms are just flat pages with lines and boxes, not real fillable fields. Printing them, writing by hand and scanning them back is a lot of effort for a rental application, a school permission slip or a customs declaration. With this tool you click where the answer goes and type it in.",
      "Choose a font, size and color for each text box so your entries line up with the form. Drag boxes to fine-tune their position. If you made a mistake on the original, or a field is pre-printed with something you need to change, cover it with the white-out box and type over it. The PDF is edited in your browser and never uploaded.",
    ],
    steps: [
      'Open the PDF form or document.',
      'Click on the page where you want to type.',
      'Type your text and adjust the font, size and color.',
      'Drag boxes into place, then click Save PDF.',
    ],
    features: [
      { title: 'Type anywhere', text: 'Place a text box at any spot on any page, no form fields needed.' },
      { title: 'Font, size and color', text: 'Match the look of the form or make your notes stand out.' },
      { title: 'White-out included', text: 'Cover printed text or mistakes with a white box before typing over them.' },
    ],
    faqs: [
      { q: 'Can I edit the text that is already in the PDF?', a: 'No, this tool adds new text on top. To replace existing text, cover it with white-out and type your new text over it.' },
      { q: 'How do I line up text with the boxes on a form?', a: 'Drag the text box until it sits on the line, and lower the font size if the space is small. Zooming in helps with precise placement.' },
      { q: 'Can I add a signature too?', a: 'For a handwritten-style signature, use Sign PDF, or the full Edit PDF tool which has every option.' },
      { q: 'Is my form uploaded anywhere?', a: 'No. Everything happens in your browser, so personal details on the form stay on your device.' },
    ],
  },

  'add-image-to-pdf': {
    title: 'Add an Image or Logo to a PDF Online',
    description: 'Place a PNG or JPG logo, photo or stamp on any page of a PDF, then move and resize it. Free, private, and nothing is uploaded to a server.',
    h1: 'Add Image to PDF',
    lead: 'Place a logo, photo or stamp image anywhere on your PDF pages.',
    intro: [
      "Small businesses add their logo to price lists and quotes, landlords paste a photo of a property into a lease summary, and teachers drop a diagram into a worksheet. Others use a scanned rubber stamp or a company seal on official letters. This tool lets you place any PNG or JPG image wherever you need it on the page.",
      "Choose an image, click the page to place it, then drag the corners to resize it and move it into position. PNG images with a transparent background, such as most logos, blend neatly with the page. You can add several images across different pages before saving. The work happens in your browser, so neither the PDF nor your images are uploaded.",
    ],
    steps: [
      'Open your PDF.',
      'Choose a PNG or JPG image from your device.',
      'Click the page to place it, then drag to move and resize.',
      'Click Save PDF to download the result.',
    ],
    features: [
      { title: 'PNG and JPG', text: 'Use photos, logos, stamps or scanned seals in the two most common image formats.' },
      { title: 'Move and resize', text: 'Drag the image wherever you like and adjust its size until it fits.' },
      { title: 'Private editing', text: 'The PDF and your images stay on your device the whole time.' },
    ],
    faqs: [
      { q: 'How do I get a logo without a white box around it?', a: 'Use a PNG file with a transparent background. JPG images do not support transparency, so they always appear as a rectangle.' },
      { q: 'Can I put the same logo on every page?', a: 'For a repeated logo across many pages, Add Watermark is quicker: choose an image watermark and set the opacity.' },
      { q: 'Can I add a photo from my phone?', a: 'Yes. On a phone or tablet you can choose an image from your gallery and place it with your finger.' },
      { q: 'Will the image lose quality?', a: 'The image is embedded at the quality of the file you choose, so start with a sharp image for the best result.' },
    ],
  },

  'add-shapes-to-pdf': {
    title: 'Draw Shapes, Lines and Arrows on a PDF',
    description: 'Draw rectangles, circles, lines and arrows on a PDF to point things out or frame important areas. A free tool that runs in your browser.',
    h1: 'Add Shapes to PDF',
    lead: 'Draw boxes, circles, lines and arrows to point out what matters on a page.',
    intro: [
      "A simple arrow or circle often explains more than a paragraph. Builders mark changes on floor plans, designers circle problems on a proof, and support teams draw boxes around the button a customer should click in a guide. This tool gives you rectangles, ellipses, straight lines and arrows to do exactly that.",
      "Click and drag on the page to draw a shape, then move it, resize it or delete it if you change your mind. Shapes are added on top of the page and the original content underneath stays as it is. Nothing is uploaded, because the drawing happens in your browser. If you also want comments, use Annotate PDF, which adds sticky notes too.",
    ],
    steps: [
      'Open the PDF you want to mark up.',
      'Choose a rectangle, ellipse, line or arrow.',
      'Click and drag on the page to draw it.',
      'Adjust the shapes, then click Save PDF.',
    ],
    features: [
      { title: 'Four shape tools', text: 'Rectangles, ellipses, lines and arrows cover most markup needs.' },
      { title: 'Easy to adjust', text: 'Select any shape to move it, resize it or remove it before saving.' },
      { title: 'Runs locally', text: 'Plans and drawings stay on your device because nothing is uploaded.' },
    ],
    faqs: [
      { q: 'Can I draw freehand?', a: 'This page focuses on shapes. For freehand drawing use Edit PDF or Annotate PDF, which both include a pen tool.' },
      { q: 'Do shapes cover the content underneath?', a: 'Shapes are drawn on top of the page. The original text and images are still there in the file.' },
      { q: 'Can I use this on a tablet with a stylus?', a: 'Yes. You can draw shapes with a finger or stylus in a mobile browser.' },
      { q: 'How do I draw a perfect circle?', a: 'Choose the ellipse tool and drag out an even square area. You can resize the shape afterwards until it looks right.' },
    ],
  },

  'sign-pdf': {
    title: 'Sign a PDF Online With Your Signature',
    description: 'Draw, type or upload your signature and place it on a PDF. Add the date or initials too. Free, no sign-up, and the file stays in your browser.',
    h1: 'Sign PDF',
    lead: 'Add your handwritten-style signature to a PDF without printing or scanning.',
    intro: [
      "A rental agreement, a permission slip, a freelance contract or an offer letter: many documents just need your signature before you send them back. Printing, signing and scanning takes time and needs equipment you may not have. Here you can sign on screen and send the signed PDF straight away.",
      "Draw your signature with a mouse or your finger, type your name, or upload a photo of your signature. Place it on the page and resize it to fit the line. You can also add text, such as the date, and freehand initials. Signing happens in your browser, so the document is never uploaded.",
    ],
    steps: [
      'Open the PDF you need to sign.',
      'Create your signature: draw it, type it or upload an image.',
      'Click the page to place it and resize it to fit.',
      'Add the date or initials if needed, then click Save signed PDF.',
    ],
    features: [
      { title: 'Three ways to sign', text: 'Draw with a mouse or finger, type your name, or upload a picture of your signature.' },
      { title: 'Date and initials', text: 'Add text and freehand marks wherever the document asks for them.' },
      { title: 'Never uploaded', text: 'Your document and signature stay in your browser from start to finish.' },
    ],
    faqs: [
      { q: 'Is this a legally binding digital signature?', a: 'This tool adds a visual signature, like signing on paper. It is not a certificate-based digital signature that proves identity cryptographically. Many everyday documents accept a visual signature, but check what the other party requires.' },
      { q: 'Can I sign on my phone?', a: 'Yes. Drawing your signature with a finger on a phone or tablet often looks more natural than using a mouse.' },
      { q: 'How do I get a clean uploaded signature?', a: 'Sign in dark ink on white paper, take a well-lit photo or scan, and crop it close. A PNG with a transparent background looks best.' },
      { q: 'Is my signature stored?', a: 'No. Nothing is uploaded, so your signature and document stay on your device.' },
      { q: 'Can I stop people changing the signed file?', a: 'After signing, you can use Protect PDF to add a password and turn off editing permissions.' },
    ],
  },

  'highlight-pdf': {
    title: 'Highlight Text and Areas in a PDF',
    description: 'Mark important passages in a PDF with a see-through highlighter. Draw over any area, text or image. Free to use, and it runs in your browser.',
    h1: 'Highlight PDF',
    lead: 'Mark key passages with a see-through highlighter, just like on paper.',
    intro: [
      "Students highlight definitions in lecture notes, lawyers mark clauses in a contract, and reviewers point out the figures that need checking in a report. A highlighter draws the eye to what matters, and sharing a highlighted PDF tells the reader exactly where to look.",
      "Drag the highlighter over any area of the page to cover it with a see-through color. Because you draw it yourself, it works on text, tables, images and even scanned pages that have no selectable text. There is also a pen for underlining or circling. All marks can be moved or removed before you save, and the file is edited in your browser without being uploaded.",
    ],
    steps: [
      'Open the PDF you want to mark.',
      'Choose the highlighter.',
      'Drag over the passages you want to highlight.',
      'Click Save PDF to download the highlighted file.',
    ],
    features: [
      { title: 'See-through color', text: 'Highlighted text stays readable underneath, just like a real marker.' },
      { title: 'Works on scans', text: 'Since you draw the highlight, it works on scanned pages and images too.' },
      { title: 'Pen included', text: 'Underline, circle or add quick handwritten marks with the freehand pen.' },
    ],
    faqs: [
      { q: 'Do I select text to highlight it?', a: 'No. You drag the highlighter over the area you want, which means it also works on scans and images that have no selectable text.' },
      { q: 'Can I remove a highlight?', a: 'Yes. Before saving, select a highlight and delete it, or move and resize it.' },
      { q: 'Does it work on a tablet?', a: 'Yes. Highlighting with a finger or stylus on a tablet feels much like using a real marker.' },
      { q: 'Can I add comments as well?', a: 'Use Annotate PDF to combine highlights with sticky notes, text and arrows.' },
    ],
  },

  'annotate-pdf': {
    title: 'Annotate a PDF With Comments and Notes',
    description: 'Add sticky notes, comments, arrows, boxes and highlights to a PDF for review and feedback. Notes show up in Adobe Acrobat and other readers.',
    h1: 'Annotate PDF',
    lead: 'Leave sticky notes, comments and markup on a PDF for review or feedback.',
    intro: [
      "Giving feedback on a document by email often turns into a long list like page 4, third paragraph. Annotating puts the comment right where it belongs. Teachers mark up essays, editors review drafts, and teams send notes on a proposal before it goes to a client.",
      "Drop a sticky note anywhere on a page and type your comment. Notes are saved as real PDF comments, so the reader can open them in Adobe Acrobat and most other PDF readers. You also get text boxes, a highlighter, arrows, rectangles and a freehand pen for quick markup. The document is annotated in your browser and is not uploaded.",
    ],
    steps: [
      'Open the PDF you are reviewing.',
      'Choose the note tool and click where your comment belongs.',
      'Type your comment, then add arrows, boxes or highlights as needed.',
      'Click Save PDF and send the annotated file back.',
    ],
    features: [
      { title: 'Real PDF comments', text: 'Sticky notes are saved as standard comments that open in Adobe Acrobat and other readers.' },
      { title: 'Full markup kit', text: 'Notes, text, highlighter, arrows, rectangles and a freehand pen in one place.' },
      { title: 'Private review', text: 'Drafts and confidential documents stay on your device while you work.' },
    ],
    faqs: [
      { q: 'Will my notes appear in Adobe Acrobat?', a: 'Yes. Sticky notes are stored as real PDF comments, so they show up in Acrobat and other readers that support comments.' },
      { q: 'Can the other person reply to my notes?', a: 'They can reply in a PDF reader that supports comment threads, such as Adobe Acrobat Reader.' },
      { q: 'Does annotating change the original text?', a: 'No. Annotations are added on top of the page. The document content underneath stays as it was.' },
      { q: 'Can I annotate on my phone?', a: 'Yes. The tool works in mobile browsers, though a tablet or computer is more comfortable for longer reviews.' },
    ],
  },

  'add-watermark-to-pdf': {
    title: 'Add a Text or Image Watermark to a PDF',
    description: 'Stamp text like CONFIDENTIAL or DRAFT, or your logo, across PDF pages. Set size, color, opacity and angle. Free, and it runs in your browser.',
    h1: 'Add Watermark',
    lead: 'Stamp a word or your logo across your pages to mark them as draft, confidential or yours.',
    intro: [
      "A watermark tells readers how to treat a document before they read a word. Mark a contract as DRAFT so nobody signs the wrong version, stamp CONFIDENTIAL on an internal report, or put your studio logo across photo proofs you send to clients. It also discourages people from passing off your work as their own.",
      "Choose a text or image watermark. For text, set the size and color. For both, choose the opacity and the angle: horizontal, diagonal up, diagonal down or vertical. Place one watermark in the center of each page or tile it across the whole page, and apply it to all pages or only some. The PDF is processed in your browser, so it is never uploaded.",
    ],
    steps: [
      'Open your PDF.',
      'Choose Text or Image and enter your text or pick a PNG or JPG.',
      'Adjust size, color, opacity, angle and placement.',
      'Optionally limit it to certain pages, then click Add watermark.',
    ],
    features: [
      { title: 'Text or logo', text: 'Use any short text or a PNG or JPG image as your watermark.' },
      { title: 'Full control', text: 'Set opacity, angle and size, and place it once in the center or tiled across the page.' },
      { title: 'Choose the pages', text: 'Watermark every page or just the ones you list.' },
    ],
    faqs: [
      { q: 'Can someone remove my watermark?', a: 'A watermark makes copying and misuse less tempting, but someone with PDF editing software and enough effort may still be able to remove it. For more control, also lock the file with Protect PDF.' },
      { q: 'What opacity should I use?', a: 'Around 20 to 30 percent keeps the text underneath readable while the watermark is clearly visible.' },
      { q: 'Does it work on a phone?', a: 'Yes. You can set up and add a watermark in a mobile browser. Very large PDFs depend on your device memory.' },
      { q: 'Is my document uploaded?', a: 'No. The watermark is added in your browser, so the file never leaves your device.' },
    ],
  },

  // ------------------------------------------------------------------ security
  'protect-pdf': {
    title: 'Password Protect a PDF With AES-256',
    description: 'Lock a PDF with a password using AES-256 encryption and decide whether printing, copying and editing are allowed. Free and no sign-up.',
    h1: 'Protect PDF',
    lead: 'Add a password so only the people you choose can open your PDF.',
    intro: [
      "Payslips, medical letters, tax returns and signed contracts often travel by email, and email gets forwarded, misdirected or stored for years. A password means that even if the file ends up in the wrong inbox, nobody can open it without the key. Share the password separately, for example by text message or phone.",
      "Your PDF is encrypted with AES-256, a strong modern standard supported by all major PDF readers. You can also choose whether people who open the file may print it, copy its text or edit it. The file is sent over an encrypted connection, locked on our server in a private temporary folder, and deleted together with the result as soon as you have downloaded it.",
    ],
    steps: [
      'Choose the PDF you want to protect.',
      'Type a password of at least 4 characters and repeat it.',
      'Choose whether to allow printing, copying text and editing.',
      'Click Protect PDF and download the locked file.',
    ],
    features: [
      { title: 'AES-256 encryption', text: 'A strong, widely supported standard that opens in Adobe Acrobat, browsers and phone PDF apps.' },
      { title: 'Set permissions', text: 'Allow or block printing, copying and editing for anyone who opens the file.' },
      { title: 'Nothing kept', text: 'Your file and the protected copy are deleted from our server right after download.' },
    ],
    faqs: [
      { q: 'What if I forget the password?', a: 'We cannot recover it. We do not store your password or your file, so keep a note of the password somewhere safe, or keep an unprotected copy.' },
      { q: 'How strong should my password be?', a: 'The minimum is 4 characters, but longer is much safer. A phrase of several words is both strong and easy to remember.' },
      { q: 'Can people still print the file?', a: 'Only if you leave Allow printing ticked. Readers that respect PDF permissions will block what you switched off.' },
      { q: 'How do I remove the password later?', a: 'Use Unlock PDF and enter the password you set.' },
      { q: 'Is there a size limit?', a: 'You can protect one PDF of up to 100 MB at a time.' },
    ],
  },

  'unlock-pdf': {
    title: 'Unlock a PDF and Remove Its Password',
    description: 'Remove the password from a PDF you can open, so you do not have to type it every time. You need the current password. Free and private.',
    h1: 'Unlock PDF',
    lead: 'Remove the open password from a PDF when you already know it.',
    intro: [
      "Banks, utilities and payroll services often send statements locked with a password such as your date of birth. That protects them in transit, but typing the password every time you open the file gets old, and some apps and upload forms refuse locked PDFs entirely. Unlocking gives you a plain copy that opens straight away.",
      "Enter the password you normally use to open the file and we save a copy without it. Any permission restrictions on printing, copying or editing are removed at the same time. This tool does not guess or crack passwords: if you do not know the password, it cannot help. Please only unlock files that you own or have permission to change.",
    ],
    steps: [
      'Choose the locked PDF.',
      'Type the password you use to open it.',
      'Click Unlock PDF.',
      'Download the copy that opens without a password.',
    ],
    features: [
      { title: 'One-time password', text: 'Enter it once here and never again when opening the unlocked copy.' },
      { title: 'Restrictions removed', text: 'Print, copy and edit limits are lifted along with the password.' },
      { title: 'Deleted after use', text: 'The locked file and unlocked copy are removed from our server right after download.' },
    ],
    faqs: [
      { q: 'I forgot the password. Can you unlock it?', a: 'No. We do not crack or guess passwords. Try the sender\'s usual format, such as a date of birth or account number, or ask them to send an unlocked copy.' },
      { q: 'My PDF opens without a password but will not print. Which tool?', a: 'That file has permission restrictions only. Use Remove PDF Restrictions, or upload it here and leave the password box empty.' },
      { q: 'Is it safe to type my password here?', a: 'The password and file are sent over an encrypted HTTPS connection, used only to open the file, and not stored. The files are deleted once you have the result.' },
      { q: 'Is it legal to unlock a PDF?', a: 'Unlocking your own documents, or ones you have permission to change, is fine. Do not use the tool on files you are not entitled to open.' },
    ],
  },

  'remove-pdf-restrictions': {
    title: 'Remove Print, Copy and Edit Restrictions From a PDF',
    description: 'Lift print, copy and edit restrictions from a PDF that opens without a password. For documents you have the right to modify. Free.',
    h1: 'Remove PDF Restrictions',
    lead: 'Allow printing, copying and editing in a PDF that opens without a password.',
    intro: [
      "Some PDFs open normally but gray out the print button or stop you copying text. That is a permissions setting, sometimes called an owner password, and it is often left on by accident when a document is exported. It gets in the way when you need to print your own paperwork, quote a passage, or fill in a form.",
      "This tool rewrites the file without those restrictions, so printing, copying and editing work again. It is meant for PDFs that open without a password. If you are asked for a password just to view the file, use Unlock PDF instead. Please only use it on documents you have the right to modify. Files are deleted from our server as soon as you have your copy.",
    ],
    steps: [
      'Choose the restricted PDF.',
      'Click Remove restrictions.',
      'Download the copy with all permissions allowed.',
    ],
    features: [
      { title: 'Print again', text: 'Get back the ability to print a document that has printing turned off.' },
      { title: 'Copy and edit', text: 'Select and copy text, or edit the file in other PDF tools.' },
      { title: 'No password needed', text: 'Works on files that open normally but have limits on what you can do.' },
    ],
    faqs: [
      { q: 'How do I know if my PDF has restrictions?', a: 'If printing or copying is grayed out, or your PDF reader shows a lock icon or a Secured label while the file still opens without a password, it has permission restrictions.' },
      { q: 'What if the file asks for a password to open?', a: 'Then it is encrypted with an open password. Use Unlock PDF and enter that password.' },
      { q: 'Will the content change?', a: 'No. Pages, text and images stay exactly the same. Only the permission settings are removed.' },
      { q: 'What happens to my file?', a: 'It is uploaded over HTTPS, processed in a private temporary folder and deleted right after the result is sent back. Files are never stored or shared.' },
    ],
  },

  'redact-pdf': {
    title: 'Redact a PDF: Black Out Sensitive Information',
    description: 'Black out names, numbers and images in a PDF so they are permanently removed, not just covered. Redaction runs in your browser for privacy.',
    h1: 'Redact PDF',
    lead: 'Permanently black out personal or confidential details before you share a document.',
    intro: [
      "Before you share a bank statement with a landlord, a contract with a journalist or a medical report with an employer, you may need to hide account numbers, addresses or names. Drawing a black box in an ordinary editor is not enough: the text underneath can often still be copied out. Real redaction removes it.",
      "Draw black boxes over everything you want to hide. When you save, each page with a redaction is turned into an image at about 200 dpi, so the hidden text and pictures are gone for good, not just covered. Those pages lose their selectable text, while pages without redactions are left untouched. You can also remove document properties such as title and author. It all runs in your browser.",
    ],
    steps: [
      'Open the PDF that contains sensitive details.',
      'Drag black boxes over the text and images to hide.',
      'Choose whether to remove document properties too.',
      'Click Redact and save, then check the result before sharing.',
    ],
    features: [
      { title: 'Truly removed', text: 'Redacted pages are flattened into images, so nothing hidden can be copied or recovered.' },
      { title: 'Other pages untouched', text: 'Only pages you redact are flattened. The rest keep their text and quality.' },
      { title: 'Never uploaded', text: 'Sensitive documents are redacted in your browser and stay on your device.' },
    ],
    faqs: [
      { q: 'Why can I no longer select text on some pages?', a: 'Pages with redactions are turned into images so the hidden content is gone completely. That also removes the text layer on those pages. Pages without redactions keep their selectable text.' },
      { q: 'How is this different from the white-out tool?', a: 'White-out in Edit PDF only covers content, which is still in the file underneath. Redact PDF removes it permanently.' },
      { q: 'Can I make redacted pages searchable again?', a: 'You can run the result through OCR PDF to add a new text layer. The redacted parts stay black and are not recovered.' },
      { q: 'Is my document uploaded to a server?', a: 'No. Redaction happens entirely in your browser. Very large documents depend on your device\'s memory.' },
      { q: 'What does removing document properties do?', a: 'It clears hidden details such as title, author and the software used, which can reveal more than you intend.' },
    ],
  },

  // ------------------------------------------------------------------ optimize
  'compress-pdf': {
    title: 'Compress PDF Files to Reduce Their Size',
    description: 'Make a PDF smaller for email and uploads. Choose light, recommended or strong compression, and text stays sharp. Free, with no sign-up.',
    h1: 'Compress PDF',
    lead: 'Shrink a heavy PDF so it fits in an email or an upload form.',
    intro: [
      "PDFs full of photos or scans can easily run to tens of megabytes, too big for most email attachments and slow to open on a phone. Compressing mainly shrinks the images inside the file, which is usually where the weight is. Text stays as sharp vector text, so it remains crisp at any zoom level.",
      "Pick a level. Light keeps images at around 300 dpi for print quality. Recommended uses about 150 dpi, a good balance for screens. Strong goes down to about 72 dpi for the smallest file. If compression would not make your PDF any smaller, you get the original back and we tell you so. Files are deleted from our server as soon as you have the result.",
    ],
    steps: [
      'Choose the PDF you want to make smaller.',
      'Pick Light, Recommended or Strong compression.',
      'Click Compress PDF.',
      'Download the smaller file and check how much space you saved.',
    ],
    features: [
      { title: 'Three levels', text: 'Choose between best quality, a balanced result or the smallest possible file.' },
      { title: 'Sharp text', text: 'Images are reduced while text stays as crisp vector text.' },
      { title: 'Never bigger', text: 'If the compressed file would not be smaller, you get your original back.' },
    ],
    faqs: [
      { q: 'Which level should I choose?', a: 'Recommended suits most documents you read on screen. Use Light if you plan to print, and Strong when you need the smallest file and image quality matters less.' },
      { q: 'Why did my file not get smaller?', a: 'Files that are mostly text, or that were already compressed, have little left to save. In that case we return your original. Optimize PDF may still trim a little without touching quality.' },
      { q: 'I need the file under a specific size. What can I do?', a: 'Try Reduce PDF Size, where you pick the exact image resolution and can switch to grayscale for extra savings.' },
      { q: 'What is the maximum file size?', a: 'You can upload one PDF of up to 100 MB at a time.' },
      { q: 'Are my files stored?', a: 'No. The upload and the compressed file are deleted right after the result is sent back. Any leftovers are cleared within an hour.' },
    ],
  },

  'optimize-pdf': {
    title: 'Optimize a PDF Without Losing Quality',
    description: 'Clean up and restructure a PDF without changing image quality. Remove unused data and enable fast web view for quicker opening online.',
    h1: 'Optimize PDF',
    lead: 'Tidy up a PDF and make it open faster, without touching its quality.',
    intro: [
      "Every time a PDF is edited and saved, leftover data can build up inside it: old objects nobody uses, uncompressed sections and inefficient structure. Optimizing rewrites the file cleanly. It is a good final step for documents you publish on a website, attach to an online course, or store in an archive.",
      "The process is lossless. Internal data is compressed, unused objects are removed, and nothing visible changes, so images keep their exact quality. You can also turn on fast web view, which lets browsers show the first page before the whole file has downloaded. Size savings are usually smaller than with Compress PDF, because images are left as they are.",
    ],
    steps: [
      'Choose your PDF.',
      'Leave Optimize for fast web view on if the file will be viewed online.',
      'Click Optimize PDF.',
      'Download the cleaned-up file.',
    ],
    features: [
      { title: 'Lossless cleanup', text: 'Unused objects are removed and internal data is compressed with no change to how the PDF looks.' },
      { title: 'Fast web view', text: 'The first page shows up in browsers before the whole file has finished downloading.' },
      { title: 'Safe for archives', text: 'Images and text are untouched, so the document stays exactly as it was.' },
    ],
    faqs: [
      { q: 'How is this different from Compress PDF?', a: 'Compress PDF lowers image resolution to save a lot of space. Optimize PDF only restructures the file, so quality stays the same but savings are usually smaller.' },
      { q: 'What is fast web view?', a: 'Also called linearization, it reorders the file so a browser can display page 1 straight away while the rest of the document is still loading.' },
      { q: 'Can optimizing damage my PDF?', a: 'It rewrites the structure without changing content. If a file is already damaged, try Repair PDF first.' },
      { q: 'What happens to my upload?', a: 'It is processed in a private temporary folder and deleted, along with the result, as soon as you have your download.' },
    ],
  },

  'reduce-pdf-size': {
    title: 'Reduce PDF Size for Uploads and Email',
    description: 'Pick the image resolution and get a PDF small enough for job portals, government forms and email. Optional grayscale for extra savings.',
    h1: 'Reduce PDF Size',
    lead: 'Get your PDF under an upload limit by choosing the image resolution yourself.',
    intro: [
      "Job portals, university applications, visa and government forms often set a strict limit, such as 2 MB or even 500 KB, and a scanned passport or certificate can be far over it. This tool gives you direct control: choose how much detail to keep in the images and watch the file size drop.",
      "Pick 200 dpi for print quality, 150 dpi for clear on-screen reading, 110 dpi for a smaller file, or 72 dpi for the smallest. For scans of black and white documents, switching to grayscale saves even more. If you are still over the limit, try a lower setting. Files are uploaded securely and deleted from our server as soon as you have your result.",
    ],
    steps: [
      'Choose the PDF that is too large.',
      'Pick an image resolution between 200 and 72 dpi.',
      'Tick grayscale if color is not needed.',
      'Click Reduce size and check the new file size.',
    ],
    features: [
      { title: 'You pick the resolution', text: 'Four clear settings from print quality to smallest file.' },
      { title: 'Grayscale option', text: 'Drop color from scans and forms for a much smaller file.' },
      { title: 'Built for limits', text: 'Ideal for online applications, portals and email attachments with size caps.' },
    ],
    faqs: [
      { q: 'Which setting gets me under 1 MB?', a: 'It depends on the number of pages and images. Start with 110 dpi, and if it is still too large, try 72 dpi with grayscale turned on.' },
      { q: 'Will my scanned ID still be readable?', a: 'At 150 or 110 dpi, text on a scanned document is usually clear. Check the result before submitting, especially at 72 dpi.' },
      { q: 'How is this different from Compress PDF?', a: 'Compress PDF offers three simple presets. Reduce PDF Size lets you pick the exact resolution and adds a grayscale option.' },
      { q: 'Can I reduce a PDF from my phone?', a: 'Yes. Upload from your phone browser, then download the smaller file and attach it to your application.' },
    ],
  },

  // ------------------------------------------------------------------ OCR
  'ocr-pdf': {
    title: 'OCR PDF: Make Scanned PDFs Searchable',
    description: 'Turn a scanned PDF into a searchable document you can copy text from. OCR adds an invisible text layer and keeps the pages looking the same.',
    h1: 'OCR PDF',
    lead: 'Make a scanned PDF searchable, so you can find words and copy text from it.',
    intro: [
      "A scanned PDF is just a stack of photos of paper. You can read it, but your computer cannot: searching finds nothing, you cannot copy a sentence, and tools like PDF to Word have nothing to work with. Optical character recognition, or OCR, reads the letters on each page and turns them into real text.",
      "The recognized text is added as an invisible layer behind each page image, so the document looks exactly the same but becomes searchable and copyable. Choose the main language of the document for the best accuracy. Pages that already contain text are left as they are. It is a great first step for scanned contracts, old letters, archives and receipts.",
    ],
    steps: [
      'Choose your scanned PDF.',
      'Select the main language of the document.',
      'Click Run OCR and wait while each page is read.',
      'Download the searchable PDF.',
    ],
    features: [
      { title: 'Looks the same', text: 'The page images are kept, with an invisible text layer added behind them.' },
      { title: 'Many languages', text: 'Pick the document language so letters and accents are recognized correctly.' },
      { title: 'Ready for other tools', text: 'Once text is recognized, you can convert to Word or Excel, or extract the text.' },
    ],
    faqs: [
      { q: 'How accurate is OCR?', a: 'Clean, straight scans of printed text are usually recognized very well. Blurry photos, small print, unusual fonts and handwriting give weaker results.' },
      { q: 'Why does my PDF look the same after OCR?', a: 'That is intended. The text is added invisibly behind the page image. Try searching or selecting text to see the difference.' },
      { q: 'What happens to pages that already have text?', a: 'They are kept as they are. Only pages without a text layer are recognized.' },
      { q: 'How long does it take?', a: 'OCR reads every page, so long documents take longer. A few pages are usually done quickly. You can upload one PDF of up to 100 MB.' },
      { q: 'Are my scans kept?', a: 'No. They are processed in a private temporary folder and deleted right after you receive the result.' },
    ],
  },

  'image-to-text': {
    title: 'Image to Text: Extract Text From Photos (OCR)',
    description: 'Copy the text from a photo, screenshot or scan. Supports JPG, PNG, WEBP, TIFF and BMP. Copy the result or download it as a TXT file.',
    h1: 'Image to Text',
    lead: 'Read the words in a photo, screenshot or scanned image and copy them.',
    intro: [
      "You took a photo of a whiteboard, a page in a book, a recipe card or a business card, and now you want the words without retyping them. Or someone sent you a screenshot of text you need to edit. This tool uses OCR to read the text in the picture and gives it back as plain text you can paste anywhere.",
      "Upload a JPG, PNG, WEBP, TIFF or BMP image and choose its language. The text appears on the page with a copy button, and you can download it as a TXT file. Accuracy depends on how clear the image is: sharp, well-lit, straight photos work best. Printed text is read well, but handwriting is recognized poorly.",
    ],
    steps: [
      'Choose an image file.',
      'Select the language of the text.',
      'Click Extract text.',
      'Copy the result or download it as a TXT file.',
    ],
    features: [
      { title: 'Common image formats', text: 'Works with JPG, PNG, WEBP, TIFF and BMP files.' },
      { title: 'Copy or download', text: 'Copy the recognized text with one click or save it as a TXT file.' },
      { title: 'Language choice', text: 'Choose the language of the text for better recognition of letters and accents.' },
    ],
    faqs: [
      { q: 'Can it read handwriting?', a: 'Only poorly. OCR is designed for printed text. Neat block capitals may partly work, but cursive writing usually does not.' },
      { q: 'How do I get the best results?', a: 'Use a sharp, well-lit photo taken straight on, with the text filling most of the frame. Avoid shadows and glare.' },
      { q: 'I have a scanned PDF, not an image. What should I use?', a: 'Use OCR PDF to make the whole PDF searchable, or PDF to Text if the file already has selectable text.' },
      { q: 'Can I use a photo straight from my phone?', a: 'Yes. Upload from your phone camera roll in a mobile browser. Images are deleted from our server right after the text is sent back.' },
    ],
  },

  // ------------------------------------------------------------------ other
  'pdf-page-numbers': {
    title: 'Add Page Numbers to a PDF Online',
    description: 'Number the pages of a PDF in one of six positions, with styles like Page 1 of 10. Set the first number and skip the cover. Runs in your browser.',
    h1: 'Add Page Numbers',
    lead: 'Number your pages in the position and style you like.',
    intro: [
      "Page numbers make a long document easier to use. Students need them on theses and dissertations, lawyers refer to them in court bundles, and anyone printing a manual or a meeting pack will thank you when the pages get shuffled. Adding them in the original program is not always possible, especially once a file has been merged from several sources.",
      "Place numbers at the top or bottom, on the left, center or right. Pick a style such as 1, Page 1, Page 1 of N or 1 / N, choose the text size, and set the starting number. You can skip the first page so the cover stays clean. The numbers are added in your browser, so your document is never uploaded.",
    ],
    steps: [
      'Open your PDF.',
      'Choose the position and number style.',
      'Set the first number and text size, and choose whether to skip the cover.',
      'Click Add page numbers and download the file.',
    ],
    features: [
      { title: 'Six positions', text: 'Top or bottom, left, center or right.' },
      { title: 'Four styles', text: 'Plain numbers, Page 1, Page 1 of N or 1 / N.' },
      { title: 'Cover-friendly', text: 'Leave the first page unnumbered and start counting from any number.' },
    ],
    faqs: [
      { q: 'Can I start numbering at a number other than 1?', a: 'Yes. Set the first number to any value, which is useful when the PDF is one part of a larger document.' },
      { q: 'What happens to the cover when I skip it?', a: 'The first page is left exactly as it is, with no number printed on it. Combine this with the First number setting to get the numbering you want on the pages that follow.' },
      { q: 'Should I merge files before numbering?', a: 'Yes. Combine everything with Merge PDF first, then add page numbers so they run through the whole document.' },
      { q: 'Is my file uploaded?', a: 'No. Page numbers are added in your browser and the document stays on your device.' },
    ],
  },

  'pdf-metadata-editor': {
    title: 'Edit PDF Metadata: Title, Author and Keywords',
    description: 'View and change a PDF title, author, subject, keywords and creator, or remove all document properties. Runs in your browser with no upload.',
    h1: 'PDF Metadata Editor',
    lead: 'See and change the hidden title, author and keywords stored in a PDF.',
    intro: [
      "Every PDF carries hidden details called properties or metadata. The title shows in browser tabs and search results, the author field may still contain the name of whoever made the template, and the creator field reveals which program was used. Publishers, website owners and anyone sending documents to clients may want these details to be correct, or gone.",
      "Open a PDF and the current title, author, subject, keywords and creator are shown right away. Change any of them, or tick the option to remove all properties at once. Only the metadata changes; the pages stay exactly the same. Everything happens in your browser, so the file is never uploaded.",
    ],
    steps: [
      'Open your PDF to see its current properties.',
      'Edit the title, author, subject, keywords or creator.',
      'Or tick Remove all properties instead.',
      'Click Save properties and download the file.',
    ],
    features: [
      { title: 'See what is hidden', text: 'The existing properties are shown as soon as you open the file.' },
      { title: 'Edit or clear', text: 'Change individual fields or wipe all properties in one go.' },
      { title: 'Pages untouched', text: 'Only the document information changes, never the content.' },
    ],
    faqs: [
      { q: 'Why does the PDF title matter?', a: 'Many browsers and PDF readers show the title instead of the file name, and search engines may use it too. A clear title looks more professional.' },
      { q: 'How do I separate keywords?', a: 'Separate them with commas, for example invoice, 2026, client name.' },
      { q: 'Does removing properties make my PDF anonymous?', a: 'It clears the document properties, but names or details in the page content stay. To hide those, use Redact PDF.' },
      { q: 'Is the file uploaded?', a: 'No. The properties are read and changed in your browser.' },
    ],
  },

  'repair-pdf': {
    title: 'Repair a Damaged or Corrupted PDF',
    description: 'Try to fix a PDF that will not open, shows errors or looks broken. The file structure is rebuilt where possible. Free, private and quick.',
    h1: 'Repair PDF',
    lead: 'Try to fix a PDF that will not open or shows errors.',
    intro: [
      "PDFs get damaged more often than you might expect: a download that stopped halfway, an email attachment that was cut short, a file copied from a failing USB stick, or a program that crashed while saving. The result is a file that will not open, shows error messages or has missing pages.",
      "This tool first rebuilds the internal structure of the file. If that does not work, it rewrites the document from scratch with a second method. Many common problems can be fixed this way. However, content that is truly missing from the file, such as pages lost in an interrupted download, cannot be brought back. Your file is deleted from our server right after the result is sent.",
    ],
    steps: [
      'Choose the damaged PDF.',
      'Click Repair PDF.',
      'Download the repaired file and check that it opens.',
    ],
    features: [
      { title: 'Two repair methods', text: 'If rebuilding the structure fails, the file is rewritten using a second engine.' },
      { title: 'Accepts broken files', text: 'Files that other tools reject can still be uploaded here.' },
      { title: 'Private processing', text: 'The damaged file and the repaired copy are deleted as soon as you have them.' },
    ],
    faqs: [
      { q: 'Can every PDF be repaired?', a: 'No. Structural damage can often be fixed, but if parts of the file were never saved or downloaded, that content is gone and cannot be recovered.' },
      { q: 'Some pages are still blank after repair. Why?', a: 'The data for those pages is probably missing from the file. If possible, download the file again or ask the sender for a fresh copy.' },
      { q: 'Should I optimize the file after repairing it?', a: 'You can. Optimize PDF cleans up the structure further and can make the repaired file open faster.' },
      { q: 'What is the size limit?', a: 'One PDF of up to 100 MB at a time.' },
    ],
  },

  'pdf-to-zip': {
    title: 'Put PDF Files Into a ZIP Archive',
    description: 'Pack one or more PDFs into a single ZIP file for easy sharing, or split a PDF into one file per page inside the ZIP. Works in your browser.',
    h1: 'PDF to ZIP',
    lead: 'Bundle several PDFs into one ZIP file that is easy to send or store.',
    intro: [
      "Attaching twenty separate PDFs to an email, or uploading them one by one to a portal that accepts only one file, is a chore. Packing them into a single ZIP archive keeps them together as one download. It is useful for sending a set of invoices to an accountant, a batch of signed forms to HR, or coursework to a teacher.",
      "Add one or more PDFs and create the ZIP. You can also split each PDF into one file per page inside the archive. Keep in mind that PDFs are already compressed, so the ZIP is often not much smaller than the originals: the main benefit is having everything in one file. The archive is created in your browser and nothing is uploaded.",
    ],
    steps: [
      'Add one or more PDF files.',
      'Tick Split into one PDF per page if you want single pages.',
      'Click Create ZIP.',
      'Download the ZIP archive.',
    ],
    features: [
      { title: 'One tidy download', text: 'Many PDFs become a single file that is easy to attach or upload.' },
      { title: 'Optional page split', text: 'Store every page as its own PDF inside the archive.' },
      { title: 'Created locally', text: 'The ZIP is built in your browser, so your files are never uploaded.' },
    ],
    faqs: [
      { q: 'Will the ZIP be much smaller than my PDFs?', a: 'Usually not by much, because PDFs are already compressed inside. To really cut the size, use Compress PDF first.' },
      { q: 'How many PDFs can I add?', a: 'Up to 100 files at once. Very large batches depend on your device\'s memory.' },
      { q: 'Can the person I send it to open a ZIP?', a: 'Yes. Windows, macOS, iPhone, iPad and Android can all open ZIP files without extra software.' },
      { q: 'Would one merged PDF be better?', a: 'If the recipient wants to read everything in one go, Merge PDF is handier. A ZIP is better when files need to stay separate.' },
    ],
  },

  'extract-images-from-pdf': {
    title: 'Extract Images From a PDF in Original Quality',
    description: 'Save every picture embedded in a PDF in its original format and resolution, usually JPG or PNG, and download them all in one ZIP file.',
    h1: 'Extract Images from PDF',
    lead: 'Get the original photos and pictures out of a PDF at full quality.',
    intro: [
      "Taking screenshots of a PDF gives you blurry, cropped pictures. If you need the actual photos from a product catalog, the illustrations from a report you wrote, or the pictures from an old brochure whose source files are lost, it is better to pull out the original images stored inside the file.",
      "This tool saves every embedded image in its original format and resolution, usually JPG or PNG, and packs them into a ZIP. Nothing is resized or recompressed. Charts and drawings made of vector lines are not images, so they are not extracted; to capture those, convert whole pages with PDF to PNG. Your file is deleted from our server as soon as the ZIP is ready.",
    ],
    steps: [
      'Choose the PDF that contains the pictures.',
      'Click Extract images.',
      'Download the ZIP file with all the images.',
    ],
    features: [
      { title: 'Original quality', text: 'Images are saved at the resolution they were stored in the PDF, without recompression.' },
      { title: 'All in one ZIP', text: 'Every picture from every page comes in a single download.' },
      { title: 'Deleted after use', text: 'Your PDF and the extracted images are removed from our server right away.' },
    ],
    faqs: [
      { q: 'Why is a chart or logo missing?', a: 'It is probably drawn with vector shapes rather than stored as a picture. Use PDF to PNG or PDF to JPG to save the whole page as an image.' },
      { q: 'Why are some images split into pieces or look odd?', a: 'Some PDFs store one picture as several strips or use a separate mask for transparency. Those parts are saved as they are stored in the file.' },
      { q: 'What formats will I get?', a: 'Images are saved in their original format, which is usually JPG for photos and PNG for other pictures.' },
      { q: 'Is there a size limit?', a: 'You can upload one PDF of up to 100 MB at a time. Files are sent over HTTPS and never stored.' },
    ],
  },
};
