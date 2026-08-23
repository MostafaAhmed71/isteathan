/**
 * Static security checks for PWA caching rules.
 * Ensures Supabase / API traffic stays NetworkOnly and push is not configured.
 *
 * Run: npm run check:pwa
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const viteConfig = readFileSync(resolve(root, 'vite.config.ts'), 'utf8')
const swSource = readFileSync(resolve(root, 'src/sw.ts'), 'utf8')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

const errors = []

function assert(condition, message) {
  if (!condition) errors.push(message)
}

assert(
  swSource.includes('NetworkOnly') && swSource.includes('supabase'),
  'src/sw.ts must use NetworkOnly for Supabase hosts',
)

assert(
  swSource.includes('offline.html'),
  'src/sw.ts must fall back to offline.html on navigation failure',
)

assert(
  !/pushManager|pushsubscriptionchange|web-push|firebase-messaging/i.test(swSource) &&
    !/pushManager|pushsubscriptionchange|web-push|firebase-messaging/i.test(viteConfig),
  'Push notifications must not be configured in the PWA setup',
)

assert(
  viteConfig.includes("strategies: 'injectManifest'"),
  'PWA must use injectManifest so caching rules stay explicit in src/sw.ts',
)

assert(
  !/cacheName:\s*['"][^'"]*(student|request|permission|auth|token)/i.test(swSource),
  'Do not create caches named for students, requests, auth, or tokens',
)

assert(
  !/permission_requests|students\b/.test(swSource),
  'Service worker must not reference students or permission_requests tables',
)

const requiredFiles = [
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/icons/icon-maskable-512.png',
  'public/offline.html',
  'src/sw.ts',
  'src/components/InstallPrompt.tsx',
]

for (const file of requiredFiles) {
  assert(existsSync(resolve(root, file)), `Missing required PWA file: ${file}`)
}

assert(Boolean(pkg.scripts?.['check:pwa']), 'package.json must expose check:pwa script')

if (errors.length) {
  console.error('PWA security check failed:\n' + errors.map((e) => ` - ${e}`).join('\n'))
  process.exit(1)
}

console.log('PWA security check passed: app-shell only, Supabase NetworkOnly, no push.')
