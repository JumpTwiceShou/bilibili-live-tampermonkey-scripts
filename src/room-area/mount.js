  function waitForElement(getElement, exec, timeout = 10000, onDone) {
    const immediate = getElement();
    if (immediate) {
      exec(immediate);
      if (onDone) {
        onDone();
      }
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const node = getElement();
      if (node) {
        window.clearInterval(timer);
        exec(node);
        if (onDone) {
          onDone();
        }
        return;
      }
      if (Date.now() - startedAt >= timeout) {
        window.clearInterval(timer);
        if (onDone) {
          onDone();
        }
      }
    }, 100);
    return timer;
  }

  function waitForQuery(selector, exec, timeout = 10000, onDone) {
    return waitForElement(() => document.querySelector(selector), exec, timeout, onDone);
  }

  function waitForMount() {
    if (state.mountWaitTimer) {
      return;
    }
    state.mountWaitTimer = waitForElement(
      findMount,
      () => scheduleAttach(),
      10000,
      () => {
        state.mountWaitTimer = 0;
      }
    ) || 0;
  }

  function findMount() {
    const headerMount = document.querySelector(HEADER_MOUNT_SELECTOR);
    if (headerMount) {
      return {
        node: headerMount,
        type: 'header'
      };
    }

    return null;
  }

  function findHeaderInsertBefore(mount) {
    const rightModules = document.querySelector(HEADER_RIGHT_MODULES_SELECTOR);
    return rightModules && rightModules.parentElement === mount ? rightModules : null;
  }

  function findHeaderSocialAnchor(mount, host) {
    const rightModules = document.querySelector(HEADER_RIGHT_MODULES_SELECTOR);
    const candidates = [];
    for (const node of mount.querySelectorAll(SOCIAL_ANCHOR_SELECTOR)) {
      addSocialAnchorCandidate(candidates, mount, host, rightModules, node);
    }

    const keywordNodes = mount.querySelectorAll(HEADER_INTERACTIVE_SELECTOR);
    for (const current of keywordNodes) {
      const text = compactText(current.textContent || current.getAttribute('title') || current.getAttribute('aria-label'));
      if (SOCIAL_ANCHOR_KEYWORDS.some((keyword) => text.includes(keyword))) {
        addSocialAnchorCandidate(candidates, mount, host, rightModules, current);
      }
    }

    candidates.sort((left, right) => {
      if (left === right) {
        return 0;
      }
      return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    return candidates[candidates.length - 1] || null;
  }

  function addSocialAnchorCandidate(candidates, mount, host, rightModules, node) {
    const candidate = normalizeSocialAnchor(node, mount);
    if (
      !candidate ||
      candidate === host ||
      host.contains(candidate) ||
      candidate.contains(host) ||
      candidates.includes(candidate) ||
      !mount.contains(candidate) ||
      !isVisibleBox(candidate)
    ) {
      return;
    }
    if (rightModules && (rightModules === candidate || rightModules.contains(candidate))) {
      return;
    }
    candidates.push(candidate);
  }

  function normalizeSocialAnchor(node, mount) {
    if (!node || node === mount) {
      return null;
    }
    const anchored = node.closest([
      '.follow-ctnr',
      '[class*="follow-ctnr"]',
      '[class*="follow-btn"]',
      '[class*="attention"]',
      '[class*="fans"]',
      '[class*="fan-medal"]',
      '[class*="medal"]',
      '[class*="guard"]',
      '[class*="sailing"]',
      'button',
      'a',
      '[role="button"]'
    ].join(','));
    return anchored && mount.contains(anchored) ? anchored : node;
  }

  function compactText(text) {
    return String(text || '').replace(/\s+/g, '');
  }

  function findInsertSlot(mountInfo, host) {
    const mount = mountInfo.node;
    const socialAnchor = findHeaderSocialAnchor(mount, host);
    if (socialAnchor && socialAnchor.parentElement) {
      let before = socialAnchor.nextSibling;
      while (before === host) {
        before = before.nextSibling;
      }
      return {
        parent: socialAnchor.parentElement,
        before
      };
    }
    return {
      parent: mount,
      before: mountInfo.type === 'header' ? findHeaderInsertBefore(mount) : null
    };
  }

  function attachHost() {
    if (!isLiveRoomPage()) {
      removeHost();
      return;
    }

    ensureStyle();
    if (!state.infoKey || !state.info) {
      removeHost();
      return;
    }
    const host = getHost();

    const mountInfo = findMount();
    if (!mountInfo) {
      removeHost();
      waitForMount();
      return;
    }

    host.classList.add('blive-room-area-badge-static');
    syncHostVisibility(host);
    host.dataset.bliveRoomAreaBadgeMount = mountInfo.type;
    host.style.left = '';
    host.style.top = '';
    const slot = findInsertSlot(mountInfo, host);
    if (host.parentElement !== slot.parent || host.nextSibling !== slot.before) {
      slot.parent.insertBefore(host, slot.before);
    }
  }

  function scheduleAttach() {
    if (state.attachTimer) {
      return;
    }
    state.attachTimer = window.requestAnimationFrame(() => {
      state.attachTimer = 0;
      attachHost();
    });
  }

  function syncHostVisibility(host) {
    host.classList.toggle('blive-room-area-badge-hidden', Boolean(document.fullscreenElement));
  }
