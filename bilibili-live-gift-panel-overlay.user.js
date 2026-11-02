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
// Generated from src/gift-panel/index.user.js; run node scripts/build-userscripts.mjs.

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

  function createLifecycle() {
    let active = true;
    const disposers = [];
    return {
      get active() { return active; },
      add(dispose) {
        if (active) disposers.push(dispose);
        else dispose();
        return dispose;
      },
      listen(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        this.add(() => target.removeEventListener(type, handler, options));
      },
      dispose() {
        if (!active) return;
        active = false;
        while (disposers.length) disposers.pop()();
      },
    };
  }

  function createGiftAdapter() {
    const names = new Map();
    return {
      clear() { names.clear(); },
      read(wrapper) {
        const gift = wrapper.querySelector('.gift-item');
        const id = gift && [...gift.classList].find((value) => value.startsWith('gift-id-'));
        let name = wrapper.querySelector('.gift-label')?.textContent?.trim()
          || gift?.getAttribute('aria-label')?.trim() || gift?.getAttribute('title')?.trim() || '';
        // Some package cards have no label. Keep the site-specific fallback in this adapter.
        if (!name) {
          try {
            const nativeName = gift?.__vue__?.giftInfo?.label;
            if (typeof nativeName === 'string') name = nativeName.trim();
          } catch (_error) { /* A replaced native component may already be disposed. */ }
        }
        if (id && name) names.set(id, name);
        return name || names.get(id) || '';
      },
    };
  }

  function normalizeGiftName(value) {
    return value.trim().toLocaleLowerCase();
  }

  function normalizePinyin(value) {
    return normalizeGiftName(value).replace(/u:/g, 'ü').normalize('NFD')
      .replace(/u\u0308/g, 'v').replace(/\p{M}/gu, '').replace(/[\s'-]+/g, '');
  }

  function createGiftSearchIndex() {
    const cache = new Map();
    return {
      clear() { cache.clear(); },
      query(value) {
        const text = normalizeGiftName(value);
        return { text, pinyin: normalizePinyin(text) };
      },
      matches(name, query) {
        if (!query.text) return true;
        const text = normalizeGiftName(name);
        if (text.includes(query.text)) return true;
        if (!query.pinyin || typeof pinyinPro === 'undefined' || typeof pinyinPro.pinyin !== 'function') return false;
        let keys = cache.get(text);
        if (!keys) {
          const options = { toneType: 'none', type: 'array', nonZh: 'consecutive', v: true };
          keys = [
            pinyinPro.pinyin(text, options).join(''),
            pinyinPro.pinyin(text, { ...options, pattern: 'first' }).join(''),
          ].map(normalizePinyin);
          cache.set(text, keys);
        }
        return keys.some((key) => key.includes(query.pinyin));
      },
    };
  }

  function createGiftPanelSearch(panel, queryState, adapter, index) {
    const scope = createLifecycle();
    let inputScope = createLifecycle();
    let input = null;
    let lists = [];
    let dirty = true;
    let frame = 0;

    function mountInput() {
      const tabs = panel.querySelector('.more-gifts-panel-tabs > .tabs-section');
      if (!tabs || (input?.isConnected && input.parentElement === tabs.parentElement)) return;
      inputScope.dispose();
      inputScope = createLifecycle();
      input = panel.querySelector('.tm-gift-search') || document.createElement('input');
      input.type = 'search';
      input.className = 'tm-gift-search';
      input.placeholder = '搜索礼物';
      input.setAttribute('aria-label', '搜索礼物');
      input.title = '支持中文、拼音全拼和首字母，例如：小花花 / xiaohuahua / xhh';
      input.autocomplete = 'off';
      input.value = queryState.value;
      inputScope.listen(input, 'input', () => {
        queryState.value = input.value;
        render();
        for (const { list } of lists) list.scrollTop = 0;
      });
      for (const type of ['pointerdown', 'click', 'keydown', 'keyup', 'keypress']) {
        inputScope.listen(input, type, (event) => {
          event.stopPropagation();
          if (type === 'keydown' && event.key === 'Enter') event.preventDefault();
          if (type === 'keydown' && event.key === 'Escape') {
            event.preventDefault();
            input.value = queryState.value = '';
            render();
          }
        });
      }
      tabs.after(input);
    }

    function rebuild() {
      mountInput();
      lists = [...panel.querySelectorAll('.gift-list-section')].map((list) => {
        const entries = [...list.querySelectorAll('.list-gift-wrapper')].map((wrapper) => ({
          wrapper, name: adapter.read(wrapper),
        }));
        let empty = list.querySelector('.tm-gift-search-empty');
        if (!empty) {
          empty = document.createElement('div');
          empty.className = 'tm-gift-search-empty';
          empty.setAttribute('role', 'status');
          empty.textContent = '没有匹配的礼物';
          list.appendChild(empty);
        }
        return { list, entries, empty };
      });
      dirty = false;
    }

    function render() {
      if (!scope.active) return;
      if (dirty) rebuild();
      const query = index.query(queryState.value);
      for (const { list, entries, empty } of lists) {
        let matched = 0;
        for (const { wrapper, name } of entries) {
          const visible = index.matches(name, query);
          wrapper.classList.toggle('tm-gift-search-hidden', !visible);
          if (visible) matched += 1;
        }
        list.classList.toggle('tm-gift-search-active', Boolean(query.text));
        empty.hidden = !query.text || matched > 0;
      }
    }

    function invalidate() {
      dirty = true;
      if (!frame) frame = window.requestAnimationFrame(() => { frame = 0; render(); });
    }

    const observer = new MutationObserver((records) => {
      if (records.some((record) => {
        const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        if (record.type === 'attributes') return target?.matches('.gift-item, .gift-label');
        return target?.matches('.gift-list-section, .gift-row, .list-gift-wrapper, .more-gifts-panel-tabs, .more-gifts-panel-tabs > .tabs-section')
          || target?.closest('.gift-label')
          || [...record.addedNodes, ...record.removedNodes].some((node) => node instanceof Element
            && (node.matches('.gift-list-section, .more-gifts-panel-tabs')
              || node.querySelector('.gift-list-section, .more-gifts-panel-tabs')));
      })) invalidate();
    });
    observer.observe(panel, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['class', 'title', 'aria-label'],
    });
    render();
    return {
      dispose() {
        scope.dispose();
        observer.disconnect();
        inputScope.dispose();
        if (frame) window.cancelAnimationFrame(frame);
        input?.remove();
        for (const { list, entries, empty } of lists) {
          list.classList.remove('tm-gift-search-active');
          for (const { wrapper } of entries) wrapper.classList.remove('tm-gift-search-hidden');
          empty.remove();
        }
        lists = [];
      },
    };
  }

  const giftQuery = { value: '' };
  let giftRuntime = null;

  function startGiftRuntime() {
    if (giftRuntime || document.body.classList.contains('pure_room_root')) return;
    const scope = createLifecycle();
    giftRuntime = scope;
    const adapter = createGiftAdapter();
    const index = createGiftSearchIndex();
    let root = null;
    let rootObserver = null;
    let discovery = null;
    let discoveryTimer = 0;
    let panel = null;
    let search = null;
    let frame = 0;

    function stopDiscovery() {
      discovery?.disconnect();
      discovery = null;
      if (discoveryTimer) window.clearTimeout(discoveryTimer);
      discoveryTimer = 0;
    }

    function syncPanel() {
      frame = 0;
      if (!scope.active) return;
      const next = getOpenGiftHost() && root?.querySelector(`${PANEL_SELECTOR} .more-gifts-panel-root`);
      if (next === panel) return;
      search?.dispose();
      panel = next;
      search = panel ? createGiftPanelSearch(panel, giftQuery, adapter, index) : null;
    }

    function schedulePanel() {
      if (!frame) frame = window.requestAnimationFrame(syncPanel);
    }

    function bindRoot(next) {
      rootObserver?.disconnect();
      search?.dispose();
      search = panel = null;
      root = next;
      adapter.clear();
      index.clear();
      if (!root) return;
      stopDiscovery();
      rootObserver = new MutationObserver((records) => {
        if (records.some((record) => !panel?.contains(record.target))) schedulePanel();
      });
      rootObserver.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      syncPanel();
    }

    function discover() {
      stopDiscovery();
      const current = document.querySelector('.fullscreen-container-paddingbox');
      if (current) { bindRoot(current); return; }
      discovery = new MutationObserver((records) => {
        if (!records.some((record) => [...record.addedNodes].some((node) => node instanceof Element
          && (node.matches('.fullscreen-container-paddingbox') || node.querySelector('.fullscreen-container-paddingbox'))))) return;
        const next = document.querySelector('.fullscreen-container-paddingbox');
        if (next) bindRoot(next);
      });
      discovery.observe(document.body, { childList: true, subtree: true });
      discoveryTimer = window.setTimeout(stopDiscovery, 30000);
    }

    // The global guard only checks the known player's connection; it never scans chat subtrees.
    const guard = new MutationObserver(() => {
      if (root && !root.isConnected) { bindRoot(null); discover(); }
    });
    guard.observe(document.body, { childList: true, subtree: true });
    scope.listen(document, 'pointerdown', (event) => {
      if (event.button !== 0) return;
      const host = getOpenGiftHost();
      if (host && !isInsideIgnoredArea(event)) closeGiftPanel(host);
    }, true);
    scope.listen(window, 'popstate', discover);
    scope.add(() => {
      guard.disconnect();
      stopDiscovery();
      rootObserver?.disconnect();
      search?.dispose();
      if (frame) window.cancelAnimationFrame(frame);
      adapter.clear();
      index.clear();
    });
    discover();
  }

  window.addEventListener('pagehide', () => {
    giftRuntime?.dispose();
    giftRuntime = null;
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) startGiftRuntime();
  });


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
