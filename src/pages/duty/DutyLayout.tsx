import { Outlet } from 'react-router-dom'
import { SchoolBrand } from '../../components/SchoolBrand'
import { SecondaryButton } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { APP_NAME } from '../../lib/brand'

export function DutyLayout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="app-canvas min-h-dvh">
      <header className="glass-panel mx-4 mt-4 overflow-hidden md:mx-auto md:max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <SchoolBrand variant="compact" />
            <div className="min-w-0">
              <p className="brand-title text-lg md:text-xl">{APP_NAME} — المناوب</p>
              <p className="text-sm text-[var(--color-muted)]">{profile?.full_name}</p>
            </div>
          </div>
          <SecondaryButton type="button" onClick={() => void signOut()}>
            تسجيل الخروج
          </SecondaryButton>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
