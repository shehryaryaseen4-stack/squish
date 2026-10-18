'use strict';
// XPS (Microsoft's fixed-layout documents) in: MuPDF turns it into a PDF, then the PDF handler
// renders the pages (JPG, PNG, ...) or extracts the text. XPS out is made with Ghostscript
// (engines/pdf.js, engines/office.js).

const fs = require('fs/promises');
const path = require('path');
const { job, run, UserError } = require('./cli');

async function xpsToPdf(buffer) {
  return job(async (dir) => {
    const input = path.join(dir, 'input.xps');
    const output = path.join(dir, 'output.pdf');
    await fs.writeFile(input, buffer);
    try { await run('mutool', ['convert', '-o', output, input]); } catch {
      throw new UserError('This XPS file could not be read. It may be damaged.', 415);
    }
    return fs.readFile(output);
  });
}

async function convertXps(params) {
  const pdf = await xpsToPdf(params.buffer);
  if (params.to.id === 'pdf') return { buffer: pdf, ext: 'pdf' };
  return require('./pdf').convertPdf({ ...params, buffer: pdf, inputExt: 'pdf', from: { id: 'pdf' } });
}

/** PDF file on disk -> XPS file (Ghostscript xpswrite). */
async function pdfFileToXps(input, output) {
  await run('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=xpswrite', `-sOutputFile=${output}`, input]);
}

module.exports = { convertXps, pdfFileToXps };
