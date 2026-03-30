import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'

function App() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)

  useEffect(() => {
    if (!terminalRef.current || termRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Fira Code", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(searchAddon)
    term.open(terminalRef.current)
    fitAddon.fit()

    term.writeln('Welcome to xterm.js in React!')
    term.writeln('')
    term.writeln('Type some commands to test the terminal.')
    term.writeln('')
    term.write('$ ')

    term.onData((data) => {
      if (data === '\r') {
        term.write('\r\n$ ')
      } else if (data === '\x7f') {
        term.write('\b \b')
      } else {
        term.write(data)
      }
    })

    termRef.current = term

    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      term.dispose()
      termRef.current = null
    }
  }, [])

  return (
    <>
      <div className="terminal-header">
        xterm.js Playground
      </div>
      <div className="terminal-container" ref={terminalRef} />
    </>
  )
}

export default App
