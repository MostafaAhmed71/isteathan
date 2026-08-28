import { type FormEvent, useEffect, useState } from 'react'
import { createManagedUser } from '../../lib/adminCreateUser'
import { deleteManagedUser } from '../../lib/adminDeleteUser'
import { supabase } from '../../lib/supabase'
import { classLabel, type Profile, type Student } from '../../lib/types'
import {
  DangerButton,
  EmptyState,
  ErrorBox,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from '../../components/ui'

interface ParentRow extends Profile {
  students?: Student[]
}

const emptyForm = {
  national_id: '',
  full_name: '',
  phone: '',
  email: '',
  password: '',
}

export function AdminParentsPage() {
  const [parents, setParents] = useState<ParentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ParentRow | null>(null)
  const [form, setForm] = useState(emptyForm)

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

  function startCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setInfo('')
  }

  function startEdit(p: ParentRow) {
    setEditing(p)
    setForm({
      national_id: p.national_id ?? '',
      full_name: p.full_name,
      phone: p.phone ?? '',
      email: '',
      password: '',
    })
    setError('')
    setInfo('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')

    const nationalId = form.national_id.trim()
    const fullName = form.full_name.trim()
    const phone = form.phone.trim() || null

    if (!nationalId || !fullName) {
      setError('رقم الهوية والاسم مطلوبان.')
      return
    }
    if (!/^\d{10}$/.test(nationalId)) {
      setError('رقم الهوية يجب أن يكون 10 أرقام.')
      return
    }

    if (editing) {
      setSubmitting(true)
      try {
        const { error: err } = await supabase
          .from('profiles')
          .update({
            full_name: fullName,
            national_id: nationalId,
            phone,
          })
          .eq('id', editing.id)
          .eq('role', 'PARENT')
        if (err) {
            if (err.code === '23505') {
              throw new Error('رقم الهوية مسجّل مسبقًا لولي أمر آخر.')
            }
            throw new Error('تعذر حفظ التعديلات.')
          }
          startCreate()
          setInfo(`تم تحديث بيانات «${fullName}».`)
          await reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذر حفظ التعديلات.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (form.password.length < 6) {
      setError('رقم الهوية والاسم وكلمة المرور مطلوبة.')
      return
    }

    setSubmitting(true)
    try {
      await createManagedUser({
        role: 'PARENT',
        email: form.email.trim() || `p${nationalId}@g.com`,
        password: form.password,
        full_name: fullName,
        national_id: nationalId,
        phone,
      })
      startCreate()
      setInfo('تم إنشاء ولي الأمر بنجاح.')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء الحساب.')
    } finally {
      setSubmitting(false)
    }
  }

  async function removeParent(p: ParentRow) {
    setError('')
    setInfo('')
    const kids = (p.students ?? []).length
    const kidsNote =
      kids > 0
        ? `\nسيُفك ربط ${kids} من الأبناء ويُحذف طلبات الخروج المرتبطة بالحساب.`
        : ''
    if (
      !window.confirm(
        `حذف ولي الأمر «${p.full_name}» نهائيًا؟ لا يمكن التراجع.${kidsNote}`,
      )
    ) {
      return
    }

    setDeletingId(p.id)
    try {
      const result = await deleteManagedUser(p.id)
      if (result.failures.length) {
        setError(result.failures.map((f) => f.error).join(' · '))
      } else {
        setInfo(`تم حذف حساب «${p.full_name}».`)
        if (editing?.id === p.id) startCreate()
      }
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف الحساب.')
    } finally {
      setDeletingId(null)
    }
  }

  const busy = submitting || deletingId !== null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--color-gold)]">أولياء الأمور</h1>
        {editing ? (
          <SecondaryButton type="button" disabled={busy} onClick={startCreate}>
            ولي أمر جديد
          </SecondaryButton>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 glass-panel glass-interactive p-4 sm:grid-cols-2">
        <p className="sm:col-span-2 text-sm font-bold text-[var(--color-gold)]">
          {editing ? `تعديل: ${editing.full_name}` : 'إنشاء حساب ولي أمر'}
        </p>
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
        {editing ? null : (
          <>
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
          </>
        )}
        <div className="flex items-end gap-2">
          <PrimaryButton type="submit" full disabled={busy}>
            {submitting
              ? editing
                ? 'جاري الحفظ...'
                : 'جاري الإنشاء...'
              : editing
                ? 'حفظ التعديلات'
                : 'إنشاء حساب ولي أمر'}
          </PrimaryButton>
        </div>
        {editing ? (
          <div className="flex items-end">
            <SecondaryButton type="button" full disabled={busy} onClick={startCreate}>
              إلغاء
            </SecondaryButton>
          </div>
        ) : null}
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
                <h2 className="font-bold">{p.full_name}</h2>
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
              <div className="flex gap-2">
                <SecondaryButton
                  type="button"
                  disabled={busy}
                  onClick={() => startEdit(p)}
                >
                  تعديل
                </SecondaryButton>
                <DangerButton
                  type="button"
                  disabled={busy}
                  onClick={() => void removeParent(p)}
                >
                  {deletingId === p.id ? 'جاري الحذف...' : 'حذف'}
                </DangerButton>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
