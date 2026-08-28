import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { isNativeApp } from './lib/native'
import { bootstrapNativeApp } from './lib/nativeBootstrap'
import App from './App'
import './index.css'

async function clearDevServiceWorkers() {
  if (!import.meta.env.DEV || !('serviceWorker' in navigator)) return
  const regs = await navigator.serviceWorker.getRegistrations()
  await Promise.all(regs.map((reg) => reg.unregister()))
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }
}

void (async () => {
  await clearDevServiceWorkers()
  await bootstrapNativeApp()

  // Native shells already cache the bundled web assets. A PWA service worker
  // inside Capacitor fights that copy and can serve stale JS.
  if (import.meta.env.PROD && !isNativeApp()) {
    const { registerSW } = await import('virtual:pwa-register')
    registerSW({ immediate: true })
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  )
})()

