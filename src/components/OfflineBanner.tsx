import { useEffect, useState } from 'react'

/** In-app banner when the device reports offline (no stale request data). */
export function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-60 px-4 py-3 text-center font-semibold"
      style={{
        background: 'var(--color-bg)',
        borderBottom: '1px solid rgba(212, 175, 55, 0.55)',
        color: '#f2f6fc',
      }}
    >
      لا يوجد اتصال بالإنترنت. خروج يحتاج اتصالاً لإرسال وعرض الطلبات.
    </div>
  )
}
