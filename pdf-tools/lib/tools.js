'use strict';
// The single source of truth for every tool on the site.
//
// Each tool says what it accepts, where it runs and which processor does the work:
//   runs: 'browser'  -> public/js/processors/<module>.js, the file never leaves the device
//   runs: 'server'   -> lib/engines (needs the command-line engines listed in `engine`)
// `workspace` picks the editing surface shown after upload:
//   files   a list of files (thumbnail, name, size, pages), reorderable when `multiple`
//   pages   page thumbnails of one PDF (pageMode: view | select | reorder | rotate)
//   editor  the page editor (editorTools lists the tools offered)
// `options` are the settings shown next to the workspace (see public/js/tool.js renderOptions).
//
// Page text (titles, intros, how-to, FAQ) lives in content/tools-content.js, keyed by slug.
// To add a tool: add it here, add its content, implement the processor. Pages, menus,
// search, sitemap and the API pick it up automatically.

const CATEGORIES = [
  { id: 'convert', name: 'Convert PDF', short: 'Convert', color: '#2563eb', blurb: 'Turn PDFs into Word, Excel, PowerPoint, images and text, or create PDFs from them.' },
  { id: 'organize', name: 'Organize PDF', short: 'Organize', color: '#0f8a7e', blurb: 'Merge, split, reorder, rotate, extract, delete and duplicate pages.' },
  { id: 'edit', name: 'Edit PDF', short: 'Edit', color: '#c2410c', blurb: 'Add text, images, shapes, signatures, highlights, notes and watermarks.' },
  { id: 'optimize', name: 'Compress PDF', short: 'Compress', color: '#15803d', blurb: 'Make PDFs smaller and faster to open, share and upload.' },
  { id: 'security', name: 'PDF Security', short: 'Security', color: '#be123c', blurb: 'Add or remove passwords and permanently black out sensitive content.' },
  { id: 'ocr', name: 'OCR', short: 'OCR', color: '#4338ca', blurb: 'Recognize text in scans and photos so you can search and copy it.' },
  { id: 'other', name: 'Other PDF Tools', short: 'More', color: '#0e7490', blurb: 'Page numbers, metadata, repair, ZIP archives and image extraction.' },
];

// File types a tool can accept. `exts` are checked in the browser and on the server;
// `magic` is how the server recognises the real file type from its first bytes.
const INPUTS = {
  pdf: { label: 'PDF', exts: ['pdf'], mimes: ['application/pdf'], magic: 'pdf' },
  jpg: { label: 'JPG', exts: ['jpg', 'jpeg', 'jfif'], mimes: ['image/jpeg'], magic: 'jpg' },
  png: { label: 'PNG', exts: ['png'], mimes: ['image/png'], magic: 'png' },
  image: { label: 'image', exts: ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp'], mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/bmp'], magic: 'image' },
  word: { label: 'Word', exts: ['docx', 'doc', 'odt', 'rtf'], mimes: [], magic: 'office' },
  excel: { label: 'Excel', exts: ['xlsx', 'xls', 'ods', 'csv'], mimes: [], magic: 'office' },
  powerpoint: { label: 'PowerPoint', exts: ['pptx', 'ppt', 'odp', 'ppsx', 'pps'], mimes: [], magic: 'office' },
  html: { label: 'HTML', exts: ['html', 'htm'], mimes: ['text/html'], magic: 'html' },
};

const PAGES_OPT = (label = 'Pages') => ({ id: 'pages', type: 'text', label, placeholder: 'All pages, or e.g. 1-3, 5', help: 'Leave empty for every page.' });
const POSITIONS = [
  ['bottom-center', 'Bottom center'], ['bottom-right', 'Bottom right'], ['bottom-left', 'Bottom left'],
  ['top-center', 'Top center'], ['top-right', 'Top right'], ['top-left', 'Top left'],
];
const OCR_LANG = { id: 'lang', type: 'select', label: 'Document language', choices: 'ocrLanguages', default: 'eng', help: 'Pick the main language of the text for the best accuracy.' };

const TOOLS = [
  // ------------------------------------------------------------------ convert
  {
    slug: 'pdf-to-word', name: 'PDF to Word', category: 'convert', icon: 'word', popular: 1,
    short: 'Turn a PDF into an editable Word document (DOCX).',
    input: 'pdf', runs: 'server', engine: 'pdfToWord', workspace: 'files',
    action: 'Convert to Word', output: 'docx', keywords: 'docx doc editable convert',
    related: ['word-to-pdf', 'pdf-to-text', 'ocr-pdf', 'pdf-to-excel'],
  },
  {
    slug: 'pdf-to-excel', name: 'PDF to Excel', category: 'convert', icon: 'excel',
    short: 'Pull tables out of a PDF into an Excel spreadsheet (XLSX).',
    input: 'pdf', runs: 'server', engine: 'pdfToExcel', workspace: 'files',
    action: 'Convert to Excel', output: 'xlsx', keywords: 'xlsx xls spreadsheet table csv',
    options: [
      { id: 'layout', type: 'radio', label: 'Sheets', default: 'page', choices: [['page', 'One sheet per page'], ['single', 'Everything on one sheet']] },
    ],
    related: ['excel-to-pdf', 'pdf-to-word', 'pdf-to-text'],
  },
  {
    slug: 'pdf-to-powerpoint', name: 'PDF to PowerPoint', category: 'convert', icon: 'powerpoint',
    short: 'Turn each PDF page into an editable PowerPoint slide (PPTX).',
    input: 'pdf', runs: 'server', engine: 'pdfToPowerpoint', workspace: 'files',
    action: 'Convert to PowerPoint', output: 'pptx', keywords: 'pptx ppt slides presentation',
    related: ['powerpoint-to-pdf', 'pdf-to-jpg', 'pdf-to-word'],
  },
  {
    slug: 'pdf-to-jpg', name: 'PDF to JPG', category: 'convert', icon: 'image', popular: 1,
    short: 'Save every PDF page, or the pages you pick, as a JPG image.',
    input: 'pdf', runs: 'browser', module: 'convert', fn: 'pdfToImages', workspace: 'files',
    action: 'Convert to JPG', output: 'jpg', keywords: 'jpeg image picture photo pages',
    options: [
      { id: 'dpi', type: 'radio', label: 'Image quality', default: '150', choices: [['72', 'Small (72 dpi)'], ['150', 'Normal (150 dpi)'], ['300', 'High (300 dpi)']] },
      PAGES_OPT(),
    ],
    params: { format: 'jpg' },
    related: ['pdf-to-png', 'jpg-to-pdf', 'extract-images-from-pdf'],
  },
  {
    slug: 'pdf-to-png', name: 'PDF to PNG', category: 'convert', icon: 'image',
    short: 'Save PDF pages as sharp, lossless PNG images.',
    input: 'pdf', runs: 'browser', module: 'convert', fn: 'pdfToImages', workspace: 'files',
    action: 'Convert to PNG', output: 'png', keywords: 'image picture transparent pages',
    options: [
      { id: 'dpi', type: 'radio', label: 'Image quality', default: '150', choices: [['72', 'Small (72 dpi)'], ['150', 'Normal (150 dpi)'], ['300', 'High (300 dpi)']] },
      PAGES_OPT(),
    ],
    params: { format: 'png' },
    related: ['pdf-to-jpg', 'png-to-pdf', 'extract-images-from-pdf'],
  },
  {
    slug: 'jpg-to-pdf', name: 'JPG to PDF', category: 'convert', icon: 'image-pdf', popular: 1,
    short: 'Combine JPG photos and scans into one PDF.',
    input: 'jpg', multiple: true, maxFiles: 100, runs: 'browser', module: 'convert', fn: 'imagesToPdf', workspace: 'files',
    action: 'Create PDF', output: 'pdf', keywords: 'jpeg image photo picture scan to pdf',
    options: [
      { id: 'pageSize', type: 'select', label: 'Page size', default: 'fit', choices: [['fit', 'Same as image'], ['a4', 'A4'], ['letter', 'US Letter']] },
      { id: 'orientation', type: 'radio', label: 'Orientation', default: 'auto', choices: [['auto', 'Auto'], ['portrait', 'Portrait'], ['landscape', 'Landscape']], showIf: { pageSize: ['a4', 'letter'] } },
      { id: 'margin', type: 'radio', label: 'Margin', default: '0', choices: [['0', 'None'], ['20', 'Small'], ['40', 'Large']] },
    ],
    related: ['png-to-pdf', 'pdf-to-jpg', 'merge-pdf'],
  },
  {
    slug: 'png-to-pdf', name: 'PNG to PDF', category: 'convert', icon: 'image-pdf',
    short: 'Turn PNG images and screenshots into a PDF.',
    input: 'png', multiple: true, maxFiles: 100, runs: 'browser', module: 'convert', fn: 'imagesToPdf', workspace: 'files',
    action: 'Create PDF', output: 'pdf', keywords: 'image screenshot picture to pdf',
    options: [
      { id: 'pageSize', type: 'select', label: 'Page size', default: 'fit', choices: [['fit', 'Same as image'], ['a4', 'A4'], ['letter', 'US Letter']] },
      { id: 'orientation', type: 'radio', label: 'Orientation', default: 'auto', choices: [['auto', 'Auto'], ['portrait', 'Portrait'], ['landscape', 'Landscape']], showIf: { pageSize: ['a4', 'letter'] } },
      { id: 'margin', type: 'radio', label: 'Margin', default: '0', choices: [['0', 'None'], ['20', 'Small'], ['40', 'Large']] },
    ],
    related: ['jpg-to-pdf', 'pdf-to-png', 'merge-pdf'],
  },
  {
    slug: 'word-to-pdf', name: 'Word to PDF', category: 'convert', icon: 'word-pdf',
    short: 'Convert DOCX, DOC, ODT and RTF documents to PDF.',
    input: 'word', runs: 'server', engine: 'officeToPdf', workspace: 'files',
    action: 'Convert to PDF', output: 'pdf', keywords: 'docx doc odt rtf document to pdf',
    related: ['pdf-to-word', 'excel-to-pdf', 'powerpoint-to-pdf'],
  },
  {
    slug: 'excel-to-pdf', name: 'Excel to PDF', category: 'convert', icon: 'excel-pdf',
    short: 'Convert XLSX, XLS, ODS and CSV spreadsheets to PDF.',
    input: 'excel', runs: 'server', engine: 'officeToPdf', workspace: 'files',
    action: 'Convert to PDF', output: 'pdf', keywords: 'xlsx xls csv ods spreadsheet to pdf',
    related: ['pdf-to-excel', 'word-to-pdf', 'powerpoint-to-pdf'],
  },
  {
    slug: 'powerpoint-to-pdf', name: 'PowerPoint to PDF', category: 'convert', icon: 'powerpoint-pdf',
    short: 'Convert PPTX, PPT and ODP presentations to PDF.',
    input: 'powerpoint', runs: 'server', engine: 'officeToPdf', workspace: 'files',
    action: 'Convert to PDF', output: 'pdf', keywords: 'pptx ppt odp slides presentation to pdf',
    related: ['pdf-to-powerpoint', 'word-to-pdf', 'excel-to-pdf'],
  },
  {
    slug: 'html-to-pdf', name: 'HTML to PDF', category: 'convert', icon: 'html',
    short: 'Convert a saved HTML web page file into a PDF.',
    input: 'html', runs: 'server', engine: 'htmlToPdf', workspace: 'files',
    action: 'Convert to PDF', output: 'pdf', keywords: 'web page htm website to pdf',
    related: ['word-to-pdf', 'pdf-to-text', 'merge-pdf'],
  },
  {
    slug: 'pdf-to-text', name: 'PDF to Text', category: 'convert', icon: 'text',
    short: 'Copy all the text out of a PDF into a plain TXT file.',
    input: 'pdf', runs: 'browser', module: 'convert', fn: 'pdfToText', workspace: 'files',
    action: 'Extract text', output: 'txt', keywords: 'txt copy text extract plain',
    related: ['ocr-pdf', 'pdf-to-word', 'image-to-text'],
  },

  // ------------------------------------------------------------------ organize
  {
    slug: 'merge-pdf', name: 'Merge PDF', category: 'organize', icon: 'merge', popular: 1,
    short: 'Combine several PDFs into one file, in the order you choose.',
    input: 'pdf', multiple: true, minFiles: 2, maxFiles: 50, runs: 'browser', module: 'organize', fn: 'merge', workspace: 'files',
    action: 'Merge PDF', output: 'pdf', keywords: 'combine join append unite files',
    related: ['split-pdf', 'rearrange-pdf-pages', 'compress-pdf'],
  },
  {
    slug: 'split-pdf', name: 'Split PDF', category: 'organize', icon: 'split', popular: 1,
    short: 'Split a PDF into several files by page ranges or page count.',
    input: 'pdf', runs: 'browser', module: 'organize', fn: 'split', workspace: 'pages', pageMode: 'view',
    action: 'Split PDF', output: 'pdf', keywords: 'separate divide cut break pages',
    options: [
      { id: 'mode', type: 'radio', label: 'Split', default: 'ranges', choices: [['ranges', 'By page ranges'], ['every', 'Every N pages'], ['each', 'Every page']] },
      { id: 'ranges', type: 'text', label: 'Page ranges', placeholder: 'e.g. 1-3, 4-8, 9', help: 'Each range becomes its own PDF.', showIf: { mode: ['ranges'] } },
      { id: 'every', type: 'number', label: 'Pages per file', default: 2, min: 1, max: 1000, showIf: { mode: ['every'] } },
    ],
    related: ['extract-pdf-pages', 'merge-pdf', 'delete-pdf-pages'],
  },
  {
    slug: 'extract-pdf-pages', name: 'Extract PDF Pages', category: 'organize', icon: 'extract',
    short: 'Pick the pages you need and save them as a new PDF.',
    input: 'pdf', runs: 'browser', module: 'organize', fn: 'extract', workspace: 'pages', pageMode: 'select',
    action: 'Extract pages', output: 'pdf', keywords: 'select pick save pages new pdf',
    options: [
      { id: 'separate', type: 'checkbox', label: 'Save each page as a separate PDF (ZIP)', default: false },
    ],
    related: ['split-pdf', 'delete-pdf-pages', 'merge-pdf'],
  },
  {
    slug: 'delete-pdf-pages', name: 'Delete PDF Pages', category: 'organize', icon: 'delete',
    short: 'Remove the pages you don’t want from a PDF.',
    input: 'pdf', runs: 'browser', module: 'organize', fn: 'remove', workspace: 'pages', pageMode: 'select',
    action: 'Delete pages', output: 'pdf', keywords: 'remove erase blank pages',
    related: ['extract-pdf-pages', 'rearrange-pdf-pages', 'split-pdf'],
  },
  {
    slug: 'rearrange-pdf-pages', name: 'Rearrange PDF Pages', category: 'organize', icon: 'reorder',
    short: 'Drag pages into a new order and save the PDF.',
    input: 'pdf', runs: 'browser', module: 'organize', fn: 'reorder', workspace: 'pages', pageMode: 'reorder',
    action: 'Save new order', output: 'pdf', keywords: 'reorder sort move order organize pages',
    related: ['rotate-pdf', 'merge-pdf', 'delete-pdf-pages'],
  },
  {
    slug: 'rotate-pdf', name: 'Rotate PDF', category: 'organize', icon: 'rotate',
    short: 'Rotate one page or every page of a PDF and save it.',
    input: 'pdf', runs: 'browser', module: 'organize', fn: 'rotate', workspace: 'pages', pageMode: 'rotate',
    action: 'Save rotation', output: 'pdf', keywords: 'turn flip landscape portrait sideways upside down',
    related: ['rearrange-pdf-pages', 'merge-pdf', 'split-pdf'],
  },
  {
    slug: 'duplicate-pdf-pages', name: 'Duplicate PDF Pages', category: 'organize', icon: 'duplicate',
    short: 'Copy selected pages and insert the copies right after them.',
    input: 'pdf', runs: 'browser', module: 'organize', fn: 'duplicate', workspace: 'pages', pageMode: 'select',
    action: 'Duplicate pages', output: 'pdf', keywords: 'copy repeat clone pages',
    options: [
      { id: 'copies', type: 'number', label: 'Copies of each selected page', default: 1, min: 1, max: 20 },
    ],
    related: ['rearrange-pdf-pages', 'extract-pdf-pages', 'merge-pdf'],
  },

  // ------------------------------------------------------------------ edit
  {
    slug: 'edit-pdf', name: 'Edit PDF', category: 'edit', icon: 'edit',
    short: 'Add text, images, shapes, drawings and signatures to a PDF.',
    input: 'pdf', runs: 'browser', module: 'editor', fn: 'apply', workspace: 'editor',
    editorTools: ['select', 'text', 'image', 'rect', 'ellipse', 'line', 'arrow', 'draw', 'highlight', 'whiteout', 'signature', 'note'],
    action: 'Save PDF', output: 'pdf', keywords: 'editor modify write fill change',
    related: ['sign-pdf', 'add-watermark-to-pdf', 'annotate-pdf'],
  },
  {
    slug: 'add-text-to-pdf', name: 'Add Text to PDF', category: 'edit', icon: 'add-text',
    short: 'Type text anywhere on a PDF: fill in forms, add labels or notes.',
    input: 'pdf', runs: 'browser', module: 'editor', fn: 'apply', workspace: 'editor',
    editorTools: ['select', 'text', 'whiteout'], defaultTool: 'text',
    action: 'Save PDF', output: 'pdf', keywords: 'type write fill form typewriter',
    related: ['edit-pdf', 'sign-pdf', 'pdf-page-numbers'],
  },
  {
    slug: 'add-image-to-pdf', name: 'Add Image to PDF', category: 'edit', icon: 'add-image',
    short: 'Place a logo, photo or stamp on any page of a PDF.',
    input: 'pdf', runs: 'browser', module: 'editor', fn: 'apply', workspace: 'editor',
    editorTools: ['select', 'image'], defaultTool: 'image',
    action: 'Save PDF', output: 'pdf', keywords: 'insert picture logo photo stamp png jpg',
    related: ['edit-pdf', 'add-watermark-to-pdf', 'jpg-to-pdf'],
  },
  {
    slug: 'add-shapes-to-pdf', name: 'Add Shapes to PDF', category: 'edit', icon: 'shapes',
    short: 'Draw rectangles, circles, lines and arrows on a PDF.',
    input: 'pdf', runs: 'browser', module: 'editor', fn: 'apply', workspace: 'editor',
    editorTools: ['select', 'rect', 'ellipse', 'line', 'arrow'], defaultTool: 'rect',
    action: 'Save PDF', output: 'pdf', keywords: 'rectangle circle box line arrow markup',
    related: ['edit-pdf', 'annotate-pdf', 'highlight-pdf'],
  },
  {
    slug: 'sign-pdf', name: 'Sign PDF', category: 'edit', icon: 'sign', popular: 1,
    short: 'Draw, type or upload your signature and place it on a PDF.',
    input: 'pdf', runs: 'browser', module: 'editor', fn: 'apply', workspace: 'editor',
    editorTools: ['select', 'signature', 'text', 'draw'], defaultTool: 'signature',
    action: 'Save signed PDF', output: 'pdf', keywords: 'signature esign e-sign draw initials',
    related: ['edit-pdf', 'add-text-to-pdf', 'protect-pdf'],
  },
  {
    slug: 'highlight-pdf', name: 'Highlight PDF', category: 'edit', icon: 'highlight',
    short: 'Mark important passages with a see-through highlighter.',
    input: 'pdf', runs: 'browser', module: 'editor', fn: 'apply', workspace: 'editor',
    editorTools: ['select', 'highlight', 'draw'], defaultTool: 'highlight',
    action: 'Save PDF', output: 'pdf', keywords: 'highlighter marker yellow mark text',
    related: ['annotate-pdf', 'edit-pdf', 'add-shapes-to-pdf'],
  },
  {
    slug: 'annotate-pdf', name: 'Annotate PDF', category: 'edit', icon: 'annotate',
    short: 'Add comments, sticky notes, arrows and highlights to a PDF.',
    input: 'pdf', runs: 'browser', module: 'editor', fn: 'apply', workspace: 'editor',
    editorTools: ['select', 'note', 'text', 'highlight', 'arrow', 'rect', 'draw'], defaultTool: 'note',
    action: 'Save PDF', output: 'pdf', keywords: 'comment sticky note markup review feedback',
    related: ['highlight-pdf', 'edit-pdf', 'add-shapes-to-pdf'],
  },
  {
    slug: 'add-watermark-to-pdf', name: 'Add Watermark', category: 'edit', icon: 'watermark',
    short: 'Stamp text or a logo across your PDF pages.',
    input: 'pdf', runs: 'browser', module: 'enhance', fn: 'watermark', workspace: 'files',
    action: 'Add watermark', output: 'pdf', keywords: 'stamp confidential draft logo overlay',
    options: [
      { id: 'kind', type: 'radio', label: 'Watermark', default: 'text', choices: [['text', 'Text'], ['image', 'Image']] },
      { id: 'text', type: 'text', label: 'Text', default: 'CONFIDENTIAL', maxLength: 120, showIf: { kind: ['text'] } },
      { id: 'image', type: 'image', label: 'Image (PNG or JPG)', showIf: { kind: ['image'] } },
      { id: 'fontSize', type: 'number', label: 'Text size', default: 60, min: 8, max: 300, showIf: { kind: ['text'] } },
      { id: 'color', type: 'color', label: 'Color', default: '#d32f2f', showIf: { kind: ['text'] } },
      { id: 'opacity', type: 'range', label: 'Opacity', default: 30, min: 5, max: 100, unit: '%' },
      { id: 'rotation', type: 'select', label: 'Angle', default: '45', choices: [['0', 'Horizontal'], ['45', 'Diagonal up (45°)'], ['-45', 'Diagonal down (-45°)'], ['90', 'Vertical']] },
      { id: 'layout', type: 'radio', label: 'Placement', default: 'center', choices: [['center', 'Center'], ['tile', 'Tiled']] },
      PAGES_OPT(),
    ],
    related: ['pdf-page-numbers', 'edit-pdf', 'protect-pdf'],
  },

  // ------------------------------------------------------------------ security
  {
    slug: 'protect-pdf', name: 'Protect PDF', category: 'security', icon: 'lock',
    short: 'Lock a PDF with a password using strong AES-256 encryption.',
    input: 'pdf', runs: 'server', engine: 'protect', workspace: 'files',
    action: 'Protect PDF', output: 'pdf', keywords: 'password encrypt lock secure',
    options: [
      { id: 'password', type: 'password', label: 'Password', required: true, minLength: 4, maxLength: 120 },
      { id: 'confirm', type: 'password', label: 'Repeat password', required: true, matches: 'password' },
      { id: 'allowPrint', type: 'checkbox', label: 'Allow printing', default: true },
      { id: 'allowCopy', type: 'checkbox', label: 'Allow copying text', default: true },
      { id: 'allowEdit', type: 'checkbox', label: 'Allow editing', default: false },
    ],
    related: ['unlock-pdf', 'redact-pdf', 'add-watermark-to-pdf'],
  },
  {
    slug: 'unlock-pdf', name: 'Unlock PDF', category: 'security', icon: 'unlock',
    short: 'Remove the password from a PDF you can open.',
    input: 'pdf', runs: 'server', engine: 'unlock', workspace: 'files',
    action: 'Unlock PDF', output: 'pdf', keywords: 'remove password decrypt open',
    options: [
      { id: 'password', type: 'password', label: 'Current password', maxLength: 120, help: 'The password you use to open the file. Leave empty if it opens without one.' },
    ],
    related: ['remove-pdf-restrictions', 'protect-pdf', 'compress-pdf'],
  },
  {
    slug: 'remove-pdf-restrictions', name: 'Remove PDF Restrictions', category: 'security', icon: 'shield-off',
    short: 'Lift print, copy and edit restrictions from a PDF that opens without a password.',
    input: 'pdf', runs: 'server', engine: 'removeRestrictions', workspace: 'files',
    action: 'Remove restrictions', output: 'pdf', keywords: 'permissions owner password print copy security',
    related: ['unlock-pdf', 'protect-pdf', 'repair-pdf'],
  },
  {
    slug: 'redact-pdf', name: 'Redact PDF', category: 'security', icon: 'redact',
    short: 'Black out text and images so they can never be recovered.',
    input: 'pdf', runs: 'browser', module: 'editor', fn: 'redact', workspace: 'editor',
    editorTools: ['select', 'redact'], defaultTool: 'redact',
    action: 'Redact and save', output: 'pdf', keywords: 'black out censor hide remove sensitive',
    options: [
      { id: 'stripMeta', type: 'checkbox', label: 'Also remove document properties (title, author…)', default: true },
    ],
    related: ['protect-pdf', 'edit-pdf', 'pdf-metadata-editor'],
  },

  // ------------------------------------------------------------------ optimize
  {
    slug: 'compress-pdf', name: 'Compress PDF', category: 'optimize', icon: 'compress', popular: 1,
    short: 'Shrink a PDF’s file size while keeping it readable.',
    input: 'pdf', runs: 'server', engine: 'compress', workspace: 'files',
    action: 'Compress PDF', output: 'pdf', keywords: 'shrink smaller size reduce mb email',
    options: [
      { id: 'level', type: 'radio', label: 'Compression', default: 'recommended', choices: [['low', 'Light: best quality'], ['recommended', 'Recommended'], ['extreme', 'Strong: smallest file']] },
    ],
    related: ['reduce-pdf-size', 'optimize-pdf', 'merge-pdf'],
  },
  {
    slug: 'optimize-pdf', name: 'Optimize PDF', category: 'optimize', icon: 'optimize',
    short: 'Clean up and restructure a PDF without touching its quality.',
    input: 'pdf', runs: 'server', engine: 'optimize', workspace: 'files',
    action: 'Optimize PDF', output: 'pdf', keywords: 'lossless linearize fast web view clean',
    options: [
      { id: 'linearize', type: 'checkbox', label: 'Optimize for fast web view', default: true },
    ],
    related: ['compress-pdf', 'repair-pdf', 'reduce-pdf-size'],
  },
  {
    slug: 'reduce-pdf-size', name: 'Reduce PDF Size', category: 'optimize', icon: 'reduce',
    short: 'Choose the image resolution and get a PDF small enough to upload.',
    input: 'pdf', runs: 'server', engine: 'reduce', workspace: 'files',
    action: 'Reduce size', output: 'pdf', keywords: 'smaller kb mb upload limit email resolution grayscale',
    options: [
      { id: 'dpi', type: 'select', label: 'Image resolution', default: '110', choices: [['200', '200 dpi: print quality'], ['150', '150 dpi: good on screen'], ['110', '110 dpi: smaller'], ['72', '72 dpi: smallest']] },
      { id: 'grayscale', type: 'checkbox', label: 'Convert to black and white (grayscale)', default: false },
    ],
    related: ['compress-pdf', 'optimize-pdf', 'split-pdf'],
  },

  // ------------------------------------------------------------------ OCR
  {
    slug: 'ocr-pdf', name: 'OCR PDF', category: 'ocr', icon: 'ocr',
    short: 'Make a scanned PDF searchable and copyable with OCR.',
    input: 'pdf', runs: 'server', engine: 'ocrPdf', workspace: 'files',
    action: 'Run OCR', output: 'pdf', keywords: 'scan searchable recognize text character recognition',
    options: [OCR_LANG],
    related: ['image-to-text', 'pdf-to-text', 'pdf-to-word'],
  },
  {
    slug: 'image-to-text', name: 'Image to Text', category: 'ocr', icon: 'image-text',
    short: 'Read the text in a photo, screenshot or scan (OCR).',
    input: 'image', runs: 'server', engine: 'imageToText', workspace: 'files',
    action: 'Extract text', output: 'txt', keywords: 'ocr photo screenshot jpg png text recognize',
    options: [OCR_LANG],
    related: ['ocr-pdf', 'pdf-to-text', 'jpg-to-pdf'],
  },

  // ------------------------------------------------------------------ other
  {
    slug: 'pdf-page-numbers', name: 'Add Page Numbers', category: 'other', icon: 'numbers',
    short: 'Number the pages of a PDF, in the position and style you like.',
    input: 'pdf', runs: 'browser', module: 'enhance', fn: 'pageNumbers', workspace: 'files',
    action: 'Add page numbers', output: 'pdf', keywords: 'numbering paginate footer header bates',
    options: [
      { id: 'position', type: 'select', label: 'Position', default: 'bottom-center', choices: POSITIONS },
      { id: 'format', type: 'select', label: 'Style', default: 'n', choices: [['n', '1, 2, 3'], ['page-n', 'Page 1'], ['page-n-of', 'Page 1 of 10'], ['n-of', '1 / 10']] },
      { id: 'start', type: 'number', label: 'First number', default: 1, min: 0, max: 100000 },
      { id: 'fontSize', type: 'number', label: 'Text size', default: 11, min: 6, max: 48 },
      { id: 'skipFirst', type: 'checkbox', label: 'Don’t number the first page (cover)', default: false },
    ],
    related: ['add-watermark-to-pdf', 'merge-pdf', 'pdf-metadata-editor'],
  },
  {
    slug: 'pdf-metadata-editor', name: 'PDF Metadata Editor', category: 'other', icon: 'metadata',
    short: 'View and change a PDF’s title, author, subject and keywords.',
    input: 'pdf', runs: 'browser', module: 'enhance', fn: 'metadata', workspace: 'files', loadMetadata: true,
    action: 'Save properties', output: 'pdf', keywords: 'properties title author subject keywords info',
    options: [
      { id: 'title', type: 'text', label: 'Title', maxLength: 500 },
      { id: 'author', type: 'text', label: 'Author', maxLength: 500 },
      { id: 'subject', type: 'text', label: 'Subject', maxLength: 500 },
      { id: 'keywords', type: 'text', label: 'Keywords', maxLength: 1000, help: 'Separate keywords with commas.' },
      { id: 'creator', type: 'text', label: 'Created with (application)', maxLength: 500 },
      { id: 'clear', type: 'checkbox', label: 'Remove all properties instead', default: false },
    ],
    related: ['redact-pdf', 'pdf-page-numbers', 'optimize-pdf'],
  },
  {
    slug: 'repair-pdf', name: 'Repair PDF', category: 'other', icon: 'repair',
    short: 'Try to fix a damaged PDF that won’t open or shows errors.',
    input: 'pdf', runs: 'server', engine: 'repair', workspace: 'files', skipPdfCheck: true,
    action: 'Repair PDF', output: 'pdf', keywords: 'fix broken corrupt damaged recover',
    related: ['optimize-pdf', 'compress-pdf', 'unlock-pdf'],
  },
  {
    slug: 'pdf-to-zip', name: 'PDF to ZIP', category: 'other', icon: 'zip',
    short: 'Pack one or more PDFs into a compressed ZIP archive.',
    input: 'pdf', multiple: true, maxFiles: 100, runs: 'browser', module: 'convert', fn: 'pdfToZip', workspace: 'files',
    action: 'Create ZIP', output: 'zip', keywords: 'archive zip compress bundle folder',
    options: [
      { id: 'perPage', type: 'checkbox', label: 'Split into one PDF per page', default: false },
    ],
    related: ['merge-pdf', 'split-pdf', 'compress-pdf'],
  },
  {
    slug: 'extract-images-from-pdf', name: 'Extract Images from PDF', category: 'other', icon: 'extract-images',
    short: 'Save every picture embedded in a PDF at its original quality.',
    input: 'pdf', runs: 'server', engine: 'extractImages', workspace: 'files',
    action: 'Extract images', output: 'zip', keywords: 'get pictures photos save images original',
    related: ['pdf-to-jpg', 'pdf-to-png', 'pdf-to-zip'],
  },
];

const BY_SLUG = new Map(TOOLS.map((t) => [t.slug, t]));
const CAT_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

for (const t of TOOLS) {
  if (!INPUTS[t.input]) throw new Error(`tool ${t.slug}: unknown input ${t.input}`);
  if (!CAT_BY_ID.has(t.category)) throw new Error(`tool ${t.slug}: unknown category ${t.category}`);
  for (const r of t.related || []) if (!BY_SLUG.has(r)) throw new Error(`tool ${t.slug}: unknown related ${r}`);
  t.options = t.options || [];
  t.related = t.related || [];
}

const getTool = (slug) => BY_SLUG.get(slug);
const getCategory = (id) => CAT_BY_ID.get(id);
const toolsIn = (catId) => TOOLS.filter((t) => t.category === catId);
const popularTools = () => ['merge-pdf', 'compress-pdf', 'pdf-to-word', 'jpg-to-pdf', 'split-pdf', 'pdf-to-jpg', 'sign-pdf', 'edit-pdf']
  .map(getTool);

module.exports = { CATEGORIES, INPUTS, TOOLS, getTool, getCategory, toolsIn, popularTools };
