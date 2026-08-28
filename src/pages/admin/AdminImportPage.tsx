import { type FormEvent, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { createManagedUser } from '../../lib/adminCreateUser'
import { supabase } from '../../lib/supabase'
import { GRADE_LABELS, SECTIONS } from '../../lib/types'
import { ErrorBox, PrimaryButton, SecondaryButton } from '../../components/ui'

interface ImportRow {
  student_name: string
  student_national_id: string
  grade: number
  section: string
  guardian_phone: string
  guardian_name: string
  guardian_national_id: string
  error?: string
  importStatus?: 'ready' | 'skipped' | 'importing' | 'done' | 'failed'
  importMessage?: string
}

interface ImportProgress {
  current: number
  total: number
  name: string
  created: number
  updated: number
  failed: number
}

const GRADE_FROM_LABEL: Record<string, number> = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  الأول: 1,
  الاول: 1,
  اول: 1,
  ثاني: 2,
  الثاني: 2,
  ثالث: 3,
  الثالث: 3,
  رابع: 4,
  الرابع: 4,
  خامس: 5,
  الخامس: 5,
  سادس: 6,
  السادس: 6,
  'الصف الأول': 1,
  'الصف الاول': 1,
  'الصف الثاني': 2,
  'الصف الثالث': 3,
  'الصف الرابع': 4,
  'الصف الخامس': 5,
  'الصف السادس': 6,
  'الأول الابتدائي': 1,
  'الاول الابتدائي': 1,
  'الثاني الابتدائي': 2,
  'الثالث الابتدائي': 3,
  'الرابع الابتدائي': 4,
  'الخامس الابتدائي': 5,
  'السادس الابتدائي': 6,
  'الصف الأول الابتدائي': 1,
  'الصف الاول الابتدائي': 1,
  'الصف الثاني الابتدائي': 2,
  'الصف الثالث الابتدائي': 3,
  'الصف الرابع الابتدائي': 4,
  'الصف الخامس الابتدائي': 5,
  'الصف السادس الابتدائي': 6,
  'اول ابتدائي': 1,
  'أول ابتدائي': 1,
  'ثاني ابتدائي': 2,
  'ثالث ابتدائي': 3,
  'رابع ابتدائي': 4,
  'خامس ابتدائي': 5,
  'سادس ابتدائي': 6,
}

const GRADE_ORDINAL_WORDS: Array<{ needle: string; grade: number }> = [
  { needle: 'سادس', grade: 6 },
  { needle: 'خامس', grade: 5 },
  { needle: 'رابع', grade: 4 },
  { needle: 'ثالث', grade: 3 },
  { needle: 'ثاني', grade: 2 },
  { needle: 'اول', grade: 1 },
]

/** Fold Arabic/Latin headers for tolerant matching. */
function foldHeader(raw: string): string {
  return String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[_./\\|:;،,-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const HEADER_ALIASES: Record<string, string> = {
  'اسم الطالب': 'student_name',
  'اسم الطالب الثلاثي': 'student_name',
  'اسم الطالب الكامل': 'student_name',
  'اسم الكامل': 'student_name',
  الاسم: 'student_name',
  اسم: 'student_name',
  student: 'student_name',
  'student name': 'student_name',
  student_name: 'student_name',
  name: 'student_name',
  'رقم الهويه': 'student_national_id',
  'رقم هويه الطالب': 'student_national_id',
  'هويه الطالب': 'student_national_id',
  'الهويه الوطنيه': 'student_national_id',
  'رقم الهويه الوطنيه': 'student_national_id',
  'السجل المدني': 'student_national_id',
  'رقم السجل المدني': 'student_national_id',
  الهويه: 'student_national_id',
  student_national_id: 'student_national_id',
  'national id': 'student_national_id',
  national_id: 'student_national_id',
  الصف: 'grade',
  'الصف الدراسي': 'grade',
  'صف الطالب': 'grade',
  المرحله: 'grade',
  'المرحله الدراسيه': 'grade',
  المستوى: 'grade',
  grade: 'grade',
  class: 'grade',
  'رقم الجوال': 'guardian_phone',
  'جوال ولي الامر': 'guardian_phone',
  'رقم جوال ولي الامر': 'guardian_phone',
  'هاتف ولي الامر': 'guardian_phone',
  'رقم هاتف ولي الامر': 'guardian_phone',
  'جوال الوالد': 'guardian_phone',
  الجوال: 'guardian_phone',
  الهاتف: 'guardian_phone',
  الموبايل: 'guardian_phone',
  phone: 'guardian_phone',
  mobile: 'guardian_phone',
  guardian_phone: 'guardian_phone',
  الفصل: 'section',
  الشعبه: 'section',
  section: 'section',
  'اسم ولي الامر': 'guardian_name',
  'ولي الامر': 'guardian_name',
  guardian_name: 'guardian_name',
  'هويه ولي الامر': 'guardian_national_id',
  'رقم هويه ولي الامر': 'guardian_national_id',
  guardian_national_id: 'guardian_national_id',
}

function resolveHeader(raw: string): string {
  const key = foldHeader(raw)
  if (!key) return ''
  if (HEADER_ALIASES[key]) return HEADER_ALIASES[key]

  // Order matters: more specific phrases first.
  if (
    (key.includes('هويه') || key.includes('سجل')) &&
    (key.includes('ولي') || key.includes('والد') || key.includes('اب'))
  ) {
    return 'guardian_national_id'
  }
  if (key.includes('اسم') && (key.includes('ولي') || key.includes('والد') || key.includes('اب'))) {
    return 'guardian_name'
  }
  if (
    key.includes('جوال') ||
    key.includes('هاتف') ||
    key.includes('موبايل') ||
    key.includes('phone') ||
    key.includes('mobile')
  ) {
    return 'guardian_phone'
  }
  if (
    key.includes('هويه') ||
    key.includes('سجل مدني') ||
    key.includes('national') ||
    key === 'id'
  ) {
    return 'student_national_id'
  }
  if (key.includes('فصل') || key.includes('شعبه') || key === 'section') {
    return 'section'
  }
  if (
    key.includes('صف') ||
    key.includes('مرحله') ||
    key.includes('مستوى') ||
    key === 'grade' ||
    key === 'class'
  ) {
    return 'grade'
  }
  if (key.includes('طالب') || key.includes('اسم') || key === 'name' || key === 'student') {
    return 'student_name'
  }
  return key
}

function parseGrade(raw: string): number | null {
  const value = String(raw ?? '').trim()
  if (!value) return null
  if (GRADE_FROM_LABEL[value] != null) return GRADE_FROM_LABEL[value]

  const folded = foldHeader(value)
  if (!folded) return null
  if (GRADE_FROM_LABEL[folded] != null) return GRADE_FROM_LABEL[folded]

  // e.g. "1 ابتدائي", "صف 3"
  const digitMatch = folded.match(/(?:^|[^\d])([1-6])(?:[^\d]|$)/)
  if (digitMatch) return Number(digitMatch[1])

  // e.g. "الأول الابتدائي", "الصف الثاني الابتدائي"
  for (const { needle, grade } of GRADE_ORDINAL_WORDS) {
    if (folded.includes(needle)) return grade
  }
  return null
}

function normalizePhone(raw: string): string {
  let value = String(raw ?? '').trim().replace(/[^\d+]/g, '')
  if (value.startsWith('+')) value = value.slice(1)
  if (value.startsWith('00')) value = value.slice(2)
  value = value.replace(/\D/g, '')
  if (value.startsWith('966') && value.length >= 12) return `0${value.slice(3, 12)}`
  if (value.startsWith('5') && value.length === 9) return `0${value}`
  return value
}

function phoneAsNationalId(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return digits
  if (digits.length > 10) return digits.slice(-10)
  return digits.padStart(10, '0')
}

function cell(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (value == null) return ''
  return String(value).trim()
}

const REQUIRED_HEADERS: Array<{ key: string; label: string }> = [
  { key: 'student_name', label: 'اسم الطالب' },
  { key: 'student_national_id', label: 'رقم الهوية' },
  { key: 'grade', label: 'الصف' },
]

function normalizeSection(raw: string): string {
  const value = String(raw ?? '').trim()
  if (!value) return 'أ'
  if ((SECTIONS as readonly string[]).includes(value)) return value
  const folded = value
    .normalize('NFKC')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/\s+/g, '')
    .toLowerCase()
  if (folded === 'ا' || folded === 'a' || folded === '1') return 'أ'
  if (folded === 'ب' || folded === 'b' || folded === '2') return 'ب'
  if (folded === 'ج' || folded === 'c' || folded === 'g' || folded === '3') return 'ج'
  if (folded === 'د' || folded === 'd' || folded === '4') return 'د'
  return value
}

function rowsFromSheet(matrix: unknown[][]): ImportRow[] {
  if (matrix.length < 2) return []

  let headerRowIndex = 0
  for (let i = 0; i < Math.min(6, matrix.length); i++) {
    const candidate = ((matrix[i] as unknown[]) ?? []).map((h) => resolveHeader(String(h ?? '')))
    if (REQUIRED_HEADERS.every((r) => candidate.includes(r.key))) {
      headerRowIndex = i
      break
    }
  }

  const rawHeaders = ((matrix[headerRowIndex] as unknown[]) ?? []).map((h) => String(h ?? '').trim())
  const headers = rawHeaders.map((h) => resolveHeader(h))
  const missing = REQUIRED_HEADERS.filter((r) => !headers.includes(r.key))
  if (missing.length) {
    const seen = rawHeaders.filter(Boolean).join('، ') || '(لا عناوين)'
    throw new Error(
      `عمود مطلوب مفقود: ${missing.map((m) => m.label).join('، ')}. ` +
        `الأعمدة المتوقعة: اسم الطالب، رقم الهوية، الصف، الفصل (اختياري)، رقم الجوال (اختياري). ` +
        `العناوين في ملفك: ${seen}`,
    )
  }

  const out: ImportRow[] = []
  for (const raw of matrix.slice(headerRowIndex + 1)) {
    const cols = (raw as unknown[]) ?? []
    if (cols.every((c) => c == null || String(c).trim() === '')) continue
    const mapped: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      mapped[h] = cols[i]
    })

    const studentName = cell(mapped, 'student_name')
    const studentNid = cell(mapped, 'student_national_id').replace(/\D/g, '')
    const grade = parseGrade(cell(mapped, 'grade'))
    const sectionRaw = normalizeSection(cell(mapped, 'section'))
    const phone = normalizePhone(cell(mapped, 'guardian_phone'))
    const guardianName = cell(mapped, 'guardian_name') || (studentName ? `ولي أمر ${studentName}` : '')
    const guardianNid =
      cell(mapped, 'guardian_national_id').replace(/\D/g, '') || (phone ? phoneAsNationalId(phone) : '')

    out.push({
      student_name: studentName,
      student_national_id: studentNid,
      grade: grade ?? 0,
      section: sectionRaw,
      guardian_phone: phone,
      guardian_name: guardianName,
      guardian_national_id: guardianNid,
    })
  }
  return out
}

async function parseImportFile(file: File): Promise<ImportRow[]> {
  const name = file.name.toLowerCase()
  const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.ods')

  let workbook: XLSX.WorkBook
  if (isExcel) {
    const buffer = await file.arrayBuffer()
    workbook = XLSX.read(buffer, { type: 'array', codepage: 65001, raw: false })
  } else {
    const text = (await file.text()).replace(/^\uFEFF/, '')
    const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? ''
    const delim = ([';', '\t', ','] as const)
      .map((d) => [d, firstLine.split(d).length] as const)
      .sort((a, b) => b[1] - a[1])[0][0]
    workbook = XLSX.read(text, { type: 'string', FS: delim, codepage: 65001, raw: false })
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('الملف لا يحتوي على أوراق.')
  const sheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as unknown[][]
  if (matrix.length < 2) throw new Error('الملف فارغ أو بدون صف بيانات.')
  return rowsFromSheet(matrix)
}

function validateRow(row: ImportRow, seenStudents: Set<string>): string | null {
  if (!row.student_national_id) return 'رقم هوية الطالب مطلوب'
  if (!/^\d{10}$/.test(row.student_national_id)) return 'رقم هوية الطالب يجب أن يكون 10 أرقام'
  if (!row.student_name) return 'اسم الطالب مطلوب'
  if (!row.grade || row.grade < 1 || row.grade > 6) return 'صف غير صالح'
  if (!SECTIONS.includes(row.section as (typeof SECTIONS)[number])) {
    return 'الفصل غير صالح (أ / ب / ج / د) — إن لم يوجد عمود فصل يُستخدم أ تلقائياً'
  }
  if (row.guardian_phone && !/^05\d{8}$/.test(row.guardian_phone)) {
    return 'رقم الجوال غير صالح (مثال: 0501234567)'
  }
  if (seenStudents.has(row.student_national_id)) return 'تكرار رقم هوية الطالب في الملف'
  seenStudents.add(row.student_national_id)
  return null
}

export function AdminImportPage() {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)

  const invalidCount = useMemo(() => rows.filter((r) => r.error).length, [rows])
  const validCount = useMemo(() => rows.length - invalidCount, [rows, invalidCount])
  const progressPct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0

  function patchRow(index: number, patch: Partial<ImportRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  async function yieldUi() {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0)
    })
  }

  async function onFile(file: File) {
    setError('')
    setSummary('')
    setProgress(null)
    try {
      const parsed = await parseImportFile(file)
      const seen = new Set<string>()
      setRows(
        parsed.map((r) => {
          const err = validateRow(r, seen)
          return err
            ? { ...r, error: err, importStatus: 'skipped' as const }
            : { ...r, importStatus: 'ready' as const }
        }),
      )
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : 'تعذر قراءة الملف.')
    }
  }

  async function onImport(e: FormEvent) {
    e.preventDefault()
    const validEntries = rows
      .map((r, index) => ({ r, index }))
      .filter(({ r }) => !r.error)
    if (validEntries.length === 0) {
      setError('لا توجد صفوف صالحة للاستيراد.')
      return
    }

    setImporting(true)
    setError('')
    setSummary('')
    setProgress({
      current: 0,
      total: validEntries.length,
      name: '',
      created: 0,
      updated: 0,
      failed: 0,
    })

    try {
      const { data: classes, error: classErr } = await supabase.from('classes').select('*')
      if (classErr) throw classErr

      let createdParents = 0
      let createdStudents = 0
      let updatedStudents = 0
      let linkedParents = 0
      const failed: string[] = []

      for (let i = 0; i < validEntries.length; i++) {
        const { r: row, index } = validEntries[i]
        const label = row.student_name || row.student_national_id || `صف ${i + 1}`
        setProgress({
          current: i,
          total: validEntries.length,
          name: label,
          created: createdStudents,
          updated: updatedStudents,
          failed: failed.length,
        })
        patchRow(index, { importStatus: 'importing', importMessage: 'جاري الحفظ...' })
        await yieldUi()

        try {
          const schoolClass = classes?.find((c) => c.grade === row.grade && c.section === row.section)
          if (!schoolClass) {
            const msg = 'الفصل غير موجود'
            failed.push(`${label}: ${msg}`)
            patchRow(index, { importStatus: 'failed', importMessage: msg })
            continue
          }

          let parentId: string | null = null
          if (row.guardian_phone) {
            let parent =
              (
                await supabase
                  .from('profiles')
                  .select('*')
                  .eq('role', 'PARENT')
                  .eq('phone', row.guardian_phone)
                  .maybeSingle()
              ).data ??
              (
                await supabase
                  .from('profiles')
                  .select('*')
                  .eq('role', 'PARENT')
                  .eq('national_id', row.guardian_national_id)
                  .maybeSingle()
              ).data

            if (!parent) {
              const tempPassword = `Tmp-${row.guardian_phone.slice(-4)}!aA1`
              const email = `parent.${row.guardian_national_id}@isteathan.local`
              await createManagedUser({
                role: 'PARENT',
                email,
                password: tempPassword,
                full_name: row.guardian_name,
                national_id: row.guardian_national_id,
                phone: row.guardian_phone,
              })
              createdParents += 1
              const refetch = await supabase
                .from('profiles')
                .select('*')
                .eq('national_id', row.guardian_national_id)
                .eq('role', 'PARENT')
                .maybeSingle()
              parent = refetch.data
            } else {
              linkedParents += 1
              if (!parent.phone) {
                await supabase.from('profiles').update({ phone: row.guardian_phone }).eq('id', parent.id)
              }
            }

            if (!parent) {
              const msg = 'تعذر ربط ولي الأمر'
              failed.push(`${label}: ${msg}`)
              patchRow(index, { importStatus: 'failed', importMessage: msg })
              continue
            }
            parentId = parent.id
          }

          const existing = await supabase
            .from('students')
            .select('id, guardian_id')
            .eq('national_id', row.student_national_id)
            .maybeSingle()

          const payload: {
            national_id: string
            full_name: string
            grade: number
            class_id: string
            is_active: boolean
            guardian_id?: string | null
          } = {
            national_id: row.student_national_id,
            full_name: row.student_name,
            grade: row.grade,
            class_id: schoolClass.id,
            is_active: true,
          }
          if (parentId) payload.guardian_id = parentId

          if (existing.data?.id) {
            const { error: upErr } = await supabase
              .from('students')
              .update(payload)
              .eq('id', existing.data.id)
            if (upErr) throw upErr
            updatedStudents += 1
            patchRow(index, { importStatus: 'done', importMessage: 'تم التحديث' })
          } else {
            const { error: insErr } = await supabase
              .from('students')
              .insert({ ...payload, guardian_id: parentId })
            if (insErr) throw insErr
            createdStudents += 1
            patchRow(index, { importStatus: 'done', importMessage: 'تم الإضافة' })
          }
        } catch (rowErr) {
          const msg = rowErr instanceof Error ? rowErr.message : 'فشل'
          failed.push(`${label}: ${msg}`)
          patchRow(index, { importStatus: 'failed', importMessage: msg })
        }

        setProgress({
          current: i + 1,
          total: validEntries.length,
          name: label,
          created: createdStudents,
          updated: updatedStudents,
          failed: failed.length,
        })
        await yieldUi()
      }

      const skippedInvalid = invalidCount
      setSummary(
        `تم الاستيراد: طلاب جدد ${createdStudents}، تحديث ${updatedStudents}` +
          (createdParents || linkedParents
            ? `، أولياء جدد ${createdParents}، أولياء موجودون ${linkedParents}`
            : '') +
          (skippedInvalid ? `، تخطي غير صالح ${skippedInvalid}` : '') +
          (failed.length ? `، فشل أثناء الحفظ ${failed.length}` : '') +
          '.',
      )
      if (failed.length) {
        setError(failed.slice(0, 8).join(' · ') + (failed.length > 8 ? '…' : ''))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الاستيراد.')
    } finally {
      setImporting(false)
    }
  }

  function statusCell(r: ImportRow): { text: string; className: string } {
    if (r.error) return { text: r.error, className: 'text-[#ffb0b0]' }
    if (r.importStatus === 'importing') {
      return { text: r.importMessage ?? 'جاري الحفظ...', className: 'text-[var(--color-gold)]' }
    }
    if (r.importStatus === 'done') {
      return { text: r.importMessage ?? 'تم', className: 'text-[#7aefb5]' }
    }
    if (r.importStatus === 'failed') {
      return { text: r.importMessage ?? 'فشل', className: 'text-[#ffb0b0]' }
    }
    return { text: 'جاهز', className: 'text-[#7aefb5]' }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--color-gold)]">استيراد طلاب</h1>
      <p className="text-[var(--color-muted)]">
        ارفع ملف Excel أو CSV بالأعمدة: <strong>اسم الطالب</strong>، <strong>رقم الهوية</strong>،{' '}
        <strong>الصف</strong>، <strong>الفصل</strong>. عمود <strong>رقم الجوال</strong> اختياري —
        إن وُجد يُنشأ/يُربط ولي الأمر، وإلا يبقى الطالب بدون ولي أمر حتى يسجّل برقم الهوية.
        الصفوف الخاطئة تظهر في الجدول وتُتخطى، ويُستورد الباقي السليم.
      </p>

      <article className="glass-panel overflow-x-auto p-4">
        <p className="mb-2 text-sm text-[var(--color-muted)]">مثال تنسيق الملف</p>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-[var(--color-gold)]">
              {['اسم الطالب', 'رقم الهوية', 'الصف', 'الفصل'].map((h) => (
                <th key={h} className="px-3 py-2 text-right font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[rgba(201,162,39,0.15)]">
              <td className="px-3 py-2">محمد أحمد علي</td>
              <td className="px-3 py-2">1234567890</td>
              <td className="px-3 py-2">الأول الابتدائي</td>
              <td className="px-3 py-2">أ</td>
            </tr>
            <tr className="border-t border-[rgba(201,162,39,0.15)]">
              <td className="px-3 py-2">خالد محمود سعيد</td>
              <td className="px-3 py-2">0987654321</td>
              <td className="px-3 py-2">الثاني الابتدائي</td>
              <td className="px-3 py-2">ب</td>
            </tr>
          </tbody>
        </table>
      </article>

      <form onSubmit={onImport} className="space-y-3 glass-panel glass-interactive p-4">
        <input
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          disabled={importing}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
          }}
        />
        <div className="flex flex-wrap gap-2">
          <PrimaryButton type="submit" disabled={importing || validCount === 0}>
            {importing
              ? `جاري الاستيراد... ${progressPct}%`
              : invalidCount > 0
                ? `استيراد السليم (${validCount}) وتخطي ${invalidCount}`
                : 'تأكيد الاستيراد'}
          </PrimaryButton>
          <SecondaryButton
            type="button"
            disabled={importing}
            onClick={() => {
              setRows([])
              setError('')
              setSummary('')
              setProgress(null)
            }}
          >
            مسح
          </SecondaryButton>
          <a href="/sample-import.csv" download className="btn-secondary inline-flex items-center px-4 py-2">
            تنزيل نموذج CSV
          </a>
        </div>

        {progress ? (
          <div className="space-y-2 rounded-lg border border-[rgba(201,162,39,0.25)] bg-[rgba(15,42,92,0.35)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="font-bold text-[var(--color-gold)]">
                {importing ? 'جاري الاستيراد' : 'اكتمل الاستيراد'} — {progress.current} / {progress.total} (
                {progressPct}%)
              </p>
              <p className="text-[var(--color-muted)]">
                إضافة {progress.created} · تحديث {progress.updated} · فشل {progress.failed}
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
              <div
                className="h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {importing && progress.name ? (
              <p className="truncate text-sm text-[var(--color-muted)]">الآن: {progress.name}</p>
            ) : null}
          </div>
        ) : null}

        <ErrorBox message={error} />
        {summary ? <p className="text-sm text-[var(--color-gold-soft)]">{summary}</p> : null}
        {rows.length > 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            صفوف: {rows.length} — صالح: {validCount} — أخطاء (تُتخطى): {invalidCount}
          </p>
        ) : null}
      </form>

      {rows.length > 0 ? (
        <div className="overflow-x-auto glass-panel">
          <table className="min-w-full text-sm">
            <thead className="bg-[rgba(15,42,92,0.35)]">
              <tr>
                {['الطالب', 'الهوية', 'الصف', 'الفصل', 'الجوال', 'حالة'].map((h) => (
                  <th key={h} className="px-3 py-2 text-right">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const status = statusCell(r)
                return (
                  <tr
                    key={`${r.student_national_id}-${i}`}
                    className={`border-t border-[rgba(201,162,39,0.15)] ${
                      r.importStatus === 'importing' ? 'bg-[rgba(201,162,39,0.08)]' : ''
                    }`}
                  >
                    <td className="px-3 py-2">{r.student_name}</td>
                    <td className="px-3 py-2">{r.student_national_id}</td>
                    <td className="px-3 py-2">{GRADE_LABELS[r.grade] ?? r.grade}</td>
                    <td className="px-3 py-2">{r.section}</td>
                    <td className="px-3 py-2">{r.guardian_phone || '—'}</td>
                    <td className={`px-3 py-2 ${status.className}`}>{status.text}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
