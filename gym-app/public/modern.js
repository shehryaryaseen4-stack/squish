// Uses new syntax on purpose: a browser too old for the app can't read this file,
// so the flag stays unset and oldbrowser.js shows what to do.
window.GYM_MODERN = ({ a: 1 })?.a ?? 0;
