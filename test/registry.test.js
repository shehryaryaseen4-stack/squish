'use strict';
// These tests describe the image-only build (no FFmpeg, LibreOffice, ...), so they turn off
// detection of system tools. test/conversions.test.js and test/seo.test.js cover the full build.
process.env.SQUISH_DETECT = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const registry = require('../registry');
const { HANDLER_IDS } = require('../engines');
const pkg = require('../package.json');

const ids = (list) => list.map((f) => f.id);

// ------------------------------------------------------------------ integrity --
test('registry loads and passes its own validation', () => {
  const stats = registry.getStats();
  // Without system tools: 57 image pairs (50 original + JFIF), 9 images to PDF (pdf-lib), 10 font pairs
  assert.equal(stats.converters.live, 76);
  assert.equal(stats.compressors.live, 6);
  assert.ok(stats.formats >= 190); // full CloudConvert-style catalogue
});

test('categories: ordered, empty ones hidden', () => {
  const visible = registry.getCategories().map((c) => c.id);
  assert.deepEqual(visible, ['archive', 'audio', 'cad', 'document', 'ebook', 'font', 'image', 'pdf', 'presentation', 'spreadsheet', 'vector', 'video']);
  const all = registry.getCategories({ includeEmpty: true }).map((c) => c.id);
  assert.equal(all.at(-1), 'other');
  assert.equal(all.length, 13);
  assert.equal(registry.getCategory('Image').id, 'image');
  assert.equal(registry.getCategory('nope'), null);
});

test('every format the brief asked for exists in the right category', () => {
  const expected = {
    image: ['jpg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'avif', 'heic', 'heif', 'ico', 'psd'],
    font: ['eot', 'otf', 'ttf', 'woff', 'woff2'],
    video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'mpeg', 'mpg', 'm4v', '3gp', 'ogv', 'ts', 'mts', 'm2ts', 'vob', 'mxf', 'gif'],
    audio: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'aiff', 'amr', 'opus', 'ac3', 'alac'],
    document: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'html'],
    spreadsheet: ['xls', 'xlsx', 'csv', 'ods', 'tsv'],
    presentation: ['ppt', 'pptx', 'odp'],
    ebook: ['epub', 'mobi', 'azw', 'azw3'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'tar-gz', 'tar-bz2'],
    vector: ['svg', 'eps', 'ai', 'dxf'],
  };
  for (const [cat, list] of Object.entries(expected)) {
    const have = new Set(ids(registry.getFormatsByCategory(cat)));
    for (const id of list) assert.ok(have.has(id), `${id} missing from ${cat}`);
  }
  assert.deepEqual(ids(registry.getFormatsByCategory('pdf')), ['pdf']);
  assert.ok(ids(registry.getFormatsByCategory('cad')).includes('dxf'));
});

test('every format has the metadata the brief asked for', () => {
  for (const f of registry.getFormats()) {
    assert.ok(f.extension && f.name && f.label && f.description && f.mimeType, f.id);
    assert.ok(registry.getCategory(f.category), `${f.id} category`);
    assert.ok(f.icon, `${f.id} icon`);
    assert.ok(['native', 'library', 'none'].includes(f.browserSupport.read), `${f.id} read`);
    assert.ok(['native', 'library', 'none'].includes(f.browserSupport.write), `${f.id} write`);
    assert.equal(typeof f.backendRequired, 'boolean');
    assert.ok(f.input || f.output, `${f.id} is used by no converter`);
    assert.ok(!f.id.includes('-to-'), `${f.id} would break route parsing`);
  }
});

test('input/output support is derived from converters, not declared twice', () => {
  const png = registry.getFormat('png');
  assert.equal(png.input, 'live');
  assert.equal(png.output, 'live');
  assert.equal(registry.getFormat('ico').input, 'planned'); // only planned readers
  assert.equal(registry.getFormat('ico').output, 'live');
  assert.equal(registry.getFormat('heic').input, 'experimental');
  assert.equal(registry.getFormat('heic').output, false);
  assert.equal(registry.getFormat('rar').output, false);   // RAR can never be created
  assert.equal(registry.getFormat('bmp').output, 'planned'); // read live, written only by planned ImageMagick
  assert.equal(registry.getFormat('mp4').input, 'planned');
});

test('backendRequired reflects what browsers cannot do', () => {
  assert.equal(registry.getFormat('png').backendRequired, false);
  assert.equal(registry.getFormat('csv').backendRequired, false);
  assert.equal(registry.getFormat('docx').backendRequired, true);
  assert.equal(registry.getFormat('mp4').backendRequired, true);
  assert.equal(registry.getFormat('rar').backendRequired, true);
});

test('live/experimental converters only use installed engines, handlers and dependencies', () => {
  const active = registry.getConverters({ minStatus: 'experimental', type: 'all' });
  assert.ok(active.length >= 64);
  for (const c of active) {
    assert.ok(HANDLER_IDS.includes(c.handler), `${c.id}: handler "${c.handler}" not registered`);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'engines', `${c.handler}.js`)), `${c.id}: handler file missing`);
    for (const e of new Set([c.engine, c.pipeline.decode, c.pipeline.encode])) {
      assert.equal(registry.getEngine(e).status, 'installed', `${c.id}: ${e}`);
    }
  }
  for (const e of registry.getEngines({ status: 'installed' })) {
    assert.ok(pkg.dependencies[e.npm || e.id], `installed engine "${e.id}" is not in package.json dependencies`);
  }
});

test('registry objects are frozen', () => {
  const f = registry.getFormat('png');
  assert.throws(() => { f.name = 'X'; }, TypeError);
  assert.throws(() => { f.browserSupport.read = 'none'; }, TypeError);
  assert.throws(() => { registry.getConverter('png', 'jpg').status = 'planned'; }, TypeError);
});

// ---------------------------------------------------------------- lookups --
test('getFormat resolves ids, extensions, aliases, case and dots', () => {
  assert.equal(registry.getFormat('.JPEG').id, 'jpg');
  assert.equal(registry.getFormat('tif').id, 'tiff');
  assert.equal(registry.getFormat('tgz').id, 'tar-gz');
  assert.equal(registry.getFormat('tar.gz').id, 'tar-gz');
  assert.equal(registry.getFormat({ id: 'png' }).id, 'png');
  assert.equal(registry.getFormat('nope'), null);
  assert.equal(registry.getFormat(''), null);
  assert.equal(registry.getFormatByExtension('WebP').id, 'webp');
});

test('getFormatByFilename understands two-part extensions', () => {
  assert.equal(registry.getFormatByFilename('Holiday.JPEG').id, 'jpg');
  assert.equal(registry.getFormatByFilename('backup.tar.gz').id, 'tar-gz');
  assert.equal(registry.getFormatByFilename('my.notes.tar.bz2').id, 'tar-bz2');
  assert.equal(registry.getFormatByFilename('log.gz').id, 'gz');
  assert.equal(registry.getFormatByFilename('README'), null);
  assert.equal(registry.getFormatByFilename('weird.unknownext'), null);
});

test('MIME lookups', () => {
  assert.equal(registry.getFormatByMimeType('image/png').id, 'png');
  assert.equal(registry.getFormatByMimeType('IMAGE/JPEG; charset=binary').id, 'jpg');
  assert.equal(registry.getFormatByMimeType('image/vnd.microsoft.icon').id, 'ico');
  assert.deepEqual(ids(registry.getFormatsByMimeType('video/mpeg')).sort(), ['mpeg', 'mpg', 'vob']);
  assert.equal(registry.getFormatByMimeType('application/x-nothing'), null);
});

test('the catalogue covers the CloudConvert-style format list', () => {
  const expected = {
    archive: ['7z', 'ace', 'arj', 'cab', 'cpio', 'deb', 'dmg', 'iso', 'jar', 'lha', 'lz', 'rpm', 'xz', 'z', 'tar-xz', 'tar-7z'],
    audio: ['aifc', 'ape', 'au', 'caf', 'dss', 'm4b', 'oga', 'shn', 'voc', 'weba'],
    cad: ['dwg', 'dxf'],
    document: ['abw', 'djvu', 'docm', 'dotx', 'hwp', 'md', 'pages', 'rst', 'tex', 'wpd', 'wps'],
    ebook: ['azw4', 'cbr', 'cbz', 'chm', 'fb2', 'lit', 'lrf', 'pdb', 'docx', 'pdf'],
    image: ['jfif', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'icns', 'xcf', 'eps', 'ps'],
    presentation: ['pptm', 'pps', 'ppsx', 'pot', 'potx', 'key'],
    spreadsheet: ['xlsm', 'numbers', 'et'],
    vector: ['cdr', 'emf', 'wmf', 'svgz', 'vsd', 'ps'],
    video: ['3g2', 'dv', 'mod', 'rm', 'rmvb', 'swf', 'wtv'],
  };
  for (const [cat, list] of Object.entries(expected)) {
    const have = new Set(ids(registry.getFormatsByCategory(cat)));
    for (const id of list) assert.ok(have.has(id), `${id} missing from ${cat}`);
  }
  assert.equal(registry.getFormat('txz').id, 'tar-xz');
  assert.equal(registry.getFormatByFilename('kernel.tar.xz').id, 'tar-xz');
  assert.equal(registry.getConversionStatus('cr2', 'jpg'), 'planned');
  assert.equal(registry.getConversionStatus('jfif', 'png'), 'live');
  assert.equal(registry.getConversionStatus('mkv', 'mp4'), 'planned');
  assert.equal(registry.getConversionEngine('csv', 'xlsx').id, 'libreoffice'); // the first rule for a pair decides its engine
});

test('formats appear under every category they belong to', () => {
  assert.ok(ids(registry.getFormatsByCategory('image')).includes('svg'));
  assert.ok(ids(registry.getFormatsByCategory('vector')).includes('svg'));
  assert.ok(ids(registry.getFormatsByCategory('video')).includes('gif'));
  assert.ok(ids(registry.getFormatsByCategory('document')).includes('pdf'));
  assert.equal(registry.getFormat('svg').category, 'vector'); // primary
  assert.deepEqual(registry.getFormats({ category: 'nope' }), []);
});

// ------------------------------------------------------------- conversions --
test('example conversions from the brief are registered with the right status', () => {
  for (const [a, b] of [['png', 'jpg'], ['png', 'webp'], ['jpg', 'png']]) {
    assert.ok(registry.isConversionSupported(a, b), `${a}->${b} should be live`);
  }
  assert.ok(registry.isConversionSupported('ttf', 'woff'), 'pure-JS font wrapping is always live');
  // These need FFmpeg/LibreOffice/Calibre, which these tests switch off:
  for (const [a, b] of [['mp4', 'mp3'], ['mp4', 'gif'], ['pdf', 'docx'], ['docx', 'pdf']]) {
    assert.equal(registry.isConversionSupported(a, b), false, `${a}->${b} must not look live`);
    const c = registry.getConverter(a, b, { minStatus: 'planned' });
    assert.ok(c, `${a}->${b} should exist as planned`);
    assert.equal(c.status, 'planned');
  }
});

test('the live image pairs are the original 50 plus JFIF input, and 6 compressors', () => {
  const pairs = registry.getConverters().filter((c) => c.handler === 'image').map((c) => c.id);
  assert.equal(pairs.length, 57);
  assert.equal(pairs[0], 'jpg>png');
  assert.equal(pairs[49], 'svg>ico');
  assert.deepEqual(pairs.slice(50), ['jfif>jpg', 'jfif>png', 'jfif>webp', 'jfif>avif', 'jfif>tiff', 'jfif>gif', 'jfif>ico']);
  assert.deepEqual(ids(registry.getInputFormats({ category: 'image' })), ['jpg', 'png', 'webp', 'avif', 'tiff', 'gif', 'bmp', 'svg', 'jfif']);
  assert.deepEqual(ids(registry.getOutputFormats({ category: 'image' })), ['jpg', 'png', 'webp', 'avif', 'tiff', 'gif', 'ico']);
  assert.deepEqual(ids(registry.getCompressibleFormats()), ['jpg', 'png', 'webp', 'avif', 'tiff', 'gif']);
});

test('BMP decodes through Jimp and ICO encodes through png-to-ico', () => {
  assert.equal(registry.getConverter('bmp', 'png').pipeline.decode, 'jimp');
  assert.equal(registry.getConverter('png', 'ico').pipeline.encode, 'png-to-ico');
  assert.equal(registry.getConverter('png', 'webp').pipeline.decode, 'sharp');
});

test('same format means compression', () => {
  assert.ok(registry.isConversionSupported('png', 'png'));
  assert.ok(registry.isCompressSupported('jpeg'));
  assert.equal(registry.isConversionSupported('svg', 'svg'), false);
  assert.equal(registry.isConversionSupported('bmp', 'bmp'), false);
  assert.equal(registry.isConversionSupported('nope', 'png'), false);
  assert.equal(registry.getConverter('png', 'png'), null);
});

test('HEIC is accepted as experimental but never published', () => {
  assert.equal(registry.isConversionSupported('heic', 'jpg'), false);
  assert.ok(registry.isConversionSupported('heic', 'jpg', { minStatus: 'experimental' }));
  assert.ok(!registry.getAllRoutes().includes('/heic-to-jpg'));
});

test('compatible output/input formats', () => {
  assert.deepEqual(ids(registry.getCompatibleOutputFormats('png')), ['jpg', 'webp', 'avif', 'tiff', 'gif', 'ico', 'pdf']);
  assert.deepEqual(ids(registry.getCompatibleOutputFormats('jpeg')), ['png', 'webp', 'avif', 'tiff', 'gif', 'ico', 'pdf']);
  assert.deepEqual(ids(registry.getCompatibleInputFormats('ico')), ['jpg', 'png', 'webp', 'avif', 'tiff', 'gif', 'bmp', 'svg', 'jfif']);
  assert.deepEqual(registry.getCompatibleOutputFormats('nope'), []);
  const all = ids(registry.getCompatibleOutputFormats('png', { minStatus: 'planned' }));
  assert.ok(all.includes('pdf') && all.includes('psd'));
  assert.ok(registry.getCompatibleOutputFormats('mp4', { minStatus: 'planned' }).length > 20);
});

test('outputs grouped by category for an ANY dropdown', () => {
  const groups = registry.getOutputFormatsByCategory('png', { minStatus: 'planned' });
  const byCat = Object.fromEntries(groups.map((g) => [g.category.id, ids(g.formats)]));
  assert.ok(byCat.image.includes('jpg'));
  assert.ok(byCat.pdf.includes('pdf') && byCat.document.includes('pdf'), 'PDF listed under both PDF and Document');
  assert.deepEqual(Object.keys(byCat), [...Object.keys(byCat)].sort((a, b) =>
    registry.getCategory(a).order - registry.getCategory(b).order));
  // GIF is also listed under Video, PDF also under Document and Ebook
  assert.deepEqual(registry.getOutputFormatsByCategory('png').map((g) => g.category.id), ['document', 'ebook', 'image', 'pdf', 'video']);
});

test('popular conversions skip anything not live', () => {
  const pop = registry.getPopularConversions().map((c) => c.id);
  assert.equal(pop[0], 'png>webp');
  assert.equal(pop.length, 15); // 12 image pairs + TTF to WOFF, JPG to PDF, PNG to PDF (pure JS)
  assert.ok(!pop.includes('mp4>mp3')); // needs FFmpeg, which these tests switch off
  assert.ok(registry.getPopularConversions({ minStatus: 'planned' }).length > 15);
});

// ------------------------------------------------------------------ search --
test('searchFormats ranks sensibly', () => {
  assert.equal(registry.searchFormats('png')[0].id, 'png');
  assert.equal(registry.searchFormats('.JPEG')[0].id, 'jpg');
  assert.equal(registry.searchFormats('tar')[0].id, 'tar');
  assert.ok(ids(registry.searchFormats('tar')).includes('tar-gz'));
  assert.ok(ids(registry.searchFormats('word')).includes('docx'));
  assert.ok(ids(registry.searchFormats('photoshop')).includes('psd'));
  assert.equal(registry.searchFormats('zzzzzz').length, 0);
  assert.equal(registry.searchFormats('').length, registry.getFormats().length);
});

test('searchFormats filters', () => {
  assert.deepEqual(ids(registry.searchFormats('', { category: 'font' })), ['ttf', 'otf', 'woff', 'woff2', 'eot']);
  assert.equal(registry.searchFormats('a', { limit: 3 }).length, 3);
  assert.deepEqual(ids(registry.searchFormats('we', { compatibleWith: 'png' })), ['webp']);
  assert.ok(ids(registry.searchFormats('', { role: 'output', minStatus: 'live' })).every((id) => registry.getFormat(id).output === 'live'));
});

// ------------------------------------------------------------------ routes --
test('route generation and parsing', () => {
  assert.equal(registry.getConverterRoute('JPEG', '.png'), '/jpg-to-png');
  assert.equal(registry.getConverterRoute('tar.gz', 'zip'), '/tar-gz-to-zip');
  assert.equal(registry.getConverterRoute('nope', 'png'), null);
  assert.equal(registry.getCompressRoute('jpeg'), '/compress-jpg');
  assert.deepEqual(registry.parseConverterRoute('/tar-gz-to-zip'), { type: 'convert', from: 'tar-gz', to: 'zip' });
  assert.deepEqual(registry.parseConverterRoute('/compress-png'), { type: 'compress', from: 'png', to: 'png' });
  assert.equal(registry.parseConverterRoute('/about'), null);
  assert.equal(registry.parseConverterRoute('/'), null);
});

test('resolveRoute: canonical, redirect and not-found', () => {
  assert.equal(registry.resolveRoute('/png-to-webp').path, '/png-to-webp');
  assert.deepEqual(registry.resolveRoute('/jpeg-to-png'), { redirect: '/jpg-to-png' });
  assert.deepEqual(registry.resolveRoute('/tif-to-jpeg'), { redirect: '/tiff-to-jpg' });
  assert.deepEqual(registry.resolveRoute('/compress-jpeg'), { redirect: '/compress-jpg' });
  assert.equal(registry.resolveRoute('/png-to-png'), null);
  assert.equal(registry.resolveRoute('/ico-to-png'), null);
  assert.equal(registry.resolveRoute('/compress-svg'), null);
  assert.equal(registry.resolveRoute('/mp4-to-mp3'), null);
  assert.equal(registry.resolveRoute('/mp4-to-mp3', { minStatus: 'planned' }).path, '/mp4-to-mp3');
  assert.equal(registry.resolveRoute('/tar-gz-to-zip', { minStatus: 'planned' }).path, '/tar-gz-to-zip');
});

test('every route the registry emits round-trips through resolveRoute', () => {
  for (const route of registry.getAllRoutes({ minStatus: 'planned' })) {
    const r = registry.resolveRoute(route, { minStatus: 'planned' });
    assert.ok(r && r.path === route, route);
  }
});

// ---------------------------------------------------------------- metadata --
test('converter metadata keeps the existing wording', () => {
  const m = registry.getConverterMetadata('jpg', 'png', { siteName: 'FlipItFree' });
  assert.equal(m.title, 'JPG to PNG Converter (JPEG to PNG) - Free Online | FlipItFree');
  assert.equal(m.h1, 'JPG to PNG Converter');
  assert.equal(m.path, '/jpg-to-png');
  assert.match(m.description, /^Convert JPG to PNG online\. Adjust quality and size/);
  assert.equal(m.converter.status, 'live');
  assert.deepEqual(m.breadcrumbs.at(-1), ['JPG to PNG', '/jpg-to-png']);
  assert.equal(registry.getConverterMetadata('png', 'webp').title, 'PNG to WEBP Converter - Free Online | FlipItFree');
  assert.equal(registry.getConverterMetadata('mp4', 'mp3'), null);
});

test('metadata for not-yet-live conversions is generic, not image-specific', () => {
  const m = registry.getConverterMetadata('docx', 'pdf', { minStatus: 'planned', siteName: 'X' });
  assert.equal(m.converter.status, 'planned');
  assert.equal(m.converter.engine, 'libreoffice');
  assert.equal(m.converter.backendRequired, true);
  assert.ok(!/quality and size/.test(m.description));
});

test('compress metadata', () => {
  const m = registry.getCompressMetadata('jpeg', { siteName: 'FlipItFree' });
  assert.equal(m.title, 'Compress JPG - Free Online JPG Compressor | FlipItFree');
  assert.equal(m.h1, 'Compress JPG Images Online');
  assert.equal(m.schemaName, 'JPG Compressor');
  assert.equal(registry.getCompressMetadata('svg'), null);
});

test('bad status names are rejected loudly', () => {
  assert.throws(() => registry.getFormats({ minStatus: 'finished' }), /Unknown status/);
});
