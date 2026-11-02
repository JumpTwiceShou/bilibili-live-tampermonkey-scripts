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
    const asLink = (value) => typeof value === 'string' && /^(?:https?:\/\/|\/\/|\/(?!\/))/i.test(value.trim())
      ? normalizeHttpUrl(value.trim()) : '';
    const walk = (value, depth) => {
      if (!value || depth > 8) {
        return '';
      }
      if (typeof value === 'string') {
        return depth === 0 ? asLink(value) : '';
      }
      if (typeof value !== 'object' || visited.has(value)) {
        return '';
      }
      visited.add(value);
      for (const key of preferredKeys) {
        const preferred = asLink(value[key]);
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

  async function fetchJson(url, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
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
      signal?.removeEventListener('abort', abort);
    }
  }

  async function fetchSidebarPayload(signal) {
    const [followResult, labsResult] = await Promise.allSettled([
      fetchJson(LIVE_FOLLOW_URL, signal),
      fetchJson(LAB_URL, signal)
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
