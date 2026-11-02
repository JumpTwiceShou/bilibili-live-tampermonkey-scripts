  function createLifecycle() {
    let active = true;
    const disposers = [];
    return {
      get active() { return active; },
      add(dispose) {
        if (active) disposers.push(dispose);
        else dispose();
        return dispose;
      },
      listen(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        this.add(() => target.removeEventListener(type, handler, options));
      },
      dispose() {
        if (!active) return;
        active = false;
        while (disposers.length) disposers.pop()();
      },
    };
  }
