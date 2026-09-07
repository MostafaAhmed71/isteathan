import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  EmptyState,
  ErrorBox,
  PageShell,
  PrimaryButton,
  TextField,
} from '../../components/ui'
import { arabicNameMatches } from '../../lib/arabicSearch'
import { notifyStaffOfNewRequest } from '../../lib/push'
import { supabase } from '../../lib/supabase'
import { classLabel, type Student } from '../../lib/types'

export function DutyDeskPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error: err } = await supabase
        .from('students')
        .select('*, classes(*)')
        .eq('is_active', true)
        .order('full_name')
      if (cancelled) return
      if (err) setError('تعذر تحميل قائمة الطلاب.')
      else setStudents((data as Student[]) ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const matches = useMemo(() => {
    const q = deferredQuery.trim()
    if (!q) return []
    return students.filter((s) => arabicNameMatches(s.full_name, q)).slice(0, 40)
  }, [students, deferredQuery])

  async function sendExit(student: Student) {
    setError('')
    setInfo('')
    setBusyId(student.id)
    const { data, error: err } = await supabase.rpc('create_duty_permission_request', {
      p_student_id: student.id,
      p_reason: 'طلب خروج من المناوب',
    })
    setBusyId(null)
    if (err) {
      const msg = err.message
      if (
        msg.includes('قيد الانتظار') ||
        msg.includes('وقت') ||
        msg.includes('غير')
      ) {
        setError(msg)
      } else {
        setError('تعذر إرسال طلب الخروج. تحقق من صلاحيات المناوب.')
      }
      return
    }
    const requestId = (data as { id?: string } | null)?.id
    if (requestId) void notifyStaffOfNewRequest(requestId)
    setInfo(`تم إرسال طلب خروج لـ ${student.full_name} إلى الفصل.`)
    setQuery('')
  }

  return (
    <PageShell
      title="شاشة المناوب"
      subtitle="ابحث باسم الطالب (أو جزء منه) ثم اضغط خروج ليصل الطلب للفصل"
    >
      <div className="mb-4 space-y-2">
        <ErrorBox message={error} />
        {info ? <p className="text-sm text-[var(--color-gold-soft)]">{info}</p> : null}
      </div>

      <TextField
        label="بحث باسم الطالب"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setError('')
          setInfo('')
        }}
        placeholder="مثال: محمد أو أحمد… يراعى أ/ا و ي/ى"
        autoFocus
        autoComplete="off"
      />

      <p className="mt-2 text-xs text-[var(--color-muted)]">
        البحث يتجاهل اختلاف أ/ا/إ/آ و ي/ى وعلامات التشكيل.
      </p>

      {loading ? <p className="mt-6 text-[var(--color-muted)]">جاري تحميل الطلاب...</p> : null}

      {!loading && !deferredQuery.trim() ? (
        <div className="mt-6">
          <EmptyState>ابدأ بكتابة اسم الطالب أو جزء منه.</EmptyState>
        </div>
      ) : null}

      {!loading && deferredQuery.trim() && matches.length === 0 ? (
        <div className="mt-6">
          <EmptyState>لا توجد نتائج مطابقة.</EmptyState>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {matches.map((s) => (
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
            <PrimaryButton
              type="button"
              className="min-h-12 min-w-[8rem] text-base"
              disabled={busyId !== null}
              onClick={() => void sendExit(s)}
            >
              {busyId === s.id ? 'جاري الإرسال...' : 'خروج'}
            </PrimaryButton>
          </article>
        ))}
      </div>
    </PageShell>
  )
}
