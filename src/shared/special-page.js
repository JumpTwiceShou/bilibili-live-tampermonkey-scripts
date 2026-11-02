  function isSpecialTopPage(doc) {
    if (window.top !== window) {
      return false;
    }
    const hasSpecialPlayer = Boolean(doc.querySelector('.live-non-revenue-player'));
    const hasHandleBar = Boolean(doc.querySelector('.live-player-handle-bar'));
    const hasPlayerBg = Boolean(doc.querySelector('.live-player-bg'));
    const hasBlancFrame = Boolean(doc.querySelector('iframe[src*="/blanc/"]'));
    const hasActivityRoot = Boolean(doc.querySelector('.rendererRoot, .layerWrapperRoot, [class*="pageRoot"]'));
    const hasNormalLayout = Boolean(doc.querySelector('.player-and-aside-area'));

    if (!hasSpecialPlayer) {
      return false;
    }

    if (hasBlancFrame && (hasHandleBar || hasPlayerBg)) {
      return true;
    }

    return !hasNormalLayout && hasActivityRoot && hasHandleBar && hasPlayerBg;
  }
