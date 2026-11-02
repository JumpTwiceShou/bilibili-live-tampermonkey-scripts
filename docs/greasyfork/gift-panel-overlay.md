## 功能

重构 B 站直播礼物大面板布局，将面板固定在播放器右下角并保持两行高度，避免礼物面板把视频挤小。

## 使用方法

安装后进入 B 站普通直播间，展开礼物大面板即可生效。礼物列表超出两行时会在面板内部滚动。

在“包裹”右侧的搜索框输入礼物名称，可实时筛选当前标签中的礼物。支持中文、拼音全拼、拼音首字母及部分名称，不区分英文大小写。例如输入“小花花”、`xiaohuahua`、`xiao hua hua` 或 `xhh` 均可匹配“小花花”；输入 `xindong` 或 `xdmh` 可匹配“心动盲盒”。清空搜索框或按 Esc 恢复完整列表；没有匹配项时显示提示。切换标签后会继续使用当前关键词。

拼音转换使用固定版本的 pinyin-pro，由脚本管理器通过 `@require` 加载；每个礼物名称的拼音和首字母会缓存复用。

播放器或礼物列表重建、页面后退恢复后会自动重新绑定搜索，并保留当前关键词。

## 截图

### 修改前

![修改前](https://raw.githubusercontent.com/JumpTwiceShou/bilibili-live-tampermonkey-scripts/main/docs/images/gift-panel-before.png)

### 修改后

![修改后](https://raw.githubusercontent.com/JumpTwiceShou/bilibili-live-tampermonkey-scripts/main/docs/images/gift-panel-after.png)

## 源码与反馈

- GitHub：https://github.com/JumpTwiceShou/bilibili-live-tampermonkey-scripts
- 问题反馈：https://github.com/JumpTwiceShou/bilibili-live-tampermonkey-scripts/issues

## 许可证

GPL-3.0-only
