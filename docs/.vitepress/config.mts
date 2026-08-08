import { defineConfig } from 'vitepress'
import { generateDocsIndex } from '../../scripts/generate-docs-index.mjs'

export default defineConfig({
  lang: 'zh-CN',
  title: 'QML Docs',
  description: 'QML 用户手册与插件开发指南',
  lastUpdated: true,
  head: [['link', { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' }]],
  buildEnd(siteConfig) {
    generateDocsIndex(siteConfig.srcDir, siteConfig.outDir, {
      guide: '使用指南',
      plugins: '插件开发',
      libraries: '前置插件文档'
    })
  },
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'QML Docs',
    nav: [
      { text: '指南', link: '/guide/' },
      { text: '插件开发', link: '/plugins/' },
      { text: '前置插件', link: '/libraries/' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: '使用指南',
          items: [
            { text: '简介', link: '/guide/' },
            { text: '快速上手', link: '/guide/getting-started' }
          ]
        }
      ],
      '/plugins/': [
        {
          text: '插件开发',
          items: [
            { text: '插件开发概览', link: '/plugins/' },
            { text: '从零开发第一个插件', link: '/plugins/creating-plugin' },
            { text: 'React + Vite 插件开发', link: '/plugins/react-plugin' },
            { text: 'manifest 清单详解', link: '/plugins/manifest' },
            { text: '插件 API 完整参考', link: '/plugins/plugin-api' },
            { text: 'UI 组件库（.p-* 样式）', link: '/plugins/plugin-ui' },
            { text: '插件依赖与互调用', link: '/plugins/dependencies' },
            { text: 'WASM 插件（L3）', link: '/plugins/wasm-plugin' },
            { text: '悬浮窗开发', link: '/plugins/overlay' },
            { text: '发布规范', link: '/plugins/publishing' },
            { text: '开发要点与避坑指南', link: '/plugins/pitfalls' }
          ]
        }
      ],
      '/libraries/': [
        {
          text: '前置插件文档',
          items: [
            { text: '概览', link: '/libraries/' },
            { text: 'MarkdownLib', link: '/libraries/markdownlib' }
          ]
        }
      ]
    },
    search: {
      provider: 'local'
    },
    outline: {
      level: [2, 3]
    }
  }
})
