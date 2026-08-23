import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ErrorBox, PrimaryButton, TextField } from '../../components/ui'
import { classLabel, type SchoolClass } from '../../lib/types'
import { sortClasses } from '../../lib/classStaff'

type ClassContact = {
  id: string
  class_id: string
  supervisor_name: string
  whatsapp_number: string
  grade: number
  section: string
}

type RosterRow = {
  id: string
  grade: number
  weekday: number
  supervisor_name: string
  whatsapp_number: string
}

type WaStatus = {
  connected: boolean
  state: string
  qr: string | null
}

const WEEKDAYS = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الاثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' },
]

const UPPER_GRADES = [
  { grade: 4, title: 'الصف الرابع' },
  { grade: 5, title: 'الصف الخامس' },
  { grade: 6, title: 'الصف السادس' },
]

export function AdminWhatsAppPage() {
  const [contacts, setContacts] = useState<ClassContact[]>([])
  const [roster, setRoster] = useState<RosterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savingGrade, setSavingGrade] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [status, setStatus] = useState<WaStatus | null>(null)

  async function reload() {
    const [classesRes, contactsRes, rosterRes] = await Promise.all([
      supabase.from('classes').select('*').in('grade', [1, 2, 3]).order('grade').order('section'),
      supabase.from('supervisor_class_contacts').select('*'),
      supabase.from('supervisor_daily_roster').select('*').order('grade').order('weekday'),
    ])
    if (classesRes.error || contactsRes.error || rosterRes.error) {
      setError(
        'تعذر تحميل المشرفين. نفّذ ملف supabase/migrations/011_primary_class_supervisors.sql في محرر SQL.',
      )
    } else {
      setError('')
      const classes = sortClasses((classesRes.data as SchoolClass[]) ?? [])
      const byClass = new Map(
        ((contactsRes.data as { class_id: string; id: string; supervisor_name: string; whatsapp_number: string }[]) ??
          []).map((row) => [row.class_id, row]),
      )
      setContacts(
        classes.map((c) => {
          const row = byClass.get(c.id)
          return {
            id: row?.id ?? c.id,
            class_id: c.id,
            supervisor_name: row?.supervisor_name ?? '',
            whatsapp_number: row?.whatsapp_number ?? '',
            grade: c.grade,
            section: c.section,
          }
        }),
      )
      setRoster((rosterRes.data as RosterRow[]) ?? [])
    }
    setLoading(false)
  }

  async function loadStatus() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch('/api/whatsapp-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const contentType = res.headers.get('content-type') ?? ''
      if (res.ok && contentType.includes('application/json')) {
        setStatus((await res.json()) as WaStatus)
        return
      }
      const { data, error } = await supabase.functions.invoke('whatsapp-status')
      if (!error && data) {
        setStatus(data as WaStatus)
        return
      }
      setStatus({ connected: false, state: 'gateway_offline', qr: null })
    } catch {
      setStatus({ connected: false, state: 'gateway_offline', qr: null })
    }
  }

  useEffect(() => {
    void reload()
    void loadStatus()
    const timer = window.setInterval(() => void loadStatus(), 8000)
    return () => window.clearInterval(timer)
  }, [])

  async function saveContact(contact: ClassContact) {
    setSavingId(contact.class_id)
    setInfo('')
    const { error: err } = await supabase.from('supervisor_class_contacts').upsert(
      {
        class_id: contact.class_id,
        supervisor_name: contact.supervisor_name.trim(),
        whatsapp_number: contact.whatsapp_number.trim(),
      },
      { onConflict: 'class_id' },
    )
    setSavingId(null)
    if (err) setError(err.message)
    else setInfo(`تم حفظ مشرف ${classLabel(contact.grade, contact.section)}.`)
  }

  async function saveGradeRoster(grade: number) {
    setSavingGrade(grade)
    setInfo('')
    const rows = roster.filter((r) => r.grade === grade)
    const { error: err } = await supabase.from('supervisor_daily_roster').upsert(
      rows.map((r) => ({
        id: r.id,
        grade: r.grade,
        weekday: r.weekday,
        supervisor_name: r.supervisor_name.trim(),
        whatsapp_number: r.whatsapp_number.trim(),
      })),
    )
    setSavingGrade(null)
    if (err) setError(err.message)
    else setInfo(`تم حفظ جدول الصف ${grade === 4 ? 'الرابع' : grade === 5 ? 'الخامس' : 'السادس'}.`)
  }

  const statusLabel = status?.connected
    ? 'متصل'
    : status?.state === 'qr'
      ? 'بانتظار مسح رمز QR'
      : status?.state === 'gateway_offline'
        ? 'غير متصل (خدمة WhatsApp غير شغّالة)'
        : 'غير متصل'

  const contactsByGrade = useMemo(() => {
    const map = new Map<number, ClassContact[]>()
    for (const c of contacts) {
      const list = map.get(c.grade) ?? []
      list.push(c)
      map.set(c.grade, list)
    }
    return map
  }, [contacts])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-gold)]">مشرفو الاستئذان</h1>
      <p className="text-[var(--color-muted)]">
        الصفوف الأولية (1–3): مشرف واتساب ثابت لكل فصل (أ / ب / ج / د). الصفوف 4–6: مشرف لكل صف
        يتغيّر حسب اليوم (توقيت الرياض).
      </p>

      <article className="glass-panel p-4">
        <p className="text-sm text-[var(--color-muted)]">WhatsApp</p>
        <p className="mt-1 text-xl font-bold text-[var(--color-text)]">{statusLabel}</p>
        {status?.qr ? (
          <img
            alt="رمز ربط واتساب"
            src={status.qr.startsWith('data:') ? status.qr : `data:image/png;base64,${status.qr}`}
            className="mt-4 w-52 rounded-xl bg-white p-2"
          />
        ) : null}
      </article>

      {loading ? <p className="text-[var(--color-muted)]">جاري التحميل...</p> : null}
      <ErrorBox message={error} />
      {info ? <p className="text-sm text-[var(--color-gold-soft)]">{info}</p> : null}

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-[var(--color-gold)]">الفصول الأولية 1–3 (مشرف لكل فصل)</h2>
        {[1, 2, 3].map((grade) => (
          <div key={grade} className="space-y-3">
            <h3 className="font-semibold text-[var(--color-text)]">
              الصف {grade === 1 ? 'الأول' : grade === 2 ? 'الثاني' : 'الثالث'}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {(contactsByGrade.get(grade) ?? []).map((c) => (
                <article key={c.class_id} className="glass-panel p-4">
                  <h4 className="mb-3 font-bold text-[var(--color-gold)]">
                    {classLabel(c.grade, c.section)}
                  </h4>
                  <div className="space-y-3">
                    <TextField
                      label="المشرف"
                      value={c.supervisor_name}
                      onChange={(e) =>
                        setContacts((rows) =>
                          rows.map((row) =>
                            row.class_id === c.class_id
                              ? { ...row, supervisor_name: e.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <TextField
                      label="رقم WhatsApp"
                      value={c.whatsapp_number}
                      onChange={(e) =>
                        setContacts((rows) =>
                          rows.map((row) =>
                            row.class_id === c.class_id
                              ? { ...row, whatsapp_number: e.target.value }
                              : row,
                          ),
                        )
                      }
                      placeholder="05XXXXXXXX"
                      inputMode="tel"
                    />
                    <PrimaryButton
                      type="button"
                      disabled={savingId === c.class_id}
                      onClick={() => void saveContact(c)}
                    >
                      {savingId === c.class_id ? 'جاري الحفظ...' : 'حفظ'}
                    </PrimaryButton>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--color-gold)]">الصفوف 4–6 (مشرف يومي)</h2>
        {UPPER_GRADES.map(({ grade, title }) => (
          <article key={grade} className="glass-panel space-y-3 p-4">
            <h3 className="font-bold text-[var(--color-gold)]">{title}</h3>
            <div className="space-y-4">
              {WEEKDAYS.map((day) => {
                const row = roster.find((r) => r.grade === grade && r.weekday === day.value)
                if (!row) return null
                return (
                  <div key={row.id} className="grid gap-3 md:grid-cols-[7rem_1fr_1fr]">
                    <p className="pt-8 font-semibold text-[var(--color-text)]">{day.label}</p>
                    <TextField
                      label="المشرف"
                      value={row.supervisor_name}
                      onChange={(e) =>
                        setRoster((rows) =>
                          rows.map((item) =>
                            item.id === row.id
                              ? { ...item, supervisor_name: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <TextField
                      label="رقم WhatsApp"
                      value={row.whatsapp_number}
                      onChange={(e) =>
                        setRoster((rows) =>
                          rows.map((item) =>
                            item.id === row.id
                              ? { ...item, whatsapp_number: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="05XXXXXXXX"
                      inputMode="tel"
                    />
                  </div>
                )
              })}
            </div>
            <PrimaryButton
              type="button"
              disabled={savingGrade === grade}
              onClick={() => void saveGradeRoster(grade)}
            >
              {savingGrade === grade ? 'جاري الحفظ...' : `حفظ جدول ${title}`}
            </PrimaryButton>
          </article>
        ))}
      </section>
    </div>
  )
}
