'use strict';
// Image handler: the code that actually converts/compresses raster images.
// Moved here verbatim from server.js so the registry can point at it
// (converter.handler === 'image'); the logic is unchanged.
//
// The libraries are injectable so the handler can be tested without real image files:
//   createImageHandler({ sharp, Jimp, pngToIco })
// The default handler loads the real ones on first use.

/**
 * @param {{sharp: Function, Jimp: {read: Function}, pngToIco: Function}} deps
 * @returns {(params: {buffer: Buffer, inputExt: string, format: string, quality: number, maxDim: number},
 *            converter: {pipeline: {decode: string, encode: string}}) => Promise<Buffer>}
 *   `format` is the output's apiFormat key ("jpeg", "png", "webp", "avif", "tiff", "gif", "ico").
 *   `converter` is the registry record for this pair; `converter.pipeline.decode` says whether
 *   to read the input with Sharp or via the Jimp bridge (BMP).
 */
function createImageHandler({ sharp, Jimp, pngToIco }) {
  /**
   * Decode + resize any supported input into a Sharp pipeline.
   * Handles BMP via a Jimp -> PNG bridge, since libvips (Sharp's engine)
   * doesn't read BMP at all.
   */
  async function loadAsSharp(buffer, decoder, { maxDim, animated }) {
    let pipeline;

    if (decoder === 'jimp') {
      const jimpImg = await Jimp.read(buffer);
      const pngBuffer = await jimpImg.getBuffer('image/png');
      pipeline = sharp(pngBuffer);
    } else if (decoder === 'sharp') {
      pipeline = sharp(buffer, { animated: !!animated, limitInputPixels: 268402689 });
    } else {
      throw new Error(`Image handler cannot decode with "${decoder}".`);
    }

    // Phone photos are often stored sideways with an EXIF "orientation" flag; turn the pixels
    // upright, since the output carries no metadata. (Animated images have no such flag.)
    if (!animated) pipeline = pipeline.rotate();
    if (maxDim && maxDim > 0) {
      pipeline = pipeline.resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true });
    }
    return pipeline;
  }

  return async function convertImage({ buffer, inputExt, format, quality, maxDim }, converter) {
    // Keep animation when the source is an animated GIF and the target
    // format can actually carry animation (gif or webp). Otherwise we
    // read a single frame — a static output can't be animated regardless
    // of which tool produces it.
    const wantsAnimation = inputExt === 'gif' && (format === 'gif' || format === 'webp');

    const pipeline = await loadAsSharp(buffer, converter.pipeline.decode, { maxDim, animated: wantsAnimation });

    switch (format) {
      case 'jpeg':
        return pipeline.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true }).toBuffer();
      case 'png':
        // Below 100 the colours are reduced to a palette (much smaller files); at 100 the PNG
        // is lossless full colour, which photos need.
        return (quality >= 100 ? pipeline.png({ compressionLevel: 9 }) : pipeline.png({ quality, compressionLevel: 9 })).toBuffer();
      case 'webp':
        return pipeline.webp({ quality, animated: wantsAnimation }).toBuffer();
      case 'avif':
        return pipeline.avif({ quality }).toBuffer();
      case 'tiff':
        return pipeline.tiff({ quality }).toBuffer();
      case 'gif':
        return pipeline.gif({ colors: Math.round(32 + (quality / 100) * 224) }).toBuffer();
      case 'ico': {
        // .ico has no native encoder in libvips, so we render a set of
        // square PNGs at standard favicon sizes and let png-to-ico pack
        // them into a real multi-resolution .ico container. Uses the
        // already-decoded `pipeline` (not the raw upload buffer) so this
        // also works for inputs like BMP that only Jimp can read.
        const sizes = [16, 32, 48, 64, 128, 256].filter((s) => !maxDim || s <= maxDim || s === 16);
        const pngBuffers = await Promise.all(
          sizes.map((s) => pipeline.clone().resize(s, s, { fit: 'cover' }).png().toBuffer())
        );
        return pngToIco(pngBuffers);
      }
      default: {
        const err = new Error(`Image handler has no encoder for "${format}".`);
        err.statusCode = 400;
        throw err;
      }
    }
  };
}

let defaultHandler = null;
/** The real handler, with Sharp/Jimp/png-to-ico loaded on first use. */
function convertImage(params, converter) {
  if (!defaultHandler) {
    defaultHandler = createImageHandler({
      sharp: require('sharp'),
      Jimp: require('jimp').Jimp,
      pngToIco: require('png-to-ico'),
    });
  }
  return defaultHandler(params, converter);
}

module.exports = { createImageHandler, convertImage };
