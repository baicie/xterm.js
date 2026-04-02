# xterm.js Agent MD

## 语言约定

- **回答语言**：始终使用中文回答用户的问题
- **代码注释**：代码注释使用中文解释
- **文档编写**：文档使用中文编写

---

## 项目概述

xterm.js 是一个前端组件，使应用程序能够在浏览器中提供功能完整的终端。它被 VS Code、Tabby、Hyper 等流行项目使用。

### 核心架构

项目分为三个主要目标：
- `src/browser/` - 带有 DOM 渲染的完整浏览器终端
- `src/headless/` - Node.js 的无头终端（无 DOM）
- `src/common/` - 共享核心逻辑（解析、缓冲区管理、终端状态）

### 关键类

- `Terminal` (browser/headless) - 公共 API 包装器
- `CoreTerminal` (common) - 核心终端逻辑和状态
- `CoreBrowserTerminal` (browser) - 浏览器特定的终端实现

---

## 开发工作流

### 构建系统

```bash
# Rolldown 完整构建
node bin/rolldown_build.mjs

# Rolldown 监视模式
node bin/rolldown_build.mjs --watch

# 启动 demo 服务器
npm run start
```

### 测试

#### 单元测试 (Mocha)

```bash
# 运行所有单元测试
npm run test-unit

# 按文件过滤测试
npm run test-unit -- **/fileName.ts

# 按 addon 运行单元测试
npm run test-unit -- addons/addon-image/out-esbuild/*.test.js

# 带覆盖率
npm run test-unit-coverage

# 仅显示慢测试
npm run test-unit-slow-tests
```

#### 集成测试 (Playwright)

```bash
# 所有集成测试（Chrome/Firefox/WebKit）
npm run test-integration

# 指定浏览器
npm run test-integration-chromium
npm run test-integration-firefox
npm run test-integration-webkit

# 按文件运行
npm run test-integration -- test/playwright/InputHandler.test.ts

# 按 addon 运行（注意：不要使用 grep 过滤）
npm run test-integration -- --suite=addon-search
npm run test-integration -- --suite=addon-webgl

# 调试模式（headed browser, 单 worker）
npm run test-integration-debug
```

#### 基准测试

```bash
# 完整基准测试套件
npm run benchmark

# 单个基准测试文件
npm run benchmark -- -s "out-test/benchmark/Event.benchmark.js"

# 对比基准测试
npm run benchmark-baseline  # 生成基准
npm run benchmark-eval      # 评估新代码
```

### Lint

```bash
# 检查所有文件
npm run lint

# 仅检查更改的文件
npm run lint-changes

# 自动修复
npm run lint-changes-fix
npm run lint-fix
```

---

## 代码组织

### Addon 开发模式

所有 addon 遵循此结构：

```typescript
export class MyAddon implements ITerminalAddon {
  activate(terminal: Terminal): void {
    // 通过 terminal.loadAddon() 加载时调用
    // 注册处理器，访问 terminal API
  }
  dispose(): void {
    // addon 销毁时清理资源
  }
}
```

**关键示例位置**：
- `addons/addon-fit/` - 终端大小调整
- `addons/addon-webgl/` - GPU 加速渲染
- `addons/addon-search/` - 文本搜索功能
- `addons/addon-image/` - 图片支持

### 目录结构

```
src/
├── browser/           # 浏览器终端实现
│   ├── CoreBrowserTerminal.ts    # 核心浏览器终端
│   ├── Terminal.test.ts          # 终端单元测试
│   ├── renderer/                 # 渲染器
│   ├── input/                    # 输入处理
│   └── services/                 # 服务层
├── common/           # 共享核心逻辑
│   ├── buffer/                   # 缓冲区管理
│   ├── input/                    # 输入处理
│   ├── parser/                   # 解析器（VT sequences）
│   └── services/                 # 服务层
└── headless/         # 无头终端

addons/
├── addon-attach/
├── addon-clipboard/
├── addon-fit/
├── addon-image/
├── addon-ligatures/
├── addon-progress/
├── addon-search/
├── addon-serialize/
├── addon-unicode-graphemes/
├── addon-unicode11/
├── addon-web-fonts/
├── addon-web-links/
└── addon-webgl/
```

---

## 项目约定

### API 设计

- 浏览器和无头终端共享相同的公共 API
- 实验性 API 需要 `allowProposedApi: true` 选项
- 构造函数选项（cols, rows）实例化后不能更改
- 公共 API 声明在 `typings/xterm.d.ts`

### 解析器集成

注册自定义转义序列处理器：

```typescript
terminal.parser.registerCsiHandler('m', params => {
  // 处理 SGR 序列
  return true; // 已处理
});
```

### 缓冲区访问

```typescript
const line = terminal.buffer.active.getLine(0);
const cell = line?.getCell(0);
```

---

## 关键实现细节

### 渲染器

- 使用 DOM 或 WebGL 渲染器
- DOM 渲染器位于 `browser/renderer/dom/`
- WebGL 渲染器位于 `addons/addon-webgl/`

### 缓冲区

- 缓冲区行是不可变的
- 修改需要创建新实例
- 支持 Unicode 11+ 字符宽度

### 鼠标事件

- 支持多种协议：X10, VT200,按钮事件,任何事件
- 将 Web 事件转换为终端协议

### 颜色和主题

- 支持调色板和真彩色模式
- 提供颜色对比度缓存

---

## 测试规范

### 单元测试

- 测试文件位于源文件旁边，使用 `.test.ts` 后缀
- 为 addon 编写测试时，创建真实的 xterm.js 实例而不是 mock
- 使用 `assert.ok` 而不是 `assert.notStrictEqual` 检查 undefined
- 测试应该是自解释的，避免不必要的注释

### 测试工具

使用 `TestUtils.ts` 辅助函数：
- `openTerminal(ctx, options)` - 测试设置
- `pollFor(page, fn, expectedValue)` - 异步断言
- `writeSync(page, data)` - 终端输入

---

## 常见任务

### 添加新的终端选项

1. 在 `typings/xterm.d.ts` 中添加接口定义
2. 在 `src/common/services/OptionsService.ts` 中添加处理逻辑
3. 添加相应的单元测试

### 添加新的解析器

1. 在 `src/common/parser/` 中创建解析器
2. 注册到 `InputHandler` 或相关服务
3. 添加测试覆盖

### 修改渲染器

1. DOM 渲染器：`browser/renderer/dom/`
2. WebGL 渲染器：`addons/addon-webgl/src/`
3. 运行 demo 测试更改

### 创建新 Addon

1. 在 `addons/` 下创建新目录
2. 实现 `ITerminalAddon` 接口
3. 在 `package.json` 的 workspaces 中注册
4. 添加单元测试和 README

---

## VS Code 配置

- 推荐安装 ESLint 扩展 (`dbaeumer.vscode-eslint`)
- 导入模块使用非相对路径
- 使用单引号

---

## Git Commit 规范

### 提交信息格式

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<类型>(<范围>): <描述>

[可选正文]

[可选脚注]
```

### 类型前缀

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(parser): 支持 Kitty 键盘协议` |
| `fix` | 错误修复 | `fix(buffer): 修复缓冲区换行边界问题` |
| `docs` | 文档更新 | `docs: 更新 API 文档` |
| `style` | 代码格式（不影响功能） | `style: 格式化 import 语句` |
| `refactor` | 重构（不修复 bug 或添加功能） | `refactor: 提取渲染服务` |
| `perf` | 性能优化 | `perf(webgl): 优化纹理上传` |
| `test` | 测试相关 | `test: 添加输入处理单元测试` |
| `chore` | 构建/工具变更 | `chore: 升级 rolldown 版本` |
| `revert` | 回滚提交 | `revert: 回滚 abc1234` |

### 范围（可选）

使用模块名作为范围：

- `browser` - 浏览器终端
- `headless` - 无头终端
- `common` - 公共逻辑
- `parser` - 转义序列解析器
- `buffer` - 缓冲区管理
- `renderer` - 渲染器
- `addon-*` - 具体插件

### 编写规范

1. **描述（必填）**
   - 使用现在时态：`add` 而不是 `added`
   - 首字母小写
   - 不使用句号结尾
   - 简洁明了，不超过 72 字符

2. **正文（可选）**
   - 解释 **为什么** 而非 **做了什么**
   - 每行不超过 72 字符
   - 使用 `-` 作为列表符号

3. **脚注（可选）**
   - 用于引用 GitHub Issue: `Closes #123`
   - 或破坏性变更: `BREAKING CHANGE: ...`

### 提交示例

```
feat(parser): 支持 DECSET 6 相对光标定位

解析器现在可以正确处理 DECSCUSR (相对光标移动) 序列，
允许终端应用程序使用相对移动而非绝对定位。

- 添加 REL_CURSOR_POSITION 常量
- 实现 InputHandler.relativeMove() 方法
- 添加单元测试覆盖

Closes #456
```

```
fix(buffer): 修复 alternate buffer 切换时标记丢失

切换缓冲区时未正确保存和恢复 Marker 对象，导致
终端程序（如 vim）的行标记失效。

Closes #789
```

---

## 许可证

贡献代码即表示同意：
- 代码按 MIT 许可证分发
- 确认代码是原创作品或具有适当许可证
