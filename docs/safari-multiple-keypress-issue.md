# Issue #26: Safari 同时按键丢失字符 — 排查指南

> **问题描述**：在 Apple WebKit (Safari) 浏览器中，当用户同时按下多个键时，只有第一个字符被处理，其余字符丢失。
>
> **当前状态**：之前尝试在 `_keyDown` 开始时重置 `_keyPressHandled` 标志的修复已删除，但问题仍未解决。

---

## 1. 当前代码分析

### 1.1 Safari 键盘事件流程

```
用户同时按下 A + S 键
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  keydown(A)                                                         │
│    → _keyDownSeen = true                                            │
│    → _keyDownHandled = false                                        │
│    → 评估键值，触发数据事件                                          │
│    → Safari: return true (不 preventDefault) ← 关键                 │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  keydown(S)                                                         │
│    → _keyDownSeen = true  (已为 true)                               │
│    → _keyDownHandled = false                                        │
│    → 评估键值，触发数据事件                                          │
│    → Safari: return true (不 preventDefault) ← 关键                 │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  input 事件 (Safari 可能只触发一次，或触发多次)                      │
│    → _inputEvent(ev)                                                │
│    → 检查 ev.data, ev.inputType === 'insertText'                   │
│    → 检查 ev.composed && _keyDownSeen → 可能返回 false             │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心问题代码

#### `_keyDown` 中 Safari 特殊处理 (第 921-932 行)

```typescript:921:932:src/browser/CoreBrowserTerminal.ts
    // On Safari (Apple WebKit), we should NOT call preventDefault() for regular character keys
    // because Safari doesn't fire keypress events. Without preventDefault(), the character will
    // be inserted into the textarea and trigger an input event, which will send the data.
    // For other browsers, we cancel the event to prevent double processing.
    // Special keys (ctrl, alt) always prevent default.
    const isSafari = /^((?!chrome|android).)*safari/i.test(this.browser.userAgent);
    if (!this.optionsService.rawOptions.screenReaderMode && isSafari) {
      // Safari: allow the event to propagate so input event fires
      // Still update _keyDownHandled for consistency
      this._keyDownHandled = true;
      return true;
    }
```

**问题分析**：
- Safari 中不调用 `preventDefault()`，依赖 textarea 的默认行为插入字符
- 这意味着 Safari 中 `triggerDataEvent` 可能在 `_keyDown` 中直接调用，也可能在 `_inputEvent` 中调用
- **关键问题**：Safari 可能在同一个 event loop 中处理多个 keydown 事件，但只触发一次 input 事件

#### `_inputEvent` 中的可疑逻辑 (第 1039-1060 行)

```typescript:1039:1060:src/browser/CoreBrowserTerminal.ts
  protected _inputEvent(ev: InputEvent): boolean {
    // Only support emoji IMEs when screen reader mode is disabled
    if (ev.data && ev.inputType === 'insertText' && !this.optionsService.rawOptions.screenReaderMode) {
      // For non-composed text, we should always process it
      // For composed text, only process if keydown wasn't seen (to avoid double processing)
      if (ev.composed && this._keyDownSeen) {
        return false;  // ← 可能的问题点
      }

      this._unprocessedDeadKey = false;
      const text = ev.data;
      this.coreService.triggerDataEvent(text, true);
      return true;
    }
    return false;
  }
```

**可疑点**：
- `ev.composed && _keyDownSeen` 检查：对于组合文本且 keydown 已处理时跳过
- **但问题可能是**：`_keyDownSeen` 在 `_keyUp` 中才重置为 `false`（第 962 行）
- 如果用户快速连续输入，`_keyDownSeen` 可能一直为 `true`

---

## 2. Safari 多键问题的可能原因

### 原因 1：Safari textarea 默认行为被 textarea 值覆盖

**假说**：当多个 keydown 事件快速触发时，Safari 的 textarea 默认行为可能被后续的 keydown 处理覆盖。

```typescript
// 关键：Safari 中 keydown 不 preventDefault()
// textarea.value 应该通过默认行为累积字符
textarea.value = "a"  // 第一个 keydown
textarea.value = "s"  // 第二个 keydown → 覆盖而非追加！
```

**验证方法**：在 Safari DevTools 中检查 `textarea.value` 在多键输入时的实际值。

### 原因 2：Safari 只触发一次 input 事件

**假说**：Safari 在处理多个同时按下的键时，只触发一次 `input` 事件，且 `ev.data` 只包含第一个字符。

**Safari 行为**：
```
用户按 A + S：
  keydown(A) → keydown(S) → [可能没有 input 或只有一次 input(data="A")]
```

**正常浏览器行为**：
```
用户按 A + S：
  keydown(A) → input(A) → keydown(S) → input(S)
```

### 原因 3：`_keyDownSeen` 状态管理问题

```typescript
// 在 _keyDown 中
this._keyDownSeen = true;  // 设置

// 在 _keyUp 中
this._keyDownSeen = false;  // 重置
```

**问题**：如果用户快速连续输入，`_keyUp` 可能还没执行，`_keyDownSeen` 一直为 `true`。

---

## 3. 排查步骤

### 步骤 1：添加详细的调试日志

在 `CoreBrowserTerminal.ts` 中添加调试代码：

```typescript
// 在 _keyDown 方法开始处添加
private _debugSafariKeyIssue = true;

protected _keyDown(event: KeyboardEvent): boolean | undefined {
  if (this._debugSafariKeyIssue) {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    console.log(`[_keyDown] key=${event.key}, isSafari=${isSafari}, _keyDownSeen=${this._keyDownSeen}`);
  }

  this._keyDownHandled = false;
  this._keyDownSeen = true;
  // ... 原有代码
}
```

```typescript
// 在 _inputEvent 方法中添加
protected _inputEvent(ev: InputEvent): boolean {
  if (this._debugSafariKeyIssue) {
    console.log(`[_inputEvent] data=${ev.data}, inputType=${ev.inputType}, composed=${ev.composed}`);
  }
  // ... 原有代码
}
```

```typescript
// 在 _keyUp 方法中添加
protected _keyUp(ev: KeyboardEvent): void {
  if (this._debugSafariKeyIssue) {
    console.log(`[_keyUp] key=${ev.key}`);
  }
  // ... 原有代码
}
```

### 步骤 2：检查 textarea 的实际行为

创建一个测试页面验证 Safari 行为：

```html
<!DOCTYPE html>
<html>
<head>
  <title>Safari Key Test</title>
</head>
<body>
  <textarea id="test"></textarea>
  <div id="log"></div>
  <script>
    const textarea = document.getElementById('test');
    const log = document.getElementById('log');

    textarea.addEventListener('keydown', (e) => {
      log.innerHTML += `<div>keydown: ${e.key}</div>`;
    });

    textarea.addEventListener('input', (e) => {
      log.innerHTML += `<div>input: data="${e.data}", value="${textarea.value}"</div>`;
    });

    textarea.addEventListener('keyup', (e) => {
      log.innerHTML += `<div>keyup: ${e.key}</div>`;
    });
  </script>
</body>
</html>
```

**预期观察**：
- 正常浏览器：每个键触发 keydown → input → keyup
- Safari 多键问题：可能只有第一个键触发完整事件链

### 步骤 3：检查 `preventDefault` 的影响

```typescript
// 临时修改，强制 preventDefault 看看效果
const isSafari = /^((?!chrome|android).)*safari/i.test(this.browser.userAgent);
if (isSafari) {
  event.preventDefault();  // 强制阻止
  // 手动触发数据事件
  const result = this._keyboardService.evaluateKeyDown(event);
  if (result.key) {
    this.coreService.triggerDataEvent(result.key, true);
  }
  return false;
}
```

---

## 4. 可能的修复方案

### 方案 A：使用事件队列

```typescript
// 在类中添加队列
private _pendingKeyEvents: KeyboardEvent[] = [];
private _isProcessingKeyQueue = false;

protected _keyDown(event: KeyboardEvent): boolean | undefined {
  // ... 原有处理 ...

  const isSafari = /^((?!chrome|android).)*safari/i.test(this.browser.userAgent);
  if (isSafari) {
    // 将事件加入队列，而不是立即处理
    this._pendingKeyEvents.push(event);
    this._processKeyQueue();
    return false;  // 阻止默认行为
  }

  // ... 原有代码 ...
}

private _processKeyQueue(): void {
  if (this._isProcessingKeyQueue || this._pendingKeyEvents.length === 0) {
    return;
  }

  this._isProcessingKeyQueue = true;

  while (this._pendingKeyEvents.length > 0) {
    const event = this._pendingKeyEvents.shift()!;
    const result = this._keyboardService.evaluateKeyDown(event);
    if (result.key) {
      this.coreService.triggerDataEvent(result.key, true);
    }
  }

  this._isProcessingKeyQueue = false;
}
```

### 方案 B：改进 `_inputEvent` 处理

```typescript
protected _inputEvent(ev: InputEvent): boolean {
  const isSafari = /^((?!chrome|android).)*safari/i.test(this.browser.userAgent);

  if (ev.data && ev.inputType === 'insertText' && !this.optionsService.rawOptions.screenReaderMode) {
    // Safari: 直接处理 input 事件中的数据
    if (isSafari) {
      this.coreService.triggerDataEvent(ev.data, true);
      return true;
    }

    // 其他浏览器：避免重复处理
    if (ev.composed && this._keyDownSeen) {
      return false;
    }

    this._unprocessedDeadKey = false;
    this.coreService.triggerDataEvent(ev.data, true);
    return true;
  }

  return false;
}
```

### 方案 C：监听多个 input 事件

Safari 可能在多键输入时触发一个包含所有字符的 input 事件：

```typescript
protected _inputEvent(ev: InputEvent): boolean {
  if (ev.data && ev.inputType === 'insertText' && !this.optionsService.rawOptions.screenReaderMode) {
    // 将每个字符作为独立事件发送
    const chars = ev.data.split('');
    for (const char of chars) {
      this.coreService.triggerDataEvent(char, true);
    }
    return true;
  }
  return false;
}
```

### 方案 D：结合 keydown 和 input 事件

```typescript
// 跟踪已处理的键
private _processedKeys = new Set<number>();

protected _keyDown(event: KeyboardEvent): boolean | undefined {
  // 使用 event.keyCode 作为唯一标识
  const keyId = event.keyCode + (event.location << 16);

  // 如果这个键已经处理过，跳过
  if (this._processedKeys.has(keyId)) {
    return true;
  }

  this._processedKeys.add(keyId);

  const isSafari = /^((?!chrome|android).)*safari/i.test(this.browser.userAgent);
  if (!isSafari) {
    // Chrome/Firefox: 在 keydown 中处理
    const result = this._keyboardService.evaluateKeyDown(event);
    if (result.key) {
      this.coreService.triggerDataEvent(result.key, true);
    }
    event.preventDefault();
    return false;
  }

  // Safari: 依赖 input 事件
  return true;
}

protected _inputEvent(ev: InputEvent): boolean {
  if (ev.data && ev.inputType === 'insertText' && !this.optionsService.rawOptions.screenReaderMode) {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      // 清除已处理键的跟踪，允许 input 事件中的数据被处理
      this._processedKeys.clear();
      this.coreService.triggerDataEvent(ev.data, true);
      return true;
    }
  }
  return false;
}

protected _keyUp(ev: KeyboardEvent): void {
  const keyId = ev.keyCode + (ev.location << 16);
  this._processedKeys.delete(keyId);
  // ... 原有代码 ...
}
```

---

## 5. 调试检查清单

```
Safari 多键输入调试：

[ ] 1. 在 Safari 中打开 DevTools Console
[ ] 2. 按下 A + S 同时按下
[ ] 3. 检查 Console 输出：
    - 有几个 keydown 事件？
    - 有几个 input 事件？
    - 每个 input 事件的 ev.data 是什么？
[ ] 4. 检查终端是否只显示第一个字符

[ ] 检查 textarea.value 在 input 事件后的值
[ ] 检查是否每次 keydown 都触发了 coreService.triggerDataEvent
[ ] 检查 _keyDownSeen 在多键输入时的值
[ ] 检查 _keyDownHandled 在多键输入时的值
```

---

## 6. 关键代码位置总结

| 位置 | 行号 | 说明 |
|------|------|------|
| `_keyDown` 开始 | 843-845 | `_keyDownSeen` 设置 |
| Safari 检测 | 926 | Safari 判断逻辑 |
| Safari 返回 | 927-932 | Safari 特殊处理 |
| `_keyUp` | 961-981 | `_keyDownSeen` 重置 |
| `_inputEvent` | 1039-1060 | Input 事件处理 |
| 事件绑定 | 414-429 | keydown/keyup/input 监听 |

---

## 7. 测试用例建议

### Playwright 测试

```javascript
test('Safari simultaneous key presses', async ({ browser }) => {
  // 使用 Safari
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
  });

  const page = await context.newPage();
  await page.goto('http://localhost:3000');

  // 聚焦终端
  await page.click('.xterm-helper-textarea');

  // 使用 keyboard.down 模拟同时按键
  // 注意：Playwright 的 keyDown 不会真正模拟同时按键
  // 需要使用 page.evaluate 直接触发事件

  await page.evaluate(() => {
    const textarea = document.querySelector('.xterm-helper-textarea');
    const keyEvent = new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true });
    textarea.dispatchEvent(keyEvent);
  });

  // 验证
});
```

---

## 8. 相关文件和资源

- [MDN: KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent)
- [MDN: InputEvent](https://developer.mozilla.org/en-US/docs/Web/API/InputEvent)
- [WebKit Bug: Simultaneous key events](https://bugs.webkit.org/show_bug.cgi?id=16743)
- [xterm.js Issue #3679](https://github.com/xtermjs/xterm.js/issues/3679) - Emoji IME 相关
