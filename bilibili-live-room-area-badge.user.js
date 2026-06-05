// ==UserScript==
// @name         Bilibili Live Room Area Badge
// @name:zh-CN   B站直播间标题与分区显示
// @namespace    https://live.bilibili.com/
// @version      1.0.16
// @description  Show the current live room title and area near the room header, with links to the parent and child live area pages.
// @description:zh-CN 在 B 站直播间标题栏重新显示直播标题、父分区和子分区，并为分区添加跳转链接。
// @match        https://live.bilibili.com/*
// @exclude      https://live.bilibili.com/p/*
// @run-at       document-idle
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

  const VERSION = '1.0.16';
  const STYLE_ID = 'blive-room-area-badge-style';
  const HOST_ID = 'blive-room-area-badge-host';
  const API_ROOM_GET_INFO = 'https://api.live.bilibili.com/room/v1/Room/get_info';
  const API_GET_INFO_BY_ROOM = 'https://api.live.bilibili.com/xlive/web-room/v1/index/getInfoByRoom';
  const API_ROOM_INIT = 'https://api.live.bilibili.com/room/v1/Room/room_init';
  const AREA_PAGE_URL = 'https://live.bilibili.com/p/eden/area-tags';
  const HEADER_MOUNT_SELECTOR = '#head-info-vm .normal-row-ctnr';
  const HEADER_RIGHT_MODULES_SELECTOR = '#head-info-vm .right-fixed-modules';
  const RETRY_MS = 1500;
  const SLOW_RECHECK_MS = 8000;

  const state = {
    roomId: '',
    infoKey: '',
    info: null,
    loadingRoomId: '',
    attachTimer: 0,
    headerWaitTimer: 0,
    refreshTimer: 0,
    slowTimer: 0,
    lastPath: location.href
  };

  if (!isLiveRoomPage()) {
    return;
  }

  document.documentElement.dataset.bliveRoomAreaBadgeVersion = VERSION;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${HOST_ID} {
  box-sizing: border-box;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: min(520px, calc(100vw - 32px));
  height: 24px;
  padding: 0 10px;
  border: 1px solid rgba(0, 174, 236, 0.18);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 2px 8px rgba(24, 25, 28, 0.08);
  color: #61666d;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  pointer-events: auto;
  z-index: 120;
  overflow: hidden;
}

#${HOST_ID}.blive-room-area-badge-static {
  display: inline-flex;
  flex: 0 0 auto;
  margin: 0 10px;
  vertical-align: middle;
}

#${HOST_ID}.blive-room-area-badge-hidden {
  display: none !important;
}

#${HOST_ID} .blive-room-title-text {
  flex: 1 1 auto;
  min-width: 0;
  max-width: min(300px, 32vw);
  overflow: hidden;
  color: #61666d;
  font-weight: 500;
  text-overflow: ellipsis;
}

#${HOST_ID} .blive-room-title-sep {
  flex: 0 0 auto;
  color: #d3d6da;
}

#${HOST_ID} .blive-room-area-badge-label {
  flex: 0 0 auto;
  color: #9499a0;
}

#${HOST_ID} .blive-room-area-badge-link {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 108px;
  overflow: hidden;
  color: #00aeec;
  font-weight: 500;
  text-decoration: none;
  text-overflow: ellipsis;
}

#${HOST_ID} .blive-room-area-badge-link:hover {
  color: #00b5e5;
  text-decoration: underline;
}

#${HOST_ID} .blive-room-area-badge-sep {
  flex: 0 0 auto;
  color: #c9ccd0;
}

#${HOST_ID} .blive-room-area-badge-status {
  color: #9499a0;
}

html:has(iframe:fullscreen) #${HOST_ID},
html:has(iframe:-webkit-full-screen) #${HOST_ID} {
  display: none !important;
}
`;
    document.head.appendChild(style);
  }

  function createHost() {
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('aria-label', '\u5f53\u524d\u76f4\u64ad\u95f4\u6807\u9898\u548c\u5206\u533a');
    if (state.info) {
      renderArea(host, state.info);
    } else {
      renderLoading(host);
    }
    return host;
  }

  function getHost() {
    return document.getElementById(HOST_ID) || createHost();
  }

  function isLiveRoomPage() {
    return /^\/(?:blanc\/)?\d+(?:\/|$)/.test(location.pathname);
  }

  function resetAreaState() {
    state.roomId = '';
    state.infoKey = '';
    state.info = null;
    state.loadingRoomId = '';
  }

  function removeHost() {
    const host = document.getElementById(HOST_ID);
    if (host) {
      host.remove();
    }
  }

  function clearNode(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function appendText(node, className, text) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    node.appendChild(span);
    return span;
  }

  function appendAreaLink(node, text, href, title) {
    const link = document.createElement('a');
    link.className = 'blive-room-area-badge-link';
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = text;
    link.title = title || text;
    node.appendChild(link);
    return link;
  }

  function renderLoading(host) {
    delete host.dataset.bliveRoomAreaBadgeKey;
    host.removeAttribute('title');
    clearNode(host);
    appendText(host, 'blive-room-area-badge-label', '\u5206\u533a');
    appendText(host, 'blive-room-area-badge-status', '\u8bfb\u53d6\u4e2d');
  }

  function renderArea(host, info) {
    host.dataset.bliveRoomAreaBadgeKey = areaKey(info);
    clearNode(host);
    const liveTitle = normalizeLiveTitle(info.title || findTitleInPage());
    const areaTitle = `${info.parentAreaName || ''}${info.parentAreaName && info.areaName ? ' / ' : ''}${info.areaName || ''}`;
    host.title = [liveTitle, areaTitle].filter(Boolean).join(' \u00b7 ');

    if (liveTitle) {
      const titleNode = appendText(host, 'blive-room-title-text', liveTitle);
      titleNode.title = liveTitle;
      appendText(host, 'blive-room-title-sep', '|');
    }

    appendText(host, 'blive-room-area-badge-label', '\u5206\u533a');

    if (info.parentAreaName && info.parentAreaId) {
      appendAreaLink(
        host,
        info.parentAreaName,
        buildAreaUrl(info.parentAreaId, 0),
        info.parentAreaName
      );
    }

    if (info.parentAreaName && info.areaName) {
      appendText(host, 'blive-room-area-badge-sep', '/');
    }

    if (info.areaName && info.areaId) {
      appendAreaLink(
        host,
        info.areaName,
        buildAreaUrl(info.parentAreaId, info.areaId),
        `${info.parentAreaName || ''}${info.parentAreaName ? ' / ' : ''}${info.areaName}`
      );
      return;
    }

    appendText(
      host,
      'blive-room-area-badge-status',
      info.parentAreaName || info.areaName || '\u672a\u77e5'
    );
  }

  function renderUnavailable(host) {
    delete host.dataset.bliveRoomAreaBadgeKey;
    host.removeAttribute('title');
    clearNode(host);
    appendText(host, 'blive-room-area-badge-label', '\u5206\u533a');
    appendText(host, 'blive-room-area-badge-status', '\u6682\u672a\u83b7\u53d6');
  }

  function withTitleFallback(info) {
    if (!info || info.title) {
      return info;
    }
    const title = findTitleInPage();
    return title ? { ...info, title } : info;
  }

  function findTitleInPage() {
    const domTitle = firstVisibleText([
      '.bili-dyn-card-live__title.bili-ellipsis.fs-medium',
      '.bili-dyn-card-live__title',
      '[class*="bili-dyn-card-live__title"]',
      '#head-info-vm [class*="room-title"]',
      '#head-info-vm [class*="live-title"]',
      '.room-title',
      '[class*="room-title"]',
      '[class*="live-title"]'
    ]);
    if (domTitle) {
      return domTitle;
    }
    return titleFromDocumentTitle(document.title);
  }

  function firstVisibleText(selectors) {
    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        if (!isVisibleBox(node)) {
          continue;
        }
        const text = normalizeLiveTitle(node.textContent || node.getAttribute('title'));
        if (text) {
          return text;
        }
      }
    }
    return '';
  }

  function titleFromDocumentTitle(text) {
    const title = normalizeLiveTitle(text)
      .replace(/\s*-\s*\u54d4\u54e9\u54d4\u54e9\u76f4\u64ad.*$/, '')
      .replace(/\s*-\s*[^-]+$/, '');
    return normalizeLiveTitle(title);
  }

  function normalizeLiveTitle(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function buildAreaUrl(parentAreaId, areaId) {
    const url = new URL(AREA_PAGE_URL);
    url.searchParams.set('parentAreaId', String(parentAreaId || 0));
    url.searchParams.set('areaId', String(areaId || 0));
    return url.href;
  }

  function isVisibleBox(node) {
    if (!node || !node.getBoundingClientRect) {
      return false;
    }
    const rect = node.getBoundingClientRect();
    return rect.width > 20 && rect.height > 10;
  }

  function waitForElement(getElement, exec, timeout = 10000, onDone) {
    const immediate = getElement();
    if (immediate) {
      exec(immediate);
      if (onDone) {
        onDone();
      }
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const node = getElement();
      if (node) {
        window.clearInterval(timer);
        exec(node);
        if (onDone) {
          onDone();
        }
        return;
      }
      if (Date.now() - startedAt >= timeout) {
        window.clearInterval(timer);
        if (onDone) {
          onDone();
        }
      }
    }, 100);
    return timer;
  }

  function waitForQuery(selector, exec, timeout = 10000, onDone) {
    return waitForElement(() => document.querySelector(selector), exec, timeout, onDone);
  }

  function waitForHeaderMount() {
    if (state.headerWaitTimer) {
      return;
    }
    state.headerWaitTimer = waitForQuery(
      HEADER_MOUNT_SELECTOR,
      () => scheduleAttach(),
      10000,
      () => {
        state.headerWaitTimer = 0;
      }
    ) || 0;
  }

  function findHeaderMount() {
    return document.querySelector(HEADER_MOUNT_SELECTOR);
  }

  function findHeaderInsertBefore(mount) {
    const rightModules = document.querySelector(HEADER_RIGHT_MODULES_SELECTOR);
    return rightModules && rightModules.parentElement === mount ? rightModules : null;
  }

  function attachHost() {
    if (!isLiveRoomPage()) {
      removeHost();
      return;
    }

    ensureStyle();
    if (!state.infoKey || !state.info) {
      removeHost();
      return;
    }
    const host = getHost();
    host.classList.remove('blive-room-area-badge-hidden');

    const headerMount = findHeaderMount();
    if (!headerMount) {
      removeHost();
      waitForHeaderMount();
      return;
    }

    host.className = 'blive-room-area-badge-static';
    host.style.left = '';
    host.style.top = '';
    const before = findHeaderInsertBefore(headerMount);
    if (before) {
      if (host.parentElement !== headerMount || host.nextSibling !== before) {
        headerMount.insertBefore(host, before);
      }
      return;
    }
    if (host.parentElement !== headerMount || host.nextSibling) {
      headerMount.appendChild(host);
    }
  }

  function scheduleAttach() {
    if (state.attachTimer) {
      return;
    }
    state.attachTimer = window.requestAnimationFrame(() => {
      state.attachTimer = 0;
      attachHost();
    });
  }

  function detectRoomId() {
    const urlId = getRoomIdFromUrl(location.href);
    if (urlId) {
      return urlId;
    }

    const frameId = getRoomIdFromFrames();
    if (frameId) {
      return frameId;
    }

    const stateId = getRoomIdFromKnownState();
    if (stateId) {
      return stateId;
    }

    return getRoomIdFromMeta();
  }

  function getRoomIdFromUrl(href) {
    try {
      const url = new URL(href);
      for (const key of ['room_id', 'roomid', 'roomId', 'id']) {
        const value = url.searchParams.get(key);
        if (isRoomId(value)) {
          return String(value);
        }
      }
      const match = url.pathname.match(/\/(?:blanc\/)?(\d+)(?:\/|$)/);
      if (match && isRoomId(match[1])) {
        return match[1];
      }
    } catch (error) {
      return '';
    }
    return '';
  }

  function getRoomIdFromFrames() {
    const frames = document.querySelectorAll('iframe[src*="/blanc/"], iframe[src*="room_id"], iframe[src*="roomid"]');
    for (const frame of frames) {
      const roomId = getRoomIdFromUrl(frame.src || '');
      if (roomId) {
        return roomId;
      }
    }
    return '';
  }

  function getRoomIdFromKnownState() {
    const candidates = [
      window.__NEPTUNE_IS_MY_WAIFU__,
      window.__INITIAL_STATE__,
      window.__BILIBILI_LIVE_ROOM_INIT__,
      window.__ROOM_INFO__
    ];
    for (const candidate of candidates) {
      const roomId = findRoomId(candidate, 0, new Set());
      if (roomId) {
        return roomId;
      }
    }
    return '';
  }

  function getRoomIdFromMeta() {
    const candidates = [
      document.querySelector('meta[property="og:url"]')?.content,
      document.querySelector('link[rel="canonical"]')?.href
    ];
    for (const href of candidates) {
      const roomId = getRoomIdFromUrl(href || '');
      if (roomId) {
        return roomId;
      }
    }
    return '';
  }

  function isRoomId(value) {
    return /^\d{1,12}$/.test(String(value || ''));
  }

  function findRoomId(value, depth, seen) {
    if (!value || depth > 5) {
      return '';
    }
    if (typeof value !== 'object') {
      return '';
    }
    if (seen.has(value)) {
      return '';
    }
    seen.add(value);

    for (const key of ['room_id', 'roomid', 'roomId', 'short_id']) {
      if (isRoomId(value[key])) {
        return String(value[key]);
      }
    }

    for (const key of ['data', 'room_info', 'roomInfo', 'roomInitRes', 'initInfo', 'room']) {
      const roomId = findRoomId(value[key], depth + 1, seen);
      if (roomId) {
        return roomId;
      }
    }

    return '';
  }

  function findAreaInKnownState() {
    const candidates = [
      window.__NEPTUNE_IS_MY_WAIFU__,
      window.__INITIAL_STATE__,
      window.__BILIBILI_LIVE_ROOM_INIT__,
      window.__ROOM_INFO__
    ];
    for (const candidate of candidates) {
      const info = findAreaObject(candidate, 0, new Set());
      if (info) {
        return info;
      }
    }
    return null;
  }

  function findAreaObject(value, depth, seen) {
    if (!value || depth > 6 || typeof value !== 'object') {
      return null;
    }
    if (seen.has(value)) {
      return null;
    }
    seen.add(value);

    const ownInfo = normalizeAreaInfo(value);
    if (ownInfo) {
      return ownInfo;
    }

    const priorityKeys = [
      'room_info',
      'roomInfo',
      'data',
      'room',
      'base_info',
      'baseInfo',
      'roomInitRes',
      'initInfo'
    ];
    for (const key of priorityKeys) {
      const info = findAreaObject(value[key], depth + 1, seen);
      if (info) {
        return info;
      }
    }

    if (depth >= 3) {
      return null;
    }

    for (const key of Object.keys(value).slice(0, 80)) {
      if (priorityKeys.includes(key)) {
        continue;
      }
      const info = findAreaObject(value[key], depth + 1, seen);
      if (info) {
        return info;
      }
    }

    return null;
  }

  function normalizeAreaInfo(source) {
    if (!source || typeof source !== 'object') {
      return null;
    }

    const areaName = pickString(source, ['area_name', 'areaName', 'area_v2_name', 'areaV2Name']);
    const parentAreaName = pickString(source, [
      'parent_area_name',
      'parentAreaName',
      'parent_name',
      'parentName',
      'area_v2_parent_name',
      'areaV2ParentName'
    ]);
    const areaId = pickId(source, ['area_id', 'areaId', 'area_v2_id', 'areaV2Id']);
    const parentAreaId = pickId(source, [
      'parent_area_id',
      'parentAreaId',
      'parent_id',
      'parentId',
      'area_v2_parent_id',
      'areaV2ParentId'
    ]);
    const title = normalizeLiveTitle(pickString(source, [
      'title',
      'room_title',
      'roomTitle',
      'live_title',
      'liveTitle'
    ]));

    if (!areaName && !parentAreaName) {
      return null;
    }

    return {
      areaName,
      parentAreaName,
      areaId,
      parentAreaId,
      title,
      roomId: pickId(source, ['room_id', 'roomid', 'roomId', 'id'])
    };
  }

  function pickString(source, keys) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  function pickId(source, keys) {
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  async function fetchJson(url) {
    const response = await fetch(url.href, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  }

  async function fetchAreaByEndpoint(baseUrl, paramName, roomId) {
    const url = new URL(baseUrl);
    url.searchParams.set(paramName, roomId);
    const payload = await fetchJson(url);
    if (payload && payload.code !== 0) {
      return null;
    }
    return findAreaObject(payload, 0, new Set());
  }

  async function fetchResolvedRoomId(roomId) {
    const url = new URL(API_ROOM_INIT);
    url.searchParams.set('id', roomId);
    const payload = await fetchJson(url);
    if (!payload || payload.code !== 0 || !payload.data) {
      return '';
    }
    const resolved = payload.data.room_id || payload.data.roomid || payload.data.id;
    return isRoomId(resolved) ? String(resolved) : '';
  }

  async function loadAreaInfo(roomId) {
    const attempts = [
      () => fetchAreaByEndpoint(API_ROOM_GET_INFO, 'room_id', roomId),
      () => fetchAreaByEndpoint(API_GET_INFO_BY_ROOM, 'room_id', roomId)
    ];

    let resolvedRoomId = '';
    attempts.push(async () => {
      resolvedRoomId = await fetchResolvedRoomId(roomId);
      if (!resolvedRoomId || resolvedRoomId === roomId) {
        return null;
      }
      return fetchAreaByEndpoint(API_ROOM_GET_INFO, 'room_id', resolvedRoomId);
    });
    attempts.push(async () => {
      if (!resolvedRoomId || resolvedRoomId === roomId) {
        return null;
      }
      return fetchAreaByEndpoint(API_GET_INFO_BY_ROOM, 'room_id', resolvedRoomId);
    });

    for (const attempt of attempts) {
      try {
        const info = await attempt();
        if (info) {
          return info;
        }
      } catch (error) {
        // Try the next public room endpoint; Bilibili changes response shapes occasionally.
      }
    }

    return findAreaInKnownState();
  }

  function areaKey(info) {
    if (!info) {
      return '';
    }
    return [
      info.parentAreaId,
      info.parentAreaName,
      info.areaId,
      info.areaName,
      info.title
    ].join('|');
  }

  function scheduleRefresh(delay) {
    if (state.refreshTimer) {
      return;
    }
    state.refreshTimer = window.setTimeout(() => {
      state.refreshTimer = 0;
      refreshArea();
    }, delay || 0);
  }

  async function refreshArea() {
    if (!isLiveRoomPage()) {
      resetAreaState();
      removeHost();
      return;
    }

    const roomId = detectRoomId();

    if (!roomId) {
      const fromState = withTitleFallback(findAreaInKnownState());
      if (fromState) {
        const key = areaKey(fromState);
        const host = getHost();
        if (key !== state.infoKey || host.dataset.bliveRoomAreaBadgeKey !== key) {
          state.infoKey = key;
          state.info = fromState;
          renderArea(host, fromState);
          scheduleAttach();
        }
        return;
      }
      if (!state.infoKey) {
        removeHost();
      }
      scheduleRefresh(RETRY_MS);
      return;
    }

    if (state.loadingRoomId === roomId) {
      return;
    }
    if (state.roomId !== roomId) {
      state.roomId = roomId;
      if (!state.infoKey) {
        removeHost();
      }
    }

    state.loadingRoomId = roomId;
    try {
      const info = withTitleFallback(await loadAreaInfo(roomId));
      state.loadingRoomId = '';
      if (!info) {
        if (!state.infoKey) {
          removeHost();
        }
        scheduleRefresh(SLOW_RECHECK_MS);
        return;
      }

      const key = areaKey(info);
      const host = getHost();
      if (key !== state.infoKey || host.dataset.bliveRoomAreaBadgeKey !== key) {
        state.infoKey = key;
        state.info = info;
        renderArea(host, info);
        scheduleAttach();
      }
    } catch (error) {
      state.loadingRoomId = '';
      if (!state.infoKey) {
        removeHost();
      }
      scheduleRefresh(SLOW_RECHECK_MS);
    }
  }

  function watchUrlChange() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function pushState() {
      const result = originalPushState.apply(this, arguments);
      handleMaybeUrlChange();
      return result;
    };

    history.replaceState = function replaceState() {
      const result = originalReplaceState.apply(this, arguments);
      handleMaybeUrlChange();
      return result;
    };

    window.addEventListener('popstate', handleMaybeUrlChange);
    window.addEventListener('hashchange', handleMaybeUrlChange);
  }

  function handleMaybeUrlChange() {
    window.setTimeout(() => {
      if (state.lastPath === location.href) {
        return;
      }
      state.lastPath = location.href;
      resetAreaState();
      if (!isLiveRoomPage()) {
        removeHost();
        return;
      }
      removeHost();
      waitForHeaderMount();
      scheduleAttach();
      scheduleRefresh();
    }, 0);
  }

  function bindObservers() {
    const observer = new MutationObserver(() => {
      if (!isLiveRoomPage()) {
        removeHost();
        return;
      }
      scheduleAttach();
      if (!state.roomId || !state.infoKey) {
        scheduleRefresh(250);
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    window.addEventListener('resize', () => {
      if (!isLiveRoomPage()) {
        removeHost();
        return;
      }
      scheduleAttach();
    });
    document.addEventListener('fullscreenchange', () => {
      if (!isLiveRoomPage()) {
        removeHost();
        return;
      }
      const host = getHost();
      host.classList.toggle('blive-room-area-badge-hidden', Boolean(document.fullscreenElement));
    });

    state.slowTimer = window.setInterval(() => {
      if (!isLiveRoomPage()) {
        removeHost();
        return;
      }
      scheduleAttach();
      const roomId = detectRoomId();
      if (roomId && roomId !== state.roomId) {
        scheduleRefresh();
      }
    }, SLOW_RECHECK_MS);
  }

  function init() {
    ensureStyle();
    waitForHeaderMount();
    attachHost();
    refreshArea();
    watchUrlChange();
    bindObservers();
    console.info('[blive-room-area-badge] active', {
      version: VERSION,
      href: location.href
    });
  }

  init();
})();
