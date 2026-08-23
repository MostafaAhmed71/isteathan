import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RequestStatusTracker } from '../../components/RequestStatusTracker'
import {
  EmptyState,
  PageShell,
  SecondaryButton,
  StatusBadge,
} from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import {
  classLabel,
  formatDateTime,
  type PermissionRequest,
} from '../../lib/types'

export function ParentRequestsPage() {
  const { profile } = useAuth()
  const [requests, setRequests] = useState<PermissionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile) return
    let cancelled = false

    async function load() {
      const { data, error: err } = await supabase
        .from('permission_requests')
        .select('*, students(*, classes(*)), classes(*)')
        .eq('guardian_id', profile!.id)
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (err) setError('تعذر تحميل البيانات، حاول مرة أخرى.')
      else setRequests((data as PermissionRequest[]) ?? [])
      setLoading(false)
    }

    void load()

    const channel = supabase
      .channel(`parent-requests-list-${profile.id}`)
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
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [profile])

  return (
    <PageShell
      title="سجل الطلبات"
      subtitle="تابع حالة كل طلب خطوة بخطوة"
      actions={
        <Link to="/parent">
          <SecondaryButton type="button">رجوع للرئيسية</SecondaryButton>
        </Link>
      }
    >
      {loading ? <p className="text-[var(--color-muted)]">جاري التحميل...</p> : null}
      {error ? <p className="mb-4 text-[#ffb0b0]">{error}</p> : null}
      {!loading && requests.length === 0 ? (
        <EmptyState>لا توجد طلبات بعد. أرسل طلبًا من الصفحة الرئيسية.</EmptyState>
      ) : null}

      <div className="space-y-4">
        {requests.map((r) => (
          <article key={r.id} className="glass-panel p-4 md:p-5">
            <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[var(--color-text)]">
                  {r.students?.full_name ?? 'طالب'}
                </h2>
                <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                  {r.classes ? classLabel(r.classes.grade, r.classes.section) : ''}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>

            <RequestStatusTracker
              status={r.status}
              createdAt={r.created_at}
              decidedAt={r.decided_at}
              rejectionReason={r.rejection_reason}
            />

            <p className="mt-4 border-t border-[rgba(212,175,55,0.25)] pt-3 text-sm text-[var(--color-muted)]">
              {r.reason?.trim() ? `السبب: ${r.reason}` : 'بدون سبب'}
              <span className="mx-2 opacity-40">·</span>
              {formatDateTime(r.created_at)}
            </p>
          </article>
        ))}
      </div>
    </PageShell>
  )
}
