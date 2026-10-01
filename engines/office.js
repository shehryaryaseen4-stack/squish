'use strict';
// Documents, spreadsheets and presentations with LibreOffice in headless mode.
// Each job uses its own LibreOffice profile directory so several conversions can run at once.
// Presentation -> JPG/PNG renders every slide (via PDF + pdftoppm) and returns a ZIP when there
// is more than one slide.

const fs = require('fs/promises');
const path = require('path');
const { job, run, listFiles, collect, UserError } = require('./cli');

// LibreOffice export filters, by target format id. `kind` picks the right HTML/CSV filter.
const FILTERS = {
  // text documents
  docx: 'docx:MS Word 2007 XML', doc: 'doc:MS Word 97', odt: 'odt', rtf: 'rtf:Rich Text Format',
  txt: 'txt:Text (encoded):UTF8', dot: 'dot:MS Word 97 Vorlage', dotx: 'dotx:MS Word 2007 XML Template',
  docm: 'docm:MS Word 2007 XML VBA', pdf: 'pdf',
  // spreadsheets
  xls: 'xls:MS Excel 97', xlsx: 'xlsx:Calc MS Excel 2007 XML', xlsm: 'xlsm:Calc MS Excel 2007 VBA XML', ods: 'ods',
  csv: 'csv:Text - txt - csv (StarCalc):44,34,76,1', tsv: 'csv:Text - txt - csv (StarCalc):9,34,76,1',
  // presentations
  ppt: 'ppt:MS PowerPoint 97', pptx: 'pptx:Impress MS PowerPoint 2007 XML', pptm: 'pptm:Impress MS PowerPoint 2007 XML VBA',
  pps: 'pps:MS PowerPoint 97 AutoPlay', ppsx: 'ppsx:Impress MS PowerPoint 2007 XML AutoPlay',
  pot: 'pot:MS PowerPoint 97 Vorlage', potx: 'potx:Impress MS PowerPoint 2007 XML Template', odp: 'odp',
};
const HTML_FILTER = { document: 'html:XHTML Writer File:UTF8', spreadsheet: 'html:HTML (StarCalc)', presentation: 'html:impress_html_Export' };

// Input filters LibreOffice cannot guess from the extension.
const IN_FILTERS = { tsv: 'Text - txt - csv (StarCalc):9,34,76,1', csv: 'Text - txt - csv (StarCalc):44,34,76,1' };

const kindOf = (fmt) => (fmt.categories.includes('spreadsheet') ? 'spreadsheet'
  : fmt.categories.includes('presentation') ? 'presentation' : 'document');

async function soffice(dir, input, filter, inFilter) {
  const outDir = path.join(dir, 'out');
  await fs.mkdir(outDir, { recursive: true });
  const args = ['--headless', '--norestore', '--nolockcheck', '--nodefault', '--nologo',
    `-env:UserInstallation=file://${path.join(dir, 'profile')}`];
  if (inFilter) args.push(`--infilter=${inFilter}`);
  args.push('--convert-to', filter, '--outdir', outDir, input);
  await run('soffice', args, { env: { HOME: dir } });
  const files = await listFiles(outDir);
  if (!files.length) throw new UserError('This file could not be opened. It may be damaged, password-protected or in an unsupported variant of the format.', 415);
  return files;
}

async function convertOffice({ buffer, inputExt, from, to }) {
  return job(async (dir) => {
    const input = path.join(dir, `input.${inputExt}`);
    await fs.writeFile(input, buffer);
    const inFilter = IN_FILTERS[inputExt];

    // Slides/pages as images: render to PDF, then rasterise every page.
    if (['jpg', 'png'].includes(to.id)) {
      const [pdf] = await soffice(dir, input, 'pdf', inFilter);
      const imgDir = path.join(dir, 'img');
      await fs.mkdir(imgDir);
      await run('pdftoppm', [to.id === 'jpg' ? '-jpeg' : '-png', '-r', '110', pdf, path.join(imgDir, 'page')]);
      return collect(await listFiles(imgDir), to.extension, imgDir);
    }

    const filter = to.id === 'html' ? HTML_FILTER[kindOf(from)] : FILTERS[to.id];
    if (!filter) throw new UserError(`Converting to ${to.label} is not supported yet.`);
    const files = await soffice(dir, input, filter, inFilter);
    // LibreOffice names the file after its filter's extension (e.g. .csv for TSV); keep ours.
    const main = files.find((f) => !/\.(png|jpe?g|gif)$/i.test(f)) || files[0];
    return { buffer: await fs.readFile(main), ext: to.extension };
  });
}

module.exports = { convertOffice, FILTERS };
