/**
 * WPPConnect sidecar. Holds the WhatsApp Web session.
 * Never expose this port publicly without WHATSAPP_GATEWAY_SECRET.
 */
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'

const gatewayDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(gatewayDir, '..')
const tokensDir = resolve(gatewayDir, 'tokens')

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    const val = m[2].trim()
    if (!process.env[key]) process.env[key] = val
  }
}

function loadEnv() {
  loadEnvFile(resolve(gatewayDir, '.env'))
  loadEnvFile(resolve(root, '.env'))
}

loadEnv()

const PORT = Number(process.env.WHATSAPP_GATEWAY_PORT || 3310)
const HOST = process.env.WHATSAPP_GATEWAY_HOST || '127.0.0.1'
const SECRET = process.env.WHATSAPP_GATEWAY_SECRET || ''
const SESSION = process.env.WHATSAPP_SESSION_NAME || 'isteathan'
const BASE_PATH = (process.env.WHATSAPP_GATEWAY_BASE_PATH || '').replace(/\/$/, '')

let client = null
let lastQr = null
let state = 'starting'
let starting = false
let recoverTimer = null

const DISCONNECT_STATUSES = new Set([
  'disconnectedMobile',
  'desconnectedMobile',
  'browserClose',
  'autocloseCalled',
  'serverClose',
  'deleteToken',
])

function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function authorized(req) {
  if (!SECRET) return true
  return req.headers['x-whatsapp-secret'] === SECRET
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label}_timeout`)), ms)
    }),
  ])
}

function toChatId(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('966') && digits.length >= 12) return `${digits}@c.us`
  if (digits.startsWith('05') && digits.length === 10) return `966${digits.slice(1)}@c.us`
  if (digits.startsWith('5') && digits.length === 9) return `966${digits}@c.us`
  return `${digits}@c.us`
}

function uniqueIds(ids) {
  return [...new Set(ids.filter(Boolean))]
}

function isGhostSendError(err) {
  const msg = err instanceof Error ? err.message : String(err)
  return /getMessageById|message not found|wapi\.js|reading 'ack'/i.test(msg)
}

function extractLid(entry) {
  if (!entry) return null
  const candidates = [
    entry?.lid?._serialized,
    entry?.lid?.id?._serialized,
    entry?.lid?.id,
    typeof entry?.lid === 'string' ? entry.lid : null,
    entry?.lidUser ? `${entry.lidUser}@lid` : null,
  ]
  for (const c of candidates) {
    if (!c) continue
    const s = String(c)
    if (s.endsWith('@lid')) return s
    if (/^\d+$/.test(s)) return `${s}@lid`
  }
  return null
}

async function sendTextSafe(phone, text) {
  if (!client) throw new Error('whatsapp_not_ready')
  const pnId = toChatId(phone)
  if (!pnId) throw new Error('invalid_phone')

  let lidId = null
  let resolvedId = null
  try {
    const status = await withTimeout(client.checkNumberStatus(pnId), 8000, 'checkNumberStatus')
    resolvedId = status?.id?._serialized || (typeof status?.id === 'string' ? status.id : null)
    const statusLid = status?.lid?._serialized || status?.lid || status?.id?.lid
    if (statusLid) {
      const s = String(statusLid)
      lidId = s.includes('@') ? s : `${s}@lid`
    }
    if (!status?.canReceiveMessage) {
      throw new Error('number_not_on_whatsapp')
    }
  } catch (err) {
    console.warn('[whatsapp] checkNumberStatus skipped', err instanceof Error ? err.message : err)
  }
  try {
    if (typeof client.getPnLidEntry === 'function') {
      const entry = await withTimeout(client.getPnLidEntry(pnId), 8000, 'getPnLidEntry')
      lidId = extractLid(entry) || lidId
    }
  } catch (err) {
    console.warn('[whatsapp] getPnLidEntry skipped', err instanceof Error ? err.message : err)
  }

  let migrated = false
  try {
    if (typeof client.isLidMigrated === 'function') {
      migrated = Boolean(await client.isLidMigrated())
    }
  } catch {
    /* ignore */
  }

  let targets
  if (migrated && lidId) targets = [lidId]
  else if (lidId) targets = uniqueIds([lidId, resolvedId, pnId])
  else targets = uniqueIds([resolvedId, pnId])

  console.log('[whatsapp] send targets', { pnId, resolvedId, lidId, migrated, targets })

  let lastErr
  for (const chatId of targets) {
    try {
      console.log('[whatsapp] sendText', chatId)
      await withTimeout(client.sendText(chatId, text), 20000, 'sendText')
      return { ok: true, chatId }
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[whatsapp] sendText failed', chatId, msg)
      if (isGhostSendError(err)) return { ok: true, chatId, warning: msg }
      try {
        await withTimeout(client.sendText(chatId, text, { createChat: true }), 20000, 'sendText_createChat')
        return { ok: true, chatId }
      } catch (err2) {
        lastErr = err2
        const msg2 = err2 instanceof Error ? err2.message : String(err2)
        console.warn('[whatsapp] sendText createChat failed', chatId, msg2)
        if (isGhostSendError(err2)) return { ok: true, chatId, warning: msg2 }
      }
    }
  }
  throw lastErr || new Error('send_failed')
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

const chromeArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
]

async function closeClientQuietly() {
  const current = client
  client = null
  if (!current) return
  try {
    if (typeof current.close === 'function') await current.close()
  } catch {
    /* ignore */
  }
}

function killStaleBrowsers() {
  try {
    execSync(`pkill -f '${tokensDir.replace(/'/g, `'\\''`)}' || true`, { stdio: 'ignore' })
  } catch {
    /* ignore */
  }
}

function clearSessionFolder() {
  const sessionPath = resolve(tokensDir, SESSION)
  try {
    if (existsSync(sessionPath)) {
      rmSync(sessionPath, { recursive: true, force: true })
      console.log('[whatsapp] cleared unpaired session folder')
    }
  } catch (err) {
    console.warn('[whatsapp] failed to clear session folder', err instanceof Error ? err.message : err)
  }
}

function scheduleRecover(reason, { clearSession = true, delayMs = 4000 } = {}) {
  if (recoverTimer || starting) {
    console.log('[whatsapp] recover already pending/running; reason=', reason)
    return
  }
  state = 'recovering'
  lastQr = null
  console.log(`[whatsapp] scheduling recover in ${delayMs}ms (${reason})`)
  recoverTimer = setTimeout(() => {
    recoverTimer = null
    void recoverSession(reason, clearSession)
  }, delayMs)
}

async function recoverSession(reason, clearSession) {
  console.log('[whatsapp] recovering after', reason)
  await closeClientQuietly()
  killStaleBrowsers()
  await new Promise((r) => setTimeout(r, 1500))
  if (clearSession) clearSessionFolder()
  try {
    await startWpp()
  } catch (err) {
    state = 'error'
    console.error('[whatsapp] recover failed', err)
    scheduleRecover('recover_failed', { clearSession: true, delayMs: 10000 })
  }
}

async function startWpp() {
  if (starting) return
  starting = true
  killStaleBrowsers()
  await new Promise((r) => setTimeout(r, 1000))
  const wppconnect = await import('@wppconnect-team/wppconnect')
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined
  const maxAttempts = 8
  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      state = 'connecting'
      lastQr = null
      try {
        client = await wppconnect.create({
          session: SESSION,
          catchQR: (base64Qr) => {
            lastQr = base64Qr
            state = 'qr'
            console.log('[whatsapp] Scan the QR from Admin → مشرفو الخروج')
          },
          statusFind: (statusSession) => {
            const status = String(statusSession || '')
            state = status || state
            if (status === 'isLogged' || status === 'qrReadSuccess' || status === 'inChat') {
              lastQr = null
            }
            console.log('[whatsapp] status', statusSession)
            if (DISCONNECT_STATUSES.has(status)) {
              scheduleRecover(status, { clearSession: true, delayMs: 3000 })
            }
          },
          headless: true,
          logQR: true,
          disableWelcome: true,
          autoClose: 0,
          deviceSyncTimeout: 0,
          waitForLogin: true,
          folderNameToken: tokensDir,
          browserArgs: chromeArgs,
          puppeteerOptions: {
            ...(executablePath ? { executablePath } : {}),
            args: chromeArgs,
          },
        })
        state = 'connected'
        lastQr = null
        console.log('[whatsapp] session ready')
        return
      } catch (err) {
        client = null
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[whatsapp] start attempt ${attempt}/${maxAttempts} failed:`, message)
        if (attempt === maxAttempts) throw err
        await new Promise((r) => setTimeout(r, 4000))
      }
    }
  } finally {
    starting = false
  }
}

const server = createServer(async (req, res) => {
  let path = req.url?.split('?')[0] || '/'
  if (BASE_PATH && (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`))) {
    path = path.slice(BASE_PATH.length) || '/'
  }
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-whatsapp-secret')
    res.end()
    return
  }
  if (!authorized(req)) {
    json(res, 401, { error: 'unauthorized' })
    return
  }

  if (path === '/status' && req.method === 'GET') {
    let connected = false
    try {
      connected = Boolean(client && (await client.isConnected()))
    } catch {
      connected = false
    }
    json(res, 200, { connected, state, qr: lastQr })
    return
  }

  if (path === '/send' && req.method === 'POST') {
    try {
      if (!client) throw new Error('whatsapp_not_ready')
      const connected = await client.isConnected()
      if (!connected) throw new Error('whatsapp_disconnected')
      const body = await readBody(req)
      const phone = String(body.phone || '').replace(/\D/g, '')
      const text = String(body.text || '')
      if (!phone || !text) {
        json(res, 400, { error: 'phone_and_text_required' })
        return
      }
      await sendTextSafe(phone, text)
      json(res, 200, { ok: true })
    } catch (err) {
      json(res, 500, { error: err instanceof Error ? err.message : 'send_failed' })
    }
    return
  }

  json(res, 404, { error: 'not_found' })
})

server.listen(PORT, HOST, () => {
  console.log(`[whatsapp] gateway on http://${HOST}:${PORT}`)
  if (HOST !== '127.0.0.1' && !SECRET) {
    console.warn('[whatsapp] WARNING: set WHATSAPP_GATEWAY_SECRET before exposing this host')
  }
  startWpp().catch((err) => {
    state = 'error'
    console.error('[whatsapp] failed to start WPPConnect', err)
  })
})
