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
    desc: 'Convert SWF (Shockwave Flash) files to MP4, JPG, GIF, MP3 and more, free. Watch old Flash videos again without Flash Player. No sign-up.',
    about: [
      'SWF (Shockwave Flash) was the file format of Adobe Flash. For about fifteen years it carried web animations, games, video players and banner ads. Adobe ended Flash Player at the end of 2020, and every current browser has removed it, so an SWF file you download today usually will not open anywhere.',
      'An SWF file can hold two very different things. Some SWF files are simply a video (often FLV video with MP3 sound) wrapped for Flash. Others are interactive programs written in ActionScript, such as games, menus and animations that react to clicks. This converter works with the first kind: it reads the video and sound frames and saves them as a normal MP4, GIF, MP3 or another format that plays on any phone or computer, or as JPG and PNG pictures.',
    ],
    open: 'To watch an SWF without Flash Player, convert it to MP4 here and open the MP4 in any video player, browser or phone. For interactive Flash games and animations, the free Ruffle emulator (ruffle.rs) or the Flashpoint archive project can play many of them on modern computers.',
    uses: [
      'Turn an old Flash video or animated intro from a 2000s website backup into an MP4 you can watch and share.',
      'Save the soundtrack of an SWF as MP3 or WAV.',
      'Save still pictures from a Flash video as JPG or PNG.',
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
      ['How do I convert SWF to JPG?', 'Choose JPG (or PNG) as the output. You get a full-size picture for every second of the Flash video, downloaded as a ZIP. Interactive Flash games have no video frames and cannot be converted to pictures.'],
      ['Is it safe to open SWF files?', 'Flash Player had many security problems, which is one reason it was retired. Converting an SWF to MP4 here does not run the file on your computer; the video frames are read on the server and the file is deleted afterwards.'],
    ],
    guides: ['save-pictures-from-video', 'file-format-vs-codec'],
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
      'PNG (Portable Network Graphics) is a lossless image format: saving a picture as PNG never lowers its quality, and it supports transparency. That makes it the best choice for screenshots, logos, icons, diagrams and anything with sharp text or flat colors.',
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
      'PRC is an old ebook file from Mobipocket, used on Palm handhelds and early Kindles. Inside it is usually the same as a MOBI file, just with a different ending. Most reading apps today do not recognize .prc files.',
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
  xz: {
    an: true,
    desc: 'Open XZ files online: extract .xz and .tar.xz archives or convert them to ZIP so Windows and Mac can open them. Free, no software, no sign-up.',
    about: [
      'XZ is a compressed file format from the Linux world. It uses the LZMA2 method, which makes files smaller than ZIP or GZIP, so it is popular for software downloads, source code and backups. Most often you get a TAR archive compressed with XZ, named something like project-2.1.tar.xz, which holds many files and folders.',
      'Windows and macOS cannot always open XZ files on their own. Converting the file to ZIP here gives you an archive that opens with a double-click on any computer, with every file and folder inside kept exactly as it was.',
    ],
    open: 'To view what is inside an XZ file without installing anything, convert it to ZIP on this page and open the ZIP. On Linux, run tar -xf file.tar.xz, or xz -d file.xz for a single file. On Windows, 7-Zip also opens XZ files.',
    uses: [
      'Open a .tar.xz source code or software download on a Windows PC or Mac.',
      'See the files inside an XZ archive before you unpack it on a server.',
      'Repack an XZ archive as ZIP to send it to someone, or as 7Z or TAR.GZ for another tool.',
    ],
    faq: [
      ['How do I open an XZ file on Windows?', 'Convert it to ZIP on this page and double-click the ZIP in File Explorer. Or install 7-Zip, which can open XZ files.'],
      ['Can I view XZ files online?', 'Yes. Upload the XZ file here and convert it to ZIP: you get every file inside, with the same names and folders, and no software to install.'],
      ['What is the difference between .xz and .tar.xz?', 'A .xz file is one compressed file. A .tar.xz is a TAR archive of many files and folders, compressed with XZ. Both are handled here, and the folder structure is kept.'],
    ],
  },

  zip: {
    desc: 'Free ZIP converter: convert ZIP archives to 7Z, TAR, TAR.GZ or TAR.XZ, or turn RAR, 7Z, TAR and other archives into ZIP. Names in any language kept.',
    about: [
      'ZIP is the most widely supported archive format: Windows, macOS, Linux, Android and iPhone all open it without extra software. An archive bundles many files and folders into one file and usually makes it smaller, which is handy for emailing and uploading.',
      'People convert to ZIP when they receive an archive their computer cannot open, such as RAR, 7Z, TAR.GZ or XZ. They convert ZIP to 7Z or TAR.XZ when they want a smaller file, or to TAR.GZ for Linux servers and software projects.',
    ],
    open: 'Double-click a ZIP file in Windows File Explorer or the Mac Finder to open it. On iPhone, tap it in the Files app; on Android, open it in Files by Google or your file manager.',
    uses: [
      'Turn a RAR or 7Z download into ZIP so it opens on any computer.',
      'Make a smaller archive by converting ZIP to 7Z or TAR.XZ.',
      'Convert ZIP to TAR.GZ for a Linux server or a software project.',
      'Fix archives from other countries whose file names show as strange characters: names in any language are kept.',
    ],
    faq: [
      ['How do I convert RAR to ZIP?', 'Open the RAR to ZIP converter, or drop the RAR file here and choose ZIP. The files inside are unpacked and packed again as ZIP, with the same names and folders.'],
      ['Does converting an archive change the files inside?', 'No. Archive formats are lossless, so every file comes out exactly as it went in.'],
      ['Can you open password-protected ZIP files?', 'No. Encrypted archives cannot be converted without the password, and this tool does not try to break passwords.'],
    ],
  },

  csv: {
    desc: 'Free CSV converter: convert CSV files to Excel (XLSX, XLS), ODS, PDF or HTML, or save spreadsheets as CSV. Many files at once, no sign-up, no watermark.',
    about: [
      'CSV (comma-separated values) is a plain text file where each line is a row and commas separate the columns. Almost every program can export or import CSV, from banks and online stores to databases and email tools, which makes it the common language for tables of data.',
      'CSV has no formatting, formulas or multiple sheets. Converting it to Excel (XLSX) gives you a real spreadsheet you can format, sort and add formulas to; converting it to PDF gives a printable table.',
    ],
    open: 'Excel, Google Sheets, Apple Numbers and LibreOffice Calc all open CSV files. If the columns come out wrong in Excel, convert the CSV to XLSX here first and open that instead.',
    uses: [
      'Turn a bank statement or online store export (CSV) into an Excel spreadsheet.',
      'Make a printable PDF table from a CSV file.',
      'Convert an Excel sheet to CSV to import contacts or products into another app.',
    ],
    faq: [
      ['How do I convert CSV to Excel?', 'Drop the CSV file here and choose XLSX. You get an Excel file with each value in its own cell, ready to format and add formulas.'],
      ['Why does my CSV look wrong in Excel?', 'Excel sometimes guesses the wrong separator or text encoding, so everything lands in one column or accented letters break. Converting the CSV to XLSX here avoids that.'],
      ['Can a CSV file have several sheets?', 'No. A CSV holds one table. When an Excel file with several sheets is converted to CSV, only the first sheet is kept.'],
    ],
  },

  ai: {
    an: true,
    desc: 'Convert AI (Adobe Illustrator) files to SVG, PDF, PNG, JPG or EPS free, without Illustrator. Open and view AI files online. No sign-up, no watermark.',
    about: [
      'AI is the file format of Adobe Illustrator, the design app used for logos, icons and print artwork. AI files store vector graphics: shapes and lines that stay sharp at any size.',
      'Without Illustrator, an AI file is hard to open or use. Converting it to SVG gives you a vector file for websites and free design tools such as Inkscape and Figma; PDF and EPS suit printers; PNG and JPG give pictures you can use anywhere.',
    ],
    open: 'Without Illustrator, convert the AI file to PDF or PNG here to view it. Inkscape (free) can also open most AI files. Illustrator saves AI files with PDF compatibility by default, which is what makes them readable outside Illustrator.',
    uses: [
      'View a logo a designer sent as an AI file, without buying Illustrator.',
      'Turn AI artwork into SVG for a website or for editing in Inkscape or Figma.',
      'Make a PNG of a logo with a transparent background for social media or documents.',
      'Send print-ready PDF or EPS files to a print shop.',
    ],
    limits: [
      'AI files saved without PDF compatibility (an option in Illustrator\'s save dialog) contain no readable artwork outside Illustrator. Ask the designer to save the file again with "Create PDF Compatible File" ticked.',
    ],
    faq: [
      ['How do I open an AI file without Illustrator?', 'Convert it to PDF or PNG on this page and open the result in any viewer. To edit it, convert it to SVG and open that in Inkscape or Figma.'],
      ['Will my AI file stay a vector?', 'Yes, when you convert it to SVG, PDF, EPS, EMF or WMF. PNG, JPG and WebP are pictures made of pixels.'],
      ['Why is the converted file blank?', 'The AI file was probably saved without PDF compatibility. Ask for it to be saved again with "Create PDF Compatible File" ticked.'],
    ],
  },

  dot: {
    desc: 'Convert DOT (Word 97-2003 template) files to DOCX, DOC, PDF or DOTX free. Open old Word templates in any app. No sign-up, no watermark.',
    about: [
      'DOT is the template format of Microsoft Word 97 to 2003. A template is a starting document, such as a letterhead, a form or a report layout, that you copy each time you begin a new document. Word 2007 replaced DOT with DOTX.',
      'Old DOT templates still turn up from company archives, schools and government websites. Converting a DOT to DOCX gives you a normal document to fill in; converting it to DOTX makes it a modern Word template; PDF is for printing or reading.',
    ],
    open: 'Microsoft Word and LibreOffice Writer open DOT files. Google Docs and many phone apps do not, so convert the DOT to DOCX here first.',
    uses: [
      'Fill in an old letterhead or form template in a current version of Word or Google Docs.',
      'Upgrade a DOT template to DOTX for Microsoft 365.',
      'Print a template or share it as a PDF.',
    ],
    faq: [
      ['What is the difference between DOT and DOTX?', 'DOT is the older Word 97-2003 template format; DOTX is the newer template format used since Word 2007. Both are templates, not ordinary documents.'],
      ['How do I edit a DOT file in Google Docs?', 'Convert it to DOCX here, then upload the DOCX to Google Drive and open it with Google Docs.'],
      ['Will the layout of the template be kept?', 'Text, styles, tables, headers and pictures are kept. Fields and form controls from very old templates may need checking after conversion.'],
    ],
  },

  mts: {
    an: true,
    desc: 'Convert MTS (AVCHD) camcorder videos to MP4, MOV or JPG free. Play Sony and Panasonic camcorder videos on any device. No sign-up.',
    about: [
      'MTS is the video file of the AVCHD format, used by Sony, Panasonic and Canon HD camcorders and some cameras. The videos are high quality but come in a file type many phones, editing apps and websites do not accept, often split into several files on the memory card.',
      'Converting MTS to MP4 makes the video play on every phone, computer, TV and website, and upload to YouTube or social media without trouble. You can also save the sound as MP3 or still pictures as JPG.',
    ],
    open: 'VLC (free) plays MTS files on Windows, Mac and Linux. For phones, editing apps and sharing, convert the MTS to MP4 on this page.',
    uses: [
      'Play old camcorder videos of family events on a phone or smart TV.',
      'Upload camcorder footage to YouTube, Facebook or WhatsApp as MP4.',
      'Edit camcorder clips in video apps that only accept MP4 or MOV.',
      'Save still pictures from camcorder video as JPG.',
    ],
    faq: [
      ['How do I convert MTS to MP4?', 'Drop the MTS file here, keep MP4 as the output and download the result. The video is re-encoded to H.264 with AAC sound, which plays everywhere.'],
      ['Where are the MTS files on my camcorder card?', 'In a folder named PRIVATE/AVCHD/BDMV/STREAM on the memory card. Copy the .MTS files from there.'],
      ['My recording is split into several MTS files. Why?', 'Camcorders split long recordings into files of about 2 to 4 GB. Convert each part, or join them in a video editor afterwards.'],
    ],
  },

  mod: {
    desc: 'Convert MOD camcorder videos (JVC, Panasonic, Canon) to MP4, MOV or JPG free. Play old camcorder footage on any device. No sign-up.',
    about: [
      'MOD is a video file made by standard-definition camcorders from JVC, Panasonic and Canon that recorded to hard drives or SD cards. Inside is MPEG-2 video, the same kind used on DVDs, but with a file ending most players and apps do not recognize.',
      'Converting MOD to MP4 lets you watch and share these family videos on phones, computers and TVs, and upload them to YouTube or social media.',
    ],
    open: 'VLC (free) plays MOD files on any computer. For phones, sharing and editing, convert the MOD to MP4 here.',
    uses: [
      'Watch old camcorder videos on a phone, laptop or smart TV.',
      'Share family videos on WhatsApp, Facebook or YouTube as MP4.',
      'Convert MOD to MOV for editing on a Mac.',
    ],
    faq: [
      ['How do I convert MOD to MP4?', 'Drop the MOD file here, keep MP4 and download the result. It plays on every modern device.'],
      ['Where are the MOD files on my camcorder?', 'Usually in a folder such as SD_VIDEO on the camcorder\'s hard drive or SD card, in subfolders named PRG001 and so on.'],
      ['Can I rename MOD to MPG?', 'Often yes, because both hold MPEG-2 video, but converting to MP4 is the most reliable way to make the video play everywhere.'],
    ],
  },

  djvu: {
    desc: 'Convert DjVu files to PDF, JPG, PNG, TIFF or TXT free. Open scanned DjVu books on any device without a special reader. No sign-up.',
    about: [
      'DjVu is a format for scanned documents, especially books, magazines and old papers. It compresses scanned pages much more than PDF while keeping text readable, which is why many digital libraries share books as DjVu.',
      'Few apps open DjVu files, and phones and tablets usually cannot. Converting DjVu to PDF makes the book readable on any device; JPG and PNG give one picture per page; TXT gives the text when the file has a text layer.',
    ],
    open: 'Free readers such as SumatraPDF (Windows) and Okular (Linux) open DjVu files. On a phone, tablet or Mac, convert the DjVu to PDF here and open the PDF.',
    uses: [
      'Read a scanned DjVu book on a Kindle, iPad or phone as a PDF.',
      'Print pages of a DjVu document.',
      'Save pages as JPG or PNG pictures, or as TIFF for archiving.',
      'Copy the text from a DjVu file that has a text layer.',
    ],
    faq: [
      ['How do I open a DjVu file on a Mac or iPhone?', 'Convert it to PDF on this page, then open the PDF in Preview, Books or Files.'],
      ['Why is the TXT file empty?', 'The DjVu is only pictures of pages, with no text layer. Convert it to PDF and use our Image to Text (OCR) tool on the pages you need.'],
      ['Will the PDF be much bigger than the DjVu?', 'Usually yes, because DjVu compresses scans very well. Use Compress PDF afterwards to make it smaller.'],
    ],
  },

  ico: {
    an: true,
    desc: 'Free ICO converter: convert ICO icons to PNG or JPG, or make an ICO favicon from PNG, JPG or SVG. Transparent backgrounds kept. No sign-up.',
    about: [
      'ICO is the icon format of Windows. One ICO file can hold the same icon at several sizes, such as 16, 32 and 48 pixels, and supports transparency. Websites use an ICO file as their favicon, the small icon in the browser tab.',
      'People convert ICO to PNG to use or edit an icon in normal image apps, and convert PNG, JPG or SVG to ICO to make a favicon or a Windows icon.',
    ],
    open: 'Windows shows ICO files in File Explorer and the Photos app; browsers open them too. Most image editors prefer PNG, so convert the ICO to PNG here to edit it.',
    uses: [
      'Make a favicon for a website from a logo (PNG or SVG to ICO).',
      'Extract an icon from an ICO file as a PNG with a transparent background.',
      'Make a custom icon for a Windows folder or shortcut.',
    ],
    faq: [
      ['How do I convert PNG to ICO?', 'Open PNG to ICO, or drop the PNG here and choose ICO. Use a square image; our Favicon Generator also makes all the favicon sizes a website needs.'],
      ['Is transparency kept?', 'Yes. Transparent areas stay transparent when converting between ICO and PNG.'],
      ['What size should an ICO favicon be?', 'Browsers use 16 x 16 and 32 x 32 pixels in tabs; start from a square image of at least 64 x 64 pixels so the small sizes look clean.'],
    ],
    guides: ['make-a-favicon'],
  },

  eps: {
    an: true,
    desc: 'Free EPS converter: convert EPS files to PDF, SVG, PNG or JPG, or make EPS from SVG, PDF and AI. Open EPS files without Illustrator. No sign-up.',
    about: [
      'EPS (Encapsulated PostScript) is an older vector format still common in printing and logo files. Like AI and SVG, it stores shapes that stay sharp at any size, so print shops and stock image sites often ask for or supply EPS files.',
      'Most apps cannot open EPS directly. Converting it to PDF or PNG lets you view it anywhere; SVG keeps it as a vector for websites and free design tools; and converting SVG or PDF to EPS gives a print shop the file it asks for.',
    ],
    open: 'Without Illustrator, convert the EPS to PDF or PNG here to view it. Inkscape (free) can open and edit EPS files too.',
    uses: [
      'View a logo or stock graphic supplied as EPS.',
      'Turn EPS artwork into SVG for a website or into PNG for documents and social media.',
      'Make an EPS from an SVG or PDF logo for a print shop.',
    ],
    faq: [
      ['How do I open an EPS file without Illustrator?', 'Convert it to PDF or PNG on this page and open the result in any viewer. Inkscape also opens EPS files for editing.'],
      ['Does EPS to PNG keep transparency?', 'Yes. Areas without artwork stay transparent in the PNG.'],
      ['Is EPS still used?', 'Yes, mostly in printing and stock graphics, though PDF and SVG have replaced it for many uses.'],
    ],
  },
};
