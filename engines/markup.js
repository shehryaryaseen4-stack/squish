'use strict';
// Markup documents with Pandoc: Markdown, reStructuredText, LaTeX, plus HTML/DOCX/ODT/RTF/TXT/EPUB
// on the other side. PDF output goes through DOCX and LibreOffice (no LaTeX install needed).

const fs = require('fs/promises');
const path = require('path');
const { job, run, listFiles, UserError } = require('./cli');

const READERS = { md: 'markdown', rst: 'rst', tex: 'latex', html: 'html', docx: 'docx', odt: 'odt', txt: 'markdown', rtf: 'rtf', epub: 'epub' };
const WRITERS = { md: 'gfm', rst: 'rst', tex: 'latex', html: 'html', docx: 'docx', odt: 'odt', txt: 'plain', rtf: 'rtf', epub: 'epub' };
const STANDALONE = new Set(['tex', 'html', 'rtf']);

async function convertMarkup({ buffer, inputExt, to }) {
  const reader = READERS[inputExt];
  if (!reader) throw new UserError('This file type cannot be read here.', 415);
  return job(async (dir) => {
    const input = path.join(dir, `input.${inputExt}`);
    await fs.writeFile(input, buffer);
    const viaDocx = to.id === 'pdf';
    const writer = viaDocx ? 'docx' : WRITERS[to.id];
    if (!writer) throw new UserError(`Converting to ${to.label} is not supported yet.`);
    const output = path.join(dir, `output.${viaDocx ? 'docx' : to.extension}`);
    const args = ['-f', reader, '-t', writer, '-o', output, input];
    if (STANDALONE.has(to.id) || to.id === 'epub') args.unshift('-s', '--metadata', 'title=Document');
    try {
      await run('pandoc', args, { cwd: dir });
    } catch (e) {
      throw new UserError('This document could not be read. Check that it is valid ' + (READERS[inputExt] === 'latex' ? 'LaTeX.' : 'and not damaged.'), 422);
    }
    if (!viaDocx) return { buffer: await fs.readFile(output), ext: to.extension };
    const outDir = path.join(dir, 'pdf');
    await run('soffice', ['--headless', '--norestore', '--nolockcheck', `-env:UserInstallation=file://${path.join(dir, 'profile')}`,
      '--convert-to', 'pdf', '--outdir', outDir, output], { env: { HOME: dir } });
    const [pdf] = await listFiles(outDir);
    if (!pdf) throw new Error('LibreOffice produced no PDF');
    return { buffer: await fs.readFile(pdf), ext: 'pdf' };
  });
}

module.exports = { convertMarkup, READERS, WRITERS };
