# FlipItFree: free online file converter

Convert video, audio, images, documents, spreadsheets, presentations, ebooks, archives and
fonts. Built only on free, open-source engines, with no paid API keys.

With every engine installed (see the Dockerfile) the server performs **2,420 conversions**
plus 7 compressors, across 129 input formats. Every one of those formats was converted for
real in `test/conversions.test.js`. Without the system tools it still does images, image to
PDF and web fonts.

## Requirements

- Node.js 18 or newer.
- For anything beyond images, the command-line engines below. The easiest route is the
  Dockerfile, which installs them all on Ubuntu 24.04.

## Local setup

```bash
npm install
cp .env.example .env    # adjust PORT / limits if you want
npm start
```

Then open `http://localhost:3000`. On startup the server checks which engines are installed
and only offers those conversions; everything else stays in the menus as "coming soon".

## Conversion engines

| Engine | Ubuntu/Debian packages | Converts |
|---|---|---|
| Sharp (libvips), Jimp, png-to-ico | npm, always installed | JPG, PNG, WebP, AVIF, TIFF, GIF, BMP, SVG, JFIF, ICO |
| pdf-lib | npm, always installed | images to PDF |
| wawoff2 + built-in WOFF | npm, always installed | TTF/OTF to and from WOFF/WOFF2 |
| FFmpeg | `ffmpeg` | 25 video and 18 audio formats, video to audio, video to GIF/WebP, GIF to video |
| LibreOffice | `libreoffice-*-nogui` (core, writer, calc, impress, draw) | DOC, DOCX, DOCM, DOT, DOTX, ODT, RTF, TXT, HTML, PDF; XLS, XLSX, XLSM, ODS, CSV, TSV; PPT, PPTX, PPTM, PPS, PPSX, POT, POTX, ODP; slides to JPG/PNG |
| Pandoc | `pandoc` | Markdown, reStructuredText, LaTeX to and from HTML, DOCX, ODT, RTF, TXT, EPUB (PDF via LibreOffice) |
| Calibre | `calibre` | EPUB, MOBI, AZW, AZW3, PRC, FB2, HTMLZ, LIT, LRF, PDB, RB, TCR, TXTZ, CBZ, PDF, DOCX and more |
| Poppler + Ghostscript | `poppler-utils ghostscript` | PDF to JPG/PNG/WebP/TIFF/TXT/HTML/SVG/EPS/PS, PDF compression, EPS/PS to images |
| Inkscape | `inkscape` | SVG, SVGZ, EPS, PS, AI, EMF, WMF to each other, to PDF and to images |
| ImageMagick | `imagemagick` | PSD, ICO, PPM input; BMP, PSD, EPS, PS output |
| libheif | `libheif-examples libheif-plugin-libde265` | HEIC/HEIF (iPhone photos) to every image format and PDF |
| DjVuLibre | `djvulibre-bin` | DjVu to PDF, TIFF, TXT, JPG, PNG |
| libarchive + 7-Zip | `libarchive-tools p7zip-full xz-utils lzip lzop ncompress` | ZIP, JAR, 7Z, TAR, TAR.GZ/BZ2/XZ/7Z/Z/LZO, GZ, BZ2, XZ, LZ, LZMA, LZO, Z, CPIO, ISO, DEB to ZIP, 7Z, TAR (+GZ/BZ2/XZ/7Z), GZ, BZ2, XZ |

How it is wired:

- `registry/engines.js` lists each engine and the binaries it needs. `engines/detect.js`
  checks them at startup. LibreOffice also checks that Writer, Calc and Impress are installed,
  because `soffice` alone cannot open documents.
- `registry/converters.js` marks a rule `live` only for formats that were tested end to end.
  If its engine is missing on a server, the rule counts as planned there.
- `engines/<name>.js` does the work. Command-line jobs run without a shell, in a private
  temp folder that is always deleted, with a timeout (`JOB_TIMEOUT_S`) and a limit on parallel
  jobs (`MAX_JOBS`). Archives are checked against zip bombs (`MAX_EXTRACT_MB`) and paths that
  escape the folder.
- Conversions that produce several files (PDF pages, slides) return a ZIP.

Still planned, because they could not be tested here: camera RAW files, XCF, ICNS, DXF/DWG,
CDR, VSD, CGM, XPS, Apple Pages/Numbers/Keynote, HWP/LWP/WPD/WPS, RAR/CAB/LHA/ARJ/DMG input,
AMR output, TTF to OTF outlines, EOT, PDF to DOCX via LibreOffice (Calibre handles PDF to DOCX).

### Tests

```bash
npm test                  # everything, with one real conversion per engine rule
npm run test:conversions  # every input and output format of every live rule (~3 minutes)
```

Tests for the image-only build switch detection off (`SQUISH_DETECT=0`) so they give the same
result on any machine; the conversion and SEO tests use whatever is installed.

## Image format notes

| Format | Notes |
|---|---|
| GIF | Animation is **kept** only when the output format is GIF or WebP (or a video format). |
| SVG | Rasterized at its declared size for image outputs; Inkscape keeps it as vectors for EPS/PDF/EMF/WMF. |
| ICO | Output is a real multi-resolution favicon (16-256px). As input, the largest size is used. |
| BMP | Read via Jimp (libvips can't read BMP); written via ImageMagick. |
| HEIC / HEIF | Decoded with libheif. Prebuilt Sharp cannot read HEIC, so this needs `libheif-plugin-libde265`. |

## Site layout (CloudConvert-style)

The site is laid out like CloudConvert: a dark grey header and hero with a **Tools** mega menu,
a "File Converter" heading with a `convert [X] to [Y]` box and a red **Select File** button,
then the upload tool, feature blocks, popular conversions and every converter category.
Every format has a file-type icon coloured by category, and while nothing is chosen the
`convert [X] to [Y]` box cycles through popular conversions (switched off for visitors who
prefer reduced motion).

- **Tools** menu: search box, every category on the left (Archive ... Video, plus Popular and
  Compress), every format on the right. **Convert** and **Compress** menus list the category
  pages and compressors. Formats with a working conversion have a green dot; the rest are
  marked *soon*.
- The **convert [X] to [Y]** box: choose an input and the output list fills with every
  format it can become (grouped by category). Choosing an output opens that conversion's page.
- The upload tool on the home and category pages takes any supported file: images use the
  "Convert images to" setting, and every other file gets its own "to [format]" list.

### Catalogue vs. what actually works

The registry (`registry/`) holds the full CloudConvert-style catalogue: **194 formats in
12 categories and about 3,450 conversions**. With every engine installed, 2,420 of them are
`live`; the rest are `planned` (see "Conversion engines" above).

Every conversion gets a page and appears in the menus, but:

| | Live | Planned / experimental |
|---|---|---|
| Upload tool | Yes | No: a "Coming soon" box with working alternatives |
| `robots` | `index, follow` + canonical | `noindex, follow` |
| In `sitemap.xml` | Yes | No |
| `POST /api/compress` | Accepted | Rejected (HEIC is attempted) |

To switch a conversion on: install its engine, add a handler in `engines/`, set the rule's
status to `live` in `registry/converters.js`, and add a sample maker in `test/samples.js` so
`npm run test:conversions` proves it works. Pages, menus, sitemap and API follow automatically.

## Pages (one per conversion)

- `/` home, `/converters` every format grouped by category
- `/image-converter`, `/video-converter` ... one page per category
- `/png-converter`, `/mp4-converter` ... one page per format, listing every conversion to and from it
- `/png-to-webp`, `/mp4-to-mp3`, `/tar-gz-to-zip` ... one page per conversion
- `/compress-png` ... compressor pages
- `/sitemap.xml`, `/robots.txt`

Live pages get their own title, meta description, canonical URL, H1, intro text, format
description cards, pair-specific notes, FAQ and JSON-LD structured data, and the
output-format dropdown is pre-selected (e.g. `/png-to-webp` opens with WebP chosen).
Alias spellings 301-redirect to the canonical URL (`/jpeg-to-png` to `/jpg-to-png`,
`/jpeg-converter` to `/jpg-converter`).

To add or remove a format, edit `registry/formats.js` and `registry/converters.js`; pages,
menus, sitemap and hub update automatically.

## SEO

### What the code already does

| Area | What is in place |
|---|---|
| Indexing | Only pages with a working tool or real content are indexable and in `sitemap.xml`. "Coming soon" pages are `noindex, follow`, so they never count as thin content. |
| One URL per page | Canonical tags; 301s for upper case, trailing slashes, `//`, `/index.html` and alias spellings (`/jpeg-to-png` to `/jpg-to-png`). Set `FORCE_CANONICAL_HOST=1` to also 301 http to https and www to non-www (or the reverse, whatever `BASE_URL` says). |
| Titles and snippets | Unique title (65 chars max) and meta description (165 max) on every indexable page. `max-image-preview:large` and `max-snippet:-1` robots directives. |
| Structured data | Organization, WebSite, WebApplication (free offer, feature list), FAQPage and BreadcrumbList as one linked JSON-LD graph; AboutPage/ContactPage/CollectionPage where they fit. |
| Social sharing | Open Graph and Twitter card tags, plus a generated 1200x630 share image per page (`/og/<page>.png`). |
| Icons and app | `favicon.ico`, `favicon.svg`, Apple touch icon, 192/512 icons, a maskable icon and `site.webmanifest`, all generated from the brand mark. |
| Content | Visible breadcrumbs, a "How to convert X to Y" section, an X vs Y comparison table, format descriptions, conversion notes, FAQ and related links on every live conversion page. |
| Trust (E-E-A-T, AdSense) | `/about`, `/privacy`, `/terms` and `/contact` pages, linked from the footer. Review the wording and set `CONTACT_EMAIL`. |
| Speed (Core Web Vitals) | Server-rendered HTML (about 5 ms), gzip, pages of 9-23 KB over the wire, versioned CSS/JS cached for a year, deferred scripts, `font-display: swap`. |
| Verification | `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `YANDEX_VERIFICATION`, `PINTEREST_VERIFICATION`, and `INDEXNOW_KEY` for Bing/Yandex IndexNow. |
| Guard rails | `test/seo.test.js` fails the build on duplicate or over-long titles/descriptions, a missing or extra H1, a missing canonical or OG tag, invalid JSON-LD, breadcrumbs that do not match, or any broken internal link. |

### What was left out on purpose

- **`<meta name="keywords">`**: Google ignores it, and Bing treats a stuffed one as a spam signal.
- **Fake star ratings or review counts**: Google penalises self-made `aggregateRating` markup.
- **Indexable pages for conversions that do not work**: hundreds of near-identical pages that fail for visitors is exactly what Google's spam policies call doorway or thin content. They stay `noindex` until they are live.
- **Keyword stuffing, hidden text, bought links, cloaking**: these get sites penalised or removed from the index.

### What only you can do

No code can guarantee a #1 ranking, or keep one forever. Rankings depend on competition, links from other sites and how useful visitors find the pages, and Google changes its algorithm several times a year. What moves rankings most:

1. **Deploy on your own domain with HTTPS**, set `BASE_URL` and `FORCE_CANONICAL_HOST=1`.
2. **Google Search Console**: verify (set `GOOGLE_SITE_VERIFICATION`), submit `/sitemap.xml`, then check *Pages* and *Core Web Vitals* every few weeks. Do the same in **Bing Webmaster Tools**.
3. **Make more conversions live.** Each one becomes a new indexable page with real search demand. JPG to PDF, HEIC to JPG, MP4 to MP3, PDF to Word and WebP to GIF are among the most searched conversions.
4. **Earn links**: list the tool on directories such as AlternativeTo and Product Hunt, answer questions on Reddit and Stack Exchange where it genuinely helps, and write useful guides (for example "WebP vs AVIF").
5. **Keep it fast and reliable.** Downtime and slow pages cost rankings quickly.

**Before going live:**
1. Set `BASE_URL` (e.g. `https://yourdomain.com`) so canonical tags and the sitemap use your real domain.
2. Set `SITE_NAME` to your brand (default `FlipItFree`).
3. If you're behind Nginx / Render / Railway, set `TRUST_PROXY=1`.
4. Submit `https://yourdomain.com/sitemap.xml` in Google Search Console (and Bing Webmaster Tools).

**Honest expectations:** these pages make the site *eligible* to appear when someone
searches "png to webp" — they do not guarantee a ranking. Converter keywords are very
competitive (established sites have years of authority and backlinks), so expect months,
not days. What helps: a real domain, fast hosting over HTTPS, keeping the copy accurate,
and earning links from other sites.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the server listens on. |
| `MAX_FILE_MB` | `40` | Largest single upload accepted. Uploads are held in memory while they arrive, so match this to your server's memory; raise it if you expect long videos. |
| `MAX_JOBS` | `2` | Command-line conversions (video, documents, ...) that run at once; the rest wait in a queue. |
| `JOB_TIMEOUT_S` | `180` | A conversion that runs longer is stopped. |
| `MAX_OUTPUT_MB` | `500` | Largest converted file the server sends back. |
| `MAX_EXTRACT_MB` | `500` | Largest total size an archive may unpack to (zip-bomb protection). |
| `SQUISH_DISABLE` | unset | Comma-separated binaries to treat as missing, e.g. `ffmpeg` to switch video off. |
| `BASE_URL` | derived from request | Public site URL used in canonical tags, sitemap and robots.txt. Set this in production. |
| `SITE_NAME` | `FlipItFree` | Brand name used in page titles and footer. |
| `TRUST_PROXY` | unset | Number of reverse proxies in front of the app (usually `1`). Needed for correct visitor IPs behind a proxy. |
| `FORCE_CANONICAL_HOST` | unset | `1` = 301 every request to `BASE_URL`'s exact protocol and host. |
| `CONTACT_EMAIL` | unset | Shown on `/contact` and `/privacy` and in structured data. |
| `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `YANDEX_VERIFICATION`, `PINTEREST_VERIFICATION` | unset | Ownership verification meta tags. |
| `INDEXNOW_KEY` | unset | Serves `/<key>.txt` for IndexNow. |
| `TWITTER_SITE` | unset | `twitter:site` handle on share cards. |
| `SITE_UPDATED` | content file dates | Sitemap `lastmod` override (YYYY-MM-DD). |
| `RATE_LIMIT_MAX` | `120` | Compress requests allowed per IP per 15-minute window (applies to `/api/` only, so search-engine crawlers are never rate-limited). This is the main safety valve against a runaway hosting bill on a public "unlimited free" tool — tune it to what your hosting plan can actually absorb. |

## Deploying live

**Important: this needs a host that runs a persistent Node.js process.**
Pure static hosts (GitHub Pages, a plain Netlify/Vercel static site, S3 alone)
will **not** run `server.js` — there's no server there to run it on. Use one
of:

- A Node-friendly PaaS with a free/cheap tier: Render, Railway, Fly.io.
- A VPS (DigitalOcean, Hetzner, Linode) running Node directly or via the
  included `Dockerfile`, behind Nginx/Caddy for HTTPS.
- Any host that explicitly advertises Node.js hosting.

Basic VPS steps:
```bash
git clone <your-repo>
cd squish-server
npm ci --omit=dev
cp .env.example .env
npm start              # or use pm2 / systemd to keep it running
```
Put Nginx or Caddy in front for TLS and to proxy port 80/443 → `PORT`.

Docker (recommended: it installs every conversion engine):
```bash
docker build -t flipfree .
docker run -p 3000:3000 --env-file .env flipfree
```
The image is about 3 GB because of LibreOffice and Calibre, and needs a host with at least
2 GB of RAM for document and video work. It was built and tested: inside the container, as
the unprivileged `squish` user, `npm test` (100 tests) and `npm run test:conversions` (410 real
conversions) all pass, and 16 simultaneous document/video conversions completed with every
temp folder cleaned up. The build stops with an error if `npm ci` leaves a dependency
missing, and the server logs at startup which engines (if any) are missing, e.g.:

```
2420 conversions live, 7 compressors live.
```

## Going live on a VPS

`deploy/setup.sh` sets up a fresh Ubuntu 24.04 server in one command: Docker, the site, Caddy for
HTTPS behind Cloudflare (SSL mode "Full"), a firewall that only lets Cloudflare reach ports
80/443, swap, and the production settings in `/opt/flipfree/.env`. `deploy/update.sh` pulls the
latest code and restarts. Step-by-step instructions (Roman Urdu): `deploy/GUIDE-URDU.md`.

## AdSense

Ads are off until you set `ADSENSE_CLIENT`; nothing ad-related is in the pages before that.

1. Put the site live on its own domain with `CONTACT_EMAIL` set, then apply at
   adsense.google.com (manual review, usually days to a few weeks).
2. Set `ADSENSE_CLIENT=ca-pub-...` and restart. This loads the AdSense script, serves
   `/ads.txt` and opens the Content-Security-Policy to the Google ad hosts.
3. Either turn on Auto ads in the AdSense dashboard, or create display ad units and set
   `ADSENSE_SLOT_TOP`, `ADSENSE_SLOT_BOTTOM` (in the page) and `ADSENSE_SLOT_LEFT`,
   `ADSENSE_SLOT_RIGHT` (160x600 side units on very wide screens).
4. In AdSense, Privacy & messaging, publish the GDPR consent message (required for
   visitors from the EEA, UK and Switzerland).

Ads only appear on pages with the converter. "Coming soon", legal, hub and 404 pages never
load the ad script, as AdSense does not allow ads on screens without publisher content.

## Cost/abuse notes

Video and document conversions are far heavier than image work: one long video can keep a
CPU core busy for minutes. `MAX_JOBS`, `JOB_TIMEOUT_S` and `MAX_FILE_MB` are the knobs, and
`SQUISH_DISABLE=ffmpeg` turns video off entirely if your plan cannot take it.

Unlike the old client-side-only version, compression now runs on **your**
server's CPU and uses **your** bandwidth for every upload/download. A public
"unlimited free" tool is exactly the kind of thing that gets hammered by
scripts. The rate limiter and file-size cap are there for a reason — raise
them once you've watched real traffic and know your hosting plan can take it,
not before.
