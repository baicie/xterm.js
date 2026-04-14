import "@baicie/xterm/css/xterm.css";
import { Terminal as TerminalComponent } from "@baicie/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";

// 预设主题配置
const themes = {
  dark: {
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    cursor: "#ffffff",
    cursorAccent: "#1e1e1e",
    selectionBackground: "#264f78",
    black: "#000000",
    red: "#cd3131",
    green: "#0dbc79",
    yellow: "#e5e510",
    blue: "#2472c8",
    magenta: "#bc3fbc",
    cyan: "#11a8cd",
    white: "#e5e5e5",
    brightBlack: "#666666",
    brightRed: "#f14c4c",
    brightGreen: "#23d18b",
    brightYellow: "#f5f543",
    brightBlue: "#3b8eea",
    brightMagenta: "#d670d6",
    brightCyan: "#29b8db",
    brightWhite: "#ffffff",
  },
  light: {
    background: "#fdf6e3",
    foreground: "#657b83",
    cursor: "#657b83",
    cursorAccent: "#fdf6e3",
    selectionBackground: "#eee8d5",
    black: "#073763",
    red: "#dc322f",
    green: "#859900",
    yellow: "#b58900",
    blue: "#268bd2",
    magenta: "#d33682",
    cyan: "#2aa198",
    white: "#eee8d5",
    brightBlack: "#586e75",
    brightRed: "#cb4b16",
    brightGreen: "#586e75",
    brightYellow: "#657b83",
    brightBlue: "#839496",
    brightMagenta: "#6c71c4",
    brightCyan: "#93a1a1",
    brightWhite: "#fdf6e3",
  },
  monokai: {
    background: "#272822",
    foreground: "#f8f8f2",
    cursor: "#f8f8f0",
    cursorAccent: "#272822",
    selectionBackground: "#49483e",
    black: "#272822",
    red: "#f92672",
    green: "#a6e22e",
    yellow: "#f4bf75",
    blue: "#66d9ef",
    magenta: "#ae81ff",
    cyan: "#a1efe4",
    white: "#f8f8f2",
    brightBlack: "#75715e",
    brightRed: "#f92672",
    brightGreen: "#a6e22e",
    brightYellow: "#f4bf75",
    brightBlue: "#66d9ef",
    brightMagenta: "#ae81ff",
    brightCyan: "#a1efe4",
    brightWhite: "#f9f8f5",
  },
  nord: {
    background: "#2e3440",
    foreground: "#eceff4",
    cursor: "#d8dee9",
    cursorAccent: "#2e3440",
    selectionBackground: "#434c5e",
    black: "#3b4252",
    red: "#bf616a",
    green: "#a3be8c",
    yellow: "#ebcb8b",
    blue: "#81a1c1",
    magenta: "#b48ead",
    cyan: "#88c0d0",
    white: "#e5e9f0",
    brightBlack: "#4c566a",
    brightRed: "#bf616a",
    brightGreen: "#a3be8c",
    brightYellow: "#ebcb8b",
    brightBlue: "#81a1c1",
    brightMagenta: "#b48ead",
    brightCyan: "#8fbcbb",
    brightWhite: "#eceff4",
  },
};

type ThemeName = keyof typeof themes;
let currentTheme: ThemeName = "dark";
let fontSize = 14;
let term: InstanceType<typeof TerminalComponent> | null = null;
let fitAddon: FitAddon | null = null;

// 日志函数
function log(message: string, type: "info" | "warn" | "error" = "info") {
  const timestamp = new Date().toISOString();
  const prefix =
    type === "error" ? "❌" : type === "warn" ? "⚠️" : "ℹ️";
  console[type](`${prefix} [${timestamp}] ${message}`);
}

// 抑制 xterm.js 解析错误
function suppressXtermErrors() {
  const orig = console.error.bind(console);
  let count = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (msg.includes("xterm.js: Parsing error")) {
      count++;
      if (count === 1) {
        timer = setTimeout(() => {
          if (count > 1) {
            log(
              `${count - 1} 个 VT 序列解析错误已抑制`,
              "warn"
            );
          }
          count = 0;
        }, 5000);
      }
      return;
    }
    orig(...args);
  };

  return () => {
    console.error = orig;
    if (timer) clearTimeout(timer);
  };
}

// 更新状态栏
function updateStatusBar() {
  const sizeText = document.getElementById("size-text");
  const fontSizeText = document.getElementById("font-size-text");
  const themeText = document.getElementById("theme-text");

  if (sizeText && term) {
    sizeText.textContent = `${term.cols} x ${term.rows}`;
  }
  if (fontSizeText) {
    fontSizeText.textContent = `${fontSize}px`;
  }
  if (themeText) {
    themeText.textContent = currentTheme;
  }
}

// 设置状态
function setStatus(text: string, isError = false) {
  const statusText = document.getElementById("status-text");
  const statusDot = document.getElementById("status-dot");

  if (statusText) statusText.textContent = text;
  if (statusDot) {
    statusDot.classList.toggle("error", isError);
  }
}

// 初始化终端
async function initTerminal() {
  const terminalContainer = document.getElementById("terminal");
  const loadingEl = document.getElementById("loading");

  if (!terminalContainer) {
    log("找不到终端容器", "error");
    return;
  }

  log("开始初始化终端...");

  // 抑制 xterm.js 错误
  const restore = suppressXtermErrors();

  try {
    // 创建终端实例
    term = new TerminalComponent({
      cursorBlink: true,
      fontSize: fontSize,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, monospace",
      theme: themes[currentTheme],
      scrollback: 10000,
      allowTransparency: true,
      allowProposedApi: true,
    });

    // 加载 FitAddon
    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // 加载 SearchAddon
    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);

    // 加载 WebLinksAddon
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(webLinksAddon);

    // 加载 Unicode11Addon
    const unicodeAddon = new Unicode11Addon();
    term.loadAddon(unicodeAddon);
    term.unicode.activeVersion = "11";

    // 动态加载 ClipboardAddon
    try {
      const { ClipboardAddon } = await import("@xterm/addon-clipboard");
      term.loadAddon(new ClipboardAddon());
      log("ClipboardAddon 加载成功");
    } catch (e) {
      log("ClipboardAddon 加载失败: " + e, "warn");
    }

    // 打开终端
    term.open(terminalContainer);
    log("终端已打开");

    // 等待 DOM 渲染完成后 fit
    setTimeout(() => {
      fitAddon?.fit();
      term?.focus();
      updateStatusBar();
      setStatus("就绪");
      log("终端初始化完成");

      // 隐藏加载动画
      if (loadingEl) {
        loadingEl.classList.add("hidden");
        setTimeout(() => loadingEl.remove(), 300);
      }

      // 显示欢迎信息
      showWelcome();
    }, 50);

    // 终端输入处理
    setupInputHandler();

    // 设置工具栏按钮
    setupToolbar();

    // 设置窗口大小监听
    setupResizeHandler();
  } catch (error) {
    log(`初始化失败: ${error}`, "error");
    setStatus("初始化失败", true);
    if (loadingEl) {
      loadingEl.querySelector("p")!.textContent = "初始化失败: " + error;
    }
  }

  // 清理函数
  return () => {
    restore();
    term?.dispose();
    term = null;
  };
}

// 显示欢迎信息
function showWelcome() {
  if (!term) return;

  term.writeln("");
  term.writeln(
    "\x1b[1;32m╔════════════════════════════════════════════════════════════╗\x1b[0m"
  );
  term.writeln(
    "\x1b[1;32m║           xterm.js Tauri Demo - 终端模拟器                  ║\x1b[0m"
  );
  term.writeln(
    "\x1b[1;32m╚════════════════════════════════════════════════════════════╝\x1b[0m"
  );
  term.writeln("");
  term.writeln("\x1b[36m[可用命令]\x1b[0m");
  term.writeln("  \x1b[33mclear\x1b[0m       - 清屏");
  term.writeln("  \x1b[33minfo\x1b[0m        - 显示终端信息");
  term.writeln("  \x1b[33mfont+\x1b[0m        - 增大字体");
  term.writeln("  \x1b[33mfont-\x1b[0m        - 减小字体");
  term.writeln("  \x1b[33mtheme\x1b[0m        - 切换主题");
  term.writeln("  \x1b[33mthemes\x1b[0m       - 显示所有可用主题");
  term.writeln("  \x1b[33menv\x1b[0m         - 显示环境信息");
  term.writeln("  \x1b[33mcols\x1b[0m         - 显示列数");
  term.writeln("  \x1b[33mrows\x1b[0m         - 显示行数");
  term.writeln("  \x1b[33municode\x1b[0m      - 测试 Unicode 11 支持");
  term.writeln("");
  term.write("\x1b[1;37m$\x1b[0m ");
}

// 设置输入处理
function setupInputHandler() {
  if (!term) return;

  let inputBuffer = "";

  term.onData((data) => {
    // 过滤控制字符用于日志
    const displayData = data.replace(/\r/g, "\\r").replace(/\n/g, "\\n");
    log(`收到数据: ${displayData}`);

    // 回车处理
    if (data === "\r") {
      term.write("\r\n");
      const cmd = inputBuffer.trim();
      inputBuffer = "";

      if (cmd) {
        handleCommand(cmd);
      }
      term.write("\x1b[1;37m$\x1b[0m ");

      // 清除退格
    } else if (data === "\x7f") {
      if (inputBuffer.length > 0) {
        inputBuffer = inputBuffer.slice(0, -1);
        term.write("\b \b");
      }

      // Ctrl+C
    } else if (data === "\x03") {
      term.write("^C");
      inputBuffer = "";
      term.write("\r\n\x1b[1;37m$\x1b[0m ");

      // 其他字符
    } else {
      inputBuffer += data;
      term.write(data);
    }
  });
}

// 处理命令
function handleCommand(cmd: string) {
  if (!term) return;

  const args = cmd.split(" ");
  const command = args[0].toLowerCase();

  switch (command) {
    case "clear":
    case "cls":
      term.clear();
      break;

    case "info":
      term.writeln("\x1b[36m[终端信息]\x1b[0m");
      term.writeln(`  尺寸: ${term.cols} x ${term.rows}`);
      term.writeln(`  字体大小: ${fontSize}px`);
      term.writeln(`  当前主题: ${currentTheme}`);
      term.writeln(`  User Agent: ${navigator.userAgent}`);
      term.writeln(`  设备像素比: ${window.devicePixelRatio}`);
      break;

    case "font+":
      setFontSize(fontSize + 2);
      term.writeln(`\x1b[32m字体已增大: ${fontSize}px\x1b[0m`);
      break;

    case "font-":
      setFontSize(fontSize - 2);
      term.writeln(`\x1b[32m字体已减小: ${fontSize}px\x1b[0m`);
      break;

    case "theme":
      const themeNames = Object.keys(themes) as ThemeName[];
      const currentIndex = themeNames.indexOf(currentTheme);
      const nextTheme = themeNames[(currentIndex + 1) % themeNames.length];
      setTheme(nextTheme);
      term.writeln(`\x1b[32m主题已切换: ${currentTheme}\x1b[0m`);
      break;

    case "themes":
      term.writeln("\x1b[36m[可用主题]\x1b[0m");
      Object.keys(themes).forEach((name) => {
        const marker = name === currentTheme ? " \x1b[33m*\x1b[0m" : "";
        term.writeln(`  ${name}${marker}`);
      });
      break;

    case "env":
      term.writeln("\x1b[36m[环境信息]\x1b[0m");
      term.writeln(`  平台: ${navigator.platform}`);
      term.writeln(`  User Agent: ${navigator.userAgent}`);
      term.writeln(`  视口: ${window.innerWidth} x ${window.innerHeight}`);
      term.writeln(`  像素比: ${window.devicePixelRatio}`);
      break;

    case "cols":
      term.writeln(`\x1b[33m${term.cols}\x1b[0m`);
      break;

    case "rows":
      term.writeln(`\x1b[33m${term.rows}\x1b[0m`);
      break;

    case "unicode":
      term.writeln("\x1b[36m[Unicode 11 测试]\x1b[0m");
      term.writeln("  🧡 表情符号支持");
      term.writeln("  ═══ 测试线条字符 ═══");
      term.writeln("  ████████████████ 区块字符");
      break;

    case "help":
      term.writeln("\x1b[36m[帮助]\x1b[0m");
      term.writeln("  输入支持的命令并按回车执行");
      term.writeln("  Ctrl+C 取消当前输入");
      term.writeln("  使用工具栏按钮进行快捷操作");
      break;

    default:
      term.writeln(`\x1b[31m未知命令: ${command} (输入 help 获取帮助)\x1b[0m`);
  }
}

// 设置字体大小
function setFontSize(size: number) {
  if (size < 8 || size > 32) return;
  fontSize = size;
  if (term) {
    term.options.fontSize = fontSize;
    fitAddon?.fit();
  }
  updateStatusBar();
  log(`字体大小设置为 ${fontSize}px`);
}

// 设置主题
function setTheme(themeName: ThemeName) {
  if (!themes[themeName]) {
    log(`未知主题: ${themeName}`, "error");
    return;
  }
  currentTheme = themeName;
  if (term) {
    term.options.theme = themes[currentTheme];
  }
  updateStatusBar();
  log(`主题切换为 ${currentTheme}`);
}

// 设置工具栏
function setupToolbar() {
  document.getElementById("btn-clear")?.addEventListener("click", () => {
    term?.clear();
    log("屏幕已清除");
  });

  document.getElementById("btn-font-increase")?.addEventListener("click", () => {
    setFontSize(fontSize + 2);
  });

  document.getElementById("btn-font-decrease")?.addEventListener("click", () => {
    setFontSize(fontSize - 2);
  });

  document.getElementById("btn-theme")?.addEventListener("click", () => {
    const themeNames = Object.keys(themes) as ThemeName[];
    const currentIndex = themeNames.indexOf(currentTheme);
    const nextTheme = themeNames[(currentIndex + 1) % themeNames.length];
    setTheme(nextTheme);
  });

  document.getElementById("btn-copy")?.addEventListener("click", async () => {
    if (term?.hasSelection()) {
      const selection = term.getSelection();
      if (selection) {
        await navigator.clipboard.writeText(selection);
        log("已复制选中内容");
      }
    } else {
      log("没有选中的内容", "warn");
    }
  });

  // 键盘快捷键
  document.addEventListener("keydown", (e) => {
    // Ctrl+Plus 放大字体
    if (e.ctrlKey && (e.key === "+" || e.key === "=")) {
      e.preventDefault();
      setFontSize(fontSize + 2);
    }
    // Ctrl+Minus 缩小字体
    if (e.ctrlKey && e.key === "-") {
      e.preventDefault();
      setFontSize(fontSize - 2);
    }
    // Ctrl+0 重置字体
    if (e.ctrlKey && e.key === "0") {
      e.preventDefault();
      setFontSize(14);
    }
  });
}

// 设置窗口大小监听
function setupResizeHandler() {
  let rafId: number | null = null;

  const handleResize = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      fitAddon?.fit();
      updateStatusBar();
      rafId = null;
    });
  };

  window.addEventListener("resize", handleResize);

  // 使用 ResizeObserver 监听容器变化
  const terminalContainer = document.getElementById("terminal");
  if (terminalContainer) {
    const resizeObserver = new ResizeObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        fitAddon?.fit();
        updateStatusBar();
        rafId = null;
      });
    });
    resizeObserver.observe(terminalContainer);
  }
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
  log("页面加载完成，开始初始化终端...");
  initTerminal();
});
