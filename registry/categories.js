'use strict';
// Categories a format can belong to. Order is the order shown in menus
// (alphabetical like CloudConvert's Tools menu, with "Other" always last).
//
//   id            stable key used everywhere in code (never shown to users)
//   name          display name in the category list / format dropdown
//   converterName name of the category's converter tool, e.g. "Image Converter"
//   icon          UI icon key. Formats inherit it unless they override it.
//   description   one sentence for category landing pages
//
// A category with no formats is hidden by getCategories() unless asked for.

const CATEGORIES = [
  { id: 'archive', name: 'Archive', converterName: 'Archive Converter', icon: 'archive',
    description: 'Convert between compressed archive formats such as ZIP, 7Z, TAR and GZ.' },
  { id: 'audio', name: 'Audio', converterName: 'Audio Converter', icon: 'audio',
    description: 'Convert audio files between formats such as MP3, WAV, AAC, FLAC and OGG.' },
  { id: 'cad', name: 'CAD', converterName: 'CAD Converter', icon: 'cad',
    description: 'Convert technical drawing and CAD exchange files.' },
  { id: 'document', name: 'Document', converterName: 'Document Converter', icon: 'document',
    description: 'Convert word-processing and text documents such as DOCX, ODT, RTF, TXT and HTML.' },
  { id: 'ebook', name: 'Ebook', converterName: 'Ebook Converter', icon: 'ebook',
    description: 'Convert ebook files between EPUB, MOBI, AZW and AZW3.' },
  { id: 'font', name: 'Font', converterName: 'Font Converter', icon: 'font',
    description: 'Convert web and desktop fonts between TTF, OTF, WOFF, WOFF2 and EOT.' },
  { id: 'image', name: 'Image', converterName: 'Image Converter', icon: 'image',
    description: 'Convert and compress images such as JPG, PNG, WebP, AVIF, GIF, TIFF and ICO.' },
  { id: 'pdf', name: 'PDF', converterName: 'PDF Converter', icon: 'pdf',
    description: 'Convert PDF files to and from documents and images.' },
  { id: 'presentation', name: 'Presentation', converterName: 'Presentation Converter', icon: 'presentation',
    description: 'Convert slide decks such as PPT, PPTX and ODP.' },
  { id: 'spreadsheet', name: 'Spreadsheet', converterName: 'Spreadsheet Converter', icon: 'spreadsheet',
    description: 'Convert spreadsheets and tabular data such as XLSX, XLS, ODS, CSV and TSV.' },
  { id: 'vector', name: 'Vector', converterName: 'Vector Converter', icon: 'vector',
    description: 'Convert vector graphics such as SVG, EPS, AI and DXF.' },
  { id: 'video', name: 'Video', converterName: 'Video Converter', icon: 'video',
    description: 'Convert video files between MP4, MOV, MKV, WebM, AVI and many other formats.' },
  { id: 'other', name: 'Other', converterName: 'File Converter', icon: 'file',
    description: 'Other file types.' },
];

module.exports = { CATEGORIES };
