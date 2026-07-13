import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwrightEntry = process.env.PLAYWRIGHT_ENTRY || 'playwright';
const PAGE_URL = process.env.PAGE_URL || 'https://live.bilibili.com/12101556';
const SCRIPT_PATH = path.resolve(
  process.env.SCRIPT_PATH || 'bilibili-live-special-layout.user.js'
);
const OUTPUT_DIR = path.resolve(
  process.env.OUTPUT_DIR || path.join('.playwright-cli', 'debug-special-page')
);
const SKIP_WEB_MODE = process.env.SKIP_WEB_MODE === '1';
const HEADLESS = process.env.HEADLESS !== '0';
const BROWSER_CHANNEL = process.env.BROWSER_CHANNEL || 'chrome';
const EXPECTED_MODE = process.env.EXPECTED_MODE
  || (path.basename(SCRIPT_PATH).includes('no-list') ? 'no-list' : 'keep-list');
const INITIAL_VIEWPORT = { width: 1920, height: 1080 };
const NARROW_VIEWPORT = { width: 1280, height: 800 };

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logStep(message) {
  console.log(`\n[debug] ${message}`);
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
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
        display: getComputedStyle(popup).display,
        role: popup.getAttribute('role'),
        ariaHidden: popup.getAttribute('aria-hidden'),
        ariaBusy: popup.getAttribute('aria-busy')
      } : null,
      followBtn: followBtn ? {
        tag: followBtn.tagName,
        text: (followBtn.textContent || '').trim(),
        ariaExpanded: followBtn.getAttribute('aria-expanded'),
        rect: followBtn.getBoundingClientRect().toJSON()
      } : null,
      topBtn: (() => {
        const button = document.querySelector('#blf-special-sidebar-host .tm-sidebar-top');
        return button ? {
          tag: button.tagName,
          hidden: button.hidden,
          display: getComputedStyle(button).display
        } : null;
      })(),
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
  return state;
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

function validateInitialState(state) {
  assertCondition(Boolean(state.version), 'userscript version marker is present');
  assertCondition(state.playerRoot?.rect.width > 300, 'special player has a measurable width');
  assertCondition(state.followBtn?.tag === 'BUTTON', 'follow control is keyboard-accessible');
  assertCondition(state.popup?.role === 'dialog', 'follow popup exposes dialog semantics');
  assertCondition(state.popup?.ariaHidden === 'true', 'follow popup starts closed');
  assertCondition(
    EXPECTED_MODE === 'no-list'
      ? state.htmlClass.includes('blf-no-list')
      : !state.htmlClass.includes('blf-no-list'),
    `layout mode matches ${EXPECTED_MODE}`
  );
}

async function validateResponsiveShrink(page, initialState) {
  const initialWidth = initialState.playerRoot.rect.width;
  await page.setViewportSize(NARROW_VIEWPORT);
  await page.waitForFunction(
    ({ previousWidth, maximumWidth }) => {
      const width = document.querySelector('.live-non-revenue-player')
        ?.getBoundingClientRect().width || 0;
      return width > 0 && width < previousWidth - 1 && width <= maximumWidth + 2;
    },
    {
      previousWidth: initialWidth,
      maximumWidth: NARROW_VIEWPORT.width - 32
    },
    { timeout: 15000 }
  );
  const narrowState = await snapshotState(page, '02-narrow');
  const narrowWidth = narrowState.playerRoot?.rect.width || 0;
  assertCondition(narrowWidth < initialWidth, 'player shrinks with the viewport');
  assertCondition(
    narrowWidth <= NARROW_VIEWPORT.width - 32 + 2,
    'player stays inside the configured viewport gutter'
  );

  await page.setViewportSize(INITIAL_VIEWPORT);
  await page.waitForFunction(
    (previousWidth) => (
      (document.querySelector('.live-non-revenue-player')
        ?.getBoundingClientRect().width || 0) > previousWidth + 1
    ),
    narrowWidth,
    { timeout: 15000 }
  );
  await snapshotState(page, '03-restored');
}

async function validateReturnButton(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(500);
  const startsHidden = await page.locator('#blf-special-sidebar-host .tm-sidebar-top')
    .evaluate((button) => button.hidden);
  assertCondition(startsHidden, 'return-to-player control starts hidden near the player');

  const playerTop = await page.evaluate(() => {
    const spacer = document.createElement('div');
    spacer.id = 'blf-debug-scroll-spacer';
    spacer.style.height = `${window.innerHeight + 600}px`;
    spacer.style.pointerEvents = 'none';
    document.body.appendChild(spacer);
    const player = document.querySelector('.live-player-bg, #player-ctnr, .player');
    if (!player) {
      return 0;
    }
    const rect = player.getBoundingClientRect();
    return Math.max(0, Math.round(window.scrollY + rect.top));
  });

  try {
    await page.evaluate((top) => window.scrollTo(0, top + 300), playerTop);
    await page.waitForFunction(
      () => {
        const button = document.querySelector('#blf-special-sidebar-host .tm-sidebar-top');
        return Boolean(button && !button.hidden && getComputedStyle(button).display !== 'none');
      },
      undefined,
      { timeout: 10000 }
    );
    await snapshotState(page, '04-return-visible');
    await page.locator('#blf-special-sidebar-host .tm-sidebar-top').click();
    await page.waitForFunction(
      (top) => Math.abs(window.scrollY - top) <= 30,
      playerTop,
      { timeout: 10000 }
    );
  } finally {
    await page.evaluate(() => document.getElementById('blf-debug-scroll-spacer')?.remove());
  }
}

async function main() {
  let chromium;
  try {
    ({ chromium } = require(playwrightEntry));
  } catch (error) {
    throw new Error(
      `Cannot load Playwright from ${playwrightEntry}; set PLAYWRIGHT_ENTRY to a resolvable module path (${error.message})`
    );
  }

  let browser = null;
  let context = null;
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
    const scriptContent = await readFile(SCRIPT_PATH, 'utf8');
    const launchOptions = { headless: HEADLESS };
    if (BROWSER_CHANNEL && BROWSER_CHANNEL !== 'bundled') {
      launchOptions.channel = BROWSER_CHANNEL;
    }
    browser = await chromium.launch(launchOptions);
    context = await browser.newContext({ viewport: INITIAL_VIEWPORT });
    const page = await context.newPage();

    page.on('console', (msg) => {
      console.log(`[browser:${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (error) => {
      console.error(`[browser:pageerror] ${error.message}`);
    });
    page.setDefaultTimeout(15000);

    logStep(`goto ${PAGE_URL}`);
    await page.addInitScript({ content: scriptContent });
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
    await page.waitForFunction(
      () => Boolean(document.documentElement.dataset.bliveSpecialLayoutVersion),
      undefined,
      { timeout: 45000 }
    );

    await dismissPopups(page);
    await wait(3000);
    await logFrames(page, 'initial');
    const initialState = await snapshotState(page, '01-initial');
    validateInitialState(initialState);

    logStep('validate responsive shrink and restore');
    await validateResponsiveShrink(page, initialState);

    logStep('validate return-to-player visibility threshold');
    await validateReturnButton(page);

    if (SKIP_WEB_MODE) {
      logStep('skip web mode step');
    } else {
      logStep('click web mode');
      await clickWebMode(page);
      await wait(3000);
      await logFrames(page, 'web-mode');
      await snapshotState(page, '05-web-mode');
    }

    logStep('open follow popup');
    await openFollowPopup(page);
    await wait(1500);
    const openState = await snapshotState(page, '06-follow-open');
    assertCondition(openState.followBtn?.ariaExpanded === 'true', 'follow trigger reports expanded state');
    assertCondition(openState.popup?.ariaHidden === 'false', 'follow popup reports open state');

    logStep('click player area to close popup');
    await page.mouse.click(900, 500);
    await wait(1000);
    const closedState = await snapshotState(page, '07-after-player-click');
    assertCondition(closedState.popup?.ariaHidden === 'true', 'outside click closes follow popup');

    logStep('all browser assertions passed');
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
