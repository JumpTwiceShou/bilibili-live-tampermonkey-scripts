// ==UserScript==
// @name         Bilibili Live Special Layout
// @name:zh-CN   B站特殊聚合页普通直播间布局（保留列表）
// @namespace    https://live.bilibili.com/
// @version      2.2.2
// @description  Special-page only: keep-list/no-list layout normalization + native-like sidebar.
// @description:zh-CN 将 B 站特殊聚合直播页重排为接近普通直播间的宽屏布局，保留聚合列表并补齐关注侧栏和回到播放器按钮。
// @match        https://live.bilibili.com/*
// @run-at       document-idle
// @grant        none
// @noframes
// @license      GPL-3.0-only
// @supportURL   https://github.com/JumpTwiceShou/bilibili-live-tampermonkey-scripts/issues
// ==/UserScript==

(function () {
  'use strict';

  /* @include ../shared/lifecycle.js */

  if (window.top !== window) {
    return;
  }

  const INSTALL_FLAG = '__bliveSpecialLayoutInstalled';
  if (window[INSTALL_FLAG]) {
    return;
  }
  Object.defineProperty(window, INSTALL_FLAG, {
    value: true,
    configurable: false
  });

  const MODE_KEY = 'blive:special-layout-mode';
  const VERSION = '2.2.2';
  const VALID_MODES = new Set(['keep-list', 'no-list']);
  const DEFAULT_MODE = 'keep-list';
  const FORCE_MODE = null;

  const LIVE_FOLLOW_URL = 'https://api.live.bilibili.com/xlive/web-ucenter/v1/xfetter/GetWebList?hit_ab=true';
  const LAB_URL = 'https://api.live.bilibili.com/xlive/web-ucenter/v1/labs/InfoPlugs';
  const MORE_FOLLOW_URL = 'https://link.bilibili.com/p/center/index#/user-center/follow/1';
  const STYLE_ID = 'blive-special-layout-style';
  const HOST_CLASS = 'blive-special-layout-host';
  const ROOT_CLASS = 'blive-special-layout-root';
  const DATA_KEY = 'bliveSpecialShellExtra';
  const BASE_WIDTH_KEY = 'bliveSpecialBaseWidth';
  const BASE_RATIO_KEY = 'bliveSpecialBaseRatio';
  const VIEWPORT_EDGE_GUTTER = 32;
  const FOLLOW_CACHE_MS = 60000;
  const MAX_FOLLOW_ITEMS = 100;
  const MAX_INIT_WATCH_MS = 30000;
  const MAX_COLLAPSE_WATCH_MS = 15000;
  const NORMAL_ROOM_MIN_BODY_WIDTH = 980;
  const NORMAL_ROOM_MAX_BODY_WIDTH = 3420;
  const NORMAL_ROOM_VIEWPORT_GUTTER = 100;
  const NORMAL_ROOM_VERTICAL_RESERVED = 136 + 78 + 64;
  const NORMAL_ROOM_EXTRA_GUTTER = 12 + 100;
  const SPECIAL_PLAYER_SIZE_RATIO = 1.4;
  const LEGACY_STYLE_IDS = ['blf-special-style', 'tm-bili-special-layout-large-player-style'];
  const LEGACY_CLASSES = ['blf-special-page', 'tm-bili-special-layout-normal-room-like', 'tm-bili-special-layout-player-host', 'tm-bili-special-layout-player-root'];
  const WEB_MODE_FALLBACK_POLL_MS = 1200;
  let resizeObserver = null;
  let rafId = 0;
  let webModePollTimer = 0;
  let trackedBlancFrame = null;
  let trackedBlancFrameLoadHandler = null;
  let trackedBlancFrameDoc = null;
  let specialWebFullscreenActive = false;
  let runtimeScope = null;
  let sidebarCleanup = null;
  let collapseCleanup = null;
  let initializationCleanup = null;
  let trackedPlayerRoot = null;
  let pageLifecycleBound = false;

  function readStoredMode() {
    try {
      return window.localStorage.getItem(MODE_KEY) || DEFAULT_MODE;
    } catch (_err) {
      return DEFAULT_MODE;
    }
  }

  function writeStoredMode(mode) {
    try {
      window.localStorage.setItem(MODE_KEY, mode);
      return true;
    } catch (_err) {
      return false;
    }
  }

  const urlMode = new URLSearchParams(window.location.search).get('blf_mode');
  const storedMode = readStoredMode().toLowerCase();
  const dynamicMode = VALID_MODES.has((urlMode || '').toLowerCase())
    ? urlMode.toLowerCase()
    : (VALID_MODES.has(storedMode) ? storedMode : DEFAULT_MODE);
  const specialMode = VALID_MODES.has((FORCE_MODE || '').toLowerCase())
    ? FORCE_MODE.toLowerCase()
    : dynamicMode;

  window.bliveSpecialSetMode = (mode) => {
    if (specialMode !== dynamicMode) {
      return false;
    }
    const next = (mode || '').toLowerCase();
    if (!VALID_MODES.has(next)) {
      return false;
    }
    return writeStoredMode(next);
  };

  /* @include ../shared/special-page.js */

  /* @include sizing.js */

  /* @include fullscreen.js */

  function ensureStyle(doc) {
    if (!doc || !doc.head || doc.getElementById(STYLE_ID)) {
      return;
    }
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `/* @include styles.css */`;
    doc.head.appendChild(style);
  }

  function withRafScheduler(win, fn) {
    let frame = 0;
    function schedule() {
      if (frame) return;
      frame = win.requestAnimationFrame(() => {
        frame = 0;
        fn();
      });
    }
    schedule.cancel = () => { win.cancelAnimationFrame(frame); frame = 0; };
    return schedule;
  }

  /* @include sidebar.js */

  /* @include controller.js */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchAndInit, { once: true });
  } else {
    watchAndInit();
  }
})();
