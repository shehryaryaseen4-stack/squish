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
      ['Transparency is kept', `<p>WebP supports transparent and semi-transparent pixels, so logos and cut-out product photos keep their transparent background and can sit on any color, just like the PNG.</p>`],
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
<li>Scan in grayscale instead of color when color is not needed.</li>
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
      ['Can I convert a scanned PDF to editable Word?', 'Yes. Choose OCR when you convert: the text is read from the page and becomes editable in Word, in the same place, while the design, colors and pictures stay as they were. It is free.'],
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
      ['3. Compress by a sensible amount', `<p>Each compressor has a <strong>Reduce size by</strong> setting under <strong>Options</strong> (50 percent by default). It finds the best quality that reaches that size, and only shrinks the pixel dimensions when quality alone is not enough.</p>
<ul>
<li><a href="/compress-jpg">Compress JPG</a>: 50 to 70 percent smaller is usually invisible on photos straight from a camera.</li>
<li><a href="/compress-png">Compress PNG</a>: reduces the number of colors; 30 to 60 percent keeps graphics clean.</li>
<li><a href="/compress-webp">Compress WebP</a>: 30 to 50 percent, since WebP is already efficient.</li>
</ul>
<p>The list shows the original and the new size of every file. All compressors handle many files at once and give you a ZIP. Camera data such as GPS location is removed too, which also saves a few kilobytes.</p>`],
      ['4. Check the result', `<p>Open the original and the compressed image side by side at 100 percent zoom. If you cannot see a difference, compress a little more; if you can, choose a smaller reduction. After uploading, test your page with a speed test such as PageSpeed Insights.</p>`],
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
<li>Use a <strong>square</strong> image, at least 256 by 256 pixels. Images that are not square are cropped from the center.</li>
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
<p>Videos recorded in HDR (shown as HDR or Dolby Vision on the iPhone) are converted to standard video, and their colors can look a little flatter. To avoid this for new recordings, turn off <strong>HDR Video</strong> in <strong>Settings, Camera, Record Video</strong>.</p>`],
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
  {
    slug: 'convert-jpg-images-to-one-pdf',
    title: 'How to Convert JPG Images into One PDF (Free)',
    h1: 'How to convert JPG images into one PDF',
    desc: 'Put several JPG photos or scans into a single PDF, in the right order, small enough to email or upload. Step by step, free, with tips for documents and receipts.',
    date: '2026-10-31',
    tools: ['/jpg-to-pdf', '/merge-pdf', '/compress-jpg'],
    intro: 'Application forms, landlords and accountants often ask for "one PDF", while your phone gives you a pile of photos. Here is how to turn them into a single tidy PDF in a couple of minutes.',
    sections: [
      ['Step by step', `<ol>
<li>Open <a href="/jpg-to-pdf">JPG to PDF</a> and drop in all the photos at once, or click <strong>Select File</strong> and pick them together.</li>
<li>Check the list: the PDF follows its order. Remove a photo with the &times; button, and add more with <strong>Add more files</strong>.</li>
<li>Click <strong>Convert</strong>, then <strong>Download all</strong> and choose <strong>One PDF</strong>. Each photo becomes one page.</li>
</ol>
<p>Prefer separate files? Choose the other option and every photo becomes its own PDF, downloaded together in a ZIP.</p>`],
      ['Get the order right', `<p>Name your photos in order before you start (01, 02, 03...) or add them one at a time in the order you want. If you already have several PDFs, put them in any order you like with <a href="/merge-pdf">Merge PDF</a>, which lets you drag files up and down.</p>`],
      ['Keep the PDF small', `<p>A single phone photo can be 3 to 5 MB, so ten of them make a PDF that is too big for most upload forms. Shrink the photos first with <a href="/compress-jpg">Compress JPG</a>: choose how much smaller each one should be and set <strong>Resize</strong> to Max 1920px. A page of text photographed at that size is still easy to read and usually well under 500 KB.</p>`],
      ['Tips for documents and receipts', `<ul>
<li>Photograph pages flat, straight on and in daylight, without flash.</li>
<li>Crop away the table or floor around the page with <a href="/crop-image">Crop Image</a>; you can crop many photos at once.</li>
<li>Turn sideways photos upright before converting. Phone photos are turned upright automatically when the camera recorded which way up they were.</li>
<li>If the text must be searchable, run the finished PDF through <a href="/ocr-pdf">OCR PDF</a>.</li>
</ul>`],
    ],
    faq: [
      ['Can I put several JPGs into one PDF?', 'Yes. Add them all in JPG to PDF, convert, then choose One PDF when you download. Each photo becomes a page, in the order of the list.'],
      ['Does the PDF lose quality?', 'The photos are placed in the PDF as they are. To make the PDF smaller, compress the photos first.'],
      ['Can I add PNG or HEIC photos too?', 'Yes: use Image to PDF, which takes PNG, HEIC, WebP and other formats as well.'],
    ],
  },

  {
    slug: 'merge-pdf-files',
    title: 'How to Merge PDF Files into One (Free, No Upload)',
    h1: 'How to merge PDF files into one',
    desc: 'Combine several PDFs into a single file in the order you want, free and without uploading them: step by step, plus how to reorder, remove and split pages.',
    date: '2026-10-31',
    tools: ['/merge-pdf', '/split-pdf', '/organize-pdf'],
    intro: 'A job application with a CV, cover letter and certificates; a month of bank statements; scanned pages that came out as separate files. One PDF is easier to send, upload and print. Here is how to make it.',
    sections: [
      ['Step by step', `<ol>
<li>Open <a href="/merge-pdf">Merge PDF</a> and select your PDFs, or drop them into the box. Hold Ctrl (Cmd on a Mac) to pick several at once.</li>
<li>Drag the files into the order you want, or use the arrows. The first file comes first in the merged PDF.</li>
<li>Click <strong>Merge PDF</strong>. The combined file downloads straight away.</li>
</ol>`],
      ['Your files stay on your device', `<p>Merging happens in your browser with open-source code, so the PDFs are never uploaded. That makes it quick even on a slow connection, and suitable for documents you would rather not send anywhere.</p>`],
      ['Change single pages after merging', `<ul>
<li>Move, rotate or delete individual pages with <a href="/organize-pdf">Organize PDF</a>.</li>
<li>Take some pages out into a new file with <a href="/split-pdf">Split PDF</a>.</li>
<li>If the merged file is too big to email, make it smaller with <a href="/compress-pdf">Compress PDF</a>.</li>
</ul>`],
      ['When merging does not work', `<p>A PDF protected with a password must be unlocked first with <a href="/unlock-pdf">Unlock PDF</a> (you need the password). Damaged PDFs can often be fixed with <a href="/repair-pdf">Repair PDF</a> and merged afterwards.</p>`],
    ],
    faq: [
      ['How many PDFs can I merge?', 'As many as you like, each up to the size limit shown. Very large sets depend on the memory of your device.'],
      ['Are my PDFs uploaded?', 'No. They are merged in your browser and never leave your device.'],
      ['Can I merge PDFs on my phone?', 'Yes, in any current mobile browser. Use the arrows to change the order.'],
    ],
  },

  {
    slug: 'convert-excel-to-pdf',
    title: 'How to Convert Excel to PDF and Fit It on One Page',
    h1: 'How to convert Excel spreadsheets to PDF',
    desc: 'Convert an Excel spreadsheet to PDF that prints and reads well: fit columns on one page, choose landscape, set the print area and avoid empty or cut-off pages.',
    date: '2026-10-31',
    tools: ['/excel-to-pdf', '/word-to-pdf'],
    intro: 'A spreadsheet that looks fine on screen can turn into a PDF with columns spilling onto extra pages. Almost always the fix is in the page setup, made once before converting.',
    sections: [
      ['Step by step', `<ol>
<li>Open the spreadsheet in Excel, LibreOffice or Google Sheets and set the page up as described below. Save it as XLSX.</li>
<li>Open <a href="/excel-to-pdf">Excel to PDF</a> and drop the file in.</li>
<li>Click <strong>Convert</strong> and download the PDF.</li>
</ol>
<p>The converter uses the print settings saved in the file: print area, orientation, scaling and margins.</p>`],
      ['Fit all columns on one page', `<p>In Excel: <strong>Page Layout &rarr; Width: 1 page, Height: Automatic</strong>. In LibreOffice Calc: <strong>Format &rarr; Page Style &rarr; Sheet &rarr; Fit width to 1 page</strong>. The sheet is scaled down so every column fits across, and long tables continue onto the next page.</p>
<p>Wide tables read better in <strong>landscape</strong>: Page Layout &rarr; Orientation &rarr; Landscape.</p>`],
      ['Print only what you need', `<p>Select the cells to include and choose <strong>Page Layout &rarr; Print Area &rarr; Set Print Area</strong>. Empty rows and columns outside it, which often cause blank pages, are then left out.</p>`],
      ['Several sheets', `<p>Every visible sheet is included in the PDF, one after the other. Hide the sheets you do not want before saving, or move them into a separate file.</p>`],
      ['Make it easy to read', `<ul>
<li>Repeat the header row on every page: Page Layout &rarr; Print Titles &rarr; Rows to repeat at top.</li>
<li>Turn on gridlines for printing if the table has no borders.</li>
<li>Use a common font such as Calibri or Arial; it is replaced by a metric-compatible one if missing, so columns keep their width.</li>
</ul>`],
    ],
    faq: [
      ['Why does my Excel PDF have extra pages?', 'Columns that do not fit across one page continue on another. Set the page to 1 page wide, or use landscape, then convert again.'],
      ['Can I convert only one sheet?', 'Hide the other sheets before saving, or copy the sheet into a new workbook.'],
      ['Are formulas kept in the PDF?', 'A PDF shows the calculated values, not the formulas. Keep the XLSX for editing.'],
    ],
  },

  {
    slug: 'why-pdf-looks-different-after-conversion',
    title: 'Why Does a PDF Look Different After Conversion?',
    h1: 'Why does a PDF look different after conversion?',
    desc: 'Fonts, line breaks, tables or pictures moved after converting a PDF to Word or Word to PDF? The real reasons and how to get a result that looks like the original.',
    date: '2026-10-31',
    tools: ['/pdf-to-word', '/word-to-pdf', '/ocr-pdf'],
    intro: 'A PDF records where every letter sits on the page. A Word document records paragraphs that flow. Converting between the two means translating one model into the other, and a few things can shift on the way. Knowing why makes them easy to fix.',
    sections: [
      ['1. A font is missing', `<p>When a PDF uses a font that cannot be included in the new file, a similar common font is used instead. Letters then have slightly different widths, so a line can break earlier or later. Our <a href="/pdf-to-word">PDF to Word</a> converter embeds the PDF's fonts in the Word file when it is allowed to and tells you when a font had to be replaced.</p>
<p><strong>Fix:</strong> install the original font on your computer, or change the text to a common font.</p>`],
      ['2. The PDF is a scan', `<p>A scanned PDF is a picture of each page with no text inside, so there is nothing to edit. Choose <strong>OCR</strong> when converting, or make the PDF searchable first with <a href="/ocr-pdf">OCR PDF</a>. Recognized text is very good on clean scans and weaker on photos taken at an angle or in poor light.</p>`],
      ['3. Columns, text boxes and designed layouts', `<p>Resumes, brochures and magazines place text in columns and boxes. A good converter reads them in the order a person would and rebuilds columns as columns, but very complex designs can still need small adjustments in Word.</p>`],
      ['4. Tables without lines', `<p>Ruled tables (with visible borders) become real Word tables. Tables made only of aligned text have no lines to detect, so they come out as text with tab stops.</p>`],
      ['5. Word to PDF: the document changed before it became a PDF', `<p>If a Word file looks different as a PDF, it usually also looks different on another computer: a font is missing there too, or the document uses "track changes" or comments. Accept the changes and use common fonts, then convert again with <a href="/word-to-pdf">Word to PDF</a>.</p>`],
      ['Checklist for the best result', `<ul>
<li>Start from the original PDF, not a printed and scanned copy.</li>
<li>Use OCR only for scanned pages.</li>
<li>Check unusual fonts after converting.</li>
<li>For a copy that only needs to look right, keep the PDF; convert to Word only to edit.</li>
</ul>`],
    ],
    faq: [
      ['Why did my fonts change in Word?', 'The font could not be embedded or is not installed on your computer, so a similar font is shown. Install the font or pick a common one.'],
      ['Why can I not edit the text of my PDF?', 'It is probably a scan: a picture with no text. Convert it with OCR.'],
      ['Is converting PDF to Word ever exact?', 'For normal documents it is very close. Complex designs may need small adjustments, because PDF and Word store layout differently.'],
    ],
  },

  {
    slug: 'file-format-vs-codec',
    title: 'File Format vs Codec: What Is the Difference?',
    h1: 'What is the difference between a file format and a codec?',
    desc: 'MP4, MKV and MOV are containers; H.264, HEVC, VP9 and AAC are codecs. What each means, why a video will not play, and which combination works everywhere.',
    date: '2026-10-31',
    tools: ['/mov-to-mp4', '/mkv-to-mp4', '/mp4-to-mp3'],
    intro: 'Two videos can both end in .mp4 and still behave differently: one plays on your TV, the other does not. The file extension names the container; what decides whether a device can play it is the codec inside.',
    sections: [
      ['The container (file format)', `<p>MP4, MOV, MKV, WebM and AVI are <strong>containers</strong>: boxes that hold a video stream, one or more audio streams, subtitles and information such as the length and title. The container decides which streams can go in it and how they are stored together, which is why the file extension is the container's name.</p>`],
      ['The codec', `<p>A <strong>codec</strong> is the method used to compress the picture or the sound. Common video codecs are H.264 (also called AVC), H.265 (HEVC), VP9 and AV1. Common audio codecs are AAC, MP3 and Opus. A device must know the codec to play the file, whatever the container is.</p>`],
      ['Why a video will not play', `<ul>
<li><strong>The codec is not supported:</strong> iPhones record in HEVC, which some Windows PCs and older TVs cannot decode.</li>
<li><strong>The container is not supported:</strong> many phones and TVs do not open MKV, even when the codec inside is fine.</li>
<li><strong>The audio is the problem:</strong> picture but no sound often means an audio codec the player lacks.</li>
</ul>`],
      ['The combination that plays everywhere', `<p><strong>MP4 with H.264 video and AAC audio</strong> works on practically every phone, computer, browser, smart TV and editing program. That is what our converters make: <a href="/mov-to-mp4">MOV to MP4</a> and <a href="/mkv-to-mp4">MKV to MP4</a> re-encode the video to H.264 and the sound to AAC.</p>
<p>For websites, WebM with VP9 and Opus is a good, smaller alternative. For audio only, convert to MP3 or M4A, for example with <a href="/mp4-to-mp3">MP4 to MP3</a>.</p>`],
      ['Does converting lose quality?', `<p>Re-encoding with a lossy codec always discards a little detail. The settings used here keep the picture visually the same for normal viewing. Converting to a "better" codec cannot add back detail the original did not have.</p>`],
    ],
    faq: [
      ['Is MP4 a codec?', 'No. MP4 is a container. The video inside is usually H.264 or H.265 and the audio AAC.'],
      ['Why does my MKV not play on my TV?', 'Many TVs do not open the MKV container. Convert it to MP4 with H.264 and AAC.'],
      ['What is the best video format?', 'For sharing, MP4 with H.264 and AAC. For the smallest files on the web, WebM with VP9 or AV1.'],
    ],
  },

  {
    slug: 'best-image-format-for-website',
    title: 'Best Image Format for a Website: A Practical Guide',
    h1: 'How to choose the right image format for a website',
    desc: 'Which image format to use on a website for photos, logos, icons and animations: WebP, AVIF, JPG, PNG or SVG, the right pixel size, and a quick checklist.',
    date: '2026-10-31',
    tools: ['/jpg-to-webp', '/png-to-webp', '/image-resizer'],
    intro: 'Images are usually the heaviest part of a web page, and the format you choose decides how fast it loads. The rule of thumb is simple: pick the format by what the image shows, then make it no bigger than the size it is displayed at.',
    sections: [
      ['Choose by what the image shows', `<table><thead><tr><th>Image</th><th>Best format</th><th>Why</th></tr></thead><tbody>
<tr><td>Photos</td><td>WebP or AVIF (JPG as fallback)</td><td>25 to 50 percent smaller than JPG at the same look</td></tr>
<tr><td>Logos and icons</td><td>SVG</td><td>Sharp on every screen, often a few KB</td></tr>
<tr><td>Screenshots, graphics with text</td><td>WebP at high quality, or PNG</td><td>Keeps sharp edges and small letters</td></tr>
<tr><td>Anything with transparency</td><td>WebP or PNG</td><td>Both keep transparent backgrounds</td></tr>
<tr><td>Short animations</td><td>MP4 or WebM video instead of GIF</td><td>Often ten times smaller than a GIF</td></tr>
</tbody></table>
<p>For a detailed comparison of the three common formats, see <a href="/guides/jpg-vs-png-vs-webp">JPG vs PNG vs WebP</a>.</p>`],
      ['Size matters more than format', `<p>A 4000 pixel photo shown 800 pixels wide wastes most of its bytes in any format. Resize images to about the largest size they appear at, or twice that for sharp phone screens: 1600 to 1920 pixels for full-width images, 800 to 1200 for images in an article. Use the <a href="/image-resizer">Image Resizer</a> or the Resize option of any converter.</p>`],
      ['Converting your existing images', `<ul>
<li>Photos: <a href="/jpg-to-webp">JPG to WebP</a> at Quality 75.</li>
<li>Graphics and screenshots: <a href="/png-to-webp">PNG to WebP</a> at Quality 85 or more; transparency is kept.</li>
<li>Keep your original files as masters and always convert from them, not from an earlier compressed copy.</li>
</ul>`],
      ['Quick checklist', `<ul>
<li>Right format for the content (table above).</li>
<li>No wider than needed.</li>
<li>Descriptive alt text on every meaningful image.</li>
<li>Width and height set in the HTML, so the page does not jump while images load.</li>
<li>Images below the first screen loaded lazily (<code>loading="lazy"</code>).</li>
</ul>`],
    ],
    faq: [
      ['Is WebP supported by all browsers?', 'Yes, every current browser supports WebP. AVIF is supported by current Chrome, Edge, Firefox and Safari.'],
      ['Should I still use JPG?', 'JPG is fine and universally supported, but WebP or AVIF make the same photo noticeably smaller, which speeds up the page.'],
      ['What size should website images be?', 'About the largest size they are shown at, or up to twice that for sharp phone screens: commonly 1600 to 1920 pixels wide for full-width images.'],
    ],
  },

  {
    slug: 'resize-image-to-kb',
    title: 'How to Resize an Image to 50 KB, 100 KB or Any Size',
    h1: 'How to resize an image to a specific size in KB',
    desc: 'Make a photo, signature or scan smaller than an upload limit such as 20 KB, 50 KB or 100 KB for online forms and job portals, without making it unreadable.',
    date: '2026-10-31',
    tools: ['/image-resizer', '/resize-image-to-50kb', '/compress-jpg'],
    intro: 'Online applications, exam forms and job portals often accept photos only below a size such as 50 KB, and signatures below 20 KB. Here is how to hit the limit and keep the picture clear.',
    sections: [
      ['Step by step', `<ol>
<li>Open the <a href="/image-resizer">Image Resizer</a> and choose your photo.</li>
<li>Under <strong>Resize by</strong>, choose <strong>File size (KB)</strong> and enter the limit, for example 50, or click one of the ready sizes.</li>
<li>Download the result. The size is shown before you save, so you can check it is under the limit.</li>
</ol>
<p>For the most common limit there is a ready-made page: <a href="/resize-image-to-50kb">resize image to 50 KB</a>. The photo never leaves your device.</p>`],
      ['How it gets under the limit', `<p>The resizer first lowers the JPG quality step by step, which removes detail the eye barely notices. If that is not enough, it also reduces the width and height until the file fits. Photos stay recognizable well below 50 KB at passport-photo sizes.</p>`],
      ['When the form also asks for pixels', `<p>Some forms want both, for example 200 &times; 230 pixels and under 50 KB. Resize by <strong>Width and height</strong> first and download, then open that file again and resize it by <strong>File size (KB)</strong>. To change the shape of the photo, crop it first with <a href="/crop-image">Crop Image</a>; for official photo sizes use the <a href="/passport-photo-maker">Passport Photo Maker</a>.</p>`],
      ['Tips', `<ul>
<li>Start from the original photo, not a screenshot of it.</li>
<li>Crop away the background: fewer pixels means more detail in the same KB.</li>
<li>Signatures: scan or photograph on white paper, crop tightly and save as JPG.</li>
<li>Several photos? <a href="/compress-jpg">Compress JPG</a> makes a whole batch smaller by a chosen percentage.</li>
</ul>`],
    ],
    faq: [
      ['How do I reduce a photo to 50 KB?', 'Open the Image Resizer, choose File size (KB), enter 50 and download. The result is under 50 KB.'],
      ['Will my photo become blurry?', 'Slightly less sharp at very small sizes, but faces and text stay clear at the sizes forms usually ask for.'],
      ['Is my photo uploaded?', 'No. It is resized in your browser.'],
    ],
  },

  {
    slug: 'uk-passport-photo-size',
    title: 'UK Passport Photo Size and Rules: Make One at Home',
    h1: 'UK passport photo size and how to make one at home',
    desc: 'UK passport photo size (35 x 45 mm), head size, the digital photo for online applications, the main rules, and how to make a printed or digital photo at home.',
    date: '2026-10-31',
    tools: ['/uk-passport-photo', '/passport-photo-maker', '/crop-image'],
    intro: 'A UK passport photo is 35 mm wide and 45 mm high, the same size as most European passport and visa photos. You can take it at home with a phone and make both the digital version for an online application and a printable sheet.',
    sections: [
      ['The size', `<ul>
<li><strong>Printed photo:</strong> 35 mm wide by 45 mm high.</li>
<li><strong>Head:</strong> from the chin to the top of the head, between 29 mm and 34 mm.</li>
<li><strong>Digital photo for online applications:</strong> at least 600 pixels wide and 750 pixels tall. The Passport Photo Maker makes it 700 by 900 pixels.</li>
</ul>`],
      ['The main rules', `<ul>
<li>A plain, light-coloured background with no pattern, objects or shadows.</li>
<li>Face the camera with a neutral expression, mouth closed and eyes open and visible.</li>
<li>Even light, with no shadows on your face or behind you, and no red eye.</li>
<li>Nothing covering your face; head coverings only for religious or medical reasons.</li>
<li>A recent photo, in focus, in colour and not edited.</li>
</ul>
<p>Rules change from time to time, so check the current requirements on GOV.UK before you apply.</p>`],
      ['Make it at home', `<ol>
<li>Stand in front of a plain light wall, facing a window, and ask someone to take the photo from about 1.5 metres at eye level.</li>
<li>Open the <a href="/uk-passport-photo">UK Passport Photo maker</a>, where United Kingdom is already chosen.</li>
<li>Move and zoom the photo until your chin and the top of your head sit on the guide lines.</li>
<li>Download the <strong>digital photo</strong> for an online application, or the <strong>4x6 inch (6x4) sheet</strong> to print at a shop or photo kiosk, then cut along the lines.</li>
</ol>
<p>The photo is cropped in your browser and never uploaded.</p>`],
      ['Common reasons photos are rejected', `<ul>
<li>Shadows behind the head or on one side of the face.</li>
<li>Head too small or too big in the frame.</li>
<li>Glare on glasses, or hair covering the eyes.</li>
<li>Photo taken at arm's length, which distorts the face.</li>
</ul>`],
    ],
    faq: [
      ['What size is a UK passport photo?', '35 mm wide by 45 mm high, with the head 29 to 34 mm from chin to crown.'],
      ['What size is the digital UK passport photo?', 'At least 600 pixels wide and 750 pixels tall. The Passport Photo Maker produces 700 by 900 pixels.'],
      ['Can I print a UK passport photo at home?', 'Print the 6x4 inch sheet on photo paper at a shop or kiosk for the best result; the sheet holds several photos to cut out.'],
    ],
  },
  // ---------------------------------------------------------------- United States --
  {
    slug: 'us-passport-photo-size',
    title: 'US Passport Photo Size (2x2) and Rules: Make One at Home',
    h1: 'US passport photo size and how to make one at home',
    desc: 'US passport photo size (2 x 2 inches), head size, the 600 x 600 digital photo, the rules on glasses and background, and how to make and print one at home.',
    date: '2026-11-01',
    tools: ['/us-passport-photo', '/passport-photo-maker', '/crop-image'],
    intro: 'A US passport photo is 2 inches by 2 inches, square, with your head taking up about half of it. You can take it at home with a phone, then make a digital photo for an online renewal and a 4x6 sheet to print at a drugstore for well under the price of a photo studio.',
    sections: [
      ['The size', `<ul>
<li><strong>Printed photo:</strong> 2 x 2 inches (51 x 51 mm).</li>
<li><strong>Head:</strong> 1 to 1 3/8 inches (25 to 35 mm) from the bottom of the chin to the top of the head.</li>
<li><strong>Digital photo:</strong> square, at least 600 x 600 pixels. The US Passport Photo maker makes it 600 x 600.</li>
</ul>`],
      ['The main rules', `<ul>
<li>A plain white or off-white background, with no shadows, pattern or objects.</li>
<li>No glasses. They are allowed only if you cannot remove them for medical reasons, with a signed note from your doctor.</li>
<li>Face the camera with both eyes open and a neutral expression or a natural smile.</li>
<li>Taken in the last 6 months, in color, in focus, and not edited or filtered.</li>
<li>No hats or head coverings, except for religious or medical reasons with a signed statement.</li>
</ul>
<p>Rules change from time to time, so check the current requirements on travel.state.gov before you apply.</p>`],
      ['Make it at home', `<ol>
<li>Stand in front of a plain white wall, facing a window, and ask someone to take the photo from about 4 feet away at eye level. Take your glasses off.</li>
<li>Open the <a href="/us-passport-photo">US Passport Photo maker</a>, where United States is already chosen.</li>
<li>Move and zoom the photo until your chin and the top of your head sit on the guide lines.</li>
<li>Download the <strong>digital photo</strong> for an online application, or the <strong>4x6 inch sheet</strong>.</li>
<li>Order the sheet as a normal 4x6 print at CVS, Walgreens, Walmart or another photo counter, then cut out the 2x2 photos along the lines.</li>
</ol>
<p>The photo is cropped in your browser and never uploaded.</p>`],
      ['Common reasons photos are rejected', `<ul>
<li>Shadows on the face or on the wall behind the head.</li>
<li>Glasses, or glare that hides the eyes.</li>
<li>Head too small or too big in the frame.</li>
<li>A selfie taken at arm's length, which distorts the face.</li>
<li>A gray or colored background instead of white or off-white.</li>
</ul>`],
    ],
    faq: [
      ['What size is a US passport photo?', '2 x 2 inches (51 x 51 mm), with the head 1 to 1 3/8 inches from chin to the top of the head.'],
      ['What size is a digital US passport photo?', 'A square photo of at least 600 x 600 pixels. The US Passport Photo maker makes a 600 x 600 pixel JPG.'],
      ['Can I smile in a US passport photo?', 'A natural smile is fine, as long as both eyes are open. A wide grin or a funny face can get the photo rejected.'],
      ['Can I print a passport photo at home?', 'It is best to order the 4x6 sheet as a normal photo print at a drugstore or photo counter: it is cheap and printed on proper photo paper. Then cut out the 2x2 photos.'],
    ],
  },
  {
    slug: 'reduce-pdf-size-for-uscis',
    title: 'Reduce PDF Size for USCIS Online Filing (12MB Limit)',
    h1: 'How to make your files fit USCIS online filing',
    desc: 'USCIS online filing takes PDF, JPG or JPEG files up to 12MB each. How to shrink big PDFs, turn phone photos into PDF, split long files and remove passwords.',
    date: '2026-11-01',
    tools: ['/compress-pdf', '/jpg-to-pdf', '/heic-to-pdf', '/split-pdf', '/unlock-pdf'],
    intro: 'When you file a form online with USCIS, every piece of evidence you upload has to be a PDF, JPG or JPEG file of 12MB or less. Scans from a phone or a copier often go over that limit. Here is how to get each file under it without making the pages hard to read.',
    sections: [
      ['What USCIS accepts', `<ul>
<li><strong>File types:</strong> PDF, JPG or JPEG. Some forms also accept TIF or TIFF.</li>
<li><strong>Size:</strong> no larger than 12MB per file.</li>
<li><strong>No passwords:</strong> files must not be encrypted or password-protected.</li>
<li><strong>File names:</strong> keep them simple: English letters, numbers, spaces, hyphens, underscores and periods.</li>
</ul>
<p>These limits come from USCIS's online filing pages and can change, so always follow what the upload screen for your form says.</p>`],
      ['A PDF is over 12MB', `<p>Large PDFs are almost always scans: each page is a big photo. Open <a href="/compress-pdf">Compress PDF</a> and choose <strong>Recommended</strong>. That keeps text sharp enough to read and usually cuts scanned files by more than half. If the file is still too big, try <strong>Strong</strong>, then open the result and zoom in to check that names, dates and numbers are still clear.</p>`],
      ['A very long document', `<p>If one document is too large even after compressing, split it. Use <a href="/split-pdf">Split PDF</a> to save it in parts (for example pages 1 to 20 and 21 to 40) and upload each part, with names like <em>tax-return-part-1.pdf</em> and <em>tax-return-part-2.pdf</em>.</p>`],
      ['Photos of documents from a phone', `<p>iPhone photos are often HEIC files, which USCIS does not take. Turn them into one PDF with <a href="/heic-to-pdf">HEIC to PDF</a>, or use <a href="/jpg-to-pdf">JPG to PDF</a> for JPG photos. Put the pages of one document in a single PDF in the right order, rather than uploading each page as a separate photo.</p>`],
      ['A PDF with a password', `<p>Bank statements and pay stubs downloaded from a website sometimes open with a password. If you know the password, <a href="/unlock-pdf">Unlock PDF</a> saves a copy without it, which you can then upload.</p>`],
      ['Before you upload', `<ul>
<li>Open every file and check that each page is readable, upright and complete.</li>
<li>Translate documents that are not in English, as USCIS requires a certified English translation.</li>
<li>Keep the original, full-quality files in case you are asked for them later.</li>
</ul>`],
    ],
    faq: [
      ['What is the file size limit for USCIS online filing?', 'USCIS says each uploaded file must be no larger than 12MB, in PDF, JPG or JPEG format (some forms also take TIF or TIFF). Check the upload screen for your form, as limits can change.'],
      ['Will compressing a PDF make it unreadable?', 'Not with the Recommended setting, which is made for documents. Always open the compressed file and zoom in to check small print before uploading.'],
      ['Are my immigration documents kept on your server?', 'No. Files are used only to make the result and are deleted as soon as it is finished. Merge, Split and Organize PDF run in your browser and do not upload the file at all.'],
    ],
  },
  {
    slug: 'upload-documents-to-irs',
    title: 'IRS Document Upload Tool: File Types, Size Limit and Fixes',
    h1: 'How to get your files ready for the IRS Document Upload Tool',
    desc: 'The IRS Document Upload Tool takes JPEG, PNG or PDF files up to 15MB, and PDFs up to 120 pages. How to convert phone photos and shrink or split big files.',
    date: '2026-11-01',
    tools: ['/heic-to-jpg', '/jpg-to-pdf', '/compress-pdf', '/split-pdf', '/merge-pdf'],
    intro: 'If an IRS notice or letter asks you to send documents, the IRS Document Upload Tool lets you send them online. It is picky about file types and sizes, so a phone photo or a long scanned PDF may be refused. Here is how to fix that.',
    sections: [
      ['What the tool accepts', `<ul>
<li><strong>File types:</strong> JPEG, PNG or PDF.</li>
<li><strong>Size:</strong> up to 15MB per file.</li>
<li><strong>PDF length:</strong> up to 120 pages per PDF.</li>
</ul>
<p>The tool is for answering an IRS notice or letter; tax returns are not sent through it. Check the IRS page for the current rules before you upload.</p>`],
      ['iPhone photos (HEIC)', `<p>iPhones save photos as HEIC by default, which the tool does not accept. Convert them with <a href="/heic-to-jpg">HEIC to JPG</a>, or put several pages into one file with <a href="/jpg-to-pdf">JPG to PDF</a>.</p>`],
      ['A file over 15MB', `<p>Use <a href="/compress-pdf">Compress PDF</a> with <strong>Recommended</strong>; scanned statements and receipts usually shrink a lot and stay readable. For a large photo, <a href="/compress-jpg">Compress JPG</a> does the same.</p>`],
      ['A PDF over 120 pages', `<p>Split it with <a href="/split-pdf">Split PDF</a> into parts of 120 pages or fewer and upload each part.</p>`],
      ['Many receipts', `<p>Rather than uploading dozens of separate photos, combine them into one tidy PDF with <a href="/jpg-to-pdf">JPG to PDF</a> or <a href="/merge-pdf">Merge PDF</a>, in the order the letter asks for.</p>`],
    ],
    faq: [
      ['What file types does the IRS Document Upload Tool accept?', 'JPEG, PNG and PDF, up to 15MB per file, with PDFs up to 120 pages each, according to the IRS.'],
      ['Can I upload iPhone photos to the IRS?', 'Not as HEIC files. Convert them to JPG or PDF first; HEIC to JPG does this for free.'],
      ['Can I file my tax return with the Document Upload Tool?', 'No. The IRS says the tool is for responding to a notice or letter, not for sending tax returns.'],
    ],
  },
  {
    slug: 'college-application-documents',
    title: 'Upload Documents for College Applications: PDF Tips',
    h1: 'How to prepare documents for college applications',
    desc: 'Get transcripts, essays, portfolios and recommendation files ready for the Common App and college portals: convert to PDF, combine scans and fit upload limits.',
    date: '2026-11-01',
    tools: ['/docx-to-pdf', '/jpg-to-pdf', '/merge-pdf', '/compress-pdf'],
    intro: 'College portals, including the Common App and each school\'s own applicant portal, usually want PDF files under a size limit, and the limit is not the same everywhere. A few minutes of preparation means your transcript or essay uploads first time and looks the way you meant.',
    sections: [
      ['Save documents as PDF', `<p>A PDF looks the same on every computer, so the admissions reader sees exactly your layout and fonts. Turn a Word essay or resume into PDF with <a href="/docx-to-pdf">Word to PDF</a>. Google Docs users can download as PDF directly.</p>`],
      ['Scanned transcripts and certificates', `<p>Photos of paper documents from a phone can be combined into one PDF with <a href="/jpg-to-pdf">JPG to PDF</a> (or <a href="/heic-to-pdf">HEIC to PDF</a> for iPhone photos). Take each photo straight on, in good light, with the whole page in the frame.</p>`],
      ['One file instead of many', `<p>Many upload fields take a single file. Combine a multi-page transcript, or several certificates, with <a href="/merge-pdf">Merge PDF</a>, and put them in a sensible order.</p>`],
      ['Fit the upload limit', `<p>Check the limit shown next to the upload button, as it differs between portals and fields. If your file is too big, <a href="/compress-pdf">Compress PDF</a> with <strong>Recommended</strong> usually fixes it without making text blurry.</p>`],
      ['Name files clearly', `<p>Use names like <em>Lastname-Firstname-Transcript.pdf</em>. It helps you keep track, and some portals show the file name to the people reading your application.</p>`],
    ],
    faq: [
      ['What file format should I use for college applications?', 'PDF is the safest choice: it keeps your layout and is accepted almost everywhere. Use the format the portal asks for if it says otherwise.'],
      ['What is the Common App file size limit?', 'Look at the upload field itself, which shows the limit; some colleges set their own limits in their supplements. If a file is too large, compress it.'],
      ['Will compressing my essay PDF change how it looks?', 'Text-only PDFs are already small and barely change. Compression mainly shrinks scans and photos.'],
    ],
  },
  {
    slug: 'convert-iphone-photos-for-printing',
    title: 'Convert iPhone HEIC Photos to JPG for Printing and Uploads',
    h1: 'How to convert iPhone photos (HEIC) to JPG for printing and uploads',
    desc: 'Photo printing sites, school portals and job applications often refuse iPhone HEIC photos. Convert HEIC to JPG or PDF for free on any computer or phone.',
    date: '2026-11-01',
    tools: ['/heic-to-jpg', '/heic-to-pdf', '/image-resizer', '/compress-jpg'],
    intro: 'iPhones save photos as HEIC to use less space. That works fine on the phone, but many websites, upload forms and Windows apps do not understand HEIC. Converting the photos to JPG, the format everything accepts, fixes it in a minute.',
    sections: [
      ['Convert HEIC to JPG', `<ol>
<li>Copy the photos to your computer, or open this site on your phone.</li>
<li>Open <a href="/heic-to-jpg">HEIC to JPG</a> and select the photos; you can add many at once.</li>
<li>Download them one by one, or all together as a ZIP.</li>
</ol>
<p>The photos are turned upright automatically, and location and camera details are removed, which is safer when sharing.</p>`],
      ['For printing', `<p>For prints, keep the JPG at full size and high quality, so a 4x6 or 5x7 print stays sharp. Most online print services and in-store kiosks accept JPG.</p>`],
      ['For an upload form with a size limit', `<p>Forms often have a size limit such as 2MB or 500KB. After converting, use the <a href="/image-resizer">Image Resizer</a> to make the photo smaller than the limit, or <a href="/compress-jpg">Compress JPG</a>.</p>`],
      ['Several photos as one document', `<p>For receipts, IDs or pages of a document, <a href="/heic-to-pdf">HEIC to PDF</a> puts all the photos into one PDF, which most forms prefer.</p>`],
      ['Stop the iPhone saving HEIC', `<p>On the iPhone go to <strong>Settings &gt; Camera &gt; Formats</strong> and choose <strong>Most Compatible</strong>. New photos are then saved as JPG, though they take more space.</p>`],
    ],
    faq: [
      ['Does converting HEIC to JPG lose quality?', 'At the default quality the difference is very hard to see. Choose a higher quality if the photos are for large prints.'],
      ['Why will a website not accept my iPhone photo?', 'It is probably a HEIC file. Convert it to JPG and upload that instead.'],
      ['Can I convert HEIC on my phone?', 'Yes. Open the HEIC to JPG page in your phone\'s browser, select the photos and download the JPGs.'],
    ],
  },
  {
    slug: 'resume-file-format-for-job-applications',
    title: 'Resume File Format for Job Applications: PDF or Word?',
    h1: 'PDF or Word: which resume format to upload to job sites',
    desc: 'Should you upload your resume as PDF or DOCX to Indeed, LinkedIn or Workday? When each works best, how to convert, and how to fix a file that is too big.',
    date: '2026-11-01',
    tools: ['/docx-to-pdf', '/pdf-to-word', '/compress-pdf', '/merge-pdf'],
    intro: 'Most job sites and company career portals accept both PDF and Word (DOCX) resumes. Which one to send depends on what the application asks for and how the resume will be read: by a person, or first by an applicant tracking system (ATS) that pulls out your details.',
    sections: [
      ['When to use PDF', `<p>A PDF looks exactly the same on every device, so your layout, fonts and spacing are kept. It is the best choice when you email a resume to a person or upload it where the format is not specified. Convert with <a href="/docx-to-pdf">Word to PDF</a>.</p>`],
      ['When to use Word (DOCX)', `<p>Send a DOCX when the posting or the recruiter asks for one: some recruiters like to add notes or reformat resumes. If you only have a PDF, <a href="/pdf-to-word">PDF to Word</a> turns it back into an editable document.</p>`],
      ['Make it easy for an ATS to read', `<ul>
<li>Use a simple layout: one column, standard headings such as Experience, Education and Skills.</li>
<li>Keep the text as real text, not a picture. A resume saved from a design app as an image cannot be read.</li>
<li>Avoid putting your contact details only in the header or a text box.</li>
</ul>`],
      ['A file that is too large', `<p>A resume with photos or a scanned page can go over a portal's size limit. <a href="/compress-pdf">Compress PDF</a> makes it smaller while keeping the text sharp.</p>`],
      ['Resume plus certificates', `<p>If an application has one upload field for everything, combine your resume, cover letter and certificates into one file with <a href="/merge-pdf">Merge PDF</a>, resume first.</p>`],
    ],
    faq: [
      ['Is PDF or Word better for a resume?', 'PDF keeps your layout exactly, so it is the safe default. Send Word (DOCX) when the job posting or recruiter asks for it.'],
      ['Can applicant tracking systems read PDFs?', 'Most can, as long as the PDF contains real text and a simple layout. A PDF made from a scan or a picture is much harder for them to read.'],
      ['How do I edit a resume I only have as a PDF?', 'Convert it with PDF to Word, make your changes, then save it as PDF again with Word to PDF.'],
    ],
  },
];
