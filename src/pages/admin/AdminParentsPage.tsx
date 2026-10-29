import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { createManagedUser } from '../../lib/adminCreateUser'
import { deleteManagedUser } from '../../lib/adminDeleteUser'
import { supabase } from '../../lib/supabase'
import { classLabel, normalizeArabic, type Profile, type Student } from '../../lib/types'
import {
  DangerButton,
  EmptyState,
  ErrorBox,
  PrimaryButton,
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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
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

  const filteredParents = useMemo(() => {
    const q = normalizeArabic(searchQuery)
    if (!q) return parents
    return parents.filter((p) => {
      const nameMatch = normalizeArabic(p.full_name).includes(q)
      const nationalIdMatch = (p.national_id || '').includes(searchQuery.trim())
      const phoneMatch = (p.phone || '').includes(searchQuery.trim())
      const childMatch = (p.students || []).some(
        (s) =>
          normalizeArabic(s.full_name).includes(q) ||
          (s.national_id || '').includes(searchQuery.trim()),
      )
      return nameMatch || nationalIdMatch || phoneMatch || childMatch
    })
  }, [parents, searchQuery])

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

  async function removeParent(p: ParentRow) {
    setError('')
    setInfo('')
    const kids = (p.students ?? []).length
    const kidsNote =
      kids > 0
        ? `\nسيُفك ربط ${kids} من الأبناء ويُحذف طلبات الاستئذان المرتبطة بالحساب.`
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
          <PrimaryButton type="submit" full disabled={busy}>
            {submitting ? 'جاري الإنشاء...' : 'إنشاء حساب ولي أمر'}
          </PrimaryButton>
        </div>
        <div className="sm:col-span-2 space-y-2">
          <ErrorBox message={error} />
          {info ? <p className="text-sm text-[var(--color-gold-soft)]">{info}</p> : null}
        </div>
      </form>

      {/* قسم البحث لأولياء الأمور */}
      <div className="glass-panel p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(212,175,55,0.2)] pb-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-[var(--color-gold)]">قائمة أولياء الأمور</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[rgba(212,175,55,0.15)] text-[var(--color-gold)]">
              {filteredParents.length} {filteredParents.length !== parents.length ? `من أصل ${parents.length}` : 'ولي أمر'}
            </span>
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-[var(--color-gold-soft)] hover:underline cursor-pointer"
            >
              مسح البحث
            </button>
          )}
        </div>

        <div>
          <TextField
            label="بحث باسم ولي الأمر أو رقم الهوية أو الجوال أو اسم الطالب"
            placeholder="اكتب اسم ولي الأمر للبحث..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? <p className="text-[var(--color-muted)]">جاري التحميل...</p> : null}
      {!loading && parents.length === 0 ? <EmptyState>لا يوجد أولياء أمور مضافون بعد.</EmptyState> : null}
      {!loading && parents.length > 0 && filteredParents.length === 0 ? (
        <EmptyState>لا يوجد أولياء أمور مطابقون للبحث «{searchQuery}»</EmptyState>
      ) : null}

      <div className="space-y-3">
        {filteredParents.map((p) => (
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
              <DangerButton
                type="button"
                disabled={busy}
                onClick={() => void removeParent(p)}
              >
                {deletingId === p.id ? 'جاري الحذف...' : 'حذف'}
              </DangerButton>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
