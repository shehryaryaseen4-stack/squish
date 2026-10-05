'use strict';
// Hand-written guides for the most searched conversions. pages.js adds them to the matching
// conversion page: why people convert, when to keep the original, tips, common problems and
// extra FAQ entries (which also go into the page's FAQPage structured data).
//
// Everything here describes what this site's engines really do (see engines/): keep it in
// step when an engine changes. Plain text only; pages.js escapes nothing here, so no "<".
//
// Shape: 'from>to': { why, keep, tips: [..], problems: [[problem, fix], ..], faq: [[q, a], ..] }

const IMG_PRIVACY = 'Camera data such as GPS location, device model and date is removed from the converted file, so it is safe to share.';

module.exports = {
  // ------------------------------------------------------------------ images --
  'png>webp': {
    why: 'WebP was made by Google for the web. A PNG screenshot, logo or illustration saved as WebP is usually 25 to 35 percent smaller at the same look, and WebP keeps transparency, so it can replace PNG almost everywhere on a website. Smaller images mean faster pages, which visitors notice and search engines reward.',
    keep: 'Keep the PNG as your master copy if you will edit the image again, and use PNG when you send files to print shops or older desktop software, which do not always open WebP.',
    tips: [
      'For logos, icons and screenshots set Quality to 85 or more: text and sharp edges stay crisp.',
      'For photos saved as PNG, Quality 70 to 80 gives a much smaller WebP with no visible difference.',
      'Use Max dimension to shrink huge images to the size your page really shows, for example 1600 pixels.',
      'Transparent areas stay transparent, so you can place the WebP on any background.',
    ],
    problems: [
      ['The WebP is not much smaller than the PNG.', 'PNGs that are already optimised and have few colours compress well on their own. Lower the Quality a little, or keep the PNG.'],
      ['An old program will not open the WebP.', 'All current browsers support WebP, but some older image editors do not. Convert it back with WebP to PNG when you need to edit it there.'],
    ],
    faq: [
      ['Does PNG to WebP keep transparency?', 'Yes. WebP supports an alpha channel, so transparent and semi-transparent pixels are kept exactly as in the PNG.'],
      ['Is WebP lossless?', 'WebP can be lossless or lossy. This converter uses lossy WebP at the Quality you choose, which gives far smaller files; at Quality 90 and above the difference is very hard to see.'],
    ],
  },

  'jpg>webp': {
    why: 'Turning JPG photos into WebP is one of the easiest ways to speed up a website. At the same visual quality a WebP photo is typically 25 to 35 percent smaller than a JPG, which cuts page weight and loading time, especially on mobile data.',
    keep: 'Keep JPG for sending photos by email or messaging apps, for printing, and for anyone who will open the picture in older software. JPG is still the most widely supported photo format.',
    tips: [
      'Quality 75, the default, suits most photos on the web. Try 65 for thumbnails and backgrounds.',
      'Set Max dimension to the largest width your site shows, such as 1920 or 1280 pixels, for a much bigger saving.',
      'Phone photos are turned upright automatically, even when the camera stored them sideways.',
      IMG_PRIVACY,
    ],
    problems: [
      ['A site will not accept the WebP.', 'Some older platforms and forms still accept only JPG or PNG. Keep the original JPG for those.'],
      ['The WebP is bigger than the JPG.', 'This happens with JPGs that were already compressed very hard. Lower the Quality to 60 to 70, or keep the original.'],
    ],
    faq: [
      ['Will Google rank my site better with WebP?', 'Faster pages are part of how Google judges page experience, and smaller images are the most common quick win. WebP alone will not move rankings, but it helps your pages load faster.'],
      ['Can I convert many JPGs to WebP at once?', 'Yes. Select or drop as many JPG files as you like; each one is converted and you can download them all together as a ZIP.'],
    ],
  },

  'webp>png': {
    why: 'Many images saved from websites are WebP files, and some programs, older versions of Photoshop, Office and many upload forms still refuse them. PNG opens everywhere, keeps transparency and is the safest choice when you want to edit the image or reuse it in a document.',
    keep: 'If the image will only be used on a web page, keep the WebP: it is smaller and every current browser shows it.',
    tips: [
      'Set Quality to 100 for a lossless, full-colour PNG. That is the best choice for photos and for editing.',
      'Lower Quality values reduce the number of colours, which makes small files and is ideal for logos, icons and simple graphics.',
      'Transparent backgrounds are kept.',
    ],
    problems: [
      ['The PNG is much bigger than the WebP.', 'That is normal: PNG is a lossless format, while most WebP images are lossy. Use a lower Quality or a smaller Max dimension if size matters.'],
      ['My animated WebP became a still image.', 'PNG cannot hold animation, so the first frame is used. Use WebP to GIF to keep the animation.'],
    ],
    faq: [
      ['Why do websites use WebP images?', 'WebP files are noticeably smaller than PNG and JPG at the same quality, so pages load faster. That is why images you save from many sites arrive as .webp.'],
      ['Does converting WebP to PNG improve quality?', 'No conversion can restore detail that the WebP compression already removed, but PNG will not lose anything more, so it is the best format for further editing.'],
    ],
  },

  'webp>jpg': {
    why: 'JPG is the format every phone, computer, printer and website accepts. Converting a WebP to JPG is the quickest fix when an upload form, a print shop or an app says the file type is not supported.',
    keep: 'Keep the WebP if the image has a transparent background you need, because JPG cannot store transparency, or if it is only going on a web page.',
    tips: [
      'Quality 80 to 90 gives a JPG that looks the same as the WebP at a reasonable size.',
      'Transparent parts of the WebP are filled with white in the JPG.',
      'Use Max dimension when an upload form limits the image size or the file size.',
    ],
    problems: [
      ['The background turned white.', 'JPG has no transparency. Convert to PNG instead if you need to keep the transparent background.'],
      ['An animated WebP became a single picture.', 'JPG holds one image, so the first frame is used. Use WebP to GIF for an animation.'],
    ],
    faq: [
      ['Can I open WebP files without converting them?', 'Current versions of Chrome, Edge, Firefox and Safari, and the Windows and macOS photo viewers, open WebP. Converting to JPG is needed for older software and some upload forms.'],
      ['Is WebP to JPG lossy?', 'Yes, both formats are usually lossy, so the image is compressed again. At Quality 85 or more the difference is not visible in normal use.'],
    ],
  },

  'png>jpg': {
    why: 'Photos and screenshots saved as PNG can be several megabytes. The same picture as a JPG is often five to ten times smaller, which makes it easier to email, upload and share. JPG is also the format most forms and sites ask for.',
    keep: 'Keep PNG for logos, icons, line art and anything with text or a transparent background: JPG blurs sharp edges slightly and cannot store transparency.',
    tips: [
      'Quality 80 to 90 is a good choice for screenshots with text; 70 to 80 for photos.',
      'Transparent areas become white. If you need another background colour, add it in an editor before converting.',
      'Use Max dimension to make large images fit size limits on job portals, exam forms and social media.',
    ],
    problems: [
      ['Text in my screenshot looks fuzzy.', 'JPG compression softens hard edges. Raise the Quality to 90 or more, or keep the PNG for screenshots that are mostly text.'],
      ['The logo now has a white box around it.', 'JPG cannot be transparent. Keep the logo as PNG or convert it to WebP, which supports transparency and is small.'],
    ],
    faq: [
      ['Why is my JPG so much smaller than the PNG?', 'PNG stores every pixel exactly; JPG discards detail the eye barely notices. For photos that makes JPG many times smaller with no visible difference.'],
      ['How do I make a photo under 100 KB or 200 KB?', 'Convert to JPG, then lower the Quality and set a Max dimension such as 1200 pixels. Check the size in the list and convert again with other settings if needed.'],
    ],
  },

  'jpg>png': {
    why: 'People convert JPG to PNG when a website, app or design tool asks for PNG, when they want to edit a picture without adding more compression each time they save, or before cutting out a background to make it transparent.',
    keep: 'For ordinary photos JPG is the better format: the PNG will be much larger and will not look any sharper, because the detail lost when the JPG was made cannot be brought back.',
    tips: [
      'Set Quality to 100 for an exact, full-colour copy of the photo. Lower values reduce the number of colours to make the file smaller.',
      'PNG does not add transparency by itself. Remove the background in an image editor after converting.',
      'Phone photos are turned upright automatically.',
      IMG_PRIVACY,
    ],
    problems: [
      ['The PNG is several times bigger than the JPG.', 'That is expected: PNG stores every pixel without loss. Use a lower Quality or a smaller Max dimension, or keep the JPG.'],
      ['Gradients in the sky look banded.', 'Below Quality 100 the colours are reduced to a palette. Convert again at Quality 100.'],
    ],
    faq: [
      ['Does converting JPG to PNG improve quality?', 'No. PNG keeps the image exactly as it is now, so no more quality is lost, but it cannot undo the compression already in the JPG.'],
      ['Will the PNG have a transparent background?', 'No. A JPG has no transparency, so the PNG has the same solid background. You can make it transparent afterwards in an image editor.'],
    ],
  },

  'heic>jpg': {
    why: 'iPhones and iPads save photos as HEIC by default. HEIC is efficient, but Windows, many Android phones, websites and government or job portals cannot open it. JPG works everywhere, so converting is the simplest way to share or upload iPhone photos.',
    keep: 'Keep the HEIC originals on your iPhone or in iCloud: they are about half the size of JPG at the same quality and keep features such as depth data for Portrait mode.',
    tips: [
      'Quality 85 keeps the photo looking like the original; 70 to 75 makes files that are easy to email.',
      'Upload many HEIC photos at once and download them together as a ZIP.',
      IMG_PRIVACY,
      'To stop your iPhone making HEIC in future, go to Settings, Camera, Formats and choose Most Compatible.',
    ],
    problems: [
      ['The file will not convert.', 'Some apps add a .heic name to other kinds of files. Make sure it is a photo straight from the iPhone, not a screenshot shared through another app.'],
      ['My Live Photo became a still picture.', 'The moving part of a Live Photo is a separate video file. The HEIC holds the still photo, which is what gets converted.'],
    ],
    faq: [
      ['Why can I not open HEIC files on Windows?', 'Windows needs an extra codec from the Microsoft Store to show HEIC, and many programs do not support it at all. Converting to JPG avoids the problem.'],
      ['Does converting HEIC to JPG reduce quality?', 'JPG is compressed again, so in theory a little detail is lost. At Quality 85 or more you will not see a difference on screen or in normal prints.'],
    ],
  },

  'heic>png': {
    why: 'Convert HEIC to PNG when you need a lossless copy of an iPhone photo for editing, design work or a program that only accepts PNG. PNG keeps every pixel, so repeated edits do not add compression damage.',
    keep: 'For sharing and uploading, HEIC to JPG is the better choice: a PNG of a 12 megapixel photo can be 15 MB or more.',
    tips: [
      'Choose Quality 100 for a full-colour, lossless PNG. Lower values use fewer colours and give smaller files.',
      'Use Max dimension, for example 2000 pixels, if you do not need the full camera resolution.',
      IMG_PRIVACY,
    ],
    problems: [
      ['The PNG is huge.', 'Photos are large without lossy compression. Lower Max dimension, or use HEIC to JPG instead.'],
      ['Gradients look banded.', 'Convert again at Quality 100 to keep all colours.'],
    ],
    faq: [
      ['Is PNG better than JPG for iPhone photos?', 'Only for editing or when a program requires PNG. For sharing, JPG looks the same and is much smaller.'],
      ['Does the PNG keep the iPhone depth effect?', 'No. PNG holds a normal flat image; depth maps and Live Photo motion are not part of it.'],
    ],
  },

  'avif>jpg': {
    why: 'AVIF is a very efficient new image format, so more and more pictures saved from websites arrive as .avif. Many editors, Office, messaging apps and upload forms still do not accept it. JPG opens everywhere.',
    keep: 'For use on your own website AVIF is excellent: it is often smaller than both WebP and JPG at the same quality.',
    tips: [
      'Quality 80 to 85 keeps the look of the AVIF; AVIF images tend to be smooth, so higher JPG quality avoids visible blocks.',
      'Transparent areas are filled with white.',
      'Convert a whole folder of AVIF downloads at once and download a ZIP.',
    ],
    problems: [
      ['The JPG is much bigger than the AVIF.', 'That is normal: AVIF compresses far better than JPG. Lower the Quality or Max dimension if size matters.'],
      ['The background is white instead of transparent.', 'JPG has no transparency; use AVIF to PNG to keep it.'],
    ],
    faq: [
      ['What opens AVIF files?', 'Current Chrome, Edge, Firefox and Safari show AVIF, as do recent Windows and macOS versions. Older software usually does not, which is why converting to JPG helps.'],
      ['Why are websites switching to AVIF?', 'AVIF files are often 30 to 50 percent smaller than JPG at similar quality, so pages load faster.'],
    ],
  },

  'avif>png': {
    why: 'Convert AVIF to PNG when you need to edit an image saved from the web, keep its transparent background, or use it in a program that does not read AVIF yet.',
    keep: 'For publishing on the web keep the AVIF: it is many times smaller than the PNG and every current browser shows it.',
    tips: [
      'Quality 100 gives a lossless, full-colour PNG, best for editing.',
      'Transparency in the AVIF is kept.',
      'Lower Quality values reduce colours for smaller files, which suits icons and graphics.',
    ],
    problems: [
      ['The PNG is very large.', 'PNG is lossless; AVIF is one of the most efficient lossy formats. Lower Quality or Max dimension, or use AVIF to JPG.'],
      ['The file will not convert.', 'Some AVIF files are image sequences (animations). Make sure the file is a still image.'],
    ],
    faq: [
      ['Does AVIF to PNG keep transparency?', 'Yes. Transparent and semi-transparent areas are kept in the PNG.'],
      ['Is the PNG better quality than the AVIF?', 'It is an exact copy of what the AVIF shows, without further loss, so it is the right format for editing.'],
    ],
  },

  'gif>webp': {
    why: 'Animated GIFs are old and inefficient: they are limited to 256 colours and are often several megabytes. The same animation as WebP is usually much smaller and can show more colours, so it loads faster on websites and in chats that support WebP.',
    keep: 'Keep the GIF for places that only accept GIF, such as some forums, older email programs and a few messaging apps.',
    tips: [
      'Animation is kept: every frame and the timing are carried over to the WebP.',
      'Quality 70 to 80 gives the biggest saving with no visible change for most GIFs.',
      'Use Max dimension to shrink oversized GIFs for faster loading.',
    ],
    problems: [
      ['The WebP is not much smaller.', 'Short GIFs with few colours are already compact. Lower the Quality or the Max dimension.'],
      ['The app I post to shows only a still picture.', 'Some apps do not play animated WebP. Keep the GIF for those, or convert the GIF to MP4, which nearly every app plays.'],
    ],
    faq: [
      ['Does GIF to WebP keep the animation?', 'Yes. Animated GIFs stay animated, with the same frames and timing.'],
      ['Why are GIFs so big?', 'GIF compresses each frame in a very simple way designed in 1987. Modern formats like WebP and MP4 store the same animation far more efficiently.'],
    ],
  },

  'svg>png': {
    why: 'SVG is a vector format: it is perfect for logos and icons on websites, but many apps, social networks, document editors and upload forms need a normal picture. Converting the SVG to PNG gives an image with a transparent background that works everywhere.',
    keep: 'Keep the SVG as your original. It scales to any size without blurring, so you can always make a new PNG at another size from it.',
    tips: [
      'The PNG is drawn at the width and height written inside the SVG file.',
      'Transparent backgrounds stay transparent.',
      'Choose Quality 100 for the cleanest edges on logos with gradients.',
    ],
    problems: [
      ['The PNG is too small.', 'The size comes from the SVG itself. Open the SVG in an editor such as Inkscape, set a larger width and height, save, and convert again.'],
      ['Text looks different.', 'If the SVG uses a font that is not built into the file, a similar font is used. Convert text to paths (outlines) in your editor before saving the SVG.'],
    ],
    faq: [
      ['Is the PNG still a vector?', 'No. PNG is made of pixels, so it gets blurry if you enlarge it later. Keep the SVG for any future resizing.'],
      ['Can I use the PNG as a logo on social media?', 'Yes. PNG is accepted by all social networks, and the transparent background is kept where the network supports it.'],
    ],
  },

  'png>ico': {
    why: 'Websites use an .ico file as the favicon, the small icon in browser tabs and bookmarks, and Windows uses .ico for program and folder icons. One .ico file can hold several sizes, so it looks sharp everywhere.',
    keep: 'Keep the PNG: modern browsers also accept PNG favicons, and you will need it again to make other sizes.',
    tips: [
      'Start from a square PNG of at least 256 by 256 pixels with a transparent background.',
      'The ICO contains 16, 32, 48, 64, 128 and 256 pixel versions in one file.',
      'Images that are not square are cropped to a square from the centre.',
      'Simple, bold shapes read best at 16 pixels; fine detail and small text disappear.',
    ],
    problems: [
      ['Part of my logo was cut off.', 'Non-square images are cropped to a square. Add empty space around the logo in an editor so it is square before converting.'],
      ['The favicon does not change in my browser.', 'Browsers cache favicons for a long time. Clear the cache or open the site in a private window to see the new icon.'],
    ],
    faq: [
      ['What size should a favicon be?', 'Browsers mainly use 16 and 32 pixels in tabs and larger sizes for shortcuts. The ICO made here contains all the common sizes up to 256 pixels.'],
      ['Where do I put favicon.ico?', 'Upload it to the main folder of your website so it is available at yoursite.com/favicon.ico. Most browsers look there automatically.'],
    ],
  },

  'tiff>jpg': {
    why: 'TIFF files come from scanners, professional cameras and print work. They are excellent for archiving but huge, often 20 to 100 MB, and most websites, email services and phones will not show them. A JPG copy is small and opens everywhere.',
    keep: 'Keep the TIFF as your archive or print master. JPG is lossy, so editing and saving it repeatedly reduces quality.',
    tips: [
      'Quality 85 to 90 is right for scans you may print; 75 for sharing on screen.',
      'Use Max dimension to make big scans easy to email, for example 2500 pixels.',
      'Multi-page TIFFs, such as scanned documents, convert their first page.',
    ],
    problems: [
      ['Only one page was converted.', 'A JPG holds one image, so only the first page of a multi-page TIFF is used. For whole scanned documents, use TIFF to PDF.'],
      ['Colours look different.', 'TIFFs from print work may use CMYK colours; they are converted to the sRGB colours screens use, which can shift some tones.'],
    ],
    faq: [
      ['Why is my TIFF so large?', 'TIFF usually stores images with little or no compression so nothing is lost. JPG compresses the same picture many times smaller.'],
      ['Is TIFF or JPG better for printing?', 'TIFF is the safer master for professional print. A high-quality JPG (85 or more) is fine for everyday printing at home or in a photo shop.'],
    ],
  },

  'bmp>jpg': {
    why: 'BMP is an old Windows format that stores images without compression, so even a simple screenshot can be several megabytes. Converting to JPG usually makes the file 10 to 20 times smaller, ready to email or upload.',
    keep: 'There is rarely a reason to keep BMP, except for old software or devices that only read BMP. For graphics with sharp edges consider BMP to PNG instead.',
    tips: [
      'Quality 80 to 90 keeps screenshots and scans clear.',
      'For diagrams, logos and screenshots with lots of text, PNG keeps edges sharper than JPG.',
      'Upload a whole batch of BMP files and download a ZIP.',
    ],
    problems: [
      ['Text looks slightly blurry.', 'Use a higher Quality, or convert to PNG, which is lossless.'],
      ['The file will not open.', 'Some programs write unusual BMP variants. Open it in Paint and save it again as BMP, then convert.'],
    ],
    faq: [
      ['Why are BMP files so big?', 'Most BMP files are uncompressed: every pixel is stored in full. JPG and PNG compress the same image dramatically.'],
      ['Should I use JPG or PNG for a BMP?', 'JPG for photos and scans, PNG for screenshots, drawings and anything with text.'],
    ],
  },

  'jfif>jpg': {
    why: 'JFIF files are ordinary JPEG pictures with an unusual file ending, often produced when saving images from websites on Windows. Many upload forms reject the .jfif ending even though the picture inside is a normal JPEG. Converting gives a standard .jpg file.',
    keep: 'There is no reason to keep the .jfif version: the picture is the same JPEG image.',
    tips: [
      'Quality 90 or more keeps the image virtually identical, since the source is already a JPEG.',
      'Convert several JFIF files at once and download them as a ZIP.',
      'To stop Windows saving .jfif, save images with the right-click option and type .jpg at the end of the name.',
    ],
    problems: [
      ['A form says the file type is not allowed.', 'Forms often check only the file ending. The converted .jpg file is accepted.'],
      ['Could I just rename the file?', 'Often yes, but converting guarantees a clean, standard JPG that every program accepts.'],
    ],
    faq: [
      ['What is a JFIF file?', 'JFIF (JPEG File Interchange Format) is the standard way JPEG images are stored. Files ending in .jfif are JPEG images; only the name ending is different.'],
      ['Does JFIF to JPG lose quality?', 'The image is saved again as JPEG, so at very high Quality the difference is invisible.'],
    ],
  },

  'jpg>pdf': {
    why: 'PDF is the expected format for sending photographed documents, receipts, certificates, ID cards and assignments. A PDF opens the same on every device and is accepted by most official portals and email-based applications.',
    keep: 'Keep the JPG if you only want to share the picture; PDF adds nothing for ordinary photos.',
    tips: [
      'Each JPG becomes its own PDF, with one page the same size as the picture.',
      'Crop and straighten document photos in your phone gallery first for a cleaner PDF.',
      'Phone photos are turned upright automatically.',
    ],
    problems: [
      ['I wanted all pictures in one PDF.', 'Each image is converted to a separate PDF. Use a PDF tool that merges files if you need a single document.'],
      ['The PDF is large.', 'The PDF contains the full JPG. Make the JPG smaller first with Compress JPG, then convert.'],
    ],
    faq: [
      ['Will the text in my photo be searchable?', 'No. The PDF contains the picture of the page; text recognition (OCR) is not applied.'],
      ['What page size is the PDF?', 'The page matches the size of the image, so nothing is cropped or stretched.'],
    ],
  },

  'png>pdf': {
    why: 'Turning a PNG into a PDF is handy for submitting screenshots, scanned forms, diagrams and certificates where a PDF is required. The PDF looks the same on every device and printer.',
    keep: 'For sharing in chats or on websites, keep the PNG: it is simpler, smaller and opens as a picture straight away.',
    tips: [
      'Each PNG becomes its own one-page PDF at the size of the image.',
      'Screenshots stay sharp, because the PNG is placed in the PDF without lossy compression.',
      'Use Compress PDF afterwards if the result is too big for an upload form.',
    ],
    problems: [
      ['The page size is unusual.', 'The page matches the picture. For an A4 page, place the image on an A4 document in a word processor and use DOCX to PDF.'],
      ['I need several PNGs in one PDF.', 'Each image becomes a separate PDF; merge them with a PDF tool.'],
    ],
    faq: [
      ['Is the transparent background kept?', 'Transparent areas show as white on the PDF page, which is what printing would show too.'],
      ['Can I edit text in the PDF?', 'No. The PDF contains the image; text in the picture is not editable or searchable.'],
    ],
  },

  'pdf>jpg': {
    why: 'Converting PDF pages to JPG lets you post a page on social media, send it in a chat, use it in a presentation or upload it where only images are accepted.',
    keep: 'Keep the PDF for printing and for documents you send officially: it keeps text sharp at any zoom and stays searchable.',
    tips: [
      'Every page becomes a separate JPG. Documents with several pages are downloaded as a ZIP.',
      'Pages are rendered at 150 dpi, clear on screen and fine for normal printing.',
      'Use Quality 85 or more for pages with small text.',
    ],
    problems: [
      ['A password-protected PDF will not convert.', 'Remove the password in your PDF reader (print or save as a new PDF) and try again.'],
      ['I only need one page.', 'All pages are converted; open the ZIP and keep the page you need.'],
    ],
    faq: [
      ['How many pages can I convert?', 'Any number, as long as the PDF is within the file size limit. Long documents take a little longer.'],
      ['Is JPG or PNG better for PDF pages?', 'JPG is smaller and good for pages with photos. PNG keeps text and line drawings perfectly sharp.'],
    ],
  },

  'pdf>png': {
    why: 'PNG is the best image format for PDF pages with text, tables, charts and drawings: lines and letters stay perfectly sharp. Use it for presentations, documentation, design mock-ups or anywhere a picture of a page is needed.',
    keep: 'Keep the PDF for printing and sharing documents: it stays searchable and sharp at any zoom.',
    tips: [
      'Every page becomes its own PNG; several pages arrive in a ZIP.',
      'Pages are rendered at 150 dpi.',
      'For pages that are mostly photos, PDF to JPG gives smaller files.',
    ],
    problems: [
      ['The PNGs are large.', 'PNG is lossless. For photo-heavy pages use PDF to JPG instead.'],
      ['The PDF has a password.', 'Remove the password in your PDF reader by saving a copy without it, then convert.'],
    ],
    faq: [
      ['Is the page background transparent?', 'No. Pages are rendered as they would print, on a white background.'],
      ['Can I convert scanned PDFs?', 'Yes. Scanned pages are already pictures, so they convert like any other page.'],
    ],
  },

  // --------------------------------------------------------------- documents --
  'pdf>docx': {
    why: 'Word documents can be edited; PDFs mostly cannot. Converting PDF to DOCX is the usual way to reuse the text of a report, CV, letter or assignment when you no longer have the original Word file.',
    keep: 'Keep the PDF as the final version to send or print: it looks exactly the same everywhere.',
    tips: [
      'This works best with PDFs that were made from a text document, where you can select the text in your PDF reader.',
      'The result focuses on the text: paragraphs, headings and images are kept, while complex layouts are simplified.',
      'Check tables and multi-column pages after converting; they may need some tidying in Word.',
    ],
    problems: [
      ['The Word file is empty or contains only pictures.', 'The PDF is a scan: its pages are photos with no real text. Converting cannot read text from pictures; this needs OCR (text recognition) software.'],
      ['The layout looks different from the PDF.', 'PDF stores exact positions, while Word flows text. The text is all there; adjust spacing, columns and tables in Word.'],
    ],
    faq: [
      ['Can I convert a scanned PDF to Word?', 'Not with editable text. Scanned PDFs contain images of pages, and this converter does not perform OCR.'],
      ['Is my PDF kept after converting?', 'No. It is deleted from the server as soon as the Word file is ready.'],
    ],
  },

  'docx>pdf': {
    why: 'PDF is the safest format to send a CV, application, invoice or assignment: it looks the same on every phone and computer, cannot be changed by accident, and is what most portals ask for.',
    keep: 'Keep the DOCX as your working copy. Make changes there and convert again; editing a PDF is much harder.',
    tips: [
      'Common fonts are matched: Calibri, Cambria, Arial, Times New Roman and Courier New are replaced by metric-compatible fonts, so lines and pages break in the same places.',
      'Use standard fonts in your document for the most faithful result.',
      'Images, tables, headers, footers and page numbers are kept.',
    ],
    problems: [
      ['A special font looks different.', 'Fonts that are not installed on the server are replaced with a similar one. In Word, use File, Options, Save, Embed fonts, or export from Word yourself for exact typography.'],
      ['The page count changed.', 'A replaced font with different widths can move text to the next page. Using standard fonts avoids this.'],
    ],
    faq: [
      ['Will links in my Word document work in the PDF?', 'Yes, hyperlinks are kept and remain clickable in the PDF.'],
      ['Do comments and tracked changes appear?', 'Accept or reject tracked changes and delete comments in Word before converting, so the PDF shows the final text only.'],
    ],
  },

  'doc>pdf': {
    why: 'DOC is the old Word format from Word 97 to 2003. Converting an old DOC file to PDF makes it easy to read on any phone or computer and ready to print or send, even when the reader has no Word installed.',
    keep: 'Keep the DOC as your editable copy, or better, convert it to DOCX if you still need to change the text.',
    tips: [
      'Standard fonts such as Arial and Times New Roman are matched closely.',
      'Very old documents may use fonts that are no longer common; they are replaced by similar ones.',
      'Images, tables and page numbers are kept.',
    ],
    problems: [
      ['Some characters look wrong.', 'Very old DOC files sometimes use symbol fonts or old character sets. Open the file in Word, change the font of those characters, save and convert again.'],
      ['The file will not convert.', 'Password-protected DOC files cannot be opened. Remove the password in Word first.'],
    ],
    faq: [
      ['What is the difference between DOC and DOCX?', 'DOC is the older binary Word format; DOCX (Word 2007 and later) is based on XML, smaller and more robust. Both convert to PDF here.'],
      ['Do I need Microsoft Word?', 'No. The conversion runs on our server with LibreOffice.'],
    ],
  },

  'doc>docx': {
    why: 'Old DOC files can open in compatibility mode with features switched off, and some websites and apps only accept DOCX. Converting gives a modern Word file that is smaller and works with current Word, Google Docs and phones.',
    keep: 'There is little reason to keep using DOC, except for very old software that only reads it.',
    tips: [
      'Text, formatting, tables and images are carried over.',
      'Open the DOCX and check complex layouts, such as text boxes and drawings, which can shift slightly.',
      'DOCX files are usually smaller than the same DOC.',
    ],
    problems: [
      ['A drawing or text box moved.', 'Old drawing objects are rebuilt in the new format. Drag them back into place in Word.'],
      ['The file is password protected.', 'Remove the password in Word first; protected files cannot be opened for conversion.'],
    ],
    faq: [
      ['Will macros be kept?', 'No. DOCX cannot contain macros. Use the DOCM format if you need them.'],
      ['Can Google Docs open the result?', 'Yes. DOCX opens in Google Docs, Word, LibreOffice and Word on phones.'],
    ],
  },

  'xlsx>pdf': {
    why: 'A PDF of a spreadsheet is ideal for sharing reports, invoices, price lists and timetables with people who should read but not change the numbers, and it prints the same everywhere.',
    keep: 'Keep the XLSX to update figures and formulas; a PDF only shows the values as they were when you converted.',
    tips: [
      'Every sheet with content is included, using the print settings saved in the file.',
      'Before converting, set the print area, page orientation and Fit to page width in Excel for a neat PDF.',
      'Formulas show their calculated values.',
    ],
    problems: [
      ['A wide table is split across several pages.', 'Set Page Layout, Scale to Fit, Width 1 page in Excel and save, then convert again.'],
      ['Empty pages appear.', 'Cells with formatting but no data can extend the print range. Set a print area in Excel to cover only your table.'],
    ],
    faq: [
      ['Are hidden sheets included?', 'No, hidden sheets are not printed, so they do not appear in the PDF.'],
      ['Are charts kept?', 'Yes. Charts are drawn in the PDF as they appear on the sheet.'],
    ],
  },

  'pptx>pdf': {
    why: 'Sending slides as PDF means anyone can open them on any device without PowerPoint, the layout cannot shift, and the file is easy to print or upload. Teachers, universities and clients often ask for presentations as PDF.',
    keep: 'Keep the PPTX for presenting and editing: PDF does not play animations, transitions or videos.',
    tips: [
      'Each slide becomes one page.',
      'Use common fonts in your slides so text keeps its exact size and line breaks.',
      'Embedded videos and sounds cannot play in a PDF.',
    ],
    problems: [
      ['Animated parts all appear at once.', 'A PDF page shows the slide in its final state. Split builds into separate slides if the order matters.'],
      ['A font looks different.', 'Fonts not installed on the server are replaced. Embed fonts when saving in PowerPoint, or use standard fonts.'],
    ],
    faq: [
      ['Are speaker notes included?', 'No. The PDF contains the slides only.'],
      ['Can I convert old PPT files too?', 'Yes. Use PPT to PDF for presentations from PowerPoint 2003 and earlier.'],
    ],
  },

  'pdf>txt': {
    why: 'Extracting the plain text from a PDF lets you copy it into notes, search it, translate it or paste it somewhere without broken lines and hidden formatting.',
    keep: 'Keep the PDF for the formatted version with images, tables and fonts; the text file has words only.',
    tips: [
      'The text keeps the rough layout of each page, so columns and tables stay readable.',
      'The file is UTF-8, so accents and non-Latin scripts such as Urdu, Arabic and Chinese are preserved when the PDF contains real text.',
      'Images are skipped; only text is extracted.',
    ],
    problems: [
      ['The text file is empty.', 'The PDF is a scan made of pictures. Getting text from it needs OCR, which this converter does not do.'],
      ['Words are joined or in a strange order.', 'Some PDFs store text in an unusual order. Copying from the PDF reader may give a better result for those pages.'],
    ],
    faq: [
      ['Does it work with Urdu or Arabic PDFs?', 'Yes, if the PDF contains real text rather than images. Right-to-left text is saved as it is stored in the PDF.'],
      ['Can I open the TXT on my phone?', 'Yes. Plain text opens in any notes or file app.'],
    ],
  },

  'csv>xlsx': {
    why: 'CSV files from banks, shops, school portals and exports open in Excel, but formatting, formulas, several sheets and charts are lost as soon as you save. Converting to XLSX gives a proper workbook you can format and keep.',
    keep: 'Keep the CSV when another program needs to import the data again; CSV is the simplest exchange format.',
    tips: [
      'Commas separate the columns; each line becomes a row.',
      'Check columns with leading zeros, such as phone numbers or postal codes, and format them as text if needed.',
      'After converting, use Excel to add formatting, formulas and charts.',
    ],
    problems: [
      ['Everything is in one column.', 'The file probably uses semicolons or tabs between values. Use TSV to XLSX for tab-separated files.'],
      ['Leading zeros disappeared.', 'Numbers are detected automatically. Format the column as text in Excel and re-enter, or keep the original CSV for those values.'],
    ],
    faq: [
      ['Will Urdu or other non-English text work?', 'Yes, if the CSV is saved as UTF-8, which most modern exports are.'],
      ['Can one CSV become several sheets?', 'No. A CSV holds one table, so the workbook has one sheet.'],
    ],
  },

  'xlsx>csv': {
    why: 'CSV is the universal format for importing data into databases, accounting software, email tools, Google Contacts and online shops. Converting an Excel sheet to CSV is often the required first step.',
    keep: 'Keep the XLSX: the CSV contains only values, without formatting, formulas, colours, charts or extra sheets.',
    tips: [
      'Only the first sheet is exported. Move the sheet you need to the first position before converting.',
      'Formulas are saved as their current values.',
      'The CSV uses commas between values and UTF-8 text.',
    ],
    problems: [
      ['Data from my other sheets is missing.', 'CSV holds one table, so only the first sheet is converted. Save each sheet as its own workbook to export it.'],
      ['Dates look different.', 'Dates are written as text in a standard form. Check the import settings of the program you load the CSV into.'],
    ],
    faq: [
      ['Why does my import tool need CSV?', 'CSV is plain text that every program can read, so it is the common language between spreadsheets and other software.'],
      ['Is formatting kept?', 'No. CSV stores only the values of the cells.'],
    ],
  },

  // ------------------------------------------------------------ audio, video --
  'mp4>mp3': {
    why: 'Extracting the sound from an MP4 gives you an audio file for a lecture, podcast, interview, song or speech that you can play on any phone or music player, with a much smaller file than the video.',
    keep: 'Keep the MP4 if you will ever need the picture again. The MP3 contains only the sound track.',
    tips: [
      'The audio is encoded as a high-quality variable-bitrate MP3 (around 190 kbps), which suits both speech and music.',
      'The MP3 cannot sound better than the audio in the video, but it will not sound noticeably worse.',
      'Long recordings take a little longer; the file size limit applies to the video.',
    ],
    problems: [
      ['The conversion says there is no audio.', 'The video has no sound track, for example a screen recording made without audio.'],
      ['The MP3 is quiet.', 'The volume is kept as in the video. Use a free audio editor to normalise the volume afterwards.'],
    ],
    faq: [
      ['Can I convert videos from YouTube?', 'Only files you have on your device and the right to use. This site converts uploaded files; it does not download from other websites.'],
      ['How big will the MP3 be?', 'Roughly 1.4 MB per minute of audio, far smaller than the video.'],
    ],
  },

  'mov>mp4': {
    why: 'MOV is the video format of iPhones and Macs. Many Windows programs, Android phones, websites and upload forms play or accept MP4 more reliably. Converting MOV to MP4 makes iPhone videos easy to share and edit everywhere.',
    keep: 'Keep the MOV original if you edit in Final Cut or iMovie, or if it uses a professional codec such as ProRes.',
    tips: [
      'The video is encoded as H.264 with AAC sound, the most widely supported MP4 combination.',
      'The MP4 is often smaller than the iPhone original at the same visible quality.',
      'Resolution and frame rate are kept.',
    ],
    problems: [
      ['The file is over the size limit.', 'Long 4K videos are large. Trim the video on your phone, or record at 1080p for clips you want to share.'],
      ['An HDR video looks washed out.', 'iPhone HDR (Dolby Vision) videos are saved as standard 8-bit video, which can make colours look flatter. Turn off HDR Video in Settings, Camera, Record Video for clips you plan to convert.'],
    ],
    faq: [
      ['Is MP4 the same quality as MOV?', 'The video is re-encoded at a high-quality setting, so it looks the same in normal viewing while often being smaller.'],
      ['Will the MP4 play on WhatsApp and Windows?', 'Yes. H.264 MP4 plays on WhatsApp, Windows, Android, smart TVs and all browsers.'],
    ],
  },

  'mkv>mp4': {
    why: 'MKV is popular for films and recordings, but many TVs, phones, editors and websites do not play it. MP4 with H.264 video is the format almost every device supports.',
    keep: 'Keep the MKV if you need several audio languages or the subtitle tracks it contains.',
    tips: [
      'The video becomes H.264 and the sound AAC, which play everywhere.',
      'The main video and audio tracks are converted; subtitle tracks are not carried over.',
      'Resolution and frame rate stay the same.',
    ],
    problems: [
      ['The subtitles are missing.', 'Subtitle tracks are dropped because many of them cannot be stored in MP4. Use a separate SRT subtitle file with your player.'],
      ['The wrong audio language was used.', 'The default audio track of the MKV is converted. Set the track you want as default with a tool such as MKVToolNix first.'],
    ],
    faq: [
      ['Why will my TV not play MKV?', 'Many TVs and phones support MKV only with certain codecs. MP4 with H.264 is the safest choice.'],
      ['Does converting reduce quality?', 'The video is re-encoded at a high-quality setting. The difference is very hard to see in normal viewing.'],
    ],
  },

  'webm>mp4': {
    why: 'WebM is the video format of many browsers and screen recorders. iPhones, older Windows apps, video editors and social networks often prefer MP4. Converting makes the video play and upload everywhere.',
    keep: 'Keep the WebM for embedding on your own website; browsers play it well and it is often smaller.',
    tips: [
      'The result uses H.264 video and AAC audio, the most compatible MP4 combination.',
      'Odd frame sizes from screen recordings are adjusted by one pixel where H.264 needs even dimensions.',
      'Resolution is kept.',
    ],
    problems: [
      ['The MP4 is larger than the WebM.', 'H.264 is less efficient than the VP9 or AV1 inside many WebM files. That is the price of wider compatibility.'],
      ['The recording has no sound.', 'Some browser recorders save video only. The MP4 will be silent too.'],
    ],
    faq: [
      ['Can I upload the MP4 to Instagram or WhatsApp?', 'Yes. H.264 and AAC in MP4 is what these services recommend.'],
      ['Will the WebM transparency be kept?', 'No. MP4 with H.264 does not support transparent video.'],
    ],
  },

  'avi>mp4': {
    why: 'AVI is an old video container, common on cameras, CCTV systems and older downloads. Modern phones, browsers and TVs play MP4 far more reliably, and the MP4 is usually much smaller.',
    keep: 'Keep the AVI only if old software or equipment specifically needs it; MP4 is better for everything else.',
    tips: [
      'Video is re-encoded to H.264 and audio to AAC.',
      'The MP4 is often less than half the size of an old AVI at the same visible quality.',
      'Odd frame sizes are adjusted by one pixel where H.264 requires even dimensions.',
    ],
    problems: [
      ['The AVI will not convert.', 'Some CCTV systems use their own codecs inside AVI. Export the clip from the recorder software as a standard video first.'],
      ['The sound is out of sync.', 'Old AVI files with a damaged index can drift. Try exporting the clip again from the original device or software.'],
    ],
    faq: [
      ['Why is AVI so big?', 'Older codecs used in AVI files compress much less efficiently than H.264.'],
      ['Will the MP4 play on my phone?', 'Yes. H.264 MP4 plays on every modern phone.'],
    ],
  },

  'mp4>gif': {
    why: 'A GIF plays automatically and loops everywhere: in chats, forums, emails, documentation and READMEs where a video would not start by itself. Short clips, reactions and screen demos are the classic use.',
    keep: 'Keep the MP4 for anything longer than a few seconds or with sound. GIFs have no audio and get big quickly.',
    tips: [
      'The GIF is limited to 480 pixels wide and 12 frames per second to keep it small enough to share.',
      'Use clips of 2 to 6 seconds: every second adds to the file size.',
      'Colours are optimised per clip, so screen recordings and cartoons look especially clean.',
    ],
    problems: [
      ['The GIF is several megabytes.', 'Trim the video to the important part before converting. Busy scenes with lots of movement make larger GIFs.'],
      ['The colours are grainy.', 'GIF can show only 256 colours. For smooth colour, share the short MP4 or use MP4 to WebP.'],
    ],
    faq: [
      ['Does the GIF have sound?', 'No. The GIF format cannot hold audio.'],
      ['Does the GIF loop?', 'Yes. The GIF loops forever, like most GIFs online.'],
    ],
  },

  'gif>mp4': {
    why: 'A GIF of a few seconds can be many megabytes; the same clip as MP4 is often ten times smaller and looks better. Twitter/X, Instagram and many sites convert GIFs to video anyway, and MP4 is what video editors accept.',
    keep: 'Keep the GIF for places that need a GIF file, such as some forums, email newsletters and README files.',
    tips: [
      'The animation is turned into H.264 video, which plays everywhere.',
      'The MP4 has no sound, since GIFs have none.',
      'Set your player or post to loop if you want the MP4 to repeat.',
    ],
    problems: [
      ['The MP4 does not loop.', 'Video files play once by default. Most social apps loop short videos automatically; otherwise enable loop in the player.'],
      ['The GIF has transparency.', 'MP4 cannot be transparent; transparent areas get a solid background.'],
    ],
    faq: [
      ['Why is the MP4 so much smaller?', 'Modern video compression stores only what changes between frames, while GIF stores frames in an old, simple way.'],
      ['Can I post the MP4 on Instagram?', 'Yes, although very short clips may need to meet the minimum length Instagram asks for.'],
    ],
  },

  'wav>mp3': {
    why: 'WAV files from recorders, DAWs and audio CDs are uncompressed and take about 10 MB per minute. As MP3 the same audio takes around a seventh of the space, which makes it easy to send, upload and store on a phone.',
    keep: 'Keep the WAV as your master for editing, mixing and mastering: every MP3 encode removes some detail.',
    tips: [
      'The MP3 is encoded at high-quality variable bitrate (around 190 kbps), transparent for most listeners.',
      'Stereo and mono recordings keep their channels.',
      'Trim silence before converting for an even smaller file.',
    ],
    problems: [
      ['The MP3 is too big for a form.', 'Very long recordings are still large. Split the recording into parts, or use a speech-focused format.'],
      ['The sound clips or distorts.', 'If the WAV is recorded too loud, the MP3 shows it too. Lower the level in an editor before converting.'],
    ],
    faq: [
      ['Is MP3 good enough for music?', 'At the quality used here most people cannot tell MP3 from the WAV on normal headphones and speakers.'],
      ['How much smaller is the MP3?', 'Usually around seven times smaller than CD-quality WAV.'],
    ],
  },

  'm4a>mp3': {
    why: 'M4A is the audio format of iPhone voice memos, iTunes and many recorders. Some car stereos, older players, Windows apps and upload forms accept only MP3. Converting makes the recording play anywhere.',
    keep: 'Keep the M4A for Apple devices; at the same size it often sounds slightly better than MP3.',
    tips: [
      'Voice memos and music are encoded as high-quality MP3 that keeps the original sound.',
      'The length and channels stay the same.',
      'Batch-convert many voice notes at once and download a ZIP.',
    ],
    problems: [
      ['A purchased iTunes song will not convert.', 'Old iTunes songs bought before 2009 can be copy protected, and protected files cannot be converted.'],
      ['The MP3 is larger than the M4A.', 'MP3 is less efficient than AAC, so it needs more space for the same sound quality.'],
    ],
    faq: [
      ['Can I convert WhatsApp voice notes?', 'WhatsApp voice notes are usually OPUS or OGG files. Use OGG to MP3 or OPUS to MP3 for those.'],
      ['Does M4A to MP3 lose quality?', 'Both formats are lossy, so the audio is compressed again, but at the quality used here the difference is very hard to hear.'],
    ],
  },

  'flac>mp3': {
    why: 'FLAC keeps music in lossless quality, but the files are large. MP3 copies are a fraction of the size, so your music fits on a phone or plays in a car or an old player that does not support FLAC.',
    keep: 'Keep your FLAC files as the archive. You can always make new MP3s from them, but not the other way round.',
    tips: [
      'The MP3 uses high-quality variable bitrate, which most listeners cannot distinguish from the FLAC.',
      'Song length and stereo are kept.',
      'Convert a whole album at once and download it as a ZIP.',
    ],
    problems: [
      ['The album art is missing.', 'Only the sound is converted; track titles and artist names are usually kept, but cover pictures are not. Add the cover back with a tag editor such as Mp3tag.'],
      ['High-resolution files sound the same as CD files.', 'MP3 is limited to CD-like sample rates, so 24-bit or 96 kHz detail is reduced.'],
    ],
    faq: [
      ['How much smaller is MP3 than FLAC?', 'Usually about four times smaller.'],
      ['Can I convert MP3 back to FLAC for better quality?', 'No. The FLAC would be bigger but sound exactly like the MP3.'],
    ],
  },

  'ogg>mp3': {
    why: 'OGG files come from games, Linux apps, some voice recorders and messaging apps. Phones, cars and many programs play MP3 more reliably, so converting makes the audio easy to use anywhere.',
    keep: 'Keep the OGG if it plays fine where you need it: OGG Vorbis is efficient and open.',
    tips: [
      'The MP3 is encoded at high quality, keeping the original sound.',
      'Mono voice recordings stay mono, which keeps the file small.',
      'Convert many files together and download a ZIP.',
    ],
    problems: [
      ['The file will not convert.', 'Some apps use .ogg for files containing other codecs. Make sure the file plays in a player such as VLC.'],
      ['The MP3 is bigger than the OGG.', 'Vorbis is more efficient than MP3, so the MP3 needs more space for the same sound.'],
    ],
    faq: [
      ['What is an OGG file?', 'OGG is an open container, usually holding Vorbis or Opus audio. It is common in games, Android and Linux software.'],
      ['Is quality lost?', 'Both formats are lossy, but at the quality used here the difference is very hard to hear.'],
    ],
  },

  // ------------------------------------------------------------------ ebooks --
  'epub>pdf': {
    why: 'A PDF of an EPUB book or document can be printed, opened on any computer without an e-reader app, and shared with people who are used to PDF. It is useful for study notes, manuals and books you want to annotate on a tablet.',
    keep: 'Keep the EPUB for reading on phones and e-readers: its text reflows to fit any screen and font size, while a PDF has fixed pages.',
    tips: [
      'Chapters, headings and images are kept.',
      'Text is laid out on fixed pages, so small screens will need zooming.',
      'Books with DRM copy protection cannot be converted.',
    ],
    problems: [
      ['The conversion fails for a bought book.', 'Books from many stores are protected with DRM, which prevents conversion.'],
      ['Some styling differs.', 'EPUB styles are adapted to fixed pages; very custom layouts can look simpler in the PDF.'],
    ],
    faq: [
      ['Is the text in the PDF selectable?', 'Yes. The PDF contains real text, so you can search, select and copy it.'],
      ['Can I print the PDF?', 'Yes, that is one of the main reasons to convert.'],
    ],
  },

  'epub>mobi': {
    why: 'MOBI is the older Kindle format. Converting EPUB to MOBI helps if you have an older Kindle or an app that reads only MOBI.',
    keep: 'For current Kindles, Amazon recommends sending EPUB files through Send to Kindle, which converts them for you; MOBI is no longer accepted there. Use EPUB to AZW3 for newer Kindles connected by USB.',
    tips: [
      'Chapters, images and the table of contents are kept.',
      'Copy the MOBI to the documents folder of your Kindle over USB.',
      'Books with DRM cannot be converted.',
    ],
    problems: [
      ['Send to Kindle rejects the MOBI.', 'Amazon stopped accepting MOBI by email and app in 2022. Send the EPUB instead.'],
      ['Fonts and layout look simpler.', 'MOBI supports less styling than EPUB, so some formatting is simplified.'],
    ],
    faq: [
      ['Should I use MOBI or AZW3?', 'AZW3 supports better formatting and is read by all Kindles since 2011. Use MOBI only for very old devices.'],
      ['Is DRM removed?', 'No. Protected books cannot be converted.'],
    ],
  },

  'mobi>epub': {
    why: 'EPUB is the open ebook standard read by Apple Books, Google Play Books, Kobo and most reading apps, and it is now accepted by Send to Kindle. Converting old MOBI files makes your library readable on any device.',
    keep: 'Keep the MOBI only if you still read on a very old Kindle that cannot open newer formats.',
    tips: [
      'Chapters, images and the table of contents are kept.',
      'EPUB reflows to any screen size and font setting.',
      'Books with DRM cannot be converted.',
    ],
    problems: [
      ['A Kindle store book fails to convert.', 'Books bought from Amazon are usually DRM protected, which blocks conversion.'],
      ['The cover is missing.', 'Some MOBI files keep the cover separately. Add it in an ebook manager such as Calibre.'],
    ],
    faq: [
      ['Can I send the EPUB to my Kindle?', 'Yes. Send to Kindle accepts EPUB and converts it for your device.'],
      ['Which apps read EPUB?', 'Apple Books, Google Play Books, Kobo, Moon+ Reader, Lithium and many more.'],
    ],
  },

  // ------------------------------------------------------------------- fonts --
  'ttf>woff2': {
    why: 'WOFF2 is the font format made for websites: it is a compressed TTF, typically 30 to 50 percent smaller, so custom fonts load faster. Every current browser supports it.',
    keep: 'Keep the TTF for installing the font on your computer and for design apps; WOFF2 is for websites only.',
    tips: [
      'The letter shapes are not changed, only packed more tightly.',
      'Reference the WOFF2 in your CSS with @font-face and format("woff2").',
      'Check the font licence allows use on the web before publishing it.',
    ],
    problems: [
      ['The font does not show on my site.', 'Check the path in @font-face, and that your server sends the file. Fonts loaded from another domain need CORS headers.'],
      ['Windows will not install the WOFF2.', 'WOFF2 is a web format. Install the original TTF on your computer.'],
    ],
    faq: [
      ['Do I still need WOFF or TTF for old browsers?', 'Only for very old browsers such as Internet Explorer. Today WOFF2 alone is enough for almost all visitors.'],
      ['Does it change how the font looks?', 'No. The outlines are identical; only the compression is different.'],
    ],
  },

  'woff2>ttf': {
    why: 'Fonts downloaded for websites often come as WOFF2, which design programs and operating systems cannot install. Unpacking WOFF2 to TTF gives you a font file you can install and use in Word, Photoshop or Canva.',
    keep: 'Keep the WOFF2 for use on websites: it is much smaller and every current browser loads it.',
    tips: [
      'The font is unpacked without changing any letter shapes.',
      'Double-click the TTF to install it on Windows or macOS.',
      'Make sure the font licence allows desktop use.',
    ],
    problems: [
      ['The installed font name is odd.', 'Web fonts are sometimes renamed or split into subsets. Download the full desktop version from the font maker if available.'],
      ['Some characters are missing.', 'Web fonts are often subsets containing only the letters a site needs, such as Latin only.'],
    ],
    faq: [
      ['Is converting WOFF2 to TTF legal?', 'The conversion itself is just unpacking; whether you may use the font depends on its licence. Free fonts such as those on Google Fonts allow it.'],
      ['Will the TTF look the same?', 'Yes. The outlines inside are exactly the same.'],
    ],
  },
};
