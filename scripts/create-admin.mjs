#!/usr/bin/env node
/**
 * Create the first admin: admin@gmail.com / admin123
 * Uses anon key + Auth signUp, then bootstrap_admin_profile RPC.
 *
 * Prerequisite: migrations 001–004 applied.
 * In Supabase Auth settings, disable "Confirm email" for local/dev.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
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
const anon = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const EMAIL = process.env.ADMIN_EMAIL || 'admin@gmail.com'
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

async function viaServiceRole() {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  let user = listed.data.users.find((u) => u.email === EMAIL)
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    })
    if (error) throw error
    user = data.user
  } else {
    await admin.auth.admin.updateUserById(user.id, { password: PASSWORD, email_confirm: true })
  }
  const { error } = await admin.from('profiles').upsert({
    id: user.id,
    full_name: 'مدير النظام',
    role: 'ADMIN',
    username: 'admin',
    national_id: null,
    phone: null,
    is_active: true,
  })
  if (error) throw error
  console.log('Admin ready via service role:', EMAIL)
}

async function viaSignUp() {
  const client = createClient(url, anon)
  const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })

  let userId = signInData.user?.id
  if (signInErr || !userId) {
    const { data, error } = await client.auth.signUp({ email: EMAIL, password: PASSWORD })
    if (error) throw error
    userId = data.user?.id
    if (!data.session) {
      console.error(
        'User created but no session (email confirmation may be enabled). Disable Confirm email, then rerun.',
      )
      process.exit(1)
    }
  }

  const { error: bootErr } = await client.rpc('bootstrap_admin_profile', {
    p_full_name: 'مدير النظام',
  })
  if (bootErr) {
    // Maybe already admin — try upsert profile if service unavailable
    const { data: existing } = await client.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (existing?.role === 'ADMIN') {
      console.log('Admin already configured:', EMAIL)
      return
    }
    throw bootErr
  }
  console.log('Admin ready:', EMAIL, '/', PASSWORD)
}

async function main() {
  if (serviceKey) {
    await viaServiceRole()
  } else {
    await viaSignUp()
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
