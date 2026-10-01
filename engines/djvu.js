'use strict';
// DjVu documents with DjVuLibre: to PDF, TIFF (all pages), TXT, or JPG/PNG (one image per page).

const fs = require('fs/promises');
const path = require('path');
const { job, run, listFiles, collect, UserError } = require('./cli');

async function convertDjvu({ buffer, to }) {
  return job(async (dir) => {
    const input = path.join(dir, 'input.djvu');
    await fs.writeFile(input, buffer);
    const out = path.join(dir, 'out');
    await fs.mkdir(out);
    try {
      if (to.id === 'pdf' || to.id === 'tiff') {
        await run('ddjvu', [`-format=${to.id === 'pdf' ? 'pdf' : 'tiff'}`, '-quality=85', input, path.join(out, `output.${to.extension}`)]);
      } else if (to.id === 'txt') {
        const { stdout } = await run('djvutxt', [input]);
        if (!stdout.toString().trim()) throw new UserError('This DjVu file has no text layer (it is a scanned image), so there is no text to extract. Convert it to PDF or images instead.');
        await fs.writeFile(path.join(out, 'output.txt'), stdout);
      } else if (to.id === 'jpg' || to.id === 'png') {
        await run('ddjvu', ['-format=tiff', '-eachpage', input, path.join(out, 'page-%03d.tif')]);
        const sharp = require('sharp');
        for (const f of await listFiles(out)) {
          await sharp(f)[to.id === 'jpg' ? 'jpeg' : 'png'](to.id === 'jpg' ? { quality: 88 } : {}).toFile(f.replace(/\.tif$/, `.${to.extension}`));
          await fs.unlink(f);
        }
      } else throw new UserError(`Converting DjVu to ${to.label} is not supported yet.`);
    } catch (e) {
      if (e.userMessage) throw e;
      throw new UserError('This DjVu file could not be read. It may be damaged.', 415);
    }
    return collect(await listFiles(out), to.extension, out);
  });
}

module.exports = { convertDjvu };
