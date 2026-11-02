// ==UserScript==
// @name         Bilibili Live Gift Panel Overlay
// @name:zh-CN   B站直播礼物面板布局重构
// @namespace    https://live.bilibili.com/
// @version      1.3.0
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

  const VERSION = '1.3.0';
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

body:not(.pure_room_root) .container-tool-paddingbox .more-gifts-panel-tabs > .tabs-section {
  flex-shrink: 0;
}

body:not(.pure_room_root) .container-tool-paddingbox .more-gifts-panel-tabs > .right-section {
  flex: 0 0 auto;
}

body:not(.pure_room_root) .container-tool-paddingbox .tm-gift-search {
  box-sizing: border-box;
  flex: 1 1 0;
  min-width: 32px;
  width: 0;
  height: 24px;
  margin: 0 8px;
  padding: 0 6px;
  border: 1px solid #e3e5e7;
  border-radius: 5px;
  outline: none;
  background: #f6f7f8;
  color: #61666d;
  font: inherit;
  font-size: 12px;
}

body:not(.pure_room_root) .container-tool-paddingbox .tm-gift-search:focus {
  border-color: #ff6699;
  background: #fff;
}

body:not(.pure_room_root) .container-tool-paddingbox .gift-list-section.tm-gift-search-active {
  display: grid !important;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0 12px;
  align-content: start;
}

body:not(.pure_room_root) .container-tool-paddingbox .tm-gift-search-active > .gift-row {
  display: contents !important;
}

body:not(.pure_room_root) .container-tool-paddingbox .tm-gift-search-hidden {
  display: none !important;
}

body:not(.pure_room_root) .container-tool-paddingbox .tm-gift-search-empty {
  grid-column: 1 / -1;
  margin: 36px 0;
  color: #9499a0;
  font-size: 12px;
  text-align: center;
}

body:not(.pure_room_root) .container-tool-paddingbox .tm-gift-search-empty[hidden] {
  display: none !important;
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

  let searchQuery = '';
  let searchFrame = 0;
  let searchPanel = null;
  let panelObserver = null;
  const giftNames = new Map();
  const giftSearchKeys = new Map();

  function normalizeGiftName(value) {
    return value.trim().toLocaleLowerCase();
  }

  function normalizePinyin(value) {
    return normalizeGiftName(value).replace(/u:/g, 'ü').normalize('NFD')
      .replace(/u\u0308/g, 'v').replace(/\p{M}/gu, '').replace(/[\s'-]+/g, '');
  }

  function matchesGiftName(name, query, pinyinQuery) {
    if (!query) return true;
    const text = normalizeGiftName(name);
    if (text.includes(query)) return true;
    if (!pinyinQuery || typeof pinyinPro === 'undefined' || typeof pinyinPro.pinyin !== 'function') {
      return false;
    }
    let keys = giftSearchKeys.get(text);
    if (!keys) {
      const options = { toneType: 'none', type: 'array', nonZh: 'consecutive', v: true };
      keys = [
        pinyinPro.pinyin(text, options).join(''),
        pinyinPro.pinyin(text, { ...options, pattern: 'first' }).join(''),
      ].map(normalizePinyin);
      giftSearchKeys.set(text, keys);
    }
    return keys.some((key) => key.includes(pinyinQuery));
  }

  function filterGifts(panel) {
    const query = normalizeGiftName(searchQuery);
    const pinyinQuery = normalizePinyin(query);
    for (const list of panel.querySelectorAll('.gift-list-section')) {
      let matched = 0;
      for (const wrapper of list.querySelectorAll('.list-gift-wrapper')) {
        const gift = wrapper.querySelector('.gift-item');
        const id = gift && [...gift.classList].find((name) => name.startsWith('gift-id-'));
        // Package cards omit their visible label; the native component still has it.
        const name = wrapper.querySelector('.gift-label')?.textContent
          || gift?.__vue__?.giftInfo?.label || giftNames.get(id) || '';
        if (id && name.trim()) giftNames.set(id, name);
        const visible = matchesGiftName(name, query, pinyinQuery);
        wrapper.classList.toggle('tm-gift-search-hidden', !visible);
        if (visible) matched += 1;
      }
      list.classList.toggle('tm-gift-search-active', Boolean(query));
      let empty = list.querySelector('.tm-gift-search-empty');
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'tm-gift-search-empty';
        empty.setAttribute('role', 'status');
        empty.textContent = '没有匹配的礼物';
        list.appendChild(empty);
      }
      empty.hidden = !query || matched > 0;
    }
  }

  function updateGiftSearch() {
    searchFrame = 0;
    if (document.body.classList.contains('pure_room_root')) return;
    const panel = document.querySelector(`${PANEL_SELECTOR} .more-gifts-panel-root`);
    if (panel !== searchPanel) {
      panelObserver?.disconnect();
      searchPanel = panel;
      if (panel) {
        panelObserver = new MutationObserver((records) => {
          if (records.some((record) => {
            const target = record.target.nodeType === Node.ELEMENT_NODE
              ? record.target : record.target.parentElement;
            return target?.matches('.gift-list-section, .gift-row, .list-gift-wrapper, .more-gifts-panel-tabs, .more-gifts-panel-tabs > .tabs-section')
              || target?.closest('.gift-label')
              || [...record.addedNodes, ...record.removedNodes].some((node) =>
                node instanceof Element && (node.matches('.gift-list-section, .more-gifts-panel-tabs')
                  || node.querySelector('.gift-list-section, .more-gifts-panel-tabs'))
              );
          })) scheduleGiftSearch();
        });
        panelObserver.observe(panel, { childList: true, subtree: true, characterData: true });
      }
    }
    if (!panel) return;
    const tabs = panel.querySelector('.more-gifts-panel-tabs > .tabs-section');
    if (tabs && !panel.querySelector('.tm-gift-search')) {
      const input = document.createElement('input');
      input.type = 'search';
      input.className = 'tm-gift-search';
      input.placeholder = '搜索礼物';
      input.setAttribute('aria-label', '搜索礼物');
      input.title = '支持中文、拼音全拼和首字母，例如：小花花 / xiaohuahua / xhh';
      input.autocomplete = 'off';
      input.value = searchQuery;
      input.addEventListener('input', () => {
        searchQuery = input.value;
        filterGifts(panel);
        for (const list of panel.querySelectorAll('.gift-list-section')) list.scrollTop = 0;
      });
      for (const type of ['pointerdown', 'click', 'keydown', 'keyup', 'keypress']) {
        input.addEventListener(type, (event) => {
          event.stopPropagation();
          if (type === 'keydown' && event.key === 'Enter') event.preventDefault();
          if (type === 'keydown' && event.key === 'Escape') {
            event.preventDefault();
            input.value = searchQuery = '';
            filterGifts(panel);
          }
        });
      }
      tabs.after(input);
    }
    filterGifts(panel);
  }

  function scheduleGiftSearch() {
    if (!searchFrame) searchFrame = window.requestAnimationFrame(updateGiftSearch);
  }

  const discoverySelector = '.fullscreen-container-paddingbox, .container-tool-paddingbox, .more-gifts-panel-root';
  const discoveryObserver = new MutationObserver((records) => {
    if (records.some((record) => [...record.addedNodes, ...record.removedNodes].some((node) =>
      node instanceof Element && (node.matches(discoverySelector) || node.querySelector(discoverySelector))
    ))) scheduleGiftSearch();
  });
  discoveryObserver.observe(document.body, { childList: true, subtree: true });
  updateGiftSearch();

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

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0) {
        return;
      }
      const host = getOpenGiftHost();

      if (!host || isInsideIgnoredArea(event)) {
        return;
      }

      closeGiftPanel(host);
    },
    true
  );
})();
