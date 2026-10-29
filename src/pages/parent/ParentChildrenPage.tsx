import { type FormEvent, useCallback, useEffect, useState } from 'react'
import {
  DangerButton,
  EmptyState,
  ErrorBox,
  PageShell,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { classLabel, type Student } from '../../lib/types'

export function ParentChildrenPage() {
  const { profile } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [linkId, setLinkId] = useState('')
  const [linking, setLinking] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showLinkForm, setShowLinkForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('students')
      .select('*, classes(*)')
      .eq('is_active', true)
      .order('full_name')
    if (err) setError('تعذر تحميل قائمة الأبناء.')
    else {
      setError('')
      setStudents((data as Student[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onLink(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    const nid = linkId.trim()
    if (!nid) {
      setError('أدخل رقم هوية الطالب.')
      return
    }
    setLinking(true)
    const { data, error: err } = await supabase.rpc('link_student_by_national_id', {
      p_national_id: nid,
    })
    setLinking(false)
    if (err) {
      const msg = err.message
      if (msg.includes('لا يوجد طالب') || msg.includes('مرتبط') || msg.includes('غير صالح')) {
        setError(msg)
      } else {
        setError('تعذر ربط الطالب. تحقق من رقم الهوية.')
      }
      return
    }
    setLinkId('')
    setShowLinkForm(false)
    setInfo(`تم إضافة ${(data as Student)?.full_name ?? 'الطالب'} إلى أبنائك.`)
    await load()
  }

  async function onUnlink(student: Student) {
    setError('')
    setInfo('')
    if (
      !window.confirm(
        `إزالة «${student.full_name}» من قائمة أبنائك؟\nلن يُحذف من سجلات المدرسة، فقط يُفك الربط بحسابك.`,
      )
    ) {
      return
    }
    setBusyId(student.id)
    const { error: err } = await supabase.rpc('unlink_student', {
      p_student_id: student.id,
    })
    setBusyId(null)
    if (err) {
      setError(
        err.message.includes('غير مرتبط') || err.message.includes('غير موجود')
          ? err.message
          : 'تعذر فك ربط الطالب. إن استمر الخطأ نفّذ ترحيل unlink في قاعدة البيانات.',
      )
      return
    }
    setInfo(`تم إزالة «${student.full_name}» من قائمتك.`)
    await load()
  }

  return (
    <PageShell title="أبنائي" subtitle={profile?.full_name ? `حساب ${profile.full_name}` : undefined}>
      <div className="mb-4 space-y-2">
        <ErrorBox message={error} />
        {info ? <p className="text-sm text-[var(--color-gold-soft)]">{info}</p> : null}
      </div>

      <div className="mb-5">
        <SecondaryButton
          type="button"
          full
          disabled={busyId !== null || linking}
          onClick={() => {
            setShowLinkForm((open) => !open)
            setError('')
          }}
        >
          {showLinkForm ? 'إغلاق' : 'إضافة ابن برقم الهوية'}
        </SecondaryButton>
      </div>

      {showLinkForm ? (
        <form onSubmit={onLink} className="mb-6 glass-panel p-4">
          <h2 className="mb-1 font-bold text-[var(--color-text)]">إضافة ابن</h2>
          <p className="mb-4 text-sm text-[var(--color-muted)]">
            أدخل رقم هوية الطالب المسجّل لدى المدرسة.
          </p>
          <div className="space-y-3">
            <TextField
              label="رقم هوية الطالب"
              value={linkId}
              onChange={(e) => setLinkId(e.target.value)}
              inputMode="numeric"
              required
              autoFocus
            />
            <PrimaryButton type="submit" full disabled={linking}>
              {linking ? 'جاري الإضافة...' : 'إضافة'}
            </PrimaryButton>
          </div>
        </form>
      ) : null}

      {loading ? <p className="text-[var(--color-muted)]">جاري التحميل...</p> : null}

      {!loading && students.length === 0 ? (
        <EmptyState>
          لا يوجد أبناء مرتبطون بهذا الحساب.
          <br />
          اضغط «إضافة ابن برقم الهوية» للبدء.
        </EmptyState>
      ) : null}

      <div className="space-y-3">
        {students.map((s) => (
          <article
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 glass-panel p-4"
          >
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[var(--color-text)]">{s.full_name}</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {s.classes
                  ? classLabel(s.classes.grade, s.classes.section)
                  : classLabel(s.grade, '')}
                <span className="mx-2 opacity-40">·</span>
                هوية {s.national_id}
              </p>
            </div>
            <DangerButton
              type="button"
              disabled={busyId !== null}
              onClick={() => void onUnlink(s)}
            >
              {busyId === s.id ? 'جاري الإزالة...' : 'إزالة'}
            </DangerButton>
          </article>
        ))}
      </div>
    </PageShell>
  )
}
