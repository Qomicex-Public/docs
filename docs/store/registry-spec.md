# 开放注册表协议

Qomicex 启动器支持多源插件分发。本文档定义**开放注册表协议**，第三方可据此实现兼容的镜像或私有注册表，启动器自动识别并回退。

## 设计目标

- **零入侵**：镜像只需实现 4 个只读端点，无需用户登录/签名/审核逻辑
- **双通道下载**：包体原样保留签名文件，不破坏信任链
- **自动发现**：启动器配置 `registryUrl` 后，主源不可达时自动回退到镜像

## 核心端点

注册表需实现以下 4 个 HTTP 端点：

### GET /registry

返回注册表元信息，启动器用于验证源可用性。

```json
{
  "name": "My Mirror",
  "version": "1.0.0",
  "description": "Qomicex plugin registry mirror",
  "homepage": "https://example.com"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 注册表名称 |
| `version` | string | ✅ | 协议版本（当前 `1.0.0`） |
| `description` | string | ❌ | 简短描述 |
| `homepage` | string | ❌ | 注册表主页 URL |

### GET /plugins

返回插件列表，支持分页与搜索。

**查询参数：**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `q` | string | - | 模糊搜索（名称/描述/slug） |
| `page` | number | 1 | 页码（从 1 起） |
| `pageSize` | number | 20 | 每页数量（上限 50） |

**响应：**

```json
{
  "total": 42,
  "page": 1,
  "pageSize": 20,
  "items": [
    {
      "slug": "my-plugin",
      "name": "My Plugin",
      "description": "A useful plugin",
      "category": "tool",
      "latestVersion": "1.2.3",
      "downloadsCount": 1024,
      "iconUrl": "https://example.com/icon.png"
    }
  ]
}
```

### GET /plugins/:slug

返回单个插件详情及版本列表。

**响应：**

```json
{
  "slug": "my-plugin",
  "name": "My Plugin",
  "description": "A useful plugin",
  "category": "tool",
  "iconUrl": "https://example.com/icon.png",
  "versions": [
    {
      "version": "1.2.3",
      "changelog": "修复 X 问题",
      "minLauncherVersion": "1.0.0",
      "layers": ["l3"],
      "permissions": [],
      "sha256": "abc123...",
      "sizeBytes": 102400,
      "downloadCount": 512,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### GET /plugins/:slug/versions/:version/download

返回包体下载信息。`:version` 可为具体版本号或 `latest`。

**响应：**

```json
{
  "url": "https://cdn.example.com/plugins/my-plugin-1.2.3.qplugin",
  "mirrorUrl": "https://backup.example.com/plugins/my-plugin-1.2.3.qplugin",
  "sha256": "abc123...",
  "size": 102400
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `url` | string | 主下载地址 |
| `mirrorUrl` | string | 备用下载地址（可选） |
| `sha256` | string | 包体 SHA-256 校验和 |
| `size` | number | 包体字节数 |

## 下载双通道

镜像重传包体时**必须原样保留**以下签名文件：

```
signature.json        ← Ed25519 签名（不可重打包）
signature.cert.json   ← 开发者证书（不可重打包）
```

- 镜像应原样转发 `.qplugin` zip 文件，不做任何解压/重压缩操作
- 下载 URL 建议带 `Content-Disposition: attachment` 头，避免浏览器直接渲染
- 支持 `Range` 请求头（可选），便于断点续传

## 启动器集成

### 配置方式

在启动器设置中配置 `registryUrl`（字符串或数组）：

```json
{
  "registryUrl": [
    "https://plugins.qomicex.top/api/v1",
    "https://my-mirror.example.com/api/v1"
  ]
}
```

单个 URL 字符串等价于单元素数组。

### 发现与回退

1. 启动器按列表顺序尝试请求 `GET /registry`
2. 首个可用源（2xx 响应）作为主源
3. 主源请求超时（默认 5s）或返回 5xx 时，自动回退到下一源
4. 所有源不可达时，显示「插件商店暂时不可用」提示

### 缓存策略

- 插件列表：15s 本地缓存
- 插件详情：300s 本地缓存
- 缓存失效时静默刷新，不阻塞 UI

## 部署方式

### Cloudflare Worker（推荐）

最简部署，共享 Cloudflare 边缘网络负载：

- Worker 从源站（如 GitHub Releases / S3）代理包体
- 静态元信息缓存在 KV 或 Durable Objects
- 无需管理服务器，自动扩容

### 纯静态托管（只读镜像）

适合只读镜像场景：

- 包体存储在 CDN / Object Storage（如 R2、OSS、S3）
- `plugins.json` + 各插件 `detail.json` 预生成为静态文件
- 定时任务从主源同步更新

### 自建完整注册表

适合需要独立审核/分发的场景：

- 实现完整 4 端点 + 包体存储
- 可扩展 `/admin/*` 管理端点（非协议要求）
- 需自行处理签名验证、依赖检查等逻辑

## 协议版本

当前协议版本 `1.0.0`。未来变更遵循：

- **Minor**（1.x.0）：新增可选端点或字段，向后兼容
- **Major**（x.0.0）：不兼容变更，需启动器适配

## 示例：Cloudflare Worker 骨架

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    // GET /registry
    if (path === '/registry') {
      return Response.json({
        name: 'My Mirror',
        version: '1.0.0'
      })
    }

    // GET /plugins
    if (path === '/plugins' && request.method === 'GET') {
      const q = url.searchParams.get('q') || ''
      const page = parseInt(url.searchParams.get('page') || '1')
      // 从 KV / D1 查询插件列表
      const items = await queryPlugins(q, page)
      return Response.json({ total: items.length, page, pageSize: 20, items })
    }

    // GET /plugins/:slug
    const slugMatch = path.match(/^\/plugins\/([^/]+)$/)
    if (slugMatch && request.method === 'GET') {
      const detail = await getPluginDetail(slugMatch[1])
      if (!detail) return Response.json({ error: { code: 'not_found' } }, { status: 404 })
      return Response.json(detail)
    }

    // GET /plugins/:slug/versions/:version/download
    const dlMatch = path.match(/^\/plugins\/([^/]+)\/versions\/([^/]+)\/download$/)
    if (dlMatch && request.method === 'GET') {
      const info = await getDownloadInfo(dlMatch[1], dlMatch[2])
      if (!info) return Response.json({ error: { code: 'not_found' } }, { status: 404 })
      return Response.json(info)
    }

    return Response.json({ error: { code: 'not_found' } }, { status: 404 })
  }
}
```
