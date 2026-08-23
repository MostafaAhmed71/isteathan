#!/usr/bin/env node
/**
 * Seed demo auth users + profiles + students + sample requests.
 * Requires:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function ensureUser({ email, password, profile, classAssign }) {
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  let user = list.data.users.find((u) => u.email === email)
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) throw error
    user = data.user
  }

  const { error: upsertErr } = await admin.from('profiles').upsert({
    id: user.id,
    ...profile,
    is_active: true,
  })
  if (upsertErr) throw upsertErr

  if (classAssign) {
    await admin.from('classes').update({ staff_profile_id: null }).eq('staff_profile_id', user.id)
    const { error } = await admin
      .from('classes')
      .update({ staff_profile_id: user.id })
      .eq('grade', classAssign.grade)
      .eq('section', classAssign.section)
    if (error) throw error
  }

  return user
}

async function main() {
  const adminUser = await ensureUser({
    email: 'admin@admin.isteathan.local',
    password: 'Admin123!',
    profile: {
      full_name: 'مدير المدرسة',
      role: 'ADMIN',
      username: 'admin',
      national_id: null,
      phone: null,
    },
  })

  const staffUsers = []
  for (const s of [
    { username: 'staff3b', name: 'معلم الثالث ب', grade: 3, section: 'ب' },
    { username: 'staff5a', name: 'معلم الخامس أ', grade: 5, section: 'أ' },
    { username: 'staff1a', name: 'معلم الأول أ', grade: 1, section: 'أ' },
  ]) {
    staffUsers.push(
      await ensureUser({
        email: `${s.username}@staff.isteathan.local`,
        password: 'Staff123!',
        profile: {
          full_name: s.name,
          role: 'CLASS_STAFF',
          username: s.username,
          national_id: null,
          phone: null,
        },
        classAssign: { grade: s.grade, section: s.section },
      }),
    )
  }

  const parent1 = await ensureUser({
    email: '1000000001@parent.isteathan.local',
    password: 'Parent123!',
    profile: {
      full_name: 'محمد أحمد',
      role: 'PARENT',
      national_id: '1000000001',
      username: null,
      phone: '0500000001',
    },
  })

  const parent2 = await ensureUser({
    email: '1000000002@parent.isteathan.local',
    password: 'Parent123!',
    profile: {
      full_name: 'سارة علي',
      role: 'PARENT',
      national_id: '1000000002',
      username: null,
      phone: '0500000002',
    },
  })

  const { data: classes, error: classErr } = await admin.from('classes').select('*')
  if (classErr) throw classErr
  const findClass = (grade, section) => classes.find((c) => c.grade === grade && c.section === section)

  const studentDefs = [
    { national_id: '2000000001', full_name: 'أحمد محمد', grade: 3, section: 'ب', guardian_id: parent1.id },
    { national_id: '2000000002', full_name: 'خالد محمد', grade: 5, section: 'أ', guardian_id: parent1.id },
    { national_id: '2000000003', full_name: 'نورة سارة', grade: 1, section: 'أ', guardian_id: parent2.id },
  ]

  for (const s of studentDefs) {
    const c = findClass(s.grade, s.section)
    if (!c) throw new Error(`Missing class ${s.grade}${s.section}`)
    const { error } = await admin.from('students').upsert(
      {
        national_id: s.national_id,
        full_name: s.full_name,
        grade: s.grade,
        class_id: c.id,
        guardian_id: s.guardian_id,
        is_active: true,
      },
      { onConflict: 'national_id' },
    )
    if (error) throw error
  }

  const { data: students } = await admin.from('students').select('*')
  const ahmed = students.find((s) => s.national_id === '2000000001')
  const khaled = students.find((s) => s.national_id === '2000000002')
  const noura = students.find((s) => s.national_id === '2000000003')

  // Clear demo requests then insert samples
  await admin.from('permission_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const samples = [
    {
      student_id: ahmed.id,
      guardian_id: parent1.id,
      class_id: ahmed.class_id,
      reason: 'موعد طبي',
      status: 'PENDING',
    },
    {
      student_id: khaled.id,
      guardian_id: parent1.id,
      class_id: khaled.class_id,
      reason: 'ظرف عائلي',
      status: 'APPROVED',
      decided_at: new Date().toISOString(),
      decided_by: staffUsers[1].id,
    },
    {
      student_id: noura.id,
      guardian_id: parent2.id,
      class_id: noura.class_id,
      reason: 'مراجعة',
      status: 'REJECTED',
      rejection_reason: 'الطلب خارج وقت الدوام',
      decided_at: new Date().toISOString(),
      decided_by: staffUsers[2].id,
    },
  ]

  const { error: reqErr } = await admin.from('permission_requests').insert(samples)
  if (reqErr) throw reqErr

  console.log('Seed complete.')
  console.log('Admin: username=admin / Admin123!')
  console.log('Staff: staff3b|staff5a|staff1a / Staff123!')
  console.log('Parent: national_id=1000000001 or 1000000002 / Parent123!')
  console.log('Admin user id:', adminUser.id)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
