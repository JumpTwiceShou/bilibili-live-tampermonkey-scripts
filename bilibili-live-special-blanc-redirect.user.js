// ==UserScript==
// @name         Bilibili Live Special Blanc Redirect
// @name:zh-CN   B站特殊聚合直播跳转普通播放器
// @namespace    https://live.bilibili.com/
// @version      1.0.0
// @description  Redirect special live pages to their embedded /blanc/ player page.
// @description:zh-CN 识别特殊聚合直播页内嵌的 /blanc/ 播放器并跳转到普通播放器页面。
// @match        https://live.bilibili.com/*
// @exclude      https://live.bilibili.com/blanc/*
// @exclude      https://live.bilibili.com/p/*
// @run-at       document-start
// @grant        none
// @noframes
// @license      GPL-3.0-only
// @supportURL   https://github.com/shoukounan0227/bilibili-live-tampermonkey-scripts/issues
// ==/UserScript==

(function () {
  'use strict';

  if (window.top !== window) {
    return;
  }

  const VERSION = '1.0.0';
  const SKIP_PARAM = 'blive_no_blanc_redirect';
  const ROOM_PATH_RE = /^\/\d+\/?$/;
  const BLANC_PATH_RE = /^\/blanc\/(\d+)\/?$/;
  let redirected = false;
  let observer = null;
  let retryTimer = 0;

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

  function redirectIfSpecial() {
    if (redirected || isSkippablePage() || !document.documentElement) {
      return false;
    }

    const target = findBlancUrl(document);
    if (!target || target === location.href) {
      return false;
    }

    redirected = true;
    document.documentElement.dataset.bliveSpecialBlancRedirectVersion = VERSION;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (retryTimer) {
      window.clearInterval(retryTimer);
      retryTimer = 0;
    }
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

    redirectIfSpecial();
    observer = new MutationObserver(() => redirectIfSpecial());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
    retryTimer = window.setInterval(() => {
      if (redirectIfSpecial()) {
        return;
      }
      if (document.readyState === 'complete') {
        window.clearInterval(retryTimer);
        retryTimer = 0;
      }
    }, 500);
  }

  start();
})();
