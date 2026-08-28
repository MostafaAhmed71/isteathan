#!/usr/bin/env node
/**
 * Cross-platform npm script runner.
 *
 * Windows: run Vite locally (bash / rsync are not required).
 * Linux: keep the NTFS/noexec workaround in scripts/run-linux.sh
 *        (copies to ~/work/isteathan then runs there).
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const script = process.argv[2] || 'vite:dev'
const extra = process.argv.slice(3)

function quote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`
}

function run(command, args = [], { shell = false } = {}) {
  const child = shell
    ? spawn([command, ...args].filter(Boolean).join(' '), {
        cwd: root,
        stdio: 'inherit',
        env: process.env,
        shell: true,
      })
    : spawn(command, args, {
        cwd: root,
        stdio: 'inherit',
        env: process.env,
        shell: false,
      })
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    process.exit(code ?? 1)
  })
  child.on('error', (err) => {
    console.error(err.message)
    process.exit(1)
  })
}

if (process.platform === 'win32') {
  const args = extra.length ? ['--', ...extra.map(quote)] : []
  run(`npm run ${quote(script)}`, args, { shell: true })
} else {
  const wrapper = path.join(root, 'scripts', 'run-linux.sh')
  if (existsSync(wrapper)) {
    run('bash', [wrapper, script, ...extra])
  } else {
    run('npm', ['run', script, '--', ...extra])
  }
}
