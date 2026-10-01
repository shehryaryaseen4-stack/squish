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
