  function normalizeGiftName(value) {
    return value.trim().toLocaleLowerCase();
  }

  function normalizePinyin(value) {
    return normalizeGiftName(value).replace(/u:/g, 'ü').normalize('NFD')
      .replace(/u\u0308/g, 'v').replace(/\p{M}/gu, '').replace(/[\s'-]+/g, '');
  }

  function createGiftSearchIndex() {
    const cache = new Map();
    return {
      clear() { cache.clear(); },
      query(value) {
        const text = normalizeGiftName(value);
        return { text, pinyin: normalizePinyin(text) };
      },
      matches(name, query) {
        if (!query.text) return true;
        const text = normalizeGiftName(name);
        if (text.includes(query.text)) return true;
        if (!query.pinyin || typeof pinyinPro === 'undefined' || typeof pinyinPro.pinyin !== 'function') return false;
        let keys = cache.get(text);
        if (!keys) {
          const options = { toneType: 'none', type: 'array', nonZh: 'consecutive', v: true };
          keys = [
            pinyinPro.pinyin(text, options).join(''),
            pinyinPro.pinyin(text, { ...options, pattern: 'first' }).join(''),
          ].map(normalizePinyin);
          cache.set(text, keys);
        }
        return keys.some((key) => key.includes(query.pinyin));
      },
    };
  }
