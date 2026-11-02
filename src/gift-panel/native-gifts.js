  function createGiftAdapter() {
    const names = new Map();
    return {
      clear() { names.clear(); },
      read(wrapper) {
        const gift = wrapper.querySelector('.gift-item');
        const id = gift && [...gift.classList].find((value) => value.startsWith('gift-id-'));
        let name = wrapper.querySelector('.gift-label')?.textContent?.trim()
          || gift?.getAttribute('aria-label')?.trim() || gift?.getAttribute('title')?.trim() || '';
        // Some package cards have no label. Keep the site-specific fallback in this adapter.
        if (!name) {
          try {
            const nativeName = gift?.__vue__?.giftInfo?.label;
            if (typeof nativeName === 'string') name = nativeName.trim();
          } catch (_error) { /* A replaced native component may already be disposed. */ }
        }
        if (id && name) names.set(id, name);
        return name || names.get(id) || '';
      },
    };
  }
