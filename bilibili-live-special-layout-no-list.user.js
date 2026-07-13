// ==UserScript==
// @name         Bilibili Live Special Layout (No List)
// @name:zh-CN   B站特殊聚合页普通直播间布局（隐藏列表）
// @namespace    https://live.bilibili.com/
// @version      2.2.1-no-list
// @description  Special-page only, fixed no-list mode + native-like sidebar.
// @description:zh-CN 将 B 站特殊聚合直播页重排为接近普通直播间的宽屏布局，隐藏聚合列表并补齐关注侧栏和回到播放器按钮。
// @match        https://live.bilibili.com/*
// @run-at       document-idle
// @grant        none
// @noframes
// @license      GPL-3.0-only
// @supportURL   https://github.com/JumpTwiceShou/bilibili-live-tampermonkey-scripts/issues
// ==/UserScript==
// Generated from bilibili-live-special-layout.user.js; do not edit directly.

(function () {
  'use strict';

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
  const VERSION = '2.2.1-no-list';
  const VALID_MODES = new Set(['keep-list', 'no-list']);
  const DEFAULT_MODE = 'keep-list';
  const FORCE_MODE = 'no-list';

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

  function clearLegacyConflicts(doc) {
    LEGACY_STYLE_IDS.forEach((id) => {
      const node = doc.getElementById(id);
      if (node) {
        node.remove();
      }
    });
    LEGACY_CLASSES.forEach((cls) => {
      doc.documentElement.classList.remove(cls);
      if (doc.body) {
        doc.body.classList.remove(cls);
      }
    });
    const targets = [
      doc.querySelector('.live-non-revenue-player'),
      doc.querySelector('.live-player-handle-bar'),
      doc.querySelector('.live-player-bg'),
      doc.querySelector('.player'),
      doc.querySelector('#player-ctnr'),
      doc.querySelector('.layerWrapperRoot'),
      doc.querySelector('iframe[src*="/blanc/"]')
    ].filter(Boolean);
    targets.forEach((el) => {
      el.style.removeProperty('width');
      el.style.removeProperty('height');
      el.style.removeProperty('max-width');
      el.style.removeProperty('margin-left');
      el.style.removeProperty('margin-right');
      el.style.removeProperty('transform');
      el.style.removeProperty('overflow');
      el.style.removeProperty('overflow-x');
      el.style.removeProperty('overflow-y');
    });
  }

  function getShellExtraWidth(playerRoot) {
    if (!playerRoot || !playerRoot.parentElement) {
      return 0;
    }
    const cachedValue = playerRoot.dataset[DATA_KEY];
    if (cachedValue !== undefined) {
      return Math.max(0, Number(cachedValue) || 0);
    }
    const shellExtraWidth = Math.max(0, playerRoot.parentElement.offsetWidth - playerRoot.offsetWidth);
    playerRoot.dataset[DATA_KEY] = String(shellExtraWidth);
    return shellExtraWidth;
  }

  function clearLayoutInlineSizes(playerRoot) {
    if (!playerRoot) {
      return;
    }
    const host = playerRoot.parentElement;
    const nodes = [
      host,
      playerRoot,
      playerRoot.querySelector('.live-player-handle-bar'),
      playerRoot.querySelector('.live-player-bg'),
      playerRoot.querySelector('.player'),
      playerRoot.querySelector('.player > div'),
      playerRoot.querySelector('.player iframe')
    ].filter(Boolean);
    nodes.forEach((el) => {
      el.style.removeProperty('width');
      el.style.removeProperty('height');
      el.style.removeProperty('max-width');
      el.style.removeProperty('margin-left');
      el.style.removeProperty('margin-right');
      el.style.removeProperty('align-self');
      el.style.removeProperty('overflow');
      el.style.removeProperty('transform');
      el.style.removeProperty('transform-origin');
    });
  }

  function getNormalRoomAsideGap(viewportWidth) {
    if (viewportWidth >= 2560) {
      return 432;
    }
    if (viewportWidth >= 1440) {
      return 392;
    }
    return 332;
  }

  function getNormalRoomPlayerWidth(win) {
    const viewportWidth = win.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = win.innerHeight || document.documentElement.clientHeight || 0;
    const asideGap = getNormalRoomAsideGap(viewportWidth);
    const asideWidth = viewportWidth >= 2560 ? 420 : (viewportWidth >= 1440 ? 380 : 320);
    const heightBoundBodyWidth =
      ((viewportHeight - NORMAL_ROOM_VERTICAL_RESERVED) * 16 / 9) +
      asideWidth +
      NORMAL_ROOM_EXTRA_GUTTER;
    const widthBoundBodyWidth = viewportWidth - NORMAL_ROOM_VIEWPORT_GUTTER;
    const bodyWidth = Math.min(
      NORMAL_ROOM_MAX_BODY_WIDTH,
      Math.max(
        NORMAL_ROOM_MIN_BODY_WIDTH,
        Math.min(heightBoundBodyWidth, widthBoundBodyWidth)
      )
    );
    const availableWidth = Math.max(1, viewportWidth - VIEWPORT_EDGE_GUTTER);
    return Math.min(
      availableWidth,
      Math.max(320, Math.round((bodyWidth - asideGap) * SPECIAL_PLAYER_SIZE_RATIO))
    );
  }

  function getBaseVideoMetrics(playerRoot, videoArea) {
    let width = Number(playerRoot.dataset[BASE_WIDTH_KEY] || 0);
    let ratio = Number(playerRoot.dataset[BASE_RATIO_KEY] || 0);
    if (!(width > 0) || !(ratio > 0)) {
      width = videoArea.offsetWidth;
      const height = videoArea.offsetHeight;
      if (!(width > 0) || !(height > 0)) {
        return null;
      }
      ratio = height / width;
      playerRoot.dataset[BASE_WIDTH_KEY] = String(width);
      playerRoot.dataset[BASE_RATIO_KEY] = String(ratio);
    }
    return { width, ratio };
  }

  function calculateTargetPlayerSize(viewportWidth, shellExtraWidth, baseMetrics, desiredWidth) {
    const safeViewportWidth = Math.max(0, Number(viewportWidth) || 0);
    const safeShellExtraWidth = Math.max(0, Number(shellExtraWidth) || 0);
    const availableWidth = Math.max(
      1,
      safeViewportWidth - VIEWPORT_EDGE_GUTTER - safeShellExtraWidth
    );
    const baseWidth = Math.max(1, Number(baseMetrics.width) || 1);
    const ratio = Math.max(0.01, Number(baseMetrics.ratio) || 9 / 16);
    const preferredWidth = Math.max(1, Number(desiredWidth) || 1);
    const width = Math.round(Math.min(
      availableWidth,
      Math.max(Math.min(baseWidth, availableWidth), preferredWidth)
    ));
    return {
      availableWidth,
      width,
      height: Math.round(width * ratio),
      shellWidth: Math.round(width + safeShellExtraWidth)
    };
  }

  function getBlancFrame(doc) {
    return doc.querySelector('iframe[src*="/blanc/"]');
  }

  function getBlancFrameWindow(doc) {
    const frame = getBlancFrame(doc);
    if (!frame) {
      return null;
    }
    try {
      return frame.contentWindow || null;
    } catch (_err) {
      return null;
    }
  }

  function getBlancFrameDocument(doc) {
    const frameWindow = getBlancFrameWindow(doc);
    if (!frameWindow) {
      return null;
    }
    try {
      return frameWindow.document || null;
    } catch (_err) {
      return null;
    }
  }

  function getEmbeddedCtrlUi(doc) {
    const frameWindow = getBlancFrameWindow(doc);
    if (!frameWindow) {
      return null;
    }
    const playerInstance =
      (frameWindow.EmbedPlayer && frameWindow.EmbedPlayer.instance) ||
      frameWindow.__PLAYER_GLOBAL_INSTANCE__ ||
      null;
    if (!playerInstance || !playerInstance.ctrl || typeof playerInstance.ctrl.getCtrlUI !== 'function') {
      return null;
    }
    try {
      return playerInstance.ctrl.getCtrlUI() || null;
    } catch (_err) {
      return null;
    }
  }

  function hasWebFullscreenToken(value) {
    return /(web[\s_-]*full|full[\s_-]*web)/i.test(value || '');
  }

  function isEmbeddedWebFullscreenActive(doc) {
    const ctrlUi = getEmbeddedCtrlUi(doc);
    if (ctrlUi && ctrlUi.webFullScreenStatus === true) {
      return true;
    }

    const frameDoc = getBlancFrameDocument(doc);
    if (!frameDoc) {
      return false;
    }

    const classNames = [
      frameDoc.documentElement ? frameDoc.documentElement.className : '',
      frameDoc.body ? frameDoc.body.className : ''
    ].filter(Boolean).join(' ');
    if (hasWebFullscreenToken(classNames)) {
      return true;
    }

    const frameWindow = frameDoc.defaultView;
    const viewportWidth = frameWindow ? frameWindow.innerWidth : 0;
    const viewportHeight = frameWindow ? frameWindow.innerHeight : 0;
    const candidates = [
      frameDoc.querySelector('#fullscreen-container'),
      frameDoc.querySelector('.player-section'),
      frameDoc.querySelector('#live-player')
    ].filter(Boolean);

    return candidates.some((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (style.position === 'fixed' && rect.width >= viewportWidth * 0.7 && rect.height >= viewportHeight * 0.6) {
        return true;
      }
      return el.id === 'fullscreen-container'
        && rect.left <= 2
        && rect.top <= 2
        && rect.width >= viewportWidth * 0.95
        && rect.height >= viewportHeight * 0.75;
    });
  }

  function setSidebarHidden(doc, hidden) {
    const sidebarHost = doc.getElementById('blf-special-sidebar-host');
    if (!sidebarHost) {
      return;
    }
    if (hidden) {
      sidebarHost.style.setProperty('display', 'none', 'important');
      return;
    }
    sidebarHost.style.removeProperty('display');
  }

  function syncEmbeddedWebFullscreenState(doc, playerRoot) {
    const active = isEmbeddedWebFullscreenActive(doc);
    specialWebFullscreenActive = active;

    const style = doc.getElementById(STYLE_ID);
    if (style) {
      style.disabled = active;
    }

    doc.documentElement.classList.toggle('blive-special-webfs', active);
    setSidebarHidden(doc, active);

    if (active) {
      clearLayoutInlineSizes(playerRoot || doc.querySelector('.live-non-revenue-player'));
    }

    return active;
  }

  function cleanupTrackedFrameWatchers() {
    if (trackedBlancFrameDoc) {
      trackedBlancFrameDoc.removeEventListener('click', handleTrackedFrameInteraction, true);
      trackedBlancFrameDoc.removeEventListener('dblclick', handleTrackedFrameInteraction, true);
      trackedBlancFrameDoc = null;
    }
  }

  function cleanupRuntimeWatchers() {
    if (webModePollTimer) {
      window.clearInterval(webModePollTimer);
      webModePollTimer = 0;
    }
    if (trackedBlancFrame && trackedBlancFrameLoadHandler) {
      trackedBlancFrame.removeEventListener('load', trackedBlancFrameLoadHandler);
    }
    trackedBlancFrame = null;
    trackedBlancFrameLoadHandler = null;
    cleanupTrackedFrameWatchers();
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function handleTrackedFrameInteraction() {
    scheduleApplyLayout(document);
  }

  function bindTrackedFrameWatchers(doc) {
    const frameDoc = getBlancFrameDocument(doc);
    if (!frameDoc || frameDoc === trackedBlancFrameDoc) {
      return;
    }

    cleanupTrackedFrameWatchers();
    trackedBlancFrameDoc = frameDoc;
    trackedBlancFrameDoc.addEventListener('click', handleTrackedFrameInteraction, true);
    trackedBlancFrameDoc.addEventListener('dblclick', handleTrackedFrameInteraction, true);
  }

  function ensureStyle(doc) {
    if (!doc || !doc.head || doc.getElementById(STYLE_ID)) {
      return;
    }
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
html.blive-special-layout {
  --blive-special-player-width: clamp(1px, calc((100vw - 100px) * 0.85), 2540px);
  --blive-special-player-height: calc(var(--blive-special-player-width) * 0.5864361702);
  --blive-special-list-width: var(--blive-special-player-width);
}
html.blive-special-layout .live-non-revenue-player {
  width: var(--blive-special-player-width) !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
html.blive-special-layout .layerWrapperRoot:has(> .live-non-revenue-player) {
  width: var(--blive-special-player-width) !important;
  max-width: var(--blive-special-player-width) !important;
  overflow: visible !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
html.blive-special-layout .${HOST_CLASS} {
  display: flex !important;
  justify-content: center !important;
  align-items: flex-start !important;
  overflow: visible !important;
  max-width: none !important;
  margin-left: auto !important;
  margin-right: auto !important;
  align-self: center !important;
}
html.blive-special-layout .${ROOT_CLASS} {
  overflow: visible !important;
}
html.blive-special-layout .live-player-handle-bar {
  width: var(--blive-special-list-width) !important;
  max-width: var(--blive-special-list-width) !important;
  margin-left: auto !important;
  margin-right: auto !important;
  margin-bottom: 0 !important;
}
html.blive-special-layout .live-player-handle-bar .expand-btn {
  align-self: flex-start !important;
  margin-top: 0 !important;
}
html.blive-special-layout.blive-special-fs .live-player-handle-bar,
html.blive-special-layout:has(iframe:fullscreen) .live-player-handle-bar,
html.blive-special-layout:has(iframe:-webkit-full-screen) .live-player-handle-bar,
html.blive-special-layout.blive-special-fs #blf-special-sidebar-host,
html.blive-special-layout:has(iframe:fullscreen) #blf-special-sidebar-host,
html.blive-special-layout:has(iframe:-webkit-full-screen) #blf-special-sidebar-host {
  display: none !important;
}
html.blive-special-layout.blive-special-fs .live-non-revenue-player,
html.blive-special-layout:has(iframe:fullscreen) .live-non-revenue-player,
html.blive-special-layout:has(iframe:-webkit-full-screen) .live-non-revenue-player,
html.blive-special-layout.blive-special-fs .layerWrapperRoot:has(> .live-non-revenue-player),
html.blive-special-layout:has(iframe:fullscreen) .layerWrapperRoot:has(> .live-non-revenue-player),
html.blive-special-layout:has(iframe:-webkit-full-screen) .layerWrapperRoot:has(> .live-non-revenue-player),
html.blive-special-layout.blive-special-fs .live-player-bg,
html.blive-special-layout:has(iframe:fullscreen) .live-player-bg,
html.blive-special-layout:has(iframe:-webkit-full-screen) .live-player-bg,
html.blive-special-layout.blive-special-fs .player,
html.blive-special-layout:has(iframe:fullscreen) .player,
html.blive-special-layout:has(iframe:-webkit-full-screen) .player,
html.blive-special-layout.blive-special-fs iframe[src*="/blanc/"] {
  width: 100vw !important;
  max-width: 100vw !important;
  height: 100vh !important;
  margin: 0 !important;
}
html.blive-special-layout:has(iframe:fullscreen) iframe[src*="/blanc/"],
html.blive-special-layout:has(iframe:-webkit-full-screen) iframe[src*="/blanc/"] {
  width: 100vw !important;
  max-width: 100vw !important;
  height: 100vh !important;
  margin: 0 !important;
}
html.blive-special-layout.blf-no-list .live-player-handle-bar {
  display: none !important;
  height: 0 !important;
  overflow: hidden !important;
}
html.blive-special-layout #blf-special-sidebar-host {
  position: fixed !important;
  right: 0 !important;
  bottom: 20% !important;
  z-index: 2147483000 !important;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif !important;
}
html.blive-special-layout #blf-special-sidebar-host #sidebar-vm {
  position: relative !important;
}
html.blive-special-layout #blf-special-sidebar-host .side-bar-cntr {
  position: fixed !important;
  right: 0 !important;
  bottom: 20% !important;
  width: 44px !important;
  min-height: 0 !important;
  height: auto !important;
  background: #fff !important;
  border-radius: 12px 0 0 12px !important;
  box-shadow: 0 0 20px 0 rgba(0, 85, 255, 0.1) !important;
  padding: 12px 4px !important;
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 2px !important;
}
html.blive-special-layout #blf-special-sidebar-host .side-bar-btn {
  width: 34px !important;
  height: 56px !important;
  padding: 5px 4px !important;
  margin: 0 !important;
  box-sizing: border-box !important;
  cursor: pointer !important;
  border: 0 !important;
  border-radius: 6px !important;
  background: transparent !important;
  color: #0080c6 !important;
  font: inherit !important;
  appearance: none !important;
}
html.blive-special-layout #blf-special-sidebar-host .side-bar-btn[hidden] {
  display: none !important;
}
html.blive-special-layout #blf-special-sidebar-host .side-bar-btn:hover {
  background: #f1f9ff !important;
  color: #00aeec !important;
}
html.blive-special-layout #blf-special-sidebar-host .side-bar-btn:focus-visible {
  outline: 2px solid #00aeec !important;
  outline-offset: 1px !important;
}
html.blive-special-layout #blf-special-sidebar-host .side-bar-btn-cntr {
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
}
html.blive-special-layout #blf-special-sidebar-host .side-bar-icon {
  width: 26px !important;
  height: 26px !important;
  display: block !important;
  color: currentColor !important;
  font-size: 25px !important;
  font-style: normal !important;
  font-weight: 400 !important;
  line-height: 26px !important;
  text-align: center !important;
}
html.blive-special-layout #blf-special-sidebar-host .size-bar-text {
  margin: 2px 0 0 !important;
  color: currentColor !important;
  font-size: 12px !important;
  line-height: 16px !important;
  white-space: nowrap !important;
}
html.blive-special-layout #blf-special-sidebar-host .side-bar-btn.no-text {
  height: 46px !important;
  padding: 10px 0 !important;
}
html.blive-special-layout .live-player-bg,
html.blive-special-layout .player,
html.blive-special-layout #player-ctnr,
html.blive-special-layout iframe[src*="/blanc/"] {
  width: var(--blive-special-player-width) !important;
  max-width: var(--blive-special-player-width) !important;
  height: var(--blive-special-player-height) !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
html.blive-special-layout iframe[src*="/blanc/"] {
  display: block !important;
}
html.blive-special-layout #blf-special-sidebar-host .side-bar-popup-cntr {
  position: fixed !important;
  right: 64px !important;
  bottom: calc(23% - 149px) !important;
  width: 276px !important;
  height: 394px !important;
  border-radius: 12px !important;
  box-shadow: 0 6px 12px 0 rgba(106, 115, 133, 0.22) !important;
  overflow: visible !important;
  display: none !important;
  z-index: 2147483001 !important;
  background: #fff !important;
}
html.blive-special-layout #blf-special-sidebar-host .side-bar-popup-cntr.is-open {
  display: block !important;
}
html.blive-special-layout #blf-special-sidebar-host .side-bar-popup-cntr .arrow {
  top: calc(55% + 0px) !important;
  position: absolute !important;
  right: -7px !important;
  width: 14px !important;
  height: 14px !important;
  background: #fff !important;
  transform: rotate(45deg) !important;
  box-shadow: 3px -3px 8px rgba(106, 115, 133, 0.08) !important;
}
html.blive-special-layout #blf-special-sidebar-host .content-wrapper {
  width: 276px !important;
  height: 394px !important;
  position: relative !important;
}
html.blive-special-layout #blf-special-sidebar-host .follow-cntr {
  width: 274px !important;
  overflow: hidden !important;
  border-radius: 12px !important;
  box-shadow: 0 0 30px 0 rgba(0, 0, 0, 0.102) !important;
  background: linear-gradient(0deg, #fff, #fff), linear-gradient(0deg, #e3e5e7, #e3e5e7) !important;
}
html.blive-special-layout #blf-special-sidebar-host .my-follow {
  border-radius: 12px !important;
  width: 100% !important;
  height: 55px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 15px 20px !important;
  box-sizing: border-box !important;
}
html.blive-special-layout #blf-special-sidebar-host .follow-text {
  font-family: "PingFang SC" !important;
  font-size: 18px !important;
  font-weight: 400 !important;
  color: #00aeec !important;
}
html.blive-special-layout #blf-special-sidebar-host .more-follows {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-decoration: none !important;
  cursor: pointer !important;
}
html.blive-special-layout #blf-special-sidebar-host .more-follows span {
  font-family: "PingFang SC" !important;
  font-size: 13px !important;
  font-weight: 400 !important;
  color: #9499a0 !important;
}
html.blive-special-layout #blf-special-sidebar-host .blue-right-arrow {
  margin-left: 4px !important;
  width: auto !important;
  height: auto !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: #9499a0 !important;
  font-size: 18px !important;
  font-style: normal !important;
  line-height: 12px !important;
}
html.blive-special-layout #blf-special-sidebar-host .more-follows:hover span {
  color: #00aeec !important;
}
html.blive-special-layout #blf-special-sidebar-host .more-follows:hover .blue-right-arrow {
  color: #00aeec !important;
}
html.blive-special-layout #blf-special-sidebar-host .tm-follow-subtitle {
  display: none !important;
}
html.blive-special-layout #blf-special-sidebar-host .anchor-list {
  margin: 0 3px 3px 3px !important;
  box-sizing: border-box !important;
  width: 264px !important;
  height: 335.91px !important;
  display: flex !important;
  justify-content: center !important;
  position: relative !important;
  padding: 0 !important;
}
html.blive-special-layout #blf-special-sidebar-host .three-anchor {
  width: 264px !important;
  padding: 0 15px !important;
  height: 320px !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  display: flex !important;
  flex-wrap: wrap !important;
  position: relative !important;
  align-content: flex-start !important;
  box-sizing: border-box !important;
}
html.blive-special-layout #blf-special-sidebar-host .one-anchor {
  width: 72px !important;
  height: 101.97px !important;
  padding: 8px 8px 0 8px !important;
  text-decoration: none !important;
  box-sizing: border-box !important;
  display: inline-block !important;
}
html.blive-special-layout #blf-special-sidebar-host .avatar {
  width: 48.48px !important;
  height: 48.97px !important;
  display: flex !important;
  margin: 0 auto !important;
  justify-content: center !important;
  position: relative !important;
}
html.blive-special-layout #blf-special-sidebar-host .real-avatar {
  width: 42px !important;
  height: 42px !important;
  border-radius: 50px !important;
  border: 1.43px solid #f69 !important;
  padding: 3px !important;
  box-sizing: content-box !important;
  object-fit: cover !important;
  background: #fff !important;
}
html.blive-special-layout #blf-special-sidebar-host .pink-icon {
  width: 14px !important;
  height: 14px !important;
  background: #f69 !important;
  border-radius: 50px !important;
  box-sizing: border-box !important;
  padding: 3px 4px 4px 4px !important;
  position: absolute !important;
  right: 0 !important;
  bottom: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: #fff !important;
  font-size: 8px !important;
  line-height: 1 !important;
}
html.blive-special-layout #blf-special-sidebar-host .pink-icon::before {
  content: "♥" !important;
}
html.blive-special-layout #blf-special-sidebar-host .anchor-name {
  width: 62px !important;
  height: 28px !important;
  margin-top: 6px !important;
  text-align: center !important;
}
html.blive-special-layout #blf-special-sidebar-host .anchor-name p {
  margin: 0 !important;
  padding: 0 !important;
  font-family: "PingFang SC" !important;
  font-size: 12px !important;
  font-weight: 400 !important;
  color: #212121 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  display: -webkit-box !important;
  -webkit-box-orient: vertical !important;
  -webkit-line-clamp: 2 !important;
  word-break: break-all !important;
}
html.blive-special-layout #blf-special-sidebar-host .one-anchor:hover .anchor-name p {
  color: #00aeec !important;
}
html.blive-special-layout #blf-special-sidebar-host .blf-empty,
html.blive-special-layout #blf-special-sidebar-host .follow-empty-text {
  color: var(--text3, #9499a0) !important;
  font-size: 12px !important;
}
`;
    doc.head.appendChild(style);
  }

  function withRafScheduler(win, fn) {
    let pending = false;
    return function schedule() {
      if (pending) {
        return;
      }
      pending = true;
      win.requestAnimationFrame(() => {
        pending = false;
        fn();
      });
    };
  }

  function normalizeHttpUrl(value, baseUrl) {
    if (!value) {
      return '';
    }
    try {
      const url = new URL(String(value), baseUrl || location.href);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch (_err) {
      return '';
    }
  }

  function extractRooms(payload) {
    if (!payload || payload.code !== 0) {
      return [];
    }
    const out = [];
    const seenRooms = new Set();
    const visited = new Set();
    const walk = (node, depth) => {
      if (!node || depth > 8 || out.length >= MAX_FOLLOW_ITEMS) {
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((item) => walk(item, depth + 1));
        return;
      }
      if (typeof node !== 'object' || visited.has(node)) {
        return;
      }
      visited.add(node);
      const roomid = node.roomid || node.room_id || node.roomId || node.id || node.anchor_roomid;
      const rawFace = node.face || node.face_url || node.uface || node.upic || node.avatar || node.cover || node.user_cover || node.cover_from_user || '';
      const nickname = String(node.nickname || node.uname || node.name || node.anchor_name || '').trim();
      const rawHref = node.link || node.url || node.jump_url || node.room_link || (roomid ? `https://live.bilibili.com/${roomid}` : '');
      const face = normalizeHttpUrl(rawFace, 'https://live.bilibili.com/');
      const href = normalizeHttpUrl(rawHref, 'https://live.bilibili.com/');

      if (roomid && face && nickname && href) {
        const key = String(roomid);
        if (!seenRooms.has(key)) {
          seenRooms.add(key);
          out.push({ roomid, face, nickname, href });
        }
      }
      Object.values(node).forEach((value) => walk(value, depth + 1));
    };
    walk(payload.data || payload, 0);
    return out;
  }

  function findFirstUrl(node) {
    const visited = new Set();
    const preferredKeys = ['jump_url', 'jumpUrl', 'url', 'link'];
    const walk = (value, depth) => {
      if (!value || depth > 8) {
        return '';
      }
      if (typeof value === 'string') {
        return normalizeHttpUrl(value);
      }
      if (typeof value !== 'object' || visited.has(value)) {
        return '';
      }
      visited.add(value);
      for (const key of preferredKeys) {
        const preferred = normalizeHttpUrl(value[key]);
        if (preferred) {
          return preferred;
        }
      }
      for (const child of Object.values(value)) {
        const found = walk(child, depth + 1);
        if (found) {
          return found;
        }
      }
      return '';
    };
    return walk(node, 0);
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(url, {
        credentials: 'include',
        cache: 'no-cache',
        signal: controller.signal
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      return await resp.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function fetchSidebarPayload() {
    const [followResult, labsResult] = await Promise.allSettled([
      fetchJson(LIVE_FOLLOW_URL),
      fetchJson(LAB_URL)
    ]);
    const followPayload = followResult.status === 'fulfilled' ? followResult.value : null;
    const labsPayload = labsResult.status === 'fulfilled' ? labsResult.value : null;
    const cacheable = Boolean(followPayload && [0, -101].includes(followPayload.code));
    let emptyMessage = '暂无可展示内容';
    if (followResult.status === 'rejected' || (followPayload && ![0, -101].includes(followPayload.code))) {
      emptyMessage = '加载失败，请稍后重试';
    } else if (followPayload && followPayload.code === -101) {
      emptyMessage = '登录后可查看关注直播间';
    }
    return {
      title: '我的关注',
      items: extractRooms(followPayload),
      labUrl: findFirstUrl(labsPayload && (labsPayload.data || labsPayload)),
      emptyMessage,
      cacheable
    };
  }

  function renderFollowList(listRoot, items, emptyMessage) {
    listRoot.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'follow-empty-cntr';
      empty.setAttribute('data-v-80ec38f4', '');
      const text = document.createElement('div');
      text.className = 'follow-empty-text';
      text.setAttribute('data-v-80ec38f4', '');
      text.textContent = emptyMessage || '暂无可展示内容';
      empty.appendChild(text);
      listRoot.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach((item) => {
      const anchor = document.createElement('a');
      anchor.className = 'one-anchor';
      anchor.setAttribute('data-v-80ec38f4', '');
      anchor.href = item.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';

      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.setAttribute('data-v-80ec38f4', '');
      const img = document.createElement('img');
      img.className = 'real-avatar';
      img.setAttribute('data-v-80ec38f4', '');
      img.src = item.face;
      img.alt = item.nickname;
      img.loading = 'lazy';
      const pink = document.createElement('div');
      pink.className = 'pink-icon';
      pink.setAttribute('data-v-80ec38f4', '');
      avatar.appendChild(img);
      avatar.appendChild(pink);

      const name = document.createElement('div');
      name.className = 'anchor-name';
      name.setAttribute('data-v-80ec38f4', '');
      const p = document.createElement('p');
      p.setAttribute('data-v-80ec38f4', '');
      p.textContent = item.nickname;
      name.appendChild(p);

      anchor.appendChild(avatar);
      anchor.appendChild(name);
      frag.appendChild(anchor);
    });
    listRoot.appendChild(frag);
  }

  function createSidebarDom() {
    const host = document.createElement('div');
    host.id = 'blf-special-sidebar-host';
    host.innerHTML = `
<div data-v-12f789d4="" id="sidebar-vm" class="p-relative z-sidebar contain-optimize">
  <div data-v-12f789d4="" class="side-bar-cntr">
    <button type="button" data-v-12f789d4="" aria-label="打开直播实验室" data-upgrade-intro="Laboratory" class="side-bar-btn tm-sidebar-lab" hidden>
      <span data-v-7d702bb4="" data-v-12f789d4="" class="side-bar-btn-cntr">
        <span data-v-7d702bb4="" class="side-bar-icon" aria-hidden="true">⚗</span>
        <span data-v-7d702bb4="" class="size-bar-text">实验室</span>
      </span>
    </button>
    <button type="button" data-v-12f789d4="" aria-label="查看我的关注" aria-controls="blf-special-follow-popup" aria-expanded="false" data-upgrade-intro="Follow" class="side-bar-btn tm-sidebar-follow">
      <span data-v-7d702bb4="" data-v-12f789d4="" class="side-bar-btn-cntr">
        <span data-v-7d702bb4="" class="side-bar-icon" aria-hidden="true">♡</span>
        <span data-v-7d702bb4="" class="size-bar-text">关注</span>
      </span>
    </button>
    <button type="button" data-v-12f789d4="" aria-label="返回播放器" data-upgrade-intro="Top" class="side-bar-btn no-text tm-sidebar-top" hidden>
      <span data-v-7d702bb4="" data-v-12f789d4="" class="side-bar-btn-cntr">
        <span data-v-7d702bb4="" class="side-bar-icon" aria-hidden="true">↑</span>
      </span>
    </button>
  </div>
  <div id="blf-special-follow-popup" data-v-902b9200="" data-v-12f789d4="" class="side-bar-popup-cntr ts-dot-4" role="dialog" aria-label="我的关注" aria-hidden="true" aria-busy="false">
    <div data-v-902b9200="" class="arrow" style="top: calc(55% + 0px);"></div>
    <div data-v-902b9200="" class="content-wrapper">
      <div data-v-80ec38f4="" data-v-902b9200="" class="follow-cntr" popup-name="Follow">
        <div data-v-80ec38f4="" class="my-follow">
          <div data-v-80ec38f4="" class="follow-text">我的关注</div>
          <a data-v-80ec38f4="" class="more-follows" href="${MORE_FOLLOW_URL}" target="_blank" rel="noopener noreferrer">
            <span data-v-80ec38f4="">更多关注</span>
            <i data-v-80ec38f4="" class="blue-right-arrow" aria-hidden="true">›</i>
          </a>
        </div>
        <div class="tm-follow-subtitle" data-blf-role="subtitle"></div>
        <div data-v-80ec38f4="" class="anchor-list">
          <div data-v-80ec38f4="" class="three-anchor ps ps--theme_default ps--active-y" data-blf-role="list"></div>
        </div>
      </div>
    </div>
  </div>
</div>
`;
    return host;
  }

  function getPlayerTop(doc) {
    const candidates = [
      doc.querySelector('.live-player-bg'),
      doc.querySelector('#player-ctnr'),
      doc.querySelector('.player'),
      doc.querySelector('iframe[src*="/blanc/"]'),
      doc.querySelector('.live-non-revenue-player')
    ];
    for (const target of candidates) {
      if (!target) {
        continue;
      }
      const rect = target.getBoundingClientRect();
      if (rect.width < 300 || rect.height < 120) {
        continue;
      }
      return Math.max(0, Math.round(window.scrollY + rect.top));
    }
    return 0;
  }

  function setupSidebar(doc) {
    if (doc.getElementById('blf-special-sidebar-host')) {
      return;
    }
    const host = createSidebarDom();
    doc.body.appendChild(host);

    const followBtn = host.querySelector('.tm-sidebar-follow');
    const topBtn = host.querySelector('.tm-sidebar-top');
    const labBtn = host.querySelector('.tm-sidebar-lab');
    const popup = host.querySelector('.side-bar-popup-cntr');
    const listRoot = host.querySelector('[data-blf-role="list"]');
    const subtitle = host.querySelector('[data-blf-role="subtitle"]');
    const titleRoot = host.querySelector('.follow-text');
    let sidebarBoundFrame = null;
    let sidebarBoundFrameDoc = null;

    let popupOpen = false;
    let loading = false;
    let cacheItems = [];
    let cacheTitle = '我的关注';
    let cacheEmptyMessage = '暂无可展示内容';
    let cacheLoadedAt = 0;
    let labUrl = '';

    const scheduleTop = withRafScheduler(window, () => {
      const show = window.scrollY > getPlayerTop(doc) + 120;
      topBtn.hidden = !show;
    });

    function setPopup(open) {
      popupOpen = open;
      popup.classList.toggle('is-open', open);
      popup.setAttribute('aria-hidden', String(!open));
      followBtn.setAttribute('aria-expanded', String(open));
    }

    function closePopupFromEmbeddedArea() {
      if (popupOpen) {
        setPopup(false);
      }
    }

    function rebindEmbeddedDismissTarget() {
      const frame = getBlancFrame(doc);
      if (frame !== sidebarBoundFrame) {
        if (sidebarBoundFrame) {
          sidebarBoundFrame.removeEventListener('load', rebindEmbeddedDismissTarget);
        }
        sidebarBoundFrame = frame;
        sidebarBoundFrameDoc = null;
        if (sidebarBoundFrame) {
          sidebarBoundFrame.addEventListener('load', rebindEmbeddedDismissTarget);
        }
      }

      const frameDoc = getBlancFrameDocument(doc);
      if (!frameDoc || frameDoc === sidebarBoundFrameDoc) {
        return;
      }

      if (sidebarBoundFrameDoc) {
        sidebarBoundFrameDoc.removeEventListener('pointerdown', closePopupFromEmbeddedArea, true);
      }
      sidebarBoundFrameDoc = frameDoc;
      sidebarBoundFrameDoc.addEventListener('pointerdown', closePopupFromEmbeddedArea, true);
    }

    function mutationsTouchBlancFrame(records) {
      const nodeHasFrame = (node) => {
        if (!(node instanceof Element)) {
          return false;
        }
        if (node.matches('iframe') && (node.getAttribute('src') || '').includes('/blanc/')) {
          return true;
        }
        return Boolean(node.querySelector('iframe[src*="/blanc/"]'));
      };
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof HTMLIFrameElement) {
          return true;
        }
        for (const node of record.addedNodes) {
          if (nodeHasFrame(node)) {
            return true;
          }
        }
        for (const node of record.removedNodes) {
          if (nodeHasFrame(node)) {
            return true;
          }
        }
      }
      return false;
    }

    async function loadFollow() {
      if (loading) {
        return;
      }
      if (cacheLoadedAt && Date.now() - cacheLoadedAt < FOLLOW_CACHE_MS) {
        renderFollowList(listRoot, cacheItems, cacheEmptyMessage);
        return;
      }
      loading = true;
      popup.setAttribute('aria-busy', 'true');
      subtitle.textContent = '读取中…';
      renderFollowList(listRoot, [], '读取中…');
      try {
        const payload = await fetchSidebarPayload();
        cacheItems = payload.items;
        cacheTitle = payload.title;
        cacheEmptyMessage = payload.emptyMessage;
        cacheLoadedAt = payload.cacheable ? Date.now() : 0;
        labUrl = payload.labUrl || '';

        titleRoot.textContent = cacheTitle;
        subtitle.textContent = `${cacheItems.length} 个${cacheTitle === '我的关注' ? '直播间' : '推荐主播'}`;
        labBtn.hidden = !labUrl;
        renderFollowList(listRoot, cacheItems, cacheEmptyMessage);
      } finally {
        loading = false;
        popup.setAttribute('aria-busy', 'false');
      }
    }

    followBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const next = !popupOpen;
      setPopup(next);
      if (next) {
        loadFollow();
      }
    });

    topBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      window.scrollTo({
        top: getPlayerTop(doc),
        behavior: 'smooth'
      });
    });

    labBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      const target = normalizeHttpUrl(labUrl)
        || 'https://live.bilibili.com/p/html/live-labs/index.html';
      window.open(target, '_blank', 'noopener,noreferrer');
    });

    doc.addEventListener('click', (evt) => {
      if (popupOpen && !host.contains(evt.target)) {
        setPopup(false);
      }
    });

    doc.addEventListener('keydown', (evt) => {
      if (popupOpen && evt.key === 'Escape') {
        setPopup(false);
        followBtn.focus();
      }
    });

    new MutationObserver((records) => {
      if (mutationsTouchBlancFrame(records)) {
        rebindEmbeddedDismissTarget();
      }
    }).observe(doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });

    rebindEmbeddedDismissTarget();
    window.addEventListener('scroll', scheduleTop, { passive: true });
    scheduleTop();
  }

  function applyTopLayout(doc) {
    const playerRoot = doc.querySelector('.live-non-revenue-player');
    if (!isSpecialTopPage(doc) || !playerRoot || !playerRoot.parentElement) {
      return false;
    }

    if (syncEmbeddedWebFullscreenState(doc, playerRoot)) {
      return false;
    }

    const host = playerRoot.parentElement;
    const videoArea =
      playerRoot.querySelector('.live-player-bg') ||
      playerRoot.querySelector('.player iframe') ||
      playerRoot.querySelector('.player');
    const player = playerRoot.querySelector('.player');
    const playerInner = player ? player.firstElementChild : null;
    const iframe = player ? player.querySelector('iframe') : null;
    const handleBar = playerRoot.querySelector('.live-player-handle-bar');

    if (!videoArea) {
      return false;
    }

    const baseMetrics = getBaseVideoMetrics(playerRoot, videoArea);
    if (!baseMetrics) {
      return false;
    }

    const shellExtraWidth = getShellExtraWidth(playerRoot);
    const viewportWidth = window.innerWidth || doc.documentElement.clientWidth || 0;
    const targetSize = calculateTargetPlayerSize(
      viewportWidth,
      shellExtraWidth,
      baseMetrics,
      getNormalRoomPlayerWidth(window)
    );
    const targetWidth = targetSize.width;
    const targetHeight = targetSize.height;
    const targetShellWidth = targetSize.shellWidth;
    const handleBarWidth = targetWidth;
    const handleBarHeight = handleBar && getComputedStyle(handleBar).display !== 'none'
      ? Math.round(handleBar.getBoundingClientRect().height)
      : 0;

    host.classList.add(HOST_CLASS);
    playerRoot.classList.add(ROOT_CLASS);

    doc.documentElement.style.setProperty('--blive-special-player-width', `${targetWidth}px`);
    doc.documentElement.style.setProperty('--blive-special-player-height', `${targetHeight}px`);
    doc.documentElement.style.setProperty('--blive-special-list-width', `${handleBarWidth}px`);

    host.style.setProperty('width', `${targetShellWidth}px`, 'important');
    host.style.setProperty('max-width', 'none', 'important');
    host.style.setProperty('overflow', 'visible', 'important');
    host.style.setProperty('margin-left', 'auto', 'important');
    host.style.setProperty('margin-right', 'auto', 'important');
    host.style.setProperty('align-self', 'center', 'important');

    playerRoot.style.setProperty('width', `${targetWidth}px`, 'important');
    playerRoot.style.setProperty('max-width', 'none', 'important');
    playerRoot.style.setProperty('height', `${targetHeight + handleBarHeight}px`, 'important');
    playerRoot.style.setProperty('overflow', 'visible', 'important');
    playerRoot.style.setProperty('margin-left', 'auto', 'important');
    playerRoot.style.setProperty('margin-right', 'auto', 'important');

    if (handleBar) {
      handleBar.style.setProperty('width', `${handleBarWidth}px`, 'important');
      handleBar.style.setProperty('max-width', `${handleBarWidth}px`, 'important');
      handleBar.style.setProperty('margin-left', 'auto', 'important');
      handleBar.style.setProperty('margin-right', 'auto', 'important');
    }

    videoArea.style.setProperty('width', `${targetWidth}px`, 'important');
    videoArea.style.setProperty('height', `${targetHeight}px`, 'important');
    videoArea.style.setProperty('margin-left', 'auto', 'important');
    videoArea.style.setProperty('margin-right', 'auto', 'important');

    if (player) {
      player.style.setProperty('width', `${targetWidth}px`, 'important');
      player.style.setProperty('height', `${targetHeight}px`, 'important');
      player.style.setProperty('margin-left', 'auto', 'important');
      player.style.setProperty('margin-right', 'auto', 'important');
    }
    if (playerInner) {
      playerInner.style.setProperty('width', '100%', 'important');
      playerInner.style.setProperty('height', '100%', 'important');
    }
    if (iframe) {
      iframe.style.setProperty('width', `${targetWidth}px`, 'important');
      iframe.style.setProperty('height', `${targetHeight}px`, 'important');
      iframe.style.setProperty('margin-left', 'auto', 'important');
      iframe.style.setProperty('margin-right', 'auto', 'important');
    }
    return true;
  }

  function scheduleApplyLayout(doc) {
    if (rafId) {
      return;
    }
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      applyTopLayout(doc);
    });
  }

  function watchPlayerResize(doc) {
    const playerRoot = doc.querySelector('.live-non-revenue-player');
    if (!playerRoot) {
      return;
    }
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        scheduleApplyLayout(doc);
      });
    } else {
      resizeObserver.disconnect();
    }
    resizeObserver.observe(playerRoot);
  }

  function watchEmbeddedWebFullscreen(doc) {
    if (webModePollTimer) {
      return;
    }

    trackedBlancFrameLoadHandler = () => scheduleApplyLayout(doc);
    const bindTrackedFrame = () => {
      const frame = getBlancFrame(doc);
      if (!frame || frame === trackedBlancFrame) {
        bindTrackedFrameWatchers(doc);
        return;
      }
      if (trackedBlancFrame) {
        trackedBlancFrame.removeEventListener('load', trackedBlancFrameLoadHandler);
      }
      cleanupTrackedFrameWatchers();
      trackedBlancFrame = frame;
      trackedBlancFrame.addEventListener('load', trackedBlancFrameLoadHandler);
      bindTrackedFrameWatchers(doc);
    };

    bindTrackedFrame();
    webModePollTimer = window.setInterval(() => {
      bindTrackedFrame();
      if (isEmbeddedWebFullscreenActive(doc) !== specialWebFullscreenActive) {
        scheduleApplyLayout(doc);
      }
    }, WEB_MODE_FALLBACK_POLL_MS);
  }

  function ensureDefaultCollapsed(doc) {
    if (doc.documentElement.dataset.blfInitialCollapseDone === '1') {
      return true;
    }
    const bar = doc.querySelector('.live-player-handle-bar');
    const btn = bar ? bar.querySelector('.expand-btn') : null;
    if (!bar || !btn) {
      return false;
    }
    const expanded = btn.classList.contains('liveexpand');
    doc.documentElement.dataset.blfInitialCollapseDone = '1';
    if (!expanded) {
      return true;
    }
    btn.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
    return true;
  }

  function startInitialCollapseWatcher(doc) {
    let timer = 0;
    let deadlineTimer = 0;
    let settleTimer = 0;
    let stopped = false;
    const stop = () => {
      if (stopped) {
        return;
      }
      stopped = true;
      observer.disconnect();
      if (timer) {
        window.clearInterval(timer);
      }
      if (deadlineTimer) {
        window.clearTimeout(deadlineTimer);
      }
      if (settleTimer) {
        window.clearTimeout(settleTimer);
      }
    };
    const tryCollapse = () => {
      if (doc.documentElement.dataset.blfInitialCollapseDone === '1') {
        stop();
        return;
      }
      const btn = doc.querySelector('.live-player-handle-bar .expand-btn');
      if (!btn || settleTimer) {
        return;
      }
      settleTimer = window.setTimeout(() => {
        settleTimer = 0;
        if (ensureDefaultCollapsed(doc)) {
          stop();
        }
      }, 100);
    };
    const mutationTouchesHandleBar = (records) => records.some((record) => {
      const targetInHandleBar = record.target instanceof Element && (
        record.target.matches('.live-player-handle-bar, .expand-btn')
        || Boolean(record.target.closest('.live-player-handle-bar'))
      );
      if (targetInHandleBar) {
        return true;
      }
      return [...record.addedNodes, ...record.removedNodes].some((node) => (
        node instanceof Element && (
          node.matches('.live-player-handle-bar, .expand-btn')
          || Boolean(node.closest('.live-player-handle-bar'))
          || Boolean(node.querySelector('.live-player-handle-bar, .expand-btn'))
        )
      ));
    });
    const observer = new MutationObserver((records) => {
      if (mutationTouchesHandleBar(records)) {
        tryCollapse();
      }
    });
    observer.observe(doc.body || doc.documentElement, {
      childList: true,
      subtree: true
    });
    timer = window.setInterval(() => tryCollapse(), 500);
    deadlineTimer = window.setTimeout(stop, MAX_COLLAPSE_WATCH_MS);
    tryCollapse();
  }

  function syncFullscreenState(doc) {
    const active = Boolean(doc.fullscreenElement);
    doc.documentElement.classList.toggle('blive-special-fs', active);
  }

  function watchFullscreenState(doc) {
    const handler = () => syncFullscreenState(doc);
    doc.addEventListener('fullscreenchange', handler);
    syncFullscreenState(doc);
  }

  function initSpecialLayout() {
    const doc = document;
    clearLegacyConflicts(doc);
    const playerRoot = doc.querySelector('.live-non-revenue-player');
    clearLayoutInlineSizes(playerRoot);
    if (playerRoot) {
      const videoArea =
        playerRoot.querySelector('.live-player-bg')
        || playerRoot.querySelector('.player iframe')
        || playerRoot.querySelector('.player');
      getShellExtraWidth(playerRoot);
      if (videoArea) {
        getBaseVideoMetrics(playerRoot, videoArea);
      }
    }
    doc.documentElement.classList.add('blive-special-layout');
    doc.documentElement.classList.toggle('blf-no-list', specialMode === 'no-list');
    doc.documentElement.dataset.bliveSpecialLayoutVersion = VERSION;
    ensureStyle(doc);
    setupSidebar(doc);
    watchFullscreenState(doc);
    watchEmbeddedWebFullscreen(doc);
    window.addEventListener('pagehide', cleanupRuntimeWatchers, { once: true });
    scheduleApplyLayout(doc);
    watchPlayerResize(doc);
    if (!doc.documentElement.dataset.bliveSpecialResizeBound) {
      doc.documentElement.dataset.bliveSpecialResizeBound = '1';
      window.addEventListener('resize', () => scheduleApplyLayout(doc));
    }

    if (specialMode === 'keep-list') {
      startInitialCollapseWatcher(doc);
    }
  }

  function watchAndInit() {
    const doc = document;
    let initialized = false;
    let retryTimer = 0;
    let deadlineTimer = 0;
    let observer = null;
    let stopped = false;

    const stop = () => {
      if (stopped) {
        return;
      }
      stopped = true;
      if (retryTimer) {
        window.clearInterval(retryTimer);
        retryTimer = 0;
      }
      if (deadlineTimer) {
        window.clearTimeout(deadlineTimer);
        deadlineTimer = 0;
      }
      if (observer) {
        observer.disconnect();
      }
    };

    const tryInit = () => {
      if (initialized || stopped) {
        return;
      }
      if (!isSpecialTopPage(doc)) {
        if (doc.readyState === 'complete' && doc.querySelector('.player-and-aside-area')) {
          stop();
        }
        return;
      }
      initialized = true;
      initSpecialLayout();
      console.info('[blive-special-layout] active', {
        version: VERSION,
        mode: specialMode,
        href: location.href
      });
      stop();
    };

    const scheduleTryInit = withRafScheduler(window, tryInit);
    const relevantSelector = [
      '.live-non-revenue-player',
      '.live-player-handle-bar',
      '.live-player-bg',
      'iframe[src*="/blanc/"]',
      '.rendererRoot',
      '.layerWrapperRoot',
      '[class*="pageRoot"]',
      '.player-and-aside-area'
    ].join(',');
    const nodeMayRevealPageType = (node) => node instanceof Element && (
      node.matches(relevantSelector) || Boolean(node.querySelector(relevantSelector))
    );
    observer = new MutationObserver((records) => {
      const relevant = records.some((record) => [...record.addedNodes].some(nodeMayRevealPageType));
      if (relevant) {
        scheduleTryInit();
      }
    });

    observer.observe(doc.documentElement, {
      childList: true,
      subtree: true
    });

    retryTimer = window.setInterval(() => {
      if (initialized) {
        window.clearInterval(retryTimer);
        return;
      }
      scheduleTryInit();
    }, 1000);
    deadlineTimer = window.setTimeout(stop, MAX_INIT_WATCH_MS);

    window.addEventListener('load', scheduleTryInit, { once: true });
    window.addEventListener('pagehide', stop, { once: true });
    scheduleTryInit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchAndInit, { once: true });
  } else {
    watchAndInit();
  }
})();
