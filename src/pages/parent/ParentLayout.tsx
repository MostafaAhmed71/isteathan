import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { ParentDecisionAlerts } from '../../components/ParentDecisionAlerts'
import { SecondaryButton } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { refreshPushSubscriptionSilent } from '../../lib/push'

const links = [
  { to: '/parent', label: 'الرئيسية', end: true },
  { to: '/parent/children', label: 'أبنائي' },
  { to: '/parent/requests', label: 'الطلبات' },
]

export function ParentLayout() {
  const { signOut } = useAuth()

  useEffect(() => {
    const refresh = () => {
      void refreshPushSubscriptionSilent()
    }
    refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return (
    <>
      <ParentDecisionAlerts />
      <div className="sticky top-0 z-20 border-b border-[rgba(201,162,39,0.2)] bg-[rgba(11,31,63,0.92)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-4 py-2">
          <nav className="flex min-w-0 flex-1 gap-2">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `nav-chip shrink-0 ${isActive ? 'nav-chip-active' : 'nav-chip-idle'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <SecondaryButton type="button" onClick={() => void signOut()}>
            تسجيل الخروج
          </SecondaryButton>
        </div>
      </div>
      <Outlet />
    </>
  )
}
