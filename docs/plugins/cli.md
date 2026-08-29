# qomicex CLI 工具参考

`qomicex` 是 Qomicex 插件生态的命令行工具，覆盖插件开发全流程：`create` / `dev` / `pack` / `verify` / `lint` / `bump` / `publish`，并附带 `login` / `logout`（登录会话管理）、`doctor`（环境诊断）、`debug`（启动器 CDP 调试）。

- 零运行时依赖（Node ≥ 20，仅用内置 `node:fs` / `node:zlib` / WebCrypto）
- 包：`@qomicex/cli`（源码在 `packages/qomicex-cli/`）

## 安装

```bash
pnpm install
pnpm --filter @qomicex/cli build
pnpm --filter @qomicex/cli link   # 链接到 PATH，之后可直接用 qomicex
```

也可直接发布到 npm：

```bash
cd packages/qomicex-cli
npm login
npm version patch   # bump 版本（版本号单一来源 package.json，src 自动读取）
npm publish
```

## 全局参数

| 参数 | 说明 |
|------|------|
| `--help` / `-h` | 显示全部命令帮助 |
| `--version` / `-v` | 显示 CLI 版本 |

## 环境变量

| 变量 | 用途 |
|------|------|
| `QOMICEX_SIGN_KEY` | 签名私钥（PKCS#8 PEM 或 raw base64 seed），`publish` 必填 |
| `QOMICEX_API_KEY` | 商店 API Key（CI 模式跳过设备流登录，自动确认上传） |
| `QOMICEX_STORE_API` | 商店 API base（默认 `https://plugins.qomicex.top/api/v1`） |
| `QOMICEX_LAUNCHER_PATH` | `debug` 定位启动器可执行文件 |
| `QOMICEX_HOME` | `debug` 数据目录（日志文件定位；QOMICEX_HOME → `.qomicex-bootstrap` → 默认目录） |

## 命令总览

| 命令 | 作用 |
|------|------|
| `qomicex create <id>` | 从内置模板生成合法插件项目 |
| `qomicex dev [--port <n>]` | 起本地调试环境（仓库内 harness 模式 / 仓库外裸 Vite） |
| `qomicex pack [--out-dir <d>] [--version <v>] [--key <k>] [--skip-build]` | 构建 → 打包 `.qplugin`（可选 `--key` 签名） |
| `qomicex verify [--package <f>]` | 校验 manifest / 权限 / 长循环 / 签名 |
| `qomicex lint [--json]` | 增强静态检查：manifest / 权限 / 长循环 / import 扩展名 / 资源引用 |
| `qomicex bump <major\|minor\|patch> [--version <v>]` | 递增 `manifest.json` 版本号 |
| `qomicex publish [--key <k>] [--slug <s>] [--changelog <c>] [--api <url>] [--org-id <id>] [--package <f>] [--skip-build] [--yes]` | 设备流登录 → 签名 → 上传商店 |
| `qomicex login [--api <url>]` | 设备流登录并持久化会话（30 天免登录） |
| `qomicex logout` | 清除持久化登录会话 |
| `qomicex doctor [--json] [--api <url>]` | 环境诊断（纯只读） |
| `qomicex debug [--port <n>] [--launcher <p>] [--no-logs] [--no-kill]` | 启动启动器开放 CDP + 实时日志 |

## create

```bash
qomicex create com.example.demo
```

从内置模板生成合法插件项目（Vite + React 19 + TS + Tailwind + `@qomicex/plugin-ui`），自动替换 `manifest.json` / `package.json` 中的 id。

- 模板 `layers:["l2"]`（iframe 沙箱默认渲染）
- 权限最小集：`config:read` / `ui:toast` / `network:cors_proxy`
- 生成后提示 `pnpm install`

**实例**：

```bash
# 生成一个漫画汉化小组的连字插件项目
qomicex create com.acgstudio.ligatures
cd com.acgstudio.ligatures
pnpm install
qomicex verify    # 立即校验，确认 0 error
```

## dev

```bash
qomicex dev            # 默认 5173
qomicex dev --port 3000
```

起本地插件调试环境，分两种模式：

- **仓库内（harness 模式）**：插件位于仓库 `plugins-dev/{id}` 时，自动检测并启动 `scripts/harness/run.mjs` —— Playwright 起 Vite(:1420) + 注入 Tauri mock + stub mock server(:5100) + 源码变更热重载（重建后整页 reload）。此模式 `--port` 不生效（harness 固定端口），`Ctrl+C` 退出时一并清理 stub/Vite。详见 [调试与热重载](./debugging)。
- **仓库外（裸 Vite）**：未检测到 harness 时回退为起 Vite dev server + 在项目根写 `.qomicex-dev.json`（dev 源插件配置：插件 id → localhost URL 映射），供手动注册 dev 源使用。

## pack

```bash
qomicex pack                          # tsc && vite build → release/<id>-<version>.qplugin
qomicex pack --version 0.2.0          # 覆盖 manifest 版本号
qomicex pack --key ./dev-key.pem      # 附签名（仅 signature.json；完整证书链请用 publish）
qomicex pack --skip-build             # 跳过构建（复用现有 dist）
qomicex pack --out-dir ./dist-releases # 指定输出目录（默认 release/）
```

`.qplugin` = zip，`manifest.json` 在根 + `dist/**`。`entry.theme` / `contributes.overlay.file` 若引用 `dist/` 下文件但源码在根目录，会自动拷入。

**实例**（日常迭代出包）：

```bash
qomicex pack                                    # 开发自测包
qomicex pack --key ./dev-key.pem                # 带自签名的离线包（本地 verify 可验）
qomicex pack --version 0.3.0 --skip-build       # 改版本号后直接出包（复用 dist）
```

## verify

```bash
qomicex verify                        # 目录模式：manifest + 权限 + 长循环
qomicex verify --package ./release/x.qplugin   # 包模式：manifest + 签名验签
```

- **manifest 合法性**：id（反向域名/安全字符）、name、version(semver)、minLauncherVersion、layers、permissions、entry、contributes
- **权限最小化**：对比 `manifest.permissions` 与源码实际调用的桥方法（`METHOD_PERMISSIONS` 表）。声明未用 / 用了未声明都会报错
- **长循环告警**：`while(true)`、`for(;;)`、`setInterval` 无界轮询（提示放 Worker / WASM / 后端）——启发式文本扫描，可能误报/漏报
- **签名检查**：包模式用内置商店根公钥验签（ADR-050）；无签名提示「未签名」不拒绝

**实例**（发布前快检 + 复验签名包）：

```bash
qomicex verify
qomicex verify --package ./release/com.acgstudio.ligatures-0.3.0.signed.qplugin
```

## lint

```bash
qomicex lint               # manifest/权限/长循环 + 相对 import 扩展名 + 资源引用
qomicex lint --json        # 结构化输出（{ok, errors, warnings, findings}），供 CI 消费
```

比 `verify` 更严的发布前静态门禁，额外检查：

- **相对 import 缺扩展名**：`import ... from './x'` 无扩展名且非目录 barrel → error（Vite 硬规则）
- **资源引用存在性**：`entry.frontend/theme/backend`、`contributes.overlay.file` 指向的文件不存在 → error（`dist/` 引用未构建时给 warning）

**实例**（CI 门禁）：

```bash
# CI 脚本：lint 不过（exit 1）即阻断构建
qomicex lint --json | jq -e '.ok'
```

## bump

```bash
qomicex bump patch     # 1.0.0 → 1.0.1
qomicex bump minor     # 1.0.0 → 1.1.0（默认，不传参数 = minor）
qomicex bump major     # 1.0.0 → 2.0.0
qomicex bump --version 2.5.0   # 直接指定目标版本
```

直接改写 `manifest.json` 的 `version` 字段，不触发构建。发布新版本前用它递增版本，避免商店拒绝「比线上更老」的版本（409 `version_exists`）。版本号支持 semver pre-release 与 build metadata（`1.2.3-beta.1` / `1.2.3+build5`）。

**实例**（发布流程标准化）：

```bash
qomicex bump minor            # 1.0.0 → 1.1.0
qomicex lint && qomicex pack
qomicex publish --changelog "新增 xxx 功能"
```

## login / logout

```bash
qomicex login              # 设备流登录，会话持久化到 ~/.qomicex/auth.json（0600）
qomicex login --api http://127.0.0.1:8787/api/v1   # 指定商店（本地 wrangler dev 调试）
qomicex logout             # 清除本地会话
```

登录成功后 30 天内 `qomicex publish` 免重复授权：access token 15 分钟过期时自动用 refresh token 经 `POST /auth/refresh` 旋转续期。会话按商店 API base 区分（不同商店各自独立登录）。

**实例**（首次登录 + 多商店隔离）：

```bash
qomicex login                       # 生产商店登录一次
qomicex login --api http://127.0.0.1:8787/api/v1   # 本地商店单独登录
qomicex publish --api http://127.0.0.1:8787/api/v1 # 自动用本地商店会话，免再次授权
```

## publish

```bash
export QOMICEX_SIGN_KEY=<私钥 base64/PEM>   # 或 --key ./key.pem
qomicex publish                            # 设备流登录 → 签名 → 上传
qomicex publish --changelog "修复 X" --yes
qomicex publish --api http://127.0.0.1:8787/api/v1   # 本地商店（wrangler dev）调试
```

流程（对齐商店契约，见 [签名与发布](./publishing) 与 ADR-050）：

1. 认证：`QOMICEX_API_KEY` 存在（CI）或持久化会话续期成功则跳过；否则 `POST /api/v1/auth/device/code` 设备流登录（RFC 8628）
2. `POST /api/v1/developer/keys` 上传 Ed25519 公钥 → 商店根钥签发开发者证书（`keyId` + `signature.cert.json`）
3. 用私钥对包体签名（规范化 JSON 载荷 → Ed25519 → `signature.json`），与证书一起打进 `.qplugin`
4. 查找/创建插件记录（`/plugins/mine` → 无则 `POST /plugins`），确认后 `POST /plugins/:id/versions` multipart 上传
5. 成功后将签名包存为 `release/<id>-<version>.signed.qplugin` 供复验

**参数**：

| 参数 | 说明 |
|------|------|
| `--key <k>` | 私钥文件（PEM / base64），或环境变量 `QOMICEX_SIGN_KEY` |
| `--slug <s>` | 插件 slug（默认取 manifest.id） |
| `--changelog <c>` | 本次版本更新说明（≤4000 字符） |
| `--api <url>` | 商店 API base（默认 `QOMICEX_STORE_API` 或生产地址） |
| `--org-id <id>` | 组织发布（所属组织 id） |
| `--package <f>` | 直接上传已有 `.qplugin`（跳过构建，仍会重新签名） |
| `--skip-build` | 打包前跳过 tsc + vite build |
| `--yes` | 跳过确认（CI 场景） |

**实例**（发布 + 更新版本）：

```bash
export QOMICEX_SIGN_KEY="$(cat dev-key.pem)"
qomicex login                                    # 首次登录
qomicex bump patch
qomicex publish --changelog "修复了 xxx 崩溃问题"
# CI 免交互：QOMICEX_API_KEY=qk_xxx qomicex publish --yes
```

## doctor

```bash
qomicex doctor             # 环境诊断（纯只读，零副作用）
qomicex doctor --json      # 结构化输出供脚本消费
```

逐项检查：Node ≥ 20、pnpm、插件项目 + manifest 合法性、`@qomicex/plugin-ui`、Vite、openssl + WebCrypto(Ed25519)、后端 `:5000`、插件商店可达、调试 harness 可定位。输出 `✔/✗` 与原因，**不修改任何文件**。

**实例**（排障：插件构建/调试环境出问题时先跑一遍）：

```bash
qomicex doctor
# ✗ @qomicex/plugin-ui: 未安装（pnpm install 后使用）
# ✗ openssl: 不可用（签名密钥生成需要）
```

## debug

```bash
qomicex debug                            # 启动启动器开放 CDP :9222 + 实时日志
qomicex debug --port 9223 --no-logs      # 指定 CDP 端口 / 仅 CDP 不要日志
qomicex debug --launcher ./dist/launcher.exe --no-kill
```

定位启动器（`--launcher` > `QOMICEX_LAUNCHER_PATH` > 仓库 `src-tauri/target/{release,debug}` > 安装路径），以 `--debug <port>` 参数启动。

**启动器本身支持 `Qomicex Launcher.exe --debug <port>`**——第三方开发者无需 CLI/源码，直接命令行传参即可开放 CDP + 实时推送日志；**release 默认纯 IPC 不受影响**（仅显式传参才启用）。

- **Windows（WebView2）**：`--debug <port>` 设 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<port>` 开放 CDP；轮询 `/json/list` 打印 targets + DevTools 前端地址
- **Linux/macOS**：设 `WEBKIT_INSPECTOR_SERVER` / `WEBKIT_INSPECTOR_HTTP_SERVER` 尽力支持（需应用启用 inspector）
- **实时日志双通道**：① 启动器 stderr 实时推送（backend 日志 + 启动器日志，`stdio: inherit` 直接可见）；② tail `{BaseDir}/logs/qomicex-backend.log`（`FileLog` 逐行 flush 实时落盘，含 `[plugin:...]` / `[frontend:...]` trace 行）打印 `[trace] ...`。均不依赖后端 TCP
- `Ctrl+C` 停止并结束启动器子进程（`--no-kill` 保留）

**实例**（Playwright connectOverCDP 自动化）：

```bash
qomicex debug --port 9223
# ✔ CDP 就绪: http://localhost:9223
#   - [page] Qomicex Launcher http://tauri.localhost/
```

```js
// Node 脚本：直连 CDP 做自动化
const { chromium } = require('playwright')
;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9223')
  const pages = browser.contexts()[0].pages()
  await pages[0].evaluate(() => __PLUGIN_API__.call('getSettings'))
  await browser.close()
})()
```

## 签名密钥

生成 Ed25519 密钥对（PKCS#8 PEM 或 raw 32 字节 seed base64）：

```bash
openssl genpkey -algorithm Ed25519 -out dev-key.pem
# raw seed 提取（publish 也接受 PEM，通常不必）
openssl pkey -in dev-key.pem -outform DER | tail -c 32 | base64
```

## AI 辅助开发

CLI 随包分发 **AI skill 包**（`skills/qomicex-plugin/`），供 AI agent（Claude / opencode / Cursor 等）在写插件时加载，获得准确且不过时的 manifest 字段、权限目录、桥 API 签名、主题 token、签名与调试流程——避免 AI 臆造字段。详见 [AI 辅助开发](./ai-development)。

## 设计说明

- **零依赖**：zip 读写（`node:zlib` + 手写 CRC32/目录结构）、Ed25519（WebCrypto）、参数解析（手写）均不引入第三方包
- **签名规范化** 与商店 `src/lib/signature.ts`、启动器 `plugin_signature.rs` 字节级一致（键序/无空白 canonicalJson，`signedHash` = 载荷 SHA-256）
- **不改商店上传接口**：只读参考契约实现客户端