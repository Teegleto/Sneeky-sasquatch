#!/usr/bin/env node
/*
 * Bundles the game into one self-contained HTML file (CSS and JS inlined).
 *
 *   node tools/build-single-file.js                 -> dist/sneeky-sasquatch.html
 *   node tools/build-single-file.js out.html        -> custom output path
 *   node tools/build-single-file.js out.html --fragment
 *        -> same, but without the <!doctype>/<html>/<head>/<body> wrapper,
 *           for hosts that add their own page skeleton.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = path.resolve(args.find(a => !a.startsWith('--')) || path.join(root, 'dist', 'sneeky-sasquatch.html'));

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
// keep "</script>" inside inlined code from closing the tag early
const safe = code => code.replace(/<\/script/gi, '<\\/script');

html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, href) => '<style>\n' + read(href) + '\n</style>');
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, src) => '<script>\n' + safe(read(src)) + '\n</script>');

if (fragment) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<meta charset[^>]*>\s*/i, '')
    .replace(/<meta name="viewport"[^>]*>\s*/i, '');
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  html = head.trim() + '\n' + body.trim() + '\n';
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('Wrote ' + path.relative(process.cwd(), out) + ' (' + Math.round(html.length / 1024) + ' KB)');
