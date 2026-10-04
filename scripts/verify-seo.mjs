// SEO 回归校验（qml-docs）
//
// 为什么需要它：本轮修的是一组「缺失/过短/重复」类的静态缺陷，
// 只看构建成功无法证明修好了——构建通过而 meta 依旧缺失是完全可能的。
// 本脚本对 dist 产物做断言，把「描述唯一」「标题/描述达到下限」「canonical/og/JSON-LD 存在」
// 这些不变量固化下来，防止后续改动（或依赖升级）悄悄回退。
//
// 用法：node scripts/verify-seo.mjs
//   退出码 0 = 全部不变量成立；1 = 有回退。

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'docs/.vitepress/dist')

const TITLE_MIN = 40
const TITLE_MAX = 70
const DESC_MIN = 70
const DESC_MAX = 160
/** 404 页按设计允许空 short，但必须 noindex */
const EXPECTED_EXEMPT = new Set(['404.html'])

if (!existsSync(DIST)) {
  console.error(`✗ 未找到构建产物 ${DIST}，请先执行 npm run docs:build`)
  process.exit(1)
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (entry.endsWith('.html')) out.push(full)
  }
  return out
}

const attr = (html, re) => {
  const m = html.match(re)
  return m ? m[1] : ''
}

const failures = []
const rows = []

for (const file of walk(DIST)) {
  const rel = relative(DIST, file).split('\\').join('/')
  const html = readFileSync(file, 'utf-8')
  const exempt = EXPECTED_EXEMPT.has(rel)

  const title = attr(html, /<title>([^<]*)<\/title>/)
  const desc = attr(html, /<meta name="description" content="([^"]*)"/)
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/)
  const robots = attr(html, /<meta name="robots" content="([^"]*)"/)
  const ogTitle = attr(html, /<meta property="og:title" content="([^"]*)"/)
  const ogDesc = attr(html, /<meta property="og:description" content="([^"]*)"/)
  const ldRaw = attr(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/)

  rows.push({ rel, title, desc, canonical, robots, ldRaw, exempt })

  // 每条页面描述必须唯一（本轮修的核心缺陷之一：49 页共用同一句）
  // 由下方的全局唯一性检查覆盖

  if (!title) failures.push(`${rel}: 缺少 <title>`)
  if (!desc) failures.push(`${rel}: 缺少 meta description`)
  if (!canonical) failures.push(`${rel}: 缺少 canonical`)
  if (!robots) failures.push(`${rel}: 缺少 meta robots`)
  if (!ogTitle || !ogDesc) failures.push(`${rel}: 缺少 og:title / og:description`)

  if (title.includes('"')) failures.push(`${rel}: title 含裸双引号，会破坏属性/标记`)

  if (!exempt) {
    if (title.length < TITLE_MIN) failures.push(`${rel}: 标题过短 ${title.length} < ${TITLE_MIN}`)
    if (title.length > TITLE_MAX) failures.push(`${rel}: 标题过长 ${title.length} > ${TITLE_MAX}`)
    if (desc.length < DESC_MIN) failures.push(`${rel}: 描述过短 ${desc.length} < ${DESC_MIN}`)
    if (desc.length > DESC_MAX) failures.push(`${rel}: 描述过长 ${desc.length} > ${DESC_MAX}`)
    if (!canonical.startsWith('https://docs.qomicex.top/')) failures.push(`${rel}: canonical 域名异常 ${canonical}`)
    if (!/index/.test(robots)) failures.push(`${rel}: robots 未声明 index（${robots}）`)

    // JSON-LD 必须存在且可被 JSON.parse（被转义破坏会 parse 失败）
    if (!ldRaw) failures.push(`${rel}: 缺少 JSON-LD`)
    else {
      try {
        JSON.parse(ldRaw)
      } catch (e) {
        failures.push(`${rel}: JSON-LD 不是合法 JSON（${e.message}）`)
      }
    }
  } else {
    if (!/noindex/.test(robots)) failures.push(`${rel}: 期望 noindex，实际 ${robots}`)
  }
}

// 页面描述全局唯一
const descs = rows.filter((r) => !r.exempt).map((r) => r.desc)
const dupes = [...new Set(descs.filter((d, i) => descs.indexOf(d) !== i))]
if (dupes.length) failures.push(`存在重复 description（${dupes.length} 组）：${dupes.slice(0, 2).map((d) => d.slice(0, 40)).join(' | ')}`)

// 标题全局唯一
const titles = rows.filter((r) => !r.exempt).map((r) => r.title)
const titleDupes = [...new Set(titles.filter((t, i) => titles.indexOf(t) !== i))]
if (titleDupes.length) failures.push(`存在重复 title（${titleDupes.length} 组）`)

// sitemap 必须存在且为合法 XML
const sitemap = join(DIST, 'sitemap.xml')
if (!existsSync(sitemap)) failures.push('未生成 sitemap.xml')
else {
  const xml = readFileSync(sitemap, 'utf-8')
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])
  if (locs.length < rows.length - 1) failures.push(`sitemap URL 数（${locs.length}）少于页面数（${rows.length - 1}）`)
  if (locs.some((u) => !u.startsWith('https://docs.qomicex.top/'))) failures.push('sitemap 含非本站 URL')
}

// robots.txt 必须存在且指向 sitemap
const robotsTxt = join(DIST, 'robots.txt')
if (!existsSync(robotsTxt)) failures.push('未生成 robots.txt')
else if (!readFileSync(robotsTxt, 'utf-8').includes('sitemap.xml')) failures.push('robots.txt 未指向 sitemap.xml')

console.log(`检查 ${rows.length} 个页面 + sitemap.xml + robots.txt`)
for (const r of rows) {
  if (r.exempt) continue
  console.log(`  ✓ ${r.rel.padEnd(38)} title=${String(r.title.length).padStart(3)} desc=${String(r.desc.length).padStart(3)} ld=ok`)
}

if (failures.length) {
  console.error(`\n✗ SEO 校验失败，共 ${failures.length} 项：`)
  for (const f of failures) console.error(`   - ${f}`)
  process.exit(1)
}
console.log('\n✓ SEO 校验全部通过')
