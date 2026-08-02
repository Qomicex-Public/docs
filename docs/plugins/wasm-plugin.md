# WASM 插件（L3）

L3 插件以 **WASM 模块**形式运行在启动器 Rust 层（wasmtime 引擎）的沙箱中，适合 Agent、协议解析器、复杂逻辑等场景。与 L2（前端脚本）不同，L3 在**独立运行时**执行，不依赖浏览器环境。

## 一、工作原理

```
后端(C#) ──HTTP──→ 插件网关(localhost:动态端口) ──→ Tauri Rust(wasmtime) ──→ WASM 插件
```

- 启动器启动时，Rust 网关扫描 `plugins/{插件id}/plugin.wasm`（需 manifest `layers` 含 `l3`）
- wasmtime 引擎加载模块，注入 host 函数（`qomicex` 模块），调用插件导出的函数
- 网关端口写入 `plugins/.gateway_port`，后端 `PluginGatewayClient` 读取并代理
- 前端通过 `__PLUGIN_API__.callWasm(...)` 经后端调用

## 二、插件结构

```
my-wasm-plugin/
├── manifest.json        # layers 需含 "l3"
└── plugin.wasm          # 核心 wasm 模块（编译产物）
```

manifest 示例：

```json
{
  "id": "dev.example.wasmplugin",
  "name": "WASM Plugin",
  "version": "0.1.0",
  "minLauncherVersion": "0.1.0",
  "layers": ["l3"],
  "permissions": ["wasm:execute"]
}
```

::: tip
网关加载的是固定文件名 `plugin.wasm`（位于 `plugins/{插件id}/plugin.wasm`），**无需**在 manifest 里声明路径。`entry.backend` 是保留字段（当前未使用），不要依赖。
:::

## 三、插件导出函数（WASM → 启动器）

| 导出 | 签名 | 说明 |
|------|------|------|
| `on_load` | `() -> ()` | 插件加载时调用 |
| `on_unload` | `() -> ()` | 插件卸载时调用 |
| `get_manifest` | `() -> i32` | 返回 manifest（预留） |
| 自定义导出 | `() -> ()` 或 `() -> i32` | 可通过 `callWasm(id, '导出名')` 调用 |

## 四、Host API（启动器 → WASM）

插件通过导入 `qomicex` 模块的函数访问启动器能力：

```rust
#[link(wasm_import_module = "qomicex")]
extern "C" {
    fn log(level: i32, msg_ptr: i32, msg_len: i32);                          // 输出日志
    fn http_fetch(url_ptr: i32, url_len: i32, method_ptr: i32, method_len: i32,
                  body_ptr: i32, body_len: i32, out_ptr: i32) -> i32;        // HTTP 请求（预留）
    fn instance_list(out_ptr: i32) -> i32;                                   // 实例列表（预留）
    fn db_set(key_ptr: i32, key_len: i32, val_ptr: i32, val_len: i32);       // 写键值
    fn db_get(key_ptr: i32, key_len: i32, out_ptr: i32, out_cap: i32) -> i32; // 读键值
    fn get_plugin_id(out_ptr: i32, out_cap: i32) -> i32;                     // 获取插件 id
}
```

::: warning
- 字符串通过 `(指针, 长度)` 传入，需要插件自行管理 wasm 线性内存
- `http_fetch` / `instance_list` 当前为预留（返回 -1），网络与实例访问请通过前端 `callBackend` / `proxyFetch` 实现
:::

## 五、编写最小 WASM 插件（Rust）

**Cargo.toml：**

```toml
[package]
name = "my-wasm-plugin"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[profile.release]
opt-level = "s"
```

**src/lib.rs：**

```rust
#[no_mangle]
pub extern "C" fn on_load() {
    unsafe {
        qomicex_log(0, b"plugin loaded\0".as_ptr() as i32, 14);
    }
}

#[no_mangle]
pub extern "C" fn on_unload() {
    unsafe {
        qomicex_log(0, b"plugin unloaded\0".as_ptr() as i32, 16);
    }
}

#[link(wasm_import_module = "qomicex")]
extern "C" {
    fn log(level: i32, msg_ptr: i32, msg_len: i32);
}
```

**编译：**

```bash
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
# 产物：target/wasm32-unknown-unknown/release/my_wasm_plugin.wasm
# 重命名为 plugin.wasm 放入插件包
```

## 六、从插件/前端调用

```js
// 前端页面 / 悬浮窗 / L2 脚本中
const res = await __PLUGIN_API__.callWasm('dev.example.wasmplugin', 'on_load')
// res = { ok: true, result: ... }

const ids = await __PLUGIN_API__.listWasmPlugins()
```

权限：`wasm:execute`

## 七、后端代理端点

后端将网关能力代理为以下 HTTP 端点（前端 API 已封装）：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/plugins/wasm` | 列出已加载 WASM 插件 |
| GET | `/api/plugins/wasm/{id}` | 插件信息（id/name/version/permissions） |
| POST | `/api/plugins/wasm/{id}/invoke` | body `{"export":"on_load"}` 调用导出 |

## 八、注意事项

- 插件包需包含 `plugin.wasm`，且 manifest `layers` 含 `l3`，才会被网关加载
- `plugin.wasm` 是**核心 wasm 模块**（core module），非 WASI/component 模块
- 数据目录与前端插件一致（`{数据目录}/plugins/{id}/`），由 `QOMICEX_HOME` 或系统数据目录决定
- 网关日志输出到启动器控制台（`[plugin]` / `[gateway]` 前缀）
- 当前 `db_set`/`db_get` 为网关进程内键值存储，重启清空；`http_fetch`/`instance_list` 预留
