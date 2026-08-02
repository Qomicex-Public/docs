# 开发要点与避坑指南

收集插件开发中最容易踩的坑，帮助第三方开发者避免重复犯错。

## 渲染机制与脚本执行

### 内联渲染如何工作

插件有两种渲染模式，由 `layers` 决定：

| 模式 | 触发 | 渲染方式 | 脚本执行时机 |
|------|------|---------|-------------|
| **L2 iframe 沙箱** | manifest `layers` 含 `l2` | `<iframe sandbox="allow-scripts">` + `srcdoc` | srcdoc 解析时自动执行 |
| **内联渲染** | 不含 `l2` | 剥壳后注入主界面容器 | 激活加载时立即执行 |

### L2 iframe 沙箱

- 与主界面完全隔离（独立 window），脚本随 `srcdoc` 自动执行
- 支持全部 `__PLUGIN_API__` 方法、`.p-*` 样式、`registerMethod`/`callPlugin`（经主窗口中转）
- 插件脚本无法直接访问主界面 DOM（安全隔离），`document.getElementById('root')` 是插件自己的内容

### 内联渲染

启动器把插件 HTML 的 `<!DOCTYPE>/<html>/<head>/<body>` 剥掉后，注入到主界面的一个容器里，并追加插件 API 桥接脚本。

**关键结论：**

1. **脚本在插件激活加载时立即执行**。`container.innerHTML = ...` 本身不会执行 `<script>`，启动器会把容器临时挂载到隐藏宿主节点（保证已连接 document）后，再逐个 `replaceWith` 重新解析脚本节点触发执行。因此：
   - **库插件（如 MarkdownLib）激活即可 `registerMethod`**，无需用户进入插件页面
   - 依赖方插件启动时即可 `callPlugin` 到已激活的前置插件方法
2. **`sourceMap` 归属以最后加载的内联插件为准**：多个内联插件共享主 window，`sourceMap` 会把最后激活的插件 id 关联到 window，可能导致归属错位。涉及多个插件同时调 API 时，注意确认插件 id 正确。

### 脚本内的 document 访问

内联模式下插件脚本与主界面**同 window 上下文**。`PluginPage` 会把 `document.getElementById('root')` 临时劫持为插件容器。所以：
- 不要依赖全局 `document` 查询主界面元素
- 用 `document.getElementById('root')` 获取自己的容器（当前实现下可行）

::: tip
需要隔离环境、常驻脚本（AI 助手、工具面板）→ 用 `["l2"]` 沙箱。纯 UI/依赖主界面 DOM 的轻量插件 → 不声明 l2，走内联。
:::

## API 调用注意事项

### 函数不能经 postMessage 传输

插件 API 跨窗口调用使用 `postMessage`（结构化克隆），**函数不可克隆**。因此：
- 只传可序列化数据（字符串、数字、对象、数组）
- `registerMethod` 的 `fn` 保留在插件所在 window 本地，消息里只传方法名
- `proxyFetchStream` 的 `req.signal`（AbortSignal）在发送前被自动剥离，改走专用 abort 消息，**不要依赖把 AbortSignal 放进 req 直接传**

### proxyFetchStream 的完成判定

```js
await __PLUGIN_API__.proxyFetchStream(req, {
  onChunk(c) { /* 处理 SSE data 行 */ },
  onError(e) { /* 流中断 */ }
})
```
- 返回的 Promise 在流结束 resolve，但 **chunk 回调可能在 resolve 之后仍触发**
- 建议在 chunk 里检测 SSE 的 `[DONE]` 标记或业务结束标志来判断完成，不要只用 Promise resolve

### 相对路径 vs 绝对 URL

- 插件文件（HTML/JS/CSS）里的相对资源路径会被重写为 `{API_BASE}/plugins/{id}/files/...`，**不要硬编码 `/api/plugins/...` 相对路径**（打包后无 Vite proxy）
- 外部资源（CDN 脚本、图片）用完整 `https://` URL

## 依赖与激活

### 库插件必须声明 entry.frontend

`activatePlugin` 只在 `entry.frontend` 存在时才激活插件（渲染、注册方法、标记 active）。**省略 frontend 的插件不会被激活**，方法无法注册。库插件即使不做 UI 也需提供一个空页面。

### 纯 l3 图层不自动激活

manifest `layers` 若全部为 `l3`，`installed` 状态的插件**不会自动激活**（需用户手动启用）。库插件若想"装上即用"，注意这一行为，或引导用户启用。

### 激活顺序已自动处理

启动器用拓扑排序保证被依赖插件先激活，无需关心 manifest 声明顺序。

### 状态切换需重启

插件启用/禁用开关的改动**重启启动器后生效**（`PUT /api/plugins/{id}/state`），运行中不会热激活。用户测试新插件时注意提示。

## manifest 注意事项

- `minLauncherVersion` 当前**未校验**，但请填写以兼容未来
- 后端对 `permissions` 仅存储不校验；**前端运行时**按 `METHOD_PERMISSIONS` 表校验，manifest 缺权限 → API 调用报 `Permission denied`
- `contributes.commands` / `downloadSources` / `settingsPages` 当前**未使用**，勿依赖
- 安装接口（upload）不做依赖检查；目录安装（install）才检查必装依赖

## 后端行为

- `POST /api/plugins/upload` 文件字段名为 `plugin`（multipart）
- `proxyFetch` 有 SSRF 防护：禁止内网/保留地址。本地调试代理时注意（`localhost` 会被拦截）
- 插件配置/缓存按插件 id 隔离，路径 `{数据目录}/plugins/{id}/`
- 覆盖安装会**先删旧目录**（`plugins/{id}/`）再复制

## 调试建议

- 插件页面脚本错误在启动器 DevTools（Ctrl+Shift+I）控制台可见，日志带 `[plugin:inline]` / `[sandbox]` 前缀
- API 调用失败信息会在控制台输出（`[API]` 前缀），含状态码与错误码
- 检查插件是否真的激活：插件列表的状态；已激活插件 `state === 'active'`
- 检查依赖：`sortByDependencies` 会跳过缺失依赖并 warn 日志
