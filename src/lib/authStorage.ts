import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'
import type { SupportedStorage } from '@supabase/supabase-js'

const REMEMBER_KEY = 'isteathan-remember-login'
const memory = new Map<string, string>()

function isNative() {
  return Capacitor.isNativePlatform()
}

/** Default true: keep the user signed in across app restarts. */
export function getRememberLogin(): boolean {
  try {
    const v = localStorage.getItem(REMEMBER_KEY)
    if (v === null) return true
    return v === '1'
  } catch {
    return true
  }
}

export async function setRememberLogin(remember: boolean): Promise<void> {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
  } catch {
    // ignore
  }
  if (isNative()) {
    await Preferences.set({ key: REMEMBER_KEY, value: remember ? '1' : '0' })
  }
  if (!remember) {
    // Drop any previously persisted session so a non-remember login stays ephemeral.
    memory.clear()
    await clearPersistentAuthKeys()
  }
}

async function clearPersistentAuthKeys(): Promise<void> {
  try {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith('sb-') || k.includes('supabase.auth'),
    )
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    // ignore
  }
  if (!isNative()) return
  try {
    const { keys } = await Preferences.keys()
    for (const key of keys) {
      if (key.startsWith('sb-') || key.includes('supabase.auth')) {
        await Preferences.remove({ key })
      }
    }
  } catch {
    // ignore
  }
}

async function persistentGet(key: string): Promise<string | null> {
  if (isNative()) {
    const { value } = await Preferences.get({ key })
    if (value != null) return value
    // Migrate once from WebView localStorage if present.
    try {
      const legacy = localStorage.getItem(key)
      if (legacy != null) {
        await Preferences.set({ key, value: legacy })
        return legacy
      }
    } catch {
      // ignore
    }
    return null
  }
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

async function persistentSet(key: string, value: string): Promise<void> {
  if (isNative()) {
    await Preferences.set({ key, value })
    try {
      localStorage.setItem(key, value)
    } catch {
      // ignore
    }
    return
  }
  localStorage.setItem(key, value)
}

async function persistentRemove(key: string): Promise<void> {
  if (isNative()) {
    await Preferences.remove({ key })
  }
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

/**
 * Supabase auth storage: Preferences on Android/iOS (survives restarts),
 * localStorage on web. When «تذكرني» is off, keep session in memory only.
 */
export function createAuthStorage(): SupportedStorage {
  return {
    getItem: async (key) => {
      if (!getRememberLogin()) {
        return memory.get(key) ?? null
      }
      return persistentGet(key)
    },
    setItem: async (key, value) => {
      if (!getRememberLogin()) {
        memory.set(key, value)
        return
      }
      await persistentSet(key, value)
    },
    removeItem: async (key) => {
      memory.delete(key)
      await persistentRemove(key)
    },
  }
}
