# 从零开始开发第一个插件

本教程带你从零创建一个最小可运行的 Qomicex 插件。

## 前置条件

- 已安装 Qomicex 启动器（用于测试）
- 一个文本编辑器，可选装 Node.js（用于本地预览）

## 一、理解插件结构

一个插件包的最简结构：

```
my-plugin/
└── manifest.json          # 清单文件（必须，位于包根目录）
```

带前端资源的插件：

```
my-plugin/
├── manifest.json
└── dist/
    ├── index.html         # 插件页面（entry.frontend 指向）
    └── app.js             # 页面脚本
```

::: tip
插件**不一定需要前端文件**。纯功能插件（只提供 API 或注册方法）可以只包含 `manifest.json`。但注意：只有声明了 `entry.frontend` 的插件才会被激活（详见 [manifest 详解](./manifest)）。
:::

## 二、编写 manifest.json

```json
{
  "id": "dev.example.helloworld",
  "name": "Hello World",
  "version": "1.0.0",
  "minLauncherVersion": "0.1.0",
  "layers": ["l2", "l3"],
  "permissions": ["ui:inject_sidebar"],
  "entry": {
    "frontend": "dist/index.html"
  },
  "contributes": {
    "menuItems": [
      { "path": "/plugins/p/dev.example.helloworld", "label": "Hello", "icon": "H" }
    ]
  }
}
```

关键字段：
- `id`：插件唯一 ID，同时是安装目录名（`plugins/{id}/`），**一经发布不要更改**
- `layers`：图层声明。含脚本页面的插件建议 `["l2", "l3"]`（含 `l2` 走 iframe 沙箱；纯 `["l3"]` 走内联渲染。激活取决于 `entry.frontend` 是否存在，详见 [layers 图层定义](./manifest#layers-图层定义)）
- `permissions`：插件要用的权限（见 [插件 API 完整参考](./plugin-api)）
- `entry.frontend`：插件页面入口，`.qplugin` 包内的相对路径
- `contributes.menuItems`：在侧边栏底部创建入口

## 三、编写插件页面

创建 `dist/index.html`：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body>
  <div class="p-card">
    <div class="p-card-title">Hello, Qomicex!</div>
    <div class="p-card-desc">这是我的第一个插件。</div>
    <button id="btn" class="p-btn p-btn--primary">点我</button>
  </div>

  <script>
    document.getElementById('btn').addEventListener('click', async function () {
      const settings = await window.__PLUGIN_API__.call('getSettings')
      window.__PLUGIN_API__.call('showToast', '设置项数量: ' + Object.keys(settings).length, 'success')
    })
  </script>
</body>
</html>
```

::: tip
- 样式使用启动器提供的 `.p-*` 组件类（如 `.p-card`、`.p-btn`），自动跟随明暗主题。完整清单见 [UI 组件库](./plugin-ui)。
- 插件脚本通过全局对象 `window.__PLUGIN_API__` 与启动器交互。注意：插件激活时脚本即执行（内联或 L2 沙箱），无需进入插件页面，详见 [渲染原理](./pitfalls)。
:::

## 四、打包插件

1. 将 `manifest.json` 与资源目录放入一个文件夹
2. 用任意 ZIP 工具压缩，确保 `manifest.json` 位于 **ZIP 根目录**
3. 将扩展名改为 `.qplugin`

```
my-plugin.qplugin          # 即 zip，manifest.json 在根
```

::: warning
`manifest.json` 必须在压缩包**根目录**，放在子目录里会安装失败。
:::

## 五、安装测试

1. 打开 Qomicex 启动器 → 设置 → 插件
2. 点击「安装插件」，选择你的 `.qplugin` 文件
3. 安装成功后，在插件列表看到卡片，切换开关启用（需重启启动器生效）
4. 重启后，侧边栏出现 "Hello" 入口，点击进入插件页面

## 六、常见问题速查

| 现象 | 原因 |
|------|------|
| 安装报 `Invalid plugin package` | `manifest.json` 不在包根目录，或 JSON 解析失败 |
| 插件列表出现但侧边栏没入口 | `contributes.menuItems` 未声明，或未启用插件 |
| 页面空白 / 脚本不执行 | 插件未激活或激活时序问题（见 [避坑指南](./pitfalls)） |
| 调用 API 报 `Permission denied` | manifest 的 `permissions` 未包含对应权限 |

## 下一步

- 了解 manifest 全部字段：[manifest 清单详解](./manifest)
- 了解全部可调用的 API：[插件 API 完整参考](./plugin-api)
