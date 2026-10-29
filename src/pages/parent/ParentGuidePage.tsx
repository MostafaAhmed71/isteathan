import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageShell, SecondaryButton } from '../../components/ui'
import { APP_NAME, SCHOOL_LOGO_SRC, SCHOOL_NAME } from '../../lib/brand'

const sections = [
  { id: 'what', title: 'ماذا تقدّم المنصة؟' },
  { id: 'start', title: 'كيف تبدأ؟' },
  { id: 'request', title: 'كيف أقدّم الطلب؟' },
  { id: 'after', title: 'ماذا يحدث بعد الإرسال؟' },
  { id: 'status', title: 'حالات الطلب' },
  { id: 'notify', title: 'الإشعارات' },
  { id: 'faq', title: 'أسئلة شائعة' },
] as const

function GuideSection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="guide-section scroll-mt-24 space-y-3">
      <h2 className="border-b border-[rgba(212,175,55,0.35)] pb-2 text-xl font-bold text-[var(--color-gold)]">
        {title}
      </h2>
      <div className="space-y-3 text-[var(--color-text)] leading-8">{children}</div>
    </section>
  )
}

export function ParentGuidePage() {
  const [active, setActive] = useState<string>(sections[0].id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target.id) setActive(visible.target.id)
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0.2, 0.5, 1] },
    )
    for (const s of sections) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  function exportPdf() {
    const previousTitle = document.title
    document.title = `دليل ولي الأمر — ${APP_NAME} — ${SCHOOL_NAME}`
    window.addEventListener(
      'afterprint',
      () => {
        document.title = previousTitle
      },
      { once: true },
    )
    window.print()
  }

  return (
    <PageShell
      title="دليل ولي الأمر"
      subtitle={`كيف تستخدم منصة ${APP_NAME} لتقديم طلب استئذان ومتابعة نتيجته`}
      actions={
        <SecondaryButton type="button" className="no-print" onClick={exportPdf}>
          تصدير PDF
        </SecondaryButton>
      }
    >
      <div className="print-only guide-print-header mb-6">
        <img src={SCHOOL_LOGO_SRC} alt="" width={72} height={72} />
        <div>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '18pt' }}>{SCHOOL_NAME}</p>
          <p style={{ margin: '4px 0 0', fontSize: '14pt' }}>دليل ولي الأمر — منصة {APP_NAME}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="no-print glass-panel h-fit p-3 lg:sticky lg:top-16">
          <p className="mb-2 px-2 text-sm font-bold text-[var(--color-gold)]">المحتويات</p>
          <nav className="flex flex-col gap-1">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active === s.id
                    ? 'bg-[rgba(212,175,55,0.2)] font-bold text-[var(--color-gold)]'
                    : 'text-[var(--color-muted)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--color-text)]'
                }`}
              >
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        <div className="glass-panel space-y-10 p-4 md:p-6">
          <GuideSection id="what" title="ماذا تقدّم المنصة؟">
            <p>
              منصة <strong>{APP_NAME}</strong> خدمة إلكترونية من {SCHOOL_NAME} تسهّل عليك طلب
              استئذان ابنك من المدرسة ومتابعة القرار من جوالك، دون الحاجة لمراجعة الفصل أو الاتصال.
            </p>
            <ul className="list-inside list-disc space-y-1 text-[var(--color-muted)]">
              <li>ترى أبناءك المرتبطين بحسابك وصفوفهم تلقائيًا.</li>
              <li>تقدّم طلب استئذان بضغطة زر وتأكيد واحد.</li>
              <li>يتابع مشرف الفصل الطلب فورًا ويوافق أو يرفض.</li>
              <li>تصلك النتيجة على الشاشة، ويمكن تفعيل إشعار على الجوال.</li>
              <li>لا تختار الصف بنفسك؛ المنصة تعرفه من سجل الطالب.</li>
            </ul>
          </GuideSection>

          <GuideSection id="start" title="كيف تبدأ؟">
            <ol className="list-inside list-decimal space-y-2 text-[var(--color-muted)]">
              <li>ادخل للمنصة ببيانات الدخول التي تسلّمتها من المدرسة.</li>
              <li>
                من تبويب{' '}
                <Link className="font-bold text-[var(--color-gold)]" to="/parent/children">
                  أبنائي
                </Link>{' '}
                اضغط «إضافة ابن برقم الهوية» وأدخل رقم هوية الطالب المسجّل لدى المدرسة.
              </li>
              <li>بعد الربط يظهر اسم الابن وصفه في الصفحة الرئيسية.</li>
              <li>
                (اختياري) اضغط «تفعيل الإشعارات» واسمح بها حتى يصلك تنبيه عند صدور القرار.
              </li>
            </ol>
            <p className="text-sm text-[var(--color-muted)]">
              إن لم يُقبل رقم الهوية، تأكد أنه مطابق لسجل المدرسة أو راجع الإدارة. إزالة الابن من
              قائمتك تفك الربط فقط ولا تحذف الطالب من سجلات المدرسة.
            </p>
          </GuideSection>

          <GuideSection id="request" title="كيف أقدّم الطلب؟">
            <ol className="list-inside list-decimal space-y-2 text-[var(--color-muted)]">
              <li>
                من{' '}
                <Link className="font-bold text-[var(--color-gold)]" to="/parent">
                  الرئيسية
                </Link>{' '}
                اختر بطاقة الابن المطلوب.
              </li>
              <li>اضغط زر «طلب استئذان».</li>
              <li>أكد الإرسال. لا تحتاج كتابة الصف أو السبب في هذه الخطوة.</li>
              <li>
                تظهر رسالة نجاح، وتتحول الحالة إلى «قيد الانتظار». لا يمكن إرسال طلب ثانٍ لنفس
                الابن ما دام الطلب السابق قيد المراجعة.
              </li>
            </ol>
          </GuideSection>

          <GuideSection id="after" title="ماذا يحدث بعد الإرسال؟">
            <ol className="list-inside list-decimal space-y-2 text-[var(--color-muted)]">
              <li>يصل الطلب مباشرة إلى شاشة مشرف فصل ابنك.</li>
              <li>يراجع المشرف الطلب ويوافق أو يرفض (مع سبب عند الرفض).</li>
              <li>
                تتحدث الحالة أمامك فورًا: تم الإرسال → قيد المراجعة → تمت الموافقة أو تم الرفض.
              </li>
              <li>
                تابع التفاصيل من تبويب{' '}
                <Link className="font-bold text-[var(--color-gold)]" to="/parent/requests">
                  الطلبات
                </Link>
                .
              </li>
              <li>إن فعّلت الإشعارات يصلك تنبيه عند القرار حتى لو أغلقت الصفحة.</li>
            </ol>
            <p>
              بعد الموافقة يمكنك استلام ابنك وفق إجراءات المدرسة. بعد الرفض يظهر سبب الرفض في سجل
              الطلب. يمكنك تقديم طلب جديد بعد انتهاء الطلب السابق (موافقة أو رفض).
            </p>
          </GuideSection>

          <GuideSection id="status" title="حالات الطلب">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[rgba(212,175,55,0.35)] text-right text-[var(--color-gold)]">
                    <th className="px-2 py-2">الحالة</th>
                    <th className="px-2 py-2">ماذا تعني لك؟</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--color-muted)]">
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <td className="px-2 py-2 font-bold text-[var(--color-text)]">قيد الانتظار</td>
                    <td className="px-2 py-2">طلبك وصل للفصل وجاري مراجعته. انتظر القرار.</td>
                  </tr>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <td className="px-2 py-2 font-bold text-[var(--color-text)]">تمت الموافقة</td>
                    <td className="px-2 py-2">وافق المشرف على الاستئذان.</td>
                  </tr>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <td className="px-2 py-2 font-bold text-[var(--color-text)]">تم الرفض</td>
                    <td className="px-2 py-2">رُفض الطلب. سبب الرفض يظهر في سجل الطلبات.</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-2 font-bold text-[var(--color-text)]">ملغي</td>
                    <td className="px-2 py-2">أُلغي الطلب (مثلًا بعد فك ربط الابن أثناء الانتظار).</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </GuideSection>

          <GuideSection id="notify" title="الإشعارات">
            <ul className="list-inside list-disc space-y-1 text-[var(--color-muted)]">
              <li>من الرئيسية اضغط «تفعيل الإشعارات» ثم اسمح بها عندما يطلب المتصفح ذلك.</li>
              <li>يصلك تنبيه عند الموافقة أو الرفض.</li>
              <li>يفضَّل فتح المنصة من الرابط الآمن الذي تعطيك إياه المدرسة، ثم تثبيتها على الجوال إن رغبت.</li>
            </ul>
          </GuideSection>

          <GuideSection id="faq" title="أسئلة شائعة">
            <ul className="space-y-3 text-[var(--color-muted)]">
              <li>
                <strong className="text-[var(--color-text)]">لا يظهر ابني؟</strong> أضفه من «أبنائي»
                برقم الهوية المسجّل في المدرسة. إن استمر الخطأ راجع الإدارة.
              </li>
              <li>
                <strong className="text-[var(--color-text)]">الزر يقول «طلب قيد المراجعة»؟</strong>{' '}
                يوجد طلب معلّق لهذا الابن. انتظر القرار قبل إرسال طلب جديد.
              </li>
              <li>
                <strong className="text-[var(--color-text)]">كم يستغرق القرار؟</strong> يظهر فور
                مراجعة المشرف. راقب الشاشة أو فعّل الإشعارات.
              </li>
              <li>
                <strong className="text-[var(--color-text)]">هل يرى أولياء آخرون بياناتي؟</strong> لا.
                كل ولي أمر يرى أبناءه وطلباته فقط.
              </li>
            </ul>
          </GuideSection>
        </div>
      </div>
    </PageShell>
  )
}
