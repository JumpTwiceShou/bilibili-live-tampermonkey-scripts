  function applyTopLayout(doc) {
    const playerRoot = doc.querySelector('.live-non-revenue-player');
    if (!isSpecialTopPage(doc) || !playerRoot || !playerRoot.parentElement) {
      return false;
    }

    if (syncEmbeddedWebFullscreenState(doc, playerRoot)) {
      return false;
    }

    const host = playerRoot.parentElement;
    const videoArea =
      playerRoot.querySelector('.live-player-bg') ||
      playerRoot.querySelector('.player iframe') ||
      playerRoot.querySelector('.player');
    const player = playerRoot.querySelector('.player');
    const playerInner = player ? player.firstElementChild : null;
    const iframe = player ? player.querySelector('iframe') : null;
    const handleBar = playerRoot.querySelector('.live-player-handle-bar');

    if (!videoArea) {
      return false;
    }

    const baseMetrics = getBaseVideoMetrics(playerRoot, videoArea);
    if (!baseMetrics) {
      return false;
    }

    const shellExtraWidth = getShellExtraWidth(playerRoot);
    const viewportWidth = window.innerWidth || doc.documentElement.clientWidth || 0;
    const targetSize = calculateTargetPlayerSize(
      viewportWidth,
      shellExtraWidth,
      baseMetrics,
      getNormalRoomPlayerWidth(window)
    );
    const targetWidth = targetSize.width;
    const targetHeight = targetSize.height;
    const targetShellWidth = targetSize.shellWidth;
    const handleBarWidth = targetWidth;
    const handleBarHeight = handleBar && getComputedStyle(handleBar).display !== 'none'
      ? Math.round(handleBar.getBoundingClientRect().height)
      : 0;

    host.classList.add(HOST_CLASS);
    playerRoot.classList.add(ROOT_CLASS);

    doc.documentElement.style.setProperty('--blive-special-player-width', `${targetWidth}px`);
    doc.documentElement.style.setProperty('--blive-special-player-height', `${targetHeight}px`);
    doc.documentElement.style.setProperty('--blive-special-list-width', `${handleBarWidth}px`);

    host.style.setProperty('width', `${targetShellWidth}px`, 'important');
    host.style.setProperty('max-width', 'none', 'important');
    host.style.setProperty('overflow', 'visible', 'important');
    host.style.setProperty('margin-left', 'auto', 'important');
    host.style.setProperty('margin-right', 'auto', 'important');
    host.style.setProperty('align-self', 'center', 'important');

    playerRoot.style.setProperty('width', `${targetWidth}px`, 'important');
    playerRoot.style.setProperty('max-width', 'none', 'important');
    playerRoot.style.setProperty('height', `${targetHeight + handleBarHeight}px`, 'important');
    playerRoot.style.setProperty('overflow', 'visible', 'important');
    playerRoot.style.setProperty('margin-left', 'auto', 'important');
    playerRoot.style.setProperty('margin-right', 'auto', 'important');

    if (handleBar) {
      handleBar.style.setProperty('width', `${handleBarWidth}px`, 'important');
      handleBar.style.setProperty('max-width', `${handleBarWidth}px`, 'important');
      handleBar.style.setProperty('margin-left', 'auto', 'important');
      handleBar.style.setProperty('margin-right', 'auto', 'important');
    }

    videoArea.style.setProperty('width', `${targetWidth}px`, 'important');
    videoArea.style.setProperty('height', `${targetHeight}px`, 'important');
    videoArea.style.setProperty('margin-left', 'auto', 'important');
    videoArea.style.setProperty('margin-right', 'auto', 'important');

    if (player) {
      player.style.setProperty('width', `${targetWidth}px`, 'important');
      player.style.setProperty('height', `${targetHeight}px`, 'important');
      player.style.setProperty('margin-left', 'auto', 'important');
      player.style.setProperty('margin-right', 'auto', 'important');
    }
    if (playerInner) {
      playerInner.style.setProperty('width', '100%', 'important');
      playerInner.style.setProperty('height', '100%', 'important');
    }
    if (iframe) {
      iframe.style.setProperty('width', `${targetWidth}px`, 'important');
      iframe.style.setProperty('height', `${targetHeight}px`, 'important');
      iframe.style.setProperty('margin-left', 'auto', 'important');
      iframe.style.setProperty('margin-right', 'auto', 'important');
    }
    return true;
  }

  function scheduleApplyLayout(doc) {
    if (rafId) {
      return;
    }
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      applyTopLayout(doc);
    });
  }
