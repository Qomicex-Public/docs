# AI 辅助开发

Qomicex 为 AI agent（Claude / opencode / Cursor 等）提供**插件开发技能包**，把生成合规插件所需的全部事实（manifest 校验、权限目录、桥 API、主题 token、签名、调试）收敛到一个目录，避免 AI 臆造字段。配合 CLI 的 `create` / `dev` / `verify` / `pack` / `publish` 全流程，AI 可以端到端产出可发布的插件。

## 技能包位置

技能包随 `@qomicex/cli` 分发，位于：

```
packages/qomicex-cli/skills/qomicex-plugin/
├── SKILL.md              # 总入口：何时使用、文件导航、完整流程、起步提示词
├── manifest-schema.md    # manifest.json 全字段 + layers 语义 + dependencies + contributes
├── permissions.md        # 权限目录（normal/warning/danger）+ 每权限对应桥 API 方法
├── plugin-api.md         # 桥 API（__PLUGIN_API__）签名速查
├── theme.md              # 主题语义 token 三级体系 + var() 消费约定 + 主题贡献
├── signing.md            # Ed25519 签名流程（生成密钥 → pack --key → publish）
├── debugging.md          # harness 热重载调试
└── rules.md              # AI 生成插件的硬性规则（必须逐条遵守）
```

这些文件与代码事实对齐（`src/plugins/types.ts`、CLI `src/lib/*`、公开文档）。**字段含义有疑问时以代码为准，不确定就标注，不要虚构 API。**

## 让 AI 加载技能包

按你的 agent 平台选用：

- **Claude Code**：把 `skills/qomicex-plugin/` 复制到项目 `.claude/skills/`，或直接在 CLAUDE.md 里引用 SKILL.md。
- **Cursor**：把 skill 文件放到 `.cursor/rules/`。
- **opencode**：把 skill 目录登记到 skills 配置，或直接粘贴 SKILL.md。
- **通用（最简）**：把 SKILL.md 与相关分册内容直接粘进对话，或使用下方起步提示词。

### 起步提示词

> 你是 Qomicex 插件开发工程师。先读 `skills/qomicex-plugin/` 下的 SKILL.md 与各分册（尤其 rules.md），再按流程工作：`qomicex create <id>` 生成项目 → 实现功能 → `qomicex verify` 过 0 error → `qomicex pack` 出包。manifest 字段、权限、API 签名一律以技能包内文档为准，不臆造。

## rules.md 硬性规则摘要

AI 生成/修改插件时必须逐条遵守，违反任何一条都可能导致 `qomicex verify` 不通过或运行时错误。核心摘录：

| 类别 | 硬性规则 |
|------|---------|
| **manifest** | `id` 反向域名格式（`^[a-z0-9]+([.-][a-z0-9]+)*$`，3-128 字符，必须含点）；`version` 严格 semver；`minLauncherVersion` 必填；声明 `entry.frontend` 则 `layers` 需含 `l2`/`l3`（否则 UI 无法渲染） |
| **权限** | 最小权限原则：`verify` 会扫描源码，声明未用 / 用了未声明**都会报错**；`shell:execute`、`filesystem:write`、`plugin:install` 为 danger 权限非必要不声明 |
| **代码** | TS import 必须带扩展名（`./api.ts`）；`vite.config.ts` 必须设 `base: './'`；内部导航用 `<Link>` 不用 `<a>`；沙箱内不用 `window.open`；外部网络用 `proxyFetch` / `proxyFetchStream`（自带 SSRF 防护） |
| **主题** | CSS 全用 `var(--*)`，禁止 `#hex` / `rgb()` / `hsl()` 字面量；Tailwind 用语义类名（`bg-primary` 等） |
| **安全** | 禁止硬编码密钥（用户配置经 `setSettings`/`getSettings`）；不滥用 `shell:execute`；文件读写走授权制 |
| **流程** | 项目从 `qomicex create` 生成，不手写骨架；打包前必须 `qomicex verify`（0 error）；不触碰启动器核心代码；插件开发阶段不 commit |

完整规则见技能包 `rules.md`，以上仅为摘要。

## AI 生成后的校验

AI 生成的插件**必须过 `qomicex verify`**（0 error 才算通过）：

```bash
qomicex verify                        # 目录模式：manifest + 权限最小化 + 长循环
qomicex verify --package ./release/xxx.qplugin   # 包模式：manifest + 签名验签
```

校验覆盖：manifest 合法性、权限最小化（对比源码实际调用的桥方法）、长循环告警（`while(true)` / 无界 `setInterval`）。warning 可接受但建议消除。

通过后再 `qomicex pack --version x.y.z` 出包，`qomicex pack --key` 签名，`qomicex publish` 发布。完整流程见 [CLI 工具参考](./cli) 与 [发布规范](./publishing)。
