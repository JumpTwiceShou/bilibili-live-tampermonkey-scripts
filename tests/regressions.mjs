import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function expose(file, names, context, bootPattern) {
  let source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  source = source.replace(/\r\n/g, '\n');
  if (bootPattern) source = source.replace(bootPattern, '');
  const end = source.lastIndexOf('\n})();');
  assert(end >= 0, `${file}: closure found`);
  vm.runInContext(`${source.slice(0, end)}\n globalThis.audit = { ${names} };\n${source.slice(end)}`, context);
  return context.audit;
}

class Element {
  constructor(text = '') {
    this.textContent = text;
    this.classes = new Set();
    this.dataset = {};
    this.style = {};
  }
  getBoundingClientRect() { return { width: 300, height: 30 }; }
  closest() { return null; }
  getAttribute() { return null; }
  get classList() {
    return {
      remove: (name) => this.classes.delete(name),
      add: (name) => this.classes.add(name),
      toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name),
    };
  }
  set className(value) { this.classes = new Set(value.split(' ')); }
  get className() { return [...this.classes].join(' '); }
  querySelectorAll() { return []; }
}

const unrelated = new Element('其他主播的卡片');
const header = new Element('当前房间标题');
const mount = new Element();
const host = new Element();
host.parentElement = mount;
host.nextSibling = null;
host.className = 'blive-room-area-badge-static blive-room-area-badge-hidden';
let headerPresent = true;
const roomDoc = {
  documentElement: { dataset: {} },
  title: '文档中的当前标题 - 主播 - 哔哩哔哩直播',
  fullscreenElement: {},
  getElementById: (id) => id === 'blive-room-area-badge-host' ? host : { id },
  querySelector: (selector) => selector === '#head-info-vm .normal-row-ctnr' ? mount : null,
  querySelectorAll(selector) {
    if (selector.startsWith('.bili-dyn-card-live__title')) return [unrelated];
    if (headerPresent && selector === '#head-info-vm [class*="room-title"]') return [header];
    return [];
  },
};
const roomWindow = {};
roomWindow.top = roomWindow;
const room = expose('bilibili-live-room-area-badge.user.js', 'findTitleInPage, attachHost, state', vm.createContext({
  document: roomDoc, window: roomWindow, location: new URL('https://live.bilibili.com/123'),
  Element, Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
}), /\n  init\(\);(?=\n\}\)\(\);)/);
assert.equal(room.findTitleInPage(), header.textContent, 'unrelated live cards must not override the room header');
headerPresent = false;
assert.equal(room.findTitleInPage(), '文档中的当前标题', 'document title is the room-bound fallback');
room.state.infoKey = 'existing';
room.state.info = { title: header.textContent };
room.attachHost();
assert(host.classes.has('blive-room-area-badge-hidden'), 'reattach preserves fullscreen hiding');
roomDoc.fullscreenElement = null;
room.attachHost();
assert(!host.classes.has('blive-room-area-badge-hidden'), 'exit fullscreen restores the badge');

const layoutWindow = { localStorage: { getItem: () => null }, location: { search: '' } };
layoutWindow.top = layoutWindow;
const layout = expose('bilibili-live-special-layout.user.js', 'findFirstUrl', vm.createContext({
  window: layoutWindow, document: { readyState: 'loading', addEventListener() {} },
  location: new URL('https://live.bilibili.com/123'), URL, URLSearchParams,
}));
const labUrl = 'https://live.bilibili.com/p/html/live-labs/index.html';
assert.equal(layout.findFirstUrl({ name: '直播实验室', nested: { url: labUrl } }), labUrl);
assert.equal(layout.findFirstUrl({ name: 'https://example.com/avatar.png', nested: { jump_url: labUrl } }), labUrl);
assert.equal(layout.findFirstUrl({ name: '普通文字', url: 'javascript:alert(1)' }), '');
assert.equal(layout.findFirstUrl({ link: '/p/html/live-labs/' }), 'https://live.bilibili.com/p/html/live-labs/');
assert.equal(layout.findFirstUrl(labUrl), labUrl);

let currentVideo = { id: 'old' };
const oldVideo = currentVideo;
const bitrate = expose('bilibili-live-video-bitrate-stats.user.js',
  'state, samples, getPrimaryVideo, trackAppend, getCurrentBitrate', vm.createContext({
    window: { setTimeout: () => 1, addEventListener() {} }, document: { querySelector: () => currentVideo },
    WeakMap, Date, Number, Object,
  }), /  exposeVersion\(\);\n  startMediaSourceHooks\(\);\n  startDomHooks\(\);/);
function buffer() {
  return {
    end: 0,
    get buffered() { return { length: 1, start: () => 0, end: () => this.end }; },
    addEventListener(_event, callback) { this.finish = callback; },
  };
}
bitrate.getPrimaryVideo();
const stale = buffer();
bitrate.trackAppend(stale, { hasVideo: true, hasAudio: false }, 1000000, { end: 0, total: 0 }, oldVideo);
currentVideo = { id: 'new' };
bitrate.getPrimaryVideo();
stale.end = 2;
stale.finish();
assert.equal(bitrate.samples.length, 0, 'old updateend cannot refill the reset window');
const fresh = buffer();
bitrate.trackAppend(fresh, { hasVideo: true, hasAudio: false }, 250000, { end: 0, total: 0 }, currentVideo);
fresh.end = 2;
fresh.finish();
assert.equal(bitrate.samples.length, 1, 'current source still contributes samples');
assert.equal(bitrate.getCurrentBitrate().mbps, 1);

console.log('Passed four defect regressions: title identity, fullscreen visibility, lab URL fields, stale bitrate completion.');

const searchContext = vm.createContext({
  pinyinPro: { pinyin(text, options) {
    searchContext.calls += 1;
    const names = {
      '小花花': ['xiao', 'hua', 'hua'], '心动盲盒': ['xin', 'dong', 'mang', 'he'],
    };
    const parts = names[text] || [text];
    return options.pattern === 'first' ? parts.map((part) => part[0]) : parts;
  } }, calls: 0,
});
vm.runInContext(`${readFileSync(new URL('../src/gift-panel/search-index.js', import.meta.url), 'utf8')}\n globalThis.index = createGiftSearchIndex();`, searchContext);
const index = searchContext.index;
for (const [name, query] of [
  ['小花花', '小花'], ['小花花', 'xiaohuahua'], ['小花花', ' XIAO HUĀ HUA '],
  ['小花花', 'xhh'], ['心动盲盒', 'xindong'], ['心动盲盒', 'xdmh'],
]) assert(index.matches(name, index.query(query)), `${name}: ${query}`);
assert(!index.matches('小花花', index.query('zzzz')));
assert(!index.matches('小花花', index.query("'")));
assert(index.matches('小花花', index.query('')));
const calls = searchContext.calls;
index.matches('小花花', index.query('hua'));
assert.equal(searchContext.calls, calls, 'typing reuses the cached name index');
console.log('Passed gift query normalization and cached matching checks; real pinned pinyin library is checked by the browser fixture.');

const adapterContext = vm.createContext({});
vm.runInContext(`${readFileSync(new URL('../src/gift-panel/native-gifts.js', import.meta.url), 'utf8')}\n globalThis.adapter = createGiftAdapter();`, adapterContext);
const packageGift = { classList: ['gift-id-package'], getAttribute: () => null, __vue__: { giftInfo: { label: '包裹礼物' } } };
const wrapper = { querySelector: (selector) => selector === '.gift-item' ? packageGift : null };
assert.equal(adapterContext.adapter.read(wrapper), '包裹礼物');
Object.defineProperty(packageGift, '__vue__', { get() { throw new Error('disposed component'); } });
assert.equal(adapterContext.adapter.read(wrapper), '包裹礼物', 'a disposed private component does not interrupt filtering');
