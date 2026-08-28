/** Persistent AudioContext — required for reliable chimes on Android smart screens. */
let sharedCtx: AudioContext | null = null
let unlocked = false
let keepAliveTimer = 0

function getAudioContext(): AudioContext | null {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null
  if (!sharedCtx) sharedCtx = new AudioCtx()
  return sharedCtx
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/** Must be called from a user tap once (Android blocks autoplay otherwise). */
export async function unlockDisplayAudio(): Promise<boolean> {
  try {
    const ctx = getAudioContext()
    if (!ctx) return false
    if (ctx.state === 'suspended') await ctx.resume()
    const buffer = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.start(0)
    unlocked = true
    void loadVoices()
    await playDisplayChime()
    return true
  } catch {
    return false
  }
}

export function isDisplayAudioUnlocked(): boolean {
  return unlocked
}

/** Louder multi-tone alert (plays twice). */
export async function playDisplayChime(): Promise<void> {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') await ctx.resume()

    const playBurst = (offset: number) => {
      const notes = [
        { f: 880, d: 0.18 },
        { f: 1174.66, d: 0.22 },
        { f: 1396.91, d: 0.35 },
      ]
      notes.forEach((note, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.value = note.f
        const t0 = ctx.currentTime + offset + i * 0.14
        gain.gain.setValueAtTime(0.0001, t0)
        gain.gain.exponentialRampToValueAtTime(0.32, t0 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.d)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t0)
        osc.stop(t0 + note.d + 0.05)
      })
    }

    playBurst(0)
    playBurst(0.65)
    await wait(1100)
  } catch {
    // ignore
  }
}

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([])
  }
  if (voicesReady) return voicesReady
  voicesReady = new Promise((resolve) => {
    const read = () => window.speechSynthesis.getVoices()
    const existing = read()
    if (existing.length > 0) {
      resolve(existing)
      return
    }
    const finish = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', finish)
      const list = read()
      if (list.length === 0) voicesReady = null
      resolve(list)
    }
    window.speechSynthesis.addEventListener('voiceschanged', finish)
    window.setTimeout(finish, 1500)
  })
  return voicesReady
}

function scoreArabicVoice(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase().replace('_', '-')
  const name = voice.name.toLowerCase()
  let score = 0
  if (lang.startsWith('ar')) score += 80
  else if (/arabic|عربي/.test(name)) score += 60
  else return 0
  if (lang.startsWith('ar-sa')) score += 25
  if (/natural|online|neural|premium/.test(name)) score += 20
  if (/naayf|hamed|zariyah|hoda|google/.test(name)) score += 8
  if (voice.localService) score += 4
  return score
}

function pickArabicVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null
  let bestScore = 0
  for (const voice of voices) {
    const score = scoreArabicVoice(voice)
    if (score > bestScore) {
      best = voice
      bestScore = score
    }
  }
  return bestScore >= 60 ? best : null
}

export async function hasArabicDisplayVoice(): Promise<boolean> {
  if (!('speechSynthesis' in window)) return false
  return pickArabicVoice(await loadVoices()) !== null
}

function stopKeepAlive() {
  if (keepAliveTimer) {
    window.clearInterval(keepAliveTimer)
    keepAliveTimer = 0
  }
}

/** Chrome/Edge drop speech after ~15s unless pause/resume is pulsed. */
function startKeepAlive() {
  stopKeepAlive()
  keepAliveTimer = window.setInterval(() => {
    if (!window.speechSynthesis.speaking) {
      stopKeepAlive()
      return
    }
    window.speechSynthesis.pause()
    window.speechSynthesis.resume()
  }, 5000)
}

function cleanName(raw: string): string {
  return raw.replace(/ـ+/g, '').replace(/\s+/g, ' ').trim()
}

async function speakArabic(text: string): Promise<void> {
  if (!('speechSynthesis' in window) || !text.trim()) return
  const voices = await loadVoices()
  const voice = pickArabicVoice(voices)

  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    window.speechSynthesis.cancel()
    await wait(250)
  }

  await new Promise<void>((resolve) => {
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = voice?.lang || 'ar-SA'
    utter.rate = 0.92
    utter.pitch = 1
    utter.volume = 1
    if (voice) utter.voice = voice

    const done = () => {
      stopKeepAlive()
      resolve()
    }
    utter.onend = done
    utter.onerror = done
    startKeepAlive()
    window.speechSynthesis.speak(utter)
  })
}

export async function announceNewRequest(studentName?: string): Promise<void> {
  await playDisplayChime()
  try {
    const name = studentName ? cleanName(studentName) : ''
    const text = name
      ? `طلب خروج جديد للطالب ${name}`
      : 'طلب خروج جديد'
    await speakArabic(text)
  } catch {
    // chime alone is enough
  }
}

export async function announceDecision(
  studentName: string | undefined,
  status: 'APPROVED' | 'REJECTED',
): Promise<void> {
  await playDisplayChime()
  try {
    const name = studentName ? cleanName(studentName) : 'الطالب'
    const text =
      status === 'APPROVED'
        ? `تمت الموافقة على خروج الطالب ${name}`
        : `تم رفض خروج الطالب ${name}`
    await speakArabic(text)
  } catch {
    // chime alone is enough
  }
}

export async function requestDisplayWakeLock(): Promise<WakeLockSentinel | null> {
  try {
    if (!('wakeLock' in navigator)) return null
    return await navigator.wakeLock.request('screen')
  } catch {
    return null
  }
}
