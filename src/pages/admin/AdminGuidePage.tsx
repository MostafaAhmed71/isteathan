import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SecondaryButton } from '../../components/ui'
import { APP_NAME, SCHOOL_LOGO_SRC, SCHOOL_NAME } from '../../lib/brand'

const sections = [
  { id: 'overview', title: 'نظرة عامة' },
  { id: 'roles', title: 'أنواع الحسابات' },
  { id: 'flow', title: 'مسار طلب الاستئذان' },
  { id: 'admin', title: 'شاشة المدير' },
  { id: 'staff', title: 'حسابات الفصول' },
  { id: 'parent', title: 'واجهة ولي الأمر' },
  { id: 'class', title: 'واجهة مشرف الفصل' },
  { id: 'notify', title: 'الإشعارات' },
  { id: 'import', title: 'الاستيراد الجماعي' },
  { id: 'status', title: 'حالات الطلب' },
  { id: 'tips', title: 'نصائح وتشغيل' },
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

export function AdminGuidePage() {
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
    document.title = `دليل منصة ${APP_NAME} — ${SCHOOL_NAME}`
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-gold)]">دليل المنصة</h1>
          <p className="mt-2 text-[var(--color-muted)]">
            دليل شامل لتشغيل نظام {APP_NAME} في {SCHOOL_NAME}: الأدوار، الشاشات، الطلبات،
            الإشعارات، والاستيراد.
          </p>
        </div>
        <SecondaryButton type="button" className="no-print" onClick={exportPdf}>
          تصدير PDF
        </SecondaryButton>
      </div>

      <div className="print-only guide-print-header">
        <img src={SCHOOL_LOGO_SRC} alt="" width={72} height={72} />
        <div>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '18pt' }}>{SCHOOL_NAME}</p>
          <p style={{ margin: '4px 0 0', fontSize: '14pt' }}>دليل تشغيل منصة {APP_NAME}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="no-print glass-panel h-fit p-3 lg:sticky lg:top-4">
          <p className="mb-2 px-2 text-sm font-bold text-[var(--color-gold)]">محتويات الدليل</p>
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
          <GuideSection id="overview" title="نظرة عامة">
            <p>
              منصة <strong>{APP_NAME}</strong> تطبيق ويب عربي (من اليمين لليسار) لإدارة طلبات
              استئذان الطلاب في <strong>{SCHOOL_NAME}</strong>.
            </p>
            <ul className="list-inside list-disc space-y-1 text-[var(--color-muted)]">
              <li>ولي الأمر يرسل طلب استئذان لابنه المرتبط بحسابه.</li>
              <li>مشرف الفصل يراجع الطلب ويوافق أو يرفض.</li>
              <li>المدير يدير الفصول والطلاب وأولياء الأمور والحسابات والطلبات.</li>
              <li>التنبيهات تصل عند وصول طلب جديد أو صدور قرار.</li>
            </ul>
            <p className="text-sm text-[var(--color-muted)]">
              الدخول موحّد لجميع الأدوار: يكتب المستخدم اسم الدخول وكلمة المرور في شاشة تسجيل
              الدخول. المدير لا يحتاج لإنشاء البريد يدويًا؛ المنصة تجهّزه تلقائيًا عند اختيار الفصل.
            </p>
          </GuideSection>

          <GuideSection id="roles" title="أنواع الحسابات">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[rgba(212,175,55,0.35)] text-right text-[var(--color-gold)]">
                    <th className="px-2 py-2">الدور</th>
                    <th className="px-2 py-2">أين يدخل؟</th>
                    <th className="px-2 py-2">ماذا يستطيع أن يفعل؟</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--color-muted)]">
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <td className="px-2 py-2 font-bold text-[var(--color-text)]">ولي أمر</td>
                    <td className="px-2 py-2">صفحة ولي الأمر</td>
                    <td className="px-2 py-2">ربط الأبناء، إرسال طلب، تتبع الحالة، الإشعارات</td>
                  </tr>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <td className="px-2 py-2 font-bold text-[var(--color-text)]">مشرف فصل</td>
                    <td className="px-2 py-2">صفحة الفصل</td>
                    <td className="px-2 py-2">مراجعة طلبات فصله فقط، موافقة/رفض، إشعارات</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-2 font-bold text-[var(--color-text)]">مدير</td>
                    <td className="px-2 py-2">لوحة الإدارة</td>
                    <td className="px-2 py-2">إدارة كاملة للمنصة والتقارير والاستيراد</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              ولي الأمر يمكنه إنشاء حسابه بنفسه من صفحة «إنشاء حساب ولي أمر»، بينما حسابات
              الفصول والمدير تُنشأ من لوحة الإدارة أو أدوات الإعداد.
            </p>
          </GuideSection>

          <GuideSection id="flow" title="مسار طلب الاستئذان">
            <ol className="list-inside list-decimal space-y-2 text-[var(--color-muted)]">
              <li>
                المدير يضيف الطلاب ويربطهم بفصول، أو يستوردهم جماعيًا، ويضمن وجود حساب مشرف لكل
                فصل.
              </li>
              <li>ولي الأمر يسجّل حسابه ويربط ابنه برقم هوية الطالب المسجّل لدى المدرسة.</li>
              <li>من الصفحة الرئيسية يضغط «طلب استئذان» ثم يؤكد الإرسال.</li>
              <li>يظهر الطلب لدى مشرف الفصل المعني مباشرة (مع إشعار إن كانت الإشعارات مفعّلة).</li>
              <li>المشرف يوافق أو يرفض (مع سبب عند الرفض).</li>
              <li>ولي الأمر يتابع الحالة عبر شريط التتبع ويصله إشعار بالقرار.</li>
            </ol>
          </GuideSection>

          <GuideSection id="admin" title="شاشة المدير — أقسام القائمة">
            <ul className="space-y-3 text-[var(--color-muted)]">
              <li>
                <Link className="font-bold text-[var(--color-gold)]" to="/admin">
                  لوحة التحكم
                </Link>
                : ملخص سريع — طلبات اليوم، قيد الانتظار، الموافقات والرفض لليوم.
              </li>
              <li>
                <Link className="font-bold text-[var(--color-gold)]" to="/admin/requests">
                  الطلبات
                </Link>
                : استعراض كل الطلبات مع التصفية حسب الصف / الفصل / الحالة / التاريخ.
              </li>
              <li>
                <Link className="font-bold text-[var(--color-gold)]" to="/admin/students">
                  الطلاب
                </Link>
                : إضافة وتعديل الطلاب، تعيين الصف والفصل، وربط ولي الأمر عند الحاجة.
              </li>
              <li>
                <Link className="font-bold text-[var(--color-gold)]" to="/admin/parents">
                  أولياء الأمور
                </Link>
                : إنشاء حسابات أولياء الأمور وعرض الأبناء المرتبطين وتفعيل/تعطيل الحساب.
              </li>
              <li>
                <Link className="font-bold text-[var(--color-gold)]" to="/admin/classes">
                  الفصول
                </Link>
                : عرض الفصول الـ 24 (صفوف 1–6 × شعب أ ب ج د) وتفعيل/تعطيل الفصل وتعيين المشرف.
              </li>
              <li>
                <Link className="font-bold text-[var(--color-gold)]" to="/admin/staff">
                  الموظفون
                </Link>
                : إنشاء حسابات مشرفي الفصول، الإنشاء الجماعي، الحذف الفردي أو حذف الكل، وتعيين
                الفصل.
              </li>
              <li>
                <Link className="font-bold text-[var(--color-gold)]" to="/admin/import">
                  استيراد
                </Link>
                : رفع ملف CSV لإضافة طلاب وأولياء أمور دفعة واحدة.
              </li>
              <li>
                <span className="font-bold text-[var(--color-gold)]">الدليل</span> (هذه الشاشة):
                مرجع تشغيل المنصة بالكامل.
              </li>
            </ul>
          </GuideSection>

          <GuideSection id="staff" title="حسابات الفصول">
            <p>
              لإنشاء حسابات الفصول: ادخل صفحة «الموظفون» ثم اضغط «إنشاء حسابات لكل الفصول». لا
              تحتاج كتابة بريد أو كلمة مرور؛ المنصة تجهّزها تلقائيًا.
            </p>
            <ul className="list-inside list-disc text-[var(--color-muted)]">
              <li>اختر الفصل فقط عند إنشاء حساب واحد، وستظهر بيانات الدخول جاهزة للنسخ.</li>
              <li>
                اسم الدخول يكون مثل: الفصل الأول أ → <strong>c1@g.com</strong>، ثم الفصل التالي
                c2@g.com، وهكذا.
              </li>
              <li>
                كلمة المرور الموحدة لكل الفصول: <strong>c123456</strong>
              </li>
              <li>
                أعطِ مشرف الفصل ورقتين فقط: اسم الدخول + كلمة المرور. لا يحتاج معرفة أي تفاصيل
                تقنية.
              </li>
              <li>يمكن حذف حساب واحد أو حذف كل حسابات الفصول بعد التأكيد.</li>
            </ul>
            <p className="text-sm text-[var(--color-muted)]">
              كل حساب فصل يرى فقط طلبات فصله المعيّن. إن لم يُعيَّن فصل للحساب فلن تظهر له
              طلبات.
            </p>
          </GuideSection>

          <GuideSection id="parent" title="واجهة ولي الأمر">
            <ul className="list-inside list-disc space-y-1 text-[var(--color-muted)]">
              <li>
                ولي الأمر ينشئ حسابه بنفسه من زر «إنشاء حساب ولي أمر» في صفحة الدخول، أو ينشئه
                المدير من صفحة أولياء الأمور.
              </li>
              <li>
                الصفحة الرئيسية: تفعيل الإشعارات، ربط ابن برقم الهوية، قائمة الأبناء مع زر «طلب
                استئذان» واضح.
              </li>
              <li>سجل الطلبات: تتبع كل طلب خطوة بخطوة (أُرسل → قيد المراجعة → قرار).</li>
              <li>
                لا يمكن إرسال طلب جديد لنفس الطالب إذا كان لديه طلب قيد الانتظار بالفعل.
              </li>
            </ul>
          </GuideSection>

          <GuideSection id="class" title="واجهة مشرف الفصل">
            <ul className="list-inside list-disc space-y-1 text-[var(--color-muted)]">
              <li>عرض الطلبات الواردة لفصله فقط.</li>
              <li>الموافقة المباشرة بعد تأكيد، أو الرفض مع كتابة سبب يظهر لولي الأمر.</li>
              <li>سجل مختصر للطلبات السابقة (آخر 30 تقريبًا).</li>
              <li>تفعيل الإشعارات لاستقبال تنبيه عند وصول طلب جديد حتى لو كانت الصفحة مغلقة.</li>
            </ul>
          </GuideSection>

          <GuideSection id="notify" title="الإشعارات">
            <p>عند وصول طلب جديد أو صدور قرار، يصل تنبيه إلى الجوال أو المتصفح.</p>
            <ul className="list-inside list-disc space-y-1 text-[var(--color-muted)]">
              <li>ولي الأمر: تنبيه عند الموافقة أو الرفض.</li>
              <li>مشرف الفصل: تنبيه عند وصول طلب جديد.</li>
              <li>
                لتفعيل التنبيهات: اضغط «تفعيل الإشعارات» ثم اسمح بها عندما يطلب المتصفح ذلك.
              </li>
              <li>على الجوال افتح المنصة من الرابط الآمن الذي يعطيك إياه مسؤول التقنية.</li>
            </ul>
          </GuideSection>

          <GuideSection id="import" title="الاستيراد الجماعي">
            <p>
              من صفحة «استيراد» ارفع ملف Excel/CSV جاهز من المدرسة. الأعمدة المطلوبة بالترتيب:
              رقم هوية الطالب، اسم الطالب، الصف، الشعبة، رقم هوية ولي الأمر، اسم ولي الأمر،
              الجوال.
            </p>
            <ul className="list-inside list-disc text-[var(--color-muted)]">
              <li>الصف رقم من 1 إلى 6، والشعبة: أ أو ب أو ج أو د.</li>
              <li>المنصة تراجع الملف وتعرض الأخطاء قبل التنفيذ.</li>
              <li>
                إذا لم يكن لولي الأمر حساب، تُنشئه المنصة تلقائيًا وتربط الطالب به.
              </li>
            </ul>
          </GuideSection>

          <GuideSection id="status" title="حالات الطلب">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[rgba(212,175,55,0.35)] text-right text-[var(--color-gold)]">
                    <th className="px-2 py-2">الحالة</th>
                    <th className="px-2 py-2">المعنى</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--color-muted)]">
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <td className="px-2 py-2 font-bold text-[var(--color-text)]">قيد الانتظار</td>
                    <td className="px-2 py-2">أُرسل الطلب وينتظر قرار مشرف الفصل</td>
                  </tr>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <td className="px-2 py-2 font-bold text-[var(--color-text)]">تمت الموافقة</td>
                    <td className="px-2 py-2">وافق المشرف على خروج / استئذان الطالب</td>
                  </tr>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <td className="px-2 py-2 font-bold text-[var(--color-text)]">تم الرفض</td>
                    <td className="px-2 py-2">رُفض الطلب مع سبب يظهر لولي الأمر</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-2 font-bold text-[var(--color-text)]">ملغي</td>
                    <td className="px-2 py-2">أُلغي الطلب (إن وُجدت هذه الحالة في السجلات)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </GuideSection>

          <GuideSection id="tips" title="نصائح وتشغيل يومي">
            <ul className="list-inside list-disc space-y-2 text-[var(--color-muted)]">
              <li>
                ابدأ دائمًا بالتأكد أن الفصول نشطة وأن لكل فصل مشرفًا معيّنًا قبل بدء اليوم
                الدراسي.
              </li>
              <li>
                أضف الطلاب قبل أن يحاول أولياء الأمور الربط برقم الهوية؛ وإلا سيظهر خطأ «لا يوجد
                طالب».
              </li>
              <li>
                إن تعطّل حساب فصل، عطّله من صفحة الموظفين أو احذفه وأنشئ بديلًا بنفس النمط.
              </li>
              <li>
                للمراقبة الشاملة استخدم «الطلبات» مع الفلاتر بدل الاعتماد على لوحة فصل واحد.
              </li>
              <li>
                التطبيق يدعم التثبيت كتطبيق (PWA) ويعمل مع تنبيه عند انقطاع الشبكة.
              </li>
              <li>
                هذا الدليل متاح دائمًا من قائمة المدير تحت بند «الدليل» للرجوع إليه أثناء العمل.
              </li>
            </ul>
          </GuideSection>
        </div>
      </div>
    </div>
  )
}
