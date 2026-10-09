'use strict';
// Landing pages for the PDF editor (pages.js editorPage). Each one is the full editor plus its
// own text, aimed at one search intent: "resume maker", "invoice generator", "sign PDF" ...
// Template pages open the start screen on their template category (cat) and can link straight
// to a template with /edit-pdf?template=<id>. Tool pages pick the matching tool once a PDF is
// open (tool: a data-tool name in views/editor-app.html).
//
//   slug, kind ('template' | 'tool'), short (link text), title (<title>, ~60 chars),
//   desc (meta description, <=160 chars), kicker, h1, lede, panel ([h2, text] over the
//   template gallery), sections ([h2, html] below the editor), faq ([q, a]).

const T = (id, name) => `<a href="/edit-pdf?template=${id}">${name}</a>`;

module.exports = [
  // --------------------------------------------------------------- templates --
  {
    slug: 'resume-maker', kind: 'template', cat: 'resume', short: 'Resume maker',
    title: 'Free Resume Maker - Create a Resume PDF Online',
    desc: 'Free resume maker and CV builder. Pick a resume template, type your details and download a professional resume PDF. No watermark, works on any device.',
    kicker: 'Free resume builder', h1: 'Free Resume Maker',
    lede: 'Make a professional resume or CV in minutes. Pick a template, click any text to replace it with your own, and download a clean PDF that is ready to send.',
    panel: ['Choose a resume template', 'Modern and classic layouts, plus a matching cover letter. Every word, colour and line can be changed.'],
    sections: [
      ['How to make a resume online', `<ol><li><strong>Pick a layout.</strong> The ${T('resume-modern', 'Modern resume')} has a coloured sidebar for contact details and skills; the ${T('resume-classic', 'Classic resume')} is a single clean column that suits banks, government jobs and academic posts.</li><li><strong>Replace the sample text.</strong> Click your name, job title, experience and education and type over them. Change fonts, sizes and colours from the bar above the page.</li><li><strong>Add or remove sections.</strong> Duplicate a job entry with Ctrl+D, delete what you do not need, and drag a guide line out of the ruler to keep everything aligned.</li><li><strong>Download your resume PDF.</strong> It opens the same on every computer and phone, which is what recruiters expect.</li></ol>`],
      ['What makes a good resume', '<p>Keep it to one page if you have less than ten years of experience, and two at most after that. Start with a two-line summary of who you are and what you want, then list jobs from newest to oldest with numbers wherever you can: "cut delivery time by 30%" says more than "responsible for delivery". Put the skills that match the job advert near the top, and use the same words the advert uses.</p><p>Applicant tracking systems (ATS) read text, not pictures, so this resume builder keeps your words as real text in the PDF. Use a standard font such as Helvetica, Roboto or Open Sans, avoid putting key details inside images, and save the file as <em>firstname-lastname-resume.pdf</em>.</p>'],
      ['Resume, CV or biodata?', '<p>A resume is a short summary of your work history, usually one or two pages, used for most private jobs. A CV (curriculum vitae) is longer and also lists publications, research and awards; it is common for academic jobs and in the UK, Europe, Pakistan and India. Biodata adds personal details such as date of birth and is still asked for in some government forms. All three can be made from the same templates: add or remove sections until it matches what the employer asked for.</p>'],
      ['Write a cover letter that matches', `<p>Most employers read the cover letter first. Open the ${T('cover-letter', 'Cover letter template')}, use the same font and colour as your resume, and write three short paragraphs: why this job, what you have done that proves you can do it, and a polite request for an interview. See the ${'<a href="/cover-letter-maker">cover letter maker</a>'} for more tips.</p>`],
    ],
    faq: [
      ['Is this resume maker really free?', 'Yes. Making and downloading your resume is free, with no watermark and no trial. You do not need to create an account.'],
      ['Can I make a CV with it?', 'Yes. Start from either resume template and add sections for publications, research, certifications or references. The page grows as you add text, or add a second page from the Pages panel.'],
      ['Is the resume ATS-friendly?', 'The text in the downloaded PDF stays real, selectable text, which applicant tracking systems can read. Keep important details out of images and use standard section titles such as Experience, Education and Skills.'],
      ['Can I edit my old resume PDF?', 'Yes. Open your existing resume PDF with Open a PDF, click a line with Edit text and retype it, or cover old details with Whiteout and type the new ones on top.'],
      ['Can I add a photo to my resume?', 'Yes. Use Image to add your photo, then choose the circle shape in the Image settings to show it round, as on the Modern resume.'],
    ],
  },
  {
    slug: 'cover-letter-maker', kind: 'template', cat: 'resume', short: 'Cover letter maker',
    title: 'Free Cover Letter Maker - Cover Letter Template PDF',
    desc: 'Write a cover letter online with a free template. Fill in your details, match it to your resume and download it as a PDF. No sign-up, no watermark.',
    kicker: 'Free cover letter template', h1: 'Cover Letter Maker',
    lede: 'Write a cover letter that looks as good as your resume. Start from a ready-made template, type your letter and download it as a PDF.',
    panel: ['Start your cover letter', 'The cover letter matches the resume templates, so your application looks like one set.'],
    sections: [
      ['How to write a cover letter', `<p>Open the ${T('cover-letter', 'Cover letter template')} and replace the sample text with your own. A strong cover letter has three parts:</p><ol><li><strong>Opening.</strong> Name the job and where you saw it, and say in one sentence why you want it.</li><li><strong>Proof.</strong> Pick two or three achievements from your resume that match what the employer needs and explain them briefly, with numbers.</li><li><strong>Close.</strong> Thank the reader, say you would welcome an interview, and sign off with your name and phone number.</li></ol>`],
      ['Cover letter tips', '<p>Address the letter to a person if you can find a name; "Dear Hiring Manager" is fine if you cannot. Keep it under one page, around 250 to 400 words. Do not repeat your whole resume: the letter should explain why you and this job fit together. Use the same font and colour as your resume so they look like one application, and save the file as <em>firstname-lastname-cover-letter.pdf</em>.</p>'],
      ['Sign your letter', '<p>Use Sign to draw your signature with a mouse or finger, or type it in a handwriting font, and place it above your printed name. The signature is saved inside the PDF.</p>'],
    ],
    faq: [
      ['Is the cover letter template free?', 'Yes. Writing, editing and downloading your cover letter is free, without a watermark or an account.'],
      ['Can I use it for any job?', 'Yes. The template is a standard business letter layout that works for private jobs, government applications, internships and university admissions.'],
      ['Can I make the matching resume too?', 'Yes. Use the resume maker; the templates share fonts and colours so your resume and cover letter look like a set.'],
      ['How long should a cover letter be?', 'Three or four short paragraphs, under one page. Hiring managers usually read it in less than a minute.'],
    ],
  },
  {
    slug: 'invoice-generator', kind: 'template', cat: 'business', short: 'Invoice generator',
    title: 'Free Invoice Generator - Make an Invoice PDF Online',
    desc: 'Free invoice generator. Fill in a professional invoice template with your logo, items, tax and total, then download the invoice as a PDF. No sign-up.',
    kicker: 'Free invoice maker', h1: 'Free Invoice Generator',
    lede: 'Create a professional invoice in a few minutes. Add your logo and customer details, list the items, and download a PDF invoice to email or print.',
    panel: ['Start from an invoice template', 'Invoices, quotations, receipts and letterheads for small businesses and freelancers.'],
    sections: [
      ['How to make an invoice', `<ol><li><strong>Open the ${T('invoice', 'Invoice template')}.</strong> Replace "Your Company" with your business name and add your logo with Image.</li><li><strong>Fill in the details.</strong> Invoice number, invoice date, due date, and the name and address of the customer you are billing.</li><li><strong>List the items.</strong> The items are a real table: click a cell and type, press Tab to move on, and use the table buttons to add or delete rows.</li><li><strong>Add the totals.</strong> Enter the subtotal, tax (sales tax, VAT or GST) and the total due, plus your bank or payment details.</li><li><strong>Download the invoice PDF</strong> and send it to your client.</li></ol>`],
      ['What an invoice must include', '<p>A clear invoice gets paid faster. Every invoice should show: the word "Invoice", a unique invoice number, the date, your business name and contact details, the customer\'s name, a description of each product or service with quantity and price, the subtotal, any tax with its rate, the total amount due, the payment due date and how to pay. If you are registered for sales tax, VAT or GST, add your registration number; many countries require it on a tax invoice.</p>'],
      ['Invoices for freelancers and small businesses', '<p>Freelancers can bill per hour or per project: put the hours or milestones in the quantity column. Shops and small businesses can reuse the same invoice every time: keep your saved PDF, open it again, change the number, customer and items, and download a new invoice. For prices before the work starts, send a <a href="/quotation-maker">quotation</a>; when the money arrives, give a <a href="/receipt-maker">payment receipt</a>.</p>'],
    ],
    faq: [
      ['Is this invoice generator free?', 'Yes, completely. Make as many invoices as you need and download them as PDFs without a watermark or an account.'],
      ['Can I add my logo to the invoice?', 'Yes. Click Image, choose your logo file (PNG, JPG or WebP) and place it at the top. You can resize it and remove the sample logo.'],
      ['Does it calculate the total for me?', 'Not automatically yet: type the line totals, tax and grand total yourself. The table keeps everything lined up.'],
      ['Can I make a tax invoice with GST, VAT or sales tax?', 'Yes. Add rows for the tax and its rate, and type your tax registration number under your business details.'],
      ['Is my invoice data uploaded anywhere?', 'No. The invoice is made in your browser and downloaded straight to your device; your customer and price details are not sent to our server.'],
    ],
  },
  {
    slug: 'quotation-maker', kind: 'template', cat: 'business', short: 'Quotation maker',
    title: 'Free Quotation Maker - Price Quote Template PDF',
    desc: 'Make a professional quotation, price quote or estimate online for free. Fill in the template with items and prices and download it as a PDF.',
    kicker: 'Free quotation format', h1: 'Quotation Maker',
    lede: 'Send clients a clear price quote before the work starts. Fill in a ready-made quotation template and download it as a PDF.',
    panel: ['Start your quotation', 'A quotation template with an items table, plus invoices and receipts for later.'],
    sections: [
      ['How to make a quotation', `<p>Open the ${T('quotation', 'Quotation template')}, add your business name and logo, and fill in the client\'s details. List each product or service in the table with quantity, unit price and amount, then the subtotal, tax and estimated total. Add how long the quote is valid (for example 30 days), payment terms and delivery time, and download the PDF.</p>`],
      ['Quotation, estimate or proforma?', '<p>A quotation is a fixed price offer: if the client accepts it, that is the price. An estimate is a best guess that may change once work starts. A proforma invoice is sent before delivery, often for import, customs or advance payment, and looks like an invoice but is not a demand for payment. You can make all three from the same template by changing the title.</p>'],
      ['From quote to invoice', '<p>When the client accepts, open the <a href="/invoice-generator">invoice generator</a>, copy the same items, and send the invoice. Using the same layout for both makes it easy for the client to check.</p>'],
    ],
    faq: [
      ['Is the quotation maker free?', 'Yes. Make and download quotations without paying, signing up or getting a watermark.'],
      ['Can I add terms and conditions?', 'Yes. Click below the table and use Text to add your terms, validity period and payment conditions.'],
      ['Can I sign the quotation?', 'Yes. Use Sign to draw or type your signature and place it at the bottom of the quote.'],
    ],
  },
  {
    slug: 'receipt-maker', kind: 'template', cat: 'business', short: 'Receipt maker',
    title: 'Free Receipt Maker - Payment Receipt Template PDF',
    desc: 'Make a payment receipt online for free: cash receipts, rent receipts and sales receipts. Fill in the template and download it as a PDF.',
    kicker: 'Free receipt template', h1: 'Receipt Maker',
    lede: 'Give customers a proper receipt for every payment. Fill in the receipt template and download or print it in seconds.',
    panel: ['Start your receipt', 'A compact receipt template, plus invoices and quotations.'],
    sections: [
      ['How to make a receipt', `<p>Open the ${T('receipt', 'Payment receipt template')} and fill in your business name, the receipt number and date, who paid, what they paid for and the amount. Add how they paid (cash, card, bank transfer) and download the PDF. It is A5 sized, so two fit on one A4 sheet when printed.</p>`],
      ['Types of receipts you can make', '<p><strong>Cash receipt:</strong> proof that money was received in cash. <strong>Rent receipt:</strong> add the property address and the month the rent covers; tenants often need it for tax or allowance claims. <strong>Sales receipt:</strong> list the items sold with prices. <strong>Donation receipt:</strong> show the donor, the amount and your organisation\'s details.</p>'],
      ['Receipt or invoice?', '<p>An invoice asks for payment; a receipt confirms that payment has been made. Send an <a href="/invoice-generator">invoice</a> first, then a receipt when the money arrives.</p>'],
    ],
    faq: [
      ['Is the receipt maker free?', 'Yes. Make as many receipts as you need and download them as PDFs, free and without a watermark.'],
      ['Can I make a rent receipt?', 'Yes. Change the title to Rent Receipt and add the property address, the rent period and the landlord\'s signature with Sign.'],
      ['Can I print receipts?', 'Yes. Download the PDF and print it; the receipt is A5, so you can print two on one A4 page from your printer settings.'],
    ],
  },
  {
    slug: 'letterhead-maker', kind: 'template', cat: 'business', short: 'Letterhead maker',
    title: 'Free Letterhead Maker - Company Letterhead PDF',
    desc: 'Design a company letterhead online for free. Add your logo, address and colours, write your letter and download it as a PDF. No sign-up.',
    kicker: 'Free letterhead design', h1: 'Letterhead Maker',
    lede: 'Make your letters look official. Add your logo, company details and brand colour to a letterhead template and download it as a PDF.',
    panel: ['Start your letterhead', 'A company letterhead, an office memo and a report cover.'],
    sections: [
      ['How to design a letterhead', `<p>Open the ${T('letterhead', 'Company letterhead')}, add your logo with Image and replace the company name, address, phone, email and website. Change the accent colour to your brand colour. Save it as your blank letterhead, then open it again whenever you write a letter, type the letter in the body and download it.</p>`],
      ['What to put on a letterhead', '<p>Your logo and company name at the top; your full address, phone number, email and website at the top or bottom. Many businesses also add a registration, tax or licence number. Keep it light: the letter is the important part.</p>'],
      ['Memos and reports', `<p>For internal notes use the ${T('memo', 'Office memo')}; for documents and proposals use the ${T('report-cover', 'Report cover')}. Both can carry the same logo and colours.</p>`],
    ],
    faq: [
      ['Is the letterhead maker free?', 'Yes. Design, edit and download your letterhead free of charge, without a watermark.'],
      ['Can I use my letterhead in Word?', 'The letterhead downloads as a PDF. You can type letters on it here, or convert the PDF to Word with our PDF to DOCX converter.'],
      ['Can I add a signature and stamp?', 'Yes. Use Sign for your signature and Image to place a photo of your company stamp.'],
    ],
  },
  {
    slug: 'certificate-maker', kind: 'template', cat: 'certificate', short: 'Certificate maker',
    title: 'Free Certificate Maker - Certificate Templates PDF',
    desc: 'Make certificates online for free: achievement, course completion and appreciation. Edit a template, add names and signatures, download as PDF.',
    kicker: 'Free certificate templates', h1: 'Certificate Maker',
    lede: 'Create a certificate of achievement, completion or appreciation in minutes. Edit the template, add the name and signature, and download a print-ready PDF.',
    panel: ['Choose a certificate', 'Landscape certificates for schools, courses, events and staff awards.'],
    sections: [
      ['How to make a certificate', `<ol><li>Choose ${T('cert-achievement', 'Certificate of achievement')}, ${T('cert-completion', 'Course completion')} or ${T('cert-appreciation', 'Certificate of appreciation')}.</li><li>Click the recipient\'s name and type the real name; change the text that says what the certificate is for.</li><li>Add your school or company logo with Image and the date.</li><li>Sign it with Sign, or leave the signature line empty to sign by hand after printing.</li><li>Download the PDF and print it on thick paper or send it by email.</li></ol>`],
      ['Certificates for many people', '<p>Making certificates for a whole class or team? Finish the first one, then use Duplicate page in the Pages panel and change only the name on each copy. You get one PDF with a page per person, ready to print in one go.</p>'],
      ['Ideas', '<p>Employee of the month, training completion, workshop participation, sports day winners, quiz competitions, volunteer thanks, internship completion and school merit awards all use the same layouts: change the title and the wording.</p>'],
    ],
    faq: [
      ['Is the certificate maker free?', 'Yes. Make and download certificates for free without a watermark.'],
      ['Can I print the certificate?', 'Yes. The certificates are A4 landscape. Print them on card or certificate paper for the best result.'],
      ['Can I make certificates for a whole class?', 'Yes. Duplicate the page for each person and change the name; it all downloads as one PDF.'],
      ['Can I change the colours and fonts?', 'Yes. Every border, colour and font can be changed, and there are more than 150 fonts including elegant script fonts for names.'],
    ],
  },
  {
    slug: 'flyer-maker', kind: 'template', cat: 'marketing', short: 'Flyer maker',
    title: 'Free Flyer Maker - Create Flyers and Posters as PDF',
    desc: 'Design a flyer or poster online for free. Edit an event flyer or sale poster template, add your photos and text, and download a print-ready PDF.',
    kicker: 'Free flyer and poster design', h1: 'Flyer Maker',
    lede: 'Design a flyer for your event, shop or service. Start from a template, add your own photos and text, and download a PDF to print or share.',
    panel: ['Choose a flyer or poster', 'Event flyers, sale posters and menus, ready to edit.'],
    sections: [
      ['How to make a flyer', `<p>Start with the ${T('event-flyer', 'Event flyer')} or the ${T('sale-poster', 'Sale poster')}. Replace the headline with one short, bold line, add the date, place and price, and put your phone number, website or social media at the bottom. Add your own photo with Image, change the colours to match your brand, and download the PDF.</p>`],
      ['Flyer design tips', '<p>People look at a flyer for about three seconds, so one big headline, one picture and one clear action ("Call now", "Visit us", "Book your seat") work best. Use no more than two fonts, keep strong contrast between text and background, and leave space around the edges so nothing is cut off when printed.</p>'],
      ['Print or share', '<p>The PDF prints sharply at A4. To post it on WhatsApp, Instagram or Facebook, convert the PDF to an image with our <a href="/pdf-to-jpg">PDF to JPG converter</a>.</p>'],
    ],
    faq: [
      ['Is the flyer maker free?', 'Yes. Design and download flyers and posters for free, with no watermark.'],
      ['Can I add my own pictures?', 'Yes. Use Image to add PNG, JPG or WebP photos, and resize, crop into a circle or move them anywhere.'],
      ['Can I share my flyer on social media?', 'Download the PDF, then convert it to JPG or PNG with our PDF converter and post the image.'],
    ],
  },
  {
    slug: 'menu-maker', kind: 'template', cat: 'marketing', short: 'Menu maker',
    title: 'Free Menu Maker - Restaurant Menu Template PDF',
    desc: 'Make a restaurant, cafe or food menu online for free. Edit the menu template with your dishes and prices and download a print-ready PDF.',
    kicker: 'Free menu template', h1: 'Restaurant Menu Maker',
    lede: 'Create a menu for your restaurant, cafe, bakery or food stall. Type your dishes and prices into the template and download a PDF to print.',
    panel: ['Start your menu', 'A restaurant menu template, plus flyers and posters for your offers.'],
    sections: [
      ['How to make a menu', `<p>Open the ${T('restaurant-menu', 'Restaurant menu')}, replace the restaurant name and add your logo. Type your dishes under each heading with a short description and the price, and add or remove headings for starters, mains, drinks and desserts. Download the PDF and print it, or share it with customers on WhatsApp.</p>`],
      ['Menu tips', '<p>Put your best-selling or most profitable dishes at the top of each section, where eyes land first. Keep descriptions to one line, write prices without currency symbols for a cleaner look, and use the same two fonts throughout. Update the PDF whenever prices change; it takes a minute.</p>'],
    ],
    faq: [
      ['Is the menu maker free?', 'Yes. Make and download your menu free of charge without a watermark.'],
      ['Can I make a menu in Urdu or Arabic?', 'Yes. Type in Urdu or Arabic and choose an Arabic-script font such as Noto Naskh Arabic; the letters join correctly in the PDF.'],
      ['Can I add pictures of food?', 'Yes. Use Image to add photos of your dishes anywhere on the menu.'],
    ],
  },
  {
    slug: 'invitation-maker', kind: 'template', cat: 'personal', short: 'Invitation maker',
    title: 'Free Invitation Maker - Party Invitation Card PDF',
    desc: 'Make invitation cards online for free: birthday, wedding, party and event invitations, plus thank-you cards. Edit a template and download as PDF.',
    kicker: 'Free invitation cards', h1: 'Invitation Card Maker',
    lede: 'Design an invitation for a birthday, wedding, dinner or event. Edit the card, add your details and download it to print or send.',
    panel: ['Choose a card', 'Party invitations and thank-you cards, ready to personalise.'],
    sections: [
      ['How to make an invitation card', `<p>Open the ${T('invitation', 'Party invitation')}, write who is invited and what for, then the date, time and address. Add a photo or change the colours to match the occasion, and download the PDF. Send it by WhatsApp or email, or print it on card.</p>`],
      ['What to write on an invitation', '<p>Include the host\'s name, the occasion, the date and time, the full address (with a map link if sending online), any dress code, and how to reply (RSVP) with a phone number and a reply-by date.</p>'],
      ['Say thank you afterwards', `<p>After the event, send the ${T('thank-you', 'Thank-you card')} to guests: change the message and add a photo from the day.</p>`],
    ],
    faq: [
      ['Is the invitation maker free?', 'Yes. Design and download invitation cards for free, with no watermark.'],
      ['Can I make a wedding or birthday invitation?', 'Yes. Change the title, text, colours and fonts of the party invitation to suit a wedding, birthday, engagement, Eid dinner or any event.'],
      ['Can I send the invitation on WhatsApp?', 'Yes. Send the PDF directly, or convert it to a JPG image with our PDF to JPG converter for a picture message.'],
    ],
  },
  {
    slug: 'business-card-maker', kind: 'template', cat: 'business', short: 'Business card maker',
    title: 'Free Business Card Maker - Printable Business Cards PDF',
    desc: 'Design business cards online for free. Edit the template with your name, title and contact details and download a printable PDF with 10 cards per page.',
    kicker: 'Free printable business cards', h1: 'Business Card Maker',
    lede: 'Design your business card and print ten on one sheet. Type your details once, copy them to every card, and download a print-ready PDF.',
    panel: ['Start your business cards', 'Ten standard 85 x 55 mm cards on one A4 page.'],
    sections: [
      ['How to make business cards', `<p>Open the ${T('business-cards', 'Business cards template')} and edit the first card: your name, job title, phone, email, website and logo. Then select everything on that card, copy it with Ctrl+C and paste it over the other cards, or change each card one by one. Download the PDF and print it on thick card, then cut along the guides.</p>`],
      ['Business card tips', '<p>Keep it simple: name, title, one phone number, one email and your website or social handle are enough. Use text at least 8 points in size so it is readable, and keep important details away from the edges so they are not cut off.</p>'],
    ],
    faq: [
      ['Is the business card maker free?', 'Yes. Design and download printable business cards for free, without a watermark.'],
      ['What size are the cards?', 'The standard 85 x 55 mm size, ten per A4 page.'],
      ['Can I add a QR code?', 'Yes. Make a QR code image with any QR generator and add it to the card with Image.'],
    ],
  },
  {
    slug: 'printable-planner', kind: 'template', cat: 'planning', short: 'Printable planner',
    title: 'Free Printable Planner - Weekly Planner, To-Do List PDF',
    desc: 'Make a printable weekly planner, to-do list, meeting agenda or lined notes page for free. Edit the template and download it as a PDF to print.',
    kicker: 'Free printable planners', h1: 'Printable Planner Maker',
    lede: 'Plan your week, list your tasks or prepare a meeting. Edit a planner template, add your own headings and download a PDF to print or fill in on screen.',
    panel: ['Choose a planner', 'Weekly planner, to-do checklist, meeting agenda and lined notes.'],
    sections: [
      ['Planners you can make', `<ul><li>${T('weekly-planner', 'Weekly planner')}: one landscape page with a box for each day and space for goals.</li><li>${T('todo-list', 'To-do checklist')}: tick-box lines for daily or project tasks.</li><li>${T('meeting-agenda', 'Meeting agenda')}: topics, times and owners in a table, for team meetings.</li><li>${T('lined-notes', 'Lined notes')}: a clean ruled page for notes and study.</li></ul>`],
      ['Fill it in on screen or print it', '<p>You can type straight into the planner here and tick boxes with the check tool, or download a blank copy and print a stack for the month. Add your own headings, change the colours and duplicate pages to make a whole planner booklet.</p>'],
    ],
    faq: [
      ['Are the planners free?', 'Yes. Edit, download and print planners for free.'],
      ['Can I make a monthly planner?', 'Yes. Start from the weekly planner, change the headings and use Table to make a grid with a box for each day of the month.'],
      ['Can I fill in the planner on my phone?', 'Yes. The editor works in mobile browsers; tap a line to type.'],
    ],
  },

  // ------------------------------------------------------------------- tools --
  {
    slug: 'sign-pdf', kind: 'tool', short: 'Sign PDF',
    title: 'Sign PDF Online Free - Add a Signature to a PDF',
    desc: 'Sign a PDF online for free. Draw or type your signature, place it on the document and download the signed PDF. Your file never leaves your device.',
    kicker: 'Free e-signature', h1: 'Sign PDF Online',
    lede: 'Add your signature to a contract, form or letter in under a minute. Draw it or type it, place it anywhere, and download the signed PDF.',
    sections: [
      ['How to sign a PDF', '<ol><li><strong>Open your PDF</strong> with Open a PDF. It loads in your browser; nothing is uploaded.</li><li><strong>Click Sign</strong> in the toolbar. Draw your signature with a mouse, touchpad or finger, or type your name and pick a handwriting style.</li><li><strong>Place it.</strong> Click where the signature goes, then drag the corners to resize it. Add the date next to it with Text.</li><li><strong>Download</strong> the signed PDF and send it back.</li></ol>'],
      ['Sign on your phone', '<p>The editor works in phone and tablet browsers, which is often the easiest way to sign: draw your signature with your finger on the screen. No app is needed.</p>'],
      ['Is an electronic signature valid?', '<p>In most countries a signature added to a PDF is accepted for everyday agreements such as offer letters, rental forms, school forms and invoices. Some documents, such as property transfers or court papers, may need a certified digital signature or a wet signature; check with the person asking you to sign.</p>'],
    ],
    faq: [
      ['Is it free to sign a PDF here?', 'Yes. Signing and downloading are free, with no watermark and no account.'],
      ['Is my document safe?', 'Your PDF is opened and signed in your browser and downloaded straight to your device. It is not uploaded to our server.'],
      ['Can I add initials and a date?', 'Yes. Create a second signature with your initials, and use Text to type the date anywhere on the page.'],
      ['Can more than one person sign?', 'Yes. Each person can add their signature in turn: download the PDF, pass it on, and the next person opens it here and signs.'],
    ],
  },
  {
    slug: 'add-text-to-pdf', kind: 'tool', tool: 'text', short: 'Add text to PDF',
    title: 'Add Text to PDF Online Free - Type on a PDF',
    desc: 'Add text to a PDF online for free. Type anywhere on the page, choose from 150+ fonts, sizes and colours, and download the PDF. No sign-up.',
    kicker: 'Type on any PDF', h1: 'Add Text to PDF',
    lede: 'Type anywhere on a PDF: notes, answers, addresses or corrections. Pick a font, size and colour, and download the updated file.',
    sections: [
      ['How to add text to a PDF', '<ol><li>Open your PDF.</li><li>Choose <strong>Text</strong> and click where you want to write.</li><li>Type, then change the font, size, colour, bold, italic or alignment in the bar above the page.</li><li>Drag the text box to move it; use the Design panel for an exact position.</li><li>Download the PDF.</li></ol>'],
      ['Change the text that is already there', '<p>To change existing words instead of adding new ones, choose <strong>Edit text</strong> and click a line in the PDF; it becomes editable so you can retype it. For scanned pages, which are pictures of text, cover the old words with Whiteout and type the new ones on top.</p>'],
      ['Write in Urdu, Arabic and more', '<p>More than 150 fonts are available, including Noto Naskh Arabic and Noto Sans Arabic for Urdu and Arabic. Letters are joined correctly in the downloaded PDF.</p>'],
    ],
    faq: [
      ['Can I add text to a PDF for free?', 'Yes. Adding text and downloading the PDF is free and leaves no watermark.'],
      ['Will the text look the same on other devices?', 'Yes. The font you choose is embedded in the PDF, so it looks the same everywhere.'],
      ['Can I add text to a scanned PDF?', 'Yes. You can type on top of a scanned page like any other. The scanned words themselves are part of the picture and cannot be retyped, but you can cover them with Whiteout.'],
    ],
  },
  {
    slug: 'fill-pdf', kind: 'tool', tool: 'text', short: 'Fill PDF form',
    title: 'Fill PDF Form Online Free - Type on PDF Forms',
    desc: 'Fill in PDF forms online for free: application forms, admission forms, tax forms. Type in the blanks, tick boxes, sign and download the filled PDF.',
    kicker: 'Fill in any form', h1: 'Fill PDF Forms Online',
    lede: 'Fill in an application, admission, visa or tax form without printing it. Type in the blanks, tick the boxes, sign, and download the completed PDF.',
    sections: [
      ['How to fill a PDF form', '<ol><li>Open the form PDF.</li><li>Choose <strong>Text</strong>, click on a blank line and type your answer. Make the text smaller or larger to fit the space.</li><li>Use the <strong>check mark</strong> or <strong>cross</strong> from Shapes to tick boxes.</li><li>Add your photo with Image if the form has a photo box, and your signature with Sign.</li><li>Download the filled form and submit or print it.</li></ol>'],
      ['Tips for neat forms', '<p>Turn on the rulers and drag a guide line out of the ruler to keep your answers on one line. Use a plain font like Helvetica at 10 to 11 points; most forms are designed for that size. Write dates in the format the form asks for, and check every page before downloading.</p>'],
      ['Forms that are scanned', '<p>Many forms are scanned paper, so there are no fields to click. That is fine here: you type on top of the page wherever you click, so scanned forms work just like digital ones.</p>'],
    ],
    faq: [
      ['Is it free to fill PDF forms here?', 'Yes. Fill in and download as many forms as you like, free and without a watermark.'],
      ['Does it work with scanned forms?', 'Yes. You can type anywhere on a scanned form, tick boxes and sign it.'],
      ['Is my personal information uploaded?', 'No. The form is filled in your browser and saved straight to your device.'],
    ],
  },
  {
    slug: 'highlight-pdf', kind: 'tool', tool: 'highlight', short: 'Highlight PDF',
    title: 'Highlight PDF Online Free - Highlight Text in a PDF',
    desc: 'Highlight text in a PDF online for free. Mark important lines in yellow, green or any colour, add notes, and download the highlighted PDF.',
    kicker: 'Mark what matters', h1: 'Highlight PDF',
    lede: 'Highlight important lines in study notes, contracts or reports. Choose a colour, drag over the text, and download the marked-up PDF.',
    sections: [
      ['How to highlight a PDF', '<ol><li>Open your PDF.</li><li>Choose <strong>Highlight</strong> and pick a colour.</li><li>Drag across the text you want to mark. Repeat for every line.</li><li>Add comments next to the highlights with Text, or circle things with Shapes.</li><li>Download the PDF.</li></ol>'],
      ['Study and review tips', '<p>Use one colour per meaning, for example yellow for key points, green for definitions and pink for questions. Highlight less than you think: a page that is all yellow shows nothing. When reviewing a contract, highlight dates, amounts and obligations, and add a note beside anything to ask about.</p>'],
    ],
    faq: [
      ['Can I highlight a PDF for free?', 'Yes. Highlighting and downloading are free, with no watermark.'],
      ['Can I change the highlight colour?', 'Yes. Pick any colour and change the opacity in the bar above the page.'],
      ['Can I remove a highlight?', 'Yes. Click the highlight and press Delete, or undo with Ctrl+Z.'],
    ],
  },
  {
    slug: 'whiteout-pdf', kind: 'tool', tool: 'whiteout', short: 'Whiteout PDF',
    title: 'Whiteout PDF Online Free - Erase Text in a PDF',
    desc: 'White out text or images in a PDF online for free. Cover mistakes or old details with white boxes, type the correct text on top, and download.',
    kicker: 'Cover and correct', h1: 'Whiteout PDF',
    lede: 'Cover a mistake, an old address or anything you do not want to show. Draw a white box over it, type the correction on top, and download the PDF.',
    sections: [
      ['How to white out a PDF', '<ol><li>Open your PDF.</li><li>Choose <strong>Whiteout</strong> and drag a box over the text or picture to cover.</li><li>Choose <strong>Text</strong> and type the correct details on the white area.</li><li>Download the PDF.</li></ol><p>The box is white by default; pick another colour if your page has a coloured background.</p>'],
      ['Whiteout is not redaction', '<p>Whiteout hides content visually, like correction tape on paper. The original text underneath can still be found by someone who copies text out of the PDF or opens it in a technical tool. Do not use it to remove passwords, ID numbers, bank details or other private data before sharing. For that, print the page and scan it again, or use a dedicated redaction tool.</p>'],
    ],
    faq: [
      ['Can I erase text from a PDF for free?', 'Yes. Cover text with Whiteout and download the PDF for free, without a watermark.'],
      ['Is the covered text really deleted?', 'No. It is hidden from view but can still be extracted from the file. Do not use whiteout to remove confidential information.'],
      ['Can I type on top of the whiteout?', 'Yes. Use Text to type the new words over the white box.'],
    ],
  },
  {
    slug: 'add-image-to-pdf', kind: 'tool', short: 'Add image to PDF',
    title: 'Add Image to PDF Online Free - Insert a Picture or Logo',
    desc: 'Insert an image into a PDF online for free. Add photos, logos, stamps or screenshots, resize and place them anywhere, and download the PDF.',
    kicker: 'Insert pictures', h1: 'Add Image to PDF',
    lede: 'Put a photo, logo, stamp or screenshot into your PDF. Place it anywhere, resize it, crop it into a circle, and download.',
    sections: [
      ['How to add an image to a PDF', '<ol><li>Open your PDF.</li><li>Click <strong>Image</strong> and choose a PNG, JPG or WebP file.</li><li>Click on the page to place it, then drag the corners to resize; the proportions stay the same. Hold Shift to stretch it freely, or Ctrl to resize from the centre.</li><li>Use the Image settings to show it as a circle or add a border.</li><li>Download the PDF.</li></ol>'],
      ['Common uses', '<p>Add a passport photo to an application form, a company logo to a letter or invoice, a stamp next to a signature, a QR code to a flyer, or a screenshot to a report. To add an image as a whole new page, use Image page in the Pages panel.</p>'],
      ['Replace an image that is already in the PDF', '<p>Choose <strong>Edit image</strong> and click a picture in the PDF to move, resize, replace or remove it.</p>'],
    ],
    faq: [
      ['Is it free to add images to a PDF?', 'Yes. Insert as many images as you like and download the PDF free, with no watermark.'],
      ['Which image formats can I add?', 'PNG, JPG and WebP. PNG images with transparent backgrounds, such as logos and stamps, stay transparent.'],
      ['Can I turn images into a PDF instead?', 'Yes. Use our JPG to PDF converter, or here use Image page to add each image as its own page.'],
    ],
  },
  {
    slug: 'add-page-numbers-to-pdf', kind: 'tool', short: 'Add page numbers to PDF',
    title: 'Add Page Numbers to PDF Online Free',
    desc: 'Number the pages of a PDF online for free. Choose the position and style (1, 1 / 10 or Page 1 of 10) and download the numbered PDF.',
    kicker: 'Number your pages', h1: 'Add Page Numbers to PDF',
    lede: 'Add page numbers to a report, thesis or document in seconds. Choose where they go and how they look, then download.',
    sections: [
      ['How to add page numbers', '<ol><li>Open your PDF.</li><li>Click <strong>Download</strong>.</li><li>Tick <strong>Add page numbers</strong>, then choose the position (bottom centre, bottom right, bottom left, top centre or top right) and the format: "1", "1 / 10" or "Page 1 of 10".</li><li>Download the numbered PDF.</li></ol>'],
      ['Before you number', '<p>Put the pages in the right order first: in the Pages panel you can drag pages to reorder them, delete blank ones, and rotate any that are sideways. If you need to merge several files into one document before numbering, add them with Merge PDF.</p>'],
    ],
    faq: [
      ['Is it free to add page numbers?', 'Yes. Numbering pages and downloading the PDF is free, without a watermark.'],
      ['Can I put "Page 1 of 10" on each page?', 'Yes. Choose the "Page 1 of 10" format in the download options.'],
      ['Can I add a watermark at the same time?', 'Yes. Tick Add a watermark in the same download box.'],
    ],
  },
  {
    slug: 'watermark-pdf', kind: 'tool', short: 'Watermark PDF',
    title: 'Add Watermark to PDF Online Free',
    desc: 'Add a text watermark such as CONFIDENTIAL, DRAFT or COPY to every page of a PDF online for free, or place your logo. Download the watermarked PDF.',
    kicker: 'Mark your documents', h1: 'Add a Watermark to PDF',
    lede: 'Stamp CONFIDENTIAL, DRAFT, COPY or your company name across every page, or place your logo as a watermark.',
    sections: [
      ['How to watermark a PDF', '<ol><li>Open your PDF.</li><li>Click <strong>Download</strong>.</li><li>Tick <strong>Add a watermark</strong> and type the text, for example CONFIDENTIAL, DRAFT or your company name.</li><li>Download: the watermark is placed diagonally across every page.</li></ol>'],
      ['Use your logo as a watermark', '<p>For an image watermark, add your logo with Image, make it large, and lower its opacity in the bar above the page so the text shows through. Copy it to other pages with Ctrl+C and Ctrl+V.</p>'],
    ],
    faq: [
      ['Is it free to watermark a PDF?', 'Yes. Add a watermark and download the PDF free.'],
      ['Does the watermark go on every page?', 'Yes. The text watermark from the download options is added to every page.'],
      ['Can someone remove the watermark?', 'A watermark discourages copying but is not a lock. For important documents, combine it with a PDF password.'],
    ],
  },
  {
    slug: 'delete-pdf-pages', kind: 'tool', short: 'Delete PDF pages',
    title: 'Delete Pages from PDF Online Free - Remove PDF Pages',
    desc: 'Remove pages from a PDF online for free. Delete, reorder, rotate or duplicate pages and download the new PDF. Your file stays on your device.',
    kicker: 'Organise your pages', h1: 'Delete PDF Pages',
    lede: 'Remove blank, extra or private pages from a PDF. You can also reorder, rotate and duplicate pages before downloading.',
    sections: [
      ['How to delete pages from a PDF', '<ol><li>Open your PDF. Every page appears in the Pages panel on the left.</li><li>Point at a page and click the bin icon to delete it.</li><li>Drag pages up or down to change the order, and use the rotate buttons for sideways pages.</li><li>Download the PDF with only the pages you kept.</li></ol>'],
      ['Other page tools', '<p>Add a blank page, duplicate a page, add a page from a template, add a picture as a page, or merge another PDF into this one, all from the Pages panel.</p>'],
    ],
    faq: [
      ['Is it free to delete PDF pages?', 'Yes. Remove pages and download the PDF for free.'],
      ['Can I undo a deleted page?', 'Yes. Press Ctrl+Z to bring it back before you download.'],
      ['Can I split a PDF?', 'To keep a few pages as a new file, delete the others and download. Repeat for each part you need.'],
    ],
  },
  {
    slug: 'rotate-pdf', kind: 'tool', short: 'Rotate PDF',
    title: 'Rotate PDF Online Free - Rotate PDF Pages',
    desc: 'Rotate PDF pages online for free. Turn one page or every page left or right, fix sideways scans and download the rotated PDF.',
    kicker: 'Fix sideways pages', h1: 'Rotate PDF Pages',
    lede: 'Turn sideways or upside-down pages the right way round. Rotate one page or all of them, then download.',
    sections: [
      ['How to rotate a PDF', '<ol><li>Open your PDF.</li><li>In the Pages panel, use the rotate left or rotate right button on each page that is the wrong way round.</li><li>Download the PDF; the pages stay rotated for everyone who opens it.</li></ol>'],
      ['Why pages end up sideways', '<p>Scanners and phone cameras often save landscape pages, receipts or ID cards the wrong way round. Rotating them here fixes the file itself, unlike rotating in a PDF viewer, which only changes your view.</p>'],
    ],
    faq: [
      ['Is it free to rotate PDF pages?', 'Yes. Rotate pages and download the PDF free.'],
      ['Can I rotate only one page?', 'Yes. Each page has its own rotate buttons in the Pages panel.'],
      ['Does rotating reduce quality?', 'No. The page is turned, not re-drawn, so text and images keep their quality.'],
    ],
  },
  {
    slug: 'merge-pdf', kind: 'tool', short: 'Merge PDF',
    title: 'Merge PDF Online Free - Combine PDF Files into One',
    desc: 'Merge PDF files online for free. Combine several PDFs into one document, reorder the pages and download. Files are merged in your browser.',
    kicker: 'Combine PDFs', h1: 'Merge PDF Files',
    lede: 'Combine several PDFs into one file: put them in order, remove pages you do not need, and download a single PDF.',
    sections: [
      ['How to merge PDFs', '<ol><li>Open the first PDF.</li><li>In the Pages panel, click <strong>Merge PDF</strong> and choose the next file. Its pages are added after the current page. Repeat for each file.</li><li>Drag pages to change the order and delete any you do not need.</li><li>Download the merged PDF.</li></ol>'],
      ['Merging images and scans', '<p>To add photos or scans as pages, use Image page in the Pages panel. To turn many images into one PDF at once, use our JPG to PDF converter and choose One PDF when you download.</p>'],
    ],
    faq: [
      ['Is it free to merge PDFs?', 'Yes. Combine PDFs and download the result for free, without a watermark.'],
      ['Are my files uploaded?', 'No. The PDFs are merged in your browser and the result is saved straight to your device.'],
      ['Can I add page numbers to the merged PDF?', 'Yes. Tick Add page numbers when you download.'],
    ],
  },
];
