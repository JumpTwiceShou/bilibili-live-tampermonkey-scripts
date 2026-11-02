  /* @include sidebar-data.js */

  function renderFollowList(listRoot, items, emptyMessage) {
    listRoot.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'follow-empty-cntr';
      empty.setAttribute('data-v-80ec38f4', '');
      const text = document.createElement('div');
      text.className = 'follow-empty-text';
      text.setAttribute('data-v-80ec38f4', '');
      text.textContent = emptyMessage || '暂无可展示内容';
      empty.appendChild(text);
      listRoot.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach((item) => {
      const anchor = document.createElement('a');
      anchor.className = 'one-anchor';
      anchor.setAttribute('data-v-80ec38f4', '');
      anchor.href = item.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';

      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.setAttribute('data-v-80ec38f4', '');
      const img = document.createElement('img');
      img.className = 'real-avatar';
      img.setAttribute('data-v-80ec38f4', '');
      img.src = item.face;
      img.alt = item.nickname;
      img.loading = 'lazy';
      const pink = document.createElement('div');
      pink.className = 'pink-icon';
      pink.setAttribute('data-v-80ec38f4', '');
      avatar.appendChild(img);
      avatar.appendChild(pink);

      const name = document.createElement('div');
      name.className = 'anchor-name';
      name.setAttribute('data-v-80ec38f4', '');
      const p = document.createElement('p');
      p.setAttribute('data-v-80ec38f4', '');
      p.textContent = item.nickname;
      name.appendChild(p);

      anchor.appendChild(avatar);
      anchor.appendChild(name);
      frag.appendChild(anchor);
    });
    listRoot.appendChild(frag);
  }

  function createSidebarDom() {
    const host = document.createElement('div');
    host.id = 'blf-special-sidebar-host';
    host.innerHTML = `
<div data-v-12f789d4="" id="sidebar-vm" class="p-relative z-sidebar contain-optimize">
  <div data-v-12f789d4="" class="side-bar-cntr">
    <button type="button" data-v-12f789d4="" aria-label="打开直播实验室" data-upgrade-intro="Laboratory" class="side-bar-btn tm-sidebar-lab" hidden>
      <span data-v-7d702bb4="" data-v-12f789d4="" class="side-bar-btn-cntr">
        <span data-v-7d702bb4="" class="side-bar-icon" aria-hidden="true">⚗</span>
        <span data-v-7d702bb4="" class="size-bar-text">实验室</span>
      </span>
    </button>
    <button type="button" data-v-12f789d4="" aria-label="查看我的关注" aria-controls="blf-special-follow-popup" aria-expanded="false" data-upgrade-intro="Follow" class="side-bar-btn tm-sidebar-follow">
      <span data-v-7d702bb4="" data-v-12f789d4="" class="side-bar-btn-cntr">
        <span data-v-7d702bb4="" class="side-bar-icon" aria-hidden="true">♡</span>
        <span data-v-7d702bb4="" class="size-bar-text">关注</span>
      </span>
    </button>
    <button type="button" data-v-12f789d4="" aria-label="返回播放器" data-upgrade-intro="Top" class="side-bar-btn no-text tm-sidebar-top" hidden>
      <span data-v-7d702bb4="" data-v-12f789d4="" class="side-bar-btn-cntr">
        <span data-v-7d702bb4="" class="side-bar-icon" aria-hidden="true">↑</span>
      </span>
    </button>
  </div>
  <div id="blf-special-follow-popup" data-v-902b9200="" data-v-12f789d4="" class="side-bar-popup-cntr ts-dot-4" role="dialog" aria-label="我的关注" aria-hidden="true" aria-busy="false">
    <div data-v-902b9200="" class="arrow" style="top: calc(55% + 0px);"></div>
    <div data-v-902b9200="" class="content-wrapper">
      <div data-v-80ec38f4="" data-v-902b9200="" class="follow-cntr" popup-name="Follow">
        <div data-v-80ec38f4="" class="my-follow">
          <div data-v-80ec38f4="" class="follow-text">我的关注</div>
          <a data-v-80ec38f4="" class="more-follows" href="${MORE_FOLLOW_URL}" target="_blank" rel="noopener noreferrer">
            <span data-v-80ec38f4="">更多关注</span>
            <i data-v-80ec38f4="" class="blue-right-arrow" aria-hidden="true">›</i>
          </a>
        </div>
        <div class="tm-follow-subtitle" data-blf-role="subtitle"></div>
        <div data-v-80ec38f4="" class="anchor-list">
          <div data-v-80ec38f4="" class="three-anchor ps ps--theme_default ps--active-y" data-blf-role="list"></div>
        </div>
      </div>
    </div>
  </div>
</div>
`;
    return host;
  }

  function getPlayerTop(doc) {
    const candidates = [
      doc.querySelector('.live-player-bg'),
      doc.querySelector('#player-ctnr'),
      doc.querySelector('.player'),
      doc.querySelector('iframe[src*="/blanc/"]'),
      doc.querySelector('.live-non-revenue-player')
    ];
    for (const target of candidates) {
      if (!target) {
        continue;
      }
      const rect = target.getBoundingClientRect();
      if (rect.width < 300 || rect.height < 120) {
        continue;
      }
      return Math.max(0, Math.round(window.scrollY + rect.top));
    }
    return 0;
  }

  function setupSidebar(doc) {
    if (doc.getElementById('blf-special-sidebar-host')) {
      return;
    }
    const host = createSidebarDom();
    doc.body.appendChild(host);
    const scope = createLifecycle();
    let requestController = null;
    scope.add(() => requestController?.abort());

    const followBtn = host.querySelector('.tm-sidebar-follow');
    const topBtn = host.querySelector('.tm-sidebar-top');
    const labBtn = host.querySelector('.tm-sidebar-lab');
    const popup = host.querySelector('.side-bar-popup-cntr');
    const listRoot = host.querySelector('[data-blf-role="list"]');
    const subtitle = host.querySelector('[data-blf-role="subtitle"]');
    const titleRoot = host.querySelector('.follow-text');
    let sidebarBoundFrame = null;
    let sidebarBoundFrameDoc = null;

    let popupOpen = false;
    let loading = false;
    let cacheItems = [];
    let cacheTitle = '我的关注';
    let cacheEmptyMessage = '暂无可展示内容';
    let cacheLoadedAt = 0;
    let labUrl = '';

    const scheduleTop = withRafScheduler(window, () => {
      if (!scope.active) return;
      const show = window.scrollY > getPlayerTop(doc) + 120;
      topBtn.hidden = !show;
    });

    function setPopup(open) {
      popupOpen = open;
      popup.classList.toggle('is-open', open);
      popup.setAttribute('aria-hidden', String(!open));
      followBtn.setAttribute('aria-expanded', String(open));
    }

    function closePopupFromEmbeddedArea() {
      if (popupOpen) {
        setPopup(false);
      }
    }

    function rebindEmbeddedDismissTarget() {
      const frame = getBlancFrame(doc);
      if (frame !== sidebarBoundFrame) {
        if (sidebarBoundFrame) {
          sidebarBoundFrame.removeEventListener('load', rebindEmbeddedDismissTarget);
        }
        sidebarBoundFrameDoc?.removeEventListener('pointerdown', closePopupFromEmbeddedArea, true);
        sidebarBoundFrame = frame;
        sidebarBoundFrameDoc = null;
        if (sidebarBoundFrame) {
          sidebarBoundFrame.addEventListener('load', rebindEmbeddedDismissTarget);
        }
      }

      const frameDoc = getBlancFrameDocument(doc);
      if (!frameDoc || frameDoc === sidebarBoundFrameDoc) {
        return;
      }

      if (sidebarBoundFrameDoc) {
        sidebarBoundFrameDoc.removeEventListener('pointerdown', closePopupFromEmbeddedArea, true);
      }
      sidebarBoundFrameDoc = frameDoc;
      sidebarBoundFrameDoc.addEventListener('pointerdown', closePopupFromEmbeddedArea, true);
    }

    function mutationsTouchBlancFrame(records) {
      const nodeHasFrame = (node) => {
        if (!(node instanceof Element)) {
          return false;
        }
        if (node.matches('iframe') && (node.getAttribute('src') || '').includes('/blanc/')) {
          return true;
        }
        return Boolean(node.querySelector('iframe[src*="/blanc/"]'));
      };
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof HTMLIFrameElement) {
          return true;
        }
        for (const node of record.addedNodes) {
          if (nodeHasFrame(node)) {
            return true;
          }
        }
        for (const node of record.removedNodes) {
          if (nodeHasFrame(node)) {
            return true;
          }
        }
      }
      return false;
    }

    async function loadFollow() {
      if (loading) {
        return;
      }
      if (cacheLoadedAt && Date.now() - cacheLoadedAt < FOLLOW_CACHE_MS) {
        renderFollowList(listRoot, cacheItems, cacheEmptyMessage);
        return;
      }
      loading = true;
      requestController = new AbortController();
      popup.setAttribute('aria-busy', 'true');
      subtitle.textContent = '读取中…';
      renderFollowList(listRoot, [], '读取中…');
      try {
        const payload = await fetchSidebarPayload(requestController.signal);
        if (!scope.active) return;
        cacheItems = payload.items;
        cacheTitle = payload.title;
        cacheEmptyMessage = payload.emptyMessage;
        cacheLoadedAt = payload.cacheable ? Date.now() : 0;
        labUrl = payload.labUrl || '';

        titleRoot.textContent = cacheTitle;
        subtitle.textContent = `${cacheItems.length} 个${cacheTitle === '我的关注' ? '直播间' : '推荐主播'}`;
        labBtn.hidden = !labUrl;
        renderFollowList(listRoot, cacheItems, cacheEmptyMessage);
      } finally {
        loading = false;
        requestController = null;
        if (scope.active) popup.setAttribute('aria-busy', 'false');
      }
    }

    scope.listen(followBtn, 'click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const next = !popupOpen;
      setPopup(next);
      if (next) {
        loadFollow();
      }
    });

    scope.listen(topBtn, 'click', (evt) => {
      evt.preventDefault();
      window.scrollTo({
        top: getPlayerTop(doc),
        behavior: 'smooth'
      });
    });

    scope.listen(labBtn, 'click', (evt) => {
      evt.preventDefault();
      const target = normalizeHttpUrl(labUrl)
        || 'https://live.bilibili.com/p/html/live-labs/index.html';
      window.open(target, '_blank', 'noopener,noreferrer');
    });

    scope.listen(doc, 'click', (evt) => {
      if (popupOpen && !host.contains(evt.target)) {
        setPopup(false);
      }
    });

    scope.listen(doc, 'keydown', (evt) => {
      if (popupOpen && evt.key === 'Escape') {
        setPopup(false);
        followBtn.focus();
      }
    });

    const frameObserver = new MutationObserver((records) => {
      if (mutationsTouchBlancFrame(records)) {
        rebindEmbeddedDismissTarget();
      }
    });

    function rebind() {
      frameObserver.disconnect();
      const player = doc.querySelector('.live-non-revenue-player');
      if (player?.parentElement) frameObserver.observe(player.parentElement, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['src'],
      });
      rebindEmbeddedDismissTarget();
    }

    rebind();
    scope.listen(window, 'scroll', scheduleTop, { passive: true });
    scheduleTop();
    const dispose = () => {
      scope.dispose();
      frameObserver.disconnect();
      sidebarBoundFrame?.removeEventListener('load', rebindEmbeddedDismissTarget);
      sidebarBoundFrameDoc?.removeEventListener('pointerdown', closePopupFromEmbeddedArea, true);
      scheduleTop.cancel();
      host.remove();
    };
    dispose.rebind = rebind;
    return dispose;
  }
