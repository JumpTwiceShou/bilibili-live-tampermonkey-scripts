# 开发与验证

各插件仍是可独立安装的 Tampermonkey 脚本。源码拆分和复用只发生在本地生成阶段，不增加运行时框架。

## 源码位置

| 插件 | 编辑位置 |
| --- | --- |
| 礼物面板 | `src/gift-panel/`：原生礼物名称适配、拼音索引、搜索 UI、播放器生命周期、样式 |
| 标题与分区 | `src/room-area/`：标题、挂载、房间数据、请求与页面生命周期 |
| 特殊布局 | `src/special-layout/`：尺寸计算、渲染、全屏/iframe、侧栏数据与 UI、初始化、样式 |
| 特殊页跳转 | `src/special-blanc-redirect.user.js` |
| 共享逻辑 | `src/shared/`：页面类型识别、事件/清理作用域 |
| 码率统计 | 根目录 `bilibili-live-video-bitrate-stats.user.js`，直接维护 |

其余根目录 userscript 均带生成说明，请修改对应源码后运行：

```powershell
node scripts/build-userscripts.mjs
```

生成器使用 Node 内置库展开 `/* @include relative-path */`，随后调用现有隐藏列表版生成器。输出包含全部内部模块，保留礼物脚本原有固定版本的 pinyin-pro `@require`。

## 必要检查

```powershell
node scripts/validate-userscripts.mjs
node tests/regressions.mjs
```

第一条检查语法、版本、生成一致性和既有布局/URL 约束，也会解析浏览器测试页的内联脚本；它不执行浏览器交互。第二条检查标题来源、全屏隐藏、实验室链接、过期码率回调，以及礼物查询归一化和缓存。

涉及这些交互或监听器生命周期时，在仓库目录启动仅绑定本机的静态服务器，并复用一个 Playwright CLI 会话：

```powershell
python -m http.server 8766 --bind 127.0.0.1
npx --yes --package @playwright/cli playwright-cli -s=bili-check open http://127.0.0.1:8766/tests/fixtures/gift-search.html
npx --yes --package @playwright/cli playwright-cli -s=bili-check run-code --filename tests/browser-regressions.js
npx --yes --package @playwright/cli playwright-cli -s=bili-check close
```

结束后停止静态服务器。浏览器检查覆盖实际固定版本拼音库、搜索/列表重建、原生礼物事件、请求竞态、码率换视频、布局尺寸/关注缓存、iframe 替换和页面恢复事件，以及生成的隐藏列表版和跳转。所有交互均使用测试页，不会发送真实礼物。

页面恢复和输入法检查使用合成 `pagehide/pageshow`、composition input 事件；真实站点 DOM 漂移、浏览器 bfcache 策略、系统输入法及已安装 Tampermonkey 集成仍以实装检查为准。只运行改动所需的检查，不默认扩展浏览器矩阵或性能基准。
