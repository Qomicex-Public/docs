# React + Vite 插件开发教程

针对**有 UI 的正式插件**，推荐使用 React 19 + Vite 7 + TypeScript + Tailwind 的工程化开发方式，并配合启动器内置组件库 `@qomicex/plugin-ui`。相比纯 HTML 手写，你能获得组件复用、类型检查、HMR 与按需打包等能力。

本教程基于仓库内示范包 `plugins-dev/hello-plugin/` 编写，可对照阅读。

## 一、为什么用 Vite

- **类型安全**：TS 严格模式，构建前 `tsc --noEmit` 拦截错误
- **组件复用**：直接用启动器同款 `@qomicex/plugin-ui` 组件（Card / Button / Dialog / Select 等），样式自动跟随主题
- **产物纯净**：仅打包用到的组件，CSS 按需生成（Tree-shaking + Tailwind JIT）

## 二、项目结构

```
hello-plugin/
├── manifest.json        # 插件清单（发布时打进 .qplugin 根目录）
├── overlay.html         # 悬浮窗页面（打包时拷贝到 dist/）
├── theme.css            # 主题注入（打包时拷贝到 dist/）
├── index.html           # Vite 入口
├── vite.config.ts       # 必须 base: './'
├── tailwind.config.js   # 引用 @qomicex/plugin-ui/tailwind-preset
├── postcss.config.js
├── tsconfig.json
├── package.json
└── src/
    ├── main.tsx         # React 入口，挂载 #root
    ├── api.ts           # window.__PLUGIN_API__ 的类型化封装
    ├── App.tsx          # 插件页面
    └── index.css        # Tailwind 指令
```

## 三、初始化工程

```bash
mkdir my-plugin && cd my-plugin
npm init -y
# 依赖
npm i react react-dom @qomicex/plugin-ui@file:../../packages/plugin-ui
# 开发依赖
npm i -D typescript vite @vitejs/plugin-react @types/react @types/react-dom tailwindcss autoprefixer postcss
```

::: tip 依赖安装
`@qomicex/plugin-ui` 是启动器仓库内的 workspace 包，用 `file:../../packages/plugin-ui` 引用即可，无需发布到 npm。
:::

### package.json

```json
{
  "name": "my-plugin",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "package": "bash scripts/build.sh"
  }
}
```

### vite.config.ts — 关键：相对 base

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 必须为 './'：否则产物中的 /assets/xxx 会被解析成站点根路径，沙箱内 404
  base: './',
  build: { outDir: 'dist' },
})
```

### tailwind.config.js — 引用 preset

```js
import preset from '@qomicex/plugin-ui/tailwind-preset'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // 关键：必须扫描 plugin-ui 源码，否则其内部类（bg-card 等）不会生成
    '../../packages/plugin-ui/src/**/*.{ts,tsx}',
  ],
  presets: [preset],
  darkMode: 'class',
}
```

::: warning 无样式的最常见原因
Tailwind 的 `content` 默认只扫 `./src`。而 `@qomicex/plugin-ui` 组件的样式类（`bg-card`、`bg-muted`、`text-foreground`）写在**组件源码**里，不在你的 `src` 下。**不把 `../../packages/plugin-ui/src/**/*.{ts,tsx}` 加进 `content`，构建出的 CSS 会缺少这些类，插件页面没有样式**（产物 CSS 只有几 KB 是典型症状）。
:::

### postcss.config.js

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### src/index.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body,
#root {
  height: 100%;
}
```

## 四、插件 API 的类型化封装

插件脚本通过 `window.__PLUGIN_API__` 与启动器交互。建议封装为类型化模块，并处理**独立 `npm run dev`（浏览器直开）时无 API 桥**的情况：

`src/api.ts`：

```ts
/// <reference types="vite/client" />

declare global {
  interface Window {
    __PLUGIN_API__?: PluginApi
    __PLUGIN_ID__?: string
  }
}

export interface PluginApi {
  call: (method: string, ...args: unknown[]) => Promise<unknown>
  registerMethod: (method: string, fn: (...args: unknown[]) => unknown) => void
  callPlugin: (pluginId: string, method: string, ...args: unknown[]) => Promise<unknown>
  proxyFetchStream: (req: unknown, handlers: { onChunk: (c: string) => void; onError: (e: Error) => void }) => Promise<void>
}

/** 沙箱注入的插件 API 桥；独立 dev（浏览器直开）时返回 null */
export function getApi(): PluginApi | null {
  return window.__PLUGIN_API__ ?? null
}

export function getPluginId(): string {
  return window.__PLUGIN_ID__ ?? 'unknown'
}
```

## 五、编写插件页面

`src/main.tsx`：

```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const rootEl = document.getElementById('root')
if (rootEl) createRoot(rootEl).render(<React.StrictMode><App /></React.StrictMode>)
```

::: tip 导入扩展名
仓库 TS 约定**必须写文件扩展名**（`./App.tsx`、`./api.ts`）。Vite 的路径解析存在 bug，省略扩展名会报错。已在 `tsconfig` 开启 `allowImportingTsExtensions`。
:::

`src/App.tsx` 中使用组件库：

```tsx
import { getApi } from './api.ts'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@qomicex/plugin-ui'

export default function App() {
  const api = getApi()

  if (!api) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>未检测到插件 API 桥</CardTitle>
          <CardDescription>当前以普通浏览器直接打开页面，`window.__PLUGIN_API__` 未注入。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const handleToast = async () => {
    await api.call('showToast', '来自 React 插件的问候', 'success')
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Hello, Qomicex!</CardTitle>
          <CardDescription>基于 React + Vite + @qomicex/plugin-ui</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleToast}>showToast</Button>
            <Badge>默认</Badge>
            <Badge variant="destructive">危险</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

::: tip 可用的组件
`@qomicex/plugin-ui` 导出：`Button` / `Badge` / `Card`(Header/Title/Description/Content/Footer) / `Checkbox` / `Combobox` / `Dialog` / `Input` / `Label` / `Select`(+`SelectOption`/`SelectDivider`) / `Separator` / `Table` / `Tabs` / `Textarea` / `Tooltip` / `useMessageBox`(+`MessageBoxProvider`) / `cn`。完整用法见 [plugin-ui 组件库](./plugin-ui)。
:::

## 六、悬浮窗与主题文件

`overlay.html` 和 `theme.css` 不属于 Vite 构建产物，需在打包时手动拷贝到 `dist/`：

- `overlay.html` → `dist/overlay.html`（manifest `contributes.overlay.file` 指向）
- `theme.css` → `dist/theme.css`（manifest `entry.theme` 指向）

**悬浮窗桥接时序（重要）：** 悬浮窗的 `__PLUGIN_API__` 桥脚本由启动器追加在页面 `<body>` 末尾。因此**不要在页面加载时同步捕获 `window.__PLUGIN_API__`**（此时桥还没注入），应在事件回调里延迟读取：

```html
<script>
  (function () {
    // 不要在这里写 var api = window.__PLUGIN_API__ —— 此时桥尚未注入，值为 undefined
    function api() { return window.__PLUGIN_API__ }

    document.getElementById('btn').addEventListener('click', function () {
      api().call('showToast', '来自悬浮窗', 'success')
    })
  })()
</script>
```

## 七、打包 .qplugin

### 打包脚本（scripts/build.sh）

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-0.1.0}"
PLUGIN_ID="my-plugin"

echo "==> 构建前端"
npm run build

echo "==> 整理 dist"
cp "$ROOT/overlay.html" "$ROOT/dist/overlay.html"
cp "$ROOT/theme.css" "$ROOT/dist/theme.css"

echo "==> 组装 .qplugin"
STAGING="$ROOT/.staging"
rm -rf "$STAGING" "$ROOT/release"
mkdir -p "$STAGING/dist" "$ROOT/release"

# 关键：manifest 引用的是 dist/ 下相对路径，zip 内必须保留 dist/ 子目录
cp "$ROOT/dist/index.html" "$STAGING/dist/"
cp -r "$ROOT/dist/assets" "$STAGING/dist/assets"
cp "$ROOT/dist/overlay.html" "$STAGING/dist/"
cp "$ROOT/dist/theme.css" "$STAGING/dist/"
cp "$ROOT/manifest.json" "$STAGING/"

cd "$STAGING"
if command -v zip >/dev/null 2>&1; then
  zip -qr "$ROOT/release/${PLUGIN_ID}-${VERSION}.qplugin" .
else
  powershell -NoProfile -Command "Compress-Archive -Path '*' -DestinationPath '$ROOT/release/${PLUGIN_ID}-${VERSION}.qplugin' -Force"
fi
cd "$ROOT" && rm -rf "$STAGING"
echo "==> 完成: $ROOT/release/${PLUGIN_ID}-${VERSION}.qplugin"
```

### 打包后的包结构

```
my-plugin.qplugin（即 zip）
└── manifest.json          # 根目录
└── dist/
    ├── index.html         # Vite 产物（引用 ./assets/... 相对路径）
    ├── overlay.html
    ├── theme.css
    └── assets/
        ├── main-xxx.js
        └── main-xxx.css
```

::: warning 包结构与 manifest 必须一致
后端按 `plugins/{id}/{path}` 解析文件，`entry.frontend: "dist/index.html"` 会去取 `plugins/{id}/dist/index.html`。**`dist/` 子目录必须保留在 zip 里**——如果把 `dist` 内的文件提升到 zip 根目录，安装后 `dist/index.html`、`dist/theme.css`、`dist/overlay.html` 全部 404（页面空白、无样式、悬浮窗打不开）。
:::

## 八、安装测试

1. `bash scripts/build.sh 0.1.0`（Windows：`pwsh ./scripts/build.ps1 0.1.0`）
2. 启动器 → 插件 → 上传 `release/my-plugin-0.1.0.qplugin`
3. 启用插件 → 重启启动器 → 侧边栏进入插件页

::: tip 开发期迭代
上传安装后修改代码需**重新打包再上传**（后端按文件实时读盘，无缓存）。开发期可考虑把 `release/xxx.qplugin` 解压后直接覆盖安装目录 `plugins/{id}/`，省去上传步骤。
:::

## 常见问题

| 现象 | 原因 |
|------|------|
| 插件页无样式（CSS 只有几 KB） | `tailwind.config.js` 的 `content` 未包含 `../../packages/plugin-ui/src/**/*.{ts,tsx}` |
| 页面空白 / 资源 404 | `vite.config.ts` 的 `base` 不是 `'./'`，或 zip 内未保留 `dist/` 目录 |
| 悬浮窗按钮报 `Cannot read properties of undefined (reading 'call')` | 同步捕获 `window.__PLUGIN_API__` 太早，桥尚未注入；改为事件回调内延迟读取 |
| 独立 `npm run dev` 页面报错 | 浏览器直开无 `__PLUGIN_API__` 桥；用 `getApi()` 判空降级 |
| `callBackend` 请求 `/api/api/...` | `callBackend` 内部已拼接 `/api` 前缀，传 `/diagnostics/health` 而非 `/api/diagnostics/health` |

## 下一步

- 完整 API 参考：[插件 API 完整参考](./plugin-api)
- 组件库：[UI 组件库（.p-* 样式）](./plugin-ui)
- 悬浮窗：[悬浮窗开发](./overlay)
- 发布规范：[发布规范](./publishing)
