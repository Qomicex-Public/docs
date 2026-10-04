// QML Docs —— SEO 元数据派生模块
//
// 背景（见 ADR：四站 SEO 根因定位）：
//   第三方 SEO 报告把 docs.qomicex.top 的数据误标成了 www.qomicex.top。
//   实测本站 50 个 HTML 中：title < 40 字符 49 页、description < 70 字符 50 页，
//   且 49 页共用同一句 15 字符的站点级 description；
//   另有 sitemap / robots / canonical / og / JSON-LD 全缺。
//
// 做法：不为 49 个 md 手写 49 组元数据（易漏、易过期），
// 而是从每页自身的 H1 与正文首段派生唯一的 title / description，
// 由 config.mts 的 transformPageData 注入。内容更新时元数据自动跟随。
//
// 标题拼接：pageData.title + titleTemplate(默认 " | QML Docs")。
// 本模块返回「已含品牌后缀」的完整标题，并置 titleTemplate:false 避免重复追加。

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const SITE_ORIGIN = 'https://docs.qomicex.top'
export const SITE_NAME = 'QML Docs'
export const SITE_TAGLINE = 'Qomicex Launcher（QML 启动器）'

// 本文件位于 docs/.vitepress/，故 docs 源目录即其父目录。
// 注意：VitePress 传给 transformPageData / transformHead 的 pageData 并不保证带
// filePath，实测为 undefined；因此必须用 relativePath 自行拼绝对路径，
// 否则读取失败会静默回退到已被改写过的 title，产出过短描述与重复品牌后缀。
const DOCS_ROOT = fileURLToPath(new URL('../', import.meta.url))

/** 按 relativePath 读取页面 markdown 源文件 */
function readMarkdown(relativePath) {
  if (!relativePath) return ''
  const abs = DOCS_ROOT + String(relativePath).replace(/\\/g, '/')
  try {
    return existsSync(abs) ? readFileSync(abs, 'utf-8') : ''
  } catch {
    return ''
  }
}

/** 目标区间：Bing 指南指出标题/描述缺失、重复或过短会降低收录可靠性 */
const TITLE_MIN = 40
const TITLE_MAX = 70
const DESC_MIN = 70
const DESC_MAX = 160

const BRAND_SUFFIX = ' | ' + SITE_NAME

/**
 * 分类补充语。每页 = 自身 H1（唯一）+ 分类补充语 + 品牌后缀，
 * 因此标题天然全站唯一；描述由正文首段 + 分类补充语保证 >= DESC_MIN。
 */
const CATEGORY = {
  guide: {
    titleLong: ` — ${SITE_TAGLINE}使用教程`,
    titleShort: ' — QML 启动器使用教程',
    desc: '本篇属于 QML 启动器使用指南，覆盖账户管理、实例创建、资源下载与多人联机等日常操作。',
  },
  plugins: {
    titleLong: ` — ${SITE_TAGLINE}插件开发指南`,
    titleShort: ' — QML 插件开发',
    desc: '本篇属于 QML 插件开发文档，覆盖 manifest 清单、插件 API、UI 组件库、调试与发布流程。',
  },
  libraries: {
    titleLong: ` — ${SITE_TAGLINE}前置插件文档`,
    titleShort: ' — QML 前置插件文档',
    desc: '本篇属于 QML 前置插件文档，供需要集成 MarkdownLib / MarkItDown 等基础库的插件开发者参考。',
  },
  store: {
    titleLong: ' — Qomicex 插件商店发布与 API 文档',
    titleShort: ' — QML 插件商店文档',
    desc: '本篇属于 QML 插件商店文档，覆盖 .qplugin 打包签名、上架流程与开放注册表 API 规范。',
  },
  root: {
    titleLong: '',
    titleShort: '',
    desc: 'QML Docs 是 Qomicex Launcher（QML 启动器）的官方文档站，提供面向终端用户的使用手册与教程，以及面向开发者的插件开发、打包发布与商店 API 参考，覆盖安装、实例管理、账户管理与多人联机等内容。',
  },
}

/** 由相对路径判断所属分类 */
export function categoryOf(relativePath) {
  const p = (relativePath || '').replace(/\\/g, '/')
  const head = p.split('/')[0]
  return Object.prototype.hasOwnProperty.call(CATEGORY, head) ? head : 'root'
}

/** 站点绝对 URL（与 VitePress 默认 cleanUrls:false 的 .html 输出一致） */
export function pageUrl(relativePath) {
  const p = (relativePath || '').replace(/\\/g, '/')
  if (!p || p === 'index.md') return SITE_ORIGIN + '/'
  return SITE_ORIGIN + '/' + p.replace(/\.md$/, '.html')
}

/** 去掉 markdown 语法，得到可读纯文本（导出以便单测） */
export function stripMarkdown(md) {
  let s = md
  s = s.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '') // frontmatter
  s = s.replace(/```[\s\S]*?```/g, ' ') // 围栏代码块
  s = s.replace(/~~~[\s\S]*?~~~/g, ' ')
  s = s.replace(/`([^`]*)`/g, '$1') // 行内代码
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接保留文字
  s = s.replace(/<[^>]+>/g, ' ') // HTML 标签
  s = s
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false
      if (/^#{1,6}\s/.test(line)) return false // 标题
      if (/^>/.test(line)) return false // 引用
      if (/^\|/.test(line)) return false // 表格
      if (/^[-*_]{3,}$/.test(line)) return false // 分隔线
      if (/^:::/.test(line)) return false // 容器指令
      if (/^([-*+]|\d+\.)\s/.test(line)) return false // 列表
      return true
    })
    .join(' ')
  s = s.replace(/[*_~]/g, '')
  s = s.replace(/\s+/g, ' ')
  return s.trim()
}

/** 截断到上限，尽量不在句中硬切 */
function clamp(text, max) {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const stop = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('；'), cut.lastIndexOf('，'), cut.lastIndexOf(' '))
  return (stop > max * 0.6 ? cut.slice(0, stop + 1) : cut).replace(/[，、；,;\s]+$/, '') + '…'
}

/**
 * HTML 属性转义。
 *
 * 必须自行转义：VitePress 会把 transformHead 返回的 HeadConfig 属性**原样拼进
 * HTML**，不做转义。正文里若出现 ASCII 双引号（如 `"实例"就是一个…`），
 * 会提前闭合 content="..."，导致解析出的 description 只剩引号前的几个字符
 * （实测 guide/instances.html 被截成 5 字符）。中文文档优先改用全角引号，
 * 其余仍做实体转义兜底。
 */
export function escapeAttr(text) {
  return String(text ?? '')
    .replace(/"/g, '&quot;')
    .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** 正文中的直引号改为中文全角引号，避免在属性里裸奔 */
function normalizeQuotes(text) {
  return String(text ?? '').replace(/"([^"]*)"/g, '“$1”')
}

/** 取页面 H1（回退到 VitePress 解析出的 title / frontmatter） */
function headingOf(markdown, fallback) {
  const h1 = markdown.match(/^\s*#\s+(.+?)\s*$/m)
  if (h1) return h1[1].trim()
  const fm = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (fm) {
    const t = fm[1].match(/^title\s*:\s*(.+)$/m)
    if (t) return t[1].trim().replace(/^["']|["']$/g, '')
  }
  return (fallback || '').trim()
}

/**
 * 派生页面 SEO 元数据。
 * @returns {{title:string, description:string, titleTemplate:false,
 *            isHome:boolean, isNotFound:boolean, url:string, category:string}}
 */
export function derivePageSeo(pageData) {
  const rel = pageData.relativePath || ''
  const cat = categoryOf(rel)
  // relativePath 为空 = VitePress 的虚拟首页/404；显式识别，避免误判为首页
  const isVirtual = !rel
  const isHome = rel === 'index.md'
  const isNotFound = !isVirtual && (Boolean(pageData.isNotFound) || rel === '404.md')

  const markdown = readMarkdown(rel)

  // ---------- description ----------
  const explicit =
    typeof pageData.frontmatter?.description === 'string' ? pageData.frontmatter.description.trim() : ''
  const heading = headingOf(markdown, pageData.title)
  let description = explicit
  if (!description) {
    const body = stripMarkdown(markdown)
    // 首段常已点明主题；若未以 H1 起句则补上，保证描述可独立成立（Bing 指南 §15）
    description = body && heading && !body.startsWith(heading) ? `${heading}：${body}` : body || heading
  }
  // 抬到下限；分类补充语让每页保持唯一
  if (description.length < DESC_MIN) {
    const tail = isHome || isVirtual ? CATEGORY.root.desc : CATEGORY[cat].desc
    if (tail && !description.includes(tail)) description = description ? `${description} ${tail}` : tail
  }
  if (!description) description = CATEGORY.root.desc
  description = normalizeQuotes(clamp(description, DESC_MAX))

  // ---------- title ----------
  let title
  if (isNotFound) {
    title = `页面未找到（404）${BRAND_SUFFIX}`
  } else if (isVirtual) {
    title = `${SITE_NAME} — ${SITE_TAGLINE}官方用户手册、插件开发与商店 API 文档`
  } else if (isHome) {
    title = `${SITE_NAME} — ${SITE_TAGLINE}用户手册与插件开发指南`
    if (title.length < TITLE_MIN) {
      title = `${SITE_NAME} — ${SITE_TAGLINE}官方用户手册、插件开发与商店 API 文档`
    }
  } else {
    const c = CATEGORY[cat]
    const long = heading + c.titleLong + BRAND_SUFFIX
    const short = heading + c.titleShort + BRAND_SUFFIX
    // 长补充语优先（把短 H1 抬进下限）；超上限回退短版，再超则截断
    title = long.length <= TITLE_MAX ? long : short
    if (title.length > TITLE_MAX) title = clamp(title, TITLE_MAX)
  }

  return { title: normalizeQuotes(title), description, titleTemplate: false, isHome, isNotFound, url: pageUrl(rel), category: cat }
}

/**
 * 结构化数据：文档页 TechArticle，首页 WebSite + Organization。
 * 仅描述页面自身的可见信息，不编造内容（Bing 指南 §14）。
 */
export function structuredData(seo) {
  if (seo.isNotFound) return null
  if (seo.isHome) {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: SITE_NAME,
          alternateName: ['QML 文档', 'Qomicex Launcher 文档'],
          url: SITE_ORIGIN + '/',
          inLanguage: 'zh-CN',
          description: seo.description,
        },
        {
          '@type': 'Organization',
          name: 'Qomicex',
          url: 'https://www.qomicex.top/',
          logo: SITE_ORIGIN + '/logo.svg',
        },
      ],
    }
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: seo.title,
    description: seo.description,
    url: seo.url,
    inLanguage: 'zh-CN',
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_ORIGIN + '/' },
    publisher: { '@type': 'Organization', name: 'Qomicex', url: 'https://www.qomicex.top/' },
  }
}
