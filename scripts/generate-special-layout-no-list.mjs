import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sourcePath = path.join(repoRoot, 'bilibili-live-special-layout.user.js');
const outputPath = path.join(repoRoot, 'bilibili-live-special-layout-no-list.user.js');
const checkOnly = process.argv.includes('--check');

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0 || source.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Expected exactly one ${label} marker`);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function generateNoList(source) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const versionMatch = source.match(/^\/\/ @version\s+(\S+)\s*$/m);
  if (!versionMatch) {
    throw new Error('Could not read canonical userscript version');
  }
  const version = versionMatch[1];
  let output = source;
  output = replaceOnce(
    output,
    '// @name         Bilibili Live Special Layout',
    '// @name         Bilibili Live Special Layout (No List)',
    'English name'
  );
  output = replaceOnce(
    output,
    '// @name:zh-CN   B站特殊聚合页普通直播间布局（保留列表）',
    '// @name:zh-CN   B站特殊聚合页普通直播间布局（隐藏列表）',
    'Chinese name'
  );
  output = replaceOnce(
    output,
    `// @version      ${version}`,
    `// @version      ${version}-no-list`,
    'metadata version'
  );
  output = replaceOnce(
    output,
    '// @description  Special-page only: keep-list/no-list layout normalization + native-like sidebar.',
    '// @description  Special-page only, fixed no-list mode + native-like sidebar.',
    'English description'
  );
  output = replaceOnce(
    output,
    '// @description:zh-CN 将 B 站特殊聚合直播页重排为接近普通直播间的宽屏布局，保留聚合列表并补齐关注侧栏和回到播放器按钮。',
    '// @description:zh-CN 将 B 站特殊聚合直播页重排为接近普通直播间的宽屏布局，隐藏聚合列表并补齐关注侧栏和回到播放器按钮。',
    'Chinese description'
  );
  output = replaceOnce(
    output,
    `  const VERSION = '${version}';`,
    `  const VERSION = '${version}-no-list';`,
    'runtime version'
  );
  output = replaceOnce(
    output,
    '  const FORCE_MODE = null;',
    "  const FORCE_MODE = 'no-list';",
    'forced mode'
  );
  output = replaceOnce(
    output,
    '// ==/UserScript==',
    `// ==/UserScript==${newline}// Generated from bilibili-live-special-layout.user.js; do not edit directly.`,
    'userscript metadata terminator'
  );
  return output;
}

const source = await readFile(sourcePath, 'utf8');
const generated = generateNoList(source);

if (checkOnly) {
  const current = await readFile(outputPath, 'utf8').catch(() => '');
  if (current !== generated) {
    console.error('Generated no-list userscript is out of date.');
    process.exitCode = 1;
  } else {
    console.log('Generated no-list userscript is up to date.');
  }
} else {
  await writeFile(outputPath, generated, 'utf8');
  console.log(`Generated ${path.basename(outputPath)} from ${path.basename(sourcePath)}.`);
}
