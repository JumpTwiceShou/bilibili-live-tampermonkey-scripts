async (page) => {
  const base = new URL(page.url()).origin;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const check = (value, message) => { if (!value) throw new Error(message); };
  const transition = async (type) => page.evaluate((name) => {
    window.dispatchEvent(new PageTransitionEvent(name, { persisted: true }));
  }, type);

  await page.goto(`${base}/tests/fixtures/gift-search.html`);
  const input = page.getByRole('searchbox', { name: '搜索礼物' });
  const names = async () => (await page.locator('.list-gift-wrapper:not(.tm-gift-search-hidden) .gift-label').allTextContents()).map((text) => text.trim());
  await input.waitFor();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.evaluate(() => {
    const panel = document.querySelector('.more-gifts-panel-root');
    const original = panel.querySelectorAll;
    document.documentElement.dataset.fixtureGiftIndexScans = '0';
    panel.querySelectorAll = function (...args) {
      document.documentElement.dataset.fixtureGiftIndexScans = String(Number(document.documentElement.dataset.fixtureGiftIndexScans) + 1);
      return original.apply(this, args);
    };
  });
  for (const query of ['xiaohuahua', 'xhh', ' XIAO HUĀ HUA ', '小花']) {
    await input.fill(query);
    check(JSON.stringify(await names()) === JSON.stringify(['小花花']), `gift matching: ${query}`);
  }
  await input.fill('xdmh');
  check(JSON.stringify(await names()) === JSON.stringify(['心动盲盒']), 'initials');
  await input.fill('BILIBILI');
  check(JSON.stringify(await names()) === JSON.stringify(['bilibili世界']), 'English');
  check(await page.evaluate(() => document.documentElement.dataset.fixtureGiftIndexScans) === '0', 'typing reuses the list index without a full panel scan');
  await input.evaluate((element) => {
    element.value = 'xiaohua';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText' }));
  });
  check(JSON.stringify(await names()) === JSON.stringify(['小花花']), 'composing input');
  await page.locator('.gift-id-1').click();
  check(await page.evaluate(() => document.documentElement.dataset.fixtureGiftSelected) === '1', 'native gift handler');
  await page.evaluate(() => {
    const list = document.querySelector('.gift-list-section');
    list.replaceWith(list.cloneNode(true));
  });
  await page.waitForFunction(() => document.querySelectorAll('.list-gift-wrapper:not(.tm-gift-search-hidden)').length === 1);
  await input.press('Escape');
  check((await names()).length === 4, 'clear restores list');
  await input.fill('zzzz');
  check(await page.getByRole('status').isVisible(), 'empty result status');
  await input.fill('xhh');
  await transition('pagehide');
  check(await input.count() === 0, 'gift cleanup removes owned UI');
  await transition('pageshow');
  check(await input.count() === 1 && await input.inputValue() === 'xhh', 'gift resume restores one input and query');
  await page.evaluate(() => {
    const root = document.querySelector('.fullscreen-container-paddingbox');
    root.replaceWith(root.cloneNode(true));
  });
  await page.waitForFunction(() => document.querySelectorAll('.tm-gift-search').length === 1);
  await input.fill('xdmh');
  check(JSON.stringify(await names()) === JSON.stringify(['心动盲盒']), 'player replacement rebinds search');
  await page.locator('#outside').click();
  await page.waitForFunction(() => !document.querySelector('.tool-open'));

  await page.goto(`${base}/tests/fixtures/room-area-race.html`);
  await page.waitForFunction(() => document.querySelector('#blive-room-area-badge-host')?.textContent.includes('新直播间标题'));
  check(Number(await page.evaluate(() => document.documentElement.dataset.fixtureAbortedRequests)) >= 1, 'room race abort');
  await page.evaluate(() => {
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: document.body });
    document.dispatchEvent(new Event('fullscreenchange'));
    window.dispatchEvent(new Event('resize'));
  });
  await page.waitForFunction(() => document.querySelector('#blive-room-area-badge-host')?.classList.contains('blive-room-area-badge-hidden'));
  await page.evaluate(() => {
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
    window.dispatchEvent(new Event('resize'));
  });
  await page.waitForFunction(() => !document.querySelector('#blive-room-area-badge-host')?.classList.contains('blive-room-area-badge-hidden'));
  await transition('pagehide');
  await transition('pageshow');
  await page.waitForFunction(() => document.querySelector('#blive-room-area-badge-host')?.textContent.includes('新直播间标题'));
  check(await page.locator('#blive-room-area-badge-host').count() === 1, 'room resume has one badge');

  await page.goto(`${base}/tests/fixtures/video-bitrate-reset.html`);
  await page.waitForFunction(() => document.documentElement.dataset.fixtureComplete === '1');
  const rates = await page.evaluate(() => ({ ...document.documentElement.dataset }));
  check(rates.fixtureFirstBitrate.includes('3.87'), 'known audio subtracted');
  check(rates.fixtureSecondBitrate.includes('约4.00'), 'new video does not inherit old audio');
  await transition('pagehide');
  await transition('pageshow');
  await page.waitForFunction(() => document.querySelector('.blive-video-bitrate-stats-value')?.textContent.includes('--'));
  await page.evaluate(() => new MediaSource().addSourceBuffer('video/mp4; codecs="avc1.640028"').appendBuffer(new ArrayBuffer(250000)));
  await page.waitForFunction(() => document.querySelector('.blive-video-bitrate-stats-value')?.textContent.includes('1.00'));

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${base}/tests/fixtures/special-layout.html`);
  await page.waitForFunction(() => document.documentElement.dataset.blfInitialCollapseDone === '1');
  check(await page.evaluate(() => document.documentElement.dataset.fixtureFetchCount) === '0', 'sidebar data remains lazy');
  const width = await page.locator('.live-non-revenue-player').evaluate((element) => element.getBoundingClientRect().width);
  const follow = page.getByRole('button', { name: '查看我的关注' });
  await follow.click();
  await page.waitForFunction(() => document.querySelector('.one-anchor'));
  await page.keyboard.press('Escape');
  await follow.click();
  check(await page.evaluate(() => document.documentElement.dataset.fixtureFetchCount) === '2', 'sidebar cache avoids repeated requests');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForFunction((wide) => document.querySelector('.live-non-revenue-player').getBoundingClientRect().width < wide, width);
  await transition('pagehide');
  check(await page.locator('#blf-special-sidebar-host').count() === 0, 'layout cleanup owns sidebar');
  await transition('pageshow');
  await page.waitForFunction(() => document.querySelectorAll('#blf-special-sidebar-host').length === 1);
  await follow.click();
  await page.waitForFunction(() => document.querySelector('.one-anchor'));
  check(await page.evaluate(() => document.documentElement.dataset.fixtureFetchCount) === '4', 'resume binds exactly one follow handler');
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'fixture-web-frame';
    frame.src = '/blanc/900';
    document.querySelector('.player').appendChild(frame);
  });
  await page.waitForFunction(() => document.querySelector('#fixture-web-frame')?.contentDocument?.readyState === 'complete');
  await page.evaluate(() => {
    document.querySelector('#fixture-web-frame').contentWindow.EmbedPlayer = {
      instance: { ctrl: { getCtrlUI: () => ({ webFullScreenStatus: true }) } },
    };
  });
  await page.waitForFunction(() => document.documentElement.classList.contains('blive-special-webfs'));
  await page.evaluate(() => {
    const old = document.querySelector('#fixture-web-frame');
    const next = document.createElement('iframe');
    next.id = old.id;
    next.src = '/blanc/901';
    old.replaceWith(next);
  });
  await page.waitForFunction(() => !document.documentElement.classList.contains('blive-special-webfs'));
  await page.waitForFunction(() => document.querySelector('#fixture-web-frame')?.contentDocument?.readyState === 'complete');
  await page.evaluate(() => {
    document.querySelector('#fixture-web-frame').contentWindow.EmbedPlayer = {
      instance: { ctrl: { getCtrlUI: () => ({ webFullScreenStatus: true }) } },
    };
  });
  await page.waitForFunction(() => document.documentElement.classList.contains('blive-special-webfs'));
  await page.goto(`${base}/tests/fixtures/special-layout.html?variant=no-list`);
  await page.waitForFunction(() => document.documentElement.classList.contains('blf-no-list'));
  check(!await page.locator('.live-player-handle-bar').isVisible(), 'generated no-list variant');

  await page.goto(`${base}/tests/fixtures/special-blanc-redirect.html`);
  await page.waitForURL(`${base}/blanc/789?liteVersion=true`);
  check(errors.length === 0, `page errors: ${errors.join('; ')}`);
  return { passed: true, flows: ['gift matching/rebuild/resume', 'room race/fullscreen/resume', 'bitrate reset/resume', 'layout sizing/lazy cache/resume', 'no-list generation', 'shared redirect detection'] };
}
