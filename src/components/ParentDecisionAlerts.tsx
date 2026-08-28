import { useEffect, useState } from 'react'
import { Toast } from './Toast'
import { useAuth } from '../lib/auth'
import {
  alertRequestDecision,
  getNotificationPermission,
} from '../lib/notify'
import { supabase } from '../lib/supabase'
import { STATUS_LABELS, type RequestStatus } from '../lib/types'

/**
 * Listens for class/admin decisions on the parent's requests and notifies
 * (toast + sound + browser) while any parent page is open.
 */
export function ParentDecisionAlerts() {
  const { profile } = useAuth()
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'warning' } | null>(
    null,
  )

  useEffect(() => {
    if (!profile || profile.role !== 'PARENT') return

    void getNotificationPermission()

    let channel = supabase.channel(`parent-decision-alerts-${profile.id}`)

    const handleDecision = (payload: {
      old: { status?: RequestStatus } | null
      new: {
        status?: RequestStatus
        student_id?: string
        rejection_reason?: string | null
      }
    }) => {
      void (async () => {
        const prev = payload.old
        const next = payload.new

        if (next.status !== 'APPROVED' && next.status !== 'REJECTED') return
        if (prev?.status && prev.status !== 'PENDING') return

        let studentName = 'الطالب'
        if (next.student_id) {
          const { data: student } = await supabase
            .from('students')
            .select('full_name')
            .eq('id', next.student_id)
            .maybeSingle()
          if (student?.full_name) studentName = student.full_name
        }

        alertRequestDecision(studentName, next.status, next.rejection_reason)
        setToast({
          message: `رد الإدارة على طلب خروج ${studentName}: ${STATUS_LABELS[next.status]}`,
          tone: next.status === 'APPROVED' ? 'success' : 'warning',
        })
      })()
    }

    const subscribe = () => {
      channel = supabase
        .channel(`parent-decision-alerts-${profile.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'permission_requests',
            filter: `guardian_id=eq.${profile.id}`,
          },
          (payload) => {
            handleDecision({
              old: payload.old as { status?: RequestStatus } | null,
              new: payload.new as {
                status?: RequestStatus
                student_id?: string
                rejection_reason?: string | null
              },
            })
          },
        )
        .subscribe()
    }

    subscribe()

    // Mobile Chrome may drop realtime when the tab is frozen; resubscribe on return.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void supabase.removeChannel(channel).then(() => {
        subscribe()
      })
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [profile])

  if (!toast) return null

  return (
    <Toast
      message={toast.message}
      tone={toast.tone}
      onClose={() => setToast(null)}
    />
  )
}
