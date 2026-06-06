## 功能

在 B 站直播播放器右键菜单的“视频统计信息”面板中，为 `Decoded Frames` 行追加近 10 秒平均画面码率。

脚本不会复用面板自带的 `Download Bitrate`，因为那一项是网络下载吞吐。本脚本会根据播放器实际追加到 MediaSource 的媒体字节数和新增缓冲时长估算内容码率；如果当前流是混合音视频流，会优先按面板里的 `Audio Info` 扣除音频码率。

## 使用方法

安装后进入 B 站直播间，右键播放器并选择“视频统计信息”。当播放器累积到足够的媒体缓冲样本后，`Decoded Frames` 行的 FPS 右侧会显示 `画面码率: x.xxMbps`。

如果刚打开页面、刚切换清晰度、播放器重建或长时间没有新媒体样本，脚本会显示 `画面码率: --`，等待新样本后自动恢复。

## 截图

![视频统计面板画面码率](https://raw.githubusercontent.com/JumpTwiceShou/bilibili-live-tampermonkey-scripts/main/docs/images/video-bitrate-stats.png)

## 源码与反馈

- GitHub：https://github.com/JumpTwiceShou/bilibili-live-tampermonkey-scripts
- 问题反馈：https://github.com/JumpTwiceShou/bilibili-live-tampermonkey-scripts/issues

## 许可证

GPL-3.0-only
