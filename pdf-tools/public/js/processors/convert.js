// PDF <-> images, PDF -> text, PDF -> ZIP. Runs entirely in the browser.
import {
  pdfLib, openForView, openForEdit, renderPage, canvasToBlob, parsePages, baseName, zipBlobs, pdfBlob, tick, ToolError,
} from '../lib/pdf.js';

const MAX_CANVAS_PIXELS = 16e6; // stays inside every browser's canvas limit (iOS is the strictest)

export async function pdfToImages({ files, options, params, progress }) {
  const { file } = files[0];
  const doc = await openForView(await file.arrayBuffer());
  const pages = parsePages(options.pages, doc.numPages);
  const fmt = params.format === 'png' ? 'png' : 'jpg';
  const dpi = Number(options.dpi) || 150;
  const base = baseName(file.name);
  const entries = [];
  for (let i = 0; i < pages.length; i++) {
    progress(i / pages.length, `Rendering page ${i + 1} of ${pages.length}`);
    const page = await doc.getPage(pages[i] + 1);
    const vp = page.getViewport({ scale: 1 });
    let scale = dpi / 72;
    if (vp.width * vp.height * scale * scale > MAX_CANVAS_PIXELS) scale = Math.sqrt(MAX_CANVAS_PIXELS / (vp.width * vp.height));
    const canvas = await renderPage(page, { scale });
    const blob = await canvasToBlob(canvas, fmt === 'png' ? 'image/png' : 'image/jpeg', 0.92);
    canvas.width = canvas.height = 0; // free memory right away
    page.cleanup();
    entries.push({ name: `${base}-page-${pages[i] + 1}.${fmt}`, blob });
    await tick();
  }
  await doc.loadingTask.destroy();
  if (entries.length === 1) return entries[0];
  return { entries, zipName: `${base}-${fmt}.zip` };
}

// ------------------------------------------------------------ images -> PDF
const SIZES = { a4: [595.28, 841.89], letter: [612, 792] };

/** EXIF orientation of a JPEG (1 = upright). */
function jpegOrientation(buf) {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return 1;
  let off = 2;
  while (off + 4 < v.byteLength) {
    const marker = v.getUint16(off);
    const len = v.getUint16(off + 2);
    if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) {
      const t = off + 10;
      const le = v.getUint16(t) === 0x4949;
      const ifd = t + v.getUint32(t + 4, le);
      const n = v.getUint16(ifd, le);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 10 > v.byteLength) break;
        if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le);
      }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
    off += 2 + len;
  }
  return 1;
}

async function reencodePng(file) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  bmp.close && bmp.close();
  return new Uint8Array(await (await canvasToBlob(c, 'image/png')).arrayBuffer());
}

export async function imagesToPdf({ files, options, progress }) {
  const { PDFDocument, degrees } = await pdfLib();
  const doc = await PDFDocument.create();
  const margin = Number(options.margin) || 0;
  for (let i = 0; i < files.length; i++) {
    const { file } = files[i];
    progress(i / files.length, `Adding image ${i + 1} of ${files.length}`);
    const buf = await file.arrayBuffer();
    const head = new Uint8Array(buf, 0, 4);
    const isJpg = head[0] === 0xff && head[1] === 0xd8;
    const isPng = head[0] === 0x89 && head[1] === 0x50;
    if (!isJpg && !isPng) throw new ToolError(`“${file.name}” isn’t a real JPG or PNG image. It may be damaged or renamed.`);
    let img;
    try {
      img = isJpg ? await doc.embedJpg(buf) : await doc.embedPng(buf);
    } catch {
      try { img = await doc.embedPng(await reencodePng(file)); } catch { throw new ToolError(`“${file.name}” could not be read. It may be damaged.`); }
    }
    // Phone photos are often stored sideways with an EXIF "rotate me" flag.
    const orient = isJpg ? jpegOrientation(buf) : 1;
    const quarter = { 6: 90, 5: 90, 8: 270, 7: 270, 3: 180, 4: 180 }[orient] || 0;
    const sideways = quarter === 90 || quarter === 270;
    const iw = sideways ? img.height : img.width; // as displayed
    const ih = sideways ? img.width : img.height;

    let pw; let ph;
    if (options.pageSize === 'fit') { pw = iw * 0.75 + margin * 2; ph = ih * 0.75 + margin * 2; } else {
      [pw, ph] = SIZES[options.pageSize] || SIZES.a4;
      const landscape = options.orientation === 'landscape' || (options.orientation !== 'portrait' && iw > ih);
      if (landscape) [pw, ph] = [ph, pw];
    }
    const page = doc.addPage([pw, ph]);
    const scale = Math.min((pw - margin * 2) / iw, (ph - margin * 2) / ih);
    const dw = iw * scale; const dh = ih * scale; // displayed size
    const x = (pw - dw) / 2; const y = (ph - dh) / 2;
    // drawImage rotates counter-clockwise around (x, y); place the corner so the result fills the box
    const w = sideways ? dh : dw; const h = sideways ? dw : dh;
    if (quarter === 0) page.drawImage(img, { x, y, width: w, height: h });
    if (quarter === 90) page.drawImage(img, { x, y: y + dh, width: w, height: h, rotate: degrees(-90) });
    if (quarter === 180) page.drawImage(img, { x: x + dw, y: y + dh, width: w, height: h, rotate: degrees(180) });
    if (quarter === 270) page.drawImage(img, { x: x + dw, y, width: w, height: h, rotate: degrees(90) });
    await tick();
  }
  progress(0.95, 'Saving PDF');
  const name = files.length === 1 ? `${baseName(files[0].file.name)}.pdf` : 'images.pdf';
  return { name, blob: pdfBlob(await doc.save()) };
}

// ---------------------------------------------------------------- PDF -> text
export async function pdfToText({ files, progress }) {
  const { file } = files[0];
  const doc = await openForView(await file.arrayBuffer());
  const parts = [];
  let chars = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    progress((p - 1) / doc.numPages, `Reading page ${p} of ${doc.numPages}`);
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let line = '';
    const lines = [];
    let lastY = null;
    for (const item of content.items) {
      if (typeof item.str !== 'string') continue;
      const y = item.transform ? Math.round(item.transform[5]) : lastY;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && line) { lines.push(line); line = ''; }
      line += item.str;
      if (item.hasEOL) { lines.push(line); line = ''; }
      lastY = y;
    }
    if (line) lines.push(line);
    const text = lines.map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    chars += text.replace(/\s/g, '').length;
    parts.push(text);
    page.cleanup();
  }
  await doc.loadingTask.destroy();
  if (!chars) {
    throw new ToolError('No text was found in this PDF. It looks like a scanned document: use OCR PDF to recognize the text first.', { href: '/ocr-pdf', label: 'Open OCR PDF' });
  }
  const out = parts.map((t, i) => (parts.length > 1 ? `--- Page ${i + 1} ---\n${t}` : t)).join('\n\n');
  return { name: `${baseName(file.name)}.txt`, blob: new Blob([`${out}\n`], { type: 'text/plain;charset=utf-8' }) };
}

// ----------------------------------------------------------------- PDF -> ZIP
export async function pdfToZip({ files, options, progress }) {
  const entries = [];
  if (!options.perPage) {
    for (const { file } of files) entries.push({ name: file.name.toLowerCase().endsWith('.pdf') ? file.name : `${file.name}.pdf`, blob: file });
  } else {
    const { PDFDocument } = await pdfLib();
    for (let f = 0; f < files.length; f++) {
      const { file } = files[f];
      const src = await openForEdit(await file.arrayBuffer());
      const n = src.getPageCount();
      const base = baseName(file.name);
      for (let i = 0; i < n; i++) {
        progress((f + i / n) / files.length * 0.7, `Splitting ${file.name}: page ${i + 1} of ${n}`);
        const out = await PDFDocument.create();
        const [pg] = await out.copyPages(src, [i]);
        out.addPage(pg);
        entries.push({ name: `${files.length > 1 ? `${base}/` : ''}${base}-page-${i + 1}.pdf`, blob: pdfBlob(await out.save()) });
        if (i % 10 === 9) await tick();
      }
    }
  }
  progress(0.75, 'Creating ZIP');
  const blob = await zipBlobs(entries, (f) => progress(0.75 + f * 0.25, 'Creating ZIP'));
  const name = files.length === 1 ? `${baseName(files[0].file.name)}.zip` : 'pdf-files.zip';
  return { name, blob };
}
