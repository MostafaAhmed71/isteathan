import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { createManagedUser } from '../../lib/adminCreateUser'
import { deleteAllClassStaff, deleteManagedUser } from '../../lib/adminDeleteUser'
import {
  CLASS_DEFAULT_PASSWORD,
  classStaffIndex,
  classStaffLogin,
  classStaffName,
  copyText,
  loginFromUsername,
  sortClasses,
} from '../../lib/classStaff'
import { supabase } from '../../lib/supabase'
import { classLabel, type Profile, type SchoolClass } from '../../lib/types'
import {
  DangerButton,
  EmptyState,
  ErrorBox,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  TextField,
} from '../../components/ui'

export function AdminStaffPage() {
  const [staff, setStaff] = useState<Profile[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [copied, setCopied] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    password: CLASS_DEFAULT_PASSWORD,
    class_id: '',
  })

  async function reload() {
    const [s, c] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'CLASS_STAFF').order('full_name'),
      supabase.from('classes').select('*').order('grade').order('section'),
    ])
    setStaff((s.data as Profile[]) ?? [])
    setClasses((c.data as SchoolClass[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void reload()
  }, [])

  const preview = useMemo(() => {
    if (!form.class_id) return null
    const selected = classes.find((c) => c.id === form.class_id)
    if (!selected) return null
    const index = classStaffIndex(classes, form.class_id)
    if (index < 1) return null
    const login = classStaffLogin(index)
    return {
      className: classLabel(selected.grade, selected.section),
      fullName: form.full_name.trim() || classStaffName(selected.grade, selected.section),
      ...login,
      password: form.password || CLASS_DEFAULT_PASSWORD,
    }
  }, [classes, form.class_id, form.full_name, form.password])

  function onPickClass(classId: string) {
    const selected = classes.find((c) => c.id === classId)
    setForm((prev) => ({
      ...prev,
      class_id: classId,
      full_name: selected ? classStaffName(selected.grade, selected.section) : prev.full_name,
      password: prev.password || CLASS_DEFAULT_PASSWORD,
    }))
  }

  async function copyValue(label: string, value: string) {
    const ok = await copyText(value)
    setCopied(ok ? label : '')
    if (ok) window.setTimeout(() => setCopied(''), 1600)
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!form.class_id || !preview) {
      setError('اختر الفصل أولاً، وسنجهّز بيانات الدخول تلقائيًا.')
      return
    }
    if (preview.password.length < 6) {
      setError('كلمة المرور يجب ألا تقل عن 6 أحرف.')
      return
    }

    setSubmitting(true)
    try {
      await createManagedUser({
        role: 'CLASS_STAFF',
        email: preview.email,
        username: preview.username,
        full_name: preview.fullName,
        password: preview.password,
        class_id: form.class_id,
      })
      setForm({ full_name: '', password: CLASS_DEFAULT_PASSWORD, class_id: '' })
      setInfo(
        `تم إنشاء الحساب. أعطِ المشرف: اسم الدخول ${preview.email} و كلمة المرور ${preview.password}`,
      )
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء حساب الفصل.')
    } finally {
      setSubmitting(false)
    }
  }

  async function createMissingClassAccounts() {
    setError('')
    setInfo('')
    const missing = classes.filter((c) => !c.staff_profile_id)
    if (missing.length === 0) {
      setInfo('كل الفصول لديها حسابات بالفعل.')
      return
    }
    if (
      !window.confirm(
        `سيتم إنشاء ${missing.length} حسابًا تلقائيًا.\nكلمة المرور لكل الحسابات: ${CLASS_DEFAULT_PASSWORD}\nالمتابعة؟`,
      )
    ) {
      return
    }

    setSubmitting(true)
    let ok = 0
    const failures: string[] = []
    try {
      const ordered = sortClasses(classes)
      for (let i = 0; i < ordered.length; i++) {
        const c = ordered[i]
        if (c.staff_profile_id) continue
        const login = classStaffLogin(i + 1)
        try {
          await createManagedUser({
            role: 'CLASS_STAFF',
            email: login.email,
            username: login.username,
            full_name: classStaffName(c.grade, c.section),
            password: CLASS_DEFAULT_PASSWORD,
            class_id: c.id,
          })
          ok += 1
        } catch (err) {
          failures.push(
            `${classLabel(c.grade, c.section)}: ${err instanceof Error ? err.message : 'فشل'}`,
          )
        }
      }
      await reload()
      setInfo(
        `تم إنشاء ${ok} من ${missing.length} حسابًا. كلمة المرور الموحدة: ${CLASS_DEFAULT_PASSWORD}` +
          (failures.length ? ` · تعذر إنشاء بعضها` : ''),
      )
      if (failures.length) setError(failures.slice(0, 4).join(' · '))
    } finally {
      setSubmitting(false)
    }
  }

  async function onDeleteOne(p: Profile) {
    setError('')
    setInfo('')
    if (
      !window.confirm(
        `حذف حساب «${p.full_name}» نهائيًا؟\nلن يتمكن من تسجيل الدخول بعد ذلك.`,
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

  async function onDeleteAll() {
    setError('')
    setInfo('')
    if (staff.length === 0) {
      setInfo('لا توجد حسابات فصول لحذفها.')
      return
    }
    if (
      !window.confirm(
        `سيتم حذف كل حسابات الفصول (${staff.length}).\nهذا الإجراء لا يمكن التراجع عنه.\nالمتابعة؟`,
      )
    ) {
      return
    }
    if (!window.confirm('تأكيد أخير: حذف جميع حسابات الفصول؟')) {
      return
    }

    setSubmitting(true)
    try {
      const result = await deleteAllClassStaff()
      setInfo(`تم حذف ${result.deleted_count} حسابًا.`)
      if (result.failures.length) {
        setError(result.failures.slice(0, 5).map((f) => f.error).join(' · '))
      }
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف الحسابات.')
    } finally {
      setSubmitting(false)
    }
  }

  async function assignClass(staffId: string, classId: string) {
    if (classId) {
      await supabase.from('classes').update({ staff_profile_id: null }).eq('staff_profile_id', staffId)
      await supabase.from('classes').update({ staff_profile_id: staffId }).eq('id', classId)
    } else {
      await supabase.from('classes').update({ staff_profile_id: null }).eq('staff_profile_id', staffId)
    }
    await reload()
  }

  async function toggleActive(p: Profile) {
    await supabase.from('profiles').update({ is_active: !p.is_active }).eq('id', p.id)
    await reload()
  }

  function classForStaff(staffId: string) {
    return classes.find((c) => c.staff_profile_id === staffId)
  }

  const busy = submitting || deletingId !== null

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--color-gold)]">حسابات الفصول</h1>
      <p className="text-[var(--color-muted)]">
        اختر الفصل فقط. المنصة تجهّز اسم الدخول وكلمة المرور تلقائيًا، ثم انسخهما وأعطهما لمشرف
        الفصل.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <SecondaryButton
          type="button"
          disabled={busy || loading}
          onClick={() => void createMissingClassAccounts()}
        >
          إنشاء حسابات لكل الفصول
        </SecondaryButton>
        <DangerButton type="button" disabled={busy || loading} onClick={() => void onDeleteAll()}>
          {submitting ? 'جاري التنفيذ...' : `حذف الكل (${staff.length})`}
        </DangerButton>
      </div>

      <form onSubmit={onCreate} className="grid gap-3 glass-panel glass-interactive p-4 sm:grid-cols-2">
        <SelectField
          label="1) اختر الفصل"
          value={form.class_id}
          onChange={(e) => onPickClass(e.target.value)}
          required
        >
          <option value="">اختر الفصل</option>
          {sortClasses(classes).map((c) => (
            <option key={c.id} value={c.id}>
              {classLabel(c.grade, c.section)}
              {c.staff_profile_id ? ' — لديه حساب' : ''}
            </option>
          ))}
        </SelectField>
        <TextField
          label="2) اسم المشرف (اختياري)"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          placeholder="يُملأ تلقائيًا بعد اختيار الفصل"
        />
        <TextField
          label="3) كلمة المرور"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <div className="rounded-xl border border-[rgba(212,175,55,0.4)] p-3 sm:col-span-1">
          <p className="mb-2 text-sm font-bold text-[var(--color-gold)]">بيانات الدخول الجاهزة</p>
          {preview ? (
            <div className="space-y-2 text-sm">
              <p>
                الفصل: <strong>{preview.className}</strong>
              </p>
              <p>
                اسم الدخول:{' '}
                <strong dir="ltr" className="inline-block">
                  {preview.email}
                </strong>
              </p>
              <p>
                كلمة المرور: <strong dir="ltr">{preview.password}</strong>
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <SecondaryButton
                  type="button"
                  onClick={() => void copyValue('login', preview.email)}
                >
                  {copied === 'login' ? 'تم النسخ' : 'نسخ اسم الدخول'}
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  onClick={() => void copyValue('password', preview.password)}
                >
                  {copied === 'password' ? 'تم النسخ' : 'نسخ كلمة المرور'}
                </SecondaryButton>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">اختر الفصل لتظهر بيانات الدخول.</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <PrimaryButton type="submit" disabled={busy || !preview}>
            {submitting ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
          </PrimaryButton>
        </div>
        <div className="sm:col-span-2 space-y-2">
          <ErrorBox message={error} />
          {info ? <p className="text-sm text-[var(--color-gold-soft)]">{info}</p> : null}
        </div>
      </form>

      {loading ? <p className="text-[var(--color-muted)]">جاري التحميل...</p> : null}
      {!loading && staff.length === 0 ? <EmptyState>لا توجد حسابات فصول بعد.</EmptyState> : null}

      <div className="space-y-3">
        {staff.map((s) => {
          const assigned = classForStaff(s.id)
          const login = loginFromUsername(s.username)
          return (
            <article key={s.id} className="glass-panel glass-interactive p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-56 flex-1">
                  <h2 className="font-bold">
                    {s.full_name} {!s.is_active ? '(غير نشط)' : ''}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    اسم الدخول:{' '}
                    <span dir="ltr" className="text-[var(--color-text)]">
                      {login || 'غير محدد'}
                    </span>
                  </p>
                  <div className="mt-3">
                    <SelectField
                      label="الفصل المعين"
                      value={assigned?.id ?? ''}
                      onChange={(e) => void assignClass(s.id, e.target.value)}
                    >
                      <option value="">بدون</option>
                      {sortClasses(classes).map((c) => (
                        <option key={c.id} value={c.id}>
                          {classLabel(c.grade, c.section)}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {login ? (
                    <SecondaryButton
                      type="button"
                      disabled={busy}
                      onClick={() => void copyValue(s.id, login)}
                    >
                      {copied === s.id ? 'تم النسخ' : 'نسخ اسم الدخول'}
                    </SecondaryButton>
                  ) : null}
                  <SecondaryButton type="button" disabled={busy} onClick={() => void toggleActive(s)}>
                    {s.is_active ? 'تعطيل' : 'تفعيل'}
                  </SecondaryButton>
                  <DangerButton type="button" disabled={busy} onClick={() => void onDeleteOne(s)}>
                    {deletingId === s.id ? 'جاري الحذف...' : 'حذف'}
                  </DangerButton>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
