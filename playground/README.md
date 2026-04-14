# xterm.js Demo Projects

本目录包含用于测试和演示 xterm.js 的多个项目。

## 项目结构

```
packages/
├── playground/      # React + Vite 演示项目
└── tauri-demo/     # Tauri 桌面应用 (用于 macOS WebView 测试)
```

## 运行项目

### Playground (React + Vite)

```bash
# 在根目录运行
pnpm dev:playground

# 或进入目录单独运行
cd packages/playground
pnpm dev
```

访问 http://localhost:5173

### Tauri Demo (macOS WebView 测试)

```bash
# 确保已安装 Rust 和 Tauri CLI
rustc --version
cargo --version
tauri --version

# 开发模式运行
pnpm dev:tauri

# 或只运行 Web 前端 (不需要 Rust)
pnpm dev:tauri-web
```

## Tauri Demo 功能

该应用专门用于测试 xterm.js 在 macOS WKWebView 中的兼容性：

1. **环境检测**：自动检测操作系统、屏幕分辨率、像素比等
2. **WebGL 支持检测**：检测 WebGL 是否正常工作
3. **终端诊断**：显示终端尺寸、渲染状态等信息
4. **常见问题提示**：展示 macOS WebView 中可能出现的问题

### 常用测试命令

在终端中输入：
- `info` - 显示终端信息
- `resize` - 重新调整终端大小
- `env` - 显示完整环境信息

### macOS WebView 常见问题

1. **JavaScript 被禁用**：确保 WebView 启用了 JavaScript
2. **字体显示异常**：检查 WebView 是否支持自定义字体
3. **输入延迟**：检查是否有安全策略限制
4. **渲染异常**：检查 GPU 加速设置

## 构建发布版本

```bash
# 构建 Tauri 应用
cd packages/tauri-demo
pnpm tauri build
```

构建完成后，应用位于 `src-tauri/target/release/` 目录。

## 依赖说明

- `playground` 使用 React 19 + Vite 8
- `tauri-demo` 使用原生 TypeScript + Vite 6
- 两个项目都依赖 `@xterm/xterm` 及其官方插件
