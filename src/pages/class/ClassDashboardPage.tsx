import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Toast } from '../../components/Toast'
import { useAuth } from '../../lib/auth'
import {
  alertNewPermissionRequest,
  getNotificationPermission,
  permissionHelpMessage,
} from '../../lib/notify'
import { enableParentPushNotifications, notifyGuardianOfDecision } from '../../lib/push'
import { supabase } from '../../lib/supabase'
import {
  classLabel,
  formatDateTime,
  type PermissionRequest,
  type SchoolClass,
} from '../../lib/types'
import {
  EmptyState,
  ErrorBox,
  PageShell,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  TextArea,
} from '../../components/ui'

export function ClassDashboardPage() {
  const { profile, signOut } = useAuth()
  const [schoolClass, setSchoolClass] = useState<SchoolClass | null>(null)
  const [pending, setPending] = useState<PermissionRequest[]>([])
  const [history, setHistory] = useState<PermissionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [notifyReady, setNotifyReady] = useState(false)

  const load = useCallback(async (classId: string) => {
    const [pendingRes, historyRes] = await Promise.all([
      supabase
        .from('permission_requests')
        .select('*, students(*), profiles:guardian_id(id, full_name, phone, national_id)')
        .eq('class_id', classId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true }),
      supabase
        .from('permission_requests')
        .select('*, students(*), profiles:guardian_id(id, full_name, phone, national_id)')
        .eq('class_id', classId)
        .neq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(30),
    ])
    if (pendingRes.error || historyRes.error) {
      setError('تعذر تحميل البيانات، حاول مرة أخرى.')
      return
    }
    setPending((pendingRes.data as PermissionRequest[]) ?? [])
    setHistory((historyRes.data as PermissionRequest[]) ?? [])
    setError('')
  }, [])

  async function enableNotifications() {
    const result = await enableParentPushNotifications()
    setNotifyReady(result.subscribed)
    if (result.subscribed) {
      setToast(result.message)
      setError('')
    } else {
      setError(result.message || permissionHelpMessage(result.permission))
    }
  }

  useEffect(() => {
    setNotifyReady(getNotificationPermission() === 'granted')
  }, [])

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const { data, error: err } = await supabase
        .from('classes')
        .select('*')
        .eq('staff_profile_id', profile!.id)
        .eq('is_active', true)
        .maybeSingle()
      if (cancelled) return
      if (err || !data) {
        setError('لا يوجد فصل مرتبط بهذا الحساب.')
        setLoading(false)
        return
      }
      setSchoolClass(data as SchoolClass)
      await load(data.id)
      setLoading(false)

      channel = supabase
        .channel(`class-requests-${data.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'permission_requests',
            filter: `class_id=eq.${data.id}`,
          },
          (payload) => {
            void (async () => {
              const row = payload.new as { student_id?: string }
              let studentName = 'طالب'
              if (row.student_id) {
                const { data: student } = await supabase
                  .from('students')
                  .select('full_name')
                  .eq('id', row.student_id)
                  .maybeSingle()
                if (student?.full_name) studentName = student.full_name
              }
              alertNewPermissionRequest(studentName)
              setToast(`وصل طلب خروج جديد للطالب: ${studentName}`)
              await load(data.id)
            })()
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'permission_requests',
            filter: `class_id=eq.${data.id}`,
          },
          () => {
            void load(data.id)
          },
        )
        .subscribe()
    }

    void init()
    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [profile, load])

  async function decide(requestId: string, decision: 'APPROVED' | 'REJECTED', reason?: string) {
    setBusyId(requestId)
    const { error: err } = await supabase.rpc('decide_permission_request', {
      p_request_id: requestId,
      p_decision: decision,
      p_rejection_reason: reason ?? null,
    })
    setBusyId(null)
    if (err) {
      setError(err.message.includes('سبب الرفض') ? 'سبب الرفض مطلوب.' : 'حدث خطأ أثناء تحديث الطلب.')
      return
    }
    setConfirmApproveId(null)
    setRejectId(null)
    setRejectReason('')
    const result = await notifyGuardianOfDecision(requestId)
    if (result.sent > 0) {
      setToast(`تم إرسال إشعار خلفية لولي الأمر (${result.sent}).`)
      setError('')
    } else if (result.reason === 'no_subscriptions') {
      setError(
        'تم تحديث الطلب، لكن ولي الأمر لم يفعّل إشعارات الخلفية على جواله بعد.',
      )
    } else if (result.error) {
      setError(`تم تحديث الطلب، وتعذر إرسال إشعار الخلفية: ${result.error}`)
    }
    if (schoolClass) await load(schoolClass.id)
  }

  function onRejectSubmit(e: FormEvent) {
    e.preventDefault()
    if (!rejectId) return
    void decide(rejectId, 'REJECTED', rejectReason)
  }

  return (
    <>
      {toast ? (
        <Toast
          message={toast}
          tone={toast.includes('إشعار خلفية') ? 'success' : 'warning'}
          onClose={() => setToast(null)}
        />
      ) : null}

      <PageShell
        title={schoolClass ? classLabel(schoolClass.grade, schoolClass.section) : 'الفصل'}
        subtitle="طلبات الخروج"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/display/class">
              <SecondaryButton type="button">شاشة العرض</SecondaryButton>
            </Link>
            {!notifyReady ? (
              <SecondaryButton type="button" onClick={() => void enableNotifications()}>
                تفعيل الإشعارات
              </SecondaryButton>
            ) : (
              <span className="self-center text-sm font-semibold text-[var(--color-approved)]">
                الإشعارات مفعّلة
              </span>
            )}
            <SecondaryButton type="button" onClick={() => void signOut()}>
              تسجيل الخروج
            </SecondaryButton>
          </div>
        }
      >
        {loading ? <p className="text-[var(--color-muted)]">جاري التحميل...</p> : null}
        <ErrorBox message={error} />

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-[var(--color-gold)]">قيد الانتظار</h2>
          {!loading && pending.length === 0 ? (
            <EmptyState>لا توجد طلبات خروج معلقة.</EmptyState>
          ) : null}
          <div className="space-y-3">
            {pending.map((r) => (
              <article
                key={r.id}
                className="glass-panel glass-interactive border-[var(--color-gold)] p-4"
              >
                <h3 className="text-xl font-bold text-[var(--color-text)]">
                  {r.students?.full_name ?? 'طالب'}
                </h3>
                <p className="mt-1 text-[var(--color-muted)]">
                  ولي الأمر: {r.profiles?.full_name ?? '—'}
                </p>
                <p className="mt-2 text-[var(--color-text)]">
                  السبب: {r.reason?.trim() ? r.reason : '—'}
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {formatDateTime(r.created_at)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <SecondaryButton
                    type="button"
                    onClick={() => {
                      setRejectId(r.id)
                      setConfirmApproveId(null)
                    }}
                    disabled={busyId === r.id}
                  >
                    رفض
                  </SecondaryButton>
                  <PrimaryButton
                    type="button"
                    className="!border-[#27885a] !bg-[#2f9e6b] !text-white hover:!bg-[#27885a]"
                    onClick={() => {
                      setConfirmApproveId(r.id)
                      setRejectId(null)
                    }}
                    disabled={busyId === r.id}
                  >
                    موافقة
                  </PrimaryButton>
                </div>

                {confirmApproveId === r.id ? (
                  <div className="mt-4 rounded-lg glass-panel-soft p-3">
                    <p className="font-medium">
                      هل تريد الموافقة على خروج {r.students?.full_name}؟
                    </p>
                    <div className="mt-3 flex gap-2">
                      <SecondaryButton type="button" onClick={() => setConfirmApproveId(null)}>
                        إلغاء
                      </SecondaryButton>
                      <PrimaryButton
                        type="button"
                        className="!border-[#27885a] !bg-[#2f9e6b] !text-white hover:!bg-[#27885a]"
                        disabled={busyId === r.id}
                        onClick={() => void decide(r.id, 'APPROVED')}
                      >
                        موافقة
                      </PrimaryButton>
                    </div>
                  </div>
                ) : null}

                {rejectId === r.id ? (
                  <form
                    onSubmit={onRejectSubmit}
                    className="mt-4 space-y-3 rounded-lg glass-panel-soft p-3"
                  >
                    <TextArea
                      label="سبب الرفض"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      required
                    />
                    <div className="flex gap-2">
                      <SecondaryButton type="button" onClick={() => setRejectId(null)}>
                        إلغاء
                      </SecondaryButton>
                      <PrimaryButton
                        type="submit"
                        className="!border-[#b93a3a] !bg-[#d64545] !text-white hover:!bg-[#b93a3a]"
                        disabled={busyId === r.id}
                      >
                        تأكيد الرفض
                      </PrimaryButton>
                    </div>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-[var(--color-text)]">سجل الفصل</h2>
          {history.length === 0 ? <EmptyState>لا يوجد سجل بعد.</EmptyState> : null}
          <div className="space-y-3">
            {history.map((r) => (
              <article key={r.id} className="glass-panel glass-interactive p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold">{r.students?.full_name}</h3>
                    <p className="text-sm text-[var(--color-muted)]">
                      {r.reason?.trim() ? r.reason : '—'}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  {formatDateTime(r.created_at)}
                </p>
              </article>
            ))}
          </div>
        </section>
      </PageShell>
    </>
  )
}
