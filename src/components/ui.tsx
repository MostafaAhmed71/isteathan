import type { RequestStatus } from '../lib/types'
import { STATUS_LABELS } from '../lib/types'
import { SchoolBrand } from './SchoolBrand'

const STATUS_CLASS: Record<RequestStatus, string> = {
  PENDING: 'status-pending',
  APPROVED: 'status-approved',
  REJECTED: 'status-rejected',
  CANCELLED: 'status-cancelled',
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-sm font-semibold ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

export function GlassCard({
  children,
  className = '',
  interactive = false,
}: {
  children: React.ReactNode
  className?: string
  interactive?: boolean
}) {
  return (
    <div
      className={`glass-panel p-4 ${interactive ? 'glass-interactive' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="app-canvas mx-auto w-full max-w-5xl px-4 py-6">
      <header className="glass-panel mb-6 space-y-4 p-4">
        <SchoolBrand variant="header" />
        <hr className="gold-rule" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="brand-title text-2xl md:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-[var(--color-muted)]">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      </header>
      {children}
    </div>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-panel-soft px-4 py-10 text-center text-[var(--color-muted)]">
      {children}
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null
  return (
    <div
      className="rounded-lg border border-[rgba(255,123,123,0.45)] bg-[rgba(255,123,123,0.14)] px-3 py-2 text-sm text-[#ffb0b0]"
      role="alert"
    >
      {message}
    </div>
  )
}

export function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { full?: boolean },
) {
  const { full, className = '', ...rest } = props
  return (
    <button
      {...rest}
      className={`btn-primary ${full ? 'w-full' : ''} ${className}`}
    />
  )
}

export function SecondaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { full?: boolean },
) {
  const { full, className = '', ...rest } = props
  return (
    <button
      {...rest}
      className={`btn-secondary ${full ? 'w-full' : ''} ${className}`}
    />
  )
}

export function DangerButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { full?: boolean },
) {
  const { full, className = '', ...rest } = props
  return (
    <button
      {...rest}
      className={`btn-danger ${full ? 'w-full' : ''} ${className}`}
    />
  )
}

export function TextField({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1.5">
      <span className="field-label">{label}</span>
      <input {...props} className="field-control" />
    </label>
  )
}

export function TextArea({
  label,
  ...props
}: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block space-y-1.5">
      <span className="field-label">{label}</span>
      <textarea {...props} className="field-control min-h-28 py-2" />
    </label>
  )
}

export function SelectField({
  label,
  children,
  ...props
}: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block space-y-1.5">
      <span className="field-label">{label}</span>
      <select {...props} className="field-control">
        {children}
      </select>
    </label>
  )
}
