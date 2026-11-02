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
      '#head-info-vm .bili-dyn-card-live__title',
      '#head-info-vm [class*="room-title"]',
      '#head-info-vm [class*="live-title"]',
      '#head-info-vm .room-title'
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
