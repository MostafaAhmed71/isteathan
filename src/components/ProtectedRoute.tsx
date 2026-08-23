import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { homePathForRole, type UserRole } from '../lib/types'

export function ProtectedRoute({
  roles,
  children,
}: {
  roles: UserRole[]
  children: React.ReactNode
}) {
  const { profile, loading, session } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[var(--color-muted)]">
        جاري التحميل...
      </div>
    )
  }

  if (!session || !profile) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!roles.includes(profile.role)) {
    return <Navigate to={homePathForRole(profile.role)} replace />
  }

  if (!profile.is_active) {
    return <Navigate to="/login" replace />
  }

  return children
}

export function PublicOnly({ children }: { children: React.ReactNode }) {
  const { profile, loading, session } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[var(--color-muted)]">
        جاري التحميل...
      </div>
    )
  }

  if (session && profile) {
    return <Navigate to={homePathForRole(profile.role)} replace />
  }

  return children
}
