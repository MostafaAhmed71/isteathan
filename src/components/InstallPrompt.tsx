import { useCallback, useEffect, useState } from 'react'

const DISMISS_KEY = 'isteathan-install-dismissed'
const IOS_HINT_KEY = 'isteathan-ios-hint-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOSDevice = /iPad|iPhone|iPod/.test(ua)
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iOSDevice || iPadOs
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const displayStandalone = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return displayStandalone || iosStandalone
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showAndroid, setShowAndroid] = useState(false)
  const [showIos, setShowIos] = useState(false)

  useEffect(() => {
    if (isStandalone()) return

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      const promptEvent = event as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)
      if (localStorage.getItem(DISMISS_KEY) !== '1') {
        setShowAndroid(true)
      }
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    if (isIos() && localStorage.getItem(IOS_HINT_KEY) !== '1') {
      setShowIos(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [])

  const dismissAndroid = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, '1')
    setShowAndroid(false)
  }, [])

  const dismissIos = useCallback(() => {
    localStorage.setItem(IOS_HINT_KEY, '1')
    setShowIos(false)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShowAndroid(false)
    if (choice.outcome === 'dismissed') {
      localStorage.setItem(DISMISS_KEY, '1')
    }
  }, [deferredPrompt])

  if (!showAndroid && !showIos) return null

  return (
    <div
      role="dialog"
      aria-label="تثبيت التطبيق"
      className="glass-panel fixed inset-x-0 bottom-0 z-50 rounded-none border-x-0 border-b-0 p-4"
    >
      {showAndroid && (
        <div className="mx-auto max-w-md">
          <p className="font-bold text-[var(--color-gold-soft)]">تثبيت تطبيق استئذان</p>
          <p className="mt-1 mb-3 text-sm text-[var(--color-muted)]">
            ثبّت التطبيق على الشاشة الرئيسية للوصول السريع بدون شريط المتصفح.
          </p>
          <div className="flex gap-3">
            <button type="button" className="btn-primary flex-1" onClick={handleInstall}>
              تثبيت
            </button>
            <button type="button" className="btn-secondary" onClick={dismissAndroid}>
              لاحقًا
            </button>
          </div>
        </div>
      )}

      {!showAndroid && showIos && (
        <div className="mx-auto max-w-md">
          <p className="font-bold text-[var(--color-gold-soft)]">إضافة استئذان للشاشة الرئيسية</p>
          <p className="mt-1 mb-3 text-sm text-[var(--color-muted)]">
            على آيفون: اضغط مشاركة ثم «إضافة إلى الشاشة الرئيسية».
          </p>
          <button type="button" className="btn-secondary w-full" onClick={dismissIos}>
            حسناً
          </button>
        </div>
      )}
    </div>
  )
}
