import { useEffect, useId, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
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
  const { signOut, profile } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const titleId = useId()

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

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  return (
    <>
      <ParentDecisionAlerts />

      <button
        type="button"
        className="parent-menu-fab"
        aria-expanded={menuOpen}
        aria-controls="parent-side-menu"
        onClick={() => setMenuOpen(true)}
      >
        <span className="sr-only">فتح القائمة</span>
        <span aria-hidden className="parent-menu-fab__bars">
          <span />
          <span />
          <span />
        </span>
      </button>

      {menuOpen ? (
        <button
          type="button"
          className="parent-menu-backdrop"
          aria-label="إغلاق القائمة"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        id="parent-side-menu"
        className={`parent-side-menu ${menuOpen ? 'parent-side-menu--open' : ''}`}
        aria-hidden={!menuOpen}
        aria-labelledby={titleId}
      >
        <div className="parent-side-menu__head">
          <div>
            <p id={titleId} className="parent-side-menu__title">
              القائمة
            </p>
            {profile?.full_name ? (
              <p className="parent-side-menu__user">{profile.full_name}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="parent-side-menu__close"
            onClick={() => setMenuOpen(false)}
          >
            إغلاق
          </button>
        </div>

        <nav className="parent-side-menu__nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `parent-side-menu__link ${isActive ? 'parent-side-menu__link--active' : ''}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="parent-side-menu__foot">
          <SecondaryButton type="button" full onClick={() => void signOut()}>
            تسجيل الخروج
          </SecondaryButton>
        </div>
      </aside>

      <Outlet />
    </>
  )
}
