import { Capacitor, registerPlugin } from '@capacitor/core'
import { isNativeApp } from './native'

export interface AppUpdateManifest {
  versionCode: number
  versionName: string
  apkUrl: string
  notes?: string
  publishedAt?: string
}

export interface AppVersionInfo {
  versionCode: number
  versionName: string
}

interface AppUpdatePlugin {
  getVersionInfo(): Promise<AppVersionInfo>
  canInstallPackages(): Promise<{ granted: boolean }>
  requestInstallPermission(): Promise<{ granted: boolean }>
  downloadAndInstall(options: { url: string }): Promise<void>
  addListener(
    eventName: 'downloadProgress',
    listener: (event: { percent: number }) => void,
  ): Promise<{ remove: () => void }>
}

class AppUpdateWeb {
  async getVersionInfo() {
    return { versionCode: 0, versionName: '' }
  }
  async canInstallPackages() {
    return { granted: false }
  }
  async requestInstallPermission() {
    return { granted: false }
  }
  async downloadAndInstall(_options: { url: string }) {}
  async addListener() {
    return { remove: () => {} }
  }
}

const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate', {
  web: () => Promise.resolve(new AppUpdateWeb()),
})

const DISMISS_KEY = 'isteathan-update-dismissed'

function manifestUrl(): string | null {
  const url = import.meta.env.VITE_APP_UPDATE_MANIFEST_URL?.trim()
  return url || null
}

function resolveUrl(base: string, relative: string): string {
  if (/^https?:\/\//i.test(relative)) return relative
  const origin = new URL(base).origin
  return `${origin}${relative.startsWith('/') ? relative : `/${relative}`}`
}

export function isAppUpdateSupported(): boolean {
  return isNativeApp() && Capacitor.getPlatform() === 'android' && Boolean(manifestUrl())
}

export async function getInstalledVersion(): Promise<AppVersionInfo | null> {
  if (!isAppUpdateSupported()) return null
  try {
    return await AppUpdate.getVersionInfo()
  } catch {
    return null
  }
}

export async function fetchUpdateManifest(): Promise<AppUpdateManifest | null> {
  const url = manifestUrl()
  if (!url) return null
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as AppUpdateManifest
    if (!data?.versionCode || !data?.apkUrl) return null
    return {
      ...data,
      apkUrl: resolveUrl(url, data.apkUrl),
    }
  } catch {
    return null
  }
}

export async function checkForAppUpdate(): Promise<{
  available: boolean
  manifest: AppUpdateManifest | null
  installed: AppVersionInfo | null
}> {
  const [installed, manifest] = await Promise.all([getInstalledVersion(), fetchUpdateManifest()])
  if (!installed || !manifest) {
    return { available: false, manifest, installed }
  }
  const dismissed = Number(localStorage.getItem(DISMISS_KEY) || '0')
  const available = manifest.versionCode > installed.versionCode && manifest.versionCode > dismissed
  return { available, manifest, installed }
}

export function dismissAppUpdate(versionCode: number): void {
  localStorage.setItem(DISMISS_KEY, String(versionCode))
}

export async function ensureInstallPermission(): Promise<boolean> {
  const check = await AppUpdate.canInstallPackages()
  if (check.granted) return true
  const req = await AppUpdate.requestInstallPermission()
  return req.granted
}

export async function downloadAndInstallUpdate(
  apkUrl: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const listener = onProgress
    ? await AppUpdate.addListener('downloadProgress', (event) => onProgress(event.percent))
    : null
  try {
    await AppUpdate.downloadAndInstall({ url: apkUrl })
  } finally {
    listener?.remove()
  }
}
