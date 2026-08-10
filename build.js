#!/usr/bin/env node
// Bundles src/*.js into a single self-contained dist/index.html
const fs = require('fs');
const path = require('path');

const root = __dirname;
const srcDir = path.join(root, 'src');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).sort();

const bundle = files.map(f => {
  const code = fs.readFileSync(path.join(srcDir, f), 'utf8');
  return `\n/* ===== ${f} ===== */\n${code}`;
}).join('\n');

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scriptTags = /\n?<script src="src\/[^"]+"><\/script>/g;
if (!scriptTags.test(html)) {
  console.error('No src script tags found in index.html — nothing to inline.');
  process.exit(1);
}
html = html.replace(scriptTags, '');
// Function replacements: the bundle contains `$'`/`$&` sequences that a string
// replacement would treat as special patterns.
const inlined = `<script>\n(function(){\n'use strict';\n${bundle}\n})();\n<\/script>\n</body>`;
html = html.replace('</body>', () => inlined);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);

// Artifact build: same page without the document wrapper, since the artifact
// host supplies its own <!doctype>/<head>/<body>.
const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
const keep = head
  .split('\n')
  .filter(l => !/<meta\b/i.test(l))          // charset/viewport belong to the host
  .join('\n')
  .trim();
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), keep + '\n' + body.trim() + '\n');

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`built dist/index.html + dist/artifact.html  (${files.length} modules, ${kb} kB)`);
