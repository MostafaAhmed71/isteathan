import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SchoolBrand } from '../components/SchoolBrand'
import { PrimaryButton, SecondaryButton } from '../components/ui'
import {
  GUIDE_FULL_AUDIO,
  GUIDE_SCENES,
  applyNormalPlayback,
  audioExists,
} from '../lib/guideNarration'

type AudioMode = 'none' | 'full' | 'local'

type SimStep =
  | 'intro'
  | 'login'
  | 'register'
  | 'link-home'
  | 'link-form'
  | 'link-done'
  | 'request-home'
  | 'request-sent'
  | 'done'

const STEP_HINT: Record<SimStep, string> = {
  intro: '',
  login: 'اضغط «إنشاء حساب ولي أمر»',
  register: 'اضغط الحقول بالترتيب ثم «إنشاء الحساب»',
  'link-home': 'اضغط «إضافة ابن برقم الهوية»',
  'link-form': 'اضغط حقل الهوية ثم «إضافة»',
  'link-done': 'اضغط «الانتقال للرئيسية»',
  'request-home': 'فعّل الإشعارات (اختياري) ثم اضغط «طلب خروج»',
  'request-sent': 'اضغط «الطلبات» لمتابعة الحالة',
  done: 'انتهى الشرح — أحسنت',
}

/** Map interactive step → voice-over scene index for optional audio. */
function audioSceneForStep(step: SimStep): number {
  switch (step) {
    case 'intro':
      return 0
    case 'login':
      return 1
    case 'register':
      return 2
    case 'link-home':
    case 'link-form':
    case 'link-done':
      return 3
    case 'request-home':
    case 'request-sent':
    case 'done':
      return 4
  }
}

function IosStatusBar() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const time = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false })
  return (
    <div className="ios-status" aria-hidden>
      <span className="ios-status__time">{time}</span>
      <span className="ios-status__island" />
      <span className="ios-status__icons">
        <span className="ios-status__signal" />
        <span className="ios-status__wifi" />
        <span className="ios-status__battery" />
      </span>
    </div>
  )
}

function Field({
  label,
  value,
  highlight,
  password,
  filled,
  onClick,
}: {
  label: string
  value: string
  highlight?: boolean
  password?: boolean
  filled?: boolean
  onClick?: () => void
}) {
  const show = filled ? (password ? '••••••••' : value) : ''
  return (
    <button
      type="button"
      className={`guide-field w-full text-right ${highlight ? 'guide-field--hot guide-pulse' : ''}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <span>{label}</span>
      <span className="guide-field__value">{show || ' '}</span>
    </button>
  )
}

const INTRO_STEPS = [
  {
    n: '01',
    title: 'إنشاء حساب ولي الأمر',
    desc: 'من شاشة الدخول أنشئ حسابك ببياناتك الرسمية',
  },
  {
    n: '02',
    title: 'ربط الأبناء',
    desc: 'أضف أبناءك بسهولة عبر رقم الهوية المدرسي',
  },
  {
    n: '03',
    title: 'تقديم طلب الخروج',
    desc: 'أرسل الطلب بضغطة واحدة وتابع الموافقة فورًا',
  },
] as const

function ProfessionalIntro({ onContinue }: { onContinue: () => void }) {
  const [shown, setShown] = useState(0)
  const [ctaReady, setCtaReady] = useState(false)

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setShown(1), 500),
      window.setTimeout(() => setShown(2), 1300),
      window.setTimeout(() => setShown(3), 2100),
      window.setTimeout(() => setCtaReady(true), 2800),
    ]
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [])

  return (
    <div className="guide-intro">
      <div className="guide-intro__glow" aria-hidden />
      <div className="guide-intro__brand">
        <SchoolBrand variant="hero" showAppName />
      </div>

      <p className="guide-intro__welcome">
        مرحبًا بكم في تطبيق خروج
        <br />
        <span>التابع لمدارس نخبة الشمال الأهلية</span>
      </p>
      <p className="guide-intro__lead">
        في دقائق قليلة سأشرح لكم ثلاث خطوات مهمة
      </p>

      <ol className="guide-intro__steps">
        {INTRO_STEPS.map((s, i) => {
          const active = shown > i
          return (
            <li
              key={s.n}
              className={`guide-intro__step ${active ? 'guide-intro__step--in' : ''}`}
              style={{ transitionDelay: active ? `${i * 40}ms` : '0ms' }}
            >
              <div className="guide-intro__num" aria-hidden>
                {s.n}
              </div>
              <div className="guide-intro__body">
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
              {i < INTRO_STEPS.length - 1 ? <span className="guide-intro__rail" aria-hidden /> : null}
            </li>
          )
        })}
      </ol>

      <div className={`guide-intro__cta ${ctaReady ? 'guide-intro__cta--in' : ''}`}>
        <PrimaryButton type="button" full className="guide-pulse" onClick={onContinue}>
          الانتقال لتسجيل الدخول
        </PrimaryButton>
        <p className="guide-intro__cta-note">بعدها تتحكم أنت بالضغط على الأزرار</p>
      </div>
    </div>
  )
}

export function ParentGuidePage() {
  const [step, setStep] = useState<SimStep>('intro')
  const [regFilled, setRegFilled] = useState(0) // 0..6 fields filled
  const [linkIdFilled, setLinkIdFilled] = useState(false)
  const [notifyOn, setNotifyOn] = useState(false)
  const [recording, setRecording] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [audioMode, setAudioMode] = useState<AudioMode>('none')
  const [audioReady, setAudioReady] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [localFileName, setLocalFileName] = useState('')
  const [toast, setToast] = useState('')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localUrlRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const shellRef = useRef<HTMLElement>(null)

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 1800)
  }

  const stopAudio = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  /** Full voice-over from the start — used only when recording mode begins. */
  const playFullVoiceover = useCallback(async () => {
    const a = audioRef.current
    if (!a || audioMode === 'none') {
      setAudioError('اختر ملف الفويس أوفر أولًا.')
      return false
    }
    applyNormalPlayback(a)
    a.currentTime = 0
    a.muted = false
    try {
      await a.play()
      applyNormalPlayback(a)
      setAudioError('')
      return true
    } catch {
      setAudioError('تعذر تشغيل الصوت. اضغط مرة أخرى واسمح بالصوت.')
      return false
    }
  }, [audioMode])

  const prepareAudio = useCallback(
    (src: string, mode: AudioMode) => {
      stopAudio()
      const a = new Audio(src)
      a.preload = 'auto'
      applyNormalPlayback(a)
      audioRef.current = a
      setAudioMode(mode)
      setAudioReady(false)
      a.onloadedmetadata = () => {
        applyNormalPlayback(a)
        setAudioReady(true)
      }
      a.onratechange = () => {
        if (a.playbackRate !== 1) a.playbackRate = 1
      }
      a.ontimeupdate = () => {
        if (a.playbackRate !== 1) a.playbackRate = 1
      }
      a.onerror = () => {
        setAudioError('تعذر تحميل ملف الصوت.')
        setAudioReady(false)
      }
    },
    [stopAudio],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (await audioExists(GUIDE_FULL_AUDIO)) {
        if (!cancelled) prepareAudio(GUIDE_FULL_AUDIO, 'full')
        return
      }
      if (!cancelled) {
        setAudioMode('none')
        setAudioReady(false)
      }
    })()
    return () => {
      cancelled = true
      stopAudio()
      audioRef.current = null
      if (localUrlRef.current) {
        URL.revokeObjectURL(localUrlRef.current)
        localUrlRef.current = null
      }
    }
  }, [prepareAudio, stopAudio])

  function go(next: SimStep) {
    setStep(next)
  }

  function resetSimUi() {
    setStep('intro')
    setRegFilled(0)
    setLinkIdFilled(false)
    setNotifyOn(false)
    setToast('')
  }

  function resetSim() {
    stopAudio()
    resetSimUi()
  }

  function onPickFile(file: File | null) {
    if (!file) return
    if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current)
    const url = URL.createObjectURL(file)
    localUrlRef.current = url
    setLocalFileName(file.name)
    setAudioError('')
    prepareAudio(url, 'local')
  }

  async function startRecordingMode() {
    if (audioMode === 'none' || !audioReady) {
      setAudioError('اختر ملف الفويس أوفر أولًا ثم اضغط وضع التسجيل.')
      return
    }
    setAudioError('')
    try {
      if (shellRef.current && !document.fullscreenElement) {
        await shellRef.current.requestFullscreen?.()
      }
    } catch {
      /* iOS ignores */
    }
    setCountdown(3)
    for (let n = 3; n >= 1; n--) {
      setCountdown(n)
      await new Promise((r) => window.setTimeout(r, 1000))
    }
    setCountdown(null)
    setRecording(true)
    resetSimUi()
    await playFullVoiceover()
  }

  function exitRecording() {
    setRecording(false)
    stopAudio()
    if (document.fullscreenElement) void document.exitFullscreen()
  }

  const sceneTitle = GUIDE_SCENES[audioSceneForStep(step)]?.title ?? ''

  return (
    <main ref={shellRef} className={`guide-shell ${recording ? 'guide-shell--recording' : ''}`}>
      <IosStatusBar />

      {!recording ? (
        <header className="guide-toolbar">
          <div>
            <h1 className="brand-title text-lg">محاكي تفاعلي</h1>
            <p className="text-xs text-[var(--color-muted)]">
              {sceneTitle} · اضغط الأزرار بنفسك
            </p>
          </div>
          <Link to="/login" className="shrink-0">
            <SecondaryButton type="button">رجوع</SecondaryButton>
          </Link>
        </header>
      ) : null}

      {countdown !== null ? (
        <div className="guide-countdown" aria-live="assertive">
          <p>ابدأ تسجيل الشاشة الآن — الصوت يبدأ بعده مباشرة</p>
          <strong>{countdown}</strong>
        </div>
      ) : null}

      {!recording ? (
        <div className="mx-4 mt-2 space-y-2">
          {audioMode === 'none' ? (
            <div className="guide-panel space-y-3 p-3 text-center">
              <p className="text-sm">اختر ملف الفويس أوفر (يبدأ مع وضع التسجيل)</p>
              <PrimaryButton type="button" full onClick={() => fileInputRef.current?.click()}>
                اختيار ملف الصوت
              </PrimaryButton>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-muted)]">
              <span>
                {audioMode === 'local' ? localFileName : 'voiceover.mp3'}
                {audioReady ? ' · جاهز' : ' · تحميل...'}
              </span>
              <button type="button" className="underline" onClick={() => fileInputRef.current?.click()}>
                تغيير
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.aac"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
          {audioError ? <p className="text-center text-sm text-[#ffb0b0]">{audioError}</p> : null}
        </div>
      ) : null}

      {step !== 'intro' && STEP_HINT[step] ? (
        <p className="guide-hint mx-4 mt-3">{STEP_HINT[step]}</p>
      ) : null}
      {toast ? <p className="mx-4 text-center text-sm text-[var(--color-gold-soft)]">{toast}</p> : null}

      <div className="guide-stage">
        {step === 'intro' ? (
          <ProfessionalIntro
            onContinue={() => {
              go('login')
            }}
          />
        ) : null}

        {step === 'login' ? (
          <div className="guide-screen">
            <SchoolBrand variant="hero" showAppName />
            <hr className="gold-rule mx-auto mt-3 w-20" />
            <p className="mt-3 text-center text-[var(--color-muted)]">تسجيل الدخول</p>
            <div className="mt-6 space-y-3">
              <Field label="اسم الدخول" value="parent@email.com" filled />
              <Field label="كلمة المرور" value="" password filled />
              <button type="button" className="btn-primary w-full opacity-50" disabled>
                دخول
              </button>
              <p className="pt-2 text-center text-sm text-[var(--color-muted)]">ولي أمر جديد؟</p>
              <button
                type="button"
                className="btn-secondary w-full guide-pulse"
                onClick={() => {
                  setRegFilled(0)
                  go('register')
                }}
              >
                إنشاء حساب ولي أمر
              </button>
            </div>
          </div>
        ) : null}

        {step === 'register' ? (
          <div className="guide-screen">
            <SchoolBrand variant="hero" showAppName />
            <hr className="gold-rule mx-auto mt-3 w-20" />
            <p className="mt-3 text-center text-[var(--color-muted)]">إنشاء حساب ولي أمر</p>
            <div className="mt-5 space-y-2.5">
              {(
                [
                  ['اسم ولي الأمر', 'أحمد محمد', false],
                  ['رقم الهوية', '1234567890', false],
                  ['الجوال', '05xxxxxxxx', false],
                  ['البريد الإلكتروني', 'parent@email.com', false],
                  ['كلمة المرور', 'x', true],
                  ['تأكيد كلمة المرور', 'x', true],
                ] as const
              ).map(([label, value, password], i) => (
                <Field
                  key={label}
                  label={label}
                  value={value}
                  password={password}
                  filled={regFilled > i}
                  highlight={regFilled === i}
                  onClick={
                    regFilled === i
                      ? () => setRegFilled((n) => n + 1)
                      : undefined
                  }
                />
              ))}
              <button
                type="button"
                className={`btn-primary mt-2 w-full ${regFilled >= 6 ? 'guide-pulse' : 'opacity-50'}`}
                disabled={regFilled < 6}
                onClick={() => {
                  flash('تم إنشاء الحساب')
                  setLinkIdFilled(false)
                  go('link-home')
                }}
              >
                إنشاء الحساب
              </button>
            </div>
          </div>
        ) : null}

        {step === 'link-home' || step === 'link-form' || step === 'link-done' ? (
          <div className="guide-screen">
            <div className="guide-tabs">
              <button
                type="button"
                className={`nav-chip ${step === 'link-done' ? 'nav-chip-idle' : 'nav-chip-idle'}`}
                onClick={() => {
                  if (step === 'link-done') {
                    setNotifyOn(false)
                    go('request-home')
                  }
                }}
              >
                الرئيسية
              </button>
              <span className="nav-chip nav-chip-active">أبنائي</span>
              <span className="nav-chip nav-chip-idle">الطلبات</span>
            </div>
            <h2 className="brand-title mt-4 text-xl">أبنائي</h2>

            {step === 'link-done' ? (
              <div className="mt-4 glass-panel p-4">
                <p className="text-lg font-bold">محمد أحمد</p>
                <p className="text-sm text-[var(--color-muted)]">الصف الثالث · أ · هوية 1098765432</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--color-muted)]">لا يوجد أبناء مرتبطون بهذا الحساب.</p>
            )}

            {step === 'link-home' ? (
              <button
                type="button"
                className="btn-secondary mt-5 w-full guide-pulse"
                onClick={() => go('link-form')}
              >
                إضافة ابن برقم الهوية
              </button>
            ) : null}

            {step === 'link-form' ? (
              <div className="mt-4 space-y-3 glass-panel p-4">
                <p className="font-bold">إضافة ابن</p>
                <Field
                  label="رقم هوية الطالب"
                  value="1098765432"
                  filled={linkIdFilled}
                  highlight={!linkIdFilled}
                  onClick={!linkIdFilled ? () => setLinkIdFilled(true) : undefined}
                />
                <button
                  type="button"
                  className={`btn-primary w-full ${linkIdFilled ? 'guide-pulse' : 'opacity-50'}`}
                  disabled={!linkIdFilled}
                  onClick={() => {
                    flash('تم إضافة الابن')
                    go('link-done')
                  }}
                >
                  إضافة
                </button>
              </div>
            ) : null}

            {step === 'link-done' ? (
              <button
                type="button"
                className="btn-primary mt-5 w-full guide-pulse"
                onClick={() => {
                  setNotifyOn(false)
                  go('request-home')
                }}
              >
                الانتقال للرئيسية
              </button>
            ) : null}
          </div>
        ) : null}

        {step === 'request-home' || step === 'request-sent' || step === 'done' ? (
          <div className="guide-screen">
            <div className="guide-tabs">
              <span className={`nav-chip ${step !== 'done' ? 'nav-chip-active' : 'nav-chip-idle'}`}>
                الرئيسية
              </span>
              <span className="nav-chip nav-chip-idle">أبنائي</span>
              <button
                type="button"
                className={`nav-chip ${step === 'done' ? 'nav-chip-active guide-pulse' : 'nav-chip-idle'} ${
                  step === 'request-sent' ? 'guide-pulse' : ''
                }`}
                onClick={() => {
                  if (step === 'request-sent') go('done')
                }}
              >
                الطلبات
              </button>
            </div>
            <h2 className="brand-title mt-4 text-xl">مرحبًا، أحمد</h2>
            <p className="text-sm text-[var(--color-muted)]">أرسل طلب خروج لأبنائك</p>

            {step !== 'done' ? (
              <>
                <button
                  type="button"
                  className={`btn-secondary mt-4 w-full ${!notifyOn ? 'guide-pulse' : ''}`}
                  onClick={() => {
                    if (!notifyOn) {
                      setNotifyOn(true)
                      flash('تم تفعيل الإشعارات')
                    }
                  }}
                >
                  {notifyOn ? 'الإشعارات مفعّلة' : 'تفعيل الإشعارات'}
                </button>
                <div className="mt-4 glass-panel p-4">
                  <p className="text-lg font-bold">محمد أحمد</p>
                  <p className="mb-3 text-sm text-[var(--color-muted)]">الصف الثالث · أ</p>
                  {step === 'request-sent' ? (
                    <p className="mb-3 text-sm font-semibold text-[var(--color-pending)]">
                      حالة الطلب: قيد المراجعة
                    </p>
                  ) : (
                    <p className="mb-3 text-sm text-[var(--color-muted)]">لا يوجد طلب سابق لهذا الابن.</p>
                  )}
                <button
                  type="button"
                  className={`btn-primary w-full min-h-12 ${step === 'request-home' ? 'guide-pulse' : ''}`}
                  disabled={step === 'request-sent'}
                  onClick={() => {
                    flash('تم إرسال طلب الخروج')
                    go('request-sent')
                  }}
                >
                  {step === 'request-sent' ? 'طلب قيد المراجعة' : 'طلب خروج'}
                </button>
                </div>
              </>
            ) : (
              <div className="mt-8 text-center">
                <p className="text-2xl font-bold text-[var(--color-gold)]">أحسنت</p>
                <p className="mt-2 text-sm text-[var(--color-muted)]">أكملتم خطوات الشرح بنجاح.</p>
                <PrimaryButton type="button" full className="mt-6" onClick={resetSim}>
                  إعادة المحاكاة
                </PrimaryButton>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {recording ? (
        <button type="button" className="guide-exit-rec" onClick={exitRecording}>
          إنهاء
        </button>
      ) : (
        <footer className="guide-footer">
          <PrimaryButton
            type="button"
            full
            onClick={() => void startRecordingMode()}
            disabled={!audioReady}
          >
            وضع تسجيل الشاشة (آيفون)
          </PrimaryButton>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <SecondaryButton type="button" full onClick={resetSim}>
              من البداية
            </SecondaryButton>
            <Link to="/register" className="block">
              <SecondaryButton type="button" full>
                حساب حقيقي
              </SecondaryButton>
            </Link>
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--color-muted)]">
            اختر الفويس أوفر ثم اضغط الزر أعلاه
            <br />
            يبدأ الصوت كاملًا وأنت تتحكم بالضغط على الشاشة
          </p>
        </footer>
      )}
    </main>
  )
}
