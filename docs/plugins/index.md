# 插件开发指南

这里面向软件生态开发者，介绍 Qomicex 插件系统的架构、开发流程与全部接口。

## 插件是什么

Qomicex 插件（`.qplugin`）本质是一个 **ZIP 压缩包**，内含一份 `manifest.json` 清单和插件前端资源（HTML / JS / CSS）。安装后由启动器在受控的沙箱/内联环境中渲染并执行，可调用启动器暴露的插件 API 来读写配置、操作实例、请求网络、注入 UI 等。

## 插件能力

| 能力 | 说明 |
|------|------|
| 注入侧边栏 | 通过 `contributes.menuItems` 在侧边栏底部创建入口（跳转页面或打开悬浮窗） |
| 悬浮窗 | 通过 `contributes.overlay` 声明，创建可拖拽的独立小窗口 |
| 插件页面 | 通过 `entry.frontend` 提供完整页面，挂载到 `/plugins/p/:id` |
| 配置读写 | 读写插件自己的 `settings.json`（`getSettings` / `setSettings`） |
| 插件缓存 | 读写插件自己的 `cache.json`（`setCache` / `getCache`，支持 TTL 过期） |
| 网络请求 | 直接请求后端 API（`callBackend`）或经 CORS 代理访问外网（`proxyFetch` / `proxyFetchStream`） |
| 插件间调用 | 注册方法供其他插件调用（`registerMethod` / `callPlugin`） |
| 主题跟随 | 自动跟随启动器明暗主题（CSS 变量注入） |

## 前置插件（Libraries）

部分插件不提供 UI，只作为**被依赖的能力库**供其他插件调用（例如 MarkdownLib 提供 `renderMarkdown`）。这类插件不声明 `contributes`，因此**不会创建侧边栏**。见 [插件依赖与互调用](./dependencies)。

## 目录

- [从零开始开发第一个插件](./creating-plugin)
- [React + Vite 插件开发](./react-plugin)
- [manifest 清单详解](./manifest)
- [插件 API 完整参考](./plugin-api)
- [UI 组件库（.p-* 样式）](./plugin-ui)
- [插件依赖与互调用](./dependencies)
- [WASM 插件（L3）](./wasm-plugin)
- [悬浮窗开发](./overlay)
- [CLI 工具参考](./cli)
- [主题系统](./theme)
- [调试与热重载](./debugging)
- [发布规范](./publishing)
- [开发要点与避坑指南](./pitfalls)
