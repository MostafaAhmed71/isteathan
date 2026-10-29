import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SecondaryButton } from '../../components/ui'
import { supabase } from '../../lib/supabase'

interface Stats {
  today: number
  pending: number
  approved: number
  rejected: number
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({ today: 0, pending: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const iso = start.toISOString()

      const [today, pending, approved, rejected] = await Promise.all([
        supabase
          .from('permission_requests')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', iso),
        supabase
          .from('permission_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'PENDING'),
        supabase
          .from('permission_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'APPROVED')
          .gte('created_at', iso),
        supabase
          .from('permission_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'REJECTED')
          .gte('created_at', iso),
      ])

      setStats({
        today: today.count ?? 0,
        pending: pending.count ?? 0,
        approved: approved.count ?? 0,
        rejected: rejected.count ?? 0,
      })
      setLoading(false)
    }
    void load()
  }, [])

  const cards = [
    { label: 'طلبات اليوم', value: stats.today },
    { label: 'قيد الانتظار', value: stats.pending },
    { label: 'تمت الموافقة', value: stats.approved },
    { label: 'تم الرفض', value: stats.rejected },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--color-gold)]">لوحة التحكم</h1>
        <Link to="/display/lobby">
          <SecondaryButton type="button">فتح شاشة البهو</SecondaryButton>
        </Link>
      </div>
      {loading ? <p className="text-[var(--color-muted)]">جاري التحميل...</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="glass-panel glass-interactive p-4">
            <p className="text-sm text-[var(--color-muted)]">{c.label}</p>
            <p className="mt-2 text-3xl font-bold text-[var(--color-text)]">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
