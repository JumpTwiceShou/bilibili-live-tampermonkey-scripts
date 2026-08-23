import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error([
      `Command failed: node ${args.join(' ')}`,
      result.stdout,
      result.stderr
    ].filter(Boolean).join('\n'));
  }
}

function readVersion(source, expression, label) {
  const match = source.match(expression);
  assert(match, `missing ${label}`);
  return match[1];
}

function exposeLayoutHelpers(source) {
  const terminator = '\n})();';
  const index = source.lastIndexOf(terminator);
  assert(index >= 0, 'canonical layout userscript terminator is present');
  return `${source.slice(0, index)}
  globalThis.__bliveLayoutValidation = {
    calculateTargetPlayerSize,
    extractRooms,
    findFirstUrl,
    getNormalRoomPlayerWidth,
    normalizeHttpUrl
  };
${source.slice(index)}`;
}

function exposeRedirectHelpers(source) {
  const boot = /\r?\n  start\(\);\r?\n\}\)\(\);\s*$/;
  const match = source.match(boot);
  assert(match?.index >= 0, 'redirect userscript boot call is present');
  return `${source.slice(0, match.index)}
  globalThis.__bliveRedirectValidation = {
    isSkippablePage,
    isSpecialTopPage,
    normalizeBlancUrl
  };
})();`;
}

function loadRedirectHelpers(source, href) {
  const location = new URL(href);
  const window = {};
  window.top = window;
  const context = vm.createContext({
    location,
    URL,
    URLSearchParams,
    window
  });
  vm.runInContext(exposeRedirectHelpers(source), context, {
    filename: 'bilibili-live-special-blanc-redirect.user.js'
  });
  return context.__bliveRedirectValidation;
}

function selectorDocument(selectors) {
  const present = new Set(selectors);
  return {
    querySelector(selector) {
      return present.has(selector) ? { selector } : null;
    }
  };
}

function loadLayoutHelpers(source) {
  const location = new URL('https://live.bilibili.com/123');
  const document = {
    readyState: 'loading',
    documentElement: {
      clientWidth: 0,
      clientHeight: 0
    },
    addEventListener() {}
  };
  const window = {
    location,
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {}
    }
  };
  window.top = window;
  const context = vm.createContext({
    console,
    document,
    location,
    URL,
    URLSearchParams,
    window
  });
  vm.runInContext(exposeLayoutHelpers(source), context, {
    filename: 'bilibili-live-special-layout.user.js'
  });
  return context.__bliveLayoutValidation;
}

async function main() {
  const userscriptFiles = (await readdir(repoRoot))
    .filter((name) => name.endsWith('.user.js'))
    .sort();
  assert(userscriptFiles.length > 0, 'userscripts are present');

  for (const file of userscriptFiles) {
    runNode(['--check', file]);
    const source = await readFile(path.join(repoRoot, file), 'utf8');
    const metadataVersion = readVersion(
      source,
      /^\/\/ @version\s+(\S+)\s*$/m,
      `${file} metadata version`
    );
    const runtimeVersion = readVersion(
      source,
      /^\s*const VERSION = '([^']+)';\s*$/m,
      `${file} runtime version`
    );
    assert.equal(runtimeVersion, metadataVersion, `${file} runtime and metadata versions match`);
    assert(!source.includes("querySelectorAll('*')"), `${file} avoids all-element scans`);
  }

  runNode(['--check', 'debug-special-page.mjs']);
  runNode(['scripts/generate-special-layout-no-list.mjs', '--check']);

  const fixtureDir = path.join(repoRoot, 'tests', 'fixtures');
  const fixtureFiles = (await readdir(fixtureDir))
    .filter((name) => name.endsWith('.html'))
    .sort();
  for (const file of fixtureFiles) {
    const html = await readFile(path.join(fixtureDir, file), 'utf8');
    const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
    inlineScripts.forEach((match, index) => {
      new vm.Script(match[1], { filename: `${file}#inline-${index + 1}` });
    });
    for (const match of html.matchAll(/<script[^>]*\bsrc="\/([^"?]+\.user\.js)"[^>]*><\/script>/gi)) {
      assert(userscriptFiles.includes(match[1]), `${file} references an existing userscript`);
    }
  }

  const canonicalPath = path.join(repoRoot, 'bilibili-live-special-layout.user.js');
  const noListPath = path.join(repoRoot, 'bilibili-live-special-layout-no-list.user.js');
  const canonical = await readFile(canonicalPath, 'utf8');
  const noList = await readFile(noListPath, 'utf8');
  assert(!canonical.includes('OFFICIAL_SIDEBAR_CSS_URLS'), 'layout sidebar has no external CSS loader');
  assert(!canonical.includes('.vip.css'), 'layout sidebar does not depend on versioned Bilibili CSS');
  assert(!canonical.includes('Math.min(1220, targetWidth)'), 'keep-list width is not capped below the player width');
  assert(!canonical.includes('barHeight > 90'), 'initial list state does not depend on rendered height');
  assert(!canonical.includes('blfCollapseTry'), 'initial list collapse never uses retry clicks');
  assert(
    canonical.includes("const expanded = btn.classList.contains('liveexpand');"),
    'initial list state follows the native expand-button class'
  );
  assert(
    noList.includes('Generated from bilibili-live-special-layout.user.js; do not edit directly.'),
    'no-list userscript records its generated origin'
  );

  const redirectSource = await readFile(
    path.join(repoRoot, 'bilibili-live-special-blanc-redirect.user.js'),
    'utf8'
  );
  const redirectHelpers = loadRedirectHelpers(
    redirectSource,
    'https://live.bilibili.com/blackboard/era/test-special-page.html'
  );
  assert.equal(redirectHelpers.isSkippablePage(), false, 'blackboard activity paths are eligible for DOM detection');
  assert.equal(
    loadRedirectHelpers(redirectSource, 'https://live.bilibili.com/blanc/23612045').isSkippablePage(),
    true,
    'blanc player pages do not redirect recursively'
  );
  assert.equal(
    loadRedirectHelpers(
      redirectSource,
      'https://live.bilibili.com/123?blive_no_blanc_redirect=1'
    ).isSkippablePage(),
    true,
    'manual redirect opt-out remains supported'
  );
  const specialPage = selectorDocument([
    '.live-non-revenue-player',
    '.live-player-bg',
    'iframe[src*="/blanc/"]'
  ]);
  assert.equal(
    redirectHelpers.isSpecialTopPage(specialPage),
    true,
    'special player DOM with a blanc frame is detected independently of the entry URL'
  );
  const normalPage = selectorDocument([
    '.live-non-revenue-player',
    '.live-player-handle-bar',
    '.live-player-bg',
    '.rendererRoot, .layerWrapperRoot, [class*="pageRoot"]',
    '.player-and-aside-area'
  ]);
  assert.equal(redirectHelpers.isSpecialTopPage(normalPage), false, 'normal room layout is not classified as special');
  assert.equal(
    redirectHelpers.normalizeBlancUrl('//live.bilibili.com/blanc/23612045'),
    'https://live.bilibili.com/blanc/23612045?liteVersion=true',
    'same-origin blanc targets are normalized'
  );
  assert.equal(
    redirectHelpers.normalizeBlancUrl('https://example.com/blanc/23612045'),
    '',
    'cross-origin blanc targets are rejected'
  );

  const helpers = loadLayoutHelpers(canonical);
  const baseMetrics = { width: 1220, ratio: 9 / 16 };
  const wide = helpers.calculateTargetPlayerSize(1920, 40, baseMetrics, 1800);
  const narrow = helpers.calculateTargetPlayerSize(1280, 40, baseMetrics, 1180);
  const tiny = helpers.calculateTargetPlayerSize(300, 20, baseMetrics, 800);
  assert(narrow.width < wide.width, 'responsive player shrinks with a narrower viewport');
  assert(narrow.shellWidth <= 1280 - 32, 'narrow player shell respects the viewport gutter');
  assert(tiny.shellWidth <= 300 - 32, 'tiny player shell remains clamped to the usable viewport');
  assert.equal(narrow.height, Math.round(narrow.width * 9 / 16), 'player aspect ratio is preserved');

  assert.equal(helpers.normalizeHttpUrl('javascript:alert(1)'), '', 'unsafe URL protocols are rejected');
  assert.equal(
    helpers.normalizeHttpUrl('//i0.hdslb.com/avatar.jpg'),
    'https://i0.hdslb.com/avatar.jpg',
    'protocol-relative image URLs are normalized'
  );
  const rooms = Array.from({ length: 120 }, (_, index) => ({
    roomid: index + 1,
    face: `https://i0.hdslb.com/${index}.jpg`,
    nickname: `主播 ${index}`,
    link: `https://live.bilibili.com/${index + 1}`
  }));
  rooms.unshift({
    roomid: 999,
    face: 'https://i0.hdslb.com/unsafe.jpg',
    nickname: '不安全链接',
    link: 'javascript:alert(1)'
  });
  const extracted = helpers.extractRooms({ code: 0, data: rooms });
  assert.equal(extracted.length, 100, 'follow-room extraction is bounded');
  assert(!extracted.some((room) => room.roomid === 999), 'unsafe follow-room links are omitted');
  assert.equal(
    helpers.findFirstUrl({ jump_url: 'javascript:alert(1)', nested: { url: 'https://live.bilibili.com/p/html/live-labs/' } }),
    'https://live.bilibili.com/p/html/live-labs/',
    'lab URL lookup skips unsafe candidates'
  );

  console.log(
    `Validated ${userscriptFiles.length} userscripts, ${fixtureFiles.length} browser fixtures, generated parity, and layout invariants.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
