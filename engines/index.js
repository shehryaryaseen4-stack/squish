'use strict';
// Handlers: server-side code that performs conversions. A converter in the registry
// names its handler with `handler: 'image'`; this maps that name to the module.
// Handlers load lazily, so requiring this file costs nothing until one is used.
//
// A handler is `async (params, converter) => Buffer` (see engines/image.js).
// To add one: create engines/<name>.js, list it below, and reference it from a rule in
// registry/converters.js.

const HANDLER_IDS = ['image'];

function getHandler(id) {
  if (!HANDLER_IDS.includes(id)) throw new Error(`No handler registered with id "${id}"`);
  if (id === 'image') return require('./image').convertImage;
  throw new Error(`Handler "${id}" has no loader`); // unreachable while HANDLER_IDS and this switch agree
}

module.exports = { HANDLER_IDS, getHandler };
