import { type FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  GRADE_LABELS,
  SECTIONS,
  classLabel,
  type Profile,
  type SchoolClass,
  type Student,
} from '../../lib/types'
import {
  EmptyState,
  ErrorBox,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  TextField,
} from '../../components/ui'

export function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [parents, setParents] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState({
    national_id: '',
    full_name: '',
    grade: '1',
    class_id: '',
    guardian_id: '',
  })

  async function reload() {
    const [s, c, p] = await Promise.all([
      supabase.from('students').select('*, classes(*)').order('full_name'),
      supabase.from('classes').select('*').order('grade').order('section'),
      supabase.from('profiles').select('*').eq('role', 'PARENT').order('full_name'),
    ])
    setStudents((s.data as Student[]) ?? [])
    setClasses((c.data as SchoolClass[]) ?? [])
    setParents((p.data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void reload()
  }, [])

  const filteredClasses = classes.filter((c) => String(c.grade) === form.grade)

  function startCreate() {
    setEditing(null)
    setForm({
      national_id: '',
      full_name: '',
      grade: '1',
      class_id: '',
      guardian_id: '',
    })
  }

  function startEdit(student: Student) {
    setEditing(student)
    setForm({
      national_id: student.national_id,
      full_name: student.full_name,
      grade: String(student.grade),
      class_id: student.class_id,
      guardian_id: student.guardian_id ?? '',
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.national_id || !form.full_name || !form.class_id) {
      setError('رقم الهوية والاسم والفصل مطلوبة.')
      return
    }
    const payload = {
      national_id: form.national_id.trim(),
      full_name: form.full_name.trim(),
      grade: Number(form.grade),
      class_id: form.class_id,
      guardian_id: form.guardian_id || null,
      is_active: true,
    }
    const res = editing
      ? await supabase.from('students').update(payload).eq('id', editing.id)
      : await supabase.from('students').insert(payload)
    if (res.error) {
      setError('تعذر حفظ الطالب. تحقق من رقم الهوية والفصل.')
      return
    }
    startCreate()
    await reload()
  }

  async function deactivate(id: string) {
    await supabase.from('students').update({ is_active: false }).eq('id', id)
    await reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--color-gold)]">الطلاب</h1>
        <SecondaryButton type="button" onClick={startCreate}>طالب جديد</SecondaryButton>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 glass-panel glass-interactive p-4 sm:grid-cols-2">
        <TextField label="رقم هوية الطالب" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} required />
        <TextField label="الاسم الكامل" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        <SelectField label="الصف" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value, class_id: '' })}>
          {[1, 2, 3, 4, 5, 6].map((g) => (
            <option key={g} value={g}>{GRADE_LABELS[g]}</option>
          ))}
        </SelectField>
        <SelectField label="الفصل" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} required>
          <option value="">اختر الفصل</option>
          {filteredClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.section}</option>
          ))}
        </SelectField>
        <SelectField label="ولي الأمر (اختياري)" value={form.guardian_id} onChange={(e) => setForm({ ...form, guardian_id: e.target.value })}>
          <option value="">بدون — يربطه ولي الأمر برقم الهوية</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name} — {p.national_id}</option>
          ))}
        </SelectField>
        <div className="flex items-end">
          <PrimaryButton type="submit" full>{editing ? 'تحديث' : 'إضافة'}</PrimaryButton>
        </div>
        <div className="sm:col-span-2">
          <ErrorBox message={error} />
        </div>
      </form>

      {loading ? <p className="text-[var(--color-muted)]">جاري التحميل...</p> : null}
      {!loading && students.length === 0 ? <EmptyState>لا يوجد طلاب.</EmptyState> : null}

      <div className="space-y-2">
        {students.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 glass-panel glass-interactive p-3">
            <div>
              <p className="font-bold">{s.full_name} {!s.is_active ? '(غير نشط)' : ''}</p>
              <p className="text-sm text-[var(--color-muted)]">
                {s.national_id} — {s.classes ? classLabel(s.classes.grade, s.classes.section) : ''}
                {s.guardian_id ? '' : ' — غير مرتبط بولي أمر'}
              </p>
            </div>
            <div className="flex gap-2">
              <SecondaryButton type="button" onClick={() => startEdit(s)}>تعديل</SecondaryButton>
              {s.is_active ? (
                <SecondaryButton type="button" onClick={() => void deactivate(s.id)}>تعطيل</SecondaryButton>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <span className="hidden">{SECTIONS.join('')}</span>
    </div>
  )
}
