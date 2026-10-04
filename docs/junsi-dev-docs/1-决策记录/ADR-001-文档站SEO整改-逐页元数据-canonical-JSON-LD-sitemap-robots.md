# ADR-001：文档站 SEO 整改——逐页元数据、canonical、JSON-LD、sitemap 与 robots

| 属性 | 内容 |
|---|---|
| 状态 | 已采纳 |
| 日期 | 2026-10-04 |
| 决策者 | AI Agent |

## 背景

用户收到 Bing Webmaster 的 SEO 分析报告（`www.qomicex.top_SEOAnalysisSummary_2026_10_04.csv`）并反馈「Bing 直接搜不到了」。报告列出 7 项问题，其中三项数字为：**描述重复 50 页、描述过短 47 页、标题过短 40 页**。

对线上 `www.qomicex.top` 全量 14 个可索引页实测后，报告对 www 的指控**全部不成立**：标题 < 40 字符 0 页、描述重复 0 页、描述 < 70 字符 0 页、缺 h1 0 页、img 无 alt 0 处、IndexNow key 文件 HTTP 200。www 的修复已由上游 `website` 仓库 ADR-006 完成。

对**本站**（`docs.qomicex.top`）实测后确认，报告的数字精确对应当前的文档站：

```
构建产物 HTML 总数          : 50      ← 报告「50 页」
title < 40 字符             : 49      ← 报告「40 页」
description < 70 字符       : 50      ← 报告「47 页」
不同 description 的数量      :  2      ← 报告「描述重复 50 页」
  其中 49 页共用「QML 用户手册与插件开发指南」（15 字符）
sitemap.xml                 : 未生成
robots.txt                  : 无
canonical / og / JSON-LD    : 全缺
```

线上实测印证：`https://docs.qomicex.top/guide/accounts.html` 的 title 为 15 字符、description 为 15 字符且与其他页完全相同、无 canonical/og/JSON-LD。

**根因：第三方报告把 `docs` 子站的指标误标成了 `www`。** 本站才是报告真正指向、且确实未修复的站点。

另：Bing 目前仅收录了本站首页（`https://docs.qomicex.top/`），49 个内容页一个都没被收录——缺 sitemap 与逐页元数据正是原因。

## 决策

采用**由页面内容自动派生元数据**的方案，而非为 49 个 md 手写 49 组 title/description。

① **新增 `docs/.vitepress/seo.mjs`**：从每页自身的 H1 与正文首段派生唯一的 `title` / `description`。标题 = `页面 H1 + 分类补充语 + " | QML Docs"`，因 H1 各不相同而天然全站唯一；描述不足 70 字符时拼接该分类的补充语，保证既达下限又保持唯一。

② **注入方式**：`transformPageData` 写入逐页 `title`/`description` 并置 `titleTemplate: false`（VitePress 默认会追加 ` | QML Docs`，不抑制会与已含品牌后缀的完整标题重复）；`transformHead` 注入 `canonical`、`og:*`、`robots` 与 JSON-LD。

③ **sitemap 与 robots**：启用 VitePress 1.6.4 内置的 `sitemap: { hostname }`（不引第三方依赖）；新增 `docs/public/robots.txt` 指向 sitemap。

④ **结构化数据**：首页输出 `WebSite` + `Organization`，内页输出 `TechArticle`；`404.html` 输出 `noindex, follow` 且不打 JSON-LD。仅描述页面自身可见信息，不编造内容。

⑤ **回归校验 `scripts/verify-seo.mjs`**：对构建产物断言「标题/描述长度落在 40–70 与 70–160 区间」「全站描述与标题唯一」「canonical/og/robots/JSON-LD 齐备且 JSON-LD 可 parse」「sitemap 与 robots.txt 存在」。挂 `npm run seo:verify`。

⑥ **IndexNow**：新增共享 key 文件与 `scripts/indexnow.mjs`，由部署流程在**部署成功后**调用（构建阶段不应有外部副作用）。

### 两个实测发现的实现坑

**坑一：VitePress 不转义 HeadConfig 属性值。** 描述里的 ASCII 双引号会提前闭合 `content="..."`：

```html
<meta name="description" content="实例管理："实例"就是…">   <!-- 属性在第 2 个引号处截断 -->
```

实测 `guide/instances.html` 的描述被截成 **5 字符**（`实例管理：`）。修法：`seo.mjs` 导出 `escapeAttr()` 做实体转义，并把正文直引号规范为中文全角引号（既修 bug 又更符合中文排版）。

**坑二：钩子里的 `pageData` 不保证带 `filePath`。** 实测为 `undefined`，若据其读取 markdown 会静默失败并回退到**已被改写过的 title**，产出过短描述与重复品牌后缀（`… | QML Docs — QML 启动器使用教程 | QML…`）。修法：改用 `relativePath` 自行拼绝对路径。

## 备选方案

### 方案 为 49 个 md 手写 frontmatter description（未采纳）
- 优点：每页描述可精雕细琢，作者可控。
- 缺点：49 份副本需长期维护；内容更新后描述极易与实际内容脱节；新增页面容易漏写。
- 为何不选：自动派生随内容更新而更新，且本轮要修的本就是「缺失/重复/过短」这类可机械校验的缺陷。

### 方案 引入 vite-plugin-sitemap 等第三方插件（未采纳）
- 优点：配置项更丰富。
- 缺点：新增依赖与其升级维护成本。
- 为何不选：VitePress 1.6.4 已内置 sitemap 生成，无需额外依赖。

### 方案 把 49 个页面合并成少量长文档（未采纳）
- 优点：页数少，元数据维护量小。
- 缺点：破坏现有导航与锚点，用户与外部链接全部失效。
- 为何不选：URL 稳定性优先（Bing 指南 §20），且这是内容架构变更，超出 SEO 整改范围。

## 影响

- `docs/.vitepress/seo.mjs`（新增）：元数据派生、转义、结构化数据
- `docs/.vitepress/config.mts`：启用 sitemap，新增 `transformPageData` / `transformHead`
- `docs/public/robots.txt`、`docs/public/eb436726f06a39424dae0773d034c5a0.txt`（IndexNow key）
- `scripts/verify-seo.mjs`、`scripts/indexnow.mjs`（新增），`package.json` 加 `seo:verify` / `indexnow`
- 不改动任何 md 正文与 URL 结构

### 验证（修复前 → 修复后）

| 指标 | 修复前 | 修复后 |
|---|---|---|
| 页面总数 | 50 | 50 |
| title < 40 字符 | 49 | **1**（仅 404，按设计 noindex） |
| title > 70 字符 | 0 | 0 |
| description < 70 字符 | 50 | **1**（仅 404） |
| description > 160 字符 | 0 | 0 |
| 唯一 description 数 | 2 | **50** |
| 含 canonical | 0 | **50** |
| 含 og:* | 0 | **50** |
| 含 JSON-LD（可 parse） | 0 | **49** |
| sitemap.xml | 无 | **49 条 URL** |
| robots.txt | 无 | 有 |

- 构建：`vitepress build docs` 通过。
- 回归校验：`node scripts/verify-seo.mjs` 退出码 0。
- **反向验证**：临时回退 `config.mts` 后重跑校验，退出码 **1** 并报出「标题过短 20 < 40」「描述过短 15 < 70」「存在重复 description」「未生成 sitemap.xml」；还原修复后重回 0。证明该校验真正守住了本轮修复。
- 运行时实测：`/guide/accounts.html` 的 description 由 5 字符修正为 **156 字符**，JSON-LD `JSON.parse` 通过。

## 修订记录
| 日期 | 版本 | 修改内容 | 修改人 |
|---|---|---|---|
| 2026-10-04 | v1.0 | 初版创建 | AI Agent |
