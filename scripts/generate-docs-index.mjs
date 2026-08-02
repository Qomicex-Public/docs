import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const EXCLUDE_DIRS = new Set(['.vitepress', 'public', 'node_modules'])
const ROOT_CATEGORY = 'root'

function walk(dir, base, out) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, base, out)
    } else if (entry.endsWith('.md')) {
      out.push(full)
    }
  }
}

function extractTitle(content, fallback) {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (fm) {
    const m = fm[1].match(/^title\s*:\s*(.+)$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  const h1 = content.match(/^#\s+(.+)$/m)
  if (h1) return h1[1].trim()
  return fallback
}

function toUrl(relPath) {
  const noExt = relPath.replace(/\.md$/, '')
  const parts = noExt.split('/')
  if (parts[parts.length - 1] === 'index') {
    const dir = parts.slice(0, -1).join('/')
    return '/' + (dir ? dir + '/' : '')
  }
  return '/' + parts.join('/') + '.html'
}

function categoryOf(relPath) {
  const parts = relPath.split('/')
  return parts.length > 1 ? parts[0] : ROOT_CATEGORY
}

export function generateDocsIndex(srcDir, outDir, categoryLabels = {}) {
  const files = []
  walk(srcDir, srcDir, files)

  const docs = files.map((file) => {
    const relPath = relative(srcDir, file)
    const path = relPath.split(sep).join('/')
    return {
      title: extractTitle(readFileSync(file, 'utf-8'), path),
      url: toUrl(path),
      path
    }
  })

  const groups = new Map()
  for (const doc of docs) {
    const key = categoryOf(doc.path)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(doc)
  }

  const categories = [...groups.keys()]
    .sort((a, b) => (a === ROOT_CATEGORY ? -1 : b === ROOT_CATEGORY ? 1 : a.localeCompare(b)))
    .map((key) => ({
      name: key,
      label: key === ROOT_CATEGORY ? '概览' : categoryLabels[key] || key,
      docs: groups.get(key).sort((a, b) => a.path.localeCompare(b.path))
    }))

  const index = {
    site: 'QML Docs',
    description: '文档索引，供 AI Agent 查阅，无需逐页爬取',
    generatedAt: new Date().toISOString(),
    total: docs.length,
    categories
  }

  writeFileSync(join(outDir, 'docs.json'), JSON.stringify(index, null, 2), 'utf-8')
}
