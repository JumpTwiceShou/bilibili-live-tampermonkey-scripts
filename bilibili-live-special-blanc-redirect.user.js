// ==UserScript==
// @name         Bilibili Live Special Blanc Redirect
// @name:zh-CN   B站特殊聚合直播跳转普通播放器
// @namespace    https://live.bilibili.com/
// @version      1.0.2
// @description  Redirect special live pages to their embedded /blanc/ player page.
// @description:zh-CN 识别特殊聚合直播页内嵌的 /blanc/ 播放器并跳转到普通播放器页面。
// @match        https://live.bilibili.com/*
// @exclude      https://live.bilibili.com/blanc/*
// @exclude      https://live.bilibili.com/p/*
// @run-at       document-start
// @grant        none
// @noframes
// @license      GPL-3.0-only
// @supportURL   https://github.com/JumpTwiceShou/bilibili-live-tampermonkey-scripts/issues
// ==/UserScript==

(function () {
  'use strict';

  if (window.top !== window) {
    return;
  }

  const VERSION = '1.0.2';
  const SKIP_PARAM = 'blive_no_blanc_redirect';
  const BLANC_PATH_RE = /^\/blanc\/(\d+)\/?$/;
  const MAX_WATCH_MS = 30000;
  const SPECIAL_PAGE_RELEVANT_SELECTOR = [
    '.live-non-revenue-player',
    '.live-player-handle-bar',
    '.live-player-bg',
    'iframe[src*="/blanc/"]',
    '.rendererRoot',
    '.layerWrapperRoot',
    '[class*="pageRoot"]',
    '.player-and-aside-area'
  ].join(',');
  let redirected = false;
  let observer = null;
  let stopTimer = 0;

  function isSkippablePage() {
    if (location.pathname.startsWith('/blanc/') || location.pathname.startsWith('/p/')) {
      return true;
    }
    return new URLSearchParams(location.search).has(SKIP_PARAM);
  }

  function isSpecialTopPage(doc) {
    if (window.top !== window) {
      return false;
    }
    const hasSpecialPlayer = Boolean(doc.querySelector('.live-non-revenue-player'));
    const hasHandleBar = Boolean(doc.querySelector('.live-player-handle-bar'));
    const hasPlayerBg = Boolean(doc.querySelector('.live-player-bg'));
    const hasBlancFrame = Boolean(doc.querySelector('iframe[src*="/blanc/"]'));
    const hasActivityRoot = Boolean(doc.querySelector('.rendererRoot, .layerWrapperRoot, [class*="pageRoot"]'));
    const hasNormalLayout = Boolean(doc.querySelector('.player-and-aside-area'));

    if (!hasSpecialPlayer) {
      return false;
    }

    if (hasBlancFrame && (hasHandleBar || hasPlayerBg)) {
      return true;
    }

    return !hasNormalLayout && hasActivityRoot && hasHandleBar && hasPlayerBg;
  }

  function normalizeBlancUrl(value) {
    if (!value) {
      return '';
    }
    let url;
    try {
      url = new URL(value, location.href);
    } catch (_err) {
      return '';
    }

    if (url.origin !== location.origin || !BLANC_PATH_RE.test(url.pathname)) {
      return '';
    }
    url.searchParams.set('liteVersion', 'true');
    return url.href;
  }

  function findBlancUrl(doc) {
    const frames = doc.querySelectorAll('iframe[src*="/blanc/"]');
    for (const frame of frames) {
      const url = normalizeBlancUrl(frame.getAttribute('src') || frame.src || '');
      if (url) {
        return url;
      }
    }
    return '';
  }

  function findBlancUrlInNode(node) {
    if (!(node instanceof Element)) {
      return '';
    }
    if (node.matches('iframe')) {
      const direct = normalizeBlancUrl(node.getAttribute('src') || node.src || '');
      if (direct) {
        return direct;
      }
    }
    return findBlancUrl(node);
  }

  function findBlancUrlInMutations(records) {
    for (const record of records) {
      if (record.type === 'attributes') {
        const target = findBlancUrlInNode(record.target);
        if (target) {
          return target;
        }
        continue;
      }
      for (const node of record.addedNodes) {
        const target = findBlancUrlInNode(node);
        if (target) {
          return target;
        }
      }
    }
    return '';
  }

  function nodeMayRevealPageType(node) {
    return node instanceof Element && (
      node.matches(SPECIAL_PAGE_RELEVANT_SELECTOR)
      || Boolean(node.querySelector(SPECIAL_PAGE_RELEVANT_SELECTOR))
    );
  }

  function mutationsMayRevealPageType(records) {
    return records.some((record) => {
      if (record.type === 'attributes') {
        return nodeMayRevealPageType(record.target);
      }
      return [...record.addedNodes].some(nodeMayRevealPageType);
    });
  }

  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (stopTimer) {
      window.clearTimeout(stopTimer);
      stopTimer = 0;
    }
  }

  function redirectIfSpecial(targetHint) {
    if (
      redirected
      || isSkippablePage()
      || !document.documentElement
      || !isSpecialTopPage(document)
    ) {
      return false;
    }

    const target = targetHint || findBlancUrl(document);
    if (!target || target === location.href) {
      return false;
    }

    redirected = true;
    document.documentElement.dataset.bliveSpecialBlancRedirectVersion = VERSION;
    cleanup();
    location.replace(target);
    return true;
  }

  function start() {
    if (isSkippablePage()) {
      return;
    }
    if (!document.documentElement) {
      window.setTimeout(start, 10);
      return;
    }

    if (redirectIfSpecial()) {
      return;
    }
    observer = new MutationObserver((records) => {
      const target = findBlancUrlInMutations(records);
      if (target || mutationsMayRevealPageType(records)) {
        redirectIfSpecial(target);
      }
      if (
        document.readyState === 'complete'
        && document.querySelector('.player-and-aside-area')
        && !isSpecialTopPage(document)
      ) {
        cleanup();
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
    stopTimer = window.setTimeout(cleanup, MAX_WATCH_MS);
    window.addEventListener('load', () => {
      if (!redirectIfSpecial() && document.querySelector('.player-and-aside-area')) {
        cleanup();
      }
    }, { once: true });
    window.addEventListener('pagehide', cleanup, { once: true });
  }

  start();
})();
