'use strict';
// Hand-written content for the format pages (/swf-converter, /png-converter...) that Google
// Search Console shows people already finding (October 2026). pages.js adds it to formatPage:
// what the format is, how to open it, what people convert it for, its limits, extra FAQ entries
// (also in the FAQPage structured data) and links to guides.
//
// Describe only what this site's engines really do (see engines/ and registry/converters.js).
// Plain text only; pages.js escapes nothing here, so no "<".
//
// Shape: slug: { an? ("an SWF"), desc?, about: [paragraph, ..], open, uses: [..], limits?: [..], faq: [[q, a], ..], guides?: [article slug, ..] }

module.exports = {
  swf: {
    an: true,
    desc: 'Convert SWF (Shockwave Flash) files to MP4, GIF, MP3 and more, free. Watch old Flash videos again without Flash Player. No sign-up.',
    about: [
      'SWF (Shockwave Flash) was the file format of Adobe Flash. For about fifteen years it carried web animations, games, video players and banner ads. Adobe ended Flash Player at the end of 2020, and every current browser has removed it, so an SWF file you download today usually will not open anywhere.',
      'An SWF file can hold two very different things. Some SWF files are simply a video (often FLV video with MP3 sound) wrapped for Flash. Others are interactive programs written in ActionScript, such as games, menus and animations that react to clicks. This converter works with the first kind: it reads the video and sound frames and saves them as a normal MP4, GIF, MP3 or another format that plays on any phone or computer.',
    ],
    open: 'To watch an SWF without Flash Player, convert it to MP4 here and open the MP4 in any video player, browser or phone. For interactive Flash games and animations, the free Ruffle emulator (ruffle.rs) or the Flashpoint archive project can play many of them on modern computers.',
    uses: [
      'Turn an old Flash video or animated intro from a 2000s website backup into an MP4 you can watch and share.',
      'Save the soundtrack of an SWF as MP3 or WAV.',
      'Make a GIF or WebP from a short Flash animation for a blog or chat.',
      'Rescue Flash videos from old e-learning courses, CDs and school projects.',
    ],
    limits: [
      'SWF games and other interactive ActionScript content cannot be turned into a video: there is no fixed video inside them to read. Use Ruffle to play those.',
      'SWF files that draw everything as vector shapes, with no video stream inside, may convert to a blank or very short video.',
    ],
    faq: [
      ['How do I open an SWF file without Flash Player?', 'Convert it to MP4 on this page and play the MP4 in any video player or browser. For Flash games and interactive animations, use the free Ruffle emulator, which runs many SWF files on modern computers.'],
      ['Can I convert an SWF game to MP4?', 'No. A game is a program, not a video, so there is nothing fixed to convert. This converter handles SWF files that contain video and sound. To play an old Flash game, try Ruffle or the Flashpoint archive.'],
      ['How do I convert SWF to MP4?', 'Click Select File, choose your SWF, keep MP4 as the output and wait for the converted file to appear in the list. Download it with the button next to it. You can add several SWF files at once.'],
      ['Is it safe to open SWF files?', 'Flash Player had many security problems, which is one reason it was retired. Converting an SWF to MP4 here does not run the file on your computer; the video frames are read on the server and the file is deleted afterwards.'],
    ],
    guides: ['file-format-vs-codec'],
  },

  lz: {
    an: true,
    desc: 'Open and extract LZ (lzip) files online, free. Convert .lz and .tar.lz archives to ZIP so Windows and Mac can open them. No software, no sign-up.',
    about: [
      'LZ is the file extension of lzip, a lossless compression tool used mostly on Linux. It uses the LZMA method, like 7-Zip and XZ, and adds strong integrity checks, which is why some open-source projects and long-term archives prefer it. You will usually meet it as a source code download named something like project-1.2.tar.lz.',
      'Windows and macOS cannot open LZ files on their own, and many popular unzip apps do not support lzip either. Converting the file to ZIP here gives you an archive every computer can open by double-clicking it.',
    ],
    open: 'On Windows and Mac, the easiest way is to convert the LZ file to ZIP on this page and open the ZIP. On Linux, run lzip -d file.lz, or tar -xf file.tar.lz, which extracts a .tar.lz archive in one step if lzip is installed. 7-Zip on Windows can also open LZ files.',
    uses: [
      'Open a .tar.lz source code download on a Windows PC or Mac.',
      'Turn an lzip archive into ZIP before emailing it or uploading it somewhere that only accepts ZIP.',
      'Repack an LZ archive as 7Z, TAR.GZ or TAR.XZ for a different tool or server.',
    ],
    faq: [
      ['What is an LZ file?', 'An LZ file is a file compressed with lzip, a Linux compression tool based on the LZMA method. Often it is a TAR archive that holds many files and folders, named .tar.lz.'],
      ['How do I open an LZ file on Windows?', 'Convert it to ZIP on this page, then double-click the ZIP to open it in File Explorer. You can also install 7-Zip, which reads LZ files.'],
      ['Are the files inside kept the same?', 'Yes. Lzip and ZIP are both lossless, so every file and folder comes out exactly as it went in, with the same names.'],
      ['What is the difference between .lz and .tar.lz?', 'A .lz file is one compressed file. A .tar.lz file is a TAR archive, which bundles many files and folders, compressed with lzip. This converter handles both and keeps the folder structure.'],
    ],
  },

  png: {
    desc: 'Free PNG converter: convert PNG to JPG, WebP, PDF, ICO, GIF and more, or turn other images into PNG. Batch convert, download as ZIP. No sign-up.',
    about: [
      'PNG (Portable Network Graphics) is a lossless image format: saving a picture as PNG never lowers its quality, and it supports transparency. That makes it the best choice for screenshots, logos, icons, diagrams and anything with sharp text or flat colours.',
      'The trade-off is size. A photo saved as PNG is often three to ten times bigger than the same photo as JPG or WebP. So people usually convert PNG to JPG or WebP to share photos or speed up a website, and convert other images to PNG when they need transparency or lossless quality for editing.',
    ],
    open: 'Every phone, computer and browser opens PNG files: double-click it on Windows (Photos) or Mac (Preview), or tap it in your phone gallery.',
    uses: [
      'Shrink a PNG photo or screenshot to JPG before uploading it to a form, job portal or email.',
      'Convert PNG to WebP to make website images smaller and pages faster.',
      'Make a favicon (ICO) from a square PNG logo.',
      'Put several PNG scans or screenshots into one PDF.',
      'Turn JPG, WebP, HEIC or SVG images into PNG for editing or to keep transparency.',
    ],
    faq: [
      ['Should I use PNG or JPG?', 'Use PNG for screenshots, logos, text and images that need transparency. Use JPG for photos, where it gives a much smaller file with no visible difference.'],
      ['Does converting PNG to JPG remove transparency?', 'JPG has no transparency, so transparent areas are filled with white. To keep transparency in a smaller file, convert the PNG to WebP or AVIF instead.'],
      ['Will converting to PNG improve image quality?', 'No. PNG keeps the quality it is given. Converting a blurry or heavily compressed JPG to PNG makes it bigger but not sharper.'],
    ],
    guides: ['jpg-vs-png-vs-webp', 'best-image-format-for-website', 'compress-images-for-website', 'make-a-favicon'],
  },

  jpg: {
    desc: 'Free JPG converter: convert JPG to PNG, PDF, WebP, AVIF and more, or turn any image into JPG. Batch convert and download as ZIP. No sign-up.',
    about: [
      'JPG (also written JPEG) is the most used photo format in the world. It uses lossy compression: it throws away detail the eye barely notices, which keeps photos small. Every camera, phone, browser and program can open it.',
      'Because it is lossy, JPG is not ideal for screenshots, logos or text, which can show blurry edges, and it has no transparency. People convert JPG to PNG for editing and sharp graphics, to PDF for documents and forms, and to WebP or AVIF for faster websites.',
    ],
    open: 'Every device opens JPG files: double-click on Windows or Mac, or tap the photo on your phone.',
    uses: [
      'Combine several JPG photos or scans into one PDF to email or upload.',
      'Convert iPhone HEIC photos, WebP downloads or PNG screenshots to JPG so any app accepts them.',
      'Make JPG photos smaller as WebP or AVIF for a website.',
      'Convert a JPG to PNG before editing it in a design app.',
    ],
    faq: [
      ['Is JPG the same as JPEG?', 'Yes. JPG and JPEG are the same format; the three-letter .jpg ending comes from old versions of Windows that only allowed three-letter extensions.'],
      ['Does converting a JPG lose quality?', 'Converting to PNG, TIFF or PDF keeps the JPG exactly as it is. Converting to another lossy format such as WebP or AVIF compresses it again; at the default quality the difference is very hard to see.'],
    ],
    guides: ['convert-jpg-images-to-one-pdf', 'jpg-vs-png-vs-webp', 'resize-image-to-kb'],
  },

  svg: {
    an: true,
    desc: 'Free SVG converter: convert SVG to PNG, JPG, PDF, ICO and more, or turn PDF, EPS and AI files into SVG. High quality, no sign-up.',
    about: [
      'SVG (Scalable Vector Graphics) stores a picture as shapes, lines and text instead of pixels, so it stays perfectly sharp at any size. It is the standard for logos, icons and illustrations on websites, and it is written in XML text, which makes files small and editable.',
      'Not every app accepts SVG. Social networks, Word, PowerPoint, email and many upload forms want a PNG or JPG. Converting SVG to PNG draws the shapes as pixels at the size stored in the file; PDF, EPS and EMF keep the picture as vectors.',
    ],
    open: 'Any web browser opens SVG files: drag the file into Chrome, Edge, Firefox or Safari. To edit one, use Inkscape (free), Adobe Illustrator or Figma.',
    uses: [
      'Turn an SVG logo into PNG for social media, Word, PowerPoint or a print shop.',
      'Make a favicon (ICO) from an SVG icon.',
      'Convert SVG to PDF or EPS to send vector artwork for printing.',
      'Get an SVG from a PDF, EPS or AI file to use the artwork on a website.',
    ],
    limits: [
      'Converting a JPG or PNG photo into SVG (tracing) is not offered: the result would just wrap the pixels, not real vector shapes.',
    ],
    faq: [
      ['How do I convert SVG to PNG with a transparent background?', 'Choose PNG as the output. Areas without shapes in the SVG stay transparent in the PNG.'],
      ['What size will the PNG be?', 'The SVG is drawn at the width and height stored inside the file. For a bigger PNG, set a larger width in your design app before exporting the SVG.'],
      ['Can I convert a PNG or JPG to SVG?', 'Not here. Real vector conversion needs tracing, which works well only on simple logos and is best done in Inkscape (Path, Trace Bitmap) or Illustrator, where you can check the shapes.'],
    ],
    guides: ['best-image-format-for-website', 'make-a-favicon'],
  },

  doc: {
    desc: 'Free DOC converter: convert old Word .doc files to PDF, DOCX, TXT and more, or save documents as .doc. Keeps layout. No sign-up, no watermark.',
    about: [
      'DOC is the file format of Microsoft Word 97 to 2003. Word 2007 replaced it with DOCX, but millions of DOC files are still around: old letters, CVs, school work, forms and templates from government and company websites.',
      'Current versions of Word still open DOC files, but in Compatibility Mode, and many phone apps, Google Docs uploads and online forms handle them badly. Converting DOC to DOCX or PDF makes the document easy to open, edit and share. The conversion uses LibreOffice, which reads the text, tables, pictures and page layout.',
    ],
    open: 'Microsoft Word, LibreOffice Writer (free), Google Docs and Apple Pages all open DOC files. On a phone, convert the DOC to PDF to read it, or to DOCX to edit it in the Word or Google Docs app.',
    uses: [
      'Convert an old DOC CV or cover letter to PDF before applying for a job.',
      'Upgrade DOC files to DOCX to edit them in Microsoft 365 or Google Docs without Compatibility Mode.',
      'Save a DOC as PDF to print it or send it so it looks the same everywhere.',
      'Get plain text from a DOC file for a website, email or another program.',
    ],
    faq: [
      ['What is the difference between DOC and DOCX?', 'DOC is the older binary Word format (Word 97 to 2003). DOCX, used since Word 2007, is a compressed XML format: smaller, safer and better supported by modern apps.'],
      ['Will my formatting be kept?', 'Text, fonts, tables, pictures, headers and page layout are kept. Very old or unusual features such as WordArt and some fields may look slightly different; check the result before sending it.'],
      ['Can I open a DOC file without Microsoft Word?', 'Yes. Convert it to PDF here to read or print it, or open it in the free LibreOffice Writer or Google Docs.'],
    ],
    guides: ['why-pdf-looks-different-after-conversion', 'convert-word-to-pdf-on-phone'],
  },

  mobi: {
    desc: 'Free MOBI converter: convert MOBI ebooks to EPUB, PDF, TXT, AZW3 or DOCX, or make MOBI from other formats. Read old Kindle books anywhere. No sign-up.',
    about: [
      'MOBI (Mobipocket) is an older ebook format that Amazon used for Kindle for many years. Many free ebook libraries and older purchases are still MOBI files, but newer Kindles and the Send to Kindle service no longer accept MOBI, and most other readers never did.',
      'Converting MOBI to EPUB makes a book readable on Kobo, Apple Books, Google Play Books and Kindle (through Send to Kindle). PDF and TXT are useful for printing or reading on a computer. Conversions use Calibre, the free ebook manager.',
    ],
    open: 'Calibre (free, for Windows, Mac and Linux) opens and reads MOBI files. On a phone, convert the MOBI to EPUB and open it in Apple Books, Google Play Books or another EPUB reader.',
    uses: [
      'Convert a MOBI book to EPUB to send it to a Kindle with Send to Kindle, which no longer takes MOBI.',
      'Read a MOBI ebook on a Kobo, iPhone or Android phone.',
      'Turn a MOBI into PDF or TXT to print it or copy quotes.',
    ],
    limits: [
      'Books protected with DRM (copy protection) cannot be converted. Files from free libraries and books you made yourself usually have no DRM.',
    ],
    faq: [
      ['Can I send a MOBI file to my Kindle?', 'Amazon stopped accepting MOBI through Send to Kindle. Convert the book to EPUB here and send the EPUB instead; Amazon turns it into a Kindle book for you.'],
      ['How do I convert MOBI to TXT?', 'Select your MOBI file, choose TXT as the output and download the result. The text of the book is kept; pictures and formatting are left out.'],
      ['Why does my MOBI not convert?', 'The most common reason is DRM copy protection, which blocks every converter. Books without DRM convert normally.'],
    ],
    guides: ['read-epub-on-kindle'],
  },

  prc: {
    desc: 'Convert PRC ebooks (Mobipocket) to EPUB, PDF, MOBI, TXT or DOCX online, free. Read old Palm and Kindle books on any device. No sign-up.',
    about: [
      'PRC is an old ebook file from Mobipocket, used on Palm handhelds and early Kindles. Inside it is usually the same as a MOBI file, just with a different ending. Most reading apps today do not recognise .prc files.',
      'Converting a PRC to EPUB lets you read it on any phone, tablet or ebook reader, including Kindle through Send to Kindle. PDF and TXT are handy for printing or reading on a computer. Conversions use Calibre.',
    ],
    open: 'Calibre (free) opens PRC files on a computer. For a phone or Kindle, convert the PRC to EPUB on this page first.',
    uses: [
      'Read old Palm or early Kindle ebooks on a modern phone or tablet.',
      'Send a PRC book to Kindle as EPUB.',
      'Turn a PRC into PDF to print it.',
    ],
    limits: [
      'Books with DRM (copy protection) cannot be converted.',
    ],
    faq: [
      ['What is a PRC file?', 'A PRC file is a Mobipocket ebook, the format used on Palm devices and early Kindles. It is almost always the same as a MOBI file inside.'],
      ['Can I just rename PRC to MOBI?', 'Often yes, because the contents are the same, but converting to EPUB is the safer choice for modern readers and for Send to Kindle.'],
    ],
    guides: ['read-epub-on-kindle'],
  },

  deb: {
    desc: 'Open DEB packages online: extract a .deb file or convert it to ZIP, 7Z or TAR to see the files inside, on Windows or Mac. Free, no sign-up.',
    about: [
      'DEB is the software package format of Debian, Ubuntu and Linux Mint. A .deb file is an archive that holds a program\'s files plus instructions that tell the Linux package manager how to install it.',
      'You cannot install a DEB on Windows or macOS, and it is not a document, so it cannot become a PDF. What you can do is look inside it: converting it to ZIP here gives you the files it contains, such as the control information and the data archive with the program files.',
    ],
    open: 'On Ubuntu or Debian, install a DEB with sudo apt install ./file.deb, or double-click it to open the Software app. On Windows or Mac, convert it to ZIP here to see what is inside.',
    uses: [
      'Look inside a Linux package on a Windows PC or Mac.',
      'Extract a single file, such as an icon or a config file, from a DEB package.',
      'Repack the contents as ZIP, 7Z or TAR.',
    ],
    faq: [
      ['Can I convert a DEB file to PDF?', 'No. A DEB is a software package, not a document, so there is nothing to print as a PDF. Convert it to ZIP to see the files inside.'],
      ['Can I install a DEB file on Windows?', 'Not directly. DEB packages are for Debian and Ubuntu Linux. On Windows 10 and 11 you can install them inside Ubuntu running in WSL (Windows Subsystem for Linux).'],
      ['What is inside a DEB file?', 'A DEB contains a small file with the format version, a control archive with the package description and install scripts, and a data archive with the program\'s files.'],
    ],
  },
};
