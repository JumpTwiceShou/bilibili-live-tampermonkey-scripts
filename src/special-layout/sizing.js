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
      doc.querySelector('iframe[src*="/blanc/"]')
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
    const cachedValue = playerRoot.dataset[DATA_KEY];
    if (cachedValue !== undefined) {
      return Math.max(0, Number(cachedValue) || 0);
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

  function getNormalRoomAsideGap(viewportWidth) {
    if (viewportWidth >= 2560) {
      return 432;
    }
    if (viewportWidth >= 1440) {
      return 392;
    }
    return 332;
  }

  function getNormalRoomPlayerWidth(win) {
    const viewportWidth = win.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = win.innerHeight || document.documentElement.clientHeight || 0;
    const asideGap = getNormalRoomAsideGap(viewportWidth);
    const asideWidth = viewportWidth >= 2560 ? 420 : (viewportWidth >= 1440 ? 380 : 320);
    const heightBoundBodyWidth =
      ((viewportHeight - NORMAL_ROOM_VERTICAL_RESERVED) * 16 / 9) +
      asideWidth +
      NORMAL_ROOM_EXTRA_GUTTER;
    const widthBoundBodyWidth = viewportWidth - NORMAL_ROOM_VIEWPORT_GUTTER;
    const bodyWidth = Math.min(
      NORMAL_ROOM_MAX_BODY_WIDTH,
      Math.max(
        NORMAL_ROOM_MIN_BODY_WIDTH,
        Math.min(heightBoundBodyWidth, widthBoundBodyWidth)
      )
    );
    const availableWidth = Math.max(1, viewportWidth - VIEWPORT_EDGE_GUTTER);
    return Math.min(
      availableWidth,
      Math.max(320, Math.round((bodyWidth - asideGap) * SPECIAL_PLAYER_SIZE_RATIO))
    );
  }

  function getBaseVideoMetrics(playerRoot, videoArea) {
    let width = Number(playerRoot.dataset[BASE_WIDTH_KEY] || 0);
    let ratio = Number(playerRoot.dataset[BASE_RATIO_KEY] || 0);
    if (!(width > 0) || !(ratio > 0)) {
      width = videoArea.offsetWidth;
      const height = videoArea.offsetHeight;
      if (!(width > 0) || !(height > 0)) {
        return null;
      }
      ratio = height / width;
      playerRoot.dataset[BASE_WIDTH_KEY] = String(width);
      playerRoot.dataset[BASE_RATIO_KEY] = String(ratio);
    }
    return { width, ratio };
  }

  function calculateTargetPlayerSize(viewportWidth, shellExtraWidth, baseMetrics, desiredWidth) {
    const safeViewportWidth = Math.max(0, Number(viewportWidth) || 0);
    const safeShellExtraWidth = Math.max(0, Number(shellExtraWidth) || 0);
    const availableWidth = Math.max(
      1,
      safeViewportWidth - VIEWPORT_EDGE_GUTTER - safeShellExtraWidth
    );
    const baseWidth = Math.max(1, Number(baseMetrics.width) || 1);
    const ratio = Math.max(0.01, Number(baseMetrics.ratio) || 9 / 16);
    const preferredWidth = Math.max(1, Number(desiredWidth) || 1);
    const width = Math.round(Math.min(
      availableWidth,
      Math.max(Math.min(baseWidth, availableWidth), preferredWidth)
    ));
    return {
      availableWidth,
      width,
      height: Math.round(width * ratio),
      shellWidth: Math.round(width + safeShellExtraWidth)
    };
  }
