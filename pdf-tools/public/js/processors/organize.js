// Merge, split, extract, delete, reorder, rotate and duplicate pages. Runs in the browser.
import { pdfLib, openForEdit, parseRanges, baseName, pdfBlob, tick, ToolError } from '../lib/pdf.js';

async function newDocFrom(src, indices, onProgress) {
  const { PDFDocument } = await pdfLib();
  const out = await PDFDocument.create();
  const CHUNK = 50;
  for (let i = 0; i < indices.length; i += CHUNK) {
    const copied = await out.copyPages(src, indices.slice(i, i + CHUNK));
    copied.forEach((p) => out.addPage(p));
    if (onProgress) onProgress(Math.min(1, (i + CHUNK) / indices.length));
    await tick();
  }
  return out;
}

const save = async (doc) => pdfBlob(await doc.save({ useObjectStreams: true }));
const selectedIndices = (pages) => pages.filter((p) => p.selected).map((p) => p.index).sort((a, b) => a - b);

export async function merge({ files, progress }) {
  const { PDFDocument } = await pdfLib();
  if (files.length < 2) throw new ToolError('Add at least two PDF files to merge.');
  const out = await PDFDocument.create();
  for (let f = 0; f < files.length; f++) {
    const { file } = files[f];
    progress(f / files.length * 0.9, `Adding ${file.name} (${f + 1} of ${files.length})`);
    let src;
    try { src = await openForEdit(await file.arrayBuffer()); } catch (e) {
      if (e.userMessage) throw new ToolError(`“${file.name}”: ${e.userMessage}`, e.link);
      throw e;
    }
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((p) => out.addPage(p));
    await tick();
  }
  progress(0.92, 'Saving merged PDF');
  return { name: 'merged.pdf', blob: await save(out) };
}

export async function split({ files, options, progress }) {
  const { file } = files[0];
  const src = await openForEdit(await file.arrayBuffer());
  const total = src.getPageCount();
  let groups;
  if (options.mode === 'each') groups = [...Array(total).keys()].map((i) => [i]);
  else if (options.mode === 'every') {
    const n = Math.max(1, Math.floor(Number(options.every) || 1));
    groups = [];
    for (let i = 0; i < total; i += n) groups.push([...Array(Math.min(n, total - i)).keys()].map((k) => i + k));
  } else groups = parseRanges(options.ranges, total);
  if (groups.length === 1 && groups[0].length === total) throw new ToolError('That range covers the whole document, so there is nothing to split. Try ranges like 1-3, 4-6.');
  const base = baseName(file.name);
  const entries = [];
  for (let g = 0; g < groups.length; g++) {
    progress(g / groups.length, `Creating file ${g + 1} of ${groups.length}`);
    const idx = groups[g];
    const doc = await newDocFrom(src, idx);
    const first = idx[0] + 1; const last = idx[idx.length - 1] + 1;
    entries.push({ name: idx.length === 1 ? `${base}-page-${first}.pdf` : `${base}-pages-${first}-${last}.pdf`, blob: await save(doc) });
  }
  if (entries.length === 1) return entries[0];
  return { entries, zipName: `${base}-split.zip` };
}

export async function extract({ files, pages, options, progress }) {
  const { file } = files[0];
  const idx = selectedIndices(pages);
  if (!idx.length) throw new ToolError('Select at least one page to extract: click the pages you want.');
  const src = await openForEdit(await file.arrayBuffer());
  const base = baseName(file.name);
  if (options.separate && idx.length > 1) {
    const entries = [];
    for (let i = 0; i < idx.length; i++) {
      progress(i / idx.length, `Saving page ${idx[i] + 1}`);
      entries.push({ name: `${base}-page-${idx[i] + 1}.pdf`, blob: await save(await newDocFrom(src, [idx[i]])) });
    }
    return { entries, zipName: `${base}-pages.zip` };
  }
  const doc = await newDocFrom(src, idx, (f) => progress(f * 0.8, 'Copying pages'));
  return { name: `${base}-extracted.pdf`, blob: await save(doc) };
}

export async function remove({ files, pages, progress }) {
  const { file } = files[0];
  const del = new Set(selectedIndices(pages));
  if (!del.size) throw new ToolError('Select the pages you want to delete: click them so they are marked.');
  if (del.size >= pages.length) throw new ToolError('You can’t delete every page. Leave at least one page unselected.');
  const doc = await openForEdit(await file.arrayBuffer());
  progress(0.3, 'Removing pages');
  [...del].sort((a, b) => b - a).forEach((i) => doc.removePage(i));
  progress(0.8, 'Saving PDF');
  return { name: `${baseName(file.name)}-edited.pdf`, blob: await save(doc) };
}

export async function reorder({ files, pages, progress }) {
  const { file } = files[0];
  const order = pages.map((p) => p.index);
  if (order.every((v, i) => v === i)) throw new ToolError('The pages are still in their original order. Drag pages to move them first.');
  const src = await openForEdit(await file.arrayBuffer());
  const doc = await newDocFrom(src, order, (f) => progress(f * 0.85, 'Reordering pages'));
  return { name: `${baseName(file.name)}-reordered.pdf`, blob: await save(doc) };
}

export async function rotate({ files, pages, progress }) {
  const { degrees } = await pdfLib();
  const { file } = files[0];
  if (pages.every((p) => !p.rotation)) throw new ToolError('No page has been rotated yet. Use the rotate buttons first.');
  const doc = await openForEdit(await file.arrayBuffer());
  progress(0.3, 'Rotating pages');
  const all = doc.getPages();
  for (const p of pages) {
    if (!p.rotation) continue;
    const page = all[p.index];
    page.setRotation(degrees((((page.getRotation().angle + p.rotation) % 360) + 360) % 360));
  }
  progress(0.8, 'Saving PDF');
  return { name: `${baseName(file.name)}-rotated.pdf`, blob: await save(doc) };
}

export async function duplicate({ files, pages, options, progress }) {
  const { file } = files[0];
  const sel = new Set(selectedIndices(pages));
  if (!sel.size) throw new ToolError('Select the pages you want to duplicate: click them so they are marked.');
  const copies = Math.min(20, Math.max(1, Math.floor(Number(options.copies) || 1)));
  const order = [];
  for (let i = 0; i < pages.length; i++) {
    order.push(i);
    if (sel.has(i)) for (let c = 0; c < copies; c++) order.push(i);
  }
  const src = await openForEdit(await file.arrayBuffer());
  const doc = await newDocFrom(src, order, (f) => progress(f * 0.85, 'Copying pages'));
  return { name: `${baseName(file.name)}-duplicated.pdf`, blob: await save(doc) };
}
