// ==UserScript==
// @name         Bilibili Live Gift Panel Overlay
// @name:zh-CN   B站直播礼物面板布局重构
// @namespace    https://live.bilibili.com/
// @version      1.3.1
// @description  Overlay the gift panel with a fixed two-row height and live Chinese, pinyin and initials search.
// @description:zh-CN 重构 B 站直播礼物大面板布局，固定在播放器右下角并保持两行高度，支持中文、拼音全拼和首字母实时筛选。
// @match        https://live.bilibili.com/*
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/npm/pinyin-pro@3.29.5/dist/index.js
// @grant        none
// @license      GPL-3.0-only
// @supportURL   https://github.com/JumpTwiceShou/bilibili-live-tampermonkey-scripts/issues
// ==/UserScript==

(function () {
  'use strict';

  const VERSION = '1.3.1';
  const STYLE_ID = 'tm-bilibili-live-gift-panel-overlay';
  const OPEN_HOST_SELECTOR =
    'body:not(.pure_room_root) .fullscreen-container-paddingbox > .tool-open, ' +
    'body:not(.pure_room_root) .fullscreen-container-paddingbox > .has-first-frame-bg.tool-open';
  const PANEL_SELECTOR = '.container-tool-paddingbox';
  const IGNORE_OUTSIDE_SELECTOR =
    '.container-tool-paddingbox, .gift-control-section, .z-gift-sender-panel, .gift-sender-panel';
  const CLOSE_BUTTON_SELECTORS = [
    'button[aria-label*="关闭"]',
    '[role="button"][aria-label*="关闭"]',
    'button[title*="关闭"]',
    '[role="button"][title*="关闭"]',
    'button[class*="close" i]',
    '[role="button"][class*="close" i]',
  ];

  document.documentElement.dataset.bliveGiftPanelOverlayVersion = VERSION;

  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `/* @include styles.css */`;

  (document.head || document.documentElement).appendChild(style);

  /* @include ../shared/lifecycle.js */
  /* @include native-gifts.js */
  /* @include search-index.js */
  /* @include search-ui.js */
  /* @include controller.js */

  function getOpenGiftHost() {
    return document.querySelector(OPEN_HOST_SELECTOR);
  }

  function isInsideIgnoredArea(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];

    if (path.length) {
      return path.some((node) => node instanceof Element && node.closest(IGNORE_OUTSIDE_SELECTOR));
    }

    return event.target instanceof Element && Boolean(event.target.closest(IGNORE_OUTSIDE_SELECTOR));
  }

  function clickNativeClose(panel) {
    for (const selector of CLOSE_BUTTON_SELECTORS) {
      const closeButton = panel.querySelector(selector);
      if (closeButton instanceof HTMLElement) {
        closeButton.click();
        return true;
      }
    }

    return false;
  }

  function closeGiftPanel(host) {
    const panel = host.querySelector(PANEL_SELECTOR);

    if (panel && clickNativeClose(panel)) {
      return;
    }

    // Let Bilibili's own bubbling outside-click handler update component state first.
    // The class removal is only a compatibility fallback for layouts without one.
    window.setTimeout(() => {
      if (host.isConnected && host.classList.contains('tool-open')) {
        host.classList.remove('tool-open');
      }
    }, 0);
  }

  startGiftRuntime();
})();
