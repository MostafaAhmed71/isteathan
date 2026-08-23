import type { RequestStatus } from '../lib/types'
import { formatDateTime } from '../lib/types'

type StepState = 'done' | 'current' | 'upcoming' | 'failed'

function stepsForStatus(status: RequestStatus): {
  key: string
  label: string
  state: StepState
}[] {
  if (status === 'PENDING') {
    return [
      { key: 'sent', label: 'تم الإرسال', state: 'done' },
      { key: 'review', label: 'قيد المراجعة', state: 'current' },
      { key: 'decision', label: 'بانتظار القرار', state: 'upcoming' },
    ]
  }
  if (status === 'APPROVED') {
    return [
      { key: 'sent', label: 'تم الإرسال', state: 'done' },
      { key: 'review', label: 'تمت المراجعة', state: 'done' },
      { key: 'decision', label: 'تمت الموافقة', state: 'done' },
    ]
  }
  if (status === 'REJECTED') {
    return [
      { key: 'sent', label: 'تم الإرسال', state: 'done' },
      { key: 'review', label: 'تمت المراجعة', state: 'done' },
      { key: 'decision', label: 'تم الرفض', state: 'failed' },
    ]
  }
  return [
    { key: 'sent', label: 'تم الإرسال', state: 'done' },
    { key: 'review', label: 'تمت المراجعة', state: 'done' },
    { key: 'decision', label: 'ملغي', state: 'failed' },
  ]
}

function statusMessage(status: RequestStatus): string {
  switch (status) {
    case 'PENDING':
      return 'طلبك وصل لإدارة الفصل، وجاري مراجعته الآن.'
    case 'APPROVED':
      return 'تمت الموافقة على طلب الاستئذان.'
    case 'REJECTED':
      return 'تم رفض طلب الاستئذان.'
    case 'CANCELLED':
      return 'تم إلغاء الطلب.'
  }
}

function stepClasses(state: StepState): string {
  switch (state) {
    case 'done':
      return 'border-[var(--color-gold)] bg-[var(--color-gold)] text-[#0b1f3f]'
    case 'current':
      return 'border-[var(--color-gold)] bg-[rgba(212,175,55,0.2)] text-[var(--color-gold-bright)] shadow-[0_0_0_3px_rgba(212,175,55,0.2)]'
    case 'failed':
      return 'border-[#ff7b7b] bg-[rgba(255,123,123,0.2)] text-[#ffb0b0]'
    default:
      return 'border-[rgba(155,176,203,0.45)] bg-transparent text-[var(--color-muted)]'
  }
}

function lineClasses(before: StepState): string {
  if (before === 'done') return 'bg-[var(--color-gold)]'
  if (before === 'failed') return 'bg-[#ff7b7b]'
  return 'bg-[rgba(155,176,203,0.35)]'
}

export function RequestStatusTracker({
  status,
  createdAt,
  decidedAt,
  rejectionReason,
  compact = false,
}: {
  status: RequestStatus
  createdAt?: string
  decidedAt?: string | null
  rejectionReason?: string | null
  compact?: boolean
}) {
  const steps = stepsForStatus(status)

  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      <p className={`font-semibold ${compact ? 'text-sm' : 'text-base'} text-[var(--color-text)]`}>
        {statusMessage(status)}
      </p>

      <ol className="mt-3 flex items-start justify-between gap-1">
        {steps.map((step, index) => (
          <li key={step.key} className="flex min-w-0 flex-1 items-start">
            <div className="flex w-full min-w-0 flex-col items-center text-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold ${stepClasses(step.state)}`}
                aria-current={step.state === 'current' ? 'step' : undefined}
              >
                {step.state === 'done' ? '✓' : step.state === 'failed' ? '!' : index + 1}
              </span>
              <span className="mt-2 text-[11px] font-bold leading-snug text-[var(--color-text)] sm:text-xs">
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <div
                className={`mx-1 mt-4 h-0.5 flex-1 rounded-full ${lineClasses(step.state)}`}
                aria-hidden
              />
            ) : null}
          </li>
        ))}
      </ol>

      {!compact ? (
        <div className="mt-3 space-y-1 text-xs text-[var(--color-muted)] sm:text-sm">
          {createdAt ? <p>وقت الإرسال: {formatDateTime(createdAt)}</p> : null}
          {decidedAt && (status === 'APPROVED' || status === 'REJECTED') ? (
            <p>وقت القرار: {formatDateTime(decidedAt)}</p>
          ) : null}
          {status === 'REJECTED' && rejectionReason?.trim() ? (
            <p className="rounded-lg border border-[rgba(255,123,123,0.45)] bg-[rgba(255,123,123,0.14)] px-3 py-2 text-sm text-[#ffb0b0]">
              سبب الرفض: {rejectionReason}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
