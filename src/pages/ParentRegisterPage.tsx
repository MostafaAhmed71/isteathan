import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SchoolBrand } from '../components/SchoolBrand'
import { ErrorBox, PrimaryButton, SecondaryButton, TextField } from '../components/ui'
import { useAuth } from '../lib/auth'

export function ParentRegisterPage() {
  const { signUpParent } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: '',
    national_id: '',
    phone: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.')
      return
    }
    if (form.password !== form.confirm) {
      setError('كلمتا المرور غير متطابقتين.')
      return
    }
    if (!/^\d{10}$/.test(form.national_id.trim())) {
      setError('رقم الهوية يجب أن يكون 10 أرقام.')
      return
    }

    setSubmitting(true)
    try {
      await signUpParent({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        national_id: form.national_id.trim(),
        phone: form.phone.trim() || null,
      })
      navigate('/parent', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء الحساب.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="app-canvas relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8">
      <div className="glass-panel relative w-full max-w-md p-6 md:p-8">
        <SchoolBrand variant="hero" showAppName />
        <hr className="gold-rule mx-auto mt-3 w-20" />
        <p className="mt-3 text-center text-[var(--color-muted)]">إنشاء حساب ولي أمر</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <TextField
            label="الاسم الكامل"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
          <TextField
            label="رقم الهوية"
            value={form.national_id}
            onChange={(e) => setForm({ ...form, national_id: e.target.value })}
            inputMode="numeric"
            required
          />
          <TextField
            label="الجوال"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            inputMode="tel"
          />
          <TextField
            label="البريد الإلكتروني"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="email"
            required
          />
          <TextField
            label="كلمة المرور"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete="new-password"
            required
          />
          <TextField
            label="تأكيد كلمة المرور"
            type="password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            autoComplete="new-password"
            required
          />
          <ErrorBox message={error} />
          <PrimaryButton type="submit" full disabled={submitting}>
            {submitting ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
          </PrimaryButton>
        </form>

        <div className="mt-4">
          <Link to="/login">
            <SecondaryButton type="button" full>
              العودة لتسجيل الدخول
            </SecondaryButton>
          </Link>
        </div>
      </div>
    </main>
  )
}
