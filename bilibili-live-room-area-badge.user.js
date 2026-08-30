// ==UserScript==
// @name         Bilibili Live Room Area Badge
// @name:zh-CN   B站直播间标题与分区显示
// @namespace    https://live.bilibili.com/
// @version      1.1
// @description  Show the current live room title and area near the room header, with links to the parent and child live area pages.
// @description:zh-CN 在 B 站直播间标题栏重新显示直播标题、父分区和子分区，并为分区添加跳转链接。
// @match        https://live.bilibili.com/*
// @exclude      https://live.bilibili.com/p/*
// @run-at       document-idle
// @grant        none
// @license      GPL-3.0-only
// @supportURL   https://github.com/JumpTwiceShou/bilibili-live-tampermonkey-scripts/issues
// ==/UserScript==

(function () {
  'use strict';

  const VERSION = '1.1';
  const STYLE_ID = 'blive-room-area-badge-style';
  const HOST_ID = 'blive-room-area-badge-host';
  const API_ROOM_GET_INFO = 'https://api.live.bilibili.com/room/v1/Room/get_info';
  const API_GET_INFO_BY_ROOM = 'https://api.live.bilibili.com/xlive/web-room/v1/index/getInfoByRoom';
  const API_ROOM_INIT = 'https://api.live.bilibili.com/room/v1/Room/room_init';
  const AREA_PAGE_URL = 'https://live.bilibili.com/p/eden/area-tags';
  const HEADER_MOUNT_SELECTOR = '#head-info-vm .normal-row-ctnr';
  const HEADER_RIGHT_MODULES_SELECTOR = '#head-info-vm .right-fixed-modules';
  const SOCIAL_ANCHOR_SELECTORS = [
    '.follow-ctnr',
    '[class*="follow-ctnr"]',
    '[class*="follow-btn"]',
    '[class*="attention"]',
    '[class*="fans"]',
    '[class*="fan-medal"]',
    '[class*="medal"]',
    '[class*="guard"]',
    '[class*="sailing"]',
    '[title*="关注"]',
    '[title*="粉丝"]',
    '[title*="大航海"]',
    '[aria-label*="关注"]',
    '[aria-label*="粉丝"]',
    '[aria-label*="大航海"]'
  ];
  const SOCIAL_ANCHOR_KEYWORDS = ['关注', '粉丝', '大航海', '航海'];
  const SOCIAL_ANCHOR_SELECTOR = SOCIAL_ANCHOR_SELECTORS.join(',');
  const HEADER_INTERACTIVE_SELECTOR = 'button, a, [role="button"]';
  const RETRY_MS = 1500;
  const SLOW_RECHECK_MS = 8000;
  const INFO_RECHECK_MS = 60000;
  const REQUEST_TIMEOUT_MS = 12000;

  const state = {
    roomId: '',
    infoKey: '',
    info: null,
    loadingRoomId: '',
    attachTimer: 0,
    mountWaitTimer: 0,
    refreshTimer: 0,
    refreshDueAt: 0,
    slowTimer: 0,
    requestId: 0,
    requestController: null,
    lastInfoAt: 0,
    lastPath: location.href
  };

  if (!isLiveRoomPage() || isSpecialTopShell()) {
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
  cursor: text;
  font-weight: 500;
  text-overflow: ellipsis;
  -webkit-user-select: text;
  user-select: text;
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

  function isSpecialTopShell() {
    return window.top === window
      && Boolean(document.querySelector('.live-non-revenue-player'))
      && !document.querySelector(HEADER_MOUNT_SELECTOR);
  }

  function cancelAreaRequest() {
    state.requestId += 1;
    if (state.requestController) {
      state.requestController.abort();
      state.requestController = null;
    }
    state.loadingRoomId = '';
  }

  function resetAreaState() {
    cancelAreaRequest();
    state.roomId = '';
    state.infoKey = '';
    state.info = null;
    state.lastInfoAt = 0;
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
        if (node.closest(`#${HOST_ID}`)) {
          continue;
        }
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

  function waitForMount() {
    if (state.mountWaitTimer) {
      return;
    }
    state.mountWaitTimer = waitForElement(
      findMount,
      () => scheduleAttach(),
      10000,
      () => {
        state.mountWaitTimer = 0;
      }
    ) || 0;
  }

  function findMount() {
    const headerMount = document.querySelector(HEADER_MOUNT_SELECTOR);
    if (headerMount) {
      return {
        node: headerMount,
        type: 'header'
      };
    }

    return null;
  }

  function findHeaderInsertBefore(mount) {
    const rightModules = document.querySelector(HEADER_RIGHT_MODULES_SELECTOR);
    return rightModules && rightModules.parentElement === mount ? rightModules : null;
  }

  function findHeaderSocialAnchor(mount, host) {
    const rightModules = document.querySelector(HEADER_RIGHT_MODULES_SELECTOR);
    const candidates = [];
    for (const node of mount.querySelectorAll(SOCIAL_ANCHOR_SELECTOR)) {
      addSocialAnchorCandidate(candidates, mount, host, rightModules, node);
    }

    const keywordNodes = mount.querySelectorAll(HEADER_INTERACTIVE_SELECTOR);
    for (const current of keywordNodes) {
      const text = compactText(current.textContent || current.getAttribute('title') || current.getAttribute('aria-label'));
      if (SOCIAL_ANCHOR_KEYWORDS.some((keyword) => text.includes(keyword))) {
        addSocialAnchorCandidate(candidates, mount, host, rightModules, current);
      }
    }

    candidates.sort((left, right) => {
      if (left === right) {
        return 0;
      }
      return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    return candidates[candidates.length - 1] || null;
  }

  function addSocialAnchorCandidate(candidates, mount, host, rightModules, node) {
    const candidate = normalizeSocialAnchor(node, mount);
    if (
      !candidate ||
      candidate === host ||
      host.contains(candidate) ||
      candidate.contains(host) ||
      candidates.includes(candidate) ||
      !mount.contains(candidate) ||
      !isVisibleBox(candidate)
    ) {
      return;
    }
    if (rightModules && (rightModules === candidate || rightModules.contains(candidate))) {
      return;
    }
    candidates.push(candidate);
  }

  function normalizeSocialAnchor(node, mount) {
    if (!node || node === mount) {
      return null;
    }
    const anchored = node.closest([
      '.follow-ctnr',
      '[class*="follow-ctnr"]',
      '[class*="follow-btn"]',
      '[class*="attention"]',
      '[class*="fans"]',
      '[class*="fan-medal"]',
      '[class*="medal"]',
      '[class*="guard"]',
      '[class*="sailing"]',
      'button',
      'a',
      '[role="button"]'
    ].join(','));
    return anchored && mount.contains(anchored) ? anchored : node;
  }

  function compactText(text) {
    return String(text || '').replace(/\s+/g, '');
  }

  function findInsertSlot(mountInfo, host) {
    const mount = mountInfo.node;
    const socialAnchor = findHeaderSocialAnchor(mount, host);
    if (socialAnchor && socialAnchor.parentElement) {
      let before = socialAnchor.nextSibling;
      while (before === host) {
        before = before.nextSibling;
      }
      return {
        parent: socialAnchor.parentElement,
        before
      };
    }
    return {
      parent: mount,
      before: mountInfo.type === 'header' ? findHeaderInsertBefore(mount) : null
    };
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

    const mountInfo = findMount();
    if (!mountInfo) {
      removeHost();
      waitForMount();
      return;
    }

    host.className = 'blive-room-area-badge-static';
    host.dataset.bliveRoomAreaBadgeMount = mountInfo.type;
    host.style.left = '';
    host.style.top = '';
    const slot = findInsertSlot(mountInfo, host);
    if (host.parentElement !== slot.parent || host.nextSibling !== slot.before) {
      slot.parent.insertBefore(host, slot.before);
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

  async function fetchJson(url, signal) {
    const response = await fetch(url.href, {
      credentials: 'include',
      cache: 'no-store',
      signal
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  }

  async function fetchAreaByEndpoint(baseUrl, paramName, roomId, signal) {
    const url = new URL(baseUrl);
    url.searchParams.set(paramName, roomId);
    const payload = await fetchJson(url, signal);
    if (payload && payload.code !== 0) {
      return null;
    }
    return findAreaObject(payload, 0, new Set());
  }

  async function fetchResolvedRoomId(roomId, signal) {
    const url = new URL(API_ROOM_INIT);
    url.searchParams.set('id', roomId);
    const payload = await fetchJson(url, signal);
    if (!payload || payload.code !== 0 || !payload.data) {
      return '';
    }
    const resolved = payload.data.room_id || payload.data.roomid || payload.data.id;
    return isRoomId(resolved) ? String(resolved) : '';
  }

  async function loadAreaInfo(roomId, signal) {
    const attempts = [
      () => fetchAreaByEndpoint(API_ROOM_GET_INFO, 'room_id', roomId, signal),
      () => fetchAreaByEndpoint(API_GET_INFO_BY_ROOM, 'room_id', roomId, signal)
    ];

    let resolvedRoomId = '';
    attempts.push(async () => {
      resolvedRoomId = await fetchResolvedRoomId(roomId, signal);
      if (!resolvedRoomId || resolvedRoomId === roomId) {
        return null;
      }
      return fetchAreaByEndpoint(API_ROOM_GET_INFO, 'room_id', resolvedRoomId, signal);
    });
    attempts.push(async () => {
      if (!resolvedRoomId || resolvedRoomId === roomId) {
        return null;
      }
      return fetchAreaByEndpoint(API_GET_INFO_BY_ROOM, 'room_id', resolvedRoomId, signal);
    });

    for (const attempt of attempts) {
      try {
        const info = await attempt();
        if (info) {
          return info;
        }
      } catch (error) {
        if (signal && signal.aborted) {
          throw error;
        }
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
    const wait = Math.max(0, Number(delay) || 0);
    const dueAt = Date.now() + wait;
    if (state.refreshTimer) {
      if (dueAt >= state.refreshDueAt) {
        return;
      }
      window.clearTimeout(state.refreshTimer);
    }
    state.refreshDueAt = dueAt;
    state.refreshTimer = window.setTimeout(() => {
      state.refreshTimer = 0;
      state.refreshDueAt = 0;
      refreshArea();
    }, wait);
  }

  function ownsAreaRequest(requestId, roomId, controller) {
    return state.requestId === requestId
      && state.roomId === roomId
      && state.requestController === controller;
  }

  function isCurrentAreaRequest(requestId, roomId, controller) {
    return ownsAreaRequest(requestId, roomId, controller)
      && !controller.signal.aborted
      && isLiveRoomPage()
      && detectRoomId() === roomId;
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
          state.lastInfoAt = Date.now();
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
    if (state.roomId && state.roomId !== roomId) {
      resetAreaState();
      removeHost();
    }
    state.roomId = roomId;

    if (state.requestController) {
      cancelAreaRequest();
    }
    const controller = new AbortController();
    const requestId = state.requestId + 1;
    state.requestId = requestId;
    state.requestController = controller;
    state.loadingRoomId = roomId;
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const info = withTitleFallback(await loadAreaInfo(roomId, controller.signal));
      if (!isCurrentAreaRequest(requestId, roomId, controller)) {
        return;
      }
      state.loadingRoomId = '';
      state.requestController = null;
      if (!info) {
        if (!state.infoKey) {
          removeHost();
        }
        scheduleRefresh(SLOW_RECHECK_MS);
        return;
      }

      const key = areaKey(info);
      state.infoKey = key;
      state.info = info;
      state.lastInfoAt = Date.now();
      const host = getHost();
      if (host.dataset.bliveRoomAreaBadgeKey !== key) {
        renderArea(host, info);
      }
      if (!host.isConnected || host.dataset.bliveRoomAreaBadgeKey !== key) {
        scheduleAttach();
      }
    } catch (error) {
      if (
        !ownsAreaRequest(requestId, roomId, controller)
        || !isLiveRoomPage()
        || detectRoomId() !== roomId
      ) {
        return;
      }
      state.loadingRoomId = '';
      state.requestController = null;
      if (!state.infoKey) {
        removeHost();
      }
      scheduleRefresh(SLOW_RECHECK_MS);
    } finally {
      window.clearTimeout(timeout);
      if (ownsAreaRequest(requestId, roomId, controller) && controller.signal.aborted) {
        state.loadingRoomId = '';
        state.requestController = null;
        if (isLiveRoomPage() && detectRoomId() === roomId) {
          scheduleRefresh(SLOW_RECHECK_MS);
        }
      }
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
      waitForMount();
      scheduleAttach();
      scheduleRefresh();
    }, 0);
  }

  function refreshTitleFromPage() {
    if (!state.info) {
      return;
    }
    const title = findTitleInPage();
    if (!title || title === state.info.title) {
      return;
    }
    const info = { ...state.info, title };
    const key = areaKey(info);
    state.info = info;
    state.infoKey = key;
    const host = getHost();
    renderArea(host, info);
    scheduleAttach();
  }

  function nodeIsInHeader(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    return node.id === 'head-info-vm'
      || node.id === HOST_ID
      || Boolean(node.closest('#head-info-vm'));
  }

  function nodeContainsHeader(node) {
    return node instanceof Element
      && Boolean(node.querySelector(`#head-info-vm, #${HOST_ID}`));
  }

  function mutationsTouchHeader(records) {
    for (const record of records) {
      if (nodeIsInHeader(record.target)) {
        return true;
      }
      for (const node of record.addedNodes) {
        if (nodeIsInHeader(node) || nodeContainsHeader(node)) {
          return true;
        }
      }
      for (const node of record.removedNodes) {
        if (nodeIsInHeader(node) || nodeContainsHeader(node)) {
          return true;
        }
      }
    }
    return false;
  }

  function bindObservers() {
    const observer = new MutationObserver((records) => {
      if (!isLiveRoomPage()) {
        removeHost();
        return;
      }
      const touchesHeader = mutationsTouchHeader(records);
      if (touchesHeader) {
        scheduleAttach();
      }
      if (touchesHeader && !state.infoKey && !state.loadingRoomId) {
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
      const host = document.getElementById(HOST_ID);
      if (host) {
        host.classList.toggle('blive-room-area-badge-hidden', Boolean(document.fullscreenElement));
      }
    });

    state.slowTimer = window.setInterval(() => {
      if (!isLiveRoomPage()) {
        removeHost();
        return;
      }
      const roomId = detectRoomId();
      if (roomId && roomId !== state.roomId) {
        scheduleRefresh();
        return;
      }
      refreshTitleFromPage();
      if (state.info && Date.now() - state.lastInfoAt >= INFO_RECHECK_MS) {
        scheduleRefresh();
      }
      const host = document.getElementById(HOST_ID);
      const mountInfo = findMount();
      if (state.info && (!host || !mountInfo || !mountInfo.node.contains(host))) {
        scheduleAttach();
      }
    }, SLOW_RECHECK_MS);
  }

  function init() {
    ensureStyle();
    waitForMount();
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
