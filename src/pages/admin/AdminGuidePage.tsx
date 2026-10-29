import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SecondaryButton } from '../../components/ui'
import { APP_NAME, SCHOOL_LOGO_SRC, SCHOOL_NAME } from '../../lib/brand'

const sections = [
  { id: 'overview', title: 'نظرة عامة' },
  { id: 'roles', title: 'الأدوار والصلاحيات' },
  { id: 'flow', title: 'مسار طلب الاستئذان' },
  { id: 'admin', title: 'شاشة المدير' },
  { id: 'staff', title: 'مشرفو الفصول' },
  { id: 'parent', title: 'واجهة ولي الأمر' },
  { id: 'class', title: 'واجهة مشرف الفصل' },
  { id: 'notify', title: 'الإشعارات' },
  { id: 'whatsapp', title: 'واتساب مشرفي الاستئذان' },
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
            دليل تشغيل نظام {APP_NAME} في {SCHOOL_NAME}: الأدوار، الشاشات، الطلبات، الإشعارات،
            والاستيراد. لا يتضمن بيانات دخول.
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
              <li>المدير يدير الفصول والطلاب وأولياء الأمور والمشرفين والطلبات.</li>
              <li>التنبيهات تصل عبر المتصفح أو الجوال، ويمكن إرسال واتساب لمشرف الاستئذان.</li>
            </ul>
            <p className="text-sm text-[var(--color-muted)]">
              الدخول موحّد لجميع الأدوار من شاشة تسجيل الدخول. بيانات الدخول تُسلَّم من الإدارة
              لكل مستخدم على حدة، ولا تُذكر في هذا الدليل.
            </p>
          </GuideSection>

          <GuideSection id="roles" title="الأدوار والصلاحيات">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[rgba(212,175,55,0.35)] text-right text-[var(--color-gold)]">
                    <th className="px-2 py-2">الدور</th>
                    <th className="px-2 py-2">أين يعمل؟</th>
                    <th className="px-2 py-2">ماذا يستطيع أن يفعل؟</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--color-muted)]">
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <td className="px-2 py-2 font-bold text-[var(--color-text)]">ولي أمر</td>
                    <td className="px-2 py-2">واجهة ولي الأمر</td>
                    <td className="px-2 py-2">إدارة الأبناء، إرسال طلب، تتبع الحالة، الإشعارات</td>
                  </tr>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <td className="px-2 py-2 font-bold text-[var(--color-text)]">مشرف فصل</td>
                    <td className="px-2 py-2">واجهة الفصل</td>
                    <td className="px-2 py-2">مراجعة طلبات فصله فقط، موافقة أو رفض، إشعارات</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-2 font-bold text-[var(--color-text)]">مدير</td>
                    <td className="px-2 py-2">لوحة الإدارة</td>
                    <td className="px-2 py-2">إدارة كاملة للمنصة والتقارير والاستيراد ومشرفي واتساب</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              كل دور يرى شاشته فقط. مشرف الفصل لا يطلع على فصول أخرى، وولي الأمر لا يرى إلا أبناءه
              المرتبطين بحسابه.
            </p>
          </GuideSection>

          <GuideSection id="flow" title="مسار طلب الاستئذان">
            <ol className="list-inside list-decimal space-y-2 text-[var(--color-muted)]">
              <li>
                المدير يضيف الطلاب ويربطهم بفصولهم، أو يستوردهم جماعيًا، ويتأكد أن لكل فصل مشرفًا.
              </li>
              <li>
                ولي الأمر يربط ابنه من تبويب «أبنائي» برقم هوية الطالب المسجّل لدى المدرسة.
              </li>
              <li>من الصفحة الرئيسية يضغط «طلب استئذان» ثم يؤكد الإرسال. الفصل يُحدَّد تلقائيًا.</li>
              <li>يظهر الطلب فورًا لدى مشرف الفصل المعني (مع إشعار إن كانت الإشعارات مفعّلة).</li>
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
                : استعراض كل الطلبات مع التصفية حسب الصف والفصل والحالة والتاريخ.
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
                : إدارة أولياء الأمور، عرض الأبناء المرتبطين، وتفعيل أو تعطيل الحساب.
              </li>
              <li>
                <Link className="font-bold text-[var(--color-gold)]" to="/admin/classes">
                  الفصول
                </Link>
                : عرض الفصول الـ 24 (صفوف 1–6 × شعب أ ب ج د) وتفعيل أو تعطيل الفصل وتعيين المشرف.
              </li>
              <li>
                <Link className="font-bold text-[var(--color-gold)]" to="/admin/staff">
                  الموظفون
                </Link>
                : إنشاء مشرفي الفصول فرديًا أو دفعة واحدة، وتعيين الفصل، والحذف بعد التأكيد.
              </li>
              <li>
                <Link className="font-bold text-[var(--color-gold)]" to="/admin/import">
                  استيراد
                </Link>
                : رفع ملف Excel أو CSV لإضافة طلاب دفعة واحدة.
              </li>
              <li>
                <Link className="font-bold text-[var(--color-gold)]" to="/admin/whatsapp">
                  مشرفو الاستئذان
                </Link>
                : أرقام واتساب لمشرفي الصفوف، ومسح رمز QR لربط الجلسة.
              </li>
              <li>
                <span className="font-bold text-[var(--color-gold)]">الدليل</span> (هذه الشاشة):
                مرجع تشغيل المنصة.
              </li>
            </ul>
          </GuideSection>

          <GuideSection id="staff" title="مشرفو الفصول">
            <p>
              من صفحة «الموظفون» يُنشأ مشرف لكل فصل. اختر الفصل ثم أكمل الإنشاء. تظهر بيانات
              الدخول على الشاشة مرة واحدة لتسليمها للمشرف مباشرة — لا تُحفظ في هذا الدليل.
            </p>
            <ul className="list-inside list-disc text-[var(--color-muted)]">
              <li>يمكن إنشاء مشرف واحد لفصل محدد، أو إنشاء مشرفين لكل الفصول دفعة واحدة.</li>
              <li>كل مشرف يرى طلبات فصله المعيّن فقط.</li>
              <li>إن لم يُعيَّن فصل للمشرف فلن تظهر له طلبات.</li>
              <li>يمكن حذف مشرف واحد أو حذف كل مشرفي الفصول بعد التأكيد.</li>
            </ul>
          </GuideSection>

          <GuideSection id="parent" title="واجهة ولي الأمر">
            <ul className="list-inside list-disc space-y-1 text-[var(--color-muted)]">
              <li>
                <strong>الرئيسية:</strong> قائمة الأبناء، تفعيل الإشعارات، وزر «طلب استئذان» لكل
                ابن.
              </li>
              <li>
                <strong>أبنائي:</strong> إضافة ابن برقم الهوية المسجّل لدى المدرسة، أو إزالة الربط
                دون حذف الطالب من سجلات المدرسة.
              </li>
              <li>
                <strong>الطلبات:</strong> تتبع كل طلب خطوة بخطوة (أُرسل → قيد المراجعة → قرار).
              </li>
              <li>الفصل يُحدَّد تلقائيًا من سجل الطالب؛ ولي الأمر لا يختار الصف يدويًا.</li>
              <li>لا يمكن إرسال طلب جديد لنفس الطالب إذا كان لديه طلب قيد الانتظار.</li>
            </ul>
          </GuideSection>

          <GuideSection id="class" title="واجهة مشرف الفصل">
            <ul className="list-inside list-disc space-y-1 text-[var(--color-muted)]">
              <li>عرض الطلبات الواردة لفصله فقط، وتحديثها فور وصول طلب جديد.</li>
              <li>الموافقة بعد تأكيد، أو الرفض مع كتابة سبب يظهر لولي الأمر.</li>
              <li>سجل مختصر للطلبات السابقة.</li>
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

          <GuideSection id="whatsapp" title="واتساب مشرفي الاستئذان">
            <p>
              من صفحة «مشرفو الاستئذان» تُضبط أرقام واتساب التي يصلها تنبيه عند طلب جديد،
              وتُربط جلسة الواتساب بمسح رمز QR عند أول تشغيل للبوابة.
            </p>
            <ul className="list-inside list-disc space-y-1 text-[var(--color-muted)]">
              <li>الصفوف 1–3: مشرف لكل فصل (شعبة).</li>
              <li>الصفوف 4–6: مشرف حسب الصف واليوم (توقيت الرياض).</li>
              <li>أدخل الاسم ورقم الواتساب ثم احفظ. الرقم يجب أن يكون صالحًا لاستلام الرسائل.</li>
              <li>
                ربط الجلسة يتم من جهاز أو خادم عليه البوابة؛ بعد المسح تظهر حالة الاتصال في الصفحة.
              </li>
            </ul>
          </GuideSection>

          <GuideSection id="import" title="الاستيراد الجماعي">
            <p>
              من صفحة «استيراد» ارفع ملف Excel أو CSV جاهز من المدرسة. الأعمدة المطلوبة: رقم هوية
              الطالب، اسم الطالب، الصف، الشعبة، رقم هوية ولي الأمر، اسم ولي الأمر، الجوال.
            </p>
            <ul className="list-inside list-disc text-[var(--color-muted)]">
              <li>الصف رقم من 1 إلى 6، والشعبة: أ أو ب أو ج أو د.</li>
              <li>المنصة تراجع الملف وتعرض الأخطاء قبل التنفيذ.</li>
              <li>إن لم يكن ولي الأمر موجودًا تُنشئه المنصة وتربط الطالب به.</li>
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
                إن تعطّل مشرف فصل، عطّله أو احذفه من صفحة الموظفين ثم أنشئ بديلًا وعيّنه لنفس الفصل.
              </li>
              <li>
                للمراقبة الشاملة استخدم «الطلبات» مع الفلاتر بدل الاعتماد على لوحة فصل واحد.
              </li>
              <li>التطبيق يدعم التثبيت على الجوال (PWA) ويعرض تنبيهًا عند انقطاع الشبكة.</li>
              <li>هذا الدليل متاح من قائمة المدير تحت بند «الدليل»، ويمكن تصديره PDF للطباعة.</li>
            </ul>
          </GuideSection>
        </div>
      </div>
    </div>
  )
}
