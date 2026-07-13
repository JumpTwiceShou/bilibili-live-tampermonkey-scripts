// ==UserScript==
// @name         B站直播视频统计面板画面码率
// @name:en      Bilibili Live Video Bitrate Stats
// @name:zh-CN   B站直播视频统计面板画面码率
// @namespace    https://live.bilibili.com/
// @version      1.1.0
// @description  在 B 站直播播放器右键视频统计信息面板的 FPS 右侧显示估算画面码率。
// @description:en Show estimated video bitrate next to FPS in Bilibili Live's video stats panel.
// @description:zh-CN 在 B 站直播播放器右键视频统计信息面板的 FPS 右侧显示估算画面码率。
// @match        https://live.bilibili.com/*
// @exclude      https://live.bilibili.com/p/*
// @run-at       document-start
// @grant        none
// @license      GPL-3.0-only
// @supportURL   https://github.com/JumpTwiceShou/bilibili-live-tampermonkey-scripts/issues
// ==/UserScript==

(function () {
  'use strict';

  const INSTALL_FLAG = '__bliveVideoBitrateStatsInstalled';
  if (window[INSTALL_FLAG]) {
    return;
  }

  Object.defineProperty(window, INSTALL_FLAG, {
    value: true,
    configurable: false
  });

  const VERSION = '1.1.0';
  const STYLE_ID = 'blive-video-bitrate-stats-style';
  const VALUE_CLASS = 'blive-video-bitrate-stats-value';
  const DROPPED_FRAMES_ROW_ID = 'p-video-info-droppedFrames';
  const AUDIO_INFO_ROW_ID = 'p-video-info-audioInfo';
  const STATS_PANEL_SELECTOR = '.web-player-video-info-panel';
  const LINE_DATA_SELECTOR = '.web-player-line-data';
  const WINDOW_SECONDS = 10;
  const MIN_SAMPLE_SECONDS = 2;
  const STALE_MS = 12000;
  const UPDATE_MS = 1000;
  const HOOK_RETRY_MS = 50;
  const HOOK_RETRY_LIMIT = 80;

  const sourceBufferMeta = new WeakMap();
  const samples = [];
  const state = {
    totalSeconds: 0,
    totalBytes: 0,
    lastSampleAt: 0,
    lastVideo: null,
    audioBitrateBps: 0,
    updateTimer: 0,
    attachRaf: 0,
    observer: null,
    hookRetryCount: 0,
    hookRetryTimer: 0
  };

  exposeVersion();
  startMediaSourceHooks();
  startDomHooks();

  function startMediaSourceHooks() {
    try {
      installMediaSourceHooks();
    } catch (_err) {
      retryMediaSourceHooks();
    }
  }

  function exposeVersion() {
    if (document.documentElement) {
      document.documentElement.dataset.bliveVideoBitrateStatsVersion = VERSION;
      return;
    }

    document.addEventListener(
      'DOMContentLoaded',
      () => {
        if (document.documentElement) {
          document.documentElement.dataset.bliveVideoBitrateStatsVersion = VERSION;
        }
      },
      { once: true }
    );
  }

  function installMediaSourceHooks() {
    const MediaSourceCtor = window.MediaSource;
    const SourceBufferCtor = window.SourceBuffer;
    if (!MediaSourceCtor || !SourceBufferCtor) {
      retryMediaSourceHooks();
      return;
    }

    const addSourceBuffer = MediaSourceCtor.prototype && MediaSourceCtor.prototype.addSourceBuffer;
    const appendBuffer = SourceBufferCtor.prototype && SourceBufferCtor.prototype.appendBuffer;
    if (typeof addSourceBuffer !== 'function' || typeof appendBuffer !== 'function') {
      retryMediaSourceHooks();
      return;
    }

    if (!MediaSourceCtor.prototype.__bliveVideoBitrateStatsAddWrapped) {
      Object.defineProperty(MediaSourceCtor.prototype, '__bliveVideoBitrateStatsAddWrapped', {
        value: true,
        configurable: false
      });

      MediaSourceCtor.prototype.addSourceBuffer = function wrappedAddSourceBuffer(mimeType) {
        const sourceBuffer = addSourceBuffer.apply(this, arguments);
        const parsed = parseMimeType(mimeType);
        if (parsed.hasVideo || parsed.hasAudio) {
          sourceBufferMeta.set(sourceBuffer, parsed);
        }
        return sourceBuffer;
      };
    }

    if (!SourceBufferCtor.prototype.__bliveVideoBitrateStatsAppendWrapped) {
      Object.defineProperty(SourceBufferCtor.prototype, '__bliveVideoBitrateStatsAppendWrapped', {
        value: true,
        configurable: false
      });

      SourceBufferCtor.prototype.appendBuffer = function wrappedAppendBuffer(data) {
        const meta = sourceBufferMeta.get(this);
        const bytes = getByteLength(data);
        const video = getPrimaryVideo();
        const before = meta && meta.hasVideo ? getBufferedSummary(this, video) : null;

        const result = appendBuffer.apply(this, arguments);

        if (meta && meta.hasVideo && bytes > 0) {
          trackAppend(this, meta, bytes, before, video);
        }

        return result;
      };
    }
  }

  function retryMediaSourceHooks() {
    if (state.hookRetryTimer || state.hookRetryCount >= HOOK_RETRY_LIMIT) {
      return;
    }

    state.hookRetryCount += 1;
    state.hookRetryTimer = window.setTimeout(() => {
      state.hookRetryTimer = 0;
      startMediaSourceHooks();
    }, HOOK_RETRY_MS);
  }

  function trackAppend(sourceBuffer, meta, bytes, before, video) {
    let handled = false;

    const finish = () => {
      if (handled) {
        return;
      }
      handled = true;

      const after = getBufferedSummary(sourceBuffer, video || getPrimaryVideo());
      if (!before || !after) {
        return;
      }

      if (before.end > 0 && after.end + 1 < before.end) {
        resetSamples();
        return;
      }

      const seconds = getAppendedSeconds(before, after);
      if (seconds <= 0 || seconds > 30) {
        return;
      }

      addSample({
        bytes,
        seconds,
        mixed: meta.hasVideo && meta.hasAudio,
        audioBitrateBps: state.audioBitrateBps
      });
    };

    try {
      sourceBuffer.addEventListener('updateend', finish, { once: true });
    } catch (_err) {
      window.setTimeout(finish, 0);
    }
  }

  function parseMimeType(mimeType) {
    const text = String(mimeType || '').toLowerCase();
    const hasVideo =
      text.startsWith('video/') || /(?:avc|hev|hvc|av01|vp0?9|vp8|theora)/i.test(text);
    const hasAudio = text.startsWith('audio/') || /(?:mp4a|opus|vorbis|aac|flac|ac-3|ec-3)/i.test(text);
    return {
      mimeType: String(mimeType || ''),
      hasVideo,
      hasAudio
    };
  }

  function getByteLength(data) {
    if (!data) {
      return 0;
    }
    if (typeof data.byteLength === 'number') {
      return data.byteLength;
    }
    if (data.buffer && typeof data.buffer.byteLength === 'number') {
      return data.buffer.byteLength;
    }
    return 0;
  }

  function getPrimaryVideo() {
    const video = document.querySelector('video');
    if (video && state.lastVideo && video !== state.lastVideo) {
      resetSamples(true);
    }
    if (video) {
      state.lastVideo = video;
    }
    return video;
  }

  function getBufferedSummary(sourceBuffer, video) {
    const ranges = safeRanges(sourceBuffer && sourceBuffer.buffered) || safeRanges(video && video.buffered);
    if (!ranges || !ranges.length) {
      return {
        total: 0,
        start: 0,
        end: 0
      };
    }

    let total = 0;
    for (const range of ranges) {
      total += Math.max(0, range.end - range.start);
    }

    return {
      total,
      start: ranges[0].start,
      end: ranges[ranges.length - 1].end
    };
  }

  function safeRanges(timeRanges) {
    if (!timeRanges || typeof timeRanges.length !== 'number') {
      return null;
    }

    try {
      const ranges = [];
      for (let i = 0; i < timeRanges.length; i += 1) {
        ranges.push({
          start: Number(timeRanges.start(i)),
          end: Number(timeRanges.end(i))
        });
      }
      return ranges.filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end));
    } catch (_err) {
      return null;
    }
  }

  function getAppendedSeconds(before, after) {
    const endDelta = after.end - before.end;
    if (endDelta > 0.001) {
      return endDelta;
    }

    const totalDelta = after.total - before.total;
    if (totalDelta > 0.001) {
      return totalDelta;
    }

    return 0;
  }

  function addSample(sample) {
    samples.push({
      bytes: sample.bytes,
      seconds: sample.seconds,
      wallTime: Date.now(),
      mixed: sample.mixed,
      audioBitrateBps: sample.audioBitrateBps
    });
    state.totalBytes += sample.bytes;
    state.totalSeconds += sample.seconds;
    state.lastSampleAt = Date.now();
    trimSamples();
    scheduleTextUpdate();
  }

  function trimSamples() {
    while (samples.length && state.totalSeconds > WINDOW_SECONDS) {
      const first = samples[0];
      const excess = state.totalSeconds - WINDOW_SECONDS;
      if (first.seconds <= excess + 0.001) {
        samples.shift();
        state.totalSeconds -= first.seconds;
        state.totalBytes -= first.bytes;
        continue;
      }

      const keepSeconds = first.seconds - excess;
      const ratio = keepSeconds / first.seconds;
      const removedBytes = first.bytes * (1 - ratio);
      first.seconds = keepSeconds;
      first.bytes *= ratio;
      state.totalSeconds -= excess;
      state.totalBytes -= removedBytes;
      break;
    }

    state.totalSeconds = Math.max(0, state.totalSeconds);
    state.totalBytes = Math.max(0, state.totalBytes);
  }

  function resetSamples(resetAudio) {
    samples.length = 0;
    state.totalSeconds = 0;
    state.totalBytes = 0;
    state.lastSampleAt = 0;
    if (resetAudio) {
      state.audioBitrateBps = 0;
    }
    scheduleTextUpdate();
  }

  function getCurrentBitrate() {
    if (state.totalSeconds < MIN_SAMPLE_SECONDS) {
      return null;
    }
    if (!state.lastSampleAt || Date.now() - state.lastSampleAt > STALE_MS) {
      return null;
    }

    let audioBits = 0;
    let hasUnknownAudioMixedSamples = false;
    for (const sample of samples) {
      if (sample.mixed) {
        if (sample.audioBitrateBps > 0) {
          audioBits += sample.audioBitrateBps * sample.seconds;
        } else {
          hasUnknownAudioMixedSamples = true;
        }
      }
    }

    const videoBps = Math.max(0, ((state.totalBytes * 8) - audioBits) / state.totalSeconds);
    return {
      mbps: videoBps / 1000000,
      approx: hasUnknownAudioMixedSamples
    };
  }

  function startDomHooks() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDomHooks, { once: true });
    } else {
      initDomHooks();
    }
  }

  function initDomHooks() {
    ensureStyle();
    scheduleAttach();
    scheduleTextUpdate();
    if (!state.observer && document.documentElement) {
      state.observer = new MutationObserver((records) => {
        if (mutationsTouchStatsPanel(records)) {
          scheduleAttach();
        }
      });
      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  function nodeChangesStatsMount(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    const selector = [
      STATS_PANEL_SELECTOR,
      `#${DROPPED_FRAMES_ROW_ID}`,
      `#${AUDIO_INFO_ROW_ID}`,
      `.${VALUE_CLASS}`
    ].join(',');
    return node.matches(selector) || Boolean(node.querySelector(selector));
  }

  function mutationsTouchStatsPanel(records) {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (nodeChangesStatsMount(node)) {
          return true;
        }
      }
      for (const node of record.removedNodes) {
        if (nodeChangesStatsMount(node)) {
          return true;
        }
      }
    }
    return false;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${DROPPED_FRAMES_ROW_ID} .${VALUE_CLASS} {
  display: inline-block;
  margin-left: 12px;
  min-width: 112px;
  color: #dff6ff;
  font-weight: 500;
  white-space: nowrap;
  vertical-align: top;
}
`;
    (document.head || document.documentElement).appendChild(style);
  }

  function scheduleAttach() {
    if (state.attachRaf) {
      return;
    }

    state.attachRaf = window.requestAnimationFrame(() => {
      state.attachRaf = 0;
      attachBitrateNode();
    });
  }

  function attachBitrateNode() {
    const panel = document.querySelector(STATS_PANEL_SELECTOR);
    const row = document.getElementById(DROPPED_FRAMES_ROW_ID);
    if (!panel || !row || !panel.contains(row)) {
      return;
    }

    readAudioBitrate();
    let valueNode = row.querySelector(`.${VALUE_CLASS}`);
    if (!valueNode) {
      valueNode = document.createElement('span');
      valueNode.className = VALUE_CLASS;
      valueNode.textContent = '画面码率: --';
      valueNode.title = '按播放器实际追加的媒体字节和新增缓冲时长估算的 10 秒平均画面码率';

      const lineData = row.querySelector(LINE_DATA_SELECTOR);
      if (lineData && lineData.parentNode === row) {
        lineData.insertAdjacentElement('afterend', valueNode);
      } else {
        row.appendChild(valueNode);
      }
    }

    updateValueNode(valueNode);
    scheduleTextUpdate();
  }

  function readAudioBitrate() {
    const row = document.getElementById(AUDIO_INFO_ROW_ID);
    if (!row) {
      return;
    }

    const text = String(row.textContent || '');
    const mbpsMatch = text.match(/(\d+(?:\.\d+)?)\s*Mbps/i);
    if (mbpsMatch) {
      state.audioBitrateBps = Number(mbpsMatch[1]) * 1000000;
      return;
    }

    const kbpsMatch = text.match(/(\d+(?:\.\d+)?)\s*Kbps/i);
    if (kbpsMatch) {
      state.audioBitrateBps = Number(kbpsMatch[1]) * 1000;
      return;
    }
    state.audioBitrateBps = 0;
  }

  function scheduleTextUpdate() {
    if (state.updateTimer) {
      return;
    }

    state.updateTimer = window.setTimeout(() => {
      state.updateTimer = 0;
      if (updateVisibleText()) {
        scheduleTextUpdate();
      }
    }, UPDATE_MS);
  }

  function updateVisibleText() {
    getPrimaryVideo();
    readAudioBitrate();
    const valueNode = document.querySelector(`#${DROPPED_FRAMES_ROW_ID} .${VALUE_CLASS}`);
    if (!valueNode) {
      return false;
    }
    updateValueNode(valueNode);
    return true;
  }

  function updateValueNode(valueNode) {
    const bitrate = getCurrentBitrate();
    if (!bitrate) {
      valueNode.textContent = '画面码率: --';
      valueNode.title = '等待足够的播放器缓冲样本';
      return;
    }

    const prefix = bitrate.approx ? '约' : '';
    valueNode.textContent = `画面码率: ${prefix}${formatMbps(bitrate.mbps)}Mbps`;
    valueNode.title = bitrate.approx
      ? '近 10 秒媒体平均码率；当前无法从统计面板扣除音频码率，数值包含音频部分'
      : '近 10 秒媒体平均码率；混合音视频流会按统计面板 Audio Info 扣除音频码率';
  }

  function formatMbps(value) {
    if (!Number.isFinite(value) || value <= 0) {
      return '0.00';
    }
    if (value >= 100) {
      return value.toFixed(0);
    }
    if (value >= 10) {
      return value.toFixed(1);
    }
    return value.toFixed(2);
  }
})();
