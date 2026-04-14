# Safari 多键同时按下只显示第一个字符问题

## 问题描述

在 Safari 浏览器中，当用户同时按下多个字符键（如 `c` + `d`）时，只有第一个字符被处理并显示，后续字符丢失。

## 问题根因

### 1. Safari 事件触发顺序与 Chrome/Firefox 不同

| 浏览器 | 事件触发顺序 |
|--------|-------------|
| Chrome/Firefox | `keydown` → `input` → `keyup` |
| Safari | `input` → `keydown` → `keyup` |

Safari **先触发 `input` 事件，后触发 `keydown` 事件**，这与主流浏览器相反。

### 2. `_inputEvent` 中的 `_keyDownSeen` 检查逻辑问题

原代码中的条件判断：
```typescript
if (ev.composed && this._keyDownSeen) {
  return false;  // 跳过处理
}
```

**问题场景**：
1. Safari 先触发 `input(c)`，此时 `_keyDownSeen = false`，处理 `c`
2. Safari 触发 `keydown(c)`，设置 `_keyDownSeen = true`
3. Safari 触发 `input(d)`，此时 `_keyDownSeen = true`，**被跳过！**

### 3. A-Z 大写字母 HACK 代码在 Safari 中不工作

原代码中有一段 HACK，用于在 `keypress` 事件中处理 A-Z 大写字母：
```typescript
if (!this._keyboardService.useKitty && !this._keyboardService.useWin32InputMode && ...) {
  if (event.key.charCodeAt(0) >= 65 && event.key.charCodeAt(0) <= 90) {
    return true;  // 跳过处理，期望在 keypress 中处理
  }
}
```

**问题**：Safari **不触发 `keypress` 事件**，导致字符永远不会到达 `triggerDataEvent`。

## 修复方案

### 修复 1: `_inputEvent` 中的 Safari 特殊处理

```typescript
protected _inputEvent(ev: InputEvent): boolean {
  if (ev.data && ev.inputType === 'insertText' && !this.optionsService.rawOptions.screenReaderMode) {
    // Safari fires input events BEFORE keydown events for character input
    // So for Safari, we should always process input events without checking _keyDownSeen
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      this._unprocessedDeadKey = false;
      this.coreService.triggerDataEvent(ev.data, true);
      return true;
    }

    // For non-composed text, we should always process it
    // For composed text, only process if keydown wasn't seen (to avoid double processing)
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

### 修复 2: `_keyDown` 中的 HACK 代码跳过 Safari

```typescript
// HACK: Process A-Z in the keypress event to fix an issue with macOS IMEs where lower case
// letters cannot be input while caps lock is on. Skip this hack when using kitty protocol
// or Win32 input mode as they need to send proper sequences for all key events.
// NOTE: Skip this HACK on Safari because Safari doesn't fire keypress events.
const isSafari = /^((?!chrome|android).)*safari/i.test(this.browser.userAgent);
if (!isSafari && !this._keyboardService.useKitty && !this._keyboardService.useWin32InputMode && ...) {
  // ...
}
```

### 修复 3: Safari `_keyDown` 返回 true 让 input 事件自然触发

```typescript
if (!this.optionsService.rawOptions.screenReaderMode && isSafari) {
  this._keyDownHandled = true;
  return true;  // 不阻止默认行为，让 input 事件自然触发
}
```

## 修复后的 Safari 事件处理流程

```
input (c) → _keyDownSeen=false → 处理 c ✓
keydown (c) → _keyDownSeen=true
input (d) → Safari mode → 处理 d ✓  (不再跳过)
keydown (d)
keyup (c)
keyup (d)
```

## 修改文件

- `src/browser/CoreBrowserTerminal.ts`

## 测试验证

1. 在 Safari 中打开终端页面
2. 同时按下多个字符键（如 `cd`、`asdf`）
3. 验证所有字符都被正确处理和显示

## 相关链接

- [MDN: KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent)
- [MDN: InputEvent](https://developer.mozilla.org/en-US/docs/Web/API/InputEvent)
- [xterm.js Issue #3679](https://github.com/xtermjs/xterm.js/issues/3679) - Emoji IME 相关
