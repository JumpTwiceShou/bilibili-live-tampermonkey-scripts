// ==UserScript==
// @name         Bilibili Live Room Area Badge
// @name:zh-CN   B站直播间标题与分区显示
// @namespace    https://live.bilibili.com/
// @version      1.1.1
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

  /* @include ../shared/lifecycle.js */

  const VERSION = '1.1.1';
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
  let roomRuntime = null;

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

  /* @include title.js */

  /* @include mount.js */

  /* @include room-data.js */

  /* @include controller.js */

  init();
})();
