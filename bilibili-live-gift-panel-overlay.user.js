// ==UserScript==
// @name         Bilibili Live Gift Panel Overlay
// @name:zh-CN   B站直播礼物面板覆盖
// @namespace    https://live.bilibili.com/
// @version      1.1.3
// @description  Keep the expanded gift panel overlaid on top of the player with a fixed two-row height.
// @description:zh-CN 将 B 站直播礼物大面板覆盖在播放器右下角，固定两行高度，避免挤压视频画面。
// @match        https://live.bilibili.com/*
// @run-at       document-end
// @grant        none
// @license      GPL-3.0-only
// @supportURL   https://github.com/JumpTwiceShou/bilibili-live-tampermonkey-scripts/issues
// ==/UserScript==

(function () {
  'use strict';

  const STYLE_ID = 'tm-bilibili-live-gift-panel-overlay';
  const OPEN_HOST_SELECTOR =
    'body:not(.pure_room_root) .fullscreen-container-paddingbox > .tool-open, ' +
    'body:not(.pure_room_root) .fullscreen-container-paddingbox > .has-first-frame-bg.tool-open';
  const PANEL_SELECTOR = '.container-tool-paddingbox';
  const IGNORE_OUTSIDE_SELECTOR =
    '.container-tool-paddingbox, .gift-control-section, .z-gift-sender-panel, .gift-sender-panel';
  const CLOSE_BUTTON_SELECTORS = [
    '[aria-label*="关闭"]',
    '[title*="关闭"]',
    '[class*="close" i]',
    '[class*="Close"]',
  ];

  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
body:not(.pure_room_root) {
  --tm-bili-gift-panel-width: min(376px, calc(100% - 32px));
  --tm-bili-gift-panel-height: 264px;
  --tm-bili-gift-list-height: 220px;
}

body:not(.pure_room_root) .fullscreen-container-paddingbox > .tool-open,
body:not(.pure_room_root) .fullscreen-container-paddingbox > .has-first-frame-bg.tool-open {
  grid-template-columns: minmax(0, 1fr) !important;
  grid-template-areas: "player" "gift" !important;
}

body:not(.pure_room_root) .fullscreen-container-paddingbox > .tool-open > .player-section,
body:not(.pure_room_root) .fullscreen-container-paddingbox > .has-first-frame-bg.tool-open > .player-section {
  grid-area: player !important;
  min-width: 0 !important;
  width: 100% !important;
}

body:not(.pure_room_root) .fullscreen-container-paddingbox > .tool-open > .container-tool-paddingbox,
body:not(.pure_room_root) .fullscreen-container-paddingbox > .has-first-frame-bg.tool-open > .container-tool-paddingbox {
  grid-area: player !important;
  justify-self: end !important;
  align-self: end !important;
  width: var(--tm-bili-gift-panel-width) !important;
  height: var(--tm-bili-gift-panel-height) !important;
  max-height: calc(100% - 8px) !important;
  margin-right: 4px !important;
  margin-bottom: 4px !important;
  z-index: 30 !important;
  pointer-events: auto !important;
}

body:not(.pure_room_root) .fullscreen-container-paddingbox > .tool-open > .container-tool-paddingbox > *,
body:not(.pure_room_root) .fullscreen-container-paddingbox > .has-first-frame-bg.tool-open > .container-tool-paddingbox > * {
  width: 100% !important;
  height: 100% !important;
  max-height: 100% !important;
}

body:not(.pure_room_root) .container-tool-paddingbox .more-gifts-panel-root,
body:not(.pure_room_root) .container-tool-paddingbox .official-container-root,
body:not(.pure_room_root) .container-tool-paddingbox .gift-panel-background {
  height: 100% !important;
  min-height: 0 !important;
  max-height: 100% !important;
}

body:not(.pure_room_root) .container-tool-paddingbox .gift-list-section {
  height: var(--tm-bili-gift-list-height) !important;
  max-height: calc(100% - 44px) !important;
  min-height: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
}

body:not(.pure_room_root) .container-tool-paddingbox .gift-row {
  flex: 0 0 106px !important;
}

body:not(.pure_room_root) .fullscreen-container-paddingbox > .tool-open .gift-control-section,
body:not(.pure_room_root) .fullscreen-container-paddingbox > .has-first-frame-bg.tool-open .gift-control-section {
  z-index: 40 !important;
}

body:not(.pure_room_root) .fullscreen-container-paddingbox > .tool-open .z-gift-sender-panel,
body:not(.pure_room_root) .fullscreen-container-paddingbox > .has-first-frame-bg.tool-open .z-gift-sender-panel,
body:not(.pure_room_root) .fullscreen-container-paddingbox > .tool-open .gift-sender-panel,
body:not(.pure_room_root) .fullscreen-container-paddingbox > .has-first-frame-bg.tool-open .gift-sender-panel {
  z-index: 41 !important;
  overflow: visible !important;
}
`;

  (document.head || document.documentElement).appendChild(style);

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

    host.classList.remove('tool-open');
  }

  document.addEventListener(
    'pointerdown',
    (event) => {
      const host = getOpenGiftHost();

      if (!host || isInsideIgnoredArea(event)) {
        return;
      }

      closeGiftPanel(host);
    },
    true
  );
})();
