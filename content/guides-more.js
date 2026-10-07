'use strict';
// More hand-written conversion guides, same shape and rules as content/guides.js
// (plain text, no "<" or "&", describe only what the engines in engines/ really do).
// pages.js merges this file into the guides, so every pair here is also indexed.

const IMG_PRIVACY = 'Camera data such as GPS location, device model and date is removed from the converted file, so it is safe to share.';
const OPTIONS = 'Click Options on a file to set Quality and Resize before you convert.';
const ONE_PAGE = 'Each image becomes one PDF page, the same size as the image, so nothing is cropped or stretched.';
const DRM = 'Books bought from Kindle, Kobo or Google Play are usually DRM-protected and cannot be converted. DRM-free books, such as those from Project Gutenberg or many independent authors, work.';
const AUDIO_TAGS = 'Song details such as title, artist and album are usually carried over to the new file.';

module.exports = {
  // ------------------------------------------------------------------ images --
  'webp>gif': {
    why: 'GIF is still the format that chat apps, forums, email newsletters and older content systems accept everywhere. Turning a WebP image into a GIF lets you post it in places that refuse WebP uploads.',
    keep: 'Keep the WebP whenever the image goes on a website: it is much smaller than a GIF and shows millions of colours instead of 256.',
    tips: [
      'Set Quality to 100 for the full 256-colour palette; lower values use fewer colours and make smaller files.',
      'Use Resize to shrink large images, since GIF files grow quickly with size.',
      'Simple graphics such as stickers, icons and logos look best as GIF; photos may show banding.',
    ],
    problems: [
      ['My animated WebP became a still GIF.', 'Only the first frame of an animated WebP is converted. To share an animation as GIF, convert the original video with MP4 to GIF instead.'],
      ['Colours look grainy or banded.', 'GIF can only store 256 colours. Raise Quality to 100, or use PNG if the picture does not need to be a GIF.'],
    ],
    faq: [
      ['Does WebP to GIF keep transparency?', 'Yes, but GIF transparency is on or off for each pixel, so soft, semi-transparent edges become hard edges.'],
      ['Why is the GIF bigger than the WebP?', 'GIF uses much older compression than WebP. A bigger file is normal; use Resize to bring it down.'],
    ],
  },

  'png>gif': {
    why: 'GIF is accepted by almost every forum, email client and messenger, including old ones. Converting a PNG logo, icon or simple drawing to GIF is useful when an upload form or template only allows GIF.',
    keep: 'Keep the PNG for anything that needs smooth colours, soft shadows or semi-transparent edges, and as your editable master copy.',
    tips: [
      'Flat graphics with few colours, such as logos, buttons and diagrams, convert to GIF with almost no visible change.',
      'Quality 100 uses the full 256 colours; lower values give smaller files with fewer colours.',
      'Transparent backgrounds stay transparent.',
    ],
    problems: [
      ['The edges look jagged on a dark background.', 'GIF transparency is on or off, so anti-aliased edges lose their soft blending. Place the GIF on a background close to the one it was designed for.'],
      ['Photos look banded.', 'GIF is limited to 256 colours. Keep photos as PNG, JPG or WebP.'],
    ],
    faq: [
      ['Can I make an animated GIF from several PNGs?', 'Not with this tool: each PNG becomes its own still GIF. To make an animation, start from a video and use MP4 to GIF.'],
      ['Is GIF smaller than PNG?', 'For simple graphics with few colours, often yes. For detailed images PNG is usually smaller and looks better.'],
    ],
  },

  'gif>png': {
    why: 'PNG opens in every image editor and keeps sharp edges and transparency. Converting a GIF to PNG gives you a clean still image to edit, put in a document or use as a thumbnail.',
    keep: 'Keep the GIF if it is animated and you want the animation: PNG stores a single picture.',
    tips: [
      'Quality 100 gives a lossless PNG with exactly the GIF colours.',
      'Transparent parts of the GIF stay transparent in the PNG.',
      'Use Resize to make a smaller preview image from a large GIF.',
    ],
    problems: [
      ['Only one picture came out of my animated GIF.', 'PNG is a still format, so the first frame of the animation is converted.'],
      ['The PNG is larger than the GIF.', 'This is normal for simple GIFs. Lower the Quality a little to reduce the number of colours and the file size.'],
    ],
    faq: [
      ['Does GIF to PNG lose quality?', 'No. GIF has at most 256 colours and PNG can store them all exactly, so at Quality 100 the PNG looks identical to the GIF frame.'],
      ['Can I get every frame of a GIF as PNG?', 'Not here: the first frame is converted. Most GIF animations start on a representative frame, which works well as a thumbnail.'],
    ],
  },

  'gif>jpg': {
    why: 'JPG is the format that photo printing services, job portals and many social sites ask for. Converting a GIF to JPG gives you a still picture that every service will accept.',
    keep: 'Keep the GIF if it is animated or has a transparent background: JPG supports neither.',
    tips: [
      'Transparent areas are filled with white.',
      'Quality 85 to 90 keeps text and edges in the image crisp.',
      'Upload several GIFs at once and download all the JPGs as a ZIP.',
    ],
    problems: [
      ['The animation is gone.', 'JPG stores one picture, so the first frame of an animated GIF is converted.'],
      ['Text has fuzzy edges.', 'JPG compression blurs sharp edges slightly. Raise Quality to 90 or more, or use GIF to PNG instead.'],
    ],
    faq: [
      ['Why does my transparent GIF have a white background?', 'JPG cannot store transparency, so transparent pixels are filled with white. Use GIF to PNG to keep the transparent background.'],
      ['Will the JPG be smaller?', 'For photos and detailed images usually yes; for simple flat graphics a GIF or PNG can be smaller.'],
    ],
  },

  'jpg>gif': {
    why: 'Some forums, older email templates and signature tools only accept GIF images. Converting a JPG to GIF makes the picture usable there.',
    keep: 'Keep the JPG for photos: it shows millions of colours, while GIF is limited to 256 and makes larger files for photos.',
    tips: [
      'Use Resize to make the image smaller first; GIF files of large photos get big quickly.',
      'Quality 100 uses the full 256-colour palette and gives the smoothest result.',
      'Graphics with few colours, such as banners and logos saved as JPG, convert well.',
    ],
    problems: [
      ['The photo looks blotchy.', 'GIF can only use 256 colours, which shows in skies and skin tones. Keep the JPG, or use PNG if you need a lossless format.'],
      ['The GIF is much bigger than the JPG.', 'GIF compression is not made for photos. Reduce the size with Resize.'],
    ],
    faq: [
      ['Can I make a moving GIF from a JPG?', 'No. A single JPG becomes a still GIF. For an animation start from a video, for example with MP4 to GIF.'],
      ['Is there any reason to use GIF for photos?', 'Only when a site accepts nothing else. For everything else JPG, PNG or WebP look better and are smaller.'],
    ],
  },

  'jpg>ico': {
    why: 'Windows icons and website favicons use the ICO format. Converting a JPG logo or photo to ICO gives you a ready icon file with all the standard sizes inside.',
    keep: 'Keep the JPG as your original picture. ICO files are small icons and are not useful for anything else.',
    tips: [
      'The ICO holds 16, 32, 48, 64, 128 and 256 pixel versions, so it looks sharp in browser tabs, on the desktop and in the taskbar.',
      'Images that are not square are cropped to a square from the centre, so put the important part in the middle.',
      'Simple, bold designs read better at 16 pixels than detailed photos.',
    ],
    problems: [
      ['The icon has a white box around it.', 'JPG has no transparency, so the background stays. Start from a PNG with a transparent background and use PNG to ICO.'],
      ['Part of my logo is cut off.', 'Wide or tall images are cropped to a square. Add space around the logo so it is square before converting.'],
    ],
    faq: [
      ['How do I use the ICO as a favicon?', 'Rename it favicon.ico and place it in the main folder of your website. Most browsers find it there automatically.'],
      ['Can I use this ICO for a Windows folder or shortcut?', 'Yes. Right-click the shortcut or folder, choose Properties, then Change Icon, and select the ICO file.'],
    ],
  },

  'heic>webp': {
    why: 'iPhone photos are saved as HEIC, which most websites cannot show. WebP is the web format: converting HEIC straight to WebP gives small, fast-loading images for a blog, online shop or portfolio without a JPG step in between.',
    keep: 'Keep the HEIC originals on your phone or in iCloud. They hold the full-quality photo and features such as depth data.',
    tips: [
      'Quality 75 to 80 suits most photos on the web.',
      'Choose Max 1920px or Max 1280px under Resize: iPhone photos are about 4000 pixels wide, much more than a web page needs.',
      'Photos are turned upright automatically.',
      IMG_PRIVACY,
    ],
    problems: [
      ['The file will not convert.', 'Make sure it is a real HEIC photo from an iPhone or iPad. Files renamed to .heic from another format cannot be read.'],
      ['Colours look slightly different.', 'Some iPhone photos use a wide colour range. Most screens show the WebP the same, but a few colours can look a little less vivid.'],
    ],
    faq: [
      ['Is WebP better than JPG for iPhone photos on a website?', 'For websites, yes: WebP is usually 25 to 35 percent smaller at the same quality, so pages load faster.'],
      ['Can I convert many HEIC files to WebP at once?', 'Yes. Drop as many as you like and download all the WebP files together as a ZIP.'],
    ],
  },

  'heic>pdf': {
    why: 'Forms, visa portals and offices often ask for documents as PDF. If you photographed a receipt, ID or certificate with an iPhone, converting the HEIC to PDF gives you a file every portal accepts.',
    keep: 'Keep the HEIC photo as well. The PDF is meant for sending and printing; if you need the picture again for editing or sharing, convert the original instead of the PDF.',
    tips: [
      ONE_PAGE,
      'The photo is stored without extra compression, so the PDF can be large. If a portal has a size limit, convert HEIC to JPG first, then JPG to PDF, which keeps the JPG compression and makes a much smaller PDF.',
      'Each HEIC file becomes its own PDF.',
    ],
    problems: [
      ['The PDF is too big to upload.', 'Use HEIC to JPG with Resize set to Max 1920px, then convert the JPG to PDF. The result is usually well under 1MB.'],
      ['The page is very large when printed.', 'The page is the size of the photo. Choose Fit to page in the print dialog to print it on A4 or Letter paper.'],
    ],
    faq: [
      ['Can I combine several iPhone photos into one PDF?', 'Not with this tool: each photo becomes a separate PDF. Many free PDF readers and online tools can merge PDFs afterwards.'],
      ['Is the text in the PDF searchable?', 'No. The PDF contains the photo as a picture; text in it cannot be selected unless you run text recognition (OCR) software.'],
    ],
  },

  'avif>webp': {
    why: 'AVIF is a newer image format that some older browsers, apps and editors still cannot open. WebP is supported by every current browser and most image tools, so converting AVIF to WebP keeps files small while reaching more people.',
    keep: 'Keep the AVIF if your site only needs to support current browsers: AVIF is often even smaller than WebP.',
    tips: [
      'Quality 80 gives a WebP that looks like the AVIF.',
      'Transparency is kept.',
      'Use Resize if the image is bigger than the space it fills on your page.',
    ],
    problems: [
      ['The WebP is larger than the AVIF.', 'That is normal: AVIF compresses better. Lower Quality to 70 if you need a smaller file.'],
      ['The file will not convert.', 'Some rare AVIF variants cannot be read. Try saving the picture again from its source.'],
    ],
    faq: [
      ['Is AVIF or WebP better?', 'AVIF usually makes smaller files, WebP works in more places and is faster to create. For the widest support choose WebP.'],
      ['Does AVIF to WebP keep transparency?', 'Yes. Both formats support transparent backgrounds.'],
    ],
  },

  'jpg>avif': {
    why: 'AVIF can make photos around half the size of a JPG at similar quality. For a website with many photos, converting to AVIF can cut page weight dramatically and help pages load faster on mobile.',
    keep: 'Keep JPG for email, printing, social media and older software, which may not open AVIF.',
    tips: [
      'Start with Quality 60 to 70: AVIF looks good at lower settings than JPG.',
      'Resize to the width your site shows, for example Max 1920px, for the biggest saving.',
      'AVIF takes longer to create than JPG or WebP, so large batches need a little patience.',
      IMG_PRIVACY,
    ],
    problems: [
      ['An app will not open the AVIF.', 'Current browsers show AVIF, but some editors and older phones cannot. Use JPG to WebP for wider support.'],
      ['Fine detail looks smoothed.', 'Raise Quality to 75 or 80. AVIF tends to smooth textures at very low settings.'],
    ],
    faq: [
      ['How much smaller is AVIF than JPG?', 'Often 40 to 50 percent at a similar look, though it depends on the photo.'],
      ['Should I use AVIF or WebP on my website?', 'AVIF is usually smaller; WebP is faster to make and supported a little more widely. Many sites serve AVIF with a WebP or JPG fallback.'],
    ],
  },

  'png>avif': {
    why: 'AVIF keeps transparency like PNG but makes far smaller files. Converting large PNG images, illustrations and screenshots to AVIF is one of the best ways to make an image-heavy page lighter.',
    keep: 'Keep the PNG as your editable master copy and for software that cannot open AVIF.',
    tips: [
      'For screenshots and graphics with text use Quality 80 or more so letters stay sharp.',
      'For photos saved as PNG, Quality 60 to 70 is usually enough.',
      'Transparent backgrounds are kept.',
    ],
    problems: [
      ['Small text looks soft.', 'Raise Quality, or keep text-heavy images as PNG or WebP.'],
      ['Converting takes a while.', 'AVIF encoding is slower than other formats, especially for large images. Resize first to speed it up.'],
    ],
    faq: [
      ['Does PNG to AVIF keep transparency?', 'Yes. AVIF has a full alpha channel, so transparent and semi-transparent pixels are kept.'],
      ['Is AVIF lossless?', 'This converter makes lossy AVIF at the Quality you choose, which is what gives the big size savings.'],
    ],
  },

  'webp>avif': {
    why: 'If your site already uses WebP, AVIF can shrink images further, often by another 20 to 30 percent. That matters for large photo galleries and product pages.',
    keep: 'Keep the WebP as a fallback for browsers and apps that cannot show AVIF, and as a copy that is quick to convert again.',
    tips: [
      'Quality 60 to 70 usually matches the look of a WebP at 75 to 80.',
      'Transparency is kept.',
      'Converting from the original JPG or PNG gives slightly better results than converting from WebP, if you still have it.',
    ],
    problems: [
      ['My animated WebP became a still image.', 'Only the first frame of an animated WebP is converted.'],
      ['The AVIF is not smaller.', 'WebP files that are already heavily compressed have little left to save. Keep the WebP in that case.'],
    ],
    faq: [
      ['Do all browsers support AVIF?', 'Current versions of Chrome, Edge, Firefox and Safari do. Some older browsers and apps do not.'],
      ['Will converting WebP to AVIF lose quality?', 'Each lossy conversion loses a little detail. At sensible settings the difference is hard to see.'],
    ],
  },

  'tiff>pdf': {
    why: 'Scanners and fax software often save pages as TIFF, but most people and portals expect PDF. Converting TIFF to PDF gives a file that opens on any phone or computer and can be emailed or uploaded straight away.',
    keep: 'Keep the TIFF if you need the scan for professional editing or archiving at full quality.',
    tips: [
      ONE_PAGE,
      'Each TIFF file becomes its own PDF.',
      'Large scans make large PDFs. If a size limit applies, convert TIFF to JPG first and then JPG to PDF.',
    ],
    problems: [
      ['Only the first page of my multi-page TIFF is in the PDF.', 'Multi-page TIFF files are converted one page at a time: the first page is used. Save each page as its own TIFF, or scan straight to PDF.'],
      ['The PDF is too big.', 'Convert the TIFF to JPG with Resize set to Max 1920px, then JPG to PDF.'],
    ],
    faq: [
      ['Is the text in the PDF searchable?', 'No. A scan is a picture of the page; selecting text needs OCR (text recognition) software.'],
      ['Does TIFF to PDF lose quality?', 'No visible quality is lost: the image is stored in the PDF without lossy compression.'],
    ],
  },

  'tiff>png': {
    why: 'TIFF is common for scans and professional photos, but browsers and many apps do not show it. PNG keeps the image lossless and opens everywhere, so it is the natural choice for sharing a TIFF without losing detail.',
    keep: 'Keep the TIFF for print workflows and archives, especially if it has layers or extra colour depth.',
    tips: [
      'Set Quality to 100 for a lossless, full-colour PNG.',
      'Use Resize to make a lighter copy for the web.',
      'Transparency is kept if the TIFF has it.',
    ],
    problems: [
      ['Only one page came out.', 'For multi-page TIFF files the first page is converted.'],
      ['The PNG is very large.', 'Lossless PNG of a big scan is large. Use TIFF to JPG for photos, or lower Quality to reduce colours.'],
    ],
    faq: [
      ['Is PNG lossless like TIFF?', 'Yes, at Quality 100 the PNG stores every pixel exactly.'],
      ['Why will my browser not show TIFF?', 'Most browsers do not support TIFF at all. PNG, JPG and WebP are the web formats.'],
    ],
  },

  'bmp>png': {
    why: 'BMP files from Paint and older Windows programs are usually uncompressed and huge. PNG is lossless too, but compressed, so the same picture often becomes many times smaller and works on every website and app.',
    keep: 'There is rarely a reason to keep BMP, except for old software that only reads BMP.',
    tips: [
      'Quality 100 gives a lossless PNG that looks exactly like the BMP.',
      'Screenshots and drawings shrink the most.',
      'Convert many BMP files at once and download them as a ZIP.',
    ],
    problems: [
      ['The file will not convert.', 'Some rare BMP variants from very old programs cannot be read. Open it in Paint and save it again as BMP or PNG.'],
      ['The PNG is still large.', 'Photos compress less than drawings. Use BMP to JPG for photographs.'],
    ],
    faq: [
      ['Does BMP to PNG lose quality?', 'Not at Quality 100: PNG is lossless.'],
      ['How much smaller will the PNG be?', 'Often 3 to 10 times smaller, depending on the image.'],
    ],
  },

  'ico>png': {
    why: 'ICO files hold Windows icons and favicons, but you cannot easily edit or reuse them. Converting ICO to PNG gives you a normal picture of the icon to edit, put on a website or use in a design.',
    keep: 'Keep the ICO if it is used as a favicon or program icon; browsers and Windows expect that format.',
    tips: [
      'An ICO usually holds several sizes; the largest one is converted, for the sharpest result.',
      'Transparent backgrounds are kept.',
      'Quality 100 gives a lossless PNG.',
    ],
    problems: [
      ['The PNG is small.', 'The icon is converted at its largest stored size. Many old icons only go up to 32 or 48 pixels, and enlarging them makes them blurry.'],
      ['The file will not convert.', 'The file may not be a real ICO, or may be damaged. Check that it opens as an icon on your computer.'],
    ],
    faq: [
      ['Can I get every size from the ICO?', 'Not here: the largest size is converted, which is the one you normally want.'],
      ['How do I make an ICO from a PNG?', 'Use PNG to ICO, which builds all standard icon sizes from your picture.'],
    ],
  },

  'svg>jpg': {
    why: 'SVG drawings and logos are perfect for websites, but many social sites, documents and print shops need a normal picture. Converting SVG to JPG gives you a flat image that opens anywhere.',
    keep: 'Keep the SVG as your master copy: it scales to any size without losing sharpness, while a JPG has fixed pixels.',
    tips: [
      'The SVG is drawn at the width and height written inside the file.',
      'Transparent areas become white, because JPG has no transparency.',
      'Use Quality 90 or more for logos and text, so edges stay crisp.',
    ],
    problems: [
      ['The JPG is too small.', 'The image is drawn at the size declared in the SVG. Open the SVG in a text editor or design program, increase its width and height, then convert again.'],
      ['Fonts look different.', 'If the SVG uses a font that is not embedded, a similar font is used. Convert text to outlines in your design program before exporting the SVG.'],
    ],
    faq: [
      ['Should I use JPG or PNG for an SVG logo?', 'PNG usually: it keeps transparency and sharp edges. JPG is best when a site specifically asks for it.'],
      ['Why is the background white?', 'JPG cannot store transparency, so transparent areas are filled with white. Use SVG to PNG to keep them transparent.'],
    ],
  },

  'webp>pdf': {
    why: 'Pictures saved from websites are often WebP, but forms and offices want PDF. Converting the WebP to PDF gives you a document that opens on every device and can be printed or attached easily.',
    keep: 'Keep the WebP if you only need the picture, for example to post it online, where a PDF would be awkward to view.',
    tips: [
      ONE_PAGE,
      'Each WebP becomes its own PDF.',
      'If the PDF must be small, convert WebP to JPG first and then JPG to PDF.',
    ],
    problems: [
      ['The PDF is bigger than the WebP.', 'The picture is stored in the PDF without lossy compression. Go through JPG for a smaller file.'],
      ['Only one frame of an animation is in the PDF.', 'PDF pages are still images, so the first frame of an animated WebP is used.'],
    ],
    faq: [
      ['Can I print the PDF on A4 paper?', 'Yes. Choose Fit to page in the print dialog and the picture is scaled to the paper.'],
      ['Is the text in the picture searchable?', 'No. The PDF contains the image; making its text searchable needs OCR software.'],
    ],
  },

  'psd>jpg': {
    why: 'PSD is the Photoshop file format, which most people and apps cannot open. Converting PSD to JPG lets you send a design to a client, post it online or preview it without Photoshop.',
    keep: 'Always keep the PSD: it holds the layers, text and effects you need to change the design later.',
    tips: [
      'Layers are flattened into one picture, just as the design looks in Photoshop.',
      'Transparent areas become white in the JPG.',
      'Quality 85 to 90 is a good choice for designs with text.',
    ],
    problems: [
      ['The JPG looks blank or different from Photoshop.', 'The converter uses the combined preview that Photoshop stores in the file. Save the PSD with Maximize Compatibility turned on, then convert again.'],
      ['The file will not convert.', 'Very large or damaged PSD files, and PSB (large document) files, may not be readable.'],
    ],
    faq: [
      ['Do I need Photoshop to convert PSD to JPG?', 'No. Upload the PSD here and download the JPG.'],
      ['Are my layers kept?', 'No. JPG is a flat image format, so all visible layers are merged. Keep the PSD for editing.'],
    ],
  },

  'psd>png': {
    why: 'PNG keeps transparency, so it is the best way to take a logo, cut-out or web graphic out of a Photoshop file and use it anywhere, without needing Photoshop.',
    keep: 'Keep the PSD for any future editing: the PNG is a flat copy, without the layers, text and effects of the design.',
    tips: [
      'Transparent areas of the design stay transparent.',
      'Layers are flattened into one image, as it looks in Photoshop.',
      'Quality 100 gives a lossless PNG for print or further editing.',
    ],
    problems: [
      ['The PNG does not match what I see in Photoshop.', 'Save the PSD with Maximize Compatibility turned on, so the full preview is stored in the file, then convert again.'],
      ['The PNG is large.', 'Use Resize, or lower Quality to reduce the number of colours.'],
    ],
    faq: [
      ['Does PSD to PNG keep transparency?', 'Yes. Transparent pixels stay transparent in the PNG.'],
      ['Can I export a single layer?', 'Not here: the whole visible design is flattened into one image.'],
    ],
  },

  'eps>png': {
    why: 'EPS files are common for logos and print artwork, but they need professional software to open. Converting EPS to PNG gives you a normal image with a transparent background that works on websites, in documents and in presentations.',
    keep: 'Keep the EPS for printing and for resizing: it is vector artwork that stays sharp at any size.',
    tips: [
      'The artwork is drawn at 150 dpi with a transparent background.',
      'Only the first page of a multi-page file is converted.',
      'For a bigger PNG, ask the designer for a larger EPS or an SVG version.',
    ],
    problems: [
      ['The file will not convert.', 'Some EPS files contain only a low-resolution preview or are damaged. Ask for a fresh export from the original design program.'],
      ['Fonts look wrong.', 'Text that was not converted to outlines in the original file may be drawn with a substitute font.'],
    ],
    faq: [
      ['Does EPS to PNG keep transparency?', 'Yes. Areas with no artwork are transparent in the PNG.'],
      ['Can I open EPS files without Illustrator?', 'Converting to PNG is the easiest way to view one. For editing, vector programs such as Inkscape can open EPS.'],
    ],
  },

  // --------------------------------------------------------------- documents --
  'docx>txt': {
    why: 'Plain text opens in every program on every device and is the safest format for pasting into websites, forms, code editors and older systems. Converting DOCX to TXT strips the formatting and gives you just the words.',
    keep: 'Keep the DOCX for anything that needs formatting, images, tables or page layout; plain text cannot store any of them.',
    tips: [
      'The text is saved in UTF-8, so accents and non-Latin scripts are kept.',
      'Paragraph breaks are kept; bold, fonts, colours and images are removed.',
      'Tables become plain lines of text.',
    ],
    problems: [
      ['Strange characters appear in Notepad.', 'Very old editors may not detect UTF-8. Open the file in a current text editor, or choose UTF-8 when opening it.'],
      ['Text from text boxes or headers is missing.', 'Content in floating text boxes and page headers is not always part of the main text. Copy it into the body of the document before converting.'],
    ],
    faq: [
      ['Does Word to TXT keep images?', 'No. Plain text cannot hold images or formatting, only the words.'],
      ['Can I convert TXT back to Word?', 'You can open a TXT in Word and save it as DOCX, but the original formatting cannot be restored.'],
    ],
  },

  'odt>docx': {
    why: 'ODT is the format of LibreOffice and OpenOffice. Most offices, schools and employers use Microsoft Word, so converting ODT to DOCX lets them open and edit your document without problems.',
    keep: 'Keep the ODT if you keep working in LibreOffice: it is that program\'s own format and opens perfectly there.',
    tips: [
      'Headings, lists, tables and images are converted to their Word versions.',
      'Check documents that use special fonts; if the font is not installed on the other computer, Word shows a substitute.',
      'Track changes and comments are carried over in most documents.',
    ],
    problems: [
      ['The layout moved slightly.', 'LibreOffice and Word calculate line and page breaks a little differently. Small spacing changes are normal; check page breaks before printing.'],
      ['The file will not convert.', 'Password-protected ODT files cannot be opened. Remove the password in LibreOffice first.'],
    ],
    faq: [
      ['Can Word open ODT files directly?', 'Recent versions of Word can, but layout and some features may not come through well. DOCX is the safer format to send.'],
      ['Is ODT to DOCX free?', 'Yes, with no sign-up or watermark.'],
    ],
  },

  'odt>pdf': {
    why: 'PDF looks the same on every device and is what most job sites, schools and offices ask for. Converting your ODT to PDF makes sure the reader sees exactly the layout you made in LibreOffice.',
    keep: 'Keep the ODT to make further changes later: editing a PDF is much harder than editing the original document.',
    tips: [
      'Fonts are embedded in the PDF, so it looks the same everywhere.',
      'Links and the table of contents are kept as clickable links.',
      'Images keep good quality for printing.',
    ],
    problems: [
      ['A font looks different.', 'If your document uses a font that is not available on our server, a similar one is used. Use common fonts, or export to PDF from LibreOffice itself for unusual fonts.'],
      ['The file will not convert.', 'Password-protected documents cannot be opened. Remove the password first.'],
    ],
    faq: [
      ['Can I convert an ODT to PDF without LibreOffice?', 'Yes. Upload it here; no software is needed on your computer or phone.'],
      ['Is the PDF text searchable?', 'Yes. The text stays real text, so it can be searched and copied.'],
    ],
  },

  'rtf>pdf': {
    why: 'RTF is a simple document format that WordPad, TextEdit and old programs create. PDF is better for sending and printing, because it looks the same everywhere and cannot be edited by accident.',
    keep: 'Keep the RTF if you need to edit the text again; the PDF is the version to send, print or upload to a portal.',
    tips: [
      'Bold, italics, fonts, colours and simple tables are kept.',
      'The PDF uses the page size set in the RTF, usually A4 or Letter.',
      'Text in the PDF stays searchable.',
    ],
    problems: [
      ['A font is replaced.', 'Fonts that are not available on our server are replaced with similar ones.'],
      ['Images are missing.', 'Some programs store images in RTF in old formats that cannot be read. Insert the images again as PNG or JPG in your editor.'],
    ],
    faq: [
      ['What is an RTF file?', 'Rich Text Format, a simple document format that almost every word processor can open and save.'],
      ['Can I convert RTF to Word instead?', 'Yes, use RTF to DOCX for an editable Word document.'],
    ],
  },

  'rtf>docx': {
    why: 'RTF files are basic and miss many features of modern Word documents. Converting RTF to DOCX gives you a current Word file that you can edit with all of Word\'s tools and share with anyone.',
    keep: 'Keep the RTF only if an old program needs it; DOCX is the better format for almost everything else.',
    tips: [
      'Text formatting, lists and simple tables are kept.',
      'The DOCX opens in Word, Google Docs, LibreOffice and Pages.',
      'Convert many RTF files at once and download them as a ZIP.',
    ],
    problems: [
      ['Spacing looks different.', 'RTF and DOCX handle spacing slightly differently. Adjust it in Word if needed.'],
      ['The file will not open.', 'If the RTF is damaged, open it in WordPad or TextEdit and save it again.'],
    ],
    faq: [
      ['Does RTF to DOCX lose anything?', 'Normally nothing that RTF can store. Very old embedded objects may not come through.'],
      ['Is DOCX bigger than RTF?', 'Usually smaller: DOCX is compressed, while RTF stores everything as text.'],
    ],
  },

  'txt>pdf': {
    why: 'A PDF is easier to share, print and archive than a plain text file, and it opens the same way on every phone and computer. Converting TXT to PDF is handy for notes, logs, lyrics and simple letters.',
    keep: 'Keep the TXT if you will edit the text again or use it in another program, since plain text is easier to reuse.',
    tips: [
      'The text is placed on standard pages with normal margins.',
      'Long lines wrap to fit the page.',
      'UTF-8 text with accents and non-Latin scripts is supported.',
    ],
    problems: [
      ['Characters show as boxes.', 'The text uses a script that the default font does not include. Copy the text into a word processor with a suitable font and save it as PDF from there.'],
      ['Columns that lined up no longer do.', 'Text aligned with spaces only lines up in a fixed-width font. Use a word processor with a font such as Courier for tables.'],
    ],
    faq: [
      ['Can I change the font of the PDF?', 'Not here: a standard font is used. For a custom look, open the text in a word processor and export to PDF.'],
      ['Is the PDF text searchable?', 'Yes. The text stays real text.'],
    ],
  },

  'html>pdf': {
    why: 'Saving an HTML file as PDF gives you a fixed copy that is easy to print, archive or send, for example a saved web page, an email template or a report exported as HTML.',
    keep: 'Keep the HTML if it will be shown in a browser or edited further; the PDF is a fixed snapshot for printing and sharing.',
    tips: [
      'Text, headings, lists, links and tables are kept.',
      'Only the HTML file itself is uploaded, so images and stylesheets it links to are not included unless they are embedded in the file.',
      'To save a live web page as PDF, your browser\'s Print, Save as PDF option is often the easiest.',
    ],
    problems: [
      ['Images are missing.', 'Linked images are separate files that were not uploaded. Embed the images in the HTML, or print the page to PDF from your browser.'],
      ['The design looks plain.', 'External CSS files are not available to the converter. Put the styles inside the HTML file.'],
    ],
    faq: [
      ['Can I convert a website URL to PDF?', 'Not here: upload a saved HTML file. For a live page, use your browser\'s Print to PDF.'],
      ['Are links clickable in the PDF?', 'Yes, links stay clickable.'],
    ],
  },

  'pdf>html': {
    why: 'Turning a PDF into HTML puts its text into a web page that can be read in any browser, copied, searched and reused on a website, without a PDF reader.',
    keep: 'Keep the PDF for printing and for sharing the exact original layout, which a web page does not try to copy.',
    tips: [
      'The text of every page goes into one HTML file, in reading order.',
      'Images are not included: the converter extracts the text.',
      'Works best with PDFs made from documents, where you can select the text.',
    ],
    problems: [
      ['The HTML is empty.', 'The PDF is a scan: its pages are pictures without real text. This needs OCR (text recognition) software.'],
      ['The layout differs from the PDF.', 'HTML flows text instead of fixing every position, so columns and spacing change.'],
    ],
    faq: [
      ['Does PDF to HTML keep images?', 'No. Only the text is converted. Use PDF to PNG or PDF to JPG to get the pages as images.'],
      ['Can I open the HTML in Word?', 'Yes. Word and Google Docs can open HTML files, which is a quick way to edit the text.'],
    ],
  },

  'pptx>jpg': {
    why: 'Slides as images are easy to post on social media, send in a chat, add to a website or use as thumbnails, and nobody needs PowerPoint to see them. Converting PPTX to JPG gives you one picture per slide.',
    keep: 'Keep the PPTX to present, edit or animate the slides; the JPG images are flat pictures that cannot be changed.',
    tips: [
      'Each slide becomes its own JPG; decks with several slides come as a ZIP.',
      'Animations and transitions are not part of a still image; each slide is shown in its final state.',
      'Images are sized for screens, which suits social posts and websites.',
    ],
    problems: [
      ['A font looks different.', 'If the presentation uses a font that is not on our server, a similar font is used. Embed the fonts in PowerPoint (File, Options, Save) before converting.'],
      ['Videos in the slides are missing.', 'Videos cannot be shown in a picture; only the slide content is drawn.'],
    ],
    faq: [
      ['Can I get the slides as PNG?', 'Yes, choose PNG as the output format for lossless slide images.'],
      ['Does it work with Google Slides?', 'Yes. Download your Google Slides presentation as PPTX first, then convert it here.'],
    ],
  },

  'ppt>pdf': {
    why: 'PPT is the old PowerPoint format from before 2007. A PDF of the slides opens on every device, keeps the look fixed and is the usual way to share handouts or send a presentation to someone who does not have PowerPoint.',
    keep: 'Keep the PPT, or convert it to PPTX, if you want to edit or present the slides with animations and speaker notes.',
    tips: [
      'Each slide becomes one page of the PDF.',
      'Text in the PDF stays selectable and searchable.',
      'Animations are not included; slides are shown in their final state.',
    ],
    problems: [
      ['A font looks different.', 'Fonts that are not on our server are replaced with similar ones.'],
      ['The file will not convert.', 'Password-protected presentations cannot be opened. Remove the password in PowerPoint first.'],
    ],
    faq: [
      ['What is the difference between PPT and PPTX?', 'PPT is the older binary format used by PowerPoint 97 to 2003; PPTX is the newer, smaller format used since 2007.'],
      ['Are speaker notes included?', 'No. The PDF shows the slides only.'],
    ],
  },

  'xls>xlsx': {
    why: 'XLS is the old Excel format from before 2007. It is limited to 65,536 rows and some programs warn about it. Converting to XLSX gives you a current Excel file that is smaller and works with all new features.',
    keep: 'Keep the XLS only for very old software that cannot open XLSX; for everything else the XLSX replaces it.',
    tips: [
      'All sheets, formulas and cell formatting are converted.',
      'Charts are kept in most workbooks.',
      'Macros are not kept, because XLSX cannot hold them.',
    ],
    problems: [
      ['My macros are gone.', 'XLSX files cannot store macros. Open the XLS in Excel and save it as XLSM if you need them.'],
      ['The file will not convert.', 'Password-protected workbooks cannot be opened. Remove the password in Excel first.'],
    ],
    faq: [
      ['Is XLSX better than XLS?', 'Yes, for almost everything: it is smaller, allows over a million rows and is the default in all current spreadsheet programs.'],
      ['Will formulas still work?', 'Yes. Formulas are converted and recalculate as usual.'],
    ],
  },

  'xls>pdf': {
    why: 'A PDF of a spreadsheet shows the figures exactly as laid out and cannot be changed by accident, which is ideal for sending invoices, price lists, timetables and reports from an old Excel XLS file.',
    keep: 'Keep the XLS, or convert it to XLSX, to keep working with the formulas and data; the PDF only shows the values.',
    tips: [
      'Every sheet in the workbook is included in the PDF.',
      'Set the print area and page orientation in Excel before converting for the neatest pages.',
      'Wide sheets are split across pages, the same way they would print.',
    ],
    problems: [
      ['Columns are cut onto several pages.', 'The sheet is wider than the page. In Excel, set the page to landscape and Fit to one page wide, save, and convert again.'],
      ['Empty pages appear.', 'Cells far away from the data may contain formatting. Clear unused rows and columns, or set a print area.'],
    ],
    faq: [
      ['Can I convert only one sheet?', 'All sheets are converted. Delete or hide the sheets you do not need before converting.'],
      ['Are formulas visible in the PDF?', 'No. The PDF shows the calculated values.'],
    ],
  },

  'xlsx>xls': {
    why: 'Some older accounting programs, company systems and Excel 2003 can only open the old XLS format. Converting XLSX to XLS makes your spreadsheet readable in those programs.',
    keep: 'Keep the XLSX as your main file: it supports more rows, columns and functions than the old XLS format can.',
    tips: [
      'XLS holds at most 65,536 rows and 256 columns; data beyond that is cut off.',
      'All sheets and normal formulas are converted.',
      'Newer Excel functions may not exist in XLS and can show an error in old Excel.',
    ],
    problems: [
      ['Some rows are missing.', 'XLS cannot store more than 65,536 rows. Split large sheets before converting.'],
      ['A formula shows an error in the old program.', 'The function was added in a newer Excel version. Replace it with an older equivalent.'],
    ],
    faq: [
      ['Why would I need XLS today?', 'Only for old software or systems that cannot read XLSX. For everything else XLSX is better.'],
      ['Is conditional formatting kept?', 'Basic formatting is kept; newer styles may be simplified.'],
    ],
  },

  'docx>doc': {
    why: 'Word 2003 and some older systems only open the DOC format. Converting DOCX to DOC lets people with old software open your document.',
    keep: 'Keep the DOCX as your main copy: it is smaller and supports all current Word features.',
    tips: [
      'Text, styles, tables and images are kept.',
      'Newer features such as some charts and effects are simplified for the old format.',
      'The DOC opens in every version of Word.',
    ],
    problems: [
      ['The DOC is bigger than the DOCX.', 'That is normal: DOC is not compressed.'],
      ['A modern feature changed.', 'Features added after Word 2003 cannot be stored in DOC and are converted to the closest equivalent.'],
    ],
    faq: [
      ['Should I send DOC or DOCX?', 'DOCX, unless the person has Word 2003 or older, or a system that asks for DOC.'],
      ['Is DOCX to DOC free?', 'Yes, free and without sign-up.'],
    ],
  },

  'md>pdf': {
    why: 'Markdown is great for writing, but people who receive a README, notes or documentation usually want a PDF they can open, print and read with formatting. Converting Markdown to PDF turns headings, lists, links and code into a clean document.',
    keep: 'Keep the Markdown file as the source you edit; regenerate the PDF when it changes.',
    tips: [
      'Headings, bold, italics, lists, links, tables and code blocks are formatted.',
      'Images referenced by a web address may not load; local image files are not uploaded with the Markdown.',
      'The PDF has standard page size and margins.',
    ],
    problems: [
      ['Images are missing.', 'Only the Markdown file is uploaded, so local images it refers to are not available. Use full web addresses for images, or add them in a word processor afterwards.'],
      ['Math or diagrams are not rendered.', 'Special extensions such as math formulas or Mermaid diagrams are shown as plain text.'],
    ],
    faq: [
      ['Which Markdown flavour is supported?', 'Standard Markdown with common extensions such as tables and fenced code blocks, like most README files use.'],
      ['Can I get a Word file instead?', 'Yes, use Markdown to DOCX for an editable document.'],
    ],
  },

  'md>docx': {
    why: 'Editors, teachers and colleagues often want a Word file. Converting Markdown to DOCX turns your plain-text notes, drafts or documentation into a properly formatted Word document they can edit and comment on.',
    keep: 'Keep the Markdown if you write in a text editor or keep documents in Git, and convert again whenever it changes.',
    tips: [
      'Markdown headings become real Word heading styles, so the navigation pane and table of contents work.',
      'Lists, links, tables and code blocks are converted.',
      'Change the look in Word by editing the heading styles.',
    ],
    problems: [
      ['Images are missing.', 'Local image files are not uploaded with the Markdown. Insert them in Word after converting.'],
      ['Code blocks have plain formatting.', 'Code is set in a fixed-width style without colour highlighting.'],
    ],
    faq: [
      ['Can I convert DOCX back to Markdown?', 'Yes, choose DOCX as input and Markdown as output on the Word converter page.'],
      ['Does it work with README.md files?', 'Yes. README files are standard Markdown.'],
    ],
  },

  'pdf>tiff': {
    why: 'Some document management systems, fax services and print workflows require TIFF images. Converting PDF to TIFF turns each page into an image those systems accept.',
    keep: 'Keep the PDF: it is smaller, its text is searchable and it is better for everyday sharing than page images.',
    tips: [
      'Each page becomes its own TIFF at 150 dpi; several pages come as a ZIP.',
      'Text becomes part of the image and can no longer be selected.',
      'Password-protected PDFs must be unlocked first.',
    ],
    problems: [
      ['I need one multi-page TIFF.', 'Pages are saved as separate TIFF files. Many fax and imaging tools can combine them.'],
      ['The PDF will not convert.', 'If it asks for a password when opening, remove the password and try again.'],
    ],
    faq: [
      ['What resolution are the TIFF pages?', '150 dots per inch, which is sharp on screen and fine for normal printing.'],
      ['Why use TIFF instead of PNG?', 'Only when a system requires TIFF. For everything else PNG or JPG are easier to use.'],
    ],
  },

  // ------------------------------------------------------------------ ebooks --
  'docx>epub': {
    why: 'EPUB is the standard ebook format for Apple Books, Kobo, Google Play Books and Kindle (through Send to Kindle). Converting a Word manuscript to EPUB lets readers change font size and read comfortably on phones and e-readers.',
    keep: 'Keep the DOCX as your manuscript: make changes there and convert again, rather than editing the EPUB itself.',
    tips: [
      'Use Word heading styles for chapter titles; they become the table of contents.',
      'Images in the document are included in the book.',
      'Keep layout simple: text boxes and complex tables do not flow well on small screens.',
    ],
    problems: [
      ['There is no table of contents.', 'Chapters must use Heading 1 or Heading 2 styles in Word, not just large bold text.'],
      ['Page breaks look odd.', 'Ebooks reflow text, so fixed page breaks disappear. Start each chapter with a heading instead.'],
    ],
    faq: [
      ['Can I put the EPUB on my Kindle?', 'Yes. Current Kindles accept EPUB through Amazon\'s Send to Kindle, which converts it for you.'],
      ['Is the EPUB ready to publish?', 'It is a valid ebook you can read and share. Stores may have extra requirements such as a cover image and metadata.'],
    ],
  },

  'pdf>epub': {
    why: 'PDFs have fixed pages that are hard to read on a phone or e-reader. EPUB reflows the text to fit any screen and lets you change the font size, so converting PDF to EPUB makes books and long documents much more comfortable to read.',
    keep: 'Keep the PDF for printing and for documents where the exact layout matters, such as forms or magazines.',
    tips: [
      'Works best with text-based PDFs such as novels and reports.',
      'Headers, footers and page numbers may appear inside the text, because PDFs mark them as normal text.',
      DRM,
    ],
    problems: [
      ['The EPUB is empty or shows only images.', 'The PDF is a scan. Its pages are pictures, so there is no text to reflow.'],
      ['Paragraphs are split in strange places.', 'PDFs store lines, not paragraphs. Simple novels convert well; complex layouts with columns need manual tidying.'],
    ],
    faq: [
      ['Will tables and diagrams look right?', 'Images are kept, but complex tables and multi-column pages may be simplified.'],
      ['Can I read the EPUB on Kindle?', 'Yes, send it with Amazon\'s Send to Kindle, which accepts EPUB.'],
    ],
  },

  'epub>docx': {
    why: 'Converting an EPUB to DOCX lets you edit the text of an ebook in Word, for example to fix your own book, prepare a print version or quote from a DRM-free text.',
    keep: 'Keep the EPUB for reading: it is the better format on phones and e-readers, where text reflows to fit the screen.',
    tips: [
      'Chapters, headings, paragraphs and images are kept.',
      'Check the result in Word and adjust styles before printing.',
      DRM,
    ],
    problems: [
      ['The file will not convert.', 'The book is probably DRM-protected. Only DRM-free EPUB files can be converted.'],
      ['Fonts and spacing differ.', 'Ebook styles do not match Word styles exactly. Adjust them in Word.'],
    ],
    faq: [
      ['Can I convert a book I bought on Kindle?', 'Not if it has DRM, which most store-bought ebooks have.'],
      ['Can I convert the DOCX back to EPUB?', 'Yes, with DOCX to EPUB.'],
    ],
  },

  'epub>azw3': {
    why: 'AZW3, also called KF8, is the modern Kindle format. Kindles cannot open EPUB files copied over USB, so converting EPUB to AZW3 lets you copy DRM-free books straight onto your Kindle with a cable and keep their formatting.',
    keep: 'Keep the EPUB: it works in every other reading app and is the format to send with Send to Kindle.',
    tips: [
      'Connect the Kindle to your computer and copy the AZW3 into its documents folder.',
      'Chapters, table of contents, images and formatting are kept.',
      DRM,
    ],
    problems: [
      ['The book does not appear on my Kindle.', 'Make sure the file is in the documents folder, then safely eject the Kindle so it can index the new book.'],
      ['The file will not convert.', 'The EPUB is probably DRM-protected. Only DRM-free books can be converted.'],
    ],
    faq: [
      ['AZW3 or MOBI for my Kindle?', 'AZW3 for any Kindle from the last ten years: it supports better layout. MOBI is only needed for very old models.'],
      ['Can I use Send to Kindle instead?', 'Yes. Send to Kindle accepts EPUB directly, so you only need AZW3 when copying books over USB.'],
    ],
  },

  'mobi>pdf': {
    why: 'MOBI is an old Kindle format that most other devices cannot open. A PDF opens on any computer or phone and can be printed, so converting MOBI to PDF makes the book readable everywhere.',
    keep: 'Keep the MOBI if you read the book on an older Kindle, which handles MOBI better than PDF pages.',
    tips: [
      'Text, chapters and images are kept.',
      'The PDF has fixed pages; on a phone, EPUB is often nicer to read.',
      DRM,
    ],
    problems: [
      ['The file will not convert.', 'MOBI files from the Kindle store are usually DRM-protected and cannot be converted.'],
      ['Text is small on my phone.', 'PDF pages do not reflow. Use MOBI to EPUB for a format that adapts to the screen.'],
    ],
    faq: [
      ['Can I print a MOBI book?', 'Convert it to PDF first, then print the PDF.'],
      ['Is MOBI still used?', 'Amazon has moved to newer formats and Send to Kindle no longer accepts MOBI, so converting old MOBI files to PDF or EPUB is a good idea.'],
    ],
  },

  'azw3>epub': {
    why: 'AZW3 is a Kindle format that Apple Books, Kobo and Google Play Books cannot read. EPUB is the open ebook standard, so converting AZW3 to EPUB lets you read your DRM-free books on any device or app.',
    keep: 'Keep the AZW3 if you read the book on a Kindle, which reads AZW3 natively but cannot open EPUB copied over USB.',
    tips: [
      'Chapters, table of contents, images and formatting are kept.',
      'The EPUB works in Apple Books, Google Play Books, Kobo and most reading apps.',
      DRM,
    ],
    problems: [
      ['The file will not convert.', 'Books bought from the Kindle store are DRM-protected and cannot be converted.'],
      ['The cover is missing.', 'Some AZW3 files keep the cover separately. Add a cover in your reading app or ebook manager.'],
    ],
    faq: [
      ['What is AZW3?', 'Also called KF8, it is the Kindle format that replaced MOBI and supports better formatting.'],
      ['Can I convert EPUB back to AZW3?', 'Yes, choose EPUB as input and AZW3 as output on the ebook converter page.'],
    ],
  },

  // ------------------------------------------------------------------- video --
  'mp4>webm': {
    why: 'WebM is an open video format made for the web. With VP9 video it often makes smaller files than MP4 at similar quality, which is useful for background videos and clips on websites.',
    keep: 'Keep the MP4 for phones, TVs, editing software and social media, which all prefer MP4.',
    tips: [
      'The video is encoded with VP9 and the sound with Opus.',
      'WebM encoding is slower than MP4, so long videos take a while.',
      'Every current browser plays WebM.',
    ],
    problems: [
      ['An iPhone or video editor will not play the WebM.', 'Support for WebM outside browsers is limited. Use MP4 for those.'],
      ['Conversion takes a long time.', 'VP9 encoding is demanding. Trim the video first, or keep it as MP4.'],
    ],
    faq: [
      ['Is WebM better than MP4?', 'For websites it can be smaller. For everything else MP4 works on more devices.'],
      ['Does MP4 to WebM keep the sound?', 'Yes. The audio is converted to Opus.'],
    ],
  },

  'mp4>avi': {
    why: 'Some older TVs, DVD players, car screens and editing programs only play AVI. Converting MP4 to AVI makes your video playable on those devices.',
    keep: 'Keep the MP4 for everything else: it is smaller and plays on modern phones, computers and websites.',
    tips: [
      'The video uses MPEG-4 Part 2 (the codec known from DivX and Xvid) and the sound uses MP3, which older players support.',
      'The AVI is usually larger than the MP4.',
      'Subtitles inside the MP4 are not carried over.',
    ],
    problems: [
      ['The player still will not play the AVI.', 'Some very old players need a smaller frame size. Check the player\'s manual for supported resolutions.'],
      ['The file is much bigger.', 'AVI uses older compression. That is normal; keep the MP4 where possible.'],
    ],
    faq: [
      ['Why would I convert MP4 to AVI?', 'Only for older devices or software that do not play MP4.'],
      ['Is the quality the same?', 'The video is re-encoded at high quality; on most screens it looks the same.'],
    ],
  },

  'mp4>mov': {
    why: 'MOV is Apple\'s QuickTime format. Some Mac apps, older versions of Final Cut and editing workflows ask for MOV files, so converting MP4 to MOV avoids import problems.',
    keep: 'Keep the MP4 for sharing online and on Android or Windows devices, where MP4 is the most widely supported format.',
    tips: [
      'The video uses H.264 and the sound uses AAC, which every Apple app supports.',
      'The quality and size stay close to the MP4.',
      'Subtitle tracks are not carried over.',
    ],
    problems: [
      ['My editor still will not import it.', 'Some professional editors prefer special codecs such as ProRes. Check the editor\'s requirements.'],
      ['The file is slightly different in size.', 'The video is re-encoded, so the size changes a little.'],
    ],
    faq: [
      ['Is MOV better quality than MP4?', 'No. Both are containers; with the same codec the quality is the same.'],
      ['Will the MOV play on Windows?', 'Yes, in most current players such as VLC and the Windows Media Player app.'],
    ],
  },

  'wmv>mp4': {
    why: 'WMV is an old Windows video format that phones, Macs, TVs and websites often cannot play. MP4 plays everywhere, so converting WMV to MP4 makes old home videos and recordings easy to watch and share.',
    keep: 'There is little reason to keep WMV once you have the MP4, unless very old Windows software needs it.',
    tips: [
      'The video is converted to H.264 and the sound to AAC, the most compatible combination.',
      'The MP4 is usually smaller than the WMV.',
      'The MP4 is prepared for fast start, so it begins playing online before it has fully loaded.',
    ],
    problems: [
      ['The file will not convert.', 'WMV files with DRM protection, such as old purchased movies, cannot be converted.'],
      ['The picture is blurry.', 'Old WMV files often have a low resolution. Converting cannot add detail that is not there.'],
    ],
    faq: [
      ['Can I play WMV on a Mac?', 'Not without extra software. Converting to MP4 is the easiest solution.'],
      ['Does WMV to MP4 lose quality?', 'The video is re-encoded at high quality, so you should not see a difference.'],
    ],
  },

  'flv>mp4': {
    why: 'FLV is the old Flash video format. Flash is gone, and most players and phones no longer open FLV. Converting FLV to MP4 rescues old downloads and recordings so they play anywhere.',
    keep: 'There is no reason to keep the FLV once you have the MP4: nothing plays FLV that cannot also play the MP4.',
    tips: [
      'The video becomes H.264 and the sound AAC, which every device plays.',
      'The MP4 is ready for uploading to YouTube, Facebook or your website.',
      'Old FLV videos are often small; the MP4 keeps the original resolution.',
    ],
    problems: [
      ['The file will not convert.', 'The download may be incomplete or damaged. Try to get the file again.'],
      ['The sound is out of sync.', 'Some FLV recordings have timing errors. The converter keeps the timing in the file, so the source needs fixing.'],
    ],
    faq: [
      ['Can I still play FLV files?', 'Players such as VLC can, but phones, TVs and browsers generally cannot.'],
      ['Is FLV to MP4 free?', 'Yes, free and without sign-up.'],
    ],
  },

  '3gp>mp4': {
    why: '3GP videos come from older mobile phones. Modern phones, computers and social networks play MP4 much more reliably, so converting 3GP to MP4 makes those old clips easy to watch, edit and share.',
    keep: 'There is no need to keep the 3GP once you have the MP4, which holds the same picture and plays on far more devices.',
    tips: [
      'The video becomes H.264 and the sound AAC.',
      'Old phone videos have low resolution; the MP4 keeps it, but cannot add detail.',
      'Convert many clips at once and download them as a ZIP.',
    ],
    problems: [
      ['The sound is missing.', 'Some old phones used the AMR sound format. If the converted file is silent, the audio track may be damaged or empty.'],
      ['The video is tiny.', 'Many 3GP videos are 176 or 320 pixels wide. That is the original resolution.'],
    ],
    faq: [
      ['What is a 3GP file?', 'A video format made for 3G-era mobile phones, with small files for slow networks.'],
      ['Can I upload 3GP to YouTube?', 'YouTube accepts 3GP, but MP4 is more reliable with all sites and apps.'],
    ],
  },

  'mp4>wav': {
    why: 'WAV is uncompressed audio that every audio editor and DJ program opens. Taking the sound from an MP4 as WAV gives you the best starting point for editing, transcribing or using the audio in a project.',
    keep: 'Keep the MP4 if you still need the video: the WAV holds only the sound, and the picture cannot be added back.',
    tips: [
      'The audio is saved as 16-bit PCM WAV, the standard CD-quality format.',
      'WAV files are large, about 10MB per minute of stereo sound.',
      'For a small file to listen to, use MP4 to MP3 instead.',
    ],
    problems: [
      ['The WAV is very large.', 'WAV is uncompressed. Use MP4 to MP3 for a much smaller file.'],
      ['It says there is no audio track.', 'The video has no sound, for example a screen recording made without audio.'],
    ],
    faq: [
      ['Does MP4 to WAV improve quality?', 'No. The sound keeps the quality it had in the MP4; WAV just stores it without further compression.'],
      ['Can I edit the WAV in Audacity?', 'Yes. WAV opens in every audio editor.'],
    ],
  },

  'mov>gif': {
    why: 'GIFs play automatically in chats, emails, documentation and forums without a play button. Converting a short MOV clip, such as an iPhone recording or screen capture, to GIF makes it easy to share as a moving picture.',
    keep: 'Keep the MOV for the full-quality video with sound; the GIF is a small, silent preview of a short part of it.',
    tips: [
      'The GIF is made at up to 480 pixels wide and 12 frames per second to keep the file small.',
      'Sound is removed: GIF has no audio.',
      'Short clips of 2 to 6 seconds make the best GIFs; trim the video first.',
    ],
    problems: [
      ['The GIF is very large.', 'GIF size grows with length. Trim the clip to the few seconds you need.'],
      ['Colours look grainy.', 'GIF is limited to 256 colours per frame. Simple screen recordings look better than colourful scenes.'],
    ],
    faq: [
      ['Can I make a GIF from an iPhone video?', 'Yes. iPhone videos are MOV files; upload them here and download the GIF.'],
      ['Does the GIF loop?', 'Yes, it loops forever.'],
    ],
  },

  'webm>gif': {
    why: 'WebM clips from screen recorders and websites do not play in many chat apps, emails and documents. A GIF plays everywhere automatically, so converting WebM to GIF is a quick way to share a short animation.',
    keep: 'Keep the WebM for the full-quality video with sound; the GIF is a small, silent preview of a short part of it.',
    tips: [
      'The GIF is made at up to 480 pixels wide and 12 frames per second.',
      'Sound is removed, because GIF has no audio.',
      'Keep clips short for small files.',
    ],
    problems: [
      ['The GIF is too big to upload.', 'Shorten the clip; every second adds to the size.'],
      ['Motion looks choppy.', '12 frames per second keeps files small. Fast motion can look less smooth than in the video.'],
    ],
    faq: [
      ['Does the GIF keep transparency from the WebM?', 'No. The frames are converted with a solid background.'],
      ['Is there a length limit?', 'Only the file size limit of the uploader, but short clips make much better GIFs.'],
    ],
  },

  'mkv>mp3': {
    why: 'MKV files often hold films, concerts or lectures. Extracting the sound as MP3 lets you listen on any phone, car stereo or music player without the video.',
    keep: 'Keep the MKV if you want to watch the video: the MP3 holds only the sound of one audio track.',
    tips: [
      'The audio is encoded as high-quality variable bitrate MP3, around 190 kbps.',
      'If the MKV has several audio tracks, such as different languages, one is picked automatically, usually the one with the most channels.',
      'The MP3 is much smaller than the video.',
    ],
    problems: [
      ['The wrong language came out.', 'Only one audio track is converted. Remove the tracks you do not need with an MKV tool such as MKVToolNix, then convert again.'],
      ['It says there is no audio track.', 'The file has no sound, or the sound could not be read.'],
    ],
    faq: [
      ['Is the MP3 good quality?', 'Yes. The variable bitrate setting used here is regarded as transparent for most listeners.'],
      ['Can I get lossless audio instead?', 'Choose FLAC or WAV as the output format for lossless sound.'],
    ],
  },

  'mov>mp3': {
    why: 'MOV videos from iPhones and cameras often contain speech, music or interviews you want to listen to without the picture. Converting MOV to MP3 gives a small audio file that plays everywhere.',
    keep: 'Keep the MOV if you need the video: the MP3 holds only the sound, and the picture cannot be added back.',
    tips: [
      'The audio is encoded as high-quality variable bitrate MP3.',
      'iPhone videos work directly.',
      'Use MOV to WAV if you plan to edit the sound.',
    ],
    problems: [
      ['It says there is no audio track.', 'The video was recorded without sound.'],
      ['The MP3 is quiet.', 'The converter keeps the original volume. Raise it in an audio editor if needed.'],
    ],
    faq: [
      ['Can I convert an iPhone video to MP3?', 'Yes. iPhone videos are MOV files, which work here directly.'],
      ['How big will the MP3 be?', 'Roughly 1 to 1.5MB per minute.'],
    ],
  },

  'webm>mp3': {
    why: 'WebM files often come from browser recordings and online videos. Extracting the audio as MP3 gives you a file that plays in every music app, car stereo and phone.',
    keep: 'Keep the WebM if you need the video: the MP3 holds only the sound, and the picture cannot be added back.',
    tips: [
      'The audio is encoded as high-quality variable bitrate MP3.',
      'Audio-only WebM recordings also work.',
      'Convert several files at once and download a ZIP.',
    ],
    problems: [
      ['It says there is no audio track.', 'The WebM contains only video.'],
      ['The MP3 sounds slightly different.', 'WebM audio is usually Opus; converting to MP3 re-encodes it. At this quality the difference is very hard to hear.'],
    ],
    faq: [
      ['Is WebM to MP3 free?', 'Yes, free with no sign-up.'],
      ['Can I convert WebM audio to WAV?', 'Yes, choose WAV as the output for an uncompressed file.'],
    ],
  },

  'mp4>m4a': {
    why: 'M4A is the audio format of iPhones, iTunes and Apple Music. Extracting the sound of an MP4 as M4A gives you a small, good-quality file that works well on Apple devices and as a ringtone source.',
    keep: 'Keep the MP4 if you still need the video: the M4A holds only the sound, and the picture cannot be added back.',
    tips: [
      'The audio is encoded as AAC at 192 kbps.',
      'M4A files are usually smaller than MP3 at similar quality.',
      'Use MP4 to MP3 if the file must play on very old players.',
    ],
    problems: [
      ['It says there is no audio track.', 'The video has no sound.'],
      ['An old player will not play the M4A.', 'Some very old devices only play MP3. Use MP4 to MP3 for those.'],
    ],
    faq: [
      ['What is the difference between M4A and MP3?', 'Both are compressed audio. M4A uses AAC, which sounds a little better than MP3 at the same size.'],
      ['Can I make an iPhone ringtone from it?', 'Ringtones use the M4R format, which is AAC like M4A. Rename the file to .m4r and shorten it to 30 seconds in an editor.'],
    ],
  },

  // ------------------------------------------------------------------- audio --
  'mp3>wav': {
    why: 'Audio editors, DJ software, video editors and some hardware players work best with WAV. Converting MP3 to WAV gives you an uncompressed file that any program can open and edit without decoding.',
    keep: 'Keep the MP3 for listening and storing: it is about ten times smaller than the WAV and sounds exactly the same.',
    tips: [
      'The WAV is 16-bit PCM, the standard CD-quality format.',
      'Expect around 10MB per minute of stereo audio.',
      'Converting does not improve sound quality; it only removes the compression step for editing.',
    ],
    problems: [
      ['The WAV is huge.', 'WAV is uncompressed. That is normal.'],
      ['The sound is not better than the MP3.', 'Detail removed when the MP3 was made cannot be restored.'],
    ],
    faq: [
      ['Does MP3 to WAV improve quality?', 'No. The sound stays exactly as good as the MP3, stored in a bigger, uncompressed file.'],
      ['Why do editors prefer WAV?', 'WAV needs no decoding and has no encoder delay, so cuts and loops are sample-accurate.'],
    ],
  },

  'mp3>m4a': {
    why: 'M4A is the native audio format of Apple devices and iTunes. Converting MP3 to M4A can help when an Apple app or workflow, such as making ringtones, expects AAC audio.',
    keep: 'Keep the MP3 for everything else: it is the most widely supported audio format on phones, cars and players.',
    tips: [
      'The audio is encoded as AAC at 192 kbps.',
      AUDIO_TAGS,
      'Converting between two compressed formats loses a little quality, so do it only when needed.',
    ],
    problems: [
      ['The M4A sounds slightly different.', 'Every lossy re-encode changes the sound a little. Start from a lossless original if you have one.'],
      ['The M4A is not smaller.', 'MP3s at low bitrates can be smaller than a 192 kbps M4A.'],
    ],
    faq: [
      ['Is M4A better than MP3?', 'At the same bitrate AAC usually sounds a little better, but converting an MP3 cannot improve it.'],
      ['Can I use the M4A as an iPhone ringtone?', 'Shorten it to 30 seconds and rename it to .m4r, then add it with Finder or iTunes.'],
    ],
  },

  'aac>mp3': {
    why: 'Raw AAC files, from voice recorders, some phones and downloads, do not play in every car stereo or old MP3 player. MP3 plays everywhere, so converting AAC to MP3 is the safest way to share the audio.',
    keep: 'Keep the AAC if it plays fine on your devices; it is often smaller at the same quality.',
    tips: [
      'The MP3 uses high-quality variable bitrate encoding.',
      'Convert many files at once and download a ZIP.',
      AUDIO_TAGS,
    ],
    problems: [
      ['The file will not convert.', 'Some files named .aac are really another format. Check where the file came from.'],
      ['The MP3 is bigger than the AAC.', 'AAC is more efficient, so an MP3 of similar quality can be larger.'],
    ],
    faq: [
      ['Does AAC to MP3 lose quality?', 'It re-encodes the sound, which loses a tiny amount. At this quality most people cannot hear it.'],
      ['Is AAC the same as M4A?', 'Mostly: M4A is AAC audio inside an MP4 container, while .aac files hold the bare audio stream.'],
    ],
  },

  'wma>mp3': {
    why: 'WMA is an old Windows Media audio format that iPhones, Android phones, Macs and many car stereos cannot play. Converting WMA to MP3 makes old music collections and recordings playable everywhere.',
    keep: 'There is little reason to keep WMA once you have MP3s, unless an old Windows program or device needs the WMA files.',
    tips: [
      'The MP3 uses high-quality variable bitrate encoding.',
      AUDIO_TAGS,
      'Convert a whole album at once and download it as a ZIP.',
    ],
    problems: [
      ['The file will not convert.', 'WMA files bought from old online music stores may have DRM protection, which prevents conversion.'],
      ['The MP3 sounds no better.', 'Converting keeps the quality of the original; it cannot restore what the WMA encoder removed.'],
    ],
    faq: [
      ['Can iPhones play WMA?', 'No. Convert the files to MP3 or M4A first.'],
      ['Is WMA lossless WMA supported?', 'Yes, WMA Lossless files can be read too.'],
    ],
  },

  'opus>mp3': {
    why: 'Opus is a modern, efficient audio format used for WhatsApp and Telegram voice messages and many online recordings. Many players and editors still do not open it, so converting Opus to MP3 makes voice notes easy to play, keep and share.',
    keep: 'Keep the Opus file if it plays where you need it: it is smaller at the same quality.',
    tips: [
      'WhatsApp voice notes saved as .opus or .ogg can be converted.',
      'The MP3 uses high-quality variable bitrate encoding.',
      'Convert many voice notes at once and download them as a ZIP.',
    ],
    problems: [
      ['My voice note is an .ogg file.', 'Use OGG to MP3: many apps save Opus audio with an .ogg name.'],
      ['The MP3 is bigger than the Opus file.', 'Opus is more efficient than MP3. A bigger file is normal.'],
    ],
    faq: [
      ['How do I convert a WhatsApp voice message to MP3?', 'Save or export the voice note from WhatsApp, upload it here, and download the MP3.'],
      ['Does Opus to MP3 lose quality?', 'Re-encoding loses a tiny amount, but for speech it is not noticeable.'],
    ],
  },

  'mp3>ogg': {
    why: 'OGG Vorbis is an open audio format used by games, game engines, Linux software and some websites. Converting MP3 to OGG gives you files that those projects accept.',
    keep: 'Keep the MP3 for phones, cars and music players, which support it far better than OGG Vorbis.',
    tips: [
      'The OGG uses Vorbis at a high-quality setting, around 160 kbps.',
      'Game engines such as Unity and Godot accept OGG directly.',
      'Converting between lossy formats loses a little quality; start from WAV or FLAC if you have it.',
    ],
    problems: [
      ['An iPhone will not play the OGG.', 'Apple devices have limited OGG support. Keep MP3 or M4A for them.'],
      ['The quality is not better.', 'Converting cannot restore detail lost in the MP3.'],
    ],
    faq: [
      ['Is OGG better than MP3?', 'Vorbis is efficient and royalty-free, but MP3 plays on more devices.'],
      ['Why do games use OGG?', 'It is free to use without licences and loops cleanly, which suits game music.'],
    ],
  },

  'm4a>wav': {
    why: 'Voice memos from iPhones and many recordings are M4A files. Converting them to WAV makes them easy to edit, cut and transcribe in any audio editor, and some transcription services ask for WAV.',
    keep: 'Keep the M4A for listening and storing: it is much smaller than the WAV, which is only needed for editing.',
    tips: [
      'The WAV is 16-bit PCM, CD-quality audio.',
      'iPhone Voice Memos work directly.',
      'Expect around 10MB per minute of stereo sound.',
    ],
    problems: [
      ['The WAV is very large.', 'WAV is uncompressed. That is normal.'],
      ['The file will not convert.', 'Songs bought from iTunes years ago may be DRM-protected (M4P), which cannot be converted.'],
    ],
    faq: [
      ['How do I convert an iPhone voice memo to WAV?', 'Share the memo to Files or email it to yourself, then upload the M4A here.'],
      ['Does M4A to WAV improve quality?', 'No, it keeps the quality of the M4A in an uncompressed file.'],
    ],
  },

  'flac>wav': {
    why: 'FLAC is lossless but not every program, DJ controller or hardware sampler opens it. WAV holds the same sound uncompressed and is accepted everywhere, so converting FLAC to WAV is a safe step for editing and production.',
    keep: 'Keep the FLAC for storing your music: it is about half the size of WAV with the same sound.',
    tips: [
      'The WAV is 16-bit PCM, the CD standard.',
      AUDIO_TAGS,
      'Albums convert quickly; download all tracks as a ZIP.',
    ],
    problems: [
      ['My 24-bit FLAC became 16-bit.', 'The WAV is written at 16 bits, the CD standard. For 24-bit masters, use a desktop audio tool that keeps the bit depth.'],
      ['The WAV is twice the size.', 'WAV is uncompressed. That is normal.'],
    ],
    faq: [
      ['Is FLAC to WAV lossless?', 'For CD-quality (16-bit) FLAC files, yes: the sound is identical.'],
      ['Which is better, FLAC or WAV?', 'They can sound identical; FLAC is smaller and stores tags better, WAV is more widely supported by editors.'],
    ],
  },

  'wav>flac': {
    why: 'FLAC stores exactly the same sound as WAV in about half the space and keeps song details properly. Converting WAV to FLAC is the best way to archive recordings and CD rips without losing anything.',
    keep: 'Keep WAV only for software that cannot open FLAC; the FLAC holds exactly the same sound in much less space.',
    tips: [
      'FLAC is lossless: the sound is identical to the WAV.',
      'Files are typically 40 to 60 percent smaller.',
      'Most music players, phones and streaming apps play FLAC.',
    ],
    problems: [
      ['The FLAC is not much smaller.', 'Noisy or very loud recordings compress less. That is normal for lossless audio.'],
      ['An app will not open FLAC.', 'Some older apps and Apple Music on older systems do not support FLAC. Use WAV or ALAC there.'],
    ],
    faq: [
      ['Does WAV to FLAC lose quality?', 'No. FLAC is lossless; decoding it gives back exactly the same audio.'],
      ['Can I convert FLAC back to WAV?', 'Yes, at any time and without loss, with FLAC to WAV.'],
    ],
  },

  'aiff>mp3': {
    why: 'AIFF is Apple\'s uncompressed audio format, common in GarageBand, Logic and sample libraries. AIFF files are large and not every player supports them, so converting AIFF to MP3 makes them small and easy to share.',
    keep: 'Keep the AIFF as your master copy for editing and mixing; the MP3 is the small copy for sharing and listening.',
    tips: [
      'The MP3 uses high-quality variable bitrate encoding.',
      'The MP3 is usually about a tenth of the AIFF size.',
      'Convert a whole folder of samples or tracks at once.',
    ],
    problems: [
      ['The file will not convert.', 'Compressed AIFF-C files with unusual codecs may not be readable. Export a standard AIFF or WAV from your audio app.'],
      ['I need lossless sound.', 'Choose FLAC as the output: it is lossless and much smaller than AIFF.'],
    ],
    faq: [
      ['Is AIFF the same as WAV?', 'Both are uncompressed audio; AIFF comes from Apple, WAV from Microsoft. They sound the same.'],
      ['How do I share a GarageBand song?', 'Export it from GarageBand, then convert the AIFF to MP3 here for a small file.'],
    ],
  },

  // ---------------------------------------------------------------- archives --
  '7z>zip': {
    why: '7Z archives compress well, but Windows (before recent updates), macOS and phones often cannot open them without extra software. ZIP opens everywhere with a double-click, so converting 7Z to ZIP makes the files easy for anyone to unpack.',
    keep: 'Keep the 7Z if you and the people you share with have 7-Zip: it is usually smaller.',
    tips: [
      'All files and folders are repacked into the ZIP with the same structure.',
      'The ZIP may be a little larger than the 7Z.',
      'For safety, archives that unpack to a very large size are refused.',
    ],
    problems: [
      ['The archive will not convert.', 'Password-protected (encrypted) archives cannot be opened. Unpack them with the password first.'],
      ['It says the archive is too large.', 'There is a limit on the unpacked size to protect the server. Split the archive into smaller parts.'],
    ],
    faq: [
      ['How do I open a 7Z file without 7-Zip?', 'Convert it to ZIP here, then double-click the ZIP on any computer or phone.'],
      ['Are file names kept?', 'Yes, names and folders stay the same.'],
    ],
  },

  'zip>7z': {
    why: '7Z usually compresses better than ZIP, so converting a ZIP to 7Z can make backups and large downloads smaller.',
    keep: 'Keep the ZIP for sharing with people who do not have 7-Zip or a similar tool, since ZIP opens everywhere.',
    tips: [
      'All files and folders are kept with the same structure.',
      'Text, documents and code shrink the most; photos and videos are already compressed and shrink very little.',
      'Archives that unpack to a very large size are refused, for safety.',
    ],
    problems: [
      ['The 7Z is not smaller.', 'If the ZIP contains JPGs, MP4s or other compressed files, there is little left to save.'],
      ['The ZIP will not convert.', 'Password-protected ZIPs cannot be opened. Unpack them with the password first.'],
    ],
    faq: [
      ['Is 7Z better than ZIP?', '7Z often makes smaller files; ZIP is supported everywhere without extra software.'],
      ['What opens 7Z files?', '7-Zip on Windows, Keka or The Unarchiver on Mac, and many file manager apps on phones.'],
    ],
  },

  // ------------------------------------------------------------------- fonts --
  'ttf>woff': {
    why: 'WOFF is the compressed web font format that every browser supports, including some older ones that do not support WOFF2. Converting TTF to WOFF makes your font load faster on a website.',
    keep: 'Keep the TTF for installing the font on computers and using it in design software.',
    tips: [
      'The letter shapes are not changed; the font data is only compressed.',
      'For current browsers WOFF2 is smaller still; WOFF is a good fallback.',
      'Check that the font licence allows web use.',
    ],
    problems: [
      ['The font does not show on my site.', 'Check the path in your @font-face rule, and that your server sends the file. Fonts from another domain need CORS headers.'],
      ['The file will not convert.', 'Font collections (TTC) are not supported. Use a single TTF file.'],
    ],
    faq: [
      ['WOFF or WOFF2?', 'WOFF2 is smaller and supported by all current browsers. Use WOFF only as a fallback for older browsers.'],
      ['Does it change the font?', 'No. The outlines and features are identical.'],
    ],
  },

  'woff>ttf': {
    why: 'Fonts downloaded from websites are often WOFF files, which Windows, macOS and design programs cannot install. Unpacking WOFF to TTF gives you an installable font.',
    keep: 'Keep the WOFF for use on websites, where it loads faster than the TTF because its data is compressed.',
    tips: [
      'The font is unpacked without changing any letter shapes.',
      'If the WOFF contains an OpenType (CFF) font, choose OTF as the output instead; you will be told if that is the case.',
      'Make sure the font licence allows desktop use.',
    ],
    problems: [
      ['It says to choose OTF instead.', 'This WOFF holds OpenType outlines, which unpack to an OTF file. Convert it with WOFF to OTF.'],
      ['Some letters are missing.', 'Web fonts are often subsets with only the characters a site needs.'],
    ],
    faq: [
      ['Is converting WOFF to TTF legal?', 'The conversion just unpacks the file; whether you may use the font depends on its licence.'],
      ['Will the TTF look the same?', 'Yes. The outlines are exactly the same.'],
    ],
  },

  'otf>woff2': {
    why: 'WOFF2 is the smallest web font format and works in every current browser. Converting an OTF font to WOFF2 makes it load quickly on your website.',
    keep: 'Keep the OTF for installing the font on computers and using it in design programs.',
    tips: [
      'Letter shapes and OpenType features are not changed.',
      'WOFF2 is typically 30 percent smaller than WOFF and much smaller than OTF.',
      'Check the font licence allows web use.',
    ],
    problems: [
      ['The font does not load on my site.', 'Check the @font-face path and format("woff2"), and add CORS headers if the font is on another domain.'],
      ['The file will not convert.', 'Font collections and damaged files cannot be read. Use a single OTF file.'],
    ],
    faq: [
      ['Do I need other formats besides WOFF2?', 'For current browsers, no. Add WOFF only if you must support very old browsers.'],
      ['Does it change the font?', 'No. Only the compression is different.'],
    ],
  },
};
