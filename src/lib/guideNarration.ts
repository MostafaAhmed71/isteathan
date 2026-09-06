/** Guided demo scenes synced to a custom voice-over file. */

export type GuideSceneId = 'intro' | 'login' | 'register' | 'link' | 'request'

export type GuideScene = {
  id: GuideSceneId
  title: string
  speech: string
  caption: string
  audioSrc?: string
}

/** Put your voice-over here: public/guide/voiceover.mp3 */
export const GUIDE_FULL_AUDIO = '/guide/voiceover.mp3'

/**
 * Precise cue starts (seconds) matching the voice-over timeline:
 * افتتاحية 0:00–0:12 | دخول 0:12–0:19 | إنشاء حساب 0:20–0:38
 * إضافة أبناء 0:39–0:55 | إرسال طلب 0:55–1:21
 */
export const GUIDE_CUE_STARTS_SEC: number[] = [0, 12, 20, 39, 55]

/** End of the last scene (1:21). */
export const GUIDE_CUE_END_SEC = 81

/** When true, scenes follow audio cues exactly (no min-hold delay). */
export const GUIDE_USE_PRECISE_CUES = true

export const GUIDE_SCENES: GuideScene[] = [
  {
    id: 'intro',
    title: 'مقدمة',
    caption: 'تطبيق خروج',
    audioSrc: '/guide/01-intro.mp3',
    speech:
      'مرحبًا بكم في تطبيق خروج التابع لمدارس نخبة الشمال الأهلية. في دقائق قليلة سأشرح لكم ثلاث خطوات مهمة: إنشاء حساب ولي الأمر، ربط الأبناء، ثم تقديم طلب الخروج.',
  },
  {
    id: 'login',
    title: 'تسجيل الدخول',
    caption: 'شاشة الدخول',
    audioSrc: '/guide/02-login.mp3',
    speech: 'من شاشة تسجيل الدخول اضغطوا على إنشاء حساب ولي أمر.',
  },
  {
    id: 'register',
    title: 'إنشاء الحساب',
    caption: 'إنشاء حساب ولي أمر',
    audioSrc: '/guide/03-register.mp3',
    speech:
      'ثم أدخلوا الاسم، ورقم الهوية المكوّن من عشرة أرقام، والجوال إن رغبتم، والبريد الإلكتروني، وكلمة المرور مع تأكيدها. يجب أن تكون كلمة المرور ستة أحرف على الأقل ومتطابقة مع التأكيد، ثم اضغطوا إنشاء الحساب.',
  },
  {
    id: 'link',
    title: 'ربط الأبناء',
    caption: 'أبنائي',
    audioSrc: '/guide/04-link.mp3',
    speech:
      'ثانيًا، ربط الأبناء. ادخلوا إلى أبنائي، ثم اضغطوا إضافة ابن برقم الهوية. أدخلوا رقم هوية الطالب المسجّل لدى المدرسة واضغطوا إضافة. يمكنكم تكرار الخطوة لكل ابن.',
  },
  {
    id: 'request',
    title: 'طلب الخروج',
    caption: 'طلب خروج',
    audioSrc: '/guide/05-request.mp3',
    speech:
      'ثالثًا، تقديم طلب الخروج. من الصفحة الرئيسية اختاروا الابن ثم اضغطوا طلب خروج. سيصبح الطلب قيد المراجعة. فعّلوا الإشعارات لتصلكم النتيجة، وتابعوا الطلبات من سجل الطلبات.',
  },
]

/** Minimum seconds a highlight/step stays on screen (within a scene). */
export const GUIDE_MIN_PHASE_SEC = 2.2

export function sceneTimeRanges(durationSec: number): { start: number; end: number }[] {
  const cues = GUIDE_CUE_STARTS_SEC
  if (GUIDE_USE_PRECISE_CUES && cues.length === GUIDE_SCENES.length) {
    const lastEnd = Math.min(durationSec, GUIDE_CUE_END_SEC) || GUIDE_CUE_END_SEC
    return GUIDE_SCENES.map((_, i) => ({
      start: cues[i]!,
      end: i < cues.length - 1 ? cues[i + 1]! : Math.max(cues[i]! + 1, lastEnd),
    }))
  }

  const weights = GUIDE_SCENES.map((s) => Math.max(8, s.speech.replace(/\s+/g, '').length))
  const total = weights.reduce((a, b) => a + b, 0)
  let cursor = 0
  return weights.map((w) => {
    const len = (w / total) * durationSec
    const start = cursor
    const end = cursor + len
    cursor = end
    return { start, end }
  })
}

export function phaseStepCount(id: GuideSceneId): number {
  if (id === 'login') return 2
  if (id === 'register') return 7
  if (id === 'link') return 5
  if (id === 'request') return 5
  return 1
}

export function phaseForSceneTimed(
  id: GuideSceneId,
  elapsedSec: number,
  sceneDurationSec: number,
  _audioProgress: number,
): number {
  const steps = phaseStepCount(id)
  if (steps <= 1) return 0

  const dwell = Math.max(
    GUIDE_MIN_PHASE_SEC * 0.75,
    sceneDurationSec / steps,
  )
  return Math.min(steps - 1, Math.floor(elapsedSec / dwell))
}

export async function audioExists(src: string): Promise<boolean> {
  try {
    const res = await fetch(src, { method: 'HEAD', cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

/** Always play voice-over at normal speed. */
export function applyNormalPlayback(audio: HTMLAudioElement) {
  audio.playbackRate = 1
  audio.defaultPlaybackRate = 1
  audio.preservesPitch = true
}
