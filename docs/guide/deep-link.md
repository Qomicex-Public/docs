# 外部唤起（qomicex-launcher://）

其他程序——网页、浏览器书签、桌面快捷方式、脚本——可以用 `qomicex-launcher://` 链接**直接唤起启动器**，并让它自动做一件事：启动某个实例、加入联机房间、安装插件或整合包、跳转到指定页面。

典型用法：

- 资源站/同学群里的「点这里一键进服」按钮 → 直接加入联机房间
- 整合包介绍页的「用 QML 安装」→ 自动装整合包并命名
- 插件作者官网的「安装到 QML」→ 自动装插件
- 自己做的快捷方式 → 一键启动常用实例

::: warning 协议名不是 `qomicex://`
`qomicex://` 是启动器**内部**用于前后端通信的私有协议（IPC 管道传输），**不是**给外部程序调用的接口。对外统一使用 **`qomicex-launcher://`**，两者互不影响。
:::

## 动作总览

| 动作 | URL 形态 | 效果 | 需要确认弹窗 |
| :--- | :--- | :--- | :--- |
| 启动实例 | `qomicex-launcher://launch/<实例名或ID>` | 直接启动该实例 | 否 |
| 打开页面 | `qomicex-launcher://open/<路由>` | 跳转到启动器内页面 | 否 |
| 加入房间 | `qomicex-launcher://join/<房间码>` | 加入多人联机房间 | 是 |
| 装插件（商店） | `qomicex-launcher://install/plugin?slug=<slug>` | 从插件商店安装 | 是（恒需） |
| 装插件（直链） | `qomicex-launcher://install/plugin?url=<https 地址>` | 下载 `.qplugin` 并安装 | 官方域免确认，其余需确认 |
| 装整合包 | `qomicex-launcher://install/modpack?type=…&projectId=…&fileId=…` | 从 Modrinth / CurseForge / FTB 安装整合包 | 是 |

> 「需要确认弹窗」指的是**从网页触发时**的保护措施，见下方 [安全须知](#安全须知)。

## 语法规则

链接的结构固定为：

```
qomicex-launcher://<动作>/<参数…>?<查询参数>
```

- **动作名写在 `//` 之后的第一段**，大小写不敏感（浏览器会把这一段统一转成小写）。
- **参数值大小写敏感**。例如实例名 `1.20.1-Forge` 与 `1.20.1-forge` 是两个不同的名字。
- 参数里若含 `/`、`?`、`&`、空格、中文等字符，需要做 **URL 编码**（percent-encode）。
  例如实例名 `我的 整合包` 要写成 `%E6%88%91%E7%9A%84%20%E6%95%B4%E5%90%88%E5%8C%85`。
- 无法识别的动作、缺少必需参数、或路由不在白名单内的链接会被**静默忽略**（启动器不会弹错误框打扰你）。

## 启动实例

```
qomicex-launcher://launch/1.20.1-Forge
qomicex-launcher://launch/%E6%88%91%E7%9A%84%E6%95%B4%E5%90%88%E5%8C%85
```

`launch/` 后面可以填**实例名**或**实例 ID**，启动器先按名字匹配，再按 ID 匹配。

- 匹配不到时会提示「未找到实例」，不会启动任何东西。
- 效果与在「实例管理」里点启动完全一致（含 Java 检查、内存设置等）。

## 打开页面

```
qomicex-launcher://open/settings
qomicex-launcher://open/resource-center
qomicex-launcher://open/instances/1.20.1-Forge
```

为避免任意页面注入，**只允许跳转到启动器内已注册的页面**：

| 路由 | 页面 |
| :--- | :--- |
| `/` | 主页 |
| `/instances` | 实例管理（可带子路径，如 `/instances/<ID>`） |
| `/downloads` | 下载中心 |
| `/accounts` | 账户管理 |
| `/resource-center` | 资源中心 |
| `/connect` | 多人联机 |
| `/settings` | 设置 |
| `/running` | 运行中 |
| `/log-analysis` | 日志分析 |

上表路由**及其子路径**都允许（例如 `/instances/abc` 合法）。不在此列的路径会被忽略。

## 加入联机房间

```
qomicex-launcher://join/482913
```

`join/` 后面就是房主给你的**房间码**。触发后启动器会先切到「联机」页，再发起加入，并弹窗让你确认。

## 安装插件

### 从插件商店安装（推荐给网站作者）

```
qomicex-launcher://install/plugin?slug=top.qomicex.weather
qomicex-launcher://install/plugin?slug=top.qomicex.weather&version=0.4.0
```

- `slug`：商店里的插件标识（商店页面地址最后一段）。
- `version`：可选。不填则装最新版。
- 商店安装带 **SHA256 校验 + 签名验证 + 依赖预检**，是最安全的路径。
- 由于 slug 无法证明来源（任何网页都能编一个 slug），**这条恒需你确认**。

### 从直链安装

```
qomicex-launcher://install/plugin?url=https%3A%2F%2Fexample.com%2Fmy-plugin.qplugin
```

- `url` 必须是 `http` / `https`，且指向一个 `.qplugin` 包。
- **官方域**（`api.qomicex.top`、`qomicex.top`，且必须是 https）**免确认**；其他来源一律弹窗，窗口里会显示来源主机名与完整地址。
- 其他来源在你确认后，允许安装**未签名**的包（与设置页「手动上传 + 风险确认」口径一致）。签名无效的包仍会被拒绝。
- 下载体积上限 **64 MiB**。
- 出于安全考虑，指向内网/本机地址（`127.0.0.1`、`localhost`、`192.168.x.x` 等）的地址会被拒绝。

## 安装整合包

```
qomicex-launcher://install/modpack?type=modrinth&projectId=AABBCC&fileId=123456
qomicex-launcher://install/modpack?type=curseforge&projectId=123456&fileId=7890&name=My%20Pack
```

| 参数 | 必填 | 说明 |
| :--- | :--- | :--- |
| `type` | 是 | `modrinth`（或 `mr`）/ `curseforge`（或 `cf`）/ `ftb` |
| `projectId` | 是 | 平台上的整合包项目 ID |
| `fileId` | 是 | 平台上的**具体文件版本 ID** |
| `name` | 否 | 安装后的实例名。不填时自动取整合包的官方名称 |

- `projectId` 与 `fileId` **必须同时提供**——只给项目 ID 无法确定要装哪个版本。
- 触发后会弹窗确认，确认后开始后台安装，可在**下载中心**查看进度。
- 出于安全考虑，**不支持**用链接指定本地文件路径。

## 安全须知

外部唤起链接**可以被任意网页触发**，任何人都能写一个 `qomicex-launcher://` 链接放到自己的页面里。因此启动器遵循两条规则：

1. **凡是会往你机器上落代码的动作，默认都要你点确认。**
   涉及：安装插件、安装整合包、加入联机房间。
2. **只有官方域可以免确认安装**，且判定条件是「https + 主机名精确匹配 `api.qomicex.top` 或 `qomicex.top`」。
   `evil-qomicex.top` 这类**后缀相同**的域名**不会**被放行。

不需要确认的动作（启动实例、跳转页面）不会修改你的任何数据。

::: tip 看到确认弹窗是正常的
如果你是从熟悉的站点点的链接，弹窗里核对一下**来源主机名**和**将要安装的东西**，确认即可。如果来源你不认识，点取消。
:::

## 排障

### 点了链接没反应

按顺序排查：

1. **启动器装过吗？** 协议关联在启动器**首次运行**时自动注册到当前用户（不需要管理员权限）。从未运行过启动器的机器上没有关联。
2. **浏览器拦截**。部分浏览器只允许在**用户点击**时跳转外部协议，脚本自动跳转会被拦。请改用真实的可点击链接。
3. **协议被别的程序占用**。检查系统里是否有其他程序注册了 `qomicex-launcher`。
4. **确认协议名拼写**。必须是 `qomicex-launcher://`，不是 `qomicex://`。

### 弹窗问「此请求来自 xxx」

这是**预期行为**，不是错误：该链接的来源不在官方域白名单里。核对来源后再决定。

### 手动测试链接

不想写网页时，可以直接用命令行触发（排障必备）：

::: code-group

```powershell [Windows]
Start-Process 'qomicex-launcher://open/settings'
```

```bash [Linux]
xdg-open 'qomicex-launcher://open/settings'
```

```bash [macOS]
open 'qomicex-launcher://open/settings'
```

:::

Windows 上也可以在「运行」对话框或 CMD 里直接执行 `start qomicex-launcher://launch/1.20.1-Forge`。

## 平台注册机制

启动器在不同系统上的关联方式不同，这决定了一些行为差异：

| 平台 | 关联方式 | 备注 |
| :--- | :--- | :--- |
| Windows | 首次运行时写入当前用户注册表 `HKCU\Software\Classes\qomicex-launcher` | 免管理员；换机器/重装需重新运行一次启动器 |
| Linux | 写入 `~/.local/share/applications/` 下的 `.desktop` 处理器并调用 `xdg-mime` | 依赖系统有 `xdg-mime` 与 `update-desktop-database` |
| macOS | **打包期**写入 `Info.plist` 的 `CFBundleURLTypes` | 运行时无法注册，因此**必须是安装包形态**；直接跑裸可执行文件不会关联 |

## 单实例行为

启动器同一时间只运行一个实例，这样点链接不会开出一堆窗口：

- **启动器没开** → 正常启动，并执行链接里的动作。
- **启动器已经开着** → 新进程把链接**转交给已有窗口**，自己退出；已有窗口会被拉到前台并执行动作。

::: warning 调试模式的例外
用 `--debug <端口>` 参数启动（供 `qomicex debug` 与自动化调试使用）时**不启用单实例**——该模式必须每次开新进程才能暴露调试端口。此模式下重复启动会开出多个启动器，属预期。
:::

## 限制

- **本地文件路径不支持**。为了让链接无法指定磁盘上任意文件，`install/*` 只接受 URL 或平台项目 ID。
- **动作无法串行执行**。一条链接只做一件事。
- **无法传任意命令行参数给游戏**。需要自定义 JVM 参数请在实例设置里配置。
- 未识别的链接被静默忽略，不会给出错误提示（避免网页探测本机是否装了启动器）。

## 给第三方开发者

如果你在做资源站、启动器联动或插件分发，可以直接构造上面的链接，无需任何 SDK 或权限申请：

- 想要「一键启动某实例」→ 用 `launch/<实例名>`，但实例名是用户本地的，建议引导用户自行复制自己的链接。
- 想要「一键装你的插件」→ 首选**上架插件商店**后用 `install/plugin?slug=…`（有签名校验，用户信任度更高）。
- 想要「不经过商店直链分发」→ 用 `install/plugin?url=…`，但**每次都会弹窗**要求用户确认来源，请把包托管在稳定的 https 地址上，并尽量提供有效签名。
- 想要「整合包一键安装」→ 用 `install/modpack?type=…&projectId=…&fileId=…`。

底层实现与决策记录见启动器仓库的 ADR-100；直链安装对应的后端端点为 `POST /api/plugins/install-url`。
