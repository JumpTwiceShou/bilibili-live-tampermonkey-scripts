import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'src');
const entries = {
  'gift-panel/index.user.js': 'bilibili-live-gift-panel-overlay.user.js',
  'room-area/index.user.js': 'bilibili-live-room-area-badge.user.js',
  'special-layout/index.user.js': 'bilibili-live-special-layout.user.js',
  'special-blanc-redirect.user.js': 'bilibili-live-special-blanc-redirect.user.js',
};
const checkOnly = process.argv.includes('--check');

async function expand(file, stack = []) {
  const resolved = path.resolve(file);
  if (!resolved.startsWith(`${sourceRoot}${path.sep}`) || stack.includes(resolved)) {
    throw new Error(`Invalid or circular include: ${file}`);
  }
  const text = (await readFile(resolved, 'utf8')).replace(/\r\n/g, '\n');
  const include = /\/\* @include ([^*\r\n]+) \*\//g;
  let output = '';
  let offset = 0;
  for (const match of text.matchAll(include)) {
    const lineStart = text.lastIndexOf('\n', match.index - 1) + 1;
    const start = /^[ \t]*$/.test(text.slice(lineStart, match.index)) ? lineStart : match.index;
    output += text.slice(offset, start);
    output += await expand(path.resolve(path.dirname(resolved), match[1]), [...stack, resolved]);
    offset = match.index + match[0].length;
  }
  return output + text.slice(offset);
}

for (const [entry, output] of Object.entries(entries)) {
  const source = await expand(path.join(sourceRoot, entry));
  const generated = source.replace('// ==/UserScript==',
    `// ==/UserScript==\n// Generated from src/${entry}; run node scripts/build-userscripts.mjs.`);
  const outputPath = path.join(root, output);
  if (checkOnly) {
    const current = (await readFile(outputPath, 'utf8')).replace(/\r\n/g, '\n');
    if (current !== generated) throw new Error(`${output} is out of date`);
  } else {
    await writeFile(outputPath, generated, 'utf8');
  }
}
const variant = spawnSync(process.execPath, [path.join(root, 'scripts/generate-special-layout-no-list.mjs'),
  ...(checkOnly ? ['--check'] : [])], { cwd: root, stdio: 'inherit' });
if (variant.status !== 0) process.exit(variant.status || 1);
console.log(checkOnly ? 'Generated userscripts match their sources.' : 'Built standalone userscripts.');
