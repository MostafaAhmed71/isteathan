import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { ParentDecisionAlerts } from '../../components/ParentDecisionAlerts'
import { refreshPushSubscriptionSilent } from '../../lib/push'

export function ParentLayout() {
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
      <Outlet />
    </>
  )
}
