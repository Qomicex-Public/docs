# 发布规范

本文档说明插件打包格式、命名规范、分发渠道与发布检查清单。

## 一、打包格式

`.qplugin` 本质是 **ZIP 压缩包**，其中 `manifest.json` 必须位于**根目录**。

```
my-plugin.qplugin（即 zip）
└── manifest.json          # 必须在根目录
└── dist/
    ├── index.html
    ├── app.js
    └── theme.css
```

::: warning
- `manifest.json` 不在根目录 → 安装失败（`Invalid plugin package`）
- 后端不校验扩展名，任何合法 zip 都能通过上传接口；但**请统一使用 `.qplugin`** 以便识别
- 包内路径避免 `../` 相对路径（zip-slip 风险，且可能导致文件写入异常位置）
:::

### WASM 插件（L3）打包

含 L3 能力的插件需在包内提供 `plugin.wasm`（wasmtime 核心模块）：

```
my-wasm-plugin.qplugin（即 zip）
└── manifest.json          # 必须在根目录，layers 含 "l3"
└── plugin.wasm            # wasm 编译产物（wasm32-unknown-unknown）
```

- 编译：`rustup target add wasm32-unknown-unknown && cargo build --release --target wasm32-unknown-unknown`
- 产物重命名为 `plugin.wasm` 放入包根目录（网关按固定文件名 `plugin.wasm` 加载，无需在 manifest 声明路径）
- manifest `layers` 需含 `"l3"`，`permissions` 含 `"wasm:execute"`
- 详见 [WASM 插件（L3）](./wasm-plugin)

## 二、命名规范

| 项目 | 规范 |
|------|------|
| 插件 id | 反向域名风格（如 `top.qomicex.assistant`、`dev.example.helloworld`），小写、点分、`id` 一经发布**不要更改**（它是安装目录名与依赖引用 key） |
| 插件名 | 简洁可读，如「AI 助手」 |
| 版本号 | 语义化版本 `x.y.z`，用于依赖匹配（见 [版本语法](./manifest#版本范围语法)） |
| 包文件名 | 建议 `{插件id}.qplugin` 或 `{插件名}-{版本}.qplugin` |

## 三、权限与安全规范

- **最小权限原则**：只声明真正用到的权限。安装详情页会按风险分级展示（危险权限如 `shell:execute`、`filesystem:write`、`plugin:install` 会醒目提示）
- 不得在插件内硬编码密钥/凭据
- 访问外部网络建议走 `proxyFetch`（自带 SSRF 防护），而非直接内网请求
- 插件脚本运行在沙箱（悬浮窗）或主界面（页面），**不要依赖全局变量跨插件共享**

## 四、安装方式

用户可通过两种方式安装：

1. **上传 .qplugin 文件**：设置 → 插件 → 安装插件，选择 `.qplugin` / `.zip` 文件
2. **目录安装**（开发者调试）：后端 `POST /api/plugins/install`，body `{"sourceDir": "/path/to/dir"}`，直接指向含 `manifest.json` 的目录

::: tip
- 安装接口（upload）**不做依赖检查**；依赖检查仅在目录安装（install）接口执行。发布前请确保依赖插件已随文档说明。
- 状态切换（启用/禁用）需要**重启启动器**后生效。
:::

## 五、卸载与更新

- 卸载：设置 → 插件 → 删除按钮（会删除 `plugins/{id}/` 整个目录）
- 更新：重新上传同名 `id` 的 `.qplugin`，会**覆盖安装**（先删旧目录再复制）

## 六、数据与目录

插件可读写自己的数据（按插件 id 隔离）：

```
{数据目录}/plugins/{插件id}/
├── manifest.json      # 你的插件文件（安装时解包）
├── settings.json      # getSettings/setSettings 读写
└── cache.json         # setCache/getCache 读写
```

数据目录位置：
- Windows：`%LOCALAPPDATA%\qomicex-launcher`
- Linux：`$XDG_DATA_HOME` 或 `~/.local/share`
- macOS：`~/Library/Application Support`
- 环境变量 `QOMICEX_HOME` 可覆盖（便携模式）

## 七、发布检查清单

- [ ] `manifest.json` 在包根目录，JSON 合法
- [ ] `id` 唯一且不再更改，`version` 语义化递增
- [ ] `permissions` 只含必要权限
- [ ] 依赖插件的 `dependencies` 声明正确（必装/可选、版本范围）
- [ ] `entry.frontend` 已声明（否则插件不被激活）
- [ ] 页面/悬浮窗脚本未使用全局变量跨插件通信
- [ ] 本地安装测试通过（上传 → 启用 → 重启 → 功能验证）
- [ ] 若调用其他插件，已在文档说明前置插件名称与版本

## 八、版本兼容建议

- `minLauncherVersion` 建议填写，虽然当前版本未强制校验
- 插件 API 可能演进，发布时说明兼容的启动器版本范围
- 重大变更（方法签名、权限变化）建议递增主版本

## 九、上传到插件商店（提 PR）

插件商店数据由仓库 [Qomicex-Public/Qomicex.Plugin-Market](https://github.com/Qomicex-Public/Qomicex.Plugin-Market) 的 `repository` 分支维护：`plugins.json` 保存插件元数据，`packages/` 存放 `.qplugin` 安装包。上传即向该分支提交 PR。

### 步骤

1. **打包**：按上文规范生成 `.qplugin`，包文件名建议用 `{插件id}.qplugin`（如 `top.qomicex.assistant.qplugin`）
2. **Fork 商店仓库**：fork `Qomicex.Plugin-Market`，切换到 `repository` 分支
3. **放入安装包**：把 `.qplugin` 复制到仓库 `packages/` 目录
4. **更新 plugins.json**：在 `plugins` 数组添加（或更新）你的插件条目，字段如下：

```json
{
  "id": "top.qomicex.assistant",
  "name": "AI 助手",
  "description": "一句话介绍插件功能",
  "author": "你的名字或组织",
  "type": "library",
  "icon": "fa-solid fa-robot",
  "version": "1.1.4",
  "minLauncherVersion": "0.1.0",
  "permissions": ["config:read", "config:write", "network:fetch"],
  "tags": ["工具", "AI"],
  "downloadUrl": "https://raw.githubusercontent.com/Qomicex-Public/Qomicex.Plugin-Market/repository/packages/top.qomicex.assistant.qplugin"
}
```

字段说明：

| 字段 | 说明 |
|------|------|
| `id` | 插件 id，与 manifest 一致，一经发布不更改 |
| `name` | 显示名 |
| `description` | 功能简介（商店卡片展示） |
| `author` | 作者/组织 |
| `type` | 可选；库插件标 `library` |
| `icon` | 图标：emoji / 绝对 URL / 包内路径 / **FontAwesome 类名**（如 `fa-solid fa-robot`，随主题） |
| `version` | 版本号，与 manifest 一致、语义化递增 |
| `permissions` | 安装时展示的权限列表，尽量与 manifest 一致 |
| `tags` | 分类标签 |
| `downloadUrl` | 安装包下载地址（见下） |

5. **提交 PR**：push 到你的 fork，向 `Qomicex-Public/Qomicex.Plugin-Market` 的 `repository` 分支提交 PR，说明新增/更新的插件、版本与改动
6. **合并后**：插件商店即可检索到该插件，用户可直接安装

### downloadUrl 规则

```
https://raw.githubusercontent.com/Qomicex-Public/Qomicex.Plugin-Market/repository/packages/{文件名}.qplugin
```

文件名须与 `packages/` 目录下的实际文件一致。

::: warning
- 更新插件时必须**同时**更新两处：`plugins.json` 里的 `version` + `packages/` 下的 `.qplugin`，缺一不可
- 版本号要语义化递增（商店与启动器依赖匹配都依赖它）
- 同名 `id` 会被当作同一插件覆盖，不要重复新增条目
:::

::: tip 官方插件结构参考
官方插件采用「源码仓库 + 商店发布」分离：插件代码在各自的仓库（如 `Qomicex.Plugin-AI.Assistant`），商店只放打包产物 `.qplugin` 与 `plugins.json` 元数据。个人插件可简化——直接把 `.qplugin` 与 `plugins.json` 提交到 fork 的商店仓库即可。
:::
