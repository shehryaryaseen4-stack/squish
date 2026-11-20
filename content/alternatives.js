'use strict';
// "Alternative to ..." pages: honest comparisons with the big converter and PDF sites, for people
// who search for a free alternative. Shown as guides (/guides/<slug>), with the same shape as
// content/articles.js; {{MAX_MB}} becomes this server's per-file limit.
//
// Rules for these pages:
// - Facts about other services only where their own pages say so (terms, pricing), with the month
//   they were checked; anything else is described in general words, never a number we could not
//   confirm. Prices and limits change, and every page says so.
// - Say plainly where the other service is the better choice.
// - Names are used only to say what is being compared: no logos, no claim of partnership.

const CHECKED = 'November 2026';
const ABOUT = (name) => ['About this comparison', `<p>This comparison was checked in ${CHECKED}. Free plans, limits and prices change, so check ${name}'s own pricing page before you decide. Flipit Free is not affiliated with ${name}; the name is used only to say what is being compared, and it belongs to its owner.</p>`];
const US_ROW = ['Price', 'Free: no sign-up, no email, no watermark', null];

const row = (cells) => `<tr>${cells.map((c, i) => (i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`)).join('')}</tr>`;
const table = (name, rows) => `<div class="table-wrap"><table class="compare-table"><thead><tr><th scope="col"></th><th scope="col">Flipit Free</th><th scope="col">${name}</th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table></div>`;

const COMMON_ROWS = (name, them) => [
  ['Price', 'Free, with no paid plan and no sign-up', them.price],
  ['Free limits', `Files up to {{MAX_MB}} MB each, and a fair-use cap on how many files one connection converts in a short time`, them.limits],
  ['Account needed', 'No', them.account],
  ['Watermark', 'No', them.watermark || 'No'],
  ['Merge, split and organize PDF', 'In your browser: the file is not uploaded', them.pdf],
  ['File conversion', '2,800+ conversions between 190+ formats: images, PDF, Office, video, audio, ebooks, archives, fonts', them.formats],
  ['Extras', 'Passport photos (US, UK and 40+ countries), resize image to an exact size in KB, video to JPG, OCR to an editable PDF', them.extras],
];

module.exports = [
  {
    slug: 'free-file-converter-alternatives',
    title: 'Free Alternatives to iLovePDF, Smallpdf and CloudConvert',
    h1: 'Free alternatives to the big file converter and PDF sites',
    desc: 'How Flipit Free compares with iLovePDF, Smallpdf, CloudConvert, Convertio and FreeConvert: free limits, sign-up, privacy, and when each is the better pick.',
    date: '2026-11-21',
    tools: ['/converters', '/pdf-tools', '/compress-pdf', '/pdf-to-word'],
    intro: 'iLovePDF, Smallpdf, CloudConvert, Convertio and FreeConvert are well known, and each has a free plan with limits that push you toward a paid one. Flipit Free does the everyday jobs for free, with no account. Here is an honest look at how they compare, and when one of them is the better pick.',
    sections: [
      ['The short version', `<ul>
<li><strong>Need it free, now, with no account?</strong> Flipit Free: no sign-up, no watermark, no daily plan to upgrade from.</li>
<li><strong>Private documents?</strong> Merge, split and organize PDF, the image resizer and the passport photo maker run in your browser on Flipit Free, so those files are never uploaded.</li>
<li><strong>Very large files, a desktop app, cloud storage connections or an API?</strong> The paid plans of the big services offer those, and Flipit Free does not.</li>
</ul>`],
      ['Compare one by one', `<ul>
<li><a href="/guides/ilovepdf-alternative">Free alternative to iLovePDF</a></li>
<li><a href="/guides/smallpdf-alternative">Free alternative to Smallpdf</a></li>
<li><a href="/guides/cloudconvert-alternative">Free alternative to CloudConvert</a></li>
<li><a href="/guides/convertio-alternative">Free alternative to Convertio</a></li>
<li><a href="/guides/freeconvert-alternative">Free alternative to FreeConvert</a></li>
</ul>`],
      ['What Flipit Free does well', `<ul>
<li>2,800+ conversions between 190+ formats, including rare ones such as SWF, LZ, DjVu and PRC.</li>
<li>PDF tools: <a href="/merge-pdf">merge</a>, <a href="/split-pdf">split</a>, <a href="/compress-pdf">compress</a>, <a href="/pdf-to-word">PDF to Word</a>, <a href="/ocr-pdf">OCR</a>, protect and unlock.</li>
<li>Everyday image jobs: <a href="/image-resizer">resize to an exact size in KB</a>, <a href="/passport-photo-maker">passport photos</a>, <a href="/heic-to-jpg">iPhone HEIC to JPG</a>.</li>
<li>Video: <a href="/compress-video">compress video</a> to a size in MB and <a href="/video-to-jpg">save pictures from a video</a>.</li>
</ul>`],
      ['Where Flipit Free is not the right tool', `<p>Files bigger than {{MAX_MB}} MB, hundreds of files a day for a business, a desktop or mobile app, e-signature workflows for a team, or connecting Google Drive and Dropbox: for those, a paid plan from one of the big services fits better.</p>`],
      ABOUT('each service'),
    ],
    faq: [
      ['Is there a free alternative to iLovePDF and Smallpdf with no limits?', 'Flipit Free has no daily plan and no sign-up: the limits are a file size of {{MAX_MB}} MB and a fair-use cap on how many files one connection converts in a short time.'],
      ['Which online converter does not need an account?', 'Flipit Free needs no account, email or sign-up for any tool.'],
      ['Which PDF tools do not upload my file?', 'On Flipit Free, merge, split and organize PDF run in your browser, so the file stays on your device.'],
    ],
  },
  {
    slug: 'ilovepdf-alternative',
    title: 'Free iLovePDF Alternative: No Sign-Up, No Upload Merging',
    h1: 'A free alternative to iLovePDF',
    desc: 'Looking for a free iLovePDF alternative? Flipit Free merges, splits, compresses and converts PDFs with no sign-up, and merges and splits in your browser.',
    date: '2026-11-21',
    tools: ['/merge-pdf', '/split-pdf', '/compress-pdf', '/pdf-to-word'],
    intro: 'iLovePDF is one of the best-known PDF sites, with a free version and a Premium plan. If you just need to merge, split, compress or convert a PDF without an account, Flipit Free does those for free, and runs merging and splitting in your browser.',
    sections: [
      ['At a glance', table('iLovePDF', COMMON_ROWS('iLovePDF', {
        price: 'Free version with limits; Premium and Business plans',
        limits: 'The free version limits file sizes and how much you can process; Premium removes those limits',
        account: 'Not for basic tools; some features need an account',
        pdf: 'Processed on its servers',
        formats: 'Mainly PDF and Office documents, plus images',
        extras: 'Desktop and mobile apps, e-signatures, team plans (paid features vary)',
      }))],
      ['Why people look for an alternative', `<ul>
<li>A limit on the free version gets in the way of a big file or a batch of documents.</li>
<li>They would rather not upload private documents (bank statements, contracts, IDs) to merge or split them.</li>
<li>They also need non-PDF conversions: video, audio, ebooks, archives, fonts.</li>
</ul>`],
      ['Do the same jobs on Flipit Free', `<ul>
<li><a href="/merge-pdf">Merge PDF</a> and <a href="/split-pdf">Split PDF</a>: in your browser, nothing uploaded.</li>
<li><a href="/compress-pdf">Compress PDF</a>: Light, Recommended, Strong or Extreme.</li>
<li><a href="/pdf-to-word">PDF to Word</a>, <a href="/word-to-pdf">Word to PDF</a>, <a href="/jpg-to-pdf">JPG to PDF</a>, <a href="/pdf-to-jpg">PDF to JPG</a>.</li>
<li><a href="/ocr-pdf">OCR PDF</a>: make a scan searchable, or turn it into an editable PDF.</li>
<li>Protect and unlock PDFs, and <a href="/pdf-tools">all PDF tools</a>.</li>
</ul>`],
      ['When iLovePDF is the better choice', `<p>If you need a desktop app, a team account, e-signature requests to other people, or you regularly process files bigger than {{MAX_MB}} MB, iLovePDF's paid plans offer those and Flipit Free does not.</p>`],
      ABOUT('iLovePDF'),
    ],
    faq: [
      ['Is Flipit Free really free?', 'Yes. There is no paid plan, no sign-up and no watermark. Files can be up to {{MAX_MB}} MB each.'],
      ['Can I merge PDFs without uploading them?', 'Yes. Merge PDF on Flipit Free runs in your browser, so the files never leave your device.'],
      ['Does Flipit Free have a desktop app?', 'No. It works in any browser on Windows, Mac, Android and iPhone, with nothing to install.'],
    ],
  },
  {
    slug: 'smallpdf-alternative',
    title: 'Free Smallpdf Alternative With No Sign-Up or Daily Plan',
    h1: 'A free alternative to Smallpdf',
    desc: 'Looking for a free Smallpdf alternative? Flipit Free compresses, converts, merges and splits PDFs with no account, no watermark and no Pro plan to upgrade to.',
    date: '2026-11-21',
    tools: ['/compress-pdf', '/pdf-to-word', '/merge-pdf', '/jpg-to-pdf'],
    intro: 'Smallpdf is a popular PDF site with a free plan and a paid Pro plan. Its free plan limits how much you can do before asking you to upgrade. Flipit Free covers the everyday PDF jobs for free, with no account and no Pro plan.',
    sections: [
      ['At a glance', table('Smallpdf', COMMON_ROWS('Smallpdf', {
        price: 'Free plan with limits; paid Pro and Team plans',
        limits: 'The free plan limits how much you can do; Pro removes the limits',
        account: 'Needed for some features and for saving work',
        pdf: 'Processed on its servers',
        formats: 'PDF, Office documents and images',
        extras: 'Desktop and mobile apps, e-signatures, team features (paid features vary)',
      }))],
      ['Do the same jobs on Flipit Free', `<ul>
<li><a href="/compress-pdf">Compress PDF</a> to fit email and upload limits.</li>
<li><a href="/pdf-to-word">PDF to Word</a> and <a href="/word-to-pdf">Word to PDF</a>, keeping the layout.</li>
<li><a href="/merge-pdf">Merge</a> and <a href="/split-pdf">split</a> PDFs in your browser.</li>
<li><a href="/jpg-to-pdf">JPG to PDF</a> and <a href="/heic-to-pdf">HEIC to PDF</a> for phone photos of documents.</li>
<li><a href="/ocr-pdf">OCR PDF</a> for scans.</li>
</ul>`],
      ['When Smallpdf is the better choice', `<p>If you want a desktop app, an account that keeps your documents, e-signature requests for a team, or very large files, Smallpdf's paid plans cover those and Flipit Free does not.</p>`],
      ABOUT('Smallpdf'),
    ],
    faq: [
      ['Is there a Smallpdf alternative without a daily limit?', 'Flipit Free has no daily plan or Pro upgrade. The limits are {{MAX_MB}} MB per file and a fair-use cap on how many files one connection converts in a short time.'],
      ['Do I need an account on Flipit Free?', 'No. Every tool works without an account or email.'],
    ],
  },
  {
    slug: 'cloudconvert-alternative',
    title: 'Free CloudConvert Alternative: Convert Files, No Account',
    h1: 'A free alternative to CloudConvert',
    desc: 'Looking for a free CloudConvert alternative? Flipit Free converts images, video, audio, documents and ebooks (190+ formats) with no account or daily plan.',
    date: '2026-11-21',
    tools: ['/converters', '/video-converter', '/image-converter', '/document-converter'],
    intro: 'CloudConvert converts between hundreds of formats and offers a free daily allowance, with paid packages and subscriptions for more. Flipit Free converts between 190+ formats for free, with no account and no daily allowance to buy more of.',
    sections: [
      ['At a glance', table('CloudConvert', COMMON_ROWS('CloudConvert', {
        price: 'Free daily allowance; paid packages and subscriptions',
        limits: 'A limited number of free conversions per day, set on its pricing page',
        account: 'Needed for some features',
        pdf: 'Processed on its servers',
        formats: 'Hundreds of formats',
        extras: 'API, integrations with cloud storage, advanced conversion options',
      }))],
      ['Do the same jobs on Flipit Free', `<ul>
<li><a href="/video-converter">Video</a>: MOV to MP4, MKV to MP4, MP4 to MP3, and <a href="/video-to-jpg">video to JPG</a>.</li>
<li><a href="/image-converter">Images</a>: HEIC, WebP, AVIF, PNG, JPG, SVG, TIFF and RAW camera files.</li>
<li><a href="/document-converter">Documents</a>, <a href="/ebook-converter">ebooks</a>, <a href="/archive-converter">archives</a> and <a href="/font-converter">fonts</a>.</li>
<li>Many files at once, downloaded together as a ZIP.</li>
</ul>`],
      ['When CloudConvert is the better choice', `<p>For an API, automated workflows, connections to cloud storage, very large files or fine control over codecs and settings, CloudConvert is built for that and Flipit Free is not.</p>`],
      ABOUT('CloudConvert'),
    ],
    faq: [
      ['Is there a free CloudConvert alternative?', 'Flipit Free converts between 190+ formats for free, with no account, no watermark and no daily allowance to buy more of.'],
      ['Does Flipit Free have an API?', 'No. It is a website for converting files by hand, in any browser.'],
    ],
  },
  {
    slug: 'convertio-alternative',
    title: 'Free Convertio Alternative: No Sign-Up, No Daily Minutes',
    h1: 'A free alternative to Convertio',
    desc: 'Looking for a free Convertio alternative? Flipit Free converts images, video, audio, documents and ebooks with no account and no daily conversion minutes.',
    date: '2026-11-21',
    tools: ['/converters', '/compress-video', '/mp4-to-mp3', '/heic-to-jpg'],
    intro: 'Convertio converts between many formats. On its free tier, its terms set a file size limit and a number of conversion minutes per day. Flipit Free has no conversion minutes and no account; the limit is the file size.',
    sections: [
      ['At a glance', table('Convertio', COMMON_ROWS('Convertio', {
        price: 'Free tier; paid Light, Basic and Unlimited plans',
        limits: `Files up to 100 MB, 2 conversions at a time and 10 conversion minutes per 24 hours on the free tier (its terms, ${CHECKED})`,
        account: 'Not needed for basic use',
        pdf: 'Processed on its servers',
        formats: 'Hundreds of formats',
        extras: 'Bigger files and unlimited use on paid plans, API',
      }))],
      ['Do the same jobs on Flipit Free', `<ul>
<li><a href="/mp4-to-mp3">MP4 to MP3</a>, <a href="/mov-to-mp4">MOV to MP4</a> and <a href="/compress-video">compress video</a>.</li>
<li><a href="/heic-to-jpg">HEIC to JPG</a>, <a href="/png-to-jpg">PNG to JPG</a>, <a href="/webp-to-jpg">WebP to JPG</a>.</li>
<li><a href="/pdf-to-word">PDF to Word</a>, <a href="/epub-to-pdf">EPUB to PDF</a>, <a href="/rar-to-zip">RAR to ZIP</a>.</li>
</ul>`],
      ['When Convertio is the better choice', `<p>Convertio's free tier accepts files up to 100 MB, larger than Flipit Free's {{MAX_MB}} MB, and its paid plans go further. For big video files, Convertio fits better; on Flipit Free, <a href="/compress-video">compress the video</a> or <a href="/trim-video">trim it</a> first.</p>`],
      ABOUT('Convertio'),
    ],
    faq: [
      ['Does Flipit Free have conversion minutes like Convertio?', 'No. There are no conversion minutes. The limits are {{MAX_MB}} MB per file and a fair-use cap on how many files one connection converts in a short time.'],
      ['Which accepts bigger files, Convertio or Flipit Free?', `Convertio: its free tier allows files up to 100 MB (${CHECKED}), and Flipit Free allows {{MAX_MB}} MB.`],
    ],
  },
  {
    slug: 'freeconvert-alternative',
    title: 'Free FreeConvert Alternative With No Conversion Minutes',
    h1: 'A free alternative to FreeConvert',
    desc: 'Looking for a FreeConvert alternative? Flipit Free converts files with no conversion minutes, no account and no watermark, plus PDF tools in your browser.',
    date: '2026-11-21',
    tools: ['/converters', '/compress-video', '/compress-pdf', '/image-resizer'],
    intro: 'FreeConvert gives free users a number of conversion minutes per day, as its pricing page explains, with paid plans for more. Flipit Free has no conversion minutes or account; the limit is the file size.',
    sections: [
      ['At a glance', table('FreeConvert', COMMON_ROWS('FreeConvert', {
        price: 'Free with daily conversion minutes; paid plans',
        limits: `20 conversion minutes per day and up to 5 minutes per file for free users (its pricing page, ${CHECKED})`,
        account: 'Not needed for basic use',
        pdf: 'Processed on its servers',
        formats: 'Hundreds of formats',
        extras: 'Bigger files and more minutes on paid plans, API',
      }))],
      ['Do the same jobs on Flipit Free', `<ul>
<li><a href="/compress-video">Compress video</a> to a size in MB, for Discord, email or WhatsApp.</li>
<li><a href="/compress-pdf">Compress PDF</a> and <a href="/compress-jpg">compress images</a>.</li>
<li><a href="/image-resizer">Resize an image</a> to an exact size in KB.</li>
<li>Convert images, video, audio, documents and ebooks: <a href="/converters">all converters</a>.</li>
</ul>`],
      ['When FreeConvert is the better choice', `<p>For files bigger than {{MAX_MB}} MB, long videos, or an API, FreeConvert's plans offer more than Flipit Free.</p>`],
      ABOUT('FreeConvert'),
    ],
    faq: [
      ['Does Flipit Free limit conversion minutes?', 'No. There are no conversion minutes. The limits are {{MAX_MB}} MB per file and a fair-use cap on how many files one connection converts in a short time.'],
    ],
  },
];
