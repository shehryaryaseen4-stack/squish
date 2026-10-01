'use strict';
// Handlers: server-side code that performs conversions. A converter in the registry
// names its handler (e.g. `handler: 'media'`); this maps that name to the module.
// Handlers load lazily, so requiring this file costs nothing until one is used.
//
// A handler is `async (params, converter) => Buffer | { buffer, ext }`, where params is
// { buffer, inputExt, format, quality, maxDim, from, to, filename } (see server.js).
// To add one: create engines/<name>.js, list it below, and reference it from a rule in
// registry/converters.js.

const LOADERS = {
  image: () => require('./image').convertImage,
  imagex: () => require('./imagex').convertImageX,
  media: () => require('./media').convertMedia,
  office: () => require('./office').convertOffice,
  markup: () => require('./markup').convertMarkup,
  pdf: () => require('./pdf').convertPdf,
  archive: () => require('./archive').convertArchive,
  vector: () => require('./vector').convertVector,
  font: () => require('./font').convertFont,
  ebook: () => require('./ebook').convertEbook,
  djvu: () => require('./djvu').convertDjvu,
};
const HANDLER_IDS = Object.keys(LOADERS);

function getHandler(id) {
  if (!LOADERS[id]) throw new Error(`No handler registered with id "${id}"`);
  return LOADERS[id]();
}

module.exports = { HANDLER_IDS, getHandler };
