'use strict';
// Guides section (/guides and /guides/<slug>): longer how-to articles aimed at the questions
// people type into search ("png to webp without losing quality", "reduce pdf size for email").
// Each one answers the question properly and links to the tools that do the job.
//
// Same rules as content/guides.js: describe only what this site's engines really do.
// `sections` hold trusted HTML written here (links must point at real pages; the SEO test checks).
// `tools` are the converter pages the article is about: shown as buttons, and the article is
// linked back from each of those pages.
//
// Shape: { slug, title, h1, desc, date, updated, tools: [path..], intro, sections: [[h2, html]..], faq: [[q, a]..] }

module.exports = [
  {
    slug: 'png-to-webp-without-losing-quality',
    title: 'How to Convert PNG to WebP Without Losing Quality',
    h1: 'How to convert PNG to WebP without losing quality',
    desc: 'Convert PNG to WebP and keep images sharp: the right Quality setting for logos, screenshots and photos, transparency, resizing and when to keep the PNG.',
    date: '2026-10-07',
    tools: ['/png-to-webp', '/compress-png', '/webp-to-png'],
    intro: 'WebP files are usually 25 to 35 percent smaller than PNG, which makes web pages load faster. The worry is always the same: will the image look worse? With the right settings it will not. Here is how to pick them.',
    sections: [
      ['Lossless or lossy: what "without losing quality" really means', `<p>PNG is lossless: every pixel is stored exactly. WebP can work in two ways. <strong>Lossless WebP</strong> keeps every pixel too, and <strong>lossy WebP</strong> throws away detail the eye barely sees, which gives much smaller files.</p>
<p>Our <a href="/png-to-webp">PNG to WebP converter</a> makes lossy WebP at the Quality you choose. At high settings the difference from the PNG is practically invisible, while the file is still much smaller. So in practice "without losing quality" means: without any loss you can see.</p>`],
      ['Step by step', `<ol>
<li>Open the <a href="/png-to-webp">PNG to WebP converter</a> and drop in one PNG or many.</li>
<li>Click <strong>Options</strong> on a file to set <strong>Quality</strong> and <strong>Resize</strong> (the settings are explained below).</li>
<li>Click <strong>Convert</strong>, check the new file size in the list, and download the WebP files one by one or all together as a ZIP.</li>
</ol>`],
      ['The right Quality for each kind of image', `<ul>
<li><strong>Logos, icons, screenshots and anything with text:</strong> Quality 85 to 95. Sharp edges and small letters show compression first, so give them room.</li>
<li><strong>Illustrations and flat graphics:</strong> Quality 80 to 90.</li>
<li><strong>Photos that were saved as PNG:</strong> Quality 70 to 80. Photos hide compression well, and this is where WebP saves the most, often 80 percent or more compared with the PNG.</li>
</ul>
<p>When in doubt, convert at 90, open the PNG and WebP side by side at 100 percent zoom and compare. If you cannot see a difference, try 80.</p>`],
      ['Resize first: the biggest saving of all', `<p>A 4000 pixel wide PNG shown in an 800 pixel wide column wastes most of its bytes. Choose <strong>Max 1920px</strong> for full-width images, or <strong>Max 1280px</strong> or <strong>Max 800px</strong> for images inside an article. Images are never enlarged, only made smaller when they are bigger than the size you pick.</p>`],
      ['Transparency is kept', `<p>WebP supports transparent and semi-transparent pixels, so logos and cut-out product photos keep their transparent background and can sit on any colour, just like the PNG.</p>`],
      ['When to keep the PNG', `<ul>
<li>As your <strong>master copy</strong> for future editing. Always convert from the original PNG, not from a WebP you made earlier.</li>
<li>For <strong>print shops and older desktop software</strong>, which do not always open WebP.</li>
<li>When the PNG is already tiny, for example a simple icon of a few kilobytes. If the WebP is not smaller, keep the PNG.</li>
</ul>
<p>If you need to go back, the <a href="/webp-to-png">WebP to PNG converter</a> turns a WebP into a PNG again. If you would rather keep PNG but make it smaller, <a href="/compress-png">compress the PNG</a> instead.</p>`],
    ],
    faq: [
      ['Does converting PNG to WebP reduce quality?', 'Lossy WebP removes a little detail, but at Quality 85 and above it is very hard to see. Logos and text need higher settings than photos.'],
      ['Does WebP keep the transparent background of a PNG?', 'Yes. WebP supports full transparency, including soft semi-transparent edges.'],
      ['How much smaller is WebP than PNG?', 'For graphics typically 25 to 35 percent; for photos saved as PNG often 70 to 90 percent.'],
    ],
  },

  {
    slug: 'convert-images-to-webp-for-wordpress',
    title: 'How to Convert Images to WebP for WordPress',
    h1: 'How to convert images to WebP for WordPress',
    desc: 'Speed up a WordPress site by uploading WebP images: convert JPG and PNG to WebP for free, choose the right size and quality, and avoid common mistakes.',
    date: '2026-10-07',
    tools: ['/jpg-to-webp', '/png-to-webp', '/heic-to-webp'],
    intro: 'Images are usually the heaviest part of a WordPress page. WordPress has accepted WebP uploads since version 5.8, so converting your images before uploading is one of the simplest ways to make the site faster, without any plugin.',
    sections: [
      ['Why WebP helps a WordPress site', `<p>A WebP image is typically 25 to 35 percent smaller than the same JPG or PNG at similar quality. Smaller images mean faster page loads, a better experience on mobile data and better page experience scores, which search engines take into account. WebP also supports transparency, so it can replace PNG for logos.</p>`],
      ['Step 1: Convert your images', `<ul>
<li>Photos: use <a href="/jpg-to-webp">JPG to WebP</a>.</li>
<li>Logos, screenshots and graphics: use <a href="/png-to-webp">PNG to WebP</a>.</li>
<li>iPhone photos: use <a href="/heic-to-webp">HEIC to WebP</a> to skip the JPG step.</li>
</ul>
<p>You can drop dozens of files at once and download them all as a ZIP.</p>`],
      ['Step 2: Pick the right size', `<p>Upload images at the size your theme actually shows, not straight from the camera. Under <strong>Options</strong>, choose <strong>Resize</strong>:</p>
<ul>
<li><strong>Max 1920px</strong> for full-width headers and hero images.</li>
<li><strong>Max 1280px</strong> for featured images and images inside posts on most themes.</li>
<li><strong>Max 800px</strong> for thumbnails and images in narrow columns.</li>
</ul>
<p>WordPress still creates its own smaller copies (thumbnail, medium, large) from what you upload, so starting with a sensible size keeps every copy small.</p>`],
      ['Step 3: Pick the right quality', `<p>Quality 75 is a good default for photos. Use 85 or more for images with text, such as screenshots and infographics. Check one image at full size before converting a whole batch.</p>`],
      ['Step 4: Upload to the Media Library', `<p>Upload the WebP files in <strong>Media, Add New</strong>, exactly like JPG or PNG. Fill in the <strong>Alt Text</strong> field with a short description of each image: it helps visitors using screen readers and helps search engines understand the picture. A descriptive file name, such as <em>blue-running-shoes.webp</em>, helps too.</p>`],
      ['Common problems', `<ul>
<li><strong>"Sorry, you are not allowed to upload this file type."</strong> Your WordPress is older than 5.8, or your host blocks WebP. Update WordPress, or ask your host.</li>
<li><strong>Thumbnails are missing.</strong> The server's image library cannot process WebP. Most hosts support it; ask yours to enable WebP support in GD or Imagick.</li>
<li><strong>The WebP is bigger than the JPG.</strong> The JPG was already compressed very hard. Lower Quality to 65, or keep the JPG.</li>
</ul>`],
    ],
    faq: [
      ['Does WordPress support WebP?', 'Yes. WordPress accepts WebP uploads since version 5.8, released in 2021.'],
      ['Do I need a plugin to use WebP in WordPress?', 'No. Converting images before uploading works without any plugin. Plugins are only needed if you want existing images converted automatically.'],
      ['Will old browsers show my WebP images?', 'All current browsers support WebP. Only very old ones, such as Internet Explorer, do not.'],
    ],
  },

  {
    slug: 'reduce-pdf-file-size',
    title: 'How to Reduce PDF File Size for Email and Upload Forms',
    h1: 'How to reduce PDF file size for email and upload forms',
    desc: 'PDF too big to email or upload? Learn why PDFs get large and how to make them smaller for free: compress the PDF, shrink images first, and fix scanned documents.',
    date: '2026-10-07',
    tools: ['/compress-pdf', '/compress-jpg', '/jpg-to-pdf'],
    intro: 'Many email services limit attachments to 20 or 25MB, and job, university and government portals often accept only 1 or 2MB. Here is how to get a PDF under those limits without making it unreadable.',
    sections: [
      ['Why PDFs get so big', `<p>Text takes almost no space in a PDF. Size comes from <strong>images</strong>: photos, scanned pages and high-resolution graphics. A single phone photo can be 3 to 5MB, and a scanned document is one large picture per page. Making a PDF smaller almost always means making its images smaller.</p>`],
      ['Method 1: Compress the PDF', `<p>Open the <a href="/compress-pdf">PDF compressor</a> and drop in your file. Images inside the PDF are reduced to 150 dpi, which still looks sharp on screen and prints well on normal paper, and the PDF structure is cleaned up. Text stays real text and stays searchable.</p>
<p>If the result is not smaller, for example because the PDF contains only text, you get your original file back, so you never end up with a bigger file.</p>`],
      ['Method 2: Shrink the images before making the PDF', `<p>If you are making a PDF from photos, such as a scanned certificate or receipts photographed with a phone, shrink the photos first:</p>
<ol>
<li>Use <a href="/compress-jpg">Compress JPG</a> and set <strong>Resize</strong> to <strong>Max 1920px</strong> (or Max 1280px for documents with large text).</li>
<li>Then turn each photo into a PDF with <a href="/jpg-to-pdf">JPG to PDF</a>.</li>
</ol>
<p>A photo of an A4 page at 1920 pixels is easy to read and usually well under 500KB.</p>`],
      ['How small can you go?', `<ul>
<li><strong>Text documents</strong> (CVs, letters, reports made in Word): usually already small. If yours is large, it probably contains big images.</li>
<li><strong>Scanned documents:</strong> about 100 to 300KB per page after compression is typical.</li>
<li><strong>Brochures and photo-heavy PDFs:</strong> expect savings of 50 percent or more.</li>
</ul>`],
      ['Tips for scanned documents', `<ul>
<li>Scan at 150 or 200 dpi, not 600. For forms and IDs that is plenty.</li>
<li>Scan in greyscale instead of colour when colour is not needed.</li>
<li>Crop away empty borders before saving.</li>
</ul>`],
    ],
    faq: [
      ['Does compressing a PDF reduce quality?', 'Images are reduced to 150 dpi, which looks sharp on screen and in normal prints. Text and vector graphics are not affected.'],
      ['Can I compress a password-protected PDF?', 'No. Remove the password first, then compress the PDF.'],
      ['How do I get a PDF under 1MB?', 'Compress it first. If it is still too big, it is probably made of large photos; shrink them with Compress JPG and Resize, then make the PDF again.'],
    ],
  },

  {
    slug: 'open-heic-files-on-windows',
    title: 'How to Open HEIC Files on Windows (Convert to JPG)',
    h1: 'How to open HEIC files on Windows',
    desc: 'iPhone photos are HEIC files that Windows often cannot open. See why, how to convert HEIC to JPG for free, and how to make your iPhone save JPG instead.',
    date: '2026-10-07',
    tools: ['/heic-to-jpg', '/heic-to-png', '/heic-to-pdf'],
    intro: 'You copy photos from your iPhone to a Windows PC and they will not open, or they show an error in Photoshop, Word or an upload form. The reason is the HEIC format. Here is how to deal with it.',
    sections: [
      ['What is a HEIC file?', `<p>Since iOS 11, iPhones save photos in the HEIC format (High Efficiency Image Container). It stores a photo in about half the space of a JPG at similar quality. The downside is support: Windows needs an extra codec to show HEIC, and many programs and websites cannot open it at all.</p>`],
      ['Option 1: Convert HEIC to JPG (works everywhere)', `<ol>
<li>Open the <a href="/heic-to-jpg">HEIC to JPG converter</a>.</li>
<li>Drop in your HEIC photos. You can add many at once.</li>
<li>Click <strong>Convert</strong> and download the JPGs, or all of them as a ZIP.</li>
</ol>
<p>The JPGs open in every Windows program, website and phone. Photos are turned upright automatically, and location data from the camera is removed from the converted file, so it is safe to share. If you need a transparent or lossless image use <a href="/heic-to-png">HEIC to PNG</a>, and for forms that want a document use <a href="/heic-to-pdf">HEIC to PDF</a>.</p>`],
      ['Option 2: Install the HEIF extension in Windows', `<p>Windows 10 and 11 can show HEIC photos in the Photos app after installing the <strong>HEIF Image Extensions</strong> (and on some PCs the <strong>HEVC Video Extensions</strong>) from the Microsoft Store. This lets you view the photos, but many other programs and upload forms still will not accept them, so converting is often still needed.</p>`],
      ['Option 3: Make your iPhone save JPG', `<p>On the iPhone, open <strong>Settings, Camera, Formats</strong> and choose <strong>Most Compatible</strong>. New photos are saved as JPG. Existing photos stay HEIC.</p>
<p>Another option: in <strong>Settings, Photos</strong>, set <strong>Transfer to Mac or PC</strong> to <strong>Automatic</strong>. The iPhone then converts photos to JPG when you copy them to a computer with a cable.</p>`],
      ['Should I stop using HEIC?', `<p>Not necessarily. HEIC saves a lot of storage on your phone and in iCloud. Keeping HEIC on the phone and converting only the photos you need to share is a good middle way.</p>`],
    ],
    faq: [
      ['Why can I not open HEIC files on Windows?', 'Windows does not include a HEIC decoder by default. You need an extension from the Microsoft Store, or you can convert the photos to JPG.'],
      ['Does converting HEIC to JPG reduce quality?', 'Slightly in theory, because JPG is compressed again. At Quality 85 or more the difference is not visible.'],
      ['Can I convert many HEIC photos at once?', 'Yes. Drop as many as you like and download them together as a ZIP.'],
    ],
  },

  {
    slug: 'convert-pdf-to-word-keep-formatting',
    title: 'How to Convert PDF to Word and Keep the Formatting',
    h1: 'How to convert PDF to Word and keep the formatting',
    desc: 'Get an editable Word file from a PDF: which PDFs convert well, why layouts change, how to fix tables and columns, and what to do with scanned PDFs.',
    date: '2026-10-07',
    tools: ['/pdf-to-docx', '/docx-to-pdf', '/pdf-to-txt'],
    intro: 'Converting a PDF to Word is the usual way to edit a document when you no longer have the original file. How good the result is depends mostly on how the PDF was made. Here is what to expect and how to get the best result.',
    sections: [
      ['First check: is your PDF text or a scan?', `<p>Open the PDF and try to select a word with your mouse.</p>
<ul>
<li><strong>You can select text:</strong> the PDF was made from a document. It will convert to an editable Word file.</li>
<li><strong>You cannot select anything:</strong> the PDF is a scan, a photo of each page. There is no text inside, only pictures, so a converter cannot give you editable text. That needs OCR (text recognition) software.</li>
</ul>`],
      ['How to convert', `<ol>
<li>Open the <a href="/pdf-to-docx">PDF to Word converter</a>.</li>
<li>Drop in your PDF and click <strong>Convert</strong>.</li>
<li>Download the DOCX and open it in Word, Google Docs or LibreOffice.</li>
</ol>`],
      ['Why the layout can change', `<p>A PDF stores the exact position of every line on a fixed page. A Word document flows text from line to line and page to page. When converting, the converter rebuilds paragraphs, headings and images so the text can be edited, and simplifies complex layouts. The text is all there, but these often need tidying:</p>
<ul>
<li><strong>Tables</strong> may become plain lines of text.</li>
<li><strong>Multi-column pages</strong> such as newsletters may become a single column.</li>
<li><strong>Headers, footers and page numbers</strong> may appear inside the text.</li>
<li><strong>Fonts</strong> that are not on your computer are shown with a substitute.</li>
</ul>`],
      ['Tips for a cleaner result', `<ul>
<li>Simple documents, such as letters, CVs, essays and reports, convert best.</li>
<li>After converting, use Word's styles (Heading 1, Normal) to clean up formatting quickly instead of fixing paragraphs one by one.</li>
<li>For a forms-heavy or design-heavy PDF, it is often faster to copy the text into a fresh Word template.</li>
<li>If you only need the words, <a href="/pdf-to-txt">PDF to TXT</a> gives clean plain text.</li>
</ul>`],
      ['When you are done', `<p>Edit the document in Word, then turn it back into a PDF with <a href="/docx-to-pdf">Word to PDF</a> so it looks the same for everyone.</p>`],
    ],
    faq: [
      ['Can I convert a scanned PDF to editable Word?', 'Not with this converter: scanned PDFs contain pictures of pages, and it does not perform OCR. The Word file would contain no editable text.'],
      ['Is PDF to Word conversion free?', 'Yes, free with no sign-up and no watermark.'],
      ['Why does my converted Word file look different?', 'PDFs fix every line on the page, while Word flows text. Paragraphs and text are kept, but tables, columns and spacing may need tidying.'],
    ],
  },

  {
    slug: 'extract-audio-from-video',
    title: 'How to Extract Audio From a Video (MP4 to MP3)',
    h1: 'How to extract audio from a video',
    desc: 'Save the sound of a video as MP3, WAV or M4A for free: which format to choose for music, podcasts, editing or transcription, and how to fix common problems.',
    date: '2026-10-07',
    tools: ['/mp4-to-mp3', '/mp4-to-wav', '/mov-to-mp3'],
    intro: 'Want the music from a clip, the talk from a lecture recording or the audio of an interview for transcription? You do not need video software: convert the video to an audio format and only the sound is kept.',
    sections: [
      ['Which audio format should you choose?', `<ul>
<li><strong>MP3</strong> for listening on any phone, car stereo or player. Small files, about 1 to 1.5MB per minute. Use <a href="/mp4-to-mp3">MP4 to MP3</a>.</li>
<li><strong>WAV</strong> for editing in Audacity, Premiere or a DAW, or for transcription services that ask for it. Uncompressed and large, about 10MB per minute. Use <a href="/mp4-to-wav">MP4 to WAV</a>.</li>
<li><strong>M4A</strong> for Apple devices. Good quality in small files. Use <a href="/mp4-to-m4a">MP4 to M4A</a>.</li>
</ul>`],
      ['How to do it', `<ol>
<li>Open the converter for your video type, for example <a href="/mp4-to-mp3">MP4 to MP3</a> or, for iPhone videos, <a href="/mov-to-mp3">MOV to MP3</a>.</li>
<li>Drop in your video files.</li>
<li>Click <strong>Convert</strong> and download the audio.</li>
</ol>
<p>Other video types work the same way: <a href="/mkv-to-mp3">MKV to MP3</a>, <a href="/webm-to-mp3">WebM to MP3</a> and more.</p>`],
      ['What quality do you get?', `<p>MP3 files are encoded with high-quality variable bitrate (around 190 kbps), which most listeners cannot tell apart from the original. The sound can never be better than the audio inside the video: a phone recording in a noisy room stays a phone recording in a noisy room.</p>`],
      ['Common problems', `<ul>
<li><strong>"This file has no audio track."</strong> The video was recorded without sound, as with many screen recordings.</li>
<li><strong>The file is too large to upload.</strong> Very long videos can be over the upload limit. Cut the part you need with your phone's or computer's video editor first.</li>
<li><strong>Wrong language.</strong> Videos with several audio tracks have one picked automatically.</li>
</ul>`],
      ['A note on copyright', `<p>Only extract audio from videos you made yourself or have the right to use. Music and films are usually protected by copyright.</p>`],
    ],
    faq: [
      ['Can I convert a video to MP3 on my phone?', 'Yes. The converter works in the browser on Android and iPhone; pick the video from your gallery or files.'],
      ['Does extracting audio reduce quality?', 'MP3 re-encodes the sound at high quality, which is transparent for most listeners. For no further loss at all, choose WAV.'],
      ['Can I extract audio from an iPhone video?', 'Yes. iPhone videos are MOV files; use MOV to MP3.'],
    ],
  },

  {
    slug: 'compress-images-for-website',
    title: 'How to Compress Images for a Website (Without Losing Quality)',
    h1: 'How to compress images for a website',
    desc: 'Make a website faster by compressing images: pick the right format, size and quality, compress JPG, PNG and WebP for free, and check the results.',
    date: '2026-10-07',
    tools: ['/compress-jpg', '/compress-png', '/compress-webp', '/jpg-to-webp'],
    intro: 'Images are usually more than half of a web page\'s weight. Compressing them is the quickest speed win there is, and done right, nobody will notice any change in quality.',
    sections: [
      ['1. Use the right size', `<p>Most of the saving comes from size, not compression. A photo straight from a phone is about 4000 pixels wide; a blog column is about 800. Resizing such a photo to the size it is shown cuts its weight by 90 percent or more before any compression.</p>
<p>In every compressor here, click <strong>Options</strong> and choose <strong>Resize</strong>: Max 1920px for full-width images, Max 1280px for content images, Max 800px for thumbnails. Images are only made smaller, never larger.</p>`],
      ['2. Use the right format', `<ul>
<li><strong>Photos:</strong> JPG or, better, WebP. Convert with <a href="/jpg-to-webp">JPG to WebP</a> for 25 to 35 percent smaller files.</li>
<li><strong>Logos, icons, screenshots:</strong> PNG or WebP. Both keep sharp edges and transparency.</li>
<li><strong>Never</strong> use PNG for large photos: it is lossless, so photos become huge.</li>
</ul>
<p>Not sure? Read <a href="/guides/jpg-vs-png-vs-webp">JPG vs PNG vs WebP</a>.</p>`],
      ['3. Compress at a sensible quality', `<ul>
<li><a href="/compress-jpg">Compress JPG</a>: Quality 70 to 80 for photos.</li>
<li><a href="/compress-png">Compress PNG</a>: reduces the number of colours; Quality 70 to 85 keeps graphics clean.</li>
<li><a href="/compress-webp">Compress WebP</a>: Quality 70 to 80.</li>
</ul>
<p>All compressors handle many files at once and give you a ZIP. Camera data such as GPS location is removed too, which also saves a few kilobytes.</p>`],
      ['4. Check the result', `<p>Open the original and the compressed image side by side at 100 percent zoom. If you cannot see a difference, try a lower Quality; if you can, go higher. After uploading, test your page with a speed test such as PageSpeed Insights.</p>`],
      ['A quick checklist', `<ul>
<li>Resize to the displayed size.</li>
<li>WebP for photos, PNG or WebP for graphics.</li>
<li>Quality around 75 for photos, 85 for images with text.</li>
<li>Descriptive file names and alt text for every image.</li>
</ul>`],
    ],
    faq: [
      ['What is the best image size for a website?', 'Use the largest width the image is shown at: about 1920 pixels for full-width images and 800 to 1280 for images inside content.'],
      ['Does compressing images hurt quality?', 'At sensible settings the change is not visible. Quality 70 to 80 for photos is a good balance.'],
      ['Which image format loads fastest?', 'WebP and AVIF give the smallest files. WebP works in every current browser and is the safe default.'],
    ],
  },

  {
    slug: 'jpg-vs-png-vs-webp',
    title: 'JPG vs PNG vs WebP: Which Image Format Should You Use?',
    h1: 'JPG vs PNG vs WebP: which image format should you use?',
    desc: 'A simple comparison of JPG, PNG and WebP: file size, quality, transparency and support, with clear advice on which format to use for photos, logos and websites.',
    date: '2026-10-07',
    tools: ['/jpg-to-png', '/png-to-jpg', '/jpg-to-webp', '/png-to-webp'],
    intro: 'JPG, PNG and WebP are the three image formats you meet every day. Each is best at something different. This short guide tells you which one to use, and when to convert.',
    sections: [
      ['The short answer', `<ul>
<li><strong>Photos to share or print:</strong> JPG.</li>
<li><strong>Logos, icons, screenshots, anything with transparency:</strong> PNG.</li>
<li><strong>Anything on a website:</strong> WebP.</li>
</ul>`],
      ['JPG', `<p>JPG has been the photo format since the 1990s. It compresses photos very well by removing detail the eye barely notices. Every device, app and website supports it.</p>
<p><strong>Weak points:</strong> no transparency, and text or sharp edges get blurry halos at low quality. Saving a JPG again and again loses a little more detail each time.</p>`],
      ['PNG', `<p>PNG is lossless: it stores every pixel exactly. It keeps sharp edges and supports transparency, which makes it ideal for logos, icons, screenshots and graphics you will edit again.</p>
<p><strong>Weak point:</strong> photos saved as PNG are very large, often five to ten times bigger than JPG.</p>`],
      ['WebP', `<p>WebP was made by Google for the web. It can do what both JPG and PNG do: lossy compression for photos and transparency for graphics, in files usually 25 to 35 percent smaller. Every current browser shows WebP.</p>
<p><strong>Weak point:</strong> some older programs, upload forms and print shops still do not accept it.</p>`],
      ['Side by side', `<div class="table-wrap"><table>
<thead><tr><th scope="col"></th><th scope="col">JPG</th><th scope="col">PNG</th><th scope="col">WebP</th></tr></thead>
<tbody>
<tr><th scope="row">Best for</th><td>Photos</td><td>Graphics, screenshots</td><td>Websites</td></tr>
<tr><th scope="row">Compression</th><td>Lossy</td><td>Lossless</td><td>Lossy or lossless</td></tr>
<tr><th scope="row">Transparency</th><td>No</td><td>Yes</td><td>Yes</td></tr>
<tr><th scope="row">Animation</th><td>No</td><td>No</td><td>Yes</td></tr>
<tr><th scope="row">Photo file size</th><td>Small</td><td>Very large</td><td>Smallest</td></tr>
<tr><th scope="row">Support</th><td>Everywhere</td><td>Everywhere</td><td>All current browsers, most apps</td></tr>
</tbody></table></div>`],
      ['When to convert', `<ul>
<li>A site will not accept your WebP: <a href="/webp-to-jpg">WebP to JPG</a> or <a href="/webp-to-png">WebP to PNG</a>.</li>
<li>You need a transparent background or lossless copy: <a href="/jpg-to-png">JPG to PNG</a> (note that converting cannot remove a background that is already in the photo).</li>
<li>A PNG photo is too big: <a href="/png-to-jpg">PNG to JPG</a>.</li>
<li>You want a faster website: <a href="/jpg-to-webp">JPG to WebP</a> and <a href="/png-to-webp">PNG to WebP</a>.</li>
</ul>`],
    ],
    faq: [
      ['Is PNG better quality than JPG?', 'PNG is lossless, so it never loses detail. For photos a high-quality JPG looks the same and is far smaller; for text and graphics PNG looks sharper.'],
      ['Is WebP better than JPG?', 'For websites, yes: smaller files at the same quality. For sharing and printing, JPG is still more widely accepted.'],
      ['Does converting JPG to PNG improve quality?', 'No. It stops further loss, but cannot restore detail the JPG already removed.'],
    ],
  },

  {
    slug: 'make-a-favicon',
    title: 'How to Make a Favicon (ICO) From a PNG or JPG',
    h1: 'How to make a favicon from a PNG or JPG',
    desc: 'Create a favicon.ico for your website in a minute: prepare a square logo, convert PNG or JPG to ICO with all standard sizes, and add it to your site.',
    date: '2026-10-07',
    tools: ['/png-to-ico', '/jpg-to-ico', '/svg-to-png'],
    intro: 'The favicon is the small icon in the browser tab, bookmarks and search results. A clear favicon makes your site look finished and easier to find among open tabs. Here is how to make one.',
    sections: [
      ['1. Prepare a square image', `<ul>
<li>Use a <strong>square</strong> image, at least 256 by 256 pixels. Images that are not square are cropped from the centre.</li>
<li>Use a <strong>simple</strong> design: a letter, a symbol or the mark from your logo. Full logos with text become unreadable at 16 pixels.</li>
<li>Use a <strong>PNG with a transparent background</strong> so the icon looks good in light and dark browser themes.</li>
</ul>
<p>If your logo is an SVG, turn it into a PNG first with <a href="/svg-to-png">SVG to PNG</a>.</p>`],
      ['2. Convert to ICO', `<ol>
<li>Open <a href="/png-to-ico">PNG to ICO</a> (or <a href="/jpg-to-ico">JPG to ICO</a>).</li>
<li>Drop in your square image and click <strong>Convert</strong>.</li>
<li>Download the ICO file.</li>
</ol>
<p>The ICO contains 16, 32, 48, 64, 128 and 256 pixel versions, so the right size is used in tabs, bookmarks, the taskbar and on the desktop.</p>`],
      ['3. Add it to your website', `<p>Rename the file to <strong>favicon.ico</strong> and upload it to the main folder of your site, so it is available at <em>yoursite.com/favicon.ico</em>. Browsers look there automatically. You can also add this line to the head of your pages:</p>
<p><code>&lt;link rel="icon" href="/favicon.ico" sizes="any"&gt;</code></p>
<p>On WordPress you do not need the file at all: go to <strong>Appearance, Customize, Site Identity</strong> and upload a square PNG as the Site Icon.</p>`],
      ['Why is my old favicon still showing?', `<p>Browsers cache favicons for a long time. Open your site in a private window, or clear the browser cache, to see the new one. Search engines update the icon in results on their next visit, which can take a few days or weeks.</p>`],
    ],
    faq: [
      ['What size should a favicon be?', 'The ICO should hold several sizes; the standard set is 16, 32, 48, 64, 128 and 256 pixels, which our converter includes automatically.'],
      ['Can a favicon have a transparent background?', 'Yes. Start from a PNG with transparency and it is kept in the ICO.'],
      ['Do I still need favicon.ico?', 'It is still the most widely supported option and the one browsers look for automatically, so it is worth having.'],
    ],
  },

  {
    slug: 'convert-iphone-video-to-mp4',
    title: 'How to Convert iPhone Videos (MOV) to MP4',
    h1: 'How to convert iPhone videos (MOV) to MP4',
    desc: 'iPhone videos are MOV files that some Windows apps, TVs and websites will not play. Convert MOV to MP4 for free, keep quality, and fix sound and size issues.',
    date: '2026-10-07',
    tools: ['/mov-to-mp4', '/mov-to-gif', '/mov-to-mp3'],
    intro: 'Videos recorded on an iPhone are saved as MOV files, often with HEVC video inside. They play fine on Apple devices, but Windows apps, smart TVs, older Android phones and some upload forms struggle with them. MP4 plays everywhere.',
    sections: [
      ['Why iPhone videos do not play everywhere', `<p>MOV is Apple's QuickTime container. Since iOS 11 the video inside is usually <strong>HEVC (H.265)</strong>, which saves space but needs a decoder that many devices and programs do not have. The <a href="/mov-to-mp4">MOV to MP4 converter</a> re-encodes the video as <strong>H.264</strong> with AAC sound, the most compatible combination there is.</p>`],
      ['How to convert', `<ol>
<li>Copy the video from your iPhone to your computer, or open this site in Safari on the iPhone.</li>
<li>Open <a href="/mov-to-mp4">MOV to MP4</a> and drop in or choose the video.</li>
<li>Click <strong>Convert</strong> and download the MP4.</li>
</ol>
<p>The MP4 is prepared for fast start, so it begins playing online before it has fully downloaded.</p>`],
      ['Does it lose quality?', `<p>The video is re-encoded at high quality, so on a phone, laptop or TV it looks the same. The resolution and frame rate stay as recorded. The MP4 may be somewhat larger than the HEVC original, because H.264 is less efficient; that is the cost of playing everywhere.</p>
<p>Videos recorded in HDR (shown as HDR or Dolby Vision on the iPhone) are converted to standard video, and their colours can look a little flatter. To avoid this for new recordings, turn off <strong>HDR Video</strong> in <strong>Settings, Camera, Record Video</strong>.</p>`],
      ['Other useful conversions', `<ul>
<li>Need only the sound? <a href="/mov-to-mp3">MOV to MP3</a>.</li>
<li>Want a short looping clip for a chat or document? <a href="/mov-to-gif">MOV to GIF</a>.</li>
</ul>`],
      ['Make your iPhone record more compatible video', `<p>In <strong>Settings, Camera, Formats</strong>, choose <strong>Most Compatible</strong>. New videos are recorded with H.264 and play on more devices, though they take more space on the phone.</p>`],
      ['Large videos', `<p>Long 4K videos can be bigger than the upload limit. Trim the video in the iPhone Photos app (Edit, then drag the ends of the timeline) to just the part you need before converting.</p>`],
    ],
    faq: [
      ['Why will my iPhone video not play on Windows?', 'iPhone videos usually use HEVC, which Windows only plays with an extra extension. Converting to MP4 with H.264 solves it.'],
      ['Does MOV to MP4 lose quality?', 'The video is re-encoded at high quality and keeps its resolution, so the difference is not visible.'],
      ['Can I convert MOV to MP4 on my iPhone?', 'Yes. Open this site in Safari, choose the video from your library, and download the MP4.'],
    ],
  },

  {
    slug: 'convert-word-to-pdf-on-phone',
    title: 'How to Convert Word to PDF on Your Phone',
    h1: 'How to convert Word to PDF on your phone',
    desc: 'Turn a Word document into a PDF on Android or iPhone without any app: step by step, plus how to keep fonts and layout right for CVs, assignments and forms.',
    date: '2026-10-07',
    tools: ['/docx-to-pdf', '/doc-to-pdf', '/jpg-to-pdf'],
    intro: 'Job portals, universities and offices usually ask for documents as PDF. If your CV or assignment is a Word file on your phone, you can turn it into a PDF in the browser, without installing anything.',
    sections: [
      ['Step by step', `<ol>
<li>Open <a href="/docx-to-pdf">Word to PDF</a> in your phone's browser (Chrome, Safari or any other).</li>
<li>Tap <strong>Select File</strong> and choose the DOCX from your Files app, Downloads, Google Drive or iCloud Drive.</li>
<li>Tap <strong>Convert</strong>, then <strong>Download</strong>. The PDF is saved in your Downloads or Files.</li>
</ol>
<p>For old Word files ending in .doc, use <a href="/doc-to-pdf">DOC to PDF</a>.</p>`],
      ['Keep the layout right', `<ul>
<li><strong>Use common fonts</strong> such as Calibri, Arial or Times New Roman. Unusual fonts may be replaced with a similar one.</li>
<li><strong>Check page breaks</strong> in the PDF before sending. If a heading sits alone at the bottom of a page, add a page break before it in Word.</li>
<li><strong>Images and tables</strong> are kept as in the document.</li>
</ul>`],
      ['Why send a PDF instead of Word?', `<ul>
<li>It looks exactly the same on every phone and computer.</li>
<li>Nobody can change it by accident.</li>
<li>Most portals and email filters expect it.</li>
</ul>`],
      ['Need to send photos of documents?', `<p>If you photographed a certificate or form, turn the photo into a PDF with <a href="/jpg-to-pdf">JPG to PDF</a>. iPhone photos can go straight through <a href="/heic-to-pdf">HEIC to PDF</a>.</p>`],
      ['Privacy', `<p>Your document is used only for the conversion and deleted from the server as soon as the PDF is ready. Nothing is stored.</p>`],
    ],
    faq: [
      ['Can I convert Word to PDF on Android without an app?', 'Yes. Open the Word to PDF page in your browser, choose the file, and download the PDF.'],
      ['Will my CV look the same as PDF?', 'Yes, as long as it uses common fonts. Check the PDF once before sending it.'],
      ['Is it free?', 'Yes, with no sign-up and no watermark.'],
    ],
  },

  {
    slug: 'read-epub-on-kindle',
    title: 'How to Read EPUB Books on Kindle',
    h1: 'How to read EPUB books on Kindle',
    desc: 'Kindles do not open EPUB files directly. Learn the easiest way to send EPUB to Kindle, when to convert to AZW3 or MOBI, and why some books cannot be converted.',
    date: '2026-10-07',
    tools: ['/epub-to-mobi', '/epub-to-azw3', '/epub-to-pdf'],
    intro: 'EPUB is the most common ebook format, used by Apple Books, Kobo, Google Play Books and most free ebook sites. Kindles cannot open EPUB files copied over USB, but there are easy ways around it.',
    sections: [
      ['Option 1: Send to Kindle (easiest)', `<p>Amazon's <strong>Send to Kindle</strong> service accepts EPUB files and converts them for your Kindle automatically. You can use it by:</p>
<ul>
<li>emailing the EPUB to your Kindle's email address (found in your Amazon account under devices),</li>
<li>using the Send to Kindle website in a browser, or</li>
<li>using the Send to Kindle app on a computer, or the share button in the Kindle phone app.</li>
</ul>
<p>The book appears in your library on every Kindle and Kindle app.</p>`],
      ['Option 2: Convert and copy over USB', `<p>If you prefer copying files with a cable, convert the EPUB to a Kindle format first:</p>
<ul>
<li><a href="/epub-to-azw3">EPUB to AZW3</a>: the modern Kindle format, with better layout support. Best for current Kindles.</li>
<li><a href="/epub-to-mobi">EPUB to MOBI</a>: the older format, for very old Kindles.</li>
</ul>
<p>Connect the Kindle to your computer and copy the file into its <strong>documents</strong> folder.</p>
<p>Note that Send to Kindle no longer accepts MOBI files, so use AZW3 or EPUB for new books.</p>`],
      ['Option 3: PDF', `<p><a href="/epub-to-pdf">EPUB to PDF</a> works on any device, but PDF pages do not reflow, so text can be small on a Kindle screen. Use it mainly for printing.</p>`],
      ['Why some books will not convert', `<p>Books bought from stores such as Kobo, Google Play or Apple Books are usually protected with <strong>DRM</strong>. DRM-protected books cannot be converted. DRM-free books, such as those from Project Gutenberg, Standard Ebooks and many independent authors, convert without problems.</p>`],
    ],
    faq: [
      ['Can Kindle read EPUB files?', 'Not when copied directly, but Send to Kindle accepts EPUB and converts it for you. You can also convert EPUB to AZW3 and copy it over USB.'],
      ['AZW3 or MOBI for Kindle?', 'AZW3 for any Kindle from the last ten years: it supports better formatting. MOBI only for very old models.'],
      ['Why does my EPUB not convert?', 'It is most likely DRM-protected, which prevents conversion.'],
    ],
  },
];
