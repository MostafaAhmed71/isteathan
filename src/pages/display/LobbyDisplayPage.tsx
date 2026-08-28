import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DisplayEmptyState,
  DisplayNowCalling,
  DisplayQueueTable,
  DisplaySplashOverlay,
} from '../../components/DisplayRequestCard'
import { hasArabicDisplayVoice, unlockDisplayAudio } from '../../lib/displayAlert'
import { useDisplayBoard } from '../../lib/displayBoard'
import { SCHOOL_LOGO_SRC, SCHOOL_NAME } from '../../lib/brand'

export function LobbyDisplayPage() {
  const [soundReady, setSoundReady] = useState(false)
  const [arabicVoice, setArabicVoice] = useState(true)
  const [clock, setClock] = useState(() => new Date())
  const {
    pending,
    pendingRest,
    recentRest,
    hero,
    flashId,
    selectedId,
    splash,
    error,
    selectRequest,
    lateCount,
  } = useDisplayBoard({})

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  async function enableSound() {
    if (soundReady) return
    const ok = await unlockDisplayAudio()
    setSoundReady(ok)
    if (ok) setArabicVoice(await hasArabicDisplayVoice())
  }

  const clockLabel = new Intl.DateTimeFormat('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(clock)
  const dateLabel = new Intl.DateTimeFormat('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(clock)
  const now = clock.getTime()

  return (
    <div
      className="display-screen display-screen--lobby"
      onClick={() => {
        void enableSound()
      }}
    >
      {splash?.kind === 'new' ? (
        <DisplaySplashOverlay kind="new" name={splash.name} />
      ) : null}
      {splash?.kind === 'decision' ? (
        <DisplaySplashOverlay kind="decision" name={splash.name} status={splash.status} />
      ) : null}

      <header className="rx-topbar">
        <div className="rx-topbar__brand">
          <img src={SCHOOL_LOGO_SRC} alt="" className="rx-topbar__logo" />
          <div>
            <p className="rx-topbar__school">{SCHOOL_NAME}</p>
            <p className="rx-topbar__screen">شاشة البهو · طلبات الخروج</p>
          </div>
        </div>
        <div className="rx-topbar__stats">
          <div className="rx-stat rx-stat--clock">
            <span className="rx-stat__label">{dateLabel}</span>
            <span className="rx-stat__value">{clockLabel}</span>
          </div>
          <div className="rx-stat">
            <span className="rx-stat__label">انتظار</span>
            <span className="rx-stat__value">{pending.length}</span>
          </div>
          {lateCount > 0 ? (
            <div className="rx-stat rx-stat--late">
              <span className="rx-stat__label">متأخر</span>
              <span className="rx-stat__value">{lateCount}</span>
            </div>
          ) : null}
          <div className={`rx-stat rx-stat--live ${soundReady ? '' : 'rx-stat--muted'}`}>
            <span className="rx-live-dot" />
            {soundReady ? 'مباشر' : 'فعّل الصوت'}
          </div>
          <Link to="/admin" className="rx-topbar__close" onClick={(e) => e.stopPropagation()}>
            إغلاق
          </Link>
        </div>
      </header>

      {!soundReady ? (
        <p className="rx-hint lb-sound-banner">اضغط في أي مكان لتفعيل الإعلان الصوتي</p>
      ) : null}
      {soundReady && !arabicVoice ? (
        <p className="rx-hint lb-sound-banner">
          لا يوجد صوت عربي على هذا الجهاز. من إعدادات ويندوز ثبّت لغة العربية (السعودية) ثم حزمة الكلام.
        </p>
      ) : null}
      {error ? <p className="rx-error">{error}</p> : null}

      <main className="rx-body lb-stage">
        {splash ? null : !hero ? (
          <DisplayEmptyState />
        ) : (
          <DisplayNowCalling
            request={hero}
            isNew={flashId === hero.id}
            onActivate={() => selectRequest(hero)}
            now={now}
          />
        )}
        <div className="lb-boards">
          <DisplayQueueTable
            showWhenEmpty
            title="قائمة الانتظار"
            rows={pendingRest}
            heroId={hero?.id}
            flashId={flashId}
            selectedId={selectedId}
            onActivate={selectRequest}
            now={now}
          />
          <DisplayQueueTable
            showWhenEmpty
            title="آخر القرارات"
            rows={recentRest}
            heroId={hero?.id}
            flashId={flashId}
            selectedId={selectedId}
            onActivate={selectRequest}
            now={now}
          />
        </div>
      </main>
    </div>
  )
}
