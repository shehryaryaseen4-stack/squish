'use strict';
// Ebooks with Calibre's ebook-convert (EPUB, MOBI, AZW3, FB2, PDF, DOCX, ...).
// DRM-protected books cannot be converted. OEB output is a folder, so it is returned as a ZIP.

const fs = require('fs/promises');
const path = require('path');
const { job, run, listFiles, collect, UserError } = require('./cli');

async function convertEbook({ buffer, inputExt, from, to }) {
  return job(async (dir) => {
    const input = path.join(dir, `input.${from.extension}`);
    await fs.writeFile(input, buffer);
    const outDir = path.join(dir, 'out');
    await fs.mkdir(outDir);
    const output = path.join(outDir, `output.${to.extension}`);
    try {
      await run('ebook-convert', [input, output], {
        env: { HOME: dir, QT_QPA_PLATFORM: 'offscreen', QTWEBENGINE_CHROMIUM_FLAGS: '--no-sandbox', CALIBRE_CONFIG_DIRECTORY: path.join(dir, 'cfg') },
      });
    } catch (e) {
      if (/DRM/i.test(e.stderr || '')) throw new UserError('This ebook is DRM-protected and cannot be converted.');
      throw new UserError('This ebook could not be converted. It may be damaged or DRM-protected.', 422);
    }
    const st = await fs.stat(output).catch(() => null);
    if (st && st.isFile()) return { buffer: await fs.readFile(output), ext: to.extension };
    if (st && st.isDirectory()) return collect(await listFiles(output), 'zip', output);
    throw new Error('ebook-convert produced no output');
  });
}

module.exports = { convertEbook };
