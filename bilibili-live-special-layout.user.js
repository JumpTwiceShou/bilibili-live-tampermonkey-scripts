// ==UserScript==
// @name         Bilibili Live Special Layout
// @namespace    https://live.bilibili.com/
// @version      2.1.7
// @description  Special-page only: keep-list/no-list layout normalization + native-like sidebar.
// @match        https://live.bilibili.com/*
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  if (window.top !== window) {
    return;
  }

  const MODE_KEY = 'blive:special-layout-mode';
  const VALID_MODES = new Set(['keep-list', 'no-list']);
  const DEFAULT_MODE = 'keep-list';
  const FORCE_MODE = null;

  const OFFICIAL_SIDEBAR_CSS_URLS = [
    'https://s1.hdslb.com/bfs/static/blive/blfe-live-room/static/css/app.0c74c70d45a0191b4aa8.vip.css',
    'https://s1.hdslb.com/bfs/static/blive/blfe-live-room/static/css/1061.160ae97049729966266b.vip.css'
  ];

  const LIVE_FOLLOW_URL = 'https://api.live.bilibili.com/xlive/web-ucenter/v1/xfetter/GetWebList?hit_ab=false';
  const FOLLOWING_URL = 'https://api.live.bilibili.com/xlive/web-ucenter/user/following?page=1&page_size=30&ignoreRecord=1&hit_ab=true';
  const REC_URL = 'https://api.live.bilibili.com/xlive/web-interface/v1/index/WebGetUnLoginRecList';
  const LAB_URL = 'https://api.live.bilibili.com/xlive/web-ucenter/v1/labs/InfoPlugs';
  const MORE_FOLLOW_URL = 'https://link.bilibili.com/p/center/index#/user-center/follow/1';
  const STYLE_ID = 'blive-special-layout-style';
  const HOST_CLASS = 'blive-special-layout-host';
  const ROOT_CLASS = 'blive-special-layout-root';
  const DATA_KEY = 'bliveSpecialShellExtra';
  const MAX_PLAYER_WIDTH = 1504;
  const VIEWPORT_GUTTER = 80;
  const LAB_ICON_URL = 'https://i1.hdslb.com/bfs/static/blive/blfe-live-room/static/img/laboratory.11696de..svg';
  const MORE_ARROW_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAATCAYAAACp65zuAAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAC0SURBVHgBjdK9DcIwEAXgO7ugZRQCAqX0KC4QVQo2SNiAnxaxAmICoINIgYwCPXKwjUCAk7u8wnqyPltXHGg97epxooCJgM5jiwL3Fqc0rHDnisUZhWVZ5Kf+IEbbFSKqXjSC8pIfA+iOa3E+cFi+C4fl9ysKy/9ZmrCEmoR4eK+FAQaMBRAxYCpfEG6NUE+S1P6UeWdgIXiEs816NUceLV+9DfqBFPpADvn7NsjF7WPEIZcnb4ttz404aTsAAAAASUVORK5CYII=';
  const MORE_ARROW_ICON_HOVER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAATCAYAAACp65zuAAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAACESURBVHgB3dLBDYAgDAXQXzybeHEQN3AJB3ECcQQncACjxgkcxQHQxAWkIsQjcFYSkn94KTQt0G8ZBlUicgSydEZCK8ajCUNNi03EMoaBUUlMO9v7YUxBTOQqMtcUrezwKYJQCHaBAnA2f2MzBPu07vzobWZQ8mfo2cdLFzZd3KLKvfAGrvyK4hn9U0kAAAAASUVORK5CYII=';
  const PINK_ICON_GIF = 'data:image/gif;base64,R0lGODlhGAAYAJECAP7+/v///wAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMTQ4IDc5LjE2NDAzNiwgMjAxOS8wOC8xMy0wMTowNjo1NyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDIxLjAgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6QTI2NTYzMDc2RTNDMTFFREJENEJEMzUxOTQzQjMxMkQiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6QTI2NTYzMDg2RTNDMTFFREJENEJEMzUxOTQzQjMxMkQiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpBMjY1NjMwNTZFM0MxMUVEQkQ0QkQzNTE5NDNCMzEyRCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpBMjY1NjMwNjZFM0MxMUVEQkQ0QkQzNTE5NDNCMzEyRCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgH//v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+urayrqqmop6alpKOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sa2ppaGdmZWRjYmFgX15dXFtaWVhXVlVUU1JRUE9OTUxLSklIR0ZFRENCQUA/Pj08Ozo5ODc2NTQzMjEwLy4tLCsqKSgnJiUkIyIhIB8eHRwbGhkYFxYVFBMSERAPDg0MCwoJCAcGBQQDAgEAACH5BAkEAAIALAAAAAAYABgAAAI5lI+py+0Po2QhTFXrRdlu031gJgqhpI0pdJ4sacJv6j6trABeTOMcfFslgp7ar4fcDVcyX+kJjToKACH5BAkEAAIALAAAAAAYABgAAAI2lI+py+0Po5xUhFDRvdls3H0T522SaJkRikKs6qptAr+kYoOzJvc37dPBgKQco3YbdpbM5qQAACH5BAkEAAIALAAAAAAYABgAAAI3lI+py+0Po5y02hhykHqLzmkGiImfCZHkkh0qmrztOSuyt8bmzfC0Z9sJa7qZLwhEwS7MpnNSAAAh+QQJBAACACwAAAAAGAAYAAACPJSPqcvtD6OctJoQ7MFYC55dYQSKHcmZo3J+qdsmJRzO7DvbMs7HSN5b/YIqBvCkGyKJixds4/NIp1RHAQAh+QQJBAACACwAAAAAGAAYAAACOpSPqcvtD6OcLwSarMVHXy54YKhJIrmhn3K25eKmJ/vGa1bnKS3rN2IzzHC94q/jE754yNVyBI1KIQUAIfkECQQAAgAsAAAAABgAGAAAAjmUj6nL7Q+jnLSaEOzBePbLSVwmjGJYopCZfmnDxmoif6xSkzeN5ozfIuF6RBfPVhQeN66Z5gmNTgoAIfkECQQAAgAsAAAAABgAGAAAAjmUj6nL7Q+jnLRaETLSMnMfdJ4Bit8YlRgKqerauOibyCen2OGK1/Pf2wB3NOGNyPLteIfk5QmNTgoAIfkECQQAAgAsAAAAABgAGAAAAjeUj6nL7Q+jnCkEWu3FRm/uHdYUCiVUnk+qSewYvd/amrWKyF2t6DbcuwmBGZgv+OHxOMyms1kAACH5BAkEAAIALAAAAAAYABgAAAI5lI+py+0PowtBLkptwlUf7n1YaIBlF5kmpI6puz5t9tLxBLsCgCpzdxPZcjQfEajbFHVJkvMJtRQAACH5BAkEAAIALAAAAAAYABgAAAI1lI+py+0Po5wpBFrtxUZv7nGdJgqheJ5QSkasJb2bmsFmSyPyaCv73avNcC1fr1gsKZdMSAEAIfkECQQAAgAsAAAAABgAGAAAAjWUj6nL7Q+jnLRaEfI1Wd8ebKDYkR4WHqcyol7Llm4KJ+0tx69cI/i+8vGGQdUpl9sol0xIAQAh+QQJBAACACwAAAAAGAAYAAACNJSPqcvtD6OctNq7QsBCa+xtV9h8DJl5p5qaCtqJsZugNvuyN43sIlzTCXkHnJHISSqXiQIAOw==';
  const LEGACY_STYLE_IDS = ['blf-special-style', 'tm-bili-special-layout-large-player-style'];
  const LEGACY_CLASSES = ['blf-special-page', 'tm-bili-special-layout-normal-room-like', 'tm-bili-special-layout-player-host', 'tm-bili-special-layout-player-root'];
  const FRAME_STYLE_ID = 'blive-special-layout-frame-style';
  let resizeObserver = null;
  let rafId = 0;
  let webModePollTimer = 0;
  let trackedBlancFrame = null;
  let specialWebFullscreenActive = false;

  const urlMode = new URLSearchParams(window.location.search).get('blf_mode');
  const storedMode = (window.localStorage.getItem(MODE_KEY) || DEFAULT_MODE).toLowerCase();
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
    window.localStorage.setItem(MODE_KEY, next);
    return true;
  };

  function isSpecialTopPage(doc) {
    if (window.top !== window) {
      return false;
    }
    const hasSpecialPlayer = Boolean(doc.querySelector('.live-non-revenue-player'));
    const hasHandleBar = Boolean(doc.querySelector('.live-player-handle-bar'));
    const hasPlayerBg = Boolean(doc.querySelector('.live-player-bg'));
    const hasBlancFrame = Array.from(doc.querySelectorAll('iframe')).some((frame) => (frame.src || '').includes('/blanc/'));
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

  function ensureOfficialSidebarCss(doc) {
    if (!doc || !doc.head) {
      return;
    }
    OFFICIAL_SIDEBAR_CSS_URLS.forEach((href) => {
      if (doc.querySelector(`link[data-blive-special-sidebar="${href}"]`)) {
        return;
      }
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.bliveSpecialSidebar = href;
      doc.head.appendChild(link);
    });
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
      Array.from(doc.querySelectorAll('iframe')).find((frame) => (frame.src || '').includes('/blanc/'))
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
    const cached = Number(playerRoot.dataset[DATA_KEY] || 0);
    if (cached > 0) {
      return cached;
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

  function getBlancFrame(doc) {
    return Array.from(doc.querySelectorAll('iframe'))
      .find((frame) => (frame.src || '').includes('/blanc/')) || null;
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

  function isSpecialEmbeddedBlanc() {
    if (window.top === window) {
      return false;
    }
    if (!location.pathname.startsWith('/blanc/')) {
      return false;
    }
    try {
      const parentDoc = window.parent && window.parent.document;
      return Boolean(parentDoc && parentDoc.querySelector('.live-non-revenue-player'));
    } catch (_err) {
      return false;
    }
  }

  function ensureEmbeddedFrameStyle(doc) {
    if (!doc || !doc.head || doc.getElementById(FRAME_STYLE_ID)) {
      return;
    }
    const style = doc.createElement('style');
    style.id = FRAME_STYLE_ID;
    style.textContent = `
html.blive-special-embedded {
  --blive-special-frame-width: min(1504px, 100vw);
  --blive-special-left-width: 1190px;
  --blive-special-right-width: 302px;
  --blive-special-left-height: 670px;
}
html.blive-special-embedded .player-and-aside-area {
  width: var(--blive-special-frame-width) !important;
  max-width: var(--blive-special-frame-width) !important;
}
html.blive-special-embedded #player-ctnr,
html.blive-special-embedded .left-container,
html.blive-special-embedded .player-section,
html.blive-special-embedded .live-player-mounter,
html.blive-special-embedded #gift-control-vm {
  width: var(--blive-special-left-width) !important;
  max-width: var(--blive-special-left-width) !important;
}
html.blive-special-embedded .player-section,
html.blive-special-embedded .live-player-mounter,
html.blive-special-embedded #live-player {
  height: var(--blive-special-left-height) !important;
}
html.blive-special-embedded .chat-history-panel,
html.blive-special-embedded #chat-history-list,
html.blive-special-embedded #chat-control-panel-vm {
  width: var(--blive-special-right-width) !important;
  max-width: var(--blive-special-right-width) !important;
}
html.blive-special-embedded .fullscreen-container-paddingbox,
html.blive-special-embedded #fullscreen-container,
html.blive-special-embedded .fullscreen-container-paddingbox > .tool-open,
html.blive-special-embedded .fullscreen-container-paddingbox > .has-first-frame-bg.tool-open {
  width: var(--blive-special-left-width) !important;
  max-width: var(--blive-special-left-width) !important;
  height: var(--blive-special-left-height) !important;
}
html.blive-special-embedded .fullscreen-container-paddingbox > #fullscreen-container,
html.blive-special-embedded .fullscreen-container-paddingbox > .tool-open,
html.blive-special-embedded .fullscreen-container-paddingbox > .has-first-frame-bg.tool-open {
  margin-left: 0 !important;
  margin-right: 0 !important;
}
html.blive-special-embedded .fullscreen-container-paddingbox .player-section,
html.blive-special-embedded .fullscreen-container-paddingbox .web-player-inject-wrap,
html.blive-special-embedded .fullscreen-container-paddingbox .web-player-controller-wrap,
html.blive-special-embedded .fullscreen-container-paddingbox video {
  width: 100% !important;
  max-width: 100% !important;
}
`;
    doc.head.appendChild(style);
  }

  function initEmbeddedFrameLayout() {
    const doc = document;
    doc.documentElement.classList.add('blive-special-embedded');
    doc.documentElement.dataset.bliveSpecialLayoutVersion = `${FORCE_MODE === 'no-list' ? '2.1.4-no-list' : '2.1.4'}-frame`;
    ensureEmbeddedFrameStyle(doc);
  }

  function ensureStyle(doc) {
    if (!doc || !doc.head || doc.getElementById(STYLE_ID)) {
      return;
    }
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
html.blive-special-layout {
  --blive-special-player-width: min(1504px, calc(100vw - 60px));
  --blive-special-player-height: calc(var(--blive-special-player-width) * 0.5864361702);
  --blive-special-list-width: min(1220px, var(--blive-special-player-width));
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
}
html.blive-special-layout #blf-special-sidebar-host #sidebar-vm {
  position: relative !important;
}
html.blive-special-layout #blf-special-sidebar-host .side-bar-cntr {
  position: fixed !important;
  right: 0 !important;
  bottom: 20% !important;
  width: 44px !important;
  min-height: 86px !important;
  background: #fff !important;
  border-radius: 12px 0 0 12px !important;
  box-shadow: 0 0 20px 0 rgba(0, 85, 255, 0.1) !important;
  padding: 12px 4px !important;
  box-sizing: border-box !important;
}
html.blive-special-layout #blf-special-sidebar-host .side-bar-btn {
  width: 34px !important;
  height: 56px !important;
  padding: 5px 4px !important;
  margin: 0 !important;
  box-sizing: border-box !important;
  cursor: pointer !important;
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
  overflow: hidden !important;
  display: none !important;
}
html.blive-special-layout #blf-special-sidebar-host .side-bar-popup-cntr.is-open {
  display: block !important;
}
html.blive-special-layout #blf-special-sidebar-host .side-bar-popup-cntr .arrow {
  top: calc(55% + 0px) !important;
}
html.blive-special-layout #blf-special-sidebar-host .content-wrapper {
  width: 276px !important;
  height: 394px !important;
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
  margin: 1.4px 2.75px 1.4px 4.15px !important;
  width: 12px !important;
  height: 12px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background-image: url("${MORE_ARROW_ICON}") !important;
  background-repeat: no-repeat !important;
  background-size: 5.1px 9.2px !important;
  background-position: center !important;
}
html.blive-special-layout #blf-special-sidebar-host .more-follows:hover span {
  color: #00aeec !important;
}
html.blive-special-layout #blf-special-sidebar-host .more-follows:hover .blue-right-arrow {
  background-image: url("${MORE_ARROW_ICON_HOVER}") !important;
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
html.blive-special-layout #blf-special-sidebar-host .side-bar-icon.icon-lab {
  background: center / 26px 26px no-repeat url("${LAB_ICON_URL}") !important;
}
html.blive-special-layout #blf-special-sidebar-host .tm-sidebar-follow .side-bar-icon.icon-font,
html.blive-special-layout #blf-special-sidebar-host .tm-sidebar-top .side-bar-icon.icon-font {
  background: none !important;
  color: #00aeec !important;
  font-size: 26px !important;
  line-height: 26px !important;
  text-align: center !important;
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
  background-image: url("${PINK_ICON_GIF}") !important;
  background-repeat: no-repeat !important;
  background-size: 8px 9px !important;
  background-position: center !important;
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

  function extractRooms(payload) {
    if (!payload || payload.code !== 0) {
      return [];
    }
    const out = [];
    const seen = new Set();
    const walk = (node) => {
      if (!node) {
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node !== 'object') {
        return;
      }
      const roomid = node.roomid || node.room_id || node.roomId || node.id || node.anchor_roomid;
      const face = node.face || node.face_url || node.avatar || node.cover || node.cover_from_user || '';
      const nickname = node.nickname || node.uname || node.name || node.anchor_name || '';
      let href = node.link || node.url || node.jump_url || node.room_link || '';

      if (!href && roomid) {
        href = `https://live.bilibili.com/${roomid}`;
      }
      if (href && href.startsWith('//')) {
        href = `https:${href}`;
      }
      if (href && href.startsWith('/')) {
        href = `https://live.bilibili.com${href}`;
      }
      if (roomid && face && nickname && href) {
        const key = String(roomid);
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ roomid, face, nickname, href });
        }
      }
      Object.values(node).forEach(walk);
    };
    walk(payload.data || payload);
    return out.slice(0, 30);
  }

  function findFirstUrl(node) {
    let found = '';
    const walk = (value) => {
      if (found || !value) {
        return;
      }
      if (typeof value === 'string') {
        if (/^https?:\/\//.test(value)) {
          found = value;
        }
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (typeof value === 'object') {
        Object.values(value).forEach(walk);
      }
    };
    walk(node);
    return found;
  }

  async function fetchJson(url) {
    const resp = await fetch(url, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    return resp.json();
  }

  async function fetchSidebarPayload() {
    let title = '我的关注';
    let items = [];
    let labUrl = '';

    try {
      items = extractRooms(await fetchJson(LIVE_FOLLOW_URL));
    } catch (_err) {
      // ignore
    }
    if (!items.length) {
      try {
        items = extractRooms(await fetchJson(FOLLOWING_URL));
      } catch (_err) {
        // ignore
      }
    }
    if (!items.length) {
      title = '主播推荐';
      try {
        items = extractRooms(await fetchJson(REC_URL));
      } catch (_err) {
        // ignore
      }
    }
    try {
      const labs = await fetchJson(LAB_URL);
      labUrl = findFirstUrl(labs.data || labs) || '';
    } catch (_err) {
      // ignore
    }
    return { title, items, labUrl };
  }

  function renderFollowList(listRoot, items) {
    listRoot.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'follow-empty-cntr';
      empty.setAttribute('data-v-80ec38f4', '');
      const text = document.createElement('div');
      text.className = 'follow-empty-text';
      text.setAttribute('data-v-80ec38f4', '');
      text.textContent = '暂无可展示内容';
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
  <div data-v-12f789d4="" class="side-bar-cntr" style="height:60px;">
    <div data-v-12f789d4="" role="button" data-upgrade-intro="Laboratory" class="side-bar-btn tm-sidebar-lab" style="display:none;">
      <div data-v-7d702bb4="" data-v-12f789d4="" class="side-bar-btn-cntr">
        <span data-v-7d702bb4="" class="side-bar-icon dp-i-block icon-lab"></span>
        <p data-v-7d702bb4="" class="size-bar-text color-#0080c6" style="color: rgb(0, 128, 198);">实验室</p>
      </div>
    </div>
    <div data-v-12f789d4="" role="button" data-upgrade-intro="Follow" class="side-bar-btn tm-sidebar-follow">
      <div data-v-7d702bb4="" data-v-12f789d4="" class="side-bar-btn-cntr">
        <span data-v-7d702bb4="" class="side-bar-icon dp-i-block icon-font icon-hollow-heart"></span>
        <p data-v-7d702bb4="" class="size-bar-text color-#0080c6" style="color: rgb(0, 128, 198);">关注</p>
      </div>
    </div>
    <div data-v-12f789d4="" role="button" data-upgrade-intro="Top" class="side-bar-btn no-text tm-sidebar-top" style="display:none;">
      <div data-v-7d702bb4="" data-v-12f789d4="" class="side-bar-btn-cntr">
        <span data-v-7d702bb4="" class="side-bar-icon dp-i-block icon-font icon-arrow-top"></span>
      </div>
    </div>
  </div>
  <div data-v-902b9200="" data-v-12f789d4="" class="side-bar-popup-cntr ts-dot-4" style="bottom: calc(23% - 149px); height: 394px; display: none;">
    <div data-v-902b9200="" class="arrow" style="top: calc(55% + 0px);"></div>
    <div data-v-902b9200="" class="content-wrapper">
      <div data-v-80ec38f4="" data-v-902b9200="" class="follow-cntr" popup-name="Follow">
        <div data-v-80ec38f4="" class="my-follow">
          <div data-v-80ec38f4="" class="follow-text">我的关注</div>
          <a data-v-80ec38f4="" class="more-follows" href="${MORE_FOLLOW_URL}" target="_blank" rel="noopener noreferrer">
            <span data-v-80ec38f4="">更多关注</span>
            <i data-v-80ec38f4="" class="blue-right-arrow"></i>
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

    const cntr = host.querySelector('.side-bar-cntr');
    const followBtn = host.querySelector('.tm-sidebar-follow');
    const topBtn = host.querySelector('.tm-sidebar-top');
    const labBtn = host.querySelector('.tm-sidebar-lab');
    const popup = host.querySelector('.side-bar-popup-cntr');
    const listRoot = host.querySelector('[data-blf-role="list"]');
    const subtitle = host.querySelector('[data-blf-role="subtitle"]');
    const titleRoot = host.querySelector('.follow-text');

    let popupOpen = false;
    let loading = false;
    let cacheItems = [];
    let cacheTitle = '我的关注';
    let labUrl = '';

    const scheduleTop = withRafScheduler(window, () => {
      const show = window.scrollY > getPlayerTop(doc) + 120;
      topBtn.style.display = show ? 'block' : 'none';
      cntr.style.minHeight = show ? '114px' : '86px';
      cntr.style.height = show ? '114px' : '60px';
    });

    function setPopup(open) {
      popupOpen = open;
      popup.classList.toggle('is-open', open);
      popup.style.display = open ? 'block' : 'none';
    }

    async function loadFollow(force) {
      if (loading) {
        return;
      }
      if (!force && cacheItems.length) {
        renderFollowList(listRoot, cacheItems);
        return;
      }
      loading = true;
      try {
        const payload = await fetchSidebarPayload();
        cacheItems = payload.items;
        cacheTitle = payload.title;
        labUrl = payload.labUrl || '';

        titleRoot.textContent = cacheTitle;
        subtitle.textContent = `${cacheItems.length} 个${cacheTitle === '我的关注' ? '直播间' : '推荐主播'}`;
        labBtn.style.display = labUrl ? 'block' : 'none';
        renderFollowList(listRoot, cacheItems);
      } finally {
        loading = false;
      }
    }

    followBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const next = !popupOpen;
      setPopup(next);
      if (next) {
        loadFollow(false);
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
      if (labUrl) {
        window.open(labUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.open('https://live.bilibili.com/p/html/live-labs/index.html', '_blank', 'noopener,noreferrer');
      }
    });

    doc.addEventListener('click', (evt) => {
      if (!host.contains(evt.target)) {
        setPopup(false);
      }
    });

    window.addEventListener('scroll', scheduleTop, { passive: true });
    scheduleTop();
    loadFollow(false);
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

    const baseVideoWidth = videoArea.offsetWidth;
    const baseVideoHeight = videoArea.offsetHeight;
    if (!baseVideoWidth || !baseVideoHeight) {
      return false;
    }

    const targetWidth = Math.min(
      MAX_PLAYER_WIDTH,
      Math.max(baseVideoWidth, window.innerWidth - VIEWPORT_GUTTER)
    );
    const scale = targetWidth / baseVideoWidth;
    const targetHeight = Math.round(baseVideoHeight * scale);
    const targetShellWidth = Math.round(targetWidth + getShellExtraWidth(playerRoot));
    const handleBarWidth = Math.min(1220, targetWidth);
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
      window.cancelAnimationFrame(rafId);
    }
    rafId = window.requestAnimationFrame(() => {
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

    const onFrameLoad = () => scheduleApplyLayout(doc);
    const bindTrackedFrame = () => {
      const frame = getBlancFrame(doc);
      if (!frame || frame === trackedBlancFrame) {
        return;
      }
      if (trackedBlancFrame) {
        trackedBlancFrame.removeEventListener('load', onFrameLoad);
      }
      trackedBlancFrame = frame;
      trackedBlancFrame.addEventListener('load', onFrameLoad);
    };

    bindTrackedFrame();
    webModePollTimer = window.setInterval(() => {
      bindTrackedFrame();
      if (isEmbeddedWebFullscreenActive(doc) !== specialWebFullscreenActive) {
        scheduleApplyLayout(doc);
      }
    }, 350);
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
    const barHeight = Math.round(bar.getBoundingClientRect().height);
    const expanded = barHeight > 90 || btn.classList.contains('liveexpand');
    if (!expanded) {
      doc.documentElement.dataset.blfInitialCollapseDone = '1';
      doc.documentElement.dataset.blfListCollapsed = '1';
      return true;
    }
    const now = Date.now();
    const lastTry = Number(btn.dataset.blfCollapseTry || '0');
    if (now - lastTry < 600) {
      return false;
    }
    btn.dataset.blfCollapseTry = String(now);
    btn.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
    return false;
  }

  function startInitialCollapseWatcher(doc) {
    let timer = 0;
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
    };
    const tryCollapse = () => {
      const done = ensureDefaultCollapsed(doc);
      if (done) {
        stop();
      }
    };
    const observer = new MutationObserver(() => tryCollapse());
    observer.observe(doc.body || doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    timer = window.setInterval(() => tryCollapse(), 1000);
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
    clearLayoutInlineSizes(doc.querySelector('.live-non-revenue-player'));
    doc.documentElement.classList.add('blive-special-layout');
    doc.documentElement.classList.toggle('blf-no-list', specialMode === 'no-list');
    doc.documentElement.dataset.bliveSpecialLayoutVersion = '2.1.7';
    ensureOfficialSidebarCss(doc);
    ensureStyle(doc);
    setupSidebar(doc);
    watchFullscreenState(doc);
    watchEmbeddedWebFullscreen(doc);
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

    const tryInit = () => {
      if (initialized) {
        return;
      }
      if (!isSpecialTopPage(doc)) {
        return;
      }
      initialized = true;
      initSpecialLayout();
      console.info('[blive-special-layout] active', {
        version: '2.1.7',
        mode: specialMode,
        href: location.href
      });
      if (retryTimer) {
        window.clearInterval(retryTimer);
      }
      observer.disconnect();
    };

    const scheduleTryInit = withRafScheduler(window, tryInit);
    const observer = new MutationObserver(() => {
      scheduleTryInit();
      if (initialized) {
        scheduleApplyLayout(doc);
      }
    });

    observer.observe(doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'src']
    });

    retryTimer = window.setInterval(() => {
      if (initialized) {
        window.clearInterval(retryTimer);
        return;
      }
      scheduleTryInit();
    }, 1000);

    window.addEventListener('load', scheduleTryInit, { once: true });
    scheduleTryInit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchAndInit, { once: true });
  } else {
    watchAndInit();
  }
})();
