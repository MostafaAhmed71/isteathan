#!/usr/bin/env node
/**
 * Create duty officer accounts (مناوب).
 * Default: p1@g.com / p123456
 *
 * Usage:
 *   node scripts/create-duty.mjs
 *   node scripts/create-duty.mjs p1 p2 p3
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const envPath = resolve(root, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    const val = m[2].trim()
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD = process.env.DUTY_PASSWORD || 'p123456'
const names = process.argv.slice(2)
const codes = names.length ? names : ['p1']

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function ensureDuty(code) {
  const email = code.includes('@') ? code : `${code}@g.com`
  const username = email.split('@')[0]
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  let user = listed.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    })
    if (error) throw error
    user = data.user
    console.log('Created auth user:', email)
  } else {
    await admin.auth.admin.updateUserById(user.id, { password: PASSWORD, email_confirm: true })
    console.log('Updated password for:', email)
  }

  const { error } = await admin.from('profiles').upsert({
    id: user.id,
    full_name: `مناوب ${username}`,
    role: 'DUTY',
    username,
    national_id: null,
    phone: null,
    is_active: true,
  })
  if (error) throw error
  console.log('Duty profile ready:', email, '/', PASSWORD)
}

for (const code of codes) {
  try {
    await ensureDuty(code)
  } catch (err) {
    console.error(code, err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}
