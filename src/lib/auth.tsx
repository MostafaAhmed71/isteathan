import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { syncBackgroundMonitor, stopBackgroundMonitor } from './backgroundMonitor'
import type { Profile, UserRole } from './types'

interface ParentSignUpInput {
  email: string
  password: string
  full_name: string
  national_id: string
  phone: string | null
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUpParent: (input: ParentSignUpInput) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data as Profile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSession = useCallback(async (next: Session | null) => {
    setSession(next)
    if (!next?.user) {
      setProfile(null)
      void stopBackgroundMonitor()
      return
    }
    try {
      const p = await fetchProfile(next.user.id)
      if (p && !p.is_active) {
        await stopBackgroundMonitor()
        await supabase.auth.signOut()
        setProfile(null)
        setSession(null)
        throw new Error('هذا الحساب غير نشط. راجع إدارة المدرسة.')
      }
      setProfile(p)
      void syncBackgroundMonitor(p)
    } catch (err) {
      console.error(err)
      setProfile(null)
      void stopBackgroundMonitor()
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      loadSession(data.session).finally(() => {
        if (mounted) setLoading(false)
      })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      void loadSession(next)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadSession])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) {
      throw new Error('بيانات الدخول غير صحيحة.')
    }
  }, [])

  const signUpParent = useCallback(async (input: ParentSignUpInput) => {
    const email = input.email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
    })
    if (error) {
      if (error.message.toLowerCase().includes('already')) {
        throw new Error('هذا البريد مسجّل مسبقًا. سجّل الدخول أو استخدم بريدًا آخر.')
      }
      throw new Error('تعذر إنشاء الحساب. تحقق من البيانات أو إعدادات البريد في Supabase.')
    }
    if (!data.user) {
      throw new Error('تعذر إنشاء الحساب.')
    }
    // If email confirmation is enabled, session may be null
    if (!data.session) {
      throw new Error(
        'تم إنشاء الحساب. إن كان تأكيد البريد مفعّلاً في Supabase، أكّد بريدك ثم سجّل الدخول. يُفضّل تعطيل Confirm email للتطوير.',
      )
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: input.full_name,
      role: 'PARENT',
      national_id: input.national_id,
      phone: input.phone,
      username: null,
      is_active: true,
    })
    if (profileError) {
      if (profileError.message.includes('duplicate') || profileError.code === '23505') {
        throw new Error('رقم الهوية مسجّل مسبقًا.')
      }
      throw new Error('تعذر حفظ بيانات ولي الأمر.')
    }
  }, [])

  const signOut = useCallback(async () => {
    await stopBackgroundMonitor()
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return
    const p = await fetchProfile(session.user.id)
    setProfile(p)
  }, [session])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signIn,
      signUpParent,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signIn, signUpParent, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useRequireRole(roles: UserRole[]): Profile | null {
  const { profile } = useAuth()
  if (!profile || !roles.includes(profile.role)) return null
  return profile
}
