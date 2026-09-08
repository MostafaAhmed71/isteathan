/** Parent request submission windows (Asia/Riyadh school time). */

/** Set true to restore school-hours restriction in the UI. */
export const REQUEST_TIME_WINDOW_ENABLED = false

export const SCHOOL_TIME_ZONE = 'Asia/Riyadh'

/** Shared end of the daily submission window (12:30). */
export const REQUEST_CLOSE_MINUTES = 12 * 60 + 30

/** Minutes from midnight when requests open for a grade. */
export function requestOpenMinutes(grade: number): number {
  if (grade >= 1 && grade <= 3) return 11 * 60 + 10
  if (grade >= 4 && grade <= 6) return 11 * 60 + 40
  return 11 * 60 + 40
}

export function requestOpenLabel(grade: number): string {
  if (grade >= 1 && grade <= 3) return '11:10 ص'
  if (grade >= 4 && grade <= 6) return '11:40 ص'
  return '—'
}

export function requestCloseLabel(): string {
  return '12:30 م'
}

export function requestWindowLabel(grade: number): string {
  return `${requestOpenLabel(grade)} حتى ${requestCloseLabel()}`
}

export function gradeBandLabel(grade: number): string {
  if (grade >= 1 && grade <= 3) return 'الأولية'
  if (grade >= 4 && grade <= 6) return 'العليا'
  return ''
}

function riyadhParts(at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHOOL_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(at)

  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0')

  return {
    hour: num('hour'),
    minute: num('minute'),
    second: num('second'),
  }
}

export function riyadhMinutesNow(at: Date = new Date()): number {
  const { hour, minute } = riyadhParts(at)
  return hour * 60 + minute
}

export function canSubmitRequest(grade: number, at: Date = new Date()): boolean {
  if (!REQUEST_TIME_WINDOW_ENABLED) return true
  const minutes = riyadhMinutesNow(at)
  return minutes >= requestOpenMinutes(grade) && minutes < REQUEST_CLOSE_MINUTES
}

export function requestWindowMessage(grade: number, at: Date = new Date()): string | null {
  if (!REQUEST_TIME_WINDOW_ENABLED) return null
  if (canSubmitRequest(grade, at)) return null
  const band = gradeBandLabel(grade)
  const window = requestWindowLabel(grade)
  const minutes = riyadhMinutesNow(at)
  if (minutes < requestOpenMinutes(grade)) {
    return `لم يحن وقت تقديم الطلبات بعد. تقديم طلبات الصفوف ${band} متاح من ${window} (توقيت الرياض).`
  }
  return `انتهى وقت تقديم الطلبات. تقديم طلبات الصفوف ${band} متاح من ${window} (توقيت الرياض).`
}

export function isRequestWindowError(message: string): boolean {
  return (
    message.includes('لم يحن وقت تقديم الطلبات') ||
    message.includes('انتهى وقت تقديم الطلبات') ||
    message.includes('يبدأ التقديم') ||
    message.includes('متاح من')
  )
}
