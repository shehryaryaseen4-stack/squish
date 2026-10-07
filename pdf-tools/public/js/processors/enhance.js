// Watermark, page numbers and document properties. Runs in the browser.
import { pdfLib, openForEdit, parsePages, baseName, pdfBlob, placer, fontFor, color, tick, ToolError } from '../lib/pdf.js';

const save = async (doc) => pdfBlob(await doc.save({ useObjectStreams: true }));

/** Draw `text` so that its centre is at visual point (vx, vy), turned `angle` degrees. */
function drawCentered(page, pl, text, { font, size, angle, color: c, opacity, vx, vy, degrees }) {
  const w = font.widthOfTextAtSize(text, size);
  const h = font.heightAtSize(size, { descender: false }) * 0.72;
  const a = ((angle + pl.rot) * Math.PI) / 180;
  const c0 = pl.toUser(vx, vy);
  const x = c0.x - ((w / 2) * Math.cos(a) - (h / 2) * Math.sin(a));
  const y = c0.y - ((w / 2) * Math.sin(a) + (h / 2) * Math.cos(a));
  page.drawText(text, { x, y, size, font, color: c, opacity, rotate: degrees(angle + pl.rot) });
}

export async function watermark({ files, options, progress }) {
  const { degrees } = await pdfLib();
  const { file } = files[0];
  const doc = await openForEdit(await file.arrayBuffer());
  const pages = doc.getPages();
  const targets = parsePages(options.pages, pages.length);
  const opacity = Math.min(1, Math.max(0.05, Number(options.opacity) / 100));
  const angle = Number(options.rotation) || 0;
  const tiled = options.layout === 'tile';

  let font; let img; let text;
  if (options.kind === 'image') {
    const imgFile = options.image;
    if (!imgFile) throw new ToolError('Choose an image (PNG or JPG) to use as the watermark.');
    const buf = await imgFile.arrayBuffer();
    const head = new Uint8Array(buf, 0, 2);
    try { img = head[0] === 0xff && head[1] === 0xd8 ? await doc.embedJpg(buf) : await doc.embedPng(buf); } catch {
      throw new ToolError('The watermark image could not be read. Please use a PNG or JPG file.');
    }
  } else {
    text = String(options.text || '').trim();
    if (!text) throw new ToolError('Type the watermark text first.');
    font = await fontFor(doc, text, 'HelveticaBold');
  }
  const col = await color(options.color);
  const size = Math.min(300, Math.max(8, Number(options.fontSize) || 60));

  for (let n = 0; n < targets.length; n++) {
    if (n % 20 === 0) { progress(n / targets.length, `Watermarking page ${n + 1} of ${targets.length}`); await tick(); }
    const page = pages[targets[n]];
    const pl = placer(page);
    const spots = [];
    if (tiled) {
      const stepX = img ? pl.vw / 3 : Math.max(size * 0.6 * text.length * 0.7, 160);
      const stepY = img ? pl.vh / 4 : size * 3.2;
      for (let y = stepY / 2; y < pl.vh + stepY; y += stepY) {
        const shift = (Math.round(y / stepY) % 2) * stepX / 2;
        for (let x = -stepX / 2 + shift; x < pl.vw + stepX; x += stepX) spots.push([x, y]);
      }
    } else spots.push([pl.vw / 2, pl.vh / 2]);

    for (const [vx, vy] of spots) {
      if (img) {
        const target = (tiled ? 0.22 : 0.45) * Math.min(pl.vw, pl.vh);
        const s = target / Math.max(img.width, img.height);
        const w = img.width * s; const h = img.height * s;
        const a = ((angle + pl.rot) * Math.PI) / 180;
        const c0 = pl.toUser(vx, vy);
        page.drawImage(img, {
          x: c0.x - ((w / 2) * Math.cos(a) - (h / 2) * Math.sin(a)),
          y: c0.y - ((w / 2) * Math.sin(a) + (h / 2) * Math.cos(a)),
          width: w, height: h, opacity, rotate: degrees(angle + pl.rot),
        });
      } else {
        // shrink text that would not fit across the page
        const fit = Math.min(size, (Math.hypot(pl.vw, pl.vh) * 0.8) / Math.max(1, font.widthOfTextAtSize(text, 1)));
        drawCentered(page, pl, text, { font, size: tiled ? size : fit, angle, color: col, opacity, vx, vy, degrees });
      }
    }
  }
  progress(0.9, 'Saving PDF');
  return { name: `${baseName(file.name)}-watermarked.pdf`, blob: await save(doc) };
}

export async function pageNumbers({ files, options, progress }) {
  const { degrees, rgb } = await pdfLib();
  const { file } = files[0];
  const doc = await openForEdit(await file.arrayBuffer());
  const pages = doc.getPages();
  const startAt = Number.isFinite(Number(options.start)) ? Number(options.start) : 1;
  const size = Math.min(48, Math.max(6, Number(options.fontSize) || 11));
  const first = options.skipFirst ? 1 : 0;
  const numbered = pages.length - first;
  if (numbered < 1) throw new ToolError('This PDF has only one page, and the first page is set to be skipped.');
  const last = startAt + numbered - 1;
  const label = (n) => ({ 'page-n': `Page ${n}`, 'page-n-of': `Page ${n} of ${last}`, 'n-of': `${n} / ${last}` }[options.format] || String(n));
  const font = await fontFor(doc, 'Page 0123456789 of /', 'Helvetica');
  const [vert, horiz] = String(options.position || 'bottom-center').split('-');
  const margin = Math.max(18, size * 2);
  for (let i = first; i < pages.length; i++) {
    if (i % 25 === 0) { progress(i / pages.length, `Numbering page ${i + 1} of ${pages.length}`); await tick(); }
    const page = pages[i];
    const pl = placer(page);
    const text = label(startAt + i - first);
    const w = font.widthOfTextAtSize(text, size);
    const vx = horiz === 'left' ? margin + w / 2 : horiz === 'right' ? pl.vw - margin - w / 2 : pl.vw / 2;
    const vy = vert === 'top' ? pl.vh - margin : margin;
    drawCentered(page, pl, text, { font, size, angle: 0, color: rgb(0.13, 0.15, 0.2), opacity: 1, vx, vy, degrees });
  }
  progress(0.9, 'Saving PDF');
  return { name: `${baseName(file.name)}-numbered.pdf`, blob: await save(doc) };
}

/** Current properties, used to fill in the form when the file is chosen. */
export async function readMetadata(file) {
  const doc = await openForEdit(await file.arrayBuffer());
  return {
    title: doc.getTitle() || '', author: doc.getAuthor() || '', subject: doc.getSubject() || '',
    keywords: doc.getKeywords() || '', creator: doc.getCreator() || '',
  };
}

export async function metadata({ files, options, progress }) {
  const { PDFName } = await pdfLib();
  const { file } = files[0];
  const doc = await openForEdit(await file.arrayBuffer());
  progress(0.4, 'Updating properties');
  // Old XMP metadata would contradict the new values in some readers, so it goes either way.
  doc.catalog.delete(PDFName.of('Metadata'));
  if (options.clear) {
    doc.context.trailerInfo.Info = undefined;
  } else {
    doc.setTitle(options.title || '', { showInWindowTitleBar: !!options.title });
    doc.setAuthor(options.author || '');
    doc.setSubject(options.subject || '');
    doc.setKeywords(String(options.keywords || '').split(',').map((k) => k.trim()).filter(Boolean));
    doc.setCreator(options.creator || '');
    doc.setModificationDate(new Date());
  }
  progress(0.8, 'Saving PDF');
  return { name: `${baseName(file.name)}.pdf`, blob: await save(doc) };
}
