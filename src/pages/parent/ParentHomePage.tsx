import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RequestStatusTracker } from '../../components/RequestStatusTracker'
import {
  EmptyState,
  ErrorBox,
  PageShell,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { getNotificationPermission, permissionHelpMessage } from '../../lib/notify'
import { enableParentPushNotifications, notifyStaffOfNewRequest } from '../../lib/push'
import { supabase } from '../../lib/supabase'
import { classLabel, type PermissionRequest, type Student } from '../../lib/types'

export function ParentHomePage() {
  const { profile, signOut } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [latestByStudent, setLatestByStudent] = useState<Record<string, PermissionRequest>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [linkId, setLinkId] = useState('')
  const [linkError, setLinkError] = useState('')
  const [linkInfo, setLinkInfo] = useState('')
  const [linking, setLinking] = useState(false)
  const [confirmStudent, setConfirmStudent] = useState<Student | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [requestInfo, setRequestInfo] = useState('')
  const [requestError, setRequestError] = useState('')
  const [notifyReady, setNotifyReady] = useState(false)
  const [notifyHint, setNotifyHint] = useState('')
  const [showLinkForm, setShowLinkForm] = useState(false)

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
      const p = getNotificationPermission()
      if (p === 'denied' || p === 'insecure') {
        setNotifyHint(permissionHelpMessage(p))
      }
      if (p === 'granted' && 'serviceWorker' in navigator) {
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

  async function onLink(e: FormEvent) {
    e.preventDefault()
    setLinkError('')
    setLinkInfo('')
    const nid = linkId.trim()
    if (!nid) {
      setLinkError('أدخل رقم هوية الطالب.')
      return
    }
    setLinking(true)
    const { data, error: err } = await supabase.rpc('link_student_by_national_id', {
      p_national_id: nid,
    })
    setLinking(false)
    if (err) {
      const msg = err.message
      if (msg.includes('لا يوجد طالب')) setLinkError(msg)
      else if (msg.includes('مرتبط')) setLinkError(msg)
      else setLinkError('تعذر ربط الطالب. تحقق من رقم الهوية.')
      return
    }
    setLinkId('')
    setLinkInfo(`تم ربط الطالب: ${(data as Student)?.full_name ?? ''}`)
    setShowLinkForm(false)
    await load()
  }

  async function sendRequest(student: Student) {
    setRequestError('')
    setRequestInfo('')
    setSendingId(student.id)
    const { data, error: err } = await supabase.rpc('create_permission_request', {
      p_student_id: student.id,
      p_reason: null,
    })
    setSendingId(null)
    setConfirmStudent(null)
    if (err) {
      setRequestError(
        err.message.includes('قيد الانتظار')
          ? 'يوجد بالفعل طلب استئذان قيد الانتظار لهذا الطالب.'
          : 'حدث خطأ أثناء إرسال الطلب.',
      )
      return
    }
    const requestId = (data as { id?: string } | null)?.id
    if (requestId) {
      void notifyStaffOfNewRequest(requestId)
    }
    setRequestInfo(`تم إرسال طلب استئذان لـ ${student.full_name} بنجاح. الحالة: قيد الانتظار.`)
    await load()
  }

  return (
    <PageShell
      title={`مرحبًا، ${profile?.full_name ?? ''}`}
      subtitle="أبناؤك وطلبات الاستئذان"
      actions={
        <div className="flex shrink-0 gap-2">
          <Link to="/parent/requests">
            <SecondaryButton type="button">سجل الطلبات</SecondaryButton>
          </Link>
          <SecondaryButton type="button" onClick={() => void signOut()}>
            خروج
          </SecondaryButton>
        </div>
      }
    >
      {/* Status messages first */}
      <div className="mb-4 space-y-2">
        <ErrorBox message={requestError || error} />
        {requestInfo ? <p className="text-sm text-[var(--color-gold-soft)]">{requestInfo}</p> : null}
        {linkInfo && !showLinkForm ? (
          <p className="text-sm text-[var(--color-gold-soft)]">{linkInfo}</p>
        ) : null}
        {notifyHint ? <p className="text-sm text-[var(--color-gold-soft)]">{notifyHint}</p> : null}
      </div>

      {/* Secondary actions — full width on mobile */}
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
        <SecondaryButton
          type="button"
          full
          onClick={() => {
            setShowLinkForm((open) => !open)
            setLinkError('')
            if (showLinkForm) setLinkInfo('')
          }}
        >
          {showLinkForm ? 'إغلاق الربط' : 'ربط ابن برقم الهوية'}
        </SecondaryButton>
      </div>

      {showLinkForm ? (
        <form onSubmit={onLink} className="mb-6 glass-panel p-4">
          <h2 className="mb-1 font-bold text-[var(--color-text)]">ربط ابن</h2>
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
              {linking ? 'جاري الربط...' : 'ربط الطالب'}
            </PrimaryButton>
            <ErrorBox message={linkError} />
          </div>
        </form>
      ) : null}

      {loading ? <p className="text-[var(--color-muted)]">جاري التحميل...</p> : null}

      {!loading && !error && students.length === 0 ? (
        <EmptyState>
          لا يوجد أبناء مرتبطون بهذا الحساب.
          <br />
          اضغط «ربط ابن برقم الهوية» أعلاه للبدء.
        </EmptyState>
      ) : null}

      <div className="grid gap-4">
        {students.map((s) => {
          const latest = latestByStudent[s.id]
          const pending = latest?.status === 'PENDING'
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

              {confirmStudent?.id === s.id ? (
                <div className="space-y-3 rounded-xl border border-[rgba(212,175,55,0.5)] p-3">
                  <p className="font-medium text-[var(--color-text)]">
                    تأكيد إرسال طلب استئذان لـ {s.full_name}؟
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <SecondaryButton type="button" full onClick={() => setConfirmStudent(null)}>
                      إلغاء
                    </SecondaryButton>
                    <PrimaryButton
                      type="button"
                      full
                      disabled={sendingId === s.id}
                      onClick={() => void sendRequest(s)}
                    >
                      {sendingId === s.id ? 'جاري الإرسال...' : 'تأكيد'}
                    </PrimaryButton>
                  </div>
                </div>
              ) : (
                <PrimaryButton
                  type="button"
                  full
                  className="min-h-12 text-base"
                  disabled={sendingId !== null || pending}
                  onClick={() => {
                    setRequestError('')
                    setRequestInfo('')
                    setConfirmStudent(s)
                  }}
                >
                  {pending ? 'طلب قيد المراجعة' : 'طلب استئذان'}
                </PrimaryButton>
              )}
            </article>
          )
        })}
      </div>
    </PageShell>
  )
}
