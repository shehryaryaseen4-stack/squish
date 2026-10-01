# Squish — Server-Side Image Compressor

Upload images, get them back compressed/converted. Built with free, open-source
libraries only — no paid API keys required.

## What changed from the browser-only version

A browser can only *encode* images to JPEG, PNG or WebP — that's a platform
limit, not a code limit. This server uses [Sharp](https://sharp.pixelplumbing.com/)
(built on libvips) plus a couple of small helpers, so it can genuinely read and
write far more formats. See the **Format support** table below for exactly
what's guaranteed vs. conditional — please read it before promising customers
"every format" works, because two formats (true HEIC decoding, and .ico as an
*input*) depend on things outside this project's control.

## Requirements

- Node.js 18 or newer
- A Linux/macOS/Windows server or VM. Sharp ships prebuilt binaries for common
  platforms, so `npm install` alone is normally enough — no separate libvips
  install needed on the common hosting platforms (Debian/Ubuntu, Alpine via
  the musl build, macOS, Windows).

## Local setup

```bash
npm install
cp .env.example .env    # adjust PORT / limits if you want
npm start
```

Then open `http://localhost:3000`.

## Format support

| Format | Input | Output | Notes |
|---|---|---|---|
| JPEG | Yes | Yes | Universal. |
| PNG | Yes | Yes | Lossless — best for screenshots, logos, transparency. |
| WebP | Yes | Yes | Usually the smallest at a given visual quality. Animated WebP is produced when the source is an animated GIF. |
| AVIF | Yes | Yes | Smallest files of all, but slower to encode — expect more CPU time per image. |
| TIFF | Yes | Yes | Common in scanning/print workflows. |
| GIF | Yes | Yes | Animation is **kept** only when the output format is GIF or WebP. Any other output format uses a single frame. |
| JFIF | Yes | — | Ordinary JPEG data with a `.jfif` extension; Sharp reads it directly. |
| BMP | Yes | — | Decoded via a Jimp fallback (libvips can't read BMP at all); always converted to another format on the way out. |
| SVG | Yes | — | Rasterized (turned into pixels) on input. Vector data is not preserved — if you need small vector files, minify with a tool like SVGO instead of running them through here. |
| ICO | — | Yes | Real multi-resolution favicons are generated from any input using `png-to-ico`. Reading an existing `.ico` as input is **not implemented** — legacy `.ico` parsing is a project of its own and wasn't worth the complexity for what is usually a one-off favicon-generation need. |
| HEIC / HEIF | Not verified | — | HEIC decoding depends on how libvips/libheif was built on your machine and I could not verify it here, so HEIC pages are shown as "coming soon" (noindex) and the upload box does not advertise it. If you want it, install a libvips build with HEIC support, test with a real iPhone photo, then set the `image-heic` rule in `registry/converters.js` to `live`. |
| RAW camera formats (.cr2, .nef, .arw, etc.) | No | — | Out of scope. These need a dedicated RAW decoder (e.g. `libraw`), which is a much heavier dependency than this project pulls in. |

## Site layout (CloudConvert-style)

The site is laid out like CloudConvert: a white header with a **Tools** mega menu, a
"File Converter" hero with a `convert [X] to [Y]` box and a red **Select File** button,
then the upload tool, feature blocks, popular conversions and every converter category.

- **Tools** menu: search box, every category on the left (Archive ... Video, plus Popular and
  Compress), every format on the right. **Convert** and **Compress** menus list the category
  pages and compressors. Formats with a working conversion have a green dot; the rest are
  marked *soon*.
- The **convert [X] to [Y]** box: choose an input and the output list fills with every
  format it can become (grouped by category). Choosing an output opens that conversion's page.

### Catalogue vs. what actually works

The registry (`registry/`) now holds the full CloudConvert-style catalogue: **194 formats in
12 categories and about 3,400 conversions**. Only the image conversions are `live` (57 pairs
plus 6 compressors); HEIC is `experimental`; everything else is `planned` and needs its engine
installed first (FFmpeg, LibreOffice, Calibre, ... see `registry/engines.js`).

Every conversion gets a page and appears in the menus, but:

| | Live | Planned / experimental |
|---|---|---|
| Upload tool | Yes | No: a "Coming soon" box with working alternatives |
| `robots` | `index, follow` + canonical | `noindex, follow` |
| In `sitemap.xml` | Yes | No |
| `POST /api/compress` | Accepted | Rejected (HEIC is attempted) |

To switch a conversion on: install its engine, add a handler in `engines/`, set the rule's
status to `live` in `registry/converters.js`. Pages, menus, sitemap and API follow automatically.

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
2. Set `SITE_NAME` to your brand (default `Squish`).
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
| `MAX_FILE_MB` | `40` | Largest single upload accepted. Raise/lower to match your server's memory — every upload is held in memory during processing. |
| `BASE_URL` | derived from request | Public site URL used in canonical tags, sitemap and robots.txt. Set this in production. |
| `SITE_NAME` | `Squish` | Brand name used in page titles and footer. |
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

Docker:
```bash
docker build -t squish .
docker run -p 3000:3000 --env-file .env squish
```

## AdSense

The ad slots in `views/page.html` are placeholders — see the comment at the
top of that file for the exact steps (get a live URL first, apply, wait for
review, then swap in your real `ca-pub-...` ID and ad slot IDs). The site's
Content-Security-Policy only allows its own scripts, so you also need to add the
AdSense hosts in `server.js` (there is a comment where).

## Cost/abuse notes

Unlike the old client-side-only version, compression now runs on **your**
server's CPU and uses **your** bandwidth for every upload/download. A public
"unlimited free" tool is exactly the kind of thing that gets hammered by
scripts. The rate limiter and file-size cap are there for a reason — raise
them once you've watched real traffic and know your hosting plan can take it,
not before.
