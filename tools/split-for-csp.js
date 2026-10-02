#!/usr/bin/env node
// Docker-image build only: splits dist/index.html into index.html + app.css + app.js
// so the container can serve a strict CSP (script-src 'self', no inline script/style).
// The published single-file build (dist/index.html) is not touched.
const fs = require('fs');
const path = require('path');
const dist = path.join(__dirname, '..', 'dist');
const out = path.join(dist, 'site');
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const take = (re, name) => {
  const m = html.match(re);
  if (!m) { console.error('split: no inline ' + name + ' found'); process.exit(1); }
  return m;
};
const css = take(/<style>([\s\S]*?)<\/style>/, 'style');
const js = take(/<script>([\s\S]*?)<\/script>/, 'script');
html = html.replace(css[0], () => '<link rel="stylesheet" href="app.css">');
html = html.replace(js[0], () => '<script src="app.js"></script>');
if (/<style|<script>|\son\w+="/.test(html)) { console.error('split: inline code remains'); process.exit(1); }

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, 'app.css'), css[1]);
fs.writeFileSync(path.join(out, 'app.js'), js[1]);
console.log('split dist/site: index.html app.css app.js');
