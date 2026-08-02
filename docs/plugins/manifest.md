# manifest 清单详解

`manifest.json` 是插件的身份文件，位于 `.qplugin` 包根目录。它描述插件的元信息、权限、入口和扩展点。

## 完整结构

```json
{
  "id": "top.qomicex.assistant",
  "name": "AI 助手",
  "version": "1.2.0",
  "minLauncherVersion": "0.1.0",
  "layers": ["l3"],
  "permissions": ["ui:toast", "config:read", "config:write", "network:cors_proxy"],
  "dependencies": [
    { "id": "top.qomicex.markdown", "version": ">=1.0.0" }
  ],
  "entry": {
    "frontend": "dist/index.html",
    "theme": "dist/theme.css"
  },
  "contributes": {
    "menuItems": [
      { "path": "/plugins/p/top.qomicex.assistant", "label": "AI 助手", "icon": "A", "action": "overlay" }
    ],
    "overlay": {
      "file": "dist/overlay.html",
      "title": "AI 助手",
      "width": 380,
      "height": 500,
      "minimizable": false,
      "resizable": true
    }
  }
}
```

## 字段总表

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | string | ✅ | — | 插件唯一 ID，用作安装目录名 `plugins/{id}/`。一经发布不要更改 |
| `name` | string | ✅ | — | 插件显示名 |
| `version` | string | ✅ | — | 插件版本（用于依赖匹配）。见 [版本语法](#版本范围语法) |
| `minLauncherVersion` | string | ❌ | `""` | 最低启动器版本。⚠️ 当前版本**仅存储、未实际校验** |
| `layers` | string[] | ❌ | `[]` | 图层声明。值：`l0`/`l1`/`l2`/`l3`，可多个。详见 [layers 图层定义](#layers-图层定义) |
| `permissions` | string[] | ❌ | `[]` | 权限声明。⚠️ 后端仅存储，**由前端运行时校验**（缺失则 API 调用报错） |
| `dependencies` | PluginDependency[] | ❌ | `[]` | 前置插件依赖。见 [插件依赖与互调用](./dependencies) |
| `entry` | object | ❌ | `{}` | 入口声明 |
| `contributes` | object | ❌ | `null` | 扩展点 |

### entry 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| `frontend` | string | 插件页面入口（`.qplugin` 内相对路径）。**声明了 frontend 的插件才会被激活**并渲染到 `/plugins/p/:id` |
| `theme` | string | 主题 CSS 文件路径，激活时注入 `<style data-plugin-theme>` |
| `backend` | string | 保留字段，当前未使用 |

::: warning 重要
若省略 `entry.frontend`，插件**不会被激活**（`activatePlugin` 只在 `entry.frontend` 存在时渲染并标记 `active`），因此无法注册方法或提供 UI。即使纯功能插件也建议提供一个空页面入口。
:::

### contributes 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| `menuItems` | PluginMenuItem[] | 侧边栏底部入口列表 |
| `overlay` | PluginOverlayConfig | 悬浮窗配置 |
| `downloadSources` | string[] | 保留，当前未使用 |
| `commands` | string[] | 保留，当前未使用 |
| `settingsPages` | string[] | 保留，当前未使用 |

### menuItems 数组元素

| 字段 | 类型 | 说明 |
|------|------|------|
| `path` | string | 入口目标路径（页面路由，如 `/plugins/p/:id`） |
| `label` | string | 入口显示文字 |
| `icon` | string | 入口图标（首个字符或文本） |
| `action` | string | `"page"`（默认，跳转页面）或 `"overlay"`（打开悬浮窗，需配合 `overlay` 配置） |

### overlay 对象

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `file` | string | — | 悬浮窗 HTML 文件路径（`.qplugin` 内相对路径） |
| `title` | string | menuItem.label | 悬浮窗标题 |
| `width` | number | 380 | 宽度（px） |
| `height` | number | 500 | 高度（px） |
| `minimizable` | bool | true | 是否显示最小化按钮 |
| `resizable` | bool | false | 是否允许右下角拖拽缩放（最小 200×120） |

## layers 图层定义

`layers` 按**复杂度分层**，从纯声明到可执行逻辑，决定插件的能力与运行方式：

| 层级 | 技术 | 适用场景 | 说明 |
|------|------|---------|------|
| **L0** 静态 | `theme.json` + CSS | 主题、颜色方案 | 纯声明，无执行能力 |
| **L1** 声明式 | 配置文件声明 | 新增下载源、新增镜像、API 端点 | 纯声明，无执行能力 |
| **L2** 脚本 | JS（前端沙箱内运行） | UI 扩展、菜单注入、面板 | 经 postMessage 网关权限检查 |
| **L3** WASM | WASM（后端 Wasmtime 沙箱） | Agent、协议解析器、复杂逻辑 | Host API 权限门控 |

**声明方式：** `layers` 是一个数组，可同时声明多个层级：

```json
{ "layers": ["l2", "l3"] }
```

**当前实现状态（重要）：**

- **L2 脚本层已实现**：声明 `l2` 的插件走 **iframe 沙箱**（`<iframe sandbox="allow-scripts">` + postMessage 桥），与主界面隔离；不声明 `l2` 的插件走内联渲染（与主界面同上下文）
  - L2 沙箱内同样支持全部 `__PLUGIN_API__` 方法、`.p-*` 组件样式、`registerMethod`/`callPlugin`（跨窗口中转）
  - 沙箱插件脚本随 `srcdoc` 解析自动执行，无需进入页面
- **纯 L3 的插件不自动激活**：若 `layers` 全部为 `l3`，插件处于 `installed` 状态时不会自动启用（需用户手动打开开关），而含 L2 等其它层级的插件会随启动自动激活
- **L2 沙箱与内联的差异**：
  | 维度 | L2 iframe 沙箱 | 内联渲染 |
  |------|----------------|---------|
  | 隔离性 | 与主界面完全隔离（独立 window） | 与主界面同 window |
  | 脚本执行 | srcdoc 解析即执行 | 激活加载时立即执行 |
  | 依赖注入 | `registerMethod` 通知主窗口中转 | 直接调用主窗口注册表 |
  | 适用 | 需要隔离、独立的插件 | 轻量 UI、主题类 |
- L0/L1 当前为**声明性预留层级**，暂无独立运行机制；**L3 WASM 已实现**：声明 `l3` 且包内含 `plugin.wasm` 的插件，由启动器 Rust 层（wasmtime）加载并执行（见 [WASM 插件](./wasm-plugin)）

::: tip 建议
- 需要隔离环境或常驻脚本的插件（如 AI 助手、工具面板）→ 声明 `["l2"]`，走沙箱
- 纯 UI/主题类或依赖主界面 DOM 的轻量插件 → 不声明 l2，走内联
- 若插件后续要接入 WASM 后端逻辑，可再叠加 `"l3"`
:::

## 版本范围语法

`dependencies[].version` 支持以下写法：

| 写法 | 含义 | 示例 |
|------|------|------|
| 空 / 缺省 | 任意版本 | — |
| `>=X` | ≥ X | `>=1.0.0` |
| `<=X` | ≤ X | `<=2.0.0` |
| `>X` | > X | `>1.0` |
| `<X` | < X | `<2.0` |
| `=X` | 精确等于 | `=1.2.0` |
| `X` | 精确等于（裸版本） | `1.2.0` |
| 空格分隔 | 多个约束同时满足 | `">=1.0 <2.0"` |

**比较规则：**
- 按 `.` 分段、逐段数值比较；忽略 `-`（预发布）和 `+`（构建号）后缀
- 缺段视为 0（如 `1.0` 等于 `1.0.0`）
- **不支持** `^`、`~`、`*`、通配 `x`、`||`、逗号

::: tip
`minLauncherVersion` 字段当前未校验，但**建议填写**以兼容未来版本。若后续启动器启用校验，低于该版本的启动器将拒绝安装。
:::
