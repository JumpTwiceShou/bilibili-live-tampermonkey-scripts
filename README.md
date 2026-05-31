# Bilibili 特殊页面脚本

这个仓库当前只保留“特殊活动 / 会场页”用的 Tampermonkey 脚本，不再包含普通直播间礼物面板脚本。

## 当前文件

- [bilibili-live-special-layout.user.js](E:/Bilibili/BIlibili/bilibili-live-special-layout.user.js)
  `keep-list` 版本。页面首次加载时会默认把顶部 list 收起一次，之后不再强制干预手动展开。
- [bilibili-live-special-layout-no-list.user.js](E:/Bilibili/BIlibili/bilibili-live-special-layout-no-list.user.js)
  固定 `no-list` 版本。直接隐藏顶部 list。

## 功能范围

- 仅对特殊活动 / 会场页生效。
- 自动识别特殊页结构，不按房间号硬编码。
- 将播放器区域按普通直播间思路放大重排。
- 右侧补齐类似普通直播间的侧栏和关注弹层。
- 点击“返回顶部”回到播放器区域顶部，而不是页面最顶。

## 安装方式

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 二选一导入脚本：
   [bilibili-live-special-layout.user.js](E:/Bilibili/BIlibili/bilibili-live-special-layout.user.js)
   [bilibili-live-special-layout-no-list.user.js](E:/Bilibili/BIlibili/bilibili-live-special-layout-no-list.user.js)
3. 保存并启用。

## 验证版本

脚本启用后，可以在浏览器控制台执行：

```js
document.documentElement.dataset.bliveSpecialLayoutVersion
```

- `keep-list` 版本应返回 `2.1.7`
- `no-list` 版本应返回 `2.1.7-no-list`

## 直播间分区显示插件

- [bilibili-live-room-area-badge.user.js](E:/Bilibili/BIlibili/bilibili-live-room-area-badge.user.js)
  独立的 Tampermonkey 插件。普通直播间和特殊 layout 直播页都会显示当前直播间的父分区 / 子分区，并且分区名称带 B 站分区页超链接。

启用后可以在控制台验证：

```js
document.documentElement.dataset.bliveRoomAreaBadgeVersion
```

期望值：`1.0.10`。
