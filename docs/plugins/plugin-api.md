# 插件 API 完整参考

插件脚本通过全局对象 `window.__PLUGIN_API__` 与启动器交互。本文档列出全部可调用方法、签名、权限要求与示例。

## 全局变量

### __PLUGIN_API_BASE__ — 插件文件地址前缀

L2 沙箱内，启动器会自动注入 `window.__PLUGIN_API_BASE__`，值为当前插件的文件访问基地址：

```
http://localhost:5000/api/plugins/{插件ID}/files
```

可用于动态拼包内资源地址（如图标、图片）：

```js
const iconUrl = `${__PLUGIN_API_BASE__}/dist/icon.svg`
document.getElementById('icon').src = iconUrl
```

内联渲染（无 `l2`）和悬浮窗（overlay iframe）时该变量不存在，相对路径需通过其他方式解析。

## 调用方式

```js
const __PLUGIN_API__ = window.__PLUGIN_API__

// ① 通用 call 方式（绝大多数方法）
const data = await __PLUGIN_API__.call('getSettings')

// ② 专用快捷方式（仅以下 3 个）
await __PLUGIN_API__.registerMethod('name', fn)      // 注册方法
await __PLUGIN_API__.callPlugin('id', 'method', ...) // 调用其他插件方法
await __PLUGIN_API__.proxyFetchStream(req, handlers) // 流式请求
```

## 权限机制

每个 API 方法对应一个权限。调用时启动器会检查插件 manifest 的 `permissions` 是否包含该权限，否则报错：

```
Permission denied: requires <权限id>
```

### 完整权限表

| 权限 ID | 中文 | 风险 |
|---------|------|------|
| `instance:read` | 读取实例列表 | 普通 |
| `instance:write` | 创建/修改/删除实例 | 警告 |
| `account:read` | 读取账号列表 | 普通 |
| `license:read` | 读取许可证信息 | 普通 |
| `config:read` | 读取启动器配置 | 普通 |
| `config:write` | 修改启动器配置 | 警告 |
| `cache:access` | 读写插件缓存 | 普通 |
| `endpoint:discover` | 获取后端 API 端点 | 普通 |
| `page:list` | 获取页面列表 | 普通 |
| `network:fetch` | 发送 HTTP 请求 | 警告 |
| `network:cors_proxy` | CORS 代理请求 | 警告 |
| `network:websocket` | WebSocket 连接 | 警告 |
| `network:proxy` | 修改代理设置 | 警告 |
| `ui:inject_sidebar` | 注入侧边栏菜单 | 普通 |
| `ui:inject_settings` | 注入设置页 | 普通 |
| `ui:picture_in_picture` | 画中画窗口 | 警告 |
| `ui:sub_window` | 独立子窗口 | 警告 |
| `ui:context_menu` | 注入右键菜单 | 普通 |
| `ui:toast` | 应用内通知 | 普通 |
| `ui:navigate` | 跳转页面 | 普通 |
| `system:info` | 读取系统和启动器信息 | 普通 |
| `system:notification` | 发送系统通知 | 普通 |
| `clipboard:read` | 读取剪贴板 | 警告 |
| `clipboard:write` | 写入剪贴板 | 警告 |
| `wasm:execute` | 执行 WASM 模块 | 警告 |
| `plugin:install` | 安装/卸载/更新插件 | 危险 |
| `plugin:list` | 读取已安装插件列表 | 普通 |
| `resource:read` | 读取游戏资源文件 | 普通 |
| `resource:write` | 写入游戏资源文件 | 警告 |
| `java:manage` | 管理 Java 运行时 | 警告 |
| `game:process` | 启停游戏进程 | 警告 |
| `game:log` | 检测游戏日志 | 普通 |
| `connector:host` | 启停联机 | 警告 |
| `connector:scan` | 扫描局域网联机 | 普通 |
| `shell:execute` | 执行系统命令 | 危险 |
| `filesystem:read` | 读取文件系统 | 警告 |
| `filesystem:write` | 写入文件系统 | 危险 |

::: tip
「风险」用于安装详情弹窗的视觉提示：普通=蓝、警告=黄、危险=红。声明权限时遵循**最小权限原则**，只声明你真正用到的。
:::

## 方法参考

### getSettings — 读取插件配置

读取插件自己的 `settings.json`。

```js
const settings = await __PLUGIN_API__.call('getSettings')
```
- 权限：`config:read`
- 返回：`Record<string, unknown>`（无文件时返回 `{}`）
- 存储位置：`{数据目录}/plugins/{插件id}/settings.json`

### setSettings — 写入插件配置

按 key 合并写入配置（**合并而非覆盖整个文件**）。

```js
await __PLUGIN_API__.call('setSettings', 'theme', 'dark')
```
- 权限：`config:write`
- 参数：`(key: string, value: any)`，value 可为任意 JSON 值
- 并发写入由后端加锁保护

### setCache / getCache — 插件缓存

按 key 读写插件自己的缓存文件，支持 TTL 过期。

```js
// 写缓存，TTL 1 小时（3600 秒）
await __PLUGIN_API__.call('setCache', 'modelList', { items: [...] }, 3600)

// 读缓存（不存在或过期返回 null）
const cached = await __PLUGIN_API__.call('getCache', 'modelList')
```
- 权限：`cache:access`
- 存储位置：`{数据目录}/plugins/{插件id}/cache.json`
- 内部结构 `{ key: { v: 值, e: 过期时间戳|null } }`，无需插件关心

### callBackend — 调用启动器后端 API

直接请求启动器后端（`http://localhost:5000/api/...`），绕过 CORS 限制。

```js
const instances = await __PLUGIN_API__.call('callBackend', '/instance')

const result = await __PLUGIN_API__.call('callBackend', '/resource-download/start', {
  instanceId: 'xxx', url: 'https://...', fileName: 'mod.jar', category: 'mods'
})
```
- 权限：`network:fetch`
- 参数：`(endpoint: string, data?: any)`
  - 有 `data` → POST；无 `data` → GET
  - `data` 对象中可传入 `_method` 字段覆盖 HTTP 方法（如 `{ _method: 'PUT', State: 'active' }`），`_method` 不会被发送到后端
  - `endpoint` 以 `/` 开头（如 `/instance`），不含 `/api` 前缀
- 返回：后端 JSON 响应；非 2xx 抛错
- 可用端点清单：见启动器后端 OpenAPI（开发模式 `/openapi/v1.json`），常用如 `/instance`、`/resources/search`、`/settings` 等

::: tip 在沙箱中打开外部链接
L2 沙箱（`sandbox="allow-scripts"`，无 `allow-popups`）里 `window.open(url, '_blank')` 会被拦截。要打开外部链接，应通过后端端点：

```js
await __PLUGIN_API__.call('callBackend', '/system/open-url', { url: 'https://example.com' })
```

该端点使用系统默认浏览器打开 `http/https` 链接（仅接受这两种协议，其余返回 400）。
:::

### proxyFetch — CORS 代理请求

经启动器后端转发请求任意外部 URL，绕开浏览器 CORS 限制，且带 SSRF 防护。

```js
const res = await __PLUGIN_API__.call('proxyFetch', {
  url: 'https://api.example.com/data',
  method: 'GET',
  headers: { 'Accept': 'application/json' },
  timeoutMs: 15000
})
if (res.status === 200) {
  const data = JSON.parse(res.body)   // 文本响应
}
```
- 权限：`network:cors_proxy`
- 请求 `ProxyRequest`：
  ```ts
  {
    url: string                // 必填，http/https
    method?: string            // 默认 GET
    headers?: Record<string, string>
    body?: string              // POST body（字符串）
    timeoutMs?: number         // 默认 15000，范围 1000–60000
  }
  ```
- 响应 `ProxyResponse`：
  ```ts
  {
    status: number
    headers: Record<string, string>
    body?: string | null       // 文本响应
    bodyBase64?: string | null // 二进制响应
  }
  ```
- **SSRF 防护**：仅 http/https；禁止内网/保留地址（localhost、127.x、10.x、172.16-31.x、192.168.x、169.254.x 等），返回 `PROXY_PRIVATE_ADDRESS`(400)

### proxyFetchStream — 流式代理请求

消费 SSE 流（如 AI 对话逐字输出），逐块回调。

```js
await __PLUGIN_API__.proxyFetchStream(
  {
    url: 'https://api.deepseek.com/v1/chat/completions',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model, messages, stream: true }),
    timeoutMs: 120000,
    signal: abortController.signal    // 可选，中断流
  },
  {
    onChunk(chunk) {
      // chunk 为 SSE data: 行内容（已去 data: 前缀）
      const json = JSON.parse(chunk)
      const delta = json.choices?.[0]?.delta?.content
      if (delta) appendText(delta)
    },
    onError(err) { console.error(err) }
  }
)
```
- 权限：`network:cors_proxy`
- 后端自动带 `stream: true` 转发上游流
- `signal`（AbortSignal）用于中断；`req.signal` 经 postMessage 前自动剥离，改走 `__plugin_api_abort` 消息
- ⚠️ **已知限制**：`proxyFetchStream` 返回的 Promise 在流结束时 resolve，但 chunk 回调可能在 resolve 之后仍触发，建议以 `onError` / 流内 `[DONE]` 标记判断完成

### registerMethod — 注册插件方法

将当前插件的方法注册到全局注册表，供**其他插件**通过 `callPlugin` 调用。

```js
__PLUGIN_API__.registerMethod('renderMarkdown', function (md) {
  return marked.parse(md || '')
})

// 支持异步方法
__PLUGIN_API__.registerMethod('fetchTranslation', async function (text) {
  const res = await fetch('https://api.example.com/translate?text=' + encodeURIComponent(text))
  return res.json()
})
```
- 权限：`config:write`
- 参数：`(method: string, fn: Function)`，fn 返回值为值或 Promise
- 插件停用时自动注销所有方法
- 详细见 [插件依赖与互调用](./dependencies)

### callPlugin — 调用其他插件方法

调用目标插件已注册的方法。

```js
try {
  const html = await __PLUGIN_API__.callPlugin('top.qomicex.markdown', 'renderMarkdown', '**加粗**')
  document.getElementById('out').innerHTML = html
} catch (e) {
  console.error(e.message)   // 目标未安装/未激活/未注册都会 reject
}
```
- 权限：`network:fetch`
- 参数：`(pluginId: string, method: string, ...args)`
- 目标未安装 / 未激活 / 方法未注册 → reject

### callWasm — 调用 WASM 插件导出函数

调用 L3 WASM 插件导出的函数（`on_load` / `on_unload` / 自定义导出）。经启动器 Rust 网关（wasmtime）执行。

```js
const result = await __PLUGIN_API__.callWasm('dev.example.wasmplugin', 'on_load')
```
- 权限：`wasm:execute`
- 参数：`(pluginId: string, exportName?: string)`，`exportName` 缺省 `on_load`
- 返回：`{ ok: true, result: ... }` 或错误
- 详细见 [WASM 插件](./wasm-plugin)

### listWasmPlugins — 列出已加载的 WASM 插件

```js
const ids = await __PLUGIN_API__.listWasmPlugins()   // ['dev.example.wasmplugin', ...]
```
- 权限：`wasm:execute`

### navigate — 跳转页面

跳转到启动器内部路由。

```js
await __PLUGIN_API__.call('navigate', '/settings')
```
- 权限：`config:read`
- 注意：应使用启动器内部路由，勿用外部 URL

### showToast — 应用内通知

弹出一条 toast 提示。

```js
await __PLUGIN_API__.call('showToast', '操作成功', 'success')
```
- 权限：`ui:toast`
- 参数：`(message: string, type?: 'info' | 'error' | 'success')`，默认 `info`

### getSystemInfo — 读取系统与启动器信息

读取操作系统、启动器与内存信息，可用于 `minLauncherVersion` 兼容检查或运行时判断平台。

```js
const info = await __PLUGIN_API__.call('getSystemInfo')
// { Os: 'windows'|'linux'|'osx', Architecture, OsName, OsVersion, OsVersionId, OsDisplayName, GitCommit, Memory, AvailableMemory }
```
- 权限：`system:info`
- 后台走 `GET /api/systeminfo`（与 `/api/system/info` 等价）
- `GitCommit` 为启动器 Git 提交哈希；`Memory` / `AvailableMemory` 为字节数

### openUrl — 用系统浏览器打开外部链接

L2 沙箱内 `window.open` 会被 `sandbox` 拦截，请用此方法打开外链。

```js
await __PLUGIN_API__.call('openUrl', 'https://example.com')
```
- 权限：`system:notification`
- 后台走 `POST /api/system/open-url`，仅接受 `http://` / `https://`

### listPlugins — 列出已安装插件

返回已安装插件列表（id/name/version/状态），可用于依赖检测或商店联动。

```js
const plugins = await __PLUGIN_API__.call('listPlugins')
// [{ id, name, version, status }, ...]  status: 'installed'|'active'|'disabled'
```
- 权限：`plugin:list`
- 后台走 `GET /api/plugins/`

### overlay.create — 创建悬浮窗

创建一个可拖拽的独立悬浮窗，返回悬浮窗 id。

```js
const overlayId = await __PLUGIN_API__.call('overlay.create', {
  title: '我的悬浮窗',
  html: '<div class="p-card">你好</div>',
  x: 120, y: 80,
  width: 320, height: 240,
  minimizable: true,
  resizable: true
})
```
- 权限：`ui:sub_window`
- 返回：悬浮窗 id（string）
- 详细见 [悬浮窗开发](./overlay)

### overlay.show / hide / destroy — 悬浮窗控制

```js
await __PLUGIN_API__.call('overlay.show', overlayId)    // 显示（含最小化恢复）
await __PLUGIN_API__.call('overlay.hide', overlayId)    // 隐藏（最小化）
await __PLUGIN_API__.call('overlay.destroy', overlayId) // 销毁
```
- 权限：`ui:sub_window`

### overlay.setHtml — 更新悬浮窗内容

```js
await __PLUGIN_API__.call('overlay.setHtml', overlayId, '<p>新内容</p>')
```
- 权限：`ui:sub_window`

### overlay.setPosition — 移动悬浮窗

```js
await __PLUGIN_API__.call('overlay.setPosition', overlayId, 300, 200)
```
- 权限：`ui:sub_window`

### uploadPlugin — 安装插件

上传 `.qplugin` 文件安装插件。

```js
const result = await __PLUGIN_API__.call('uploadPlugin', fileData, 'my-plugin.qplugin')
```
- 权限：`plugin:install`
- 参数：`(fileData: ArrayBuffer | Uint8Array, fileName: string)`

### readText — 读取文本文件

读取文件系统上的文本文件。

```js
const content = await __PLUGIN_API__.call('readText', '/path/to/file.txt')
```
- 权限：`filesystem:read`
- 参数：`(path: string, options?: { encoding?: string })`

### readBytes — 读取二进制文件

读取文件系统上的二进制文件，返回 `Uint8Array`。

```js
const bytes = await __PLUGIN_API__.call('readBytes', '/path/to/file.bin')
```
- 权限：`filesystem:read`
- 参数：`(path: string)`

### writeText — 写入文本文件

```js
await __PLUGIN_API__.call('writeText', '/path/to/file.txt', 'hello world')
```
- 权限：`filesystem:write`
- 参数：`(path: string, content: string)`

### writeBytes — 写入二进制文件

```js
await __PLUGIN_API__.call('writeBytes', '/path/to/file.bin', new Uint8Array([1, 2, 3]))
```
- 权限：`filesystem:write`
- 参数：`(path: string, bytes: Uint8Array)`

### execCommand — 执行系统命令

执行系统命令，返回标准输出。

```js
const result = await __PLUGIN_API__.call('execCommand', 'ls -la', 30000)
// { stdout: '...', stderr: '...', exitCode: 0 }
```
- 权限：`shell:execute`
- 参数：`(command: string, timeoutMs?: number)`，`timeoutMs` 默认 30000

### addMenuItem — 动态注册侧边栏菜单项

运行时动态向侧边栏添加菜单项，无需修改 manifest。

```js
__PLUGIN_API__.addMenuItem({
  path: '/plugins/p/xxx',
  label: '动态菜单',
  icon: '🤖',
  action: 'page'
})
```
- 权限：无（无需在 manifest 声明）
- 参数：`PluginMenuItem`（同 `contributes.menuItems` 元素）
- 插件停用时自动移除动态注册的菜单项

## 错误处理

所有 API 调用失败会 reject，错误信息形如：

```js
try {
  await __PLUGIN_API__.call('getSettings')
} catch (e) {
  console.error(e.message)
}
```

常见错误：
- `Permission denied: requires xxx` — manifest 权限未包含
- `Backend error: 404` — `callBackend` 端点不存在
- `Proxy failed: 400` — `proxyFetch` 参数错误（含 SSRF 拦截）
- `插件 xxx 未提供方法 yyy（可能未安装或未激活）` — `callPlugin` 目标不可用
