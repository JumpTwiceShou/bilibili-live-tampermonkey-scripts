  function areaKey(info) {
    if (!info) {
      return '';
    }
    return [
      info.parentAreaId,
      info.parentAreaName,
      info.areaId,
      info.areaName,
      info.title
    ].join('|');
  }

  function scheduleRefresh(delay) {
    const wait = Math.max(0, Number(delay) || 0);
    const dueAt = Date.now() + wait;
    if (state.refreshTimer) {
      if (dueAt >= state.refreshDueAt) {
        return;
      }
      window.clearTimeout(state.refreshTimer);
    }
    state.refreshDueAt = dueAt;
    state.refreshTimer = window.setTimeout(() => {
      state.refreshTimer = 0;
      state.refreshDueAt = 0;
      refreshArea();
    }, wait);
  }

  function ownsAreaRequest(requestId, roomId, controller) {
    return state.requestId === requestId
      && state.roomId === roomId
      && state.requestController === controller;
  }

  function isCurrentAreaRequest(requestId, roomId, controller) {
    return ownsAreaRequest(requestId, roomId, controller)
      && !controller.signal.aborted
      && isLiveRoomPage()
      && detectRoomId() === roomId;
  }

  async function refreshArea() {
    if (!isLiveRoomPage()) {
      resetAreaState();
      removeHost();
      return;
    }

    const roomId = detectRoomId();

    if (!roomId) {
      const fromState = withTitleFallback(findAreaInKnownState());
      if (fromState) {
        const key = areaKey(fromState);
        const host = getHost();
        if (key !== state.infoKey || host.dataset.bliveRoomAreaBadgeKey !== key) {
          state.infoKey = key;
          state.info = fromState;
          state.lastInfoAt = Date.now();
          renderArea(host, fromState);
          scheduleAttach();
        }
        return;
      }
      if (!state.infoKey) {
        removeHost();
      }
      scheduleRefresh(RETRY_MS);
      return;
    }

    if (state.loadingRoomId === roomId) {
      return;
    }
    if (state.roomId && state.roomId !== roomId) {
      resetAreaState();
      removeHost();
    }
    state.roomId = roomId;

    if (state.requestController) {
      cancelAreaRequest();
    }
    const controller = new AbortController();
    const requestId = state.requestId + 1;
    state.requestId = requestId;
    state.requestController = controller;
    state.loadingRoomId = roomId;
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const info = withTitleFallback(await loadAreaInfo(roomId, controller.signal));
      if (!isCurrentAreaRequest(requestId, roomId, controller)) {
        return;
      }
      state.loadingRoomId = '';
      state.requestController = null;
      if (!info) {
        if (!state.infoKey) {
          removeHost();
        }
        scheduleRefresh(SLOW_RECHECK_MS);
        return;
      }

      const key = areaKey(info);
      state.infoKey = key;
      state.info = info;
      state.lastInfoAt = Date.now();
      const host = getHost();
      if (host.dataset.bliveRoomAreaBadgeKey !== key) {
        renderArea(host, info);
      }
      if (!host.isConnected || host.dataset.bliveRoomAreaBadgeKey !== key) {
        scheduleAttach();
      }
    } catch (error) {
      if (
        !ownsAreaRequest(requestId, roomId, controller)
        || !isLiveRoomPage()
        || detectRoomId() !== roomId
      ) {
        return;
      }
      state.loadingRoomId = '';
      state.requestController = null;
      if (!state.infoKey) {
        removeHost();
      }
      scheduleRefresh(SLOW_RECHECK_MS);
    } finally {
      window.clearTimeout(timeout);
      if (ownsAreaRequest(requestId, roomId, controller) && controller.signal.aborted) {
        state.loadingRoomId = '';
        state.requestController = null;
        if (isLiveRoomPage() && detectRoomId() === roomId) {
          scheduleRefresh(SLOW_RECHECK_MS);
        }
      }
    }
  }

  function watchUrlChange() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    let active = true;

    history.pushState = function pushState() {
      const result = originalPushState.apply(this, arguments);
      if (active) handleMaybeUrlChange();
      return result;
    };

    history.replaceState = function replaceState() {
      const result = originalReplaceState.apply(this, arguments);
      if (active) handleMaybeUrlChange();
      return result;
    };

    const wrappedPush = history.pushState;
    const wrappedReplace = history.replaceState;
    roomRuntime.add(() => {
      active = false;
      if (history.pushState === wrappedPush) history.pushState = originalPushState;
      if (history.replaceState === wrappedReplace) history.replaceState = originalReplaceState;
    });
    roomRuntime.listen(window, 'popstate', handleMaybeUrlChange);
    roomRuntime.listen(window, 'hashchange', handleMaybeUrlChange);
  }

  function handleMaybeUrlChange() {
    window.setTimeout(() => {
      if (!roomRuntime) return;
      if (state.lastPath === location.href) {
        return;
      }
      state.lastPath = location.href;
      resetAreaState();
      if (!isLiveRoomPage()) {
        removeHost();
        return;
      }
      removeHost();
      waitForMount();
      scheduleAttach();
      scheduleRefresh();
    }, 0);
  }

  function refreshTitleFromPage() {
    if (!state.info) {
      return;
    }
    const title = findTitleInPage();
    if (!title || title === state.info.title) {
      return;
    }
    const info = { ...state.info, title };
    const key = areaKey(info);
    state.info = info;
    state.infoKey = key;
    const host = getHost();
    renderArea(host, info);
    scheduleAttach();
  }

  function bindObservers() {
    let header = null;
    const observer = new MutationObserver(() => {
      if (!isLiveRoomPage()) return;
      scheduleAttach();
      if (!state.infoKey && !state.loadingRoomId) scheduleRefresh(250);
    });
    function bindHeader() {
      const next = document.getElementById('head-info-vm');
      if (next === header) return;
      observer.disconnect();
      header = next;
      if (header) {
        observer.observe(header, { childList: true, subtree: true });
        scheduleAttach();
      }
    }
    const guard = new MutationObserver(() => {
      if (!header?.isConnected) bindHeader();
    });
    guard.observe(document.documentElement, { childList: true, subtree: true });
    roomRuntime.add(() => { guard.disconnect(); observer.disconnect(); });
    bindHeader();

    roomRuntime.listen(window, 'resize', () => {
      if (!isLiveRoomPage()) {
        removeHost();
        return;
      }
      scheduleAttach();
    });
    roomRuntime.listen(document, 'fullscreenchange', () => {
      if (!isLiveRoomPage()) {
        removeHost();
        return;
      }
      const host = document.getElementById(HOST_ID);
      if (host) {
        syncHostVisibility(host);
      }
    });

    state.slowTimer = window.setInterval(() => {
      if (!isLiveRoomPage()) {
        removeHost();
        return;
      }
      const roomId = detectRoomId();
      if (roomId && roomId !== state.roomId) {
        scheduleRefresh();
        return;
      }
      refreshTitleFromPage();
      if (state.info && Date.now() - state.lastInfoAt >= INFO_RECHECK_MS) {
        scheduleRefresh();
      }
      const host = document.getElementById(HOST_ID);
      const mountInfo = findMount();
      if (state.info && (!host || !mountInfo || !mountInfo.node.contains(host))) {
        scheduleAttach();
      }
    }, SLOW_RECHECK_MS);
  }

  function init() {
    window.addEventListener('pagehide', stopRoomArea);
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) startRoomArea();
    });
    startRoomArea();
  }

  function stopRoomArea() {
    roomRuntime?.dispose();
    roomRuntime = null;
    window.clearInterval(state.slowTimer);
    window.clearInterval(state.mountWaitTimer);
    window.clearTimeout(state.refreshTimer);
    window.cancelAnimationFrame(state.attachTimer);
    state.slowTimer = state.mountWaitTimer = state.refreshTimer = state.attachTimer = 0;
    state.refreshDueAt = 0;
    resetAreaState();
  }

  function startRoomArea() {
    if (roomRuntime || !isLiveRoomPage()) return;
    roomRuntime = createLifecycle();
    ensureStyle();
    waitForMount();
    attachHost();
    refreshArea();
    watchUrlChange();
    bindObservers();
    console.info('[blive-room-area-badge] active', {
      version: VERSION,
      href: location.href
    });
  }
