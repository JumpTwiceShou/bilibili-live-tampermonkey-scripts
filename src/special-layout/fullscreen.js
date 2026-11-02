  function getBlancFrame(doc) {
    return doc.querySelector('iframe[src*="/blanc/"]');
  }

  function getBlancFrameWindow(doc) {
    const frame = getBlancFrame(doc);
    if (!frame) {
      return null;
    }
    try {
      return frame.contentWindow || null;
    } catch (_err) {
      return null;
    }
  }

  function getBlancFrameDocument(doc) {
    const frameWindow = getBlancFrameWindow(doc);
    if (!frameWindow) {
      return null;
    }
    try {
      return frameWindow.document || null;
    } catch (_err) {
      return null;
    }
  }

  function getEmbeddedCtrlUi(doc) {
    const frameWindow = getBlancFrameWindow(doc);
    if (!frameWindow) {
      return null;
    }
    try {
      const playerInstance = (frameWindow.EmbedPlayer && frameWindow.EmbedPlayer.instance)
        || frameWindow.__PLAYER_GLOBAL_INSTANCE__ || null;
      if (!playerInstance || !playerInstance.ctrl || typeof playerInstance.ctrl.getCtrlUI !== 'function') return null;
      return playerInstance.ctrl.getCtrlUI() || null;
    } catch (_err) {
      return null;
    }
  }

  function hasWebFullscreenToken(value) {
    return /(web[\s_-]*full|full[\s_-]*web)/i.test(value || '');
  }

  function isEmbeddedWebFullscreenActive(doc) {
    const ctrlUi = getEmbeddedCtrlUi(doc);
    if (ctrlUi && ctrlUi.webFullScreenStatus === true) {
      return true;
    }

    const frameDoc = getBlancFrameDocument(doc);
    if (!frameDoc) {
      return false;
    }

    const classNames = [
      frameDoc.documentElement ? frameDoc.documentElement.className : '',
      frameDoc.body ? frameDoc.body.className : ''
    ].filter(Boolean).join(' ');
    if (hasWebFullscreenToken(classNames)) {
      return true;
    }

    const frameWindow = frameDoc.defaultView;
    const viewportWidth = frameWindow ? frameWindow.innerWidth : 0;
    const viewportHeight = frameWindow ? frameWindow.innerHeight : 0;
    const candidates = [
      frameDoc.querySelector('#fullscreen-container'),
      frameDoc.querySelector('.player-section'),
      frameDoc.querySelector('#live-player')
    ].filter(Boolean);

    return candidates.some((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (style.position === 'fixed' && rect.width >= viewportWidth * 0.7 && rect.height >= viewportHeight * 0.6) {
        return true;
      }
      return el.id === 'fullscreen-container'
        && rect.left <= 2
        && rect.top <= 2
        && rect.width >= viewportWidth * 0.95
        && rect.height >= viewportHeight * 0.75;
    });
  }

  function setSidebarHidden(doc, hidden) {
    const sidebarHost = doc.getElementById('blf-special-sidebar-host');
    if (!sidebarHost) {
      return;
    }
    if (hidden) {
      sidebarHost.style.setProperty('display', 'none', 'important');
      return;
    }
    sidebarHost.style.removeProperty('display');
  }

  function syncEmbeddedWebFullscreenState(doc, playerRoot) {
    const active = isEmbeddedWebFullscreenActive(doc);
    specialWebFullscreenActive = active;

    const style = doc.getElementById(STYLE_ID);
    if (style) {
      style.disabled = active;
    }

    doc.documentElement.classList.toggle('blive-special-webfs', active);
    setSidebarHidden(doc, active);

    if (active) {
      clearLayoutInlineSizes(playerRoot || doc.querySelector('.live-non-revenue-player'));
    }

    return active;
  }

  function cleanupTrackedFrameWatchers() {
    if (trackedBlancFrameDoc) {
      trackedBlancFrameDoc.removeEventListener('click', handleTrackedFrameInteraction, true);
      trackedBlancFrameDoc.removeEventListener('dblclick', handleTrackedFrameInteraction, true);
      trackedBlancFrameDoc = null;
    }
  }

  function cleanupRuntimeWatchers() {
    sidebarCleanup?.();
    sidebarCleanup = null;
    collapseCleanup?.();
    collapseCleanup = null;
    runtimeScope?.dispose();
    runtimeScope = null;
    if (webModePollTimer) {
      window.clearInterval(webModePollTimer);
      webModePollTimer = 0;
    }
    if (trackedBlancFrame && trackedBlancFrameLoadHandler) {
      trackedBlancFrame.removeEventListener('load', trackedBlancFrameLoadHandler);
    }
    trackedBlancFrame = null;
    trackedBlancFrameLoadHandler = null;
    cleanupTrackedFrameWatchers();
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    trackedPlayerRoot = null;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function handleTrackedFrameInteraction() {
    scheduleApplyLayout(document);
  }

  function bindTrackedFrameWatchers(doc) {
    const frameDoc = getBlancFrameDocument(doc);
    if (!frameDoc || frameDoc === trackedBlancFrameDoc) {
      return;
    }

    cleanupTrackedFrameWatchers();
    trackedBlancFrameDoc = frameDoc;
    trackedBlancFrameDoc.addEventListener('click', handleTrackedFrameInteraction, true);
    trackedBlancFrameDoc.addEventListener('dblclick', handleTrackedFrameInteraction, true);
  }

  function watchPlayerResize(doc) {
    const playerRoot = doc.querySelector('.live-non-revenue-player');
    if (playerRoot === trackedPlayerRoot) return false;
    trackedPlayerRoot = playerRoot;
    resizeObserver?.disconnect();
    if (!playerRoot) return true;
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        scheduleApplyLayout(doc);
      });
    } else {
      resizeObserver.disconnect();
    }
    resizeObserver.observe(playerRoot);
    return true;
  }

  function watchEmbeddedWebFullscreen(doc) {
    if (webModePollTimer) {
      return;
    }

    trackedBlancFrameLoadHandler = () => scheduleApplyLayout(doc);
    const bindTrackedFrame = () => {
      const frame = getBlancFrame(doc);
      if (frame === trackedBlancFrame) {
        bindTrackedFrameWatchers(doc);
        return false;
      }
      if (trackedBlancFrame) {
        trackedBlancFrame.removeEventListener('load', trackedBlancFrameLoadHandler);
      }
      cleanupTrackedFrameWatchers();
      trackedBlancFrame = frame;
      trackedBlancFrame?.addEventListener('load', trackedBlancFrameLoadHandler);
      bindTrackedFrameWatchers(doc);
      return true;
    };

    bindTrackedFrame();
    webModePollTimer = window.setInterval(() => {
      const frameChanged = bindTrackedFrame();
      const playerChanged = watchPlayerResize(doc);
      if (frameChanged || playerChanged) sidebarCleanup?.rebind?.();
      if (frameChanged || playerChanged || isEmbeddedWebFullscreenActive(doc) !== specialWebFullscreenActive) {
        scheduleApplyLayout(doc);
      }
    }, WEB_MODE_FALLBACK_POLL_MS);
  }
