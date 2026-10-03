import { spawn, execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const viteBin = path.resolve('node_modules/vite/bin/vite.js')
const child = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', '5173', '--strictPort', '--open'], {
  stdio: 'inherit',
  windowsHide: false,
  detached: false
})

let stopping = false
function stopChild() {
  if (stopping || !child.pid) return
  stopping = true
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    else child.kill('SIGTERM')
  } catch {}
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    stopChild()
    process.exit(0)
  })
}
process.on('exit', stopChild)
child.on('error', (error) => {
  console.error(`Questbound dev server failed: ${error.message}`)
  process.exitCode = 1
})
child.on('exit', (code) => {
  stopping = true
  process.exit(code ?? 0)
})
