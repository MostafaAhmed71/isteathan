import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { classLabel, type Profile, type SchoolClass } from '../../lib/types'
import { EmptyState, SecondaryButton, SelectField } from '../../components/ui'

export function AdminClassesPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [staff, setStaff] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  async function reload() {
    const [c, s] = await Promise.all([
      supabase.from('classes').select('*').order('grade').order('section'),
      supabase.from('profiles').select('*').eq('role', 'CLASS_STAFF').order('full_name'),
    ])
    setClasses((c.data as SchoolClass[]) ?? [])
    setStaff((s.data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void reload()
  }, [])

  async function assignStaff(classId: string, staffId: string) {
    // Clear previous assignment for this staff if any
    if (staffId) {
      await supabase
        .from('classes')
        .update({ staff_profile_id: null })
        .eq('staff_profile_id', staffId)
    }
    await supabase
      .from('classes')
      .update({ staff_profile_id: staffId || null })
      .eq('id', classId)
    await reload()
  }

  async function toggleActive(c: SchoolClass) {
    await supabase.from('classes').update({ is_active: !c.is_active }).eq('id', c.id)
    await reload()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--color-gold)]">الفصول (24)</h1>
      {loading ? <p className="text-[var(--color-muted)]">جاري التحميل...</p> : null}
      {!loading && classes.length === 0 ? <EmptyState>لا توجد فصول. نفّذ ترحيل قاعدة البيانات.</EmptyState> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {classes.map((c) => (
          <article key={c.id} className="glass-panel glass-interactive p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-bold">{classLabel(c.grade, c.section)}</h2>
                <p className="text-sm text-[var(--color-muted)]">{c.is_active ? 'نشط' : 'غير نشط'}</p>
              </div>
              <SecondaryButton type="button" onClick={() => void toggleActive(c)}>
                {c.is_active ? 'تعطيل' : 'تفعيل'}
              </SecondaryButton>
            </div>
            <div className="mt-3">
              <SelectField
                label="موظف الفصل"
                value={c.staff_profile_id ?? ''}
                onChange={(e) => void assignStaff(c.id, e.target.value)}
              >
                <option value="">بدون تعيين</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.username})
                  </option>
                ))}
              </SelectField>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
