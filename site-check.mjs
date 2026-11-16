import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlFiles = ['index.html', 'young-breast-cancer-research.html', 'young-breast-cancer-consensus.html', 'young-breast-cancer-ai-product.html'];
const errors = [];

function read(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    errors.push(`${file}: file is missing`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

function checkScripts(file, html) {
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    try { new Function(match[1]); } catch (error) { errors.push(`${file}: inline JavaScript syntax error: ${error.message}`); }
  }
}

function checkLocalLinks(file, html) {
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/gi)) {
    const target = match[1];
    if (!target || target.startsWith('#') || /^(https?:|mailto:|data:|javascript:)/i.test(target)) continue;
    const clean = decodeURIComponent(target.split('#')[0].split('?')[0]);
    const resolved = path.resolve(path.dirname(path.join(root, file)), clean);
    if (clean && clean !== './' && !fs.existsSync(resolved)) errors.push(`${file}: local target is missing: ${target}`);
  }
}

for (const file of htmlFiles) {
  const html = read(file);
  if (!html) continue;
  if (!/<html[^>]+lang="zh-CN"/i.test(html)) errors.push(`${file}: missing lang=zh-CN`);
  if (!/<title>[^<]+<\/title>/i.test(html)) errors.push(`${file}: missing title`);
  if (!/<meta name="description"/i.test(html) && file !== 'young-breast-cancer-research.html') errors.push(`${file}: missing meta description`);
  checkScripts(file, html);
  checkLocalLinks(file, html);
  const ids = new Set([...html.matchAll(/\bid="([^" ]+)"/gi)].map(match => match[1]));
  for (const match of html.matchAll(/data-target="([^"]+)"/gi)) if (!ids.has(match[1])) errors.push(`${file}: nav target has no matching id: ${match[1]}`);
  for (const match of html.matchAll(/role="tab"[^>]*>/gi)) if (!/aria-controls="[^"]+"/.test(match[0])) errors.push(`${file}: tab is missing aria-controls`);
}

const index = read('index.html');
if (index && !index.includes('young-breast-cancer-ai-product.html')) errors.push('index.html: missing AI product report link');
if (index && !index.includes('id="decision-matrix"')) errors.push('index.html: missing decision matrix');
if (index && !index.includes('id="data-dictionary"')) errors.push('index.html: missing data dictionary');
const alias = read('young-breast-cancer-research.html');
if (alias && !alias.includes('noindex,follow')) errors.push('young-breast-cancer-research.html: legacy alias must be noindex');

if (errors.length) {
  console.error(errors.map(error => `✖ ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`site-check: ${htmlFiles.length} HTML files passed`);
}
