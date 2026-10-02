'use strict';
// FlipFree logo, shared by the page header/footer (pages.js), favicons and share images (seo.js)
// and the files in public/. The word mark is drawn as outlines (Inter SemiBold, +0.8 letter
// spacing) so it looks the same everywhere without loading a web font.

const RED = '#E5322D';

// Icon: a page between two thin flip arrows on a red rounded tile (32x32 units).
const TILE = `<rect x="1" y="1" width="30" height="30" rx="8" fill="${RED}"/>`;
const MARK = '<path d="M12.9 11h3.9l2.3 2.3v7.2a.6.6 0 0 1-.6.6h-5.6a.6.6 0 0 1-.6-.6V11.6a.6.6 0 0 1 .6-.6z" fill="#fff"/>'
  + `<path d="M16.8 11v2.3h2.3" fill="none" stroke="${RED}" stroke-width=".9" stroke-linejoin="round"/>`
  + '<g fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M7 16.5A9 9 0 0 1 15 7.1M13.2 5.3l1.9 1.8-1.9 1.9M25 15.5A9 9 0 0 1 17 24.9M18.8 26.7l-1.9-1.8 1.9-1.9"/></g>';

// "Flip" and "Free" outlines, baseline at y=28, both starting at x=0.
const FLIP = 'M1.9,28V9.08H14.02V11.94H5.29v5.67h7.87v2.82H5.29V28ZM21.14,9.08V28H17.84V9.08ZM25.44,28V13.81h3.3V28Zm1.65-16.2q-0.79,0-1.36-0.53-0.56-0.53-0.56-1.27 0-0.76 0.56-1.28 0.57-0.53 1.36-0.53 0.8,0 1.36,0.53 0.57,0.52 0.57,1.27 0,0.75-0.57,1.28-0.56,0.53-1.36,0.53zM33.05,33.31v-19.5h3.22v2.35h0.22q0.25-0.51 0.72-1.09 0.47-0.58 1.27-1 0.81-0.43 2.07-0.43 1.65,0 2.97,0.84 1.32,0.84 2.09,2.48 0.79,1.63 0.79,3.99 0,2.34-0.76,3.97-0.76,1.64-2.09,2.5-1.32,0.85-3.01,0.85-1.21,0-2.02-0.41-0.81-0.42-1.29-1-0.48-0.58-0.74-1.09h-0.14v7.55zm6.6-7.77q1.1,0 1.85-0.6 0.75-0.61 1.13-1.65 0.38-1.05 0.38-2.37 0-1.32-0.38-2.35-0.37-1.04-1.12-1.63-0.75-0.6-1.87-0.6-1.09,0-1.84,0.57-0.75,0.57-1.14,1.6-0.38,1.02-0.38,2.4 0,1.38 0.38,2.42 0.39,1.04 1.14,1.63 0.76,0.57 1.84,0.57z';
const FREE = 'M1.9,28V9.08H14.02V11.94H5.29v5.67h7.87v2.82H5.29V28ZM17.24,28V13.81h3.2v2.37h0.15q0.38-1.23 1.33-1.89 0.95-0.67 2.17-0.67 0.28,0 0.62,0.03 0.34,0.03 0.58,0.06v3.03q-0.2-0.06-0.66-0.11-0.46-0.05-0.9-0.05-0.91,0-1.65,0.39-0.72,0.39-1.14,1.09-0.41,0.69-0.41,1.59V28ZM34.06,28.29q-2.15,0-3.69-0.9-1.54-0.9-2.37-2.54-0.83-1.64-0.83-3.86 0-2.2 0.81-3.85 0.83-1.65 2.32-2.58 1.51-0.94 3.54-0.94 1.29,0 2.46,0.42 1.18,0.42 2.08,1.29 0.91,0.88 1.42,2.23 0.52,1.35 0.52,3.21v1.04H28.73v-2.25h9.97l-1.55,0.66q0-1.19-0.37-2.09-0.37-0.91-1.1-1.42-0.72-0.51-1.82-0.51-1.09,0-1.85,0.52-0.76,0.51-1.17,1.37-0.39,0.85-0.39,1.9v1.55q0,1.35 0.46,2.27 0.46,0.93 1.28,1.4 0.83,0.47 1.92,0.47 0.72,0 1.31-0.2 0.6-0.22 1.03-0.62 0.43-0.42 0.65-1.02l3.03,0.62q-0.34,1.14-1.17,2.01-0.83,0.85-2.07,1.33-1.23,0.47-2.82,0.47zM50.24,28.29q-2.15,0-3.69-0.9-1.54-0.9-2.37-2.54-0.83-1.64-0.83-3.86 0-2.2 0.81-3.85 0.83-1.65 2.32-2.58 1.51-0.94 3.54-0.94 1.29,0 2.46,0.42 1.18,0.42 2.08,1.29 0.91,0.88 1.42,2.23 0.52,1.35 0.52,3.21v1.04H44.9v-2.25h9.97L53.32,20.24q0-1.19-0.37-2.09-0.37-0.91-1.1-1.42-0.72-0.51-1.82-0.51-1.09,0-1.85,0.52-0.76,0.51-1.17,1.37-0.39,0.85-0.39,1.9v1.55q0,1.35 0.46,2.27 0.46,0.93 1.28,1.4 0.83,0.47 1.92,0.47 0.72,0 1.31-0.2 0.6-0.22 1.03-0.62 0.43-0.42 0.65-1.02l3.03,0.62q-0.34,1.14-1.17,2.01-0.83,0.85-2.07,1.33-1.23,0.47-2.82,0.47z';

// Full logo, 147x40 units: icon on the left, then the word mark. flip/free are fill colours.
const W = 147;
const H = 40;
const logoInner = ({ flip = '#23262D', free = RED } = {}) => `<g transform="translate(0 4)">${TILE}${MARK}</g>`
  + `<g transform="translate(40.1 1.5)"><path fill="${flip}" d="${FLIP}"/><path fill="${free}" transform="translate(48.2 0)" d="${FREE}"/></g>`;

// Standalone SVG file (public/logo.svg and friends).
const logoFile = (colors) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 4}" height="${H * 4}" viewBox="0 0 ${W} ${H}"><title>FlipFree</title>${logoInner(colors)}</svg>\n`;
const iconFile = () => `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 32 32"><title>FlipFree</title>${TILE}${MARK}</svg>\n`;

module.exports = { RED, TILE, MARK, W, H, logoInner, logoFile, iconFile };
