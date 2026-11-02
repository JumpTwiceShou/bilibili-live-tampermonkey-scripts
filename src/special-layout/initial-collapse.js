  function ensureDefaultCollapsed(doc) {
    if (doc.documentElement.dataset.blfInitialCollapseDone === '1') {
      return true;
    }
    const bar = doc.querySelector('.live-player-handle-bar');
    const btn = bar ? bar.querySelector('.expand-btn') : null;
    if (!bar || !btn) {
      return false;
    }
    const expanded = btn.classList.contains('liveexpand');
    doc.documentElement.dataset.blfInitialCollapseDone = '1';
    if (!expanded) {
      return true;
    }
    btn.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
    return true;
  }

  function startInitialCollapseWatcher(doc) {
    let timer = 0;
    let deadlineTimer = 0;
    let settleTimer = 0;
    let stopped = false;
    const stop = () => {
      if (stopped) {
        return;
      }
      stopped = true;
      observer.disconnect();
      if (timer) {
        window.clearInterval(timer);
      }
      if (deadlineTimer) {
        window.clearTimeout(deadlineTimer);
      }
      if (settleTimer) {
        window.clearTimeout(settleTimer);
      }
    };
    const tryCollapse = () => {
      if (doc.documentElement.dataset.blfInitialCollapseDone === '1') {
        stop();
        return;
      }
      const btn = doc.querySelector('.live-player-handle-bar .expand-btn');
      if (!btn || settleTimer) {
        return;
      }
      settleTimer = window.setTimeout(() => {
        settleTimer = 0;
        if (ensureDefaultCollapsed(doc)) {
          stop();
        }
      }, 100);
    };
    const mutationTouchesHandleBar = (records) => records.some((record) => {
      const targetInHandleBar = record.target instanceof Element && (
        record.target.matches('.live-player-handle-bar, .expand-btn')
        || Boolean(record.target.closest('.live-player-handle-bar'))
      );
      if (targetInHandleBar) {
        return true;
      }
      return [...record.addedNodes, ...record.removedNodes].some((node) => (
        node instanceof Element && (
          node.matches('.live-player-handle-bar, .expand-btn')
          || Boolean(node.closest('.live-player-handle-bar'))
          || Boolean(node.querySelector('.live-player-handle-bar, .expand-btn'))
        )
      ));
    });
    const observer = new MutationObserver((records) => {
      if (mutationTouchesHandleBar(records)) {
        tryCollapse();
      }
    });
    observer.observe(doc.body || doc.documentElement, {
      childList: true,
      subtree: true
    });
    timer = window.setInterval(() => tryCollapse(), 500);
    deadlineTimer = window.setTimeout(stop, MAX_COLLAPSE_WATCH_MS);
    tryCollapse();
    return stop;
  }
