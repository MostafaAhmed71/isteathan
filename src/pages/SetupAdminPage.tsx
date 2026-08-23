import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SchoolBrand } from '../components/SchoolBrand'
import { ErrorBox, PrimaryButton, SecondaryButton, TextField } from '../components/ui'
import { supabase } from '../lib/supabase'

/**
 * One-time setup: create/sign-in admin auth user then attach ADMIN profile.
 * Hidden from normal nav; visit /setup once.
 */
export function SetupAdminPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@gmail.com')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)
    try {
      // Prefer sign-in (user may already exist from Dashboard)
      let { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signInError) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
        })
        if (signUpError) throw new Error(signUpError.message)
        if (!data.session) {
          throw new Error(
            'أُنشئ المستخدم لكن بدون جلسة. عطّل Confirm email من إعدادات Auth، أو أنشئ المستخدم من لوحة Supabase مع Auto Confirm ثم أعد المحاولة.',
          )
        }
      }

      const { error: bootError } = await supabase.rpc('bootstrap_admin_profile', {
        p_full_name: 'مدير النظام',
      })
      if (bootError) {
        // If already admin, just continue
        if (!bootError.message.includes('يوجد مدير')) {
          throw new Error(bootError.message)
        }
      }

      setInfo('تم تجهيز حساب المدير. جاري التحويل...')
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الإعداد')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="app-canvas flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="glass-panel w-full max-w-md p-6 md:p-8">
        <SchoolBrand variant="hero" />
        <h1 className="brand-title mt-4 text-center text-3xl">إعداد المدير الأول</h1>
        <hr className="gold-rule mx-auto mt-3 w-20" />
        <p className="mt-3 text-center text-sm text-[var(--color-muted)]">
          يُستخدم مرة واحدة لإنشاء حساب الإدارة.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <TextField
            label="البريد"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="كلمة المرور"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <ErrorBox message={error} />
          {info ? <p className="text-sm text-[var(--color-gold-soft)]">{info}</p> : null}
          <PrimaryButton type="submit" full disabled={submitting}>
            {submitting ? 'جاري الإعداد...' : 'إنشاء المدير'}
          </PrimaryButton>
        </form>
        <div className="mt-4">
          <Link to="/login">
            <SecondaryButton type="button" full>
              تسجيل الدخول
            </SecondaryButton>
          </Link>
        </div>
      </div>
    </main>
  )
}
