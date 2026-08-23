import { type FormEvent, useMemo, useState } from 'react'
import { createManagedUser } from '../../lib/adminCreateUser'
import { supabase } from '../../lib/supabase'
import { SECTIONS } from '../../lib/types'
import { ErrorBox, PrimaryButton, SecondaryButton } from '../../components/ui'

interface ImportRow {
  student_national_id: string
  student_name: string
  grade: string
  section: string
  guardian_national_id: string
  guardian_name: string
  guardian_phone: string
  error?: string
}

function parseCsv(text: string): ImportRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim())
  const required = [
    'student_national_id',
    'student_name',
    'grade',
    'section',
    'guardian_national_id',
    'guardian_name',
    'guardian_phone',
  ]
  for (const r of required) {
    if (!headers.includes(r)) {
      throw new Error(`عمود مطلوب مفقود: ${r}`)
    }
  }

  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim())
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = cols[i] ?? ''
    })
    return obj as unknown as ImportRow
  })
}

function validateRow(row: ImportRow, seenStudents: Set<string>): string | null {
  if (!row.student_national_id) return 'رقم هوية الطالب مطلوب'
  if (!row.student_name) return 'اسم الطالب مطلوب'
  if (!row.guardian_national_id) return 'رقم هوية ولي الأمر مطلوب'
  if (!row.guardian_name) return 'اسم ولي الأمر مطلوب'
  const grade = Number(row.grade)
  if (!Number.isInteger(grade) || grade < 1 || grade > 6) return 'صف غير صالح'
  if (!SECTIONS.includes(row.section as (typeof SECTIONS)[number])) return 'فصل غير صالح'
  if (seenStudents.has(row.student_national_id)) return 'تكرار رقم هوية الطالب في الملف'
  seenStudents.add(row.student_national_id)
  return null
}

export function AdminImportPage() {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [importing, setImporting] = useState(false)

  const invalidCount = useMemo(() => rows.filter((r) => r.error).length, [rows])

  async function onFile(file: File) {
    setError('')
    setSummary('')
    try {
      const text = await file.text()
      const parsed = parseCsv(text)
      const seen = new Set<string>()
      setRows(
        parsed.map((r) => {
          const err = validateRow(r, seen)
          return err ? { ...r, error: err } : r
        }),
      )
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : 'تعذر قراءة الملف.')
    }
  }

  async function onImport(e: FormEvent) {
    e.preventDefault()
    const valid = rows.filter((r) => !r.error)
    if (valid.length === 0 || invalidCount > 0) {
      setError('أصلح أخطاء التحقق قبل الاستيراد. لن يتم الاستيراد الجزئي الصامت.')
      return
    }

    setImporting(true)
    setError('')
    setSummary('')

    try {
      const { data: classes, error: classErr } = await supabase.from('classes').select('*')
      if (classErr) throw classErr

      let createdParents = 0
      let createdStudents = 0
      let updatedStudents = 0

      for (const row of valid) {
        const grade = Number(row.grade)
        const schoolClass = classes?.find((c) => c.grade === grade && c.section === row.section)
        if (!schoolClass) throw new Error(`الفصل غير موجود: ${grade} ${row.section}`)

        let { data: parent } = await supabase
          .from('profiles')
          .select('*')
          .eq('national_id', row.guardian_national_id)
          .eq('role', 'PARENT')
          .maybeSingle()

        if (!parent) {
          const tempPassword = `Tmp-${row.guardian_national_id.slice(-4)}!aA1`
          const email = `parent.${row.guardian_national_id}@isteathan.local`
          await createManagedUser({
            role: 'PARENT',
            email,
            password: tempPassword,
            full_name: row.guardian_name,
            national_id: row.guardian_national_id,
            phone: row.guardian_phone || null,
          })
          createdParents += 1
          const refetch = await supabase
            .from('profiles')
            .select('*')
            .eq('national_id', row.guardian_national_id)
            .maybeSingle()
          parent = refetch.data
        }

        if (!parent) throw new Error('تعذر ربط ولي الأمر')

        const existing = await supabase
          .from('students')
          .select('id')
          .eq('national_id', row.student_national_id)
          .maybeSingle()

        const payload = {
          national_id: row.student_national_id,
          full_name: row.student_name,
          grade,
          class_id: schoolClass.id,
          guardian_id: parent.id,
          is_active: true,
        }

        if (existing.data?.id) {
          const { error: upErr } = await supabase
            .from('students')
            .update(payload)
            .eq('id', existing.data.id)
          if (upErr) throw upErr
          updatedStudents += 1
        } else {
          const { error: insErr } = await supabase.from('students').insert(payload)
          if (insErr) throw insErr
          createdStudents += 1
        }
      }

      setSummary(
        `تم الاستيراد: أولياء جدد ${createdParents}، طلاب جدد ${createdStudents}، تحديث طلاب ${updatedStudents}.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الاستيراد.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--color-gold)]">استيراد طلاب</h1>
      <p className="text-[var(--color-muted)]">
        ارفع ملف CSV بالأعمدة: student_national_id, student_name, grade, section,
        guardian_national_id, guardian_name, guardian_phone
      </p>

      <form onSubmit={onImport} className="space-y-3 glass-panel glass-interactive p-4">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
          }}
        />
        <div className="flex flex-wrap gap-2">
          <PrimaryButton type="submit" disabled={importing || rows.length === 0}>
            {importing ? 'جاري الاستيراد...' : 'تأكيد الاستيراد'}
          </PrimaryButton>
          <SecondaryButton
            type="button"
            onClick={() => {
              setRows([])
              setError('')
              setSummary('')
            }}
          >
            مسح
          </SecondaryButton>
        </div>
        <ErrorBox message={error} />
        {summary ? <p className="text-sm text-[var(--color-gold-soft)]">{summary}</p> : null}
        {rows.length > 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            صفوف: {rows.length} — أخطاء: {invalidCount}
          </p>
        ) : null}
      </form>

      {rows.length > 0 ? (
        <div className="overflow-x-auto glass-panel">
          <table className="min-w-full text-sm">
            <thead className="bg-[rgba(15,42,92,0.35)]">
              <tr>
                {['طالب', 'صف', 'فصل', 'ولي الأمر', 'حالة'].map((h) => (
                  <th key={h} className="px-3 py-2 text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.student_national_id}-${i}`} className="border-t border-[rgba(201,162,39,0.15)]">
                  <td className="px-3 py-2">{r.student_name}</td>
                  <td className="px-3 py-2">{r.grade}</td>
                  <td className="px-3 py-2">{r.section}</td>
                  <td className="px-3 py-2">{r.guardian_name}</td>
                  <td className={`px-3 py-2 ${r.error ? 'text-[#ffb0b0]' : 'text-[#7aefb5]'}`}>
                    {r.error ?? 'جاهز'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
