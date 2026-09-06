import { useCallback, useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import {
  checkForAppUpdate,
  dismissAppUpdate,
  downloadAndInstallUpdate,
  ensureInstallPermission,
  isAppUpdateSupported,
  type AppUpdateManifest,
  type AppVersionInfo,
} from '../lib/appUpdate'

export function AppUpdateBanner() {
  const [visible, setVisible] = useState(false)
  const [manifest, setManifest] = useState<AppUpdateManifest | null>(null)
  const [installed, setInstalled] = useState<AppVersionInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!isAppUpdateSupported()) return
    const result = await checkForAppUpdate()
    setInstalled(result.installed)
    setManifest(result.manifest)
    setVisible(result.available)
  }, [])

  useEffect(() => {
    void refresh()
    const sub = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void refresh()
    })
    return () => {
      void sub.then((handle) => handle.remove())
    }
  }, [refresh])

  const handleDismiss = useCallback(() => {
    if (manifest) dismissAppUpdate(manifest.versionCode)
    setVisible(false)
    setError('')
  }, [manifest])

  const handleUpdate = useCallback(async () => {
    if (!manifest) return
    setBusy(true)
    setError('')
    setProgress(0)
    try {
      const allowed = await ensureInstallPermission()
      if (!allowed) {
        setError('فعّل «السماح بتثبيت التطبيقات من هذا المصدر» ثم اضغط تحديث مرة أخرى.')
        return
      }
      await downloadAndInstallUpdate(manifest.apkUrl, setProgress)
      setVisible(false)
    } catch {
      setError('تعذر تنزيل التحديث. تحقق من الاتصال بالإنترنت وحاول مرة أخرى.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }, [manifest])

  if (!visible || !manifest) return null

  return (
    <div
      role="dialog"
      aria-label="تحديث التطبيق"
      className="glass-panel fixed inset-x-0 top-0 z-[60] rounded-none border-x-0 border-t-0 p-4 shadow-lg"
    >
      <div className="mx-auto max-w-md">
        <p className="font-bold text-[var(--color-gold-soft)]">تحديث جديد متاح</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          الإصدار {manifest.versionName}
          {installed ? ` (مثبت: ${installed.versionName})` : ''}
        </p>
        {manifest.notes ? (
          <p className="mt-2 text-sm text-white/90">{manifest.notes}</p>
        ) : null}
        {progress !== null ? (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-[var(--color-gold)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">جاري التنزيل… {progress}%</p>
          </div>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={busy}
            onClick={handleUpdate}
          >
            {busy ? 'جاري التحديث…' : 'تحديث الآن'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={handleDismiss}
          >
            لاحقًا
          </button>
        </div>
      </div>
    </div>
  )
}
