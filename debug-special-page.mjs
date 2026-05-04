import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwrightEntry = process.env.PLAYWRIGHT_ENTRY || 'playwright';
const { chromium } = require(playwrightEntry);

const PAGE_URL = 'https://live.bilibili.com/12101556';
const SCRIPT_PATH = path.resolve('bilibili-live-special-layout.user.js');
const OUTPUT_DIR = path.resolve('.playwright-cli', 'debug-special-page');
const SKIP_WEB_MODE = process.env.SKIP_WEB_MODE === '1';

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logStep(message) {
  console.log(`\n[debug] ${message}`);
}

async function snapshotState(page, label) {
  const state = await page.evaluate(() => {
    const pick = (selector) => {
      const el = document.querySelector(selector);
      if (!el) {
        return null;
      }
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        selector,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        display: style.display,
        position: style.position,
        overflow: style.overflow,
        zIndex: style.zIndex
      };
    };

    const popup = document.querySelector('#blf-special-sidebar-host .side-bar-popup-cntr');
    const followBtn = document.querySelector('#blf-special-sidebar-host .tm-sidebar-follow');
    const webModeText = Array.from(document.querySelectorAll('span, div, button'))
      .find((node) => (node.textContent || '').trim() === '网页模式');

    return {
      title: document.title,
      version: document.documentElement.dataset.bliveSpecialLayoutVersion || '',
      scrollY: Math.round(window.scrollY),
      bodyClass: document.body?.className || '',
      htmlClass: document.documentElement.className,
      playerRoot: pick('.live-non-revenue-player'),
      playerBg: pick('.live-player-bg'),
      player: pick('.player'),
      playerIframe: pick('.player iframe'),
      handleBar: pick('.live-player-handle-bar'),
      fullscreenWrap: pick('.fullscreen-container-paddingbox'),
      fullscreenContainer: pick('#fullscreen-container'),
      chatPanel: pick('.chat-history-panel'),
      followHost: pick('#blf-special-sidebar-host'),
      popup: popup ? {
        className: popup.className,
        display: getComputedStyle(popup).display
      } : null,
      followBtn: followBtn ? {
        text: (followBtn.textContent || '').trim(),
        rect: followBtn.getBoundingClientRect().toJSON()
      } : null,
      webModeNode: webModeText ? {
        text: webModeText.textContent.trim(),
        tag: webModeText.tagName,
        className: webModeText.className
      } : null
    };
  });

  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(state, null, 2));
  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${label}.png`),
    fullPage: false
  });
}

async function dismissPopups(page) {
  const selectors = [
    '.web-player-module-area-mask',
    '.bili-mini-mask',
    '.bili-popup__mask',
    '.link-toast',
    '.dp-i-dialog'
  ];
  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if (await loc.isVisible().catch(() => false)) {
      await page.mouse.click(20, 20).catch(() => {});
      await wait(300);
    }
  }
}

async function logFrames(page, label) {
  logStep(`frames for ${label}`);
  for (const frame of page.frames()) {
    const info = await frame.evaluate(() => {
      const texts = Array.from(document.querySelectorAll('button, span, div'))
        .map((node) => (node.textContent || '').trim())
        .filter((text) => text && /网页|关注|我的关注|弹幕/.test(text))
        .slice(0, 20);
      return {
        title: document.title,
        version: document.documentElement.dataset.bliveSpecialLayoutVersion || '',
        htmlClass: document.documentElement.className,
        texts
      };
    }).catch(() => ({ title: '', texts: [] }));
    console.log(JSON.stringify({
      url: frame.url(),
      ...info
    }, null, 2));
  }
}

async function clickFrameControl(page, textOrRegex) {
  for (const frame of page.frames()) {
    try {
      await frame.locator('body').hover({ position: { x: 960, y: 540 }, timeout: 5000 });
      const control = frame.getByText(textOrRegex).first();
      if (await control.isVisible({ timeout: 5000 }).catch(() => false)) {
        await control.click({ force: true });
        return true;
      }
    } catch (_err) {
      // Continue scanning frames.
    }
  }
  return false;
}

async function clickWebMode(page) {
  const exited = await clickFrameControl(page, /退出网页模式/);
  if (exited) {
    await wait(1500);
  }

  const entered = await clickFrameControl(page, /^网页模式$/);
  if (entered) {
    return;
  }

  if (exited) {
    throw new Error('Exited web mode but could not find 网页模式 to enter again');
  }
  throw new Error('Could not find visible 网页模式 control in any frame');
}

async function openFollowPopup(page) {
  const followBtn = page.locator('#blf-special-sidebar-host .tm-sidebar-follow');
  await followBtn.waitFor({ state: 'visible', timeout: 30000 });
  await followBtn.click();
  await wait(300);
  const isOpen = await page.evaluate(() => {
    const popup = document.querySelector('#blf-special-sidebar-host .side-bar-popup-cntr');
    return popup ? getComputedStyle(popup).display !== 'none' : false;
  });
  if (!isOpen) {
    await page.evaluate(() => {
      document.querySelector('#blf-special-sidebar-host .tm-sidebar-follow')?.click();
    });
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const scriptContent = await readFile(SCRIPT_PATH, 'utf8');
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome'
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    console.log(`[browser:${msg.type()}] ${msg.text()}`);
  });
  page.setDefaultTimeout(15000);

  logStep('goto page');
  await page.addInitScript({ content: scriptContent });
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await page.waitForFunction(
    () => Boolean(document.documentElement.dataset.bliveSpecialLayoutVersion),
    { timeout: 45000 }
  );

  await dismissPopups(page);
  await wait(3000);
  await logFrames(page, 'initial');
  await snapshotState(page, '01-initial');

  if (SKIP_WEB_MODE) {
    logStep('skip web mode step');
  } else {
    logStep('click web mode');
    await clickWebMode(page);
    await wait(3000);
    await logFrames(page, 'web-mode');
    await snapshotState(page, '02-web-mode');
  }

  logStep('open follow popup');
  await openFollowPopup(page);
  await wait(1500);
  await snapshotState(page, '03-follow-open');

  logStep('click player area to close popup');
  await page.mouse.click(900, 500);
  await wait(1000);
  await snapshotState(page, '04-after-player-click');

  await context.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
