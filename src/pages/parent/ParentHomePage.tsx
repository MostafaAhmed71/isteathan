import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RequestStatusTracker } from '../../components/RequestStatusTracker'
import {
  EmptyState,
  ErrorBox,
  PageShell,
  PrimaryButton,
  SecondaryButton,
} from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { getNotificationPermission, permissionHelpMessage } from '../../lib/notify'
import { isNativeApp } from '../../lib/native'
import { enableParentPushNotifications, notifyStaffOfNewRequest } from '../../lib/push'
import {
  REQUEST_TIME_WINDOW_ENABLED,
  canSubmitRequest,
  isRequestWindowError,
  requestWindowLabel,
  requestWindowMessage,
} from '../../lib/requestWindow'
import { supabase } from '../../lib/supabase'
import { classLabel, type PermissionRequest, type Student } from '../../lib/types'

export function ParentHomePage() {
  const { profile } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [latestByStudent, setLatestByStudent] = useState<Record<string, PermissionRequest>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [requestInfo, setRequestInfo] = useState('')
  const [requestError, setRequestError] = useState('')
  const [notifyReady, setNotifyReady] = useState(false)
  const [notifyHint, setNotifyHint] = useState('')
  const [now, setNow] = useState(() => new Date())

  const load = useCallback(async () => {
    setLoading(true)
    const [studentsRes, requestsRes] = await Promise.all([
      supabase.from('students').select('*, classes(*)').eq('is_active', true).order('full_name'),
      profile
        ? supabase
            .from('permission_requests')
            .select('*')
            .eq('guardian_id', profile.id)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: null, error: null }),
    ])

    if (studentsRes.error) setError('تعذر تحميل البيانات، حاول مرة أخرى.')
    else {
      setError('')
      setStudents((studentsRes.data as Student[]) ?? [])
    }

    const map: Record<string, PermissionRequest> = {}
    for (const row of (requestsRes.data as PermissionRequest[] | null) ?? []) {
      if (!map[row.student_id]) map[row.student_id] = row
    }
    setLatestByStudent(map)
    setLoading(false)
  }, [profile])

  useEffect(() => {
    void load()
    void (async () => {
      const p = await getNotificationPermission()
      if (p === 'denied' || p === 'insecure') {
        setNotifyHint(permissionHelpMessage(p))
      }
      if (p !== 'granted') return
      if (isNativeApp()) {
        setNotifyReady(true)
        return
      }
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready
          const sub = await reg.pushManager.getSubscription()
          setNotifyReady(Boolean(sub))
        } catch {
          setNotifyReady(false)
        }
      }
    })()
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel(`parent-home-requests-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'permission_requests',
          filter: `guardian_id=eq.${profile.id}`,
        },
        () => {
          void load()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [profile, load])

  async function enableNotifications() {
    const result = await enableParentPushNotifications()
    setNotifyReady(result.subscribed)
    setNotifyHint(result.message)
    if (result.message.includes('أعد تحميل الصفحة')) {
      window.setTimeout(() => window.location.reload(), 700)
    }
  }

  async function sendRequest(student: Student) {
    setRequestError('')
    setRequestInfo('')
    const grade = student.classes?.grade ?? student.grade
    if (!canSubmitRequest(grade, new Date())) {
      setRequestError(requestWindowMessage(grade) ?? 'لم يحن وقت تقديم الطلبات بعد.')
      return
    }
    setSendingId(student.id)
    const { data, error: err } = await supabase.rpc('create_permission_request', {
      p_student_id: student.id,
      p_reason: null,
    })
    setSendingId(null)
    if (err) {
      setRequestError(
        err.message.includes('قيد الانتظار')
          ? 'يوجد بالفعل طلب خروج قيد الانتظار لهذا الطالب.'
          : isRequestWindowError(err.message)
            ? err.message
            : 'حدث خطأ أثناء إرسال الطلب.',
      )
      return
    }
    const requestId = (data as { id?: string } | null)?.id
    if (requestId) {
      void notifyStaffOfNewRequest(requestId)
    }
    setRequestInfo(`تم إرسال الطلب بنجاح لـ ${student.full_name}.`)
    await load()
  }

  return (
    <PageShell title={`مرحبًا، ${profile?.full_name ?? ''}`} subtitle="أرسل طلب خروج لأبنائك">
      <div className="mb-4 space-y-2">
        <ErrorBox message={requestError || error} />
        {requestInfo ? <p className="text-sm text-[var(--color-gold-soft)]">{requestInfo}</p> : null}
        {notifyHint ? <p className="text-sm text-[var(--color-gold-soft)]">{notifyHint}</p> : null}
        {REQUEST_TIME_WINDOW_ENABLED ? (
          <p className="rounded-xl border border-[rgba(212,175,55,0.35)] px-3 py-2 text-sm text-[var(--color-muted)]">
            مواعيد تقديم الطلبات (توقيت الرياض): الصفوف الأولية من 11:10 ص حتى 12:30 م، والصفوف العليا
            من 11:40 ص حتى 12:30 م.
          </p>
        ) : null}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {!notifyReady ? (
          <SecondaryButton type="button" full onClick={() => void enableNotifications()}>
            تفعيل الإشعارات
          </SecondaryButton>
        ) : (
          <div className="flex min-h-12 items-center justify-center rounded-[0.85rem] border border-[rgba(62,207,142,0.4)] px-4 text-sm font-semibold text-[var(--color-approved)]">
            الإشعارات مفعّلة
          </div>
        )}
        <Link to="/parent/children" className="block">
          <SecondaryButton type="button" full>
            إدارة أبنائي
          </SecondaryButton>
        </Link>
      </div>

      {loading ? <p className="text-[var(--color-muted)]">جاري التحميل...</p> : null}

      {!loading && !error && students.length === 0 ? (
        <EmptyState>
          لا يوجد أبناء مرتبطون بهذا الحساب.
          <br />
          اذهب إلى تبويب «أبنائي» لإضافة ابن برقم الهوية.
        </EmptyState>
      ) : null}

      <div className="grid gap-4">
        {students.map((s) => {
          const latest = latestByStudent[s.id]
          const pending = latest?.status === 'PENDING'
          const grade = s.classes?.grade ?? s.grade
          const windowOpen = canSubmitRequest(grade, now)
          const windowMsg = requestWindowMessage(grade, now)
          const blockedByTime = !windowOpen
          return (
            <article key={s.id} className="glass-panel p-4">
              <div className="mb-3">
                <h2 className="text-xl font-bold text-[var(--color-text)]">{s.full_name}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {s.classes
                    ? classLabel(s.classes.grade, s.classes.section)
                    : classLabel(s.grade, '')}
                  <span className="mx-2 opacity-40">·</span>
                  هوية {s.national_id}
                </p>
              </div>

              {latest ? (
                <div className="mb-4 rounded-xl border border-[rgba(212,175,55,0.35)] px-3 py-3">
                  <p className="mb-1 text-xs font-bold tracking-wide text-[var(--color-gold)]">
                    حالة آخر طلب
                  </p>
                  <RequestStatusTracker status={latest.status} compact />
                </div>
              ) : (
                <p className="mb-4 text-sm text-[var(--color-muted)]">لا يوجد طلب سابق لهذا الابن.</p>
              )}

              {blockedByTime && !pending ? (
                <p className="mb-3 text-sm text-[var(--color-gold-soft)]">{windowMsg}</p>
              ) : null}

              <PrimaryButton
                type="button"
                full
                className="min-h-12 text-base"
                disabled={sendingId !== null || pending || blockedByTime}
                onClick={() => {
                  setRequestError('')
                  setRequestInfo('')
                  void sendRequest(s)
                }}
              >
                {sendingId === s.id
                  ? 'جاري الإرسال...'
                  : pending
                    ? 'تم إرسال الطلب بنجاح'
                    : blockedByTime
                      ? `متاح ${requestWindowLabel(grade)}`
                      : 'طلب خروج'}
              </PrimaryButton>
            </article>
          )
        })}
      </div>
    </PageShell>
  )
}
