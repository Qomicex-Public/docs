# 主题系统

Qomicex 主题系统采用 **primitive → semantic → component 三级语义 token** 结构，以 `.qtheme` 主题包承载，实现启动器与插件 UI 全量即时换肤，**无需重建 plugin-ui dist**。

## 三级语义模型

```
primitives（原始色板，主题包可选）
  └─ 具体色值（HSL/hex），仅供派生
semantic（语义层，.qtheme 作者书写）
  └─ 语义角色：background/foreground/accent/status…（点分命名）
component（组件消费层 = CSS 变量，唯一被 var() 读取）
  └─ --background / --accent-foreground …（平铺，与 index.css 一一对应）
```

- **v1 落点**：`.qtheme` 直接表达 semantic/component 层（即 `--*` 平铺变量），primitive 派生与 `theme.mjs` 计算层留待 v2
- **plugin-ui 组件只消费 `var(--*)`**，零内联色值 → 换主题 = 全组件即时换肤，消除「改组件须重建 dist」的陈旧问题

## 语义 token 命名

点分命名，`.` 归一化为 `-`（`background.emphasis` → `--background-emphasis`）。

### 色板 token（标准组件级集合 = plugin-ui 消费全集）

| token（theme.json 键） | CSS 变量 | 默认值(dark) | 语义 |
|---|---|---|---|
| background | `--background` | `230 20% 6%` | 页面底色 |
| foreground | `--foreground` | `220 20% 93%` | 主文字 |
| card / card-foreground | `--card` / `--card-foreground` | `228 18% 10%` / `220 20% 93%` | 卡片 |
| popover / popover-foreground | `--popover` / `--popover-foreground` | `228 18% 10%` / `220 20% 93%` | 浮层 |
| primary / primary-foreground | `--primary` / `--primary-foreground` | `142 71% 48%` / `230 20% 6%` | 主强调 |
| secondary / secondary-foreground | `--secondary` / `--secondary-foreground` | `228 18% 14%` / `220 20% 93%` | 次级 |
| muted / muted-foreground | `--muted` / `--muted-foreground` | `228 10% 18%` / `228 8% 55%` | 弱化 |
| accent / accent-foreground | `--accent` / `--accent-foreground` | `228 18% 14%` / `220 20% 93%` | 强调底 |
| destructive / destructive-foreground | `--destructive` / `--destructive-foreground` | `0 84% 60%` / `220 20% 93%` | 危险 |
| border | `--border` | `228 14% 21%` | 边框 |
| input | `--input` | `228 14% 21%` | 输入框 |
| ring | `--ring` | `142 71% 48%` | 焦点环 |

**扩展语义**（v1 可选，emit 为 `--foreground-accent` 等，供前瞻）：`foreground.accent`、`foreground.muted`、`foreground.destructive`、`background.elevated`、`background.emphasis`、`background.sunken`、`border.strong`、`border.accent`、`accent.hover`、`accent.active`、`status.success`、`status.warning`、`status.error`。

### 非色 token

| token | CSS 变量 | 默认值 | 说明 |
|---|---|---|---|
| radius | `--radius` | `0.625rem` | 圆角 |
| glass-blur | `--glass-blur` | `18px` | 毛玻璃模糊 |

`space.*`、`font.family/size/weight`、`motion.*`、`shadow.*` 归入 v2 非色扩展。

## `.qtheme` 包格式

```
.qtheme（zip 或目录）
  theme.json        ← 颜色主题（v1，见下 schema）
  theme.css         ← 可选，命名空间注入（--qtx- 前缀 / scoped），v2
  theme.mjs         ← 可选，CSS-in-JS 计算层（沙箱），v2
  icon-theme.json   ← 图标主题，v2
  fonts/            ← 字体贡献，v2
```

### theme.json schema v1

```json
{
  "schemaVersion": 1,
  "id": "catppuccin-mocha",
  "name": "Catppuccin Mocha",
  "type": "color",
  "scheme": "dark",
  "colors": {
    "background": "240 23% 9%",
    "accent.foreground": "240 23% 9%"
  },
  "radius": 10,
  "glassBlur": 18
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `schemaVersion` | number | ✅ | 当前仅 `1` |
| `id` | string | ✅ | `^[a-z0-9][a-z0-9-]*$` |
| `name` | string | ✅ | 显示名 |
| `type` | string | ❌ | 当前仅 `"color"` |
| `scheme` | string | ❌ | `"dark"` / `"light"` |
| `colors` | object | ✅ | 键 = 语义 token（可点分），值 = HSL 色值字符串 |
| `radius` | number | ❌ | 圆角，单位 rem |
| `glassBlur` | number | ❌ | 毛玻璃模糊，单位 px |

非法 theme.json 会被 `src/theme/schema.ts` 拒绝并给出友好错误。

## 主题管理器

主题管理器（`src/theme/manager.ts`）提供：

- **`applyTheme(json)`**：校验 + 注入 CSS 变量到 `:root` → 全组件即时换肤；持久化主题 id 到 `localStorage`
- **`clearTheme()`**：移除自定义主题，回到设置层 light/dark/预设
- **`restoreSavedTheme()`**：启动时恢复已注册主题
- **`useTheme()`**：React Hook，订阅变更事件驱动重渲染
- **`registerTheme()`**：注册打包内置 `.qtheme`（含 Catppuccin 四预设）

## 主题贡献（contributes）

插件与主题包可通过 manifests 声明三类贡献，v1 仅颜色主题：

| 类型 | 说明 | 状态 |
|------|------|------|
| **颜色主题** | token 全量映射，插件 UI 与启动器同源 → 原生控件全局换肤 | ✅ v1 已实现 |
| **图标主题** | icon-theme.json：`{ "plugin-ui 图标名": "path/svg \| codepoint \| url" }` | 🔜 v2 |
| **字体/连字** | 字体资源 + `font-feature-settings` 按作用域 | 🔜 v2 |

## 与 plugin-ui 的关系

**硬性约定**：plugin-ui 组件只允许 `var(--*)` 消费 token，禁止内联色值。审计确认 `packages/plugin-ui/src/` 全量零内联色值 → 换主题 = 即时换肤，无需重建 dist。

## 预设主题

启动器内置 Catppuccin 四预设（latte / frappe / macchiato / mocha），已迁移到新 token 命名。切换预设或自定义 `.qtheme` 时，所有消费 `var(--*)` 的 UI 组件即时响应。