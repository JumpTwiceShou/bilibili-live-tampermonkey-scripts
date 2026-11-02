  function createGiftPanelSearch(panel, queryState, adapter, index) {
    const scope = createLifecycle();
    let inputScope = createLifecycle();
    let input = null;
    let lists = [];
    let dirty = true;
    let frame = 0;

    function mountInput() {
      const tabs = panel.querySelector('.more-gifts-panel-tabs > .tabs-section');
      if (!tabs || (input?.isConnected && input.parentElement === tabs.parentElement)) return;
      inputScope.dispose();
      inputScope = createLifecycle();
      input = panel.querySelector('.tm-gift-search') || document.createElement('input');
      input.type = 'search';
      input.className = 'tm-gift-search';
      input.placeholder = '搜索礼物';
      input.setAttribute('aria-label', '搜索礼物');
      input.title = '支持中文、拼音全拼和首字母，例如：小花花 / xiaohuahua / xhh';
      input.autocomplete = 'off';
      input.value = queryState.value;
      inputScope.listen(input, 'input', () => {
        queryState.value = input.value;
        render();
        for (const { list } of lists) list.scrollTop = 0;
      });
      for (const type of ['pointerdown', 'click', 'keydown', 'keyup', 'keypress']) {
        inputScope.listen(input, type, (event) => {
          event.stopPropagation();
          if (type === 'keydown' && event.key === 'Enter') event.preventDefault();
          if (type === 'keydown' && event.key === 'Escape') {
            event.preventDefault();
            input.value = queryState.value = '';
            render();
          }
        });
      }
      tabs.after(input);
    }

    function rebuild() {
      mountInput();
      lists = [...panel.querySelectorAll('.gift-list-section')].map((list) => {
        const entries = [...list.querySelectorAll('.list-gift-wrapper')].map((wrapper) => ({
          wrapper, name: adapter.read(wrapper),
        }));
        let empty = list.querySelector('.tm-gift-search-empty');
        if (!empty) {
          empty = document.createElement('div');
          empty.className = 'tm-gift-search-empty';
          empty.setAttribute('role', 'status');
          empty.textContent = '没有匹配的礼物';
          list.appendChild(empty);
        }
        return { list, entries, empty };
      });
      dirty = false;
    }

    function render() {
      if (!scope.active) return;
      if (dirty) rebuild();
      const query = index.query(queryState.value);
      for (const { list, entries, empty } of lists) {
        let matched = 0;
        for (const { wrapper, name } of entries) {
          const visible = index.matches(name, query);
          wrapper.classList.toggle('tm-gift-search-hidden', !visible);
          if (visible) matched += 1;
        }
        list.classList.toggle('tm-gift-search-active', Boolean(query.text));
        empty.hidden = !query.text || matched > 0;
      }
    }

    function invalidate() {
      dirty = true;
      if (!frame) frame = window.requestAnimationFrame(() => { frame = 0; render(); });
    }

    const observer = new MutationObserver((records) => {
      if (records.some((record) => {
        const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        if (record.type === 'attributes') return target?.matches('.gift-item, .gift-label');
        return target?.matches('.gift-list-section, .gift-row, .list-gift-wrapper, .more-gifts-panel-tabs, .more-gifts-panel-tabs > .tabs-section')
          || target?.closest('.gift-label')
          || [...record.addedNodes, ...record.removedNodes].some((node) => node instanceof Element
            && (node.matches('.gift-list-section, .more-gifts-panel-tabs')
              || node.querySelector('.gift-list-section, .more-gifts-panel-tabs')));
      })) invalidate();
    });
    observer.observe(panel, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['class', 'title', 'aria-label'],
    });
    render();
    return {
      dispose() {
        scope.dispose();
        observer.disconnect();
        inputScope.dispose();
        if (frame) window.cancelAnimationFrame(frame);
        input?.remove();
        for (const { list, entries, empty } of lists) {
          list.classList.remove('tm-gift-search-active');
          for (const { wrapper } of entries) wrapper.classList.remove('tm-gift-search-hidden');
          empty.remove();
        }
        lists = [];
      },
    };
  }
