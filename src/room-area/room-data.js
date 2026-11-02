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
