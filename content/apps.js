'use strict';
// Stand-alone tools with their own page and their own tool box (pages.js appPage, public/apps.js):
// the passport photo maker, text recognition (OCR) and the invoice generator.
//
//   slug, name (menus and links), app ('passport' | 'ocr' | 'invoice'), browser (true: the file never
//   leaves the device), title (without " | site", <= 60), desc (<= 160), h1, intro, steps
//   [[strong, text]], sections [[h2, html]], faq [[q, a]], see (related paths), keywords (searches
//   the page is written for; the first one leads the title, H1 and description).
// Each line is about what the tool really does; no claims of official approval.

module.exports = [
  {
    slug: 'passport-photo-maker', howto: 'How to make a passport photo at home', name: 'Passport Photo Maker', app: 'passport', browser: true,
    keywords: ['passport photo', 'passport photo maker', '2x2 photo', 'passport photo online free', 'us passport photo', 'visa photo', '35x45 photo'],
    title: 'Passport Photo Maker - Free 2x2 Photo Online',
    desc: 'Free passport photo maker for 40+ countries: crop a 2x2 inch US, 35x45 mm UK, EU or Pakistan photo online, then download the digital photo and a 4x6 sheet.',
    h1: 'Passport Photo Maker (2x2 Inch)',
    intro: 'Make a passport photo at home. Upload a photo, pick your country from the list of more than 40, line your face up with the guide, and download a photo in the right size: 2x2 inch for a US passport or visa, 35x45 mm for the UK, the EU, Schengen and Pakistan, 50x70 mm for Canada, and many more. You also get a 4x6 inch sheet to print at CVS, Walgreens, Walmart or any photo kiosk. Free, no sign-up, and your photo never leaves your device.',
    steps: [['Take or upload a photo.', 'Stand in front of a plain white or off-white wall, face the camera, keep a neutral expression and both eyes open. Then click <em>Select photo</em>.'],
      ['Line up your face.', 'Choose the country, then drag and zoom the photo so the top of your head and your chin sit between the guide lines and your face is centred.'],
      ['Download and print.', 'Download the digital photo for online applications, or the 4x6 inch sheet to print at a pharmacy or photo kiosk for a few cents.']],
    sections: [
      ['Passport photo sizes by country', `{{PASSPORT_TABLE}}
        <p>Rules change and some offices are stricter than others, so check the current requirements of the office you apply to before printing. For a country that is not listed, choose <em>Custom size</em> and type the width and height in millimetres.</p>`],
      ['How to take a good passport photo at home', '<ul><li><strong>Background:</strong> a plain white or off-white wall with no pattern, shadows or objects behind you.</li><li><strong>Light:</strong> face a window or a soft light so there are no shadows on your face or behind you. Do not use the flash.</li><li><strong>Pose:</strong> look straight at the camera with a neutral expression, mouth closed, both eyes open. Keep your head straight, not tilted.</li><li><strong>Glasses and hats:</strong> take off glasses (the US no longer accepts them) and anything on your head unless you wear it every day for religious or medical reasons.</li><li><strong>Camera:</strong> ask someone else to take the photo from about 4 feet (1.2 m) away at eye level. A selfie at arm\'s length distorts the face.</li></ul>'],
      ['Printing your passport photo for less', '<p>Download the <strong>4x6 inch print sheet</strong> and order a standard 4x6 photo print at CVS, Walgreens, Walmart, Costco, Boots or any photo kiosk: one print costs well under a dollar and holds several passport photos. Cut along the thin grey lines. Choose matte or glossy photo paper, not plain paper, and do not resize the image when you order the print.</p>'],
      ['Private by design', '<p>Your photo is cropped in your browser. It is never uploaded to our server, so nobody else sees it, and it works even on a slow connection. To make the image file smaller for an upload form, use <a href="/compress-jpg">Compress JPG</a>; to turn an iPhone photo into a JPG first, use <a href="/heic-to-jpg">HEIC to JPG</a>.</p>'],
    ],
    faq: [
      ['What size is a US passport photo?', 'A US passport photo is 2 x 2 inches (51 x 51 mm). The head, from the bottom of the chin to the top of the hair, must be between 1 and 1 3/8 inches (25 to 35 mm). The digital version for online renewal is a square JPG of at least 600 x 600 pixels.'],
      ['Is this passport photo maker free?', 'Yes. Cropping, the digital photo and the 4x6 print sheet are free, with no watermark and no sign-up.'],
      ['Can I print a passport photo at CVS or Walgreens?', 'Yes. Download the 4x6 inch sheet and order it as a regular 4x6 photo print. Do not let the kiosk crop or resize it, then cut out the photos along the guide lines.'],
      ['Can I use this photo to renew my passport online?', 'Use the digital 600 x 600 pixel photo. Make sure the photo follows the rules on background, lighting and expression; we cannot check or guarantee that an office accepts it.'],
      ['Does it remove the background?', 'No. It crops and sizes your photo; it does not change the background. Take the photo in front of a plain white or off-white wall for the best result.'],
      ['Is my photo uploaded?', 'No. Everything happens in your browser and the photo never leaves your device.'],
      ['What size is a Pakistan passport photo?', 'Pakistan passport, CNIC and visa photos are 35 x 45 mm, the same size as UK and Schengen photos. Choose Pakistan in the list and the guide lines show where the head and chin go.'],
      ['What size is a UK or Schengen visa photo?', 'UK, EU and Schengen passport and visa photos are 35 x 45 mm, with the head 29 to 34 mm tall. Choose "UK / EU / Schengen" in the tool.'],
    ],
    see: ['/heic-to-jpg', '/compress-jpg', '/jpg-to-pdf', '/image-to-pdf', '/resume-maker'],
  },
  {
    slug: 'image-to-text', howto: 'How to convert an image to text', name: 'Image to Text (OCR)', app: 'ocr', accept: 'image',
    keywords: ['image to text', 'image to text converter', 'jpg to text', 'photo to text', 'ocr online', 'extract text from image', 'picture to text'],
    title: 'Image to Text Converter (OCR) - Extract Text Free',
    desc: 'Image to text converter: extract text from photos, screenshots and scans with free OCR. JPG, PNG, HEIC and PDF. Copy the text or download a TXT file.',
    h1: 'Image to Text Converter (OCR)',
    intro: 'Turn a photo, screenshot or scanned page into text you can copy, edit and search. Upload a JPG, PNG, HEIC, WEBP or TIFF image (or a scanned PDF), choose the language and get the text in seconds. Free, no sign-up, and your file is deleted right after.',
    steps: [['Upload an image.', 'Click <em>Select file</em> or drop a photo, screenshot or scan. Photos of documents work best when the page fills the picture and is in focus.'],
      ['Choose the language.', 'English is selected; pick Spanish, French, German, Italian, Portuguese or Dutch for text in those languages.'],
      ['Copy or download the text.', 'The text appears in the box. Copy it with one click or download it as a TXT file. For a scanned PDF you can also get a searchable PDF.']],
    sections: [
      ['What you can do with image to text', '<ul><li>Copy the text out of a screenshot, a slide or a photo of a whiteboard.</li><li>Turn a photo of a printed letter, receipt or recipe into text you can edit.</li><li>Get quotes and notes out of book pages without typing them.</li><li>Make scanned documents searchable with <a href="/ocr-pdf">OCR PDF</a>.</li></ul>'],
      ['Tips for the most accurate text', '<ul><li>Use a sharp photo taken straight on, with the page flat and evenly lit.</li><li>Crop away the background so the text fills most of the picture.</li><li>Choose the language the text is written in.</li><li>Printed text gives the best results. Handwriting is often read poorly; neat block capitals work better than joined-up writing.</li></ul>'],
      ['How OCR works', '<p>OCR (optical character recognition) looks at the shapes in the picture and turns them into letters and words. We use Tesseract, the open-source OCR engine first developed at HP and later improved by Google. Each image is read on our server over an encrypted connection and deleted as soon as the text is ready; it is never kept or shared.</p>'],
    ],
    faq: [
      ['How do I convert an image to text?', 'Upload the image here, choose the language and the text appears in a few seconds. Copy it or download it as a TXT file.'],
      ['Is this image to text converter free?', 'Yes. It is free with no sign-up, no email and no watermark.'],
      ['Which image types work?', 'JPG, JPEG, PNG, WEBP, HEIC (iPhone), TIFF, BMP and GIF images, and scanned PDF files.'],
      ['Can it read handwriting?', 'Neat printed handwriting can work, but joined-up handwriting is often read poorly. Typed and printed text gives the best results.'],
      ['Can I extract text from a screenshot?', 'Yes. Screenshots are usually read very accurately because the text is sharp.'],
      ['Are my images kept?', 'No. The image is used only to read the text and is deleted from the server right after.'],
      ['Which languages are supported?', 'English, Spanish, French, German, Italian, Portuguese and Dutch.'],
    ],
    see: ['/ocr-pdf', '/pdf-to-txt', '/pdf-to-docx', '/heic-to-jpg', '/jpg-to-pdf'],
  },
  {
    slug: 'ocr-pdf', howto: 'How to OCR a scanned PDF', name: 'OCR PDF', app: 'ocr', accept: 'pdf',
    keywords: ['ocr pdf', 'scanned pdf to text', 'make pdf searchable', 'searchable pdf', 'pdf ocr online free', 'scanned pdf to word'],
    title: 'OCR PDF - Make Scanned PDF Searchable Free Online',
    desc: 'OCR PDF free: turn a scanned PDF into a searchable PDF or plain text you can copy. Reads every page with OCR. No sign-up, no watermark.',
    h1: 'OCR PDF: Make Scanned PDFs Searchable',
    intro: 'A scanned PDF is only pictures of pages, so you cannot search it, select the text or copy it. OCR reads the text on every page. Download a searchable PDF that looks exactly like your scan, or get the plain text to copy into Word, Google Docs or an email. Free, no sign-up.',
    steps: [['Upload the scanned PDF.', 'Click <em>Select file</em> or drop the PDF. Photos and screenshots work too.'],
      ['Choose the language and the result.', 'Pick the language of the document, then <em>Searchable PDF</em> or <em>Text</em>.'],
      ['Download.', 'The searchable PDF looks the same as your scan, but now you can search it with Ctrl+F and select and copy the text.']],
    sections: [
      ['Searchable PDF or plain text?', '<p><strong>Searchable PDF</strong> keeps every page exactly as scanned and adds an invisible text layer on top, so the document looks the same but you can search, select and copy the words, and screen readers can read it. It is the best choice for contracts, statements and records you keep. <strong>Text</strong> gives you only the words, ready to paste and edit; to rebuild a Word document, paste it into Word or use <a href="/pdf-to-docx">PDF to DOCX</a> on the searchable PDF.</p>'],
      ['Good scans give good text', '<ul><li>Scan at 300 dpi in black and white or grayscale.</li><li>Keep the pages straight and the text dark and sharp.</li><li>Choose the language the document is written in.</li><li>Up to the first 20 pages of a PDF are read at a time; split longer files with <a href="/split-pdf">Split PDF</a>.</li></ul>'],
      ['Your documents stay private', '<p>The PDF is processed over an encrypted connection and deleted as soon as the result is ready. We do not keep, read or share your documents. A PDF with a password must be unlocked first with <a href="/unlock-pdf">Unlock PDF</a>.</p>'],
    ],
    faq: [
      ['How do I make a scanned PDF searchable?', 'Upload the PDF here, choose Searchable PDF and download the result. It looks the same as before, but you can now search it and copy the text.'],
      ['Is OCR PDF free?', 'Yes. It is free, with no sign-up and no watermark on the PDF.'],
      ['How do I know if my PDF needs OCR?', 'Open it and try to select a word or search with Ctrl+F (Cmd+F on a Mac). If nothing is found or you can only select the whole page as a picture, it is a scan and needs OCR.'],
      ['How many pages can I OCR?', 'The first 20 pages of a PDF are read at a time. Split longer PDFs into parts with Split PDF and run each part.'],
      ['Will the searchable PDF look different?', 'No. Each page keeps the look of the scan; the recognised text is added as an invisible layer underneath.'],
      ['Can I convert a scanned PDF to Word?', 'Yes. Make it searchable here first, then convert the searchable PDF with PDF to DOCX, or download the text and paste it into Word.'],
    ],
    see: ['/image-to-text', '/pdf-to-docx', '/compress-pdf', '/split-pdf', '/pdf-to-txt'],
  },
  {
    slug: 'invoice-generator', howto: 'How to create an invoice', name: 'Invoice Generator', app: 'invoice', browser: true,
    keywords: ['invoice generator', 'free invoice generator', 'invoice maker', 'create invoice online', 'invoice template', 'invoice pdf'],
    title: 'Free Invoice Generator - Make an Invoice PDF Online',
    desc: 'Free invoice generator: fill in your details and items, the totals, tax and discount are calculated for you, then download a professional invoice PDF.',
    h1: 'Free Invoice Generator',
    intro: 'Create a professional invoice in a minute. Add your logo, your business and client details and the items; the subtotal, tax, discount and total are calculated for you. Download the invoice as a PDF on US Letter or A4 paper and send it to your client. Free, no sign-up, no watermark, and the invoice is made in your browser.',
    steps: [['Fill in the details.', 'Your business name and address, your client, the invoice number and dates. Add your logo if you have one.'],
      ['Add the items.', 'Type a description, quantity and rate for each product or service. The amounts, tax, discount and total update as you type.'],
      ['Download the PDF.', 'Choose US Letter or A4 and download the invoice PDF to email, print or upload. Your details are kept in this browser for the next invoice.']],
    sections: [
      ['What to put on an invoice', '<p>A clear invoice gets paid faster. Include: the word <strong>Invoice</strong>, a unique invoice number, the invoice date and the due date, your business name, address and contact details, your client\'s name and address, a description of each product or service with quantity, rate and amount, the subtotal, any sales tax or VAT with its rate, discounts and shipping, the total amount due, and how to pay (bank transfer, PayPal, Zelle, Venmo, Stripe link or check). If you are registered for VAT or GST, add your registration number.</p>'],
      ['Invoices for freelancers and small businesses', '<p>Bill by the hour (hours as the quantity and your hourly rate as the rate), by the project or by milestone. Net 15 and Net 30 are common payment terms in the US: the client pays within 15 or 30 days of the invoice date. Number invoices in order (INV-0001, INV-0002 ...) so you and your accountant can keep track; the generator suggests the next number for you.</p>'],
      ['Sales tax, VAT and GST', '<p>Enter the tax rate as a percentage and the tax is added to the subtotal after any discount. US sales tax depends on your state and what you sell; in the UK and EU, VAT-registered businesses must show the VAT rate, the VAT amount and their VAT number. If you are not sure, ask an accountant: the generator only does the maths.</p>'],
      ['Private: made in your browser', '<p>The invoice is built in your browser and downloaded straight to your device; your client list and prices are not sent to our server. For a fully custom design, start from the invoice template in the <a href="/edit-pdf?template=invoice">PDF editor</a>, and for estimates before the work starts use the <a href="/quotation-maker">quotation maker</a>.</p>'],
    ],
    faq: [
      ['Is this invoice generator really free?', 'Yes. Create and download as many invoices as you need, with no watermark, no sign-up and no limit.'],
      ['Does it calculate the totals?', 'Yes. Line amounts, subtotal, discount, tax, shipping and the total due are calculated as you type.'],
      ['Can I add my logo?', 'Yes. Click Add logo and choose a PNG or JPG; it appears at the top of the invoice.'],
      ['Which currencies can I use?', 'US dollar, euro, British pound, Canadian dollar, Australian dollar, Indian rupee, Pakistani rupee and others from the currency list.'],
      ['Is my invoice data saved?', 'Your details are kept only in this browser, so the next invoice is quicker. Nothing is uploaded; use New invoice to clear the items.'],
      ['US Letter or A4?', 'Choose US Letter for clients in the US and Canada and A4 for the UK, Europe and most other countries.'],
      ['Can I make a VAT or sales tax invoice?', 'Yes. Enter the tax rate and, if you have one, your VAT or tax number under your business details.'],
    ],
    see: ['/quotation-maker', '/receipt-maker', '/sign-pdf', '/merge-pdf', '/compress-pdf'],
  },
];
