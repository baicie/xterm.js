import '@xterm/xterm/css/xterm.css'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'

// xterm 测试配置
const terminalConfig = {
  cursorBlink: true,
  fontSize: 14,
  fontFamily: '"SF Mono", "Fira Code", Menlo, Monaco, monospace',
  theme: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#ffffff',
    cursorAccent: '#1e1e1e',
    selectionBackground: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#ffffff',
  },
}

function log(message: string, type: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString()
  const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️'
  console[type](`${prefix} [${timestamp}] ${message}`)
  return `[${timestamp}] ${message}`
}

function detectEnvironment(): string {
  const ua = navigator.userAgent
  if (ua.includes('Macintosh')) return 'macOS'
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Linux')) return 'Linux'
  return 'Unknown'
}

function logEnvironmentInfo() {
  const env = detectEnvironment()
  log(`运行环境: ${env}`)
  log(`User Agent: ${navigator.userAgent}`)
  log(`屏幕分辨率: ${window.screen.width}x${window.screen.height}`)
  log(`视口大小: ${window.innerWidth}x${window.innerHeight}`)
  log(`设备像素比: ${window.devicePixelRatio}`)
  
  // 检查 WebGL 支持
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
  log(`WebGL 支持: ${gl ? gl.getParameter(gl.VERSION) : '不支持'}`)
  
  // 检查是否是 Tauri 环境
  if (window.__TAURI__) {
    log('检测到 Tauri 环境', 'info')
  } else {
    log('运行在标准浏览器环境', 'info')
  }
}

async function initTerminal() {
  const terminalContainer = document.getElementById('terminal')
  const statusElement = document.getElementById('status')
  
  if (!terminalContainer) {
    log('找不到终端容器', 'error')
    return
  }
  
  if (statusElement) {
    statusElement.textContent = '正在初始化终端...'
  }
  
  try {
    log('开始创建 Terminal 实例...')
    const term = new Terminal(terminalConfig)
    log('Terminal 实例创建成功')
    
    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    
    log('加载 FitAddon...')
    term.loadAddon(fitAddon)
    
    log('加载 SearchAddon...')
    term.loadAddon(searchAddon)
    
    log('打开终端...')
    term.open(terminalContainer)
    
    log('执行 fit()...')
    fitAddon.fit()
    
    if (statusElement) {
      statusElement.textContent = `终端就绪 | 尺寸: ${term.cols}x${term.rows}`
    }
    
    term.writeln('\x1b[1;32m╔══════════════════════════════════════════════════════════════╗\x1b[0m')
    term.writeln('\x1b[1;32m║           xterm.js Tauri Demo - macOS WebView 测试            ║\x1b[0m')
    term.writeln('\x1b[1;32m╚══════════════════════════════════════════════════════════════╝\x1b[0m')
    term.writeln('')
    
    logEnvironmentInfo()
    
    term.writeln('\x1b[36m[终端信息]\x1b[0m')
    term.writeln(`  - 终端列数: ${term.cols}`)
    term.writeln(`  - 终端行数: ${term.rows}`)
    term.writeln(`  - 像素比例: ${window.devicePixelRatio}`)
    term.writeln('')
    
    term.writeln('\x1b[33m[常见问题排查]\x1b[0m')
    term.writeln('  1. 如果终端无响应，检查 WebView 是否禁用了 JavaScript')
    term.writeln('  2. 如果字体显示异常，确保 WebView 支持自定义字体')
    term.writeln('  3. 如果输入延迟，检查是否有安全策略限制')
    term.writeln('  4. 如果渲染异常，检查 GPU 加速设置')
    term.writeln('')
    
    term.writeln('\x1b[35m[测试命令]\x1b[0m')
    term.writeln('  - 输入字符测试输入功能')
    term.writeln('  - 输入 \\x03 测试 Ctrl+C')
    term.writeln('  - 尝试全屏/调整窗口大小测试 fit 功能')
    term.writeln('')
    term.write('\x1b[1;37m$\x1b[0m ')
    
    let inputBuffer = ''
    
    term.onData((data) => {
      log(`收到数据: ${JSON.stringify(data)}`)
      
      if (data === '\r') {
        term.write('\r\n')
        const cmd = inputBuffer.trim()
        inputBuffer = ''
        
        if (cmd) {
          term.writeln(`\x1b[90m执行命令: ${cmd}\x1b[0m`)
          if (cmd === 'clear' || cmd === 'cls') {
            term.clear()
          } else if (cmd === 'info') {
            term.writeln(`\x1b[36m终端信息: ${term.cols}x${term.rows}\x1b[0m`)
            term.writeln(`\x1b[36m像素比例: ${window.devicePixelRatio}\x1b[0m`)
          } else if (cmd === 'resize') {
            fitAddon.fit()
            term.writeln(`\x1b[36m已重新调整: ${term.cols}x${term.rows}\x1b[0m`)
          } else if (cmd === 'env') {
            logEnvironmentInfo()
          } else {
            term.writeln(`\x1b[31m未知命令: ${cmd}\x1b[0m`)
          }
          term.writeln('')
        }
        term.write('\x1b[1;37m$\x1b[0m ')
      } else if (data === '\x7f') {
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1)
          term.write('\b \b')
        }
      } else {
        inputBuffer += data
        term.write(data)
      }
    })
    
    term.onResize(({ cols, rows }) => {
      log(`终端尺寸改变: ${cols}x${rows}`)
      if (statusElement) {
        statusElement.textContent = `终端就绪 | 尺寸: ${cols}x${rows}`
      }
    })
    
    term.onTitleChange((title) => {
      log(`标题改变: ${title}`)
      document.title = title
    })
    
    log('终端初始化完成')
    
    // 窗口大小改变时重新 fit
    window.addEventListener('resize', () => {
      log('窗口大小改变，执行 fit')
      fitAddon.fit()
    })
    
  } catch (error) {
    log(`初始化失败: ${error}`, 'error')
    if (statusElement) {
      statusElement.textContent = `初始化失败: ${error}`
      statusElement.style.color = 'red'
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  log('页面加载完成，开始初始化...')
  initTerminal()
})
