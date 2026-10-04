// IndexNow 主动推送（通用版）
//
// 与 www 站同一套机制：把 sitemap 里的 URL 提交给 Bing / Yandex 等，
// 缩短新内容被收录的延迟（Bing 指南 §4：用 IndexNow 通知内容新增/更新/删除）。
//
// key 文件必须能通过 https://<host>/<key>.txt 访问，且内容等于文件名（去 .txt）。
//
// 用法（在各站点目录下执行）：
//   node scripts/indexnow.mjs --host docs.qomicex.top --sitemap https://docs.qomicex.top/sitemap.xml
//   node scripts/indexnow.mjs --host plugins.qomicex.top --urls https://.../sitemap.xml
//   node scripts/indexnow.mjs --dry-run
//
// 不挂在 build 上：构建不应有外部副作用（与 www 站一致的取舍）。
// 应在「部署成功之后」调用——部署前提交，爬虫抓到的是 404，会损害收录信任度。

const ARGS = process.argv.slice(2)
const argOf = (name) => {
  const i = ARGS.indexOf(name)
  return i >= 0 ? ARGS[i + 1] : undefined
}
const DRY_RUN = ARGS.includes('--dry-run')

const HOST = argOf('--host')
const SITEMAP = argOf('--sitemap')
const KEY = argOf('--key')

if (!HOST) {
  console.error('✗ 缺少 --host（如 --host docs.qomicex.top）')
  process.exit(1)
}
if (!KEY) {
  console.error('✗ 缺少 --key（IndexNow key，需与线上 /<key>.txt 内容一致）')
  process.exit(1)
}
if (!SITEMAP) {
  console.error('✗ 缺少 --sitemap（如 --sitemap https://docs.qomicex.top/sitemap.xml）')
  process.exit(1)
}

/** 带重试的 GET：CI 中紧随部署完成，边缘节点可能还差几秒才稳定 */
async function fetchText(url, tries = 3, delayMs = 5000) {
  let lastErr
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } })
      if (res.ok) return await res.text()
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (e) {
      lastErr = e
    }
    if (i < tries) {
      console.log(`  第 ${i} 次获取失败(${lastErr.message})，${delayMs / 1000}s 后重试…`)
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  throw new Error(`获取 ${url} 失败: ${lastErr.message}`)
}

const locs = (xml) => [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])

const sitemapXml = await fetchText(SITEMAP)
let urlList = [...new Set(locs(sitemapXml))]

if (urlList.length === 0) {
  console.error('✗ sitemap 中未取到任何 URL')
  process.exit(1)
}

// 递交前校验：URL 必须属于本站 host，否则 IndexNow 返回 422
const foreign = urlList.filter((u) => {
  try {
    return new URL(u).host !== HOST
  } catch {
    return true
  }
})
if (foreign.length > 0) {
  console.error(`✗ 以下 URL 不属于 ${HOST}，IndexNow 会拒绝:`)
  foreign.slice(0, 5).forEach((u) => console.error(`   ${u}`))
  process.exit(1)
}

console.log(`准备提交 ${urlList.length} 个 URL 到 IndexNow (${HOST})`)

if (DRY_RUN) {
  console.log('--dry-run 已启用，仅列出将提交的 URL（不发请求）:')
  urlList.forEach((u) => console.log(`   ${u}`))
} else {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `https://${HOST}/${KEY}.txt`,
      urlList,
    }),
  })

  // 200/202 = 接受；其他码见 https://www.indexnow.org/documentation
  if (res.status === 200) console.log('✓ 提交成功 (200 OK)')
  else if (res.status === 202) console.log('✓ 已接受，待处理 (202 Accepted)')
  else {
    const text = await res.text().catch(() => '')
    console.error(`✗ 提交失败 HTTP ${res.status}${text ? ' — ' + text.slice(0, 300) : ''}`)
    if (res.status === 403) console.error('  提示：key 文件不可访问或内容不匹配')
    if (res.status === 422) console.error('  提示：URL 不属于该 host 或格式有误')
    process.exit(1)
  }

  console.log(`已提交: ${urlList.slice(0, 3).join(', ')}${urlList.length > 3 ? ` … (+${urlList.length - 3})` : ''}`)
}
