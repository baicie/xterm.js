import { useEffect, useRef, useState } from "react";
import { Terminal } from "@baicie/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";

interface EnvInfo {
  userAgent: string;
  platform: string;
  screenSize: string;
  viewportSize: string;
  pixelRatio: number;
  webglSupport: string;
  isTauri: boolean;
}

function App() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const [envInfo, setEnvInfo] = useState<EnvInfo | null>(null);

  const detectEnvironment = (): EnvInfo => {
    const ua = navigator.userAgent;
    let platform = "Unknown";
    if (ua.includes("Macintosh")) platform = "macOS";
    else if (ua.includes("Windows")) platform = "Windows";
    else if (ua.includes("Linux")) platform = "Linux";

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const webglSupport = gl ? gl.getParameter(gl.VERSION) : "不支持";

    return {
      userAgent: navigator.userAgent,
      platform,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      pixelRatio: window.devicePixelRatio,
      webglSupport,
      isTauri: !!(window as any).__TAURI__,
    };
  };

  const initTerminal = () => {
    if (!terminalRef.current || termRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Fira Code", "SF Mono", Menlo, Monaco, monospace',
      theme: {
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
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    setEnvInfo(detectEnvironment());

    term.writeln(
      "\x1b[1;32m╔═══════════════════════════════════════════════════════╗\x1b[0m",
    );
    term.writeln(
      "\x1b[1;32m║         xterm.js React Playground                     ║\x1b[0m",
    );
    term.writeln(
      "\x1b[1;32m╚═══════════════════════════════════════════════════════╝\x1b[0m",
    );
    term.writeln("");
    term.writeln("\x1b[36m[环境信息]\x1b[0m");
    term.writeln(`  平台: ${envInfo?.platform || "检测中..."} `);
    term.writeln(`  终端尺寸: ${term.cols}x${term.rows}`);
    term.writeln("");
    term.writeln("\x1b[33m[测试命令]\x1b[0m");
    term.writeln("  输入命令后按回车执行:");
    term.writeln("  - info: 显示环境信息");
    term.writeln("  - resize: 重新调整终端大小");
    term.writeln("  - env: 显示浏览器环境详情");
    term.writeln("");
    term.write("\x1b[1;37m$\x1b[0m ");

    let inputBuffer = "";

    term.onData((data) => {
      if (data === "\r") {
        term.write("\r\n");
        const cmd = inputBuffer.trim().toLowerCase();
        inputBuffer = "";

        if (cmd === "info") {
          term.writeln(`\x1b[36m终端尺寸: ${term.cols}x${term.rows}\x1b[0m`);
          term.writeln(`\x1b[36m像素比例: ${window.devicePixelRatio}\x1b[0m`);
        } else if (cmd === "resize") {
          fitAddon.fit();
          term.writeln(`\x1b[36m已重新调整: ${term.cols}x${term.rows}\x1b[0m`);
        } else if (cmd === "env") {
          const info = detectEnvironment();
          term.writeln(`\x1b[36m平台: ${info.platform}\x1b[0m`);
          term.writeln(`\x1b[36m屏幕: ${info.screenSize}\x1b[0m`);
          term.writeln(`\x1b[36m视口: ${info.viewportSize}\x1b[0m`);
          term.writeln(`\x1b[36m像素比: ${info.pixelRatio}\x1b[0m`);
          term.writeln(`\x1b[36mWebGL: ${info.webglSupport}\x1b[0m`);
          term.writeln(`\x1b[36mTauri: ${info.isTauri ? "是" : "否"}\x1b[0m`);
        }
        term.writeln("");
        term.write("\x1b[1;37m$\x1b[0m ");
      } else if (data === "\x7f") {
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          term.write("\b \b");
        }
      } else {
        inputBuffer += data;
        term.write(data);
      }
    });

    term.onResize(({ cols, rows }) => {
      console.log(`Terminal resized to ${cols}x${rows}`);
    });

    termRef.current = term;

    const handleResize = () => {
      fitAddon.fit();
      const info = detectEnvironment();
      setEnvInfo(info);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
      termRef.current = null;
    };
  };

  useEffect(() => {
    const cleanup = initTerminal();
    return cleanup;
  }, []);

  return (
    <>
      <div className="terminal-header">
        <span className="title">xterm.js React Playground</span>
        {envInfo && (
          <span className="env-info">
            {envInfo.platform} | {envInfo.viewportSize} |{" "}
            {envInfo.isTauri ? "Tauri" : "Browser"}
          </span>
        )}
      </div>
      <div className="terminal-container" ref={terminalRef} />
    </>
  );
}

export default App;
