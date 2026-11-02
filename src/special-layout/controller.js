  /* @include renderer.js */

  /* @include initial-collapse.js */

  function syncFullscreenState(doc) {
    const active = Boolean(doc.fullscreenElement);
    doc.documentElement.classList.toggle('blive-special-fs', active);
  }

  function watchFullscreenState(doc) {
    const handler = () => syncFullscreenState(doc);
    runtimeScope.listen(doc, 'fullscreenchange', handler);
    syncFullscreenState(doc);
  }

  function initSpecialLayout() {
    cleanupRuntimeWatchers();
    runtimeScope = createLifecycle();
    const doc = document;
    clearLegacyConflicts(doc);
    const playerRoot = doc.querySelector('.live-non-revenue-player');
    clearLayoutInlineSizes(playerRoot);
    if (playerRoot) {
      const videoArea =
        playerRoot.querySelector('.live-player-bg')
        || playerRoot.querySelector('.player iframe')
        || playerRoot.querySelector('.player');
      getShellExtraWidth(playerRoot);
      if (videoArea) {
        getBaseVideoMetrics(playerRoot, videoArea);
      }
    }
    doc.documentElement.classList.add('blive-special-layout');
    doc.documentElement.classList.toggle('blf-no-list', specialMode === 'no-list');
    doc.documentElement.dataset.bliveSpecialLayoutVersion = VERSION;
    ensureStyle(doc);
    sidebarCleanup = setupSidebar(doc);
    watchFullscreenState(doc);
    watchEmbeddedWebFullscreen(doc);
    scheduleApplyLayout(doc);
    watchPlayerResize(doc);
    runtimeScope.listen(window, 'resize', () => scheduleApplyLayout(doc));

    if (specialMode === 'keep-list') {
      collapseCleanup = startInitialCollapseWatcher(doc);
    }
  }

  function watchAndInit() {
    if (!pageLifecycleBound) {
      pageLifecycleBound = true;
      window.addEventListener('pagehide', () => {
        initializationCleanup?.();
        cleanupRuntimeWatchers();
      });
      window.addEventListener('pageshow', (event) => {
        if (event.persisted) watchAndInit();
      });
    }
    if (runtimeScope?.active) return;
    initializationCleanup?.();
    const doc = document;
    let initialized = false;
    let retryTimer = 0;
    let deadlineTimer = 0;
    let observer = null;
    let stopped = false;

    const stop = () => {
      if (stopped) {
        return;
      }
      stopped = true;
      if (retryTimer) {
        window.clearInterval(retryTimer);
        retryTimer = 0;
      }
      if (deadlineTimer) {
        window.clearTimeout(deadlineTimer);
        deadlineTimer = 0;
      }
      if (observer) {
        observer.disconnect();
      }
      window.removeEventListener('load', scheduleTryInit);
      scheduleTryInit.cancel();
      if (initializationCleanup === stop) initializationCleanup = null;
    };

    const tryInit = () => {
      if (initialized || stopped) {
        return;
      }
      if (!isSpecialTopPage(doc)) {
        if (doc.readyState === 'complete' && doc.querySelector('.player-and-aside-area')) {
          stop();
        }
        return;
      }
      initialized = true;
      initSpecialLayout();
      console.info('[blive-special-layout] active', {
        version: VERSION,
        mode: specialMode,
        href: location.href
      });
      stop();
    };

    const scheduleTryInit = withRafScheduler(window, tryInit);
    initializationCleanup = stop;
    const relevantSelector = [
      '.live-non-revenue-player',
      '.live-player-handle-bar',
      '.live-player-bg',
      'iframe[src*="/blanc/"]',
      '.rendererRoot',
      '.layerWrapperRoot',
      '[class*="pageRoot"]',
      '.player-and-aside-area'
    ].join(',');
    const nodeMayRevealPageType = (node) => node instanceof Element && (
      node.matches(relevantSelector) || Boolean(node.querySelector(relevantSelector))
    );
    observer = new MutationObserver((records) => {
      const relevant = records.some((record) => [...record.addedNodes].some(nodeMayRevealPageType));
      if (relevant) {
        scheduleTryInit();
      }
    });

    observer.observe(doc.documentElement, {
      childList: true,
      subtree: true
    });

    retryTimer = window.setInterval(() => {
      if (initialized) {
        window.clearInterval(retryTimer);
        return;
      }
      scheduleTryInit();
    }, 1000);
    deadlineTimer = window.setTimeout(stop, MAX_INIT_WATCH_MS);

    window.addEventListener('load', scheduleTryInit, { once: true });
    scheduleTryInit();
  }
