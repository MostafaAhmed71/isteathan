import { type FormEvent, useEffect, useState } from 'react'
import { createManagedUser } from '../../lib/adminCreateUser'
import { supabase } from '../../lib/supabase'
import { classLabel, type Profile, type Student } from '../../lib/types'
import {
  EmptyState,
  ErrorBox,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from '../../components/ui'

interface ParentRow extends Profile {
  students?: Student[]
}

export function AdminParentsPage() {
  const [parents, setParents] = useState<ParentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    national_id: '',
    full_name: '',
    phone: '',
    email: '',
    password: '',
  })

  async function reload() {
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*, students(*, classes(*))')
      .eq('role', 'PARENT')
      .order('full_name')
    if (err) setError('تعذر تحميل أولياء الأمور.')
    else setParents((data as ParentRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void reload()
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!form.national_id || !form.full_name || form.password.length < 6) {
      setError('رقم الهوية والاسم وكلمة المرور مطلوبة.')
      return
    }

    setSubmitting(true)
    try {
      const nationalId = form.national_id.trim()
      await createManagedUser({
        role: 'PARENT',
        email: form.email.trim() || `p${nationalId}@g.com`,
        password: form.password,
        full_name: form.full_name.trim(),
        national_id: nationalId,
        phone: form.phone.trim() || null,
      })
      setForm({ national_id: '', full_name: '', phone: '', email: '', password: '' })
      setInfo('تم إنشاء ولي الأمر بنجاح.')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء الحساب.')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(p: Profile) {
    await supabase.from('profiles').update({ is_active: !p.is_active }).eq('id', p.id)
    await reload()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--color-gold)]">أولياء الأمور</h1>

      <form onSubmit={onCreate} className="grid gap-3 glass-panel glass-interactive p-4 sm:grid-cols-2">
        <TextField
          label="رقم الهوية"
          value={form.national_id}
          onChange={(e) => setForm({ ...form, national_id: e.target.value })}
          required
        />
        <TextField
          label="الاسم الكامل"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          required
        />
        <TextField
          label="الجوال"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <TextField
          label="اسم الدخول (اختياري — يُجهَّز تلقائيًا)"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder={form.national_id ? `p${form.national_id.trim()}@g.com` : 'يظهر بعد إدخال الهوية'}
        />
        <TextField
          label="كلمة المرور"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <div className="flex items-end">
          <PrimaryButton type="submit" full disabled={submitting}>
            {submitting ? 'جاري الإنشاء...' : 'إنشاء حساب ولي أمر'}
          </PrimaryButton>
        </div>
        <div className="sm:col-span-2 space-y-2">
          <ErrorBox message={error} />
          {info ? <p className="text-sm text-[var(--color-gold-soft)]">{info}</p> : null}
        </div>
      </form>

      {loading ? <p className="text-[var(--color-muted)]">جاري التحميل...</p> : null}
      {!loading && parents.length === 0 ? <EmptyState>لا يوجد أولياء أمور.</EmptyState> : null}

      <div className="space-y-3">
        {parents.map((p) => (
          <article key={p.id} className="glass-panel glass-interactive p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-bold">
                  {p.full_name} {!p.is_active ? '(غير نشط)' : ''}
                </h2>
                <p className="text-sm text-[var(--color-muted)]">
                  {p.national_id} {p.phone ? `— ${p.phone}` : ''}
                </p>
                <p className="mt-2 text-sm text-[var(--color-muted)]">الأبناء:</p>
                <ul className="mt-1 list-inside list-disc text-sm text-[var(--color-text)]">
                  {(p.students ?? []).length === 0 ? <li>لا يوجد</li> : null}
                  {(p.students ?? []).map((s) => (
                    <li key={s.id}>
                      {s.full_name} — {classLabel(s.grade, s.classes?.section ?? '')}
                    </li>
                  ))}
                </ul>
              </div>
              <SecondaryButton type="button" onClick={() => void toggleActive(p)}>
                {p.is_active ? 'تعطيل' : 'تفعيل'}
              </SecondaryButton>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
