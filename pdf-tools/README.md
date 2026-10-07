# Pagefold: free online PDF tools

41 PDF tools: convert, organize, edit, sign, compress, protect, OCR. Every tool is free. There
are no accounts, plans, credits, trials or watermarks. The site is meant to be funded by Google
AdSense only, and ad slots are ready but switched off until you configure them.

The brand name is a placeholder. Set `SITE_NAME` to use your own.

This app is self-contained in `pdf-tools/` and does not touch the file converter in the parent
folder.

## Quick start

```bash
cd pdf-tools
npm install
cp .env.example .env     # optional
npm start                # http://localhost:3000
```

The browser tools work straight away. The server tools need the engines listed below. The
Dockerfile installs all of them:

```bash
docker build -t pagefold .
docker run -p 3000:3000 --env-file .env pagefold
```

When the server starts, it logs which engines it found. A tool whose engine is missing shows
"not available on this server", is marked `noindex`, and is left out of the sitemap. The site
never shows a button that doesn't work.

## The tools and where they run

**In the browser.** The file never leaves the visitor's device. These use pdf-lib, PDF.js and
JSZip, loaded only on tool pages when they are needed.

| Group | Tools |
|---|---|
| Organize | Merge, Split (by ranges, every N pages, or every page), Extract pages, Delete pages, Rearrange (drag and drop), Rotate, Duplicate pages |
| Convert | PDF to JPG, PDF to PNG (72/150/300 dpi), JPG to PDF, PNG to PDF (EXIF rotation, page size, margins), PDF to Text, PDF to ZIP |
| Edit | Edit PDF, Add text, Add image, Add shapes, Sign (draw, type or upload), Highlight, Annotate (real PDF comments), Add watermark |
| Security | Redact: marked pages are flattened to images, so the covered content is really removed |
| Other | Page numbers, Metadata editor |

**On the server.** Each request uploads one file into a private temporary folder. The folder
is deleted when the response finishes, and a sweeper removes anything older than an hour.

| Tool | Engine |
|---|---|
| PDF to Word | pdf2docx (Python), with LibreOffice as a fallback |
| PDF to Excel | pdfplumber + openpyxl (finds the tables on each page) |
| PDF to PowerPoint | LibreOffice (`impress_pdf_import`), which gives editable text boxes |
| Word, Excel and PowerPoint to PDF | LibreOffice (headless, fresh profile per job, macros off, external links blocked) |
| HTML to PDF | LibreOffice, after the HTML is sanitised: scripts and remote or local resource references are removed |
| Compress, Reduce PDF size | Ghostscript. If the result isn't smaller, the visitor gets the original back and is told so |
| Optimize | qpdf (lossless: object streams, recompression, optional linearization) |
| Protect, Unlock, Remove restrictions | qpdf, AES-256. Passwords are passed through private files, never on the command line |
| Repair | qpdf, then Ghostscript |
| OCR PDF | OCRmyPDF + Tesseract (`--skip-text`) |
| Image to Text | Tesseract |
| Extract images | Poppler `pdfimages -all` (original formats, returned as a ZIP when there are several) |

## Architecture

```
server.js                 routes, security headers, rate limit, API
lib/tools.js              THE tool registry: every tool's category, input, options, processor
lib/config.js             environment settings
lib/upload.js             upload limits, extension + magic-byte checks, option validation
lib/engines/              server processors (adapter layer) + engine detection + job runner
lib/render/               HTML: layout (header, footer, ad slots), pages, icons
content/                  page copy: tools-content.js (per tool), site-content.js (FAQ, legal)
public/js/site.js         every page: menu, tool search, homepage drop box (tiny)
public/js/tool.js         tool pages: upload, file list, page grid, settings, progress, result
public/js/processors/     browser processors: organize, convert, enhance, editor
public/js/lib/            lazy loaders (pdf-lib, PDF.js, JSZip), drag-to-sort, file hand-off
```

- **Adding a tool.** Add an entry to `lib/tools.js`, add its copy to
  `content/tools-content.js`, then write the processor. For a browser tool, export a function
  from a module in `public/js/processors/`. For a server tool, add an entry to `PROCESSORS` in
  `lib/engines/index.js`. Pages, menus, search, the sitemap, structured data, the settings form
  and the API all follow from the registry.
- **External services.** Each server processor is `{ needs(caps), run(job) }`. To use a hosted
  conversion API for one tool, replace its `run()` with a call to that service. The route, the
  validation and the UI stay as they are.
- **Tool page states.** Each tool page goes through these states, set as `data-state` on
  `#tool-app`: initial, selected, processing, success, error. Errors shown to visitors are
  plain sentences. Stack traces go only to the server log, or to the browser console for
  unexpected browser-side errors.
- **Hand-off.** A file dropped on the homepage, or a result passed on with "Continue with this
  file", is handed to the next tool page through IndexedDB in the same browser. It is deleted
  as soon as that page reads it.

## Performance

- Pages are rendered on the server and cached in memory. The homepage is about 15 KB gzipped
  and loads one 6 KB script.
- The PDF libraries are not loaded on the homepage. Tool pages load their processor module
  when the browser is idle, and load pdf-lib and PDF.js only once they are needed.
- CSS and JS are versioned by content hash and cached for a year.

## Privacy and security

- Browser tools upload nothing.
- Server uploads are checked by extension and by their first bytes, limited in size
  (`MAX_UPLOAD_MB`), and processed under a job queue (`MAX_JOBS`, `MAX_QUEUE`) with a timeout
  (`JOB_TIMEOUT_S`) and a page limit (`MAX_PAGES`).
- Commands run without a shell, and file names on disk are never the visitor's.
- Ghostscript runs with `-dSAFER`. LibreOffice runs with macros disabled and untrusted links
  blocked.
- Upload folders are deleted when the response finishes. A sweeper deletes anything older than
  an hour.
- The server logs no file names or file contents.
- Security headers (CSP, nosniff and others) come from helmet. Scripts are served only from
  this site, with nothing from a CDN.
- `/api/` is rate limited (`RATE_LIMIT_MAX` requests per IP per 15 minutes).

## AdSense

No ad code is output until you set `ADSENSE_CLIENT=ca-pub-…`. Then:

- The AdSense script is loaded on content pages, `/ads.txt` is served, and the CSP is widened
  for Google's ad hosts.
- Ad units appear in four reserved places, but only for the slots you give an id:
  `ADSENSE_SLOT_TOP` (lower homepage), `ADSENSE_SLOT_CONTENT` (between sections),
  `ADSENSE_SLOT_TOOL` (below the tool, never inside it) and `ADSENSE_SLOT_FOOTER`.
  Alternatively, enable Auto ads in AdSense.
- `SHOW_AD_PLACEHOLDERS=1` draws labelled outlines where the ads will go, for layout work only.
- Publish the GDPR consent message in AdSense (Privacy & messaging) for EEA, UK and Swiss
  visitors. Review `/privacy` and `/cookies` and adjust them for your situation.

## SEO

Every tool has its own URL (`/merge-pdf`, `/pdf-to-word`…). Each tool page has:

- a unique title and meta description
- one H1, an introduction, numbered how-to steps, features and an FAQ
- related-tool links and breadcrumbs
- a canonical URL and Open Graph tags
- JSON-LD: Organization, BreadcrumbList, WebApplication (price 0) and FAQPage

The site also has category pages (`/tools/convert`…), a searchable `/tools` page,
`sitemap.xml` and `robots.txt`. URLs are normalised with 301 redirects (lower case, no trailing
slash, optional canonical host).

## Tests

```bash
npm test          # pages, SEO metadata, links, "no paywall" check, API, every server engine
npm run test:e2e  # real browser (Playwright): every tool, drag and drop, errors, phone layout
```

`npm test` skips a server tool's checks when its engine is missing. `test:e2e` needs Playwright
(`npm i -g playwright`, or set `PLAYWRIGHT_PATH`).

## Honest limits

- **PDF to Word, Excel and PowerPoint** rebuild the layout. Simple documents convert well;
  complex layouts may need touch-ups. Scanned PDFs have no text until you run OCR PDF on them.
- **The editor adds content on top of the page.** It does not reflow existing text. To change
  existing wording, cover it with White-out and type over it.
- **Sign PDF** places a picture of the signature. It is not a certificate-based digital
  signature.
- **HTML to PDF** takes an uploaded `.html` file, not a URL. Online images and stylesheets are
  not downloaded, on purpose.
- **Redacted pages** become images at about 200 dpi, so text on those pages can't be selected
  any more.
- **OCR languages** depend on the installed `tesseract-ocr-*` packages. The Dockerfile installs
  16.
- **PyMuPDF licence.** pdf2docx uses PyMuPDF, which is AGPL-licensed. If that is a problem for
  your deployment, uninstall pdf2docx and PDF to Word falls back to LibreOffice.
