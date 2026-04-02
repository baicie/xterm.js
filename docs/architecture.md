# xterm.js 架构与数据流文档

> 本文档详细描述 xterm.js 的系统架构、核心组件关系和数据流向。

---

## 1. 系统架构概览

xterm.js 采用**三层架构**设计，核心逻辑与平台特定实现分离：

```
┌─────────────────────────────────────────────────────────────┐
│                      公共 API 层 (Public API)               │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ Terminal (browser)│    │Terminal (headless)│              │
│  └────────┬────────┘    └────────┬────────┘                │
│           │                       │                         │
├───────────┼───────────────────────┼─────────────────────────┤
│           │    CoreBrowserTerminal │     CoreTerminal       │
│           │         ↓              │         ↓               │
│  ┌────────┴────────┐    ┌────────┴────────┐                │
│  │   浏览器服务层    │    │    核心服务层    │                │
│  │ (Browser Services)│    │(Core Services) │                │
│  └────────┬────────┘    └────────┬────────┘                │
│           │                       │                         │
├───────────┼───────────────────────┼─────────────────────────┤
│           │                       │                         │
│  ┌────────┴────────┐    ┌────────┴────────┐                │
│  │    渲染层         │    │    核心逻辑层     │                │
│  │  (Renderer)       │    │  (Core Logic)    │                │
│  └───────────────────┘    └───────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 核心组件关系图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CoreTerminal (核心)                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                          服务层                                │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │  │
│  │  │BufferService │ │OptionsService│ │    CoreService       │ │  │
│  │  │  - cols/rows │ │  - options   │ │  - reset, bell...   │ │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘ │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │  │
│  │  │CharsetService│ │UnicodeService│ │  MouseStateService  │ │  │
│  │  │  - charsets  │ │  - version   │ │   - mouse state     │ │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                         缓冲区层                               │  │
│  │  ┌─────────────────┐         ┌─────────────────┐             │  │
│  │  │    BufferSet    │ ←────→  │     Buffer      │             │  │
│  │  │ (alt + primary) │         │ (lines + mark) │             │  │
│  │  └─────────────────┘         └────────┬────────┘             │  │
│  │                                       ↓                        │  │
│  │                              ┌─────────────────┐                │  │
│  │                              │   BufferLine[] │                │  │
│  │                              │  ┌───────────┐  │                │  │
│  │                              │  │ CellData  │  │ ← 单字符单元  │  │
│  │                              │  └───────────┘  │                │  │
│  │                              └─────────────────┘                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                         解析层                               │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │  │
│  │  │EscapeSequence│ │  OscParser   │ │     DcsParser        │ │  │
│  │  │   Parser     │ │  (OSC 命令)  │ │   (DCS 命令)         │ │  │
│  │  └──────┬───────┘ └──────────────┘ └──────────────────────┘ │  │
│  │         ↓                                                        │  │
│  │  ┌──────────────┐                                               │  │
│  │  │ InputHandler │ ← 【核心命令处理器】                           │  │
│  │  │ (3000+ 行)   │ ← 处理所有终端序列                             │  │
│  │  └──────────────┘                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓ 渲染
┌─────────────────────────────────────────────────────────────────────┐
│                    CoreBrowserTerminal (浏览器)                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                       浏览器服务层                             │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │  │
│  │  │RenderService │ │SelectionSvc   │ │  KeyboardService    │ │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘ │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │  │
│  │  │ ThemeService │ │ MouseService │ │   CharSizeService    │ │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                       渲染层                                 │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │                     DomRenderer                         │ │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │ │  │
│  │  │  │RowFactory   │  │WidthCache   │  │SelectionModel  │  │ │  │
│  │  │  │(生成行 DOM) │  │(宽度缓存)   │  │(选择渲染)      │  │ │  │
│  │  │  └─────────────┘  └─────────────┘  └────────────────┘  │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 数据流详解

### 3.1 数据写入流程 (Write Data Flow)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         数据写入流程                                 │
└─────────────────────────────────────────────────────────────────────┘

外部输入 (WebSocket/stdin/API)
         ↓
    ┌────┴────┐
    ↓         ↓
┌────────┐ ┌─────────────────────────────┐
│write() │ │ onData / writeSync         │
│  API   │ │ 事件触发                    │
└────┬───┘ └─────────────┬───────────────┘
     │                   ↓
     │         ┌─────────────────┐
     │         │   WriteBuffer   │ ← 缓冲写入请求
     │         │ (common/input/) │
     │         └────────┬────────┘
     │                  ↓
     │         ┌─────────────────┐
     │         │EscapeSequenceParser│
     │         │ (common/parser/) │
     │         └────────┬────────┘
     │                  ↓
     │         ┌─────────────────┐
     │         │  InputHandler   │ ← 【核心处理器】
     │         │ (3000+ 行代码)  │
     │         │ 处理所有终端命令 │
     │         └────────┬────────┘
     │                  ↓
     │    ┌─────────────┼─────────────┐
     │    ↓             ↓             ↓
     │ ┌──────┐  ┌──────────┐  ┌──────────┐
     │ │缓冲区│  │  光标    │  │   属性   │
     │ │更新  │  │  移动    │  │   更新   │
     │ └──┬───┘  └──────────┘  └──────────┘
     │    ↓
     │ ┌──────────────────┐
     │ │ BufferLine.ts    │ ← 存储字符到缓冲区行
     │ │ CellData.ts      │ ← 存储单个字符属性
     │ └──────────────────┘
     │
     └───────→ 触发 onWriteParsed 事件
                     ↓
              ┌─────────────┐
              │RenderService│
              │  (防抖)     │
              └─────────────┘
                     ↓
              ┌─────────────┐
              │  DomRenderer│
              └─────────────┘
```

**代码路径示例**：

```typescript
// 1. 调用 write() API
terminal.write('Hello World\r\n')

// 2. WriteBuffer 缓冲
// src/common/input/WriteBuffer.ts

// 3. 解析转义序列
// src/common/parser/EscapeSequenceParser.ts

// 4. 处理命令
// src/common/InputHandler.ts
// 例如: print() 处理普通字符, lineFeed() 处理换行

// 5. 更新缓冲区
// src/common/buffer/BufferLine.ts
bufferLine.setCell(col, cellData);

// 6. 触发渲染
// src/browser/services/RenderService.ts
this._renderLayers.refreshRows(start, end);
```

---

### 3.2 用户输入流程 (User Input Flow)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         用户输入流程                                 │
└─────────────────────────────────────────────────────────────────────┘

用户按键 / 鼠标事件
         ↓
    ┌────┴────────────────────────────┐
    ↓         ↓                ↓
┌────────┐ ┌──────────────┐ ┌──────────┐
│键盘事件│ │  鼠标点击   │ │  滚轮    │
│keydown │ │   click     │ │  wheel   │
└───┬────┘ └──────┬───────┘ └────┬─────┘
    ↓              ↓              ↓
┌─────────────────────────────┐
│    KeyboardService          │
│ (browser/services/)         │
│ - 解析修饰键                 │
│ - 转换为终端协议             │
└────────────┬────────────────┘
             ↓
      ┌──────────────┐
      │  terminal    │
      │  .write()    │ ← 输出到 PTY/Shell
      │  .onData     │   或输出到 AttachAddon
      └──────────────┘
             ↓
      ┌──────────────┐
      │   外部处理    │
      │ (WebSocket/  │
      │  AttachAddon) │
      └──────────────┘
```

---

### 3.3 渲染流程 (Render Flow)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         渲染流程                                     │
└─────────────────────────────────────────────────────────────────────┘

触发条件:
- 数据写入完成 (onWriteParsed)
- 窗口尺寸改变
- 选择区域改变
- 光标位置改变
- 选项改变 (theme, cursorBlink 等)
         ↓
┌─────────────────────┐
│    RenderService    │ ← 协调渲染，合并请求
│ (browser/services/) │   防止过度渲染
└──────────┬──────────┘
           ↓ (防抖后)
┌─────────────────────┐
│     DomRenderer     │
│ (browser/renderer/) │
└──────────┬──────────┘
           ↓
    ┌──────┴──────┐
    ↓             ↓
┌─────────┐ ┌────────────────┐
│ 行渲染  │ │   光标渲染     │
│         │ │ (cursor style) │
└────┬────┘ └───────┬────────┘
     ↓               ↓
┌─────────────────────────────┐
│    DomRendererRowFactory    │
│  - 遍历 BufferLine          │
│  - 生成字符 DOM              │
│  - 应用 CSS 类               │
│  - 处理链接高亮              │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│       HTML Elements         │
│  <div class="xterm-rows">   │
│    <span>Hello World</span> │
│  </div>                      │
└─────────────────────────────┘
```

---

### 3.4 鼠标事件处理流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                       鼠标事件处理流程                               │
└─────────────────────────────────────────────────────────────────────┘

鼠标事件 (move/click/wheel)
         ↓
┌─────────────────────┐
│    MouseService     │
│ (browser/services/) │
│ - 获取坐标           │
│ - 检测事件类型       │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  MouseCoordsService │
│ - 屏幕坐标 → 单元格  │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  InputHandler       │
│ - 鼠标协议处理       │
│ (X10/VT200/UTF8/...)│
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  onData 事件        │ ← 输出到 PTY
│  " \x1b[M..."      │
└─────────────────────┘
```

---

## 4. 服务层详解

### 4.1 服务依赖关系

```
┌─────────────────────────────────────────────────────────────────────┐
│                        服务依赖关系图                                │
└─────────────────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │OptionsService│ ← 全局选项 (ITerminalOptions)
                    └──────────────┘
                           ↑
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
┌───┴───┐            ┌────┴────┐            ┌────┴────┐
│ Buff- │            │  Core- │            │ Unicode │
│Service│            │ Service │            │ Service │
└───┬───┘            └────┬────┘            └─────────┘
    │                      │
    │         ┌───────────┼───────────┐
    │         ↓           ↓           ↓
    │    ┌────────┐ ┌──────────┐ ┌──────────┐
    │    │Charset │ │MouseState│ │OscLink   │
    │    │Service │ │ Service  │ │ Service  │
    │    └────────┘ └──────────┘ └──────────┘
    │
    │         ┌───────────────────┐
    └────────→│   InputHandler   │ ← 依赖所有服务
              └─────────┬─────────┘
                        ↓
              ┌─────────────────┐
              │    Buffer       │ ← 实际数据存储
              │   (BufferLine)  │
              └─────────────────┘
```

### 4.2 核心服务职责

| 服务 | 职责 | 关键文件 |
|------|------|----------|
| **BufferService** | 管理终端尺寸 (cols/rows)、缓冲区引用 | `src/common/services/BufferService.ts` |
| **OptionsService** | 管理终端选项 (theme, cursorStyle 等) | `src/common/services/OptionsService.ts` |
| **CoreService** | 核心功能：reset、title、bell、mark | `src/common/services/CoreService.ts` |
| **CharsetService** | 字符集切换 (G0-G3) | `src/common/services/CharsetService.ts` |
| **UnicodeService** | Unicode 版本管理 | `src/common/services/UnicodeService.ts` |
| **MouseStateService** | 鼠标状态跟踪 | `src/common/services/MouseStateService.ts` |

---

## 5. 缓冲区系统

### 5.1 缓冲区结构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         缓冲区结构                                  │
└─────────────────────────────────────────────────────────────────────┘

BufferSet
├── alt (alternative) ← alternate screen buffer (如 vim)
│   └── Buffer
│       ├── isAlt: true
│       ├── lines: BufferLine[] ← 循环数组
│       └── markers: Marker[]
│
└── active (primary) ← 默认缓冲区
    └── Buffer
        ├── isAlt: false
        ├── lines: BufferLine[] ← 循环数组
        │   ├── 0: BufferLine[cols] ← 第一行
        │   ├── 1: BufferLine[cols] ← 第二行
        │   └── rows-1: BufferLine[cols] ← 最后一行
        └── markers: Marker[] ← 用于跟踪位置

BufferLine (每行)
├── length: cols
├── isWrapped: boolean ← 与下一行连接
├──[i]: CellData ← 每一列的字符数据
│   ├── char: string ← 字符内容 (UTF-32)
    ├── width: number ← 字符宽度 (1 或 2)
    └── attributes: { fg, bg, bold, italic, ... }

CellData (每个单元格)
├── content: number ← 字符编码
├── fg: number ← 前景色
├── bg: number ← 背景色
├── bold: boolean ← 粗体标志
├── italic: boolean ← 斜体标志
├── underline: boolean ← 下划线标志
└── ... ← 其他属性
```

### 5.2 缓冲区切换

```
终端程序请求 alternate buffer (CSI ? 1049 h)
         ↓
CoreService.toggleAltBuffer()
         ↓
BufferService.activateAltBuffer()
         ↓
切换活动缓冲区引用
         ↓
触发 onResize 事件 → 渲染器更新
```

---

## 6. 转义序列解析流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                       转义序列解析流程                               │
└─────────────────────────────────────────────────────────────────────┘

输入数据流: "Hello \x1b[31mRed\x1b[0m"
         ↓
┌─────────────────────────────────────────┐
│       EscapeSequenceParser              │
│  ┌───────────────────────────────────┐  │
│  │ 状态机解析                         │  │
│  │ - GROUND (正常)                   │  │
│  │ - ESCAPE (收到 ESC)               │  │
│  │ - CSI_ENTRY (收到 [)              │  │
│  │ - OSC_STRING (收到 ])             │  │
│  │ - DCS_ENTRY (收到 P)               │  │
│  │ - ...                             │  │
│  └───────────────────────────────────┘  │
└────────────────┬────────────────────────┘
                 ↓
         ┌────────┴────────┐
         ↓                 ↓
┌────────────────┐ ┌────────────────┐
│  控制字符      │ │  转义序列      │
│ (C0: \x00-\x1F)│ │ (CSI/OSC/DCS) │
│  直接处理      │ │  传递给对应    │
│  - \n: 换行   │ │  Parser       │
│  - \r: 回车   │ └───────┬────────┘
│  - \b: 退格   │         ↓
│  - ...       │ ┌────────────────┐
└──────────────┘ │   InputHandler │
                  │   (命令执行)   │
                  └───────┬────────┘
                          ↓
        ┌─────────────────┼─────────────────┐
        ↓                 ↓                 ↓
   ┌─────────┐     ┌─────────────┐     ┌──────────┐
   │缓冲区   │     │ 光标移动    │     │ 属性设置  │
   │写入     │     │ (CUx/CHT等) │     │ (SGR)    │
   └─────────┘     └─────────────┘     └──────────┘
```

### 6.1 CSI 序列解析示例

```
ESC[31;1;4m
    │ │ │ │
    │ │ │ └─── 4: 下划线
    │ │ └───── 1: 粗体
    │ └─────── 31: 前景色红色
    └───────── CSI 引入符

处理流程:
1. ESC[ → 进入 CSI_ENTRY 状态
2. 收集参数 "31;1;4" → Params 对象
3. m → 调用 SGR (Select Graphic Rendition)
4. InputHandler.SGR() → 更新当前属性
```

---

## 7. 渲染架构

### 7.1 渲染器对比

| 渲染器 | 实现 | 特点 |
|--------|------|------|
| **DomRenderer** | DOM 元素 | 兼容性最好，功能完整 |
| **WebglRenderer** | WebGL | GPU 加速，高性能 |

### 7.2 DOM 渲染器架构

```
DomRenderer
├── rowContainer (div.xterm-rows) ← 行容器
├── selectionContainer ← 选择区域覆盖层
├── cursorElement ← 光标元素
├── _rowElements: HTMLElement[] ← 实际 DOM 元素
│
├── _rowFactory: DomRendererRowFactory ← 行生成工厂
│   ├── 创建单元格 DOM
│   ├── 应用 CSS 类
│   ├── 处理链接
│   └── 处理选择高亮
│
├── _selectionRenderModel ← 选择渲染模型
│
├── _widthCache ← 字符宽度缓存 (避免重复计算)
│
└── 渲染流程:
    1. refreshRows(start, end)
    2. 遍历 dirty 行
    3. 调用 rowFactory.createRow(line, startCol, endCol)
    4. 更新 DOM 元素内容
    5. 触发屏幕重绘
```

---

## 8. 事件系统

### 8.1 核心事件流

```
┌─────────────────────────────────────────────────────────────────────┐
│                         事件系统                                    │
└─────────────────────────────────────────────────────────────────────┘

Emitter (发布者)                    Event (订阅者)
      │                                  │
      │  fire(data)                      │
      │────────→ 订阅者回调 ◄─────────────│
      │                                  │
      │                                  │

主要事件:
┌──────────────────────┬──────────────────────────────────────────┐
│ 事件                  │ 触发时机                                    │
├──────────────────────┼──────────────────────────────────────────┤
│ onData               │ 终端需要发送数据到 PTY                      │
│ onBell               │ 收到 BEL 字符 (\a)                         │
│ onCursorMove         │ 光标位置改变                               │
│ onScroll             │ 滚动发生 (position 参数)                   │
│ onRender             │ 需要重绘 (start, end 参数)                 │
│ onResize             │ 终端尺寸改变                               │
│ onTitleChange        │ 标题改变 (OSC 0/1/2)                       │
│ onSelectionChange    │ 选择区域改变                               │
│ onWriteParsed        │ 写入数据解析完成                           │
└──────────────────────┴──────────────────────────────────────────┘
```

---

## 9. 插件系统

### 9.1 插件架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         插件系统                                    │
└─────────────────────────────────────────────────────────────────────┘

Terminal
    │
    ├── AddonManager
    │   └── addons: Map<string, ITerminalAddon>
    │       │
    │       ├── activate(addon)
    │       │   └── addon.activate(terminal)
    │       │
    │       └── dispose()
    │           └── addon.dispose()
    │
    └── loadAddon(name, instance)
        ├── 加载插件代码
        ├── 创建实例
        ├── 调用 activate()
        └── 注册到 manager
```

### 9.2 常用插件

| 插件 | 功能 | 关键文件 |
|------|------|----------|
| addon-fit | 自适应容器大小 | `FitAddon.ts` |
| addon-search | 文本搜索 | `SearchAddon.ts` |
| addon-webgl | GPU 加速 | `WebglRenderer.ts` |
| addon-image | 图片显示 | `ImageAddon.ts` |
| addon-attach | WebSocket 连接 | `AttachAddon.ts` |

---

## 10. 关键代码路径速查

### 终端初始化
```
new Terminal()
  → CoreBrowserTerminal()
    → 实例化所有服务
    → 创建缓冲区
    → 注册事件监听
```

### 写入数据
```
terminal.write(data)
  → WriteBuffer
    → EscapeSequenceParser
      → InputHandler
        → Buffer.updateRow()
```

### 渲染
```
onWriteParsed 事件
  → RenderService.refreshRows()
    → DomRenderer.refreshRows()
      → DomRendererRowFactory.createRow()
        → DOM 更新
```

### 用户输入
```
keydown/keypress
  → KeyboardService.parseKey()
    → terminal.onData.fire(data)
      → 外部处理 (AttachAddon)
```

### 鼠标事件
```
mousedown/mousemove/mouseup
  → MouseService.getCoords()
    → MouseCoordsService
      → InputHandler.handleMouse()
        → onData.fire(mouseProtocol)
```

---

## 11. 扩展阅读

### 11.1 相关标准文档

- [VT100/VT220 终端规范](http://vt100.net/)
- [xterm 控制序列](http://invisible-island.net/xterm/ctlseqs/ctlseqs.html)
- [ECMA-48 控制功能](https://www.ecma-international.org/publications/standards/Ecma-048.htm)

### 11.2 关键文件索引

| 功能 | 主文件 | 相关文件 |
|------|--------|----------|
| 终端入口 | `browser/public/Terminal.ts` | `headless/public/Terminal.ts` |
| 核心终端 | `common/CoreTerminal.ts` | `browser/CoreBrowserTerminal.ts` |
| 转义解析 | `common/parser/EscapeSequenceParser.ts` | `InputHandler.ts` |
| 缓冲区 | `common/buffer/Buffer.ts` | `BufferLine.ts`, `CellData.ts` |
| 渲染 | `browser/renderer/dom/DomRenderer.ts` | `DomRendererRowFactory.ts` |
| 输入处理 | `browser/services/KeyboardService.ts` | `common/input/Keyboard.ts` |
| 选择 | `browser/services/SelectionService.ts` | `selection/SelectionModel.ts` |
