import { useEffect } from 'react'

export function Toast({
  message,
  tone = 'info',
  onClose,
}: {
  message: string
  tone?: 'info' | 'success' | 'warning'
  onClose: () => void
}) {
  useEffect(() => {
    const id = window.setTimeout(onClose, 6500)
    return () => window.clearTimeout(id)
  }, [onClose, message])

  const toneClass =
    tone === 'success'
      ? 'border-[rgba(62,207,142,0.5)] bg-[rgba(62,207,142,0.16)] text-[#7aefb5]'
      : tone === 'warning'
        ? 'border-[rgba(240,201,74,0.55)] bg-[rgba(240,201,74,0.16)] text-[#f7e08a]'
        : 'border-[rgba(212,175,55,0.55)] bg-[var(--color-bg)] text-[var(--color-text)]'

  return (
    <div
      role="status"
      className={`glass-panel fixed start-4 end-4 top-4 z-[70] mx-auto max-w-md p-4 ${toneClass}`}
      style={{ animation: 'isteathan-toast-in 280ms ease' }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-bold leading-relaxed">{message}</p>
        <button
          type="button"
          className="btn-secondary min-h-9 px-3 text-sm"
          onClick={onClose}
        >
          إغلاق
        </button>
      </div>
      <style>{`
        @keyframes isteathan-toast-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
