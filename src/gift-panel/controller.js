  const giftQuery = { value: '' };
  let giftRuntime = null;

  function startGiftRuntime() {
    if (giftRuntime || document.body.classList.contains('pure_room_root')) return;
    const scope = createLifecycle();
    giftRuntime = scope;
    const adapter = createGiftAdapter();
    const index = createGiftSearchIndex();
    let root = null;
    let rootObserver = null;
    let discovery = null;
    let discoveryTimer = 0;
    let panel = null;
    let search = null;
    let frame = 0;

    function stopDiscovery() {
      discovery?.disconnect();
      discovery = null;
      if (discoveryTimer) window.clearTimeout(discoveryTimer);
      discoveryTimer = 0;
    }

    function syncPanel() {
      frame = 0;
      if (!scope.active) return;
      const next = getOpenGiftHost() && root?.querySelector(`${PANEL_SELECTOR} .more-gifts-panel-root`);
      if (next === panel) return;
      search?.dispose();
      panel = next;
      search = panel ? createGiftPanelSearch(panel, giftQuery, adapter, index) : null;
    }

    function schedulePanel() {
      if (!frame) frame = window.requestAnimationFrame(syncPanel);
    }

    function bindRoot(next) {
      rootObserver?.disconnect();
      search?.dispose();
      search = panel = null;
      root = next;
      adapter.clear();
      index.clear();
      if (!root) return;
      stopDiscovery();
      rootObserver = new MutationObserver((records) => {
        if (records.some((record) => !panel?.contains(record.target))) schedulePanel();
      });
      rootObserver.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      syncPanel();
    }

    function discover() {
      stopDiscovery();
      const current = document.querySelector('.fullscreen-container-paddingbox');
      if (current) { bindRoot(current); return; }
      discovery = new MutationObserver((records) => {
        if (!records.some((record) => [...record.addedNodes].some((node) => node instanceof Element
          && (node.matches('.fullscreen-container-paddingbox') || node.querySelector('.fullscreen-container-paddingbox'))))) return;
        const next = document.querySelector('.fullscreen-container-paddingbox');
        if (next) bindRoot(next);
      });
      discovery.observe(document.body, { childList: true, subtree: true });
      discoveryTimer = window.setTimeout(stopDiscovery, 30000);
    }

    // The global guard only checks the known player's connection; it never scans chat subtrees.
    const guard = new MutationObserver(() => {
      if (root && !root.isConnected) { bindRoot(null); discover(); }
    });
    guard.observe(document.body, { childList: true, subtree: true });
    scope.listen(document, 'pointerdown', (event) => {
      if (event.button !== 0) return;
      const host = getOpenGiftHost();
      if (host && !isInsideIgnoredArea(event)) closeGiftPanel(host);
    }, true);
    scope.listen(window, 'popstate', discover);
    scope.add(() => {
      guard.disconnect();
      stopDiscovery();
      rootObserver?.disconnect();
      search?.dispose();
      if (frame) window.cancelAnimationFrame(frame);
      adapter.clear();
      index.clear();
    });
    discover();
  }

  window.addEventListener('pagehide', () => {
    giftRuntime?.dispose();
    giftRuntime = null;
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) startGiftRuntime();
  });
