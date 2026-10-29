#!/usr/bin/env node
/**
 * Cross-platform runner for npm scripts.
 * Windows / normal Linux: run locally.
 * WSL path /mnt/* with bash: sync to ext4 via scripts/run-linux.sh (NTFS noexec).
 */
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const script = process.argv[2] || 'vite:dev'
const extra = process.argv.slice(3)

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: root,
    shell: opts.shell ?? false,
    env: process.env,
  })
  if (result.error?.code === 'ENOENT') return { ok: false, missing: true, status: 1 }
  return { ok: result.status === 0, missing: false, status: result.status ?? 1 }
}

function shouldUseLinuxSync() {
  if (process.platform === 'win32') return false
  const cwd = process.cwd().replaceAll('\\', '/')
  return cwd.startsWith('/mnt/')
}

if (shouldUseLinuxSync()) {
  const linux = run('bash', ['scripts/run-linux.sh', script, ...extra])
  if (!linux.missing) process.exit(linux.status)
  console.warn('bash not found; running locally.')
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const args = ['run', script]
if (extra.length) args.push('--', ...extra)

const local = run(npmCmd, args, { shell: process.platform === 'win32' })
process.exit(local.status)
