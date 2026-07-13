// ==UserScript==
// @name         Bilibili Live Special Blanc Redirect
// @name:zh-CN   B站特殊聚合直播跳转普通播放器
// @namespace    https://live.bilibili.com/
// @version      1.0.1
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

  const VERSION = '1.0.1';
  const SKIP_PARAM = 'blive_no_blanc_redirect';
  const ROOM_PATH_RE = /^\/\d+\/?$/;
  const BLANC_PATH_RE = /^\/blanc\/(\d+)\/?$/;
  const MAX_WATCH_MS = 30000;
  let redirected = false;
  let observer = null;
  let stopTimer = 0;

  function isSkippablePage() {
    if (location.pathname.startsWith('/blanc/')) {
      return true;
    }
    if (!ROOM_PATH_RE.test(location.pathname)) {
      return true;
    }
    return new URLSearchParams(location.search).has(SKIP_PARAM);
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
    if (redirected || isSkippablePage() || !document.documentElement) {
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
      if (target) {
        redirectIfSpecial(target);
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
    stopTimer = window.setTimeout(cleanup, MAX_WATCH_MS);
    window.addEventListener('load', () => redirectIfSpecial(), { once: true });
    window.addEventListener('pagehide', cleanup, { once: true });
  }

  start();
})();
